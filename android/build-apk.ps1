# =============================================================================
# 三极管到计算机 · 3D 教学实验台 —— Android APK 构建脚本（无需 Gradle / Android Studio）
#
# 原理：WebView 壳 + 本地 assets/index.html
#   1) javac 编译 MainActivity
#   2) d8 生成 classes.dex
#   3) aapt2 编译/链接资源与 assets
#   4) 把 dex 塞进 APK → zipalign → apksigner 签名（debug 证书）
#
# 用法（PowerShell）：
#   cd 项目根目录
#   npm run build                 # 先构建 dist/index.html
#   powershell -ExecutionPolicy Bypass -File android\build-apk.ps1
# 产物：android/out/Triode2Computer-0.1.0.apk
# =============================================================================
param(
    [string]$OutDir = (Join-Path $PSScriptRoot 'out'),
    [string]$BuildDir = (Join-Path $PSScriptRoot 'build')
)

$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
$projectRoot = Split-Path $root -Parent

function Fail([string]$msg) { Write-Host "✗ $msg" -ForegroundColor Red; throw $msg }
function Step([string]$msg) { Write-Host "→ $msg" -ForegroundColor Cyan }

# ---------------------------------------------------------------- 定位工具链
$Sdk = $null
if ($env:ANDROID_HOME) { $Sdk = $env:ANDROID_HOME }
elseif ($env:ANDROID_SDK_ROOT) { $Sdk = $env:ANDROID_SDK_ROOT }
elseif (Test-Path (Join-Path $env:LOCALAPPDATA 'Android\Sdk')) { $Sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not $Sdk -or -not (Test-Path $Sdk)) { Fail '未找到 Android SDK：请安装 Android Studio，或设置 ANDROID_HOME' }

$BT = (Get-ChildItem (Join-Path $Sdk 'build-tools') -Directory | Sort-Object Name -Descending | Select-Object -First 1).FullName
$Platform = (Get-ChildItem (Join-Path $Sdk 'platforms') -Directory | Sort-Object Name -Descending | Select-Object -First 1).FullName
$AJ = Join-Path $Platform 'android.jar'
if (-not (Test-Path $AJ)) { Fail "缺少 android.jar：$AJ" }

$JDK = $env:JAVA_HOME
if (-not $JDK -or -not (Test-Path $JDK)) {
    $javacCmd = Get-Command javac -ErrorAction SilentlyContinue
    if (-not $javacCmd) { Fail '未找到 JDK：请安装 JDK 17 并设置 JAVA_HOME' }
    $JDK = Split-Path (Split-Path $javacCmd.Source -Parent) -Parent
}
$javac = Join-Path $JDK 'bin\javac.exe'
$jarTool = Join-Path $JDK 'bin\jar.exe'
$keytool = Join-Path $JDK 'bin\keytool.exe'
if (-not (Test-Path $javac)) { Fail "缺少 javac：$javac" }

$Aapt2 = Join-Path $BT 'aapt2.exe'
$D8 = Join-Path $BT 'd8.bat'
$ZipAlign = Join-Path $BT 'zipalign.exe'
$ApkSigner = Join-Path $BT 'apksigner.bat'
foreach ($tool in @($Aapt2, $D8, $ZipAlign, $ApkSigner)) {
    if (-not (Test-Path $tool)) { Fail "缺少构建工具：$tool" }
}
Write-Host "SDK      : $Sdk"
Write-Host "BuildTools: $BT"
Write-Host "Platform : $Platform"
Write-Host "JDK      : $JDK"

