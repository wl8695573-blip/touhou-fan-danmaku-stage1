# Build script for the single-file HTML game.
# Usage (from repo root):
#   pwsh -File src/_build.ps1             -> writes index.html (repo root) + src/_check.js
#   pwsh -File src/_build.ps1 -OutDir out -> writes out/index.html
param([string]$OutDir = '')
$ErrorActionPreference = 'Stop'
$srcDir = $PSScriptRoot
if ($OutDir -eq '') { $OutDir = Split-Path -Parent $srcDir }
$enc = New-Object System.Text.UTF8Encoding($false)

function Concat-Bytes {
  param([byte[][]]$parts)
  $total = 0
  foreach ($p in $parts) { $total += $p.Length }
  $out = New-Object byte[] $total
  $off = 0
  foreach ($p in $parts) { [Array]::Copy($p, 0, $out, $off, $p.Length); $off += $p.Length }
  return $out
}

$jsFiles = @('10_core.js','20_actors.js','30_stage.js','40_boss.js','50_ui.js')
$jsParts = @()
foreach ($f in $jsFiles) {
  $jsParts += [IO.File]::ReadAllBytes((Join-Path $srcDir $f))
  $jsParts += $enc.GetBytes("`r`n")
}
$jsBytes = Concat-Bytes $jsParts
[IO.File]::WriteAllBytes((Join-Path $srcDir '_check.js'), $jsBytes)

$headBytes = [IO.File]::ReadAllBytes((Join-Path $srcDir 'head.html'))
$open = $enc.GetBytes('<script>' + "`r`n")
$close = $enc.GetBytes('</script>' + "`r`n</body>`r`n</html>`r`n")
$html = Concat-Bytes @($headBytes, $open, $jsBytes, $close)
[IO.File]::WriteAllBytes((Join-Path $OutDir 'index.html'), $html)
Write-Output ('_check.js bytes=' + $jsBytes.Length + '  index.html bytes=' + $html.Length + '  -> ' + (Join-Path $OutDir 'index.html'))
