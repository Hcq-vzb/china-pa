# Force header/sticky logos back to local PNG paths.
$Root = Split-Path -Parent $PSScriptRoot
$changed = 0

Get-ChildItem -Path $Root -Recurse -Filter '*.html' -File | Where-Object {
    $_.FullName -notmatch '\\tools\\'
} | ForEach-Object {
    $rel = $_.FullName.Substring($Root.Length + 1).Replace('\', '/')
    $depth = ($rel -split '/').Count - 1
    $prefix = if ($depth -gt 0) { '../' * $depth } else { '' }
    $siteLogo = $prefix + 'wp-content/uploads/2023/10/site-logo_NABO_Plastic.png'
    $stickyLogo = $prefix + 'wp-content/uploads/2023/10/sticky-logo_NABO_Plastic.png'

    $text = [IO.File]::ReadAllText($_.FullName)
    $orig = $text

    $text = [regex]::Replace($text, '(<img[^>]*class="[^"]*header-image[^"]*is-logo-image[^"]*"[^>]*\ssrc=")[^"]+(")', {
        param($m)
        return $m.Groups[1].Value + $siteLogo + $m.Groups[2].Value
    })

    $text = [regex]::Replace($text, '(<img[^>]*class="[^"]*is-logo-image[^"]*"[^>]*\ssrc=")[^"]+(")', {
        param($m)
        return $m.Groups[1].Value + $siteLogo + $m.Groups[2].Value
    })

    $text = [regex]::Replace($text, '(<img[^>]*\ssrc=")[^"]+("[^>]*class="[^"]*is-logo-image[^"]*")', {
        param($m)
        return $m.Groups[1].Value + $siteLogo + $m.Groups[2].Value
    })

    $text = [regex]::Replace($text, '(sticky-navigation-logo[\s\S]{0,400}?<img[^>]*\ssrc=")[^"]+(")', {
        param($m)
        return $m.Groups[1].Value + $stickyLogo + $m.Groups[2].Value
    })

    if ($text -ne $orig) {
        [IO.File]::WriteAllText($_.FullName, $text, (New-Object System.Text.UTF8Encoding $false))
        $changed++
    }
}

Write-Host "Fixed logos in $changed files"
