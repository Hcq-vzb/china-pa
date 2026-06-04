# Extract, download, and localize images for naboplastic static mirror
param(
    [int]$MaxWorkers = 6,
    [switch]$SkipDownload,
    [switch]$SkipLocalize
)

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
$BaseUrl = "https://www.naboplastic.com/"
$UploadsPrefix = "wp-content/uploads/"

$ImageExtPattern = '\.(jpg|jpeg|png|gif|webp|svg|ico|avif)'
$AbsPattern = "https?://(?:www\.)?naboplastic\.com/($([regex]::Escape($UploadsPrefix))[^`"'\s<>)]*$ImageExtPattern)"
$RelPattern = "(?<![/\w])($([regex]::Escape($UploadsPrefix))[^`"'\s<>)]*$ImageExtPattern)"

function Get-ImagePaths {
    param([string]$RootPath)
    $paths = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    $extensions = @('.html', '.css', '.js', '.json')

    Get-ChildItem -Path $RootPath -Recurse -File | Where-Object {
        $extensions -contains $_.Extension.ToLower() -and $_.FullName -notmatch '\\tools\\'
    } | ForEach-Object {
        $text = Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
        if (-not $text) { return }

        foreach ($m in [regex]::Matches($text, $AbsPattern, 'IgnoreCase')) {
            [void]$paths.Add($m.Groups[1].Value.Replace('\', '/'))
        }
        foreach ($m in [regex]::Matches($text, $RelPattern, 'IgnoreCase')) {
            [void]$paths.Add($m.Groups[1].Value.Replace('\', '/'))
        }
    }

    return ($paths | Sort-Object)
}

function Download-Image {
    param([string]$RelPath, [string]$RootPath, [string]$Base)

    $local = Join-Path $RootPath ($RelPath -replace '/', [IO.Path]::DirectorySeparatorChar)
    if ((Test-Path -LiteralPath $local) -and ((Get-Item -LiteralPath $local).Length -gt 0)) {
        return [pscustomobject]@{ Path = $RelPath; Status = 'skip' }
    }

    $dir = Split-Path -Parent $local
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    $url = $Base + $RelPath
    for ($i = 0; $i -lt 3; $i++) {
        try {
            Invoke-WebRequest -Uri $url -OutFile $local -UseBasicParsing -TimeoutSec 30 -Headers @{
                'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) StaticMirror/1.0'
            } | Out-Null
            if ((Get-Item -LiteralPath $local).Length -gt 0) {
                return [pscustomobject]@{ Path = $RelPath; Status = 'ok' }
            }
        }
        catch {
            if ($_.Exception.Response.StatusCode.value__ -eq 404) {
                return [pscustomobject]@{ Path = $RelPath; Status = 'fail:404' }
            }
            if ($i -eq 2) {
                return [pscustomobject]@{ Path = $RelPath; Status = "fail:$($_.Exception.Message)" }
            }
            Start-Sleep -Milliseconds (500 * ($i + 1))
        }
    }
    return [pscustomobject]@{ Path = $RelPath; Status = 'fail' }
}

function Update-HtmlUrls {
    param([string]$RootPath)
    $changed = 0
    Get-ChildItem -Path $RootPath -Recurse -Filter '*.html' -File | Where-Object {
        $_.FullName -notmatch '\\tools\\'
    } | ForEach-Object {
        $text = Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8
        $newText = [regex]::Replace(
            $text,
            'https?://(?:www\.)?naboplastic\.com/(wp-content/uploads/)',
            'wp-content/uploads/',
            'IgnoreCase'
        )
        if ($newText -ne $text) {
            Set-Content -LiteralPath $_.FullName -Value $newText -Encoding UTF8 -NoNewline
            $changed++
        }
    }
    return $changed
}

Write-Host "Root: $Root"
Write-Host "Scanning image references..."
$allPaths = Get-ImagePaths -RootPath $Root
Write-Host "Found $($allPaths.Count) unique image paths"

$toolsDir = Join-Path $Root 'tools'
if (-not (Test-Path $toolsDir)) { New-Item -ItemType Directory -Path $toolsDir | Out-Null }
$allPaths | ConvertTo-Json | Set-Content -Path (Join-Path $toolsDir 'image-manifest.json') -Encoding UTF8

$existing = @($allPaths | Where-Object { Test-Path -LiteralPath (Join-Path $Root ($_ -replace '/', [IO.Path]::DirectorySeparatorChar)) }).Count
$missing = @($allPaths | Where-Object { -not (Test-Path -LiteralPath (Join-Path $Root ($_ -replace '/', [IO.Path]::DirectorySeparatorChar))) })
Write-Host "Already local: $existing, need download: $($missing.Count)"

if (-not $SkipDownload -and $missing.Count -gt 0) {
    Write-Host "Downloading sequentially..."
    $stats = @{ ok = 0; skip = 0; fail = 0 }
    $failures = New-Object System.Collections.Generic.List[string]
    $done = 0
    $total = $missing.Count

    foreach ($relPath in $missing) {
        $result = Download-Image -RelPath $relPath -RootPath $Root -Base $BaseUrl
        $done++
        switch ($result.Status) {
            'ok' { $stats.ok++ }
            'skip' { $stats.skip++ }
            default {
                $stats.fail++
                [void]$failures.Add("$($result.Path) -> $($result.Status)")
            }
        }
        if ($done % 50 -eq 0 -or $done -eq $total) {
            Write-Host "  Progress: $done/$total (ok=$($stats.ok), fail=$($stats.fail))"
        }
    }

    Write-Host "Download complete: ok=$($stats.ok), skip=$($stats.skip), fail=$($stats.fail)"
    if ($failures.Count -gt 0) {
        $failures | Select-Object -First 500 | Set-Content (Join-Path $toolsDir 'download-failures.txt') -Encoding UTF8
        Write-Host "Failures logged: tools/download-failures.txt ($($failures.Count))"
    }
}

if (-not $SkipLocalize) {
    Write-Host "Localizing absolute image URLs in HTML..."
    $htmlChanged = Update-HtmlUrls -RootPath $Root
    Write-Host "Updated $htmlChanged HTML files"
}

Write-Host "`nImages by upload folder (top 15):"
$allPaths | ForEach-Object {
    $parts = $_ -split '/'
    if ($parts.Count -ge 4) { "$($parts[0])/$($parts[1])/$($parts[2])" } else { $_ }
} | Group-Object | Sort-Object Count -Descending | Select-Object -First 15 | ForEach-Object {
    Write-Host "  $($_.Name): $($_.Count)"
}

Write-Host "`nDone. Run tools/serve-local.ps1 to preview locally."
