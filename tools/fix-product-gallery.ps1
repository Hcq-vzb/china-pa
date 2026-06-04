# Fix WooCommerce product gallery for local file:// viewing.
$Root = Split-Path -Parent $PSScriptRoot
$changed = 0
$emptyRemoved = 0

Get-ChildItem -Path (Join-Path $Root 'product') -Recurse -Filter 'index.html' -File | ForEach-Object {
    $rel = $_.FullName.Substring($Root.Length + 1).Replace('\', '/')
    $depth = ($rel -split '/').Count - 1
    $prefix = if ($depth -gt 0) { '../' * $depth } else { '' }

    $text = [IO.File]::ReadAllText($_.FullName)
    $orig = $text

    $text = $text -replace '800w""', '800w"'
    $text = $text -replace '2x""', '2x"'
    $text = $text -replace 'class="woocommerce-product-gallery woocommerce-product-gallery--with-images[^"]*" data-columns="(\d+)" style="opacity: 0; transition: opacity \.25s ease-in-out;"', 'class="woocommerce-product-gallery woocommerce-product-gallery--with-images woocommerce-product-gallery--columns-$1 images" data-columns="$1" style="opacity: 1;"'

    if ($prefix) {
        $text = [regex]::Replace(
            $text,
            '(data-(?:thumb|src|large_image))="(?!\.{2}/)(?!https?://)(wp-content/uploads/)',
            "`$1=`"$prefix`$2"
        )
        $text = [regex]::Replace(
            $text,
            'data-thumb-srcset="""',
            'data-thumb-srcset=""'
        )
    }

    $emptyPattern = '<div data-thumb="" data-thumb-alt="[^"]*" data-thumb-srcset="""?\s*data-thumb-sizes=""?\s*class="woocommerce-product-gallery__image"><a href="#?"></a></div>'
    $newText = [regex]::Replace($text, $emptyPattern, '')
    if ($newText -ne $text) {
        $script:emptyRemoved++
        $text = $newText
    }

    if ($text -ne $orig) {
        [IO.File]::WriteAllText($_.FullName, $text, (New-Object System.Text.UTF8Encoding $false))
        $changed++
    }
}

Write-Host "Updated $changed product pages, removed $emptyRemoved empty gallery slides"