# ---------------------------------------------------------------- 准备目录
Step '准备构建目录 / 拷贝离线网页'
if (Test-Path $BuildDir) { Remove-Item $BuildDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $BuildDir, (Join-Path $BuildDir 'classes'), (Join-Path $BuildDir 'dex'), (Join-Path $BuildDir 'compiled'), $OutDir | Out-Null

$webSource = Join-Path $projectRoot 'dist\index.html'
if (-not (Test-Path $webSource)) { Fail '缺少 dist/index.html：请先在项目根目录运行 npm run build' }
$assetsDir = Join-Path $root 'assets'
New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null
Copy-Item $webSource (Join-Path $assetsDir 'index.html') -Force
Write-Host ("   assets/index.html  {0:N0} KB" -f ((Get-Item (Join-Path $assetsDir 'index.html')).Length / 1KB))

# ---------------------------------------------------------------- 生成图标
Step '生成应用图标（mipmap）'
Add-Type -AssemblyName System.Drawing
$resDir = Join-Path $root 'res'
$master = New-Object System.Drawing.Bitmap 512, 512
$g = [System.Drawing.Graphics]::FromImage($master)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$rect = New-Object System.Drawing.Rectangle 0, 0, 512, 512
$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(255, 10, 22, 38),
    [System.Drawing.Color]::FromArgb(255, 4, 8, 16),
    90.0)
$g.FillRectangle($bgBrush, $rect)
$bgBrush.Dispose()
for ($i = 0; $i -lt 6; $i++) {
    $alpha = 26 - $i * 4
    $glow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($alpha, 120, 170, 255))
    $d = 130 + $i * 46
    $g.FillEllipse($glow, [int](256 - $d / 2), [int](226 - $d / 2), $d, $d)
    $glow.Dispose()
}
$filamentColors = @(
    [System.Drawing.Color]::FromArgb(255, 255, 180, 84),
    [System.Drawing.Color]::FromArgb(255, 255, 150, 60),
    [System.Drawing.Color]::FromArgb(255, 255, 205, 130))
$filamentX = @(196, 256, 316)
$filamentH = @(120, 190, 140)
for ($i = 0; $i -lt 3; $i++) {
    $pen = New-Object System.Drawing.Pen ($filamentColors[$i], 26)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $g.DrawLine($pen, $filamentX[$i], (256 - $filamentH[$i] / 2), $filamentX[$i], (256 + $filamentH[$i] / 2))
    $pen.Dispose()
}
$ringPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(110, 120, 190, 255)), 3
$g.DrawEllipse($ringPen, 86, 76, 340, 340)
$ringPen.Dispose()
$g.Dispose()

