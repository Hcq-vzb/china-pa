# Start local static server for naboplastic mirror
$Root = Split-Path -Parent $PSScriptRoot
$Port = 8080

Write-Host "Serving: $Root"
Write-Host "Open: http://localhost:$Port/"
Write-Host "Press Ctrl+C to stop"

Set-Location $Root
& npx --yes serve -l $Port .
