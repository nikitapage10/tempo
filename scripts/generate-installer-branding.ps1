# Regenerates NSIS branding bitmaps: TEMPO only (no "Desktop").
# Sizes are fixed by NSIS MUI: sidebar 164x314, header 150x57, 24bpp.

Add-Type -AssemblyName System.Drawing

function New-IceAmberBrush([int]$x1, [int]$y1, [int]$x2, [int]$y2) {
  $c1 = [System.Drawing.Color]::FromArgb(255, 127, 180, 255)
  $c2 = [System.Drawing.Color]::FromArgb(255, 242, 240, 235)
  $c3 = [System.Drawing.Color]::FromArgb(255, 255, 181, 107)
  $a = [System.Drawing.Point]::new($x1, $y1)
  $b = [System.Drawing.Point]::new($x2, $y2)
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($a, $b, $c1, $c3)
  $blend = New-Object System.Drawing.Drawing2D.ColorBlend 3
  $blend.Colors = @($c1, $c2, $c3)
  $blend.Positions = @(0.0, 0.5, 1.0)
  $brush.InterpolationColors = $blend
  return $brush
}

function Draw-Bars(
  [System.Drawing.Graphics]$g,
  [float]$cx,
  [float]$top,
  [float]$maxH,
  [float]$barW,
  [float]$gap
) {
  $heights = @(0.32, 0.58, 1.0, 0.78, 0.42)
  $totalW = ($heights.Count * $barW) + (($heights.Count - 1) * $gap)
  $x = $cx - ($totalW / 2.0)
  $brush = New-IceAmberBrush 0 ([int][Math]::Floor($top)) 0 ([int][Math]::Ceiling($top + $maxH))
  foreach ($h in $heights) {
    $bh = [Math]::Max(2.0, $maxH * $h)
    $y = $top + ($maxH - $bh)
    $g.FillRectangle($brush, $x, $y, $barW, $bh)
    $x += $barW + $gap
  }
  $brush.Dispose()
}

function Save-Bmp24([System.Drawing.Bitmap]$bitmap, [string]$path) {
  $clone = New-Object System.Drawing.Bitmap $bitmap.Width, $bitmap.Height, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $cg = [System.Drawing.Graphics]::FromImage($clone)
  $cg.CompositingMode = 'SourceCopy'
  $cg.DrawImageUnscaled($bitmap, 0, 0)
  $cg.Dispose()
  if (Test-Path $path) { Remove-Item -Force $path }
  $clone.Save($path, [System.Drawing.Imaging.ImageFormat]::Bmp)
  $clone.Dispose()
}

$outDir = Join-Path (Get-Location) "electron\build"
$bg = [System.Drawing.Color]::FromArgb(255, 10, 10, 12)

# Sidebar
$side = New-Object System.Drawing.Bitmap 164, 314, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g = [System.Drawing.Graphics]::FromImage($side)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAliasGridFit'
$g.Clear($bg)

$iceGlow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(36, 127, 180, 255))
$g.FillEllipse($iceGlow, -40, -30, 244, 200)
$iceGlow.Dispose()
$amberGlow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(28, 255, 181, 107))
$g.FillEllipse($amberGlow, -20, 180, 220, 180)
$amberGlow.Dispose()

Draw-Bars $g 82 86 48 5 3.5

$font = New-Object System.Drawing.Font "Segoe UI", 17, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Point)
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = 'Center'
$sf.LineAlignment = 'Near'
$g.DrawString("TEMPO", $font, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF 0, 152, 164, 40), $sf)
$font.Dispose()
$sf.Dispose()

$flare = New-IceAmberBrush 30 0 134 0
$g.FillRectangle($flare, 30, 200, 104, 2)
$flare.Dispose()
$g.Dispose()

Save-Bmp24 $side (Join-Path $outDir "installerSidebar.bmp")
Save-Bmp24 $side (Join-Path $outDir "uninstallerSidebar.bmp")
$side.Dispose()

# Header — wordmark only
$header = New-Object System.Drawing.Bitmap 150, 57, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$hg = [System.Drawing.Graphics]::FromImage($header)
$hg.SmoothingMode = 'AntiAlias'
$hg.TextRenderingHint = 'AntiAliasGridFit'
$hg.Clear($bg)
Draw-Bars $hg 20 14 26 3 2
$hfont = New-Object System.Drawing.Font "Segoe UI", 12, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Point)
$hg.DrawString("TEMPO", $hfont, [System.Drawing.Brushes]::White, 40, 17)
$hfont.Dispose()
$hg.Dispose()
Save-Bmp24 $header (Join-Path $outDir "installerHeader.bmp")
$header.Dispose()

foreach ($name in @("installerSidebar.bmp","installerHeader.bmp","uninstallerSidebar.bmp")) {
  $p = Join-Path $outDir $name
  $b = [System.Drawing.Bitmap]::FromFile($p)
  $preview = Join-Path $env:TEMP ("tempo-brand-" + $name.Replace('.bmp','.png'))
  if (Test-Path $preview) { Remove-Item -Force $preview }
  $b.Save($preview, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Output "OK $name $($b.Width)x$($b.Height) $((Get-Item $p).Length)"
  $b.Dispose()
}
