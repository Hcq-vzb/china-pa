# Replace logo references with PNG and use relative paths (works with file:// and local server).
$Root = Split-Path -Parent $PSScriptRoot
$changed = 0

Get-ChildItem -Path $Root -Recurse -Filter '*.html' -File | Where-Object {
    $_.FullName -notmatch '\\tools\\'
} | ForEach-Object {
    $rel = $_.FullName.Substring($Root.Length + 1).Replace('\', '/')
    $parts = $rel -split '/'
    $depth = $parts.Count - 1
    $prefix = if ($depth -gt 0) { '../' * $depth } else { '' }

    $siteLogo = $prefix + 'wp-content/uploads/2023/10/site-logo_NABO_Plastic.png'
    $stickyLogo = $prefix + 'wp-content/uploads/2023/10/sticky-logo_NABO_Plastic.png'

    $text = [IO.File]::ReadAllText($_.FullName)
    $orig = $text

    $text = [regex]::Replace($text, 'site-logo_NABO_Plastic\.svg', 'site-logo_NABO_Plastic.png', 'IgnoreCase')
    $text = [regex]::Replace($text, 'sticky-logo_NABO_Plastic\.svg', 'sticky-logo_NABO_Plastic.png', 'IgnoreCase')

    $sitePattern = '(?:/|(?:\.\./)+)?wp-content/uploads/2023/10/site-logo_NABO_Plastic\.png'
    $stickyPattern = '(?:/|(?:\.\./)+)?wp-content/uploads/2023/10/sticky-logo_NABO_Plastic\.png'

    $text = [regex]::Replace($text, $sitePattern, { $siteLogo })
    $text = [regex]::Replace($text, $stickyPattern, { $stickyLogo })

    if ($text -ne $orig) {
        [IO.File]::WriteAllText($_.FullName, $text, (New-Object System.Text.UTF8Encoding $false))
        $changed++
    }
}

Write-Host "Updated $changed HTML files"

$logoDir = Join-Path $Root 'wp-content\uploads\2023\10'
@('site-logo_NABO_Plastic.png', 'sticky-logo_NABO_Plastic.png') | ForEach-Object {
    $path = Join-Path $logoDir $_
    if (Test-Path $path) {
        Write-Host "OK $_ ($((Get-Item $path).Length) bytes)"
    } else {
        Write-Host "Missing $_"
    }
}
