# Rakit mdgenerator.zip siap-upload ke cPanel.
# Pakai:  powershell -ExecutionPolicy Bypass -File deploy\make-zip.ps1
#         powershell -ExecutionPolicy Bypass -File deploy\make-zip.ps1 -NoVendor   (kalau server punya Composer)
param([switch]$NoVendor)

$root = Split-Path $PSScriptRoot -Parent
$out  = Join-Path (Split-Path $root -Parent) 'mdgenerator.zip'

Push-Location $root
$items = if ($NoVendor) {
    'app','bootstrap','config','database','deploy','public','routes','storage','tests',
    'artisan','composer.json','composer.lock','.env.example'
} else {
    'vendor','app','bootstrap','config','database','deploy','public','routes','storage','tests',
    'artisan','composer.json','composer.lock','.env.example'
}

tar -a -c -f $out --exclude=.git `
  --exclude=storage/logs `
  --exclude=storage/app/private `
  --exclude=storage/framework/views `
  --exclude=storage/framework/cache `
  --exclude=storage/framework/sessions `
  --exclude=storage/framework/testing `
  --exclude=bootstrap/cache `
  @items
Pop-Location

if (Test-Path $out) {
    $mb = [math]::Round((Get-Item $out).Length / 1MB, 1)
    Write-Output "OK: $out ($mb MB)"
    Write-Output "Upload ZIP ini ke /home/USERNAME/ di cPanel, lalu Extract menjadi mdgenerator/ (lihat deploy.md A2)."
} else {
    Write-Error "Gagal membuat $out"
}