$densities = @{
    'mipmap-mdpi'    = 48
    'mipmap-hdpi'    = 72
    'mipmap-xhdpi'   = 96
    'mipmap-xxhdpi'  = 144
    'mipmap-xxxhdpi' = 192
}
foreach ($dir in $densities.Keys) {
    $target = Join-Path $resDir $dir
    New-Item -ItemType Directory -Force -Path $target | Out-Null
    $size = $densities[$dir]
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $gr = [System.Drawing.Graphics]::FromImage($bmp)
    $gr.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gr.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $gr.DrawImage($master, 0, 0, $size, $size)
    $gr.Dispose()
    $bmp.Save((Join-Path $target 'ic_launcher.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}
$master.Dispose()
Write-Host '   图标已生成'

# ---------------------------------------------------------------- 编译 Java
Step 'javac 编译 MainActivity'
$javaFiles = @(Get-ChildItem (Join-Path $root 'java') -Recurse -Filter *.java | ForEach-Object { $_.FullName })
$javacOut = & $javac -encoding UTF-8 -source 1.8 -target 1.8 -nowarn -classpath $AJ -d (Join-Path $BuildDir 'classes') @javaFiles 2>$null
if ($LASTEXITCODE -ne 0) { Fail 'javac 编译失败' }

$classesJar = Join-Path $BuildDir 'classes.jar'
& $jarTool cf $classesJar -C (Join-Path $BuildDir 'classes') .
if ($LASTEXITCODE -ne 0) { Fail 'jar 打包 classes 失败' }

# ---------------------------------------------------------------- d8 → classes.dex
Step 'd8 生成 classes.dex'
& $D8 --lib $AJ --min-api 26 --output (Join-Path $BuildDir 'dex') $classesJar
if ($LASTEXITCODE -ne 0) { Fail 'd8 失败' }
$dexFile = Join-Path $BuildDir 'dex\classes.dex'
if (-not (Test-Path $dexFile)) { Fail '未生成 classes.dex' }

# ---------------------------------------------------------------- aapt2 编译资源
Step 'aapt2 编译 / 链接资源'
# aapt2 对“中文绝对路径”支持不佳：切到 android 目录、全部用相对路径
Push-Location $root
try {
    & $Aapt2 compile --dir 'res' -o 'build\compiled'
    if ($LASTEXITCODE -ne 0) { Fail 'aapt2 compile 失败' }

    $flatFiles = @(Get-ChildItem 'build\compiled' -Recurse -Filter *.flat | ForEach-Object { $_.FullName.Replace($root + '\', '') })
    $baseApk = Join-Path $BuildDir 'base.apk'
    & $Aapt2 link -o 'build\base.apk' -I $AJ --manifest 'AndroidManifest.xml' --min-sdk-version 26 --target-sdk-version 34 --version-code 1 --version-name 0.1.0 -A 'assets' @flatFiles
    if ($LASTEXITCODE -ne 0) { Fail 'aapt2 link 失败' }
} finally {
    Pop-Location
}

# ---------------------------------------------------------------- 注入 dex
Step '把 classes.dex 写入 APK'
Add-Type -AssemblyName System.IO.Compression | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null
$zip = [System.IO.Compression.ZipFile]::Open($baseApk, [System.IO.Compression.ZipArchiveMode]::Update)
$entry = $zip.CreateEntry('classes.dex')
$entryStream = $entry.Open()
$dexBytes = [System.IO.File]::ReadAllBytes($dexFile)
$entryStream.Write($dexBytes, 0, $dexBytes.Length)
$entryStream.Close()
$zip.Dispose()

# ---------------------------------------------------------------- zipalign + 签名
Step 'zipalign + apksigner 签名'
$alignedApk = Join-Path $BuildDir 'aligned.apk'
& $ZipAlign -f -p 4 $baseApk $alignedApk
if ($LASTEXITCODE -ne 0) { Fail 'zipalign 失败' }

$keystoreDir = Join-Path $root 'keystore'
New-Item -ItemType Directory -Force -Path $keystoreDir | Out-Null
$keystore = Join-Path $keystoreDir 'debug.keystore'
if (-not (Test-Path $keystore)) {
    & $keytool -genkeypair -keystore $keystore -storepass android -keypass android -alias androiddebugkey -dname "CN=Triode2Computer, O=Teaching, C=CN" -keyalg RSA -keysize 2048 -validity 10000 -noprompt | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail 'keytool 生成签名证书失败' }
}

$finalApk = Join-Path $OutDir 'Triode2Computer-0.1.0.apk'
if (Test-Path $finalApk) { Remove-Item $finalApk -Force }
& $ApkSigner sign --ks $keystore --ks-pass pass:android --key-pass pass:android --ks-key-alias androiddebugkey --out $finalApk $alignedApk
if ($LASTEXITCODE -ne 0) { Fail 'apksigner 签名失败' }

Step '验证 APK'
& $ApkSigner verify --print-certs $finalApk
if ($LASTEXITCODE -ne 0) { Fail 'APK 签名校验失败' }
$badging = & $Aapt2 dump badging $finalApk 2>$null
$badging | Select-Object -First 6

$sizeKB = (Get-Item $finalApk).Length / 1KB
Write-Host ("`n✓ 构建完成：{0}  ({1:N0} KB)" -f $finalApk, $sizeKB) -ForegroundColor Green
Write-Host '  安装：adb install -r "android\out\Triode2Computer-0.1.0.apk"'
Write-Host '  或把 APK 发到手机，允许"安装未知来源应用"后点击安装。'
exit 0
