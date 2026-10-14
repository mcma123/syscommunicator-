# Preserve the supplied crest; fit it into native icon canvases without cropping.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$taskRepositoryRoot = Split-Path -Parent $PSScriptRoot
$taskLogoPath = Join-Path $taskRepositoryRoot 'public/logo.png'
$taskAssetsPath = Join-Path $taskRepositoryRoot 'apps/expo/assets'
$taskLogoImage = [System.Drawing.Image]::FromFile($taskLogoPath)
try {
    foreach ($taskIcon in @(
        @{ Name = 'icon.png'; Size = 840; Background = [System.Drawing.Color]::White },
        @{ Name = 'adaptive-icon.png'; Size = 660; Background = [System.Drawing.Color]::Transparent }
    )) {
        $taskCanvas = New-Object System.Drawing.Bitmap(1024, 1024)
        $taskGraphics = [System.Drawing.Graphics]::FromImage($taskCanvas)
        try {
            $taskGraphics.Clear($taskIcon.Background)
            $taskGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $taskRatio = [Math]::Min($taskIcon.Size / $taskLogoImage.Width, $taskIcon.Size / $taskLogoImage.Height)
            $taskDrawWidth = [int]($taskLogoImage.Width * $taskRatio)
            $taskDrawHeight = [int]($taskLogoImage.Height * $taskRatio)
            $taskRectangle = New-Object System.Drawing.Rectangle(([int]((1024 - $taskDrawWidth) / 2)), ([int]((1024 - $taskDrawHeight) / 2)), $taskDrawWidth, $taskDrawHeight)
            $taskGraphics.DrawImage($taskLogoImage, $taskRectangle)
            $taskCanvas.Save((Join-Path $taskAssetsPath $taskIcon.Name), [System.Drawing.Imaging.ImageFormat]::Png)
        } finally {
            $taskGraphics.Dispose()
            $taskCanvas.Dispose()
        }
    }
} finally {
    $taskLogoImage.Dispose()
}
Write-Output 'Prepared square Expo icons from the supplied crest.'
