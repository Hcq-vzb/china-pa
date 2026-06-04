# Fix broken srcset/imagesrcset paths in nested HTML pages.
# src uses ../../wp-content/... but srcset used wp-content/... (wrong on subpages).

$Root = Split-Path -Parent $PSScriptRoot
$changed = 0
$fixedAttrs = 0

Get-ChildItem -Path $Root -Recurse -Filter '*.html' -File | Where-Object {
    $_.FullName -notmatch '\\tools\\'
} | ForEach-Object {
    $rel = $_.FullName.Substring($Root.Length + 1).Replace('\', '/')
    # depth = dirs below root; index.html at root -> 0, pet/index.html -> 1, pet/page/2/index.html -> 3
    $parts = $rel -split '/'
    $depth = $parts.Count - 1
    if ($depth -le 0) { return }

    $prefix = ('../' * $depth)
    $text = [IO.File]::ReadAllText($_.FullName)
    $orig = $text

    # Fix srcset="...wp-content/uploads/..." and imagesrcset='...'
    $text = [regex]::Replace($text, '(srcset|imagesrcset)=(["''])([^"'']*)\2', {
        param($m)
        $attr = $m.Groups[1].Value
        $quote = $m.Groups[2].Value
        $val = $m.Groups[3].Value
        $newVal = [regex]::Replace($val, '(?<![/.])\bwp-content/uploads/', ($prefix + 'wp-content/uploads/'))
        if ($newVal -ne $val) { $script:fixedAttrs++ }
        return "$attr=$quote$newVal$quote"
    })

    if ($text -ne $orig) {
        [IO.File]::WriteAllText($_.FullName, $text, (New-Object System.Text.UTF8Encoding $false))
        $changed++
    }
}

Write-Host "Updated $changed HTML files, fixed $fixedAttrs srcset/imagesrcset attributes"
