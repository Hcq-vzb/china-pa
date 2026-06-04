# Replace brand keyword NABO -> KIWL in site text (not in asset paths or URL slugs).
$Root = Split-Path -Parent $PSScriptRoot
$changed = 0
$replacements = 0

function Protect-AssetPaths {
    param([string]$Text)
    $script:placeholders = @()
    $script:n = 0

    $Text = [regex]::Replace($Text, 'url\(((?:\.\./)*wp-content/[^)]*NABO[^)]*)\)', {
        param($m)
        $key = "___ASSET_$($script:n)___"
        $script:placeholders += $m.Groups[1].Value
        $script:n++
        return $key
    })

    $Text = [regex]::Replace($Text, '(?<![A-Za-z0-9_])(?:\.\./)*wp-content/[^\s"''<>)\]]*NABO[^\s"''<>)\]]*', {
        param($m)
        $key = "___ASSET_$($script:n)___"
        $script:placeholders += $m.Value
        $script:n++
        return $key
    })

    return $Text
}

function Restore-AssetPaths {
    param([string]$Text)
    for ($i = 0; $i -lt $script:placeholders.Count; $i++) {
        $Text = $Text.Replace("___ASSET_$i___", $script:placeholders[$i])
    }
    return $Text
}

function Convert-BrandText {
    param([string]$Text)
    $count = 0
    $pairs = @(
        @('Taizhou NABO Plastic Mould Co., Ltd.', 'Taizhou KIWL Plastic Mould Co., Ltd.'),
        @('Taizhou NABO Plastic Mould Co.,Ltd.', 'Taizhou KIWL Plastic Mould Co.,Ltd.'),
        @('Taizhou NABO Plastic Mould Co.,Ltd', 'Taizhou KIWL Plastic Mould Co.,Ltd'),
        @('NABO%20Plastic', 'KIWL%20Plastic'),
        @('NABO Plastic', 'KIWL Plastic'),
        @('NABO塑料', 'KIWL塑料')
    )
    foreach ($pair in $pairs) {
        $before = $Text
        $Text = $Text.Replace($pair[0], $pair[1])
        if ($Text -ne $before) { $count++ }
    }
    $Text = [regex]::Replace($Text, '(?<![_A-Za-z0-9-])NABO(?![_A-Za-z0-9-])', {
        param($m)
        $script:count++
        return 'KIWL'
    })
    return $Text
}

Get-ChildItem -Path $Root -Recurse -File | Where-Object {
    $_.FullName -notmatch '\\tools\\' -and $_.Extension -match '^\.(html|json|xml|js|css)$'
} | ForEach-Object {
    $text = [IO.File]::ReadAllText($_.FullName)
    $orig = $text

    $script:placeholders = @()
    $text = Protect-AssetPaths $text
    $text = Convert-BrandText $text
    $text = Restore-AssetPaths $text

    if ($text -ne $orig) {
        [IO.File]::WriteAllText($_.FullName, $text, (New-Object System.Text.UTF8Encoding $false))
        $changed++
    }
}

Write-Host "Updated $changed files"
