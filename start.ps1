<#
.SYNOPSIS
    NCIS DVD-to-Plex Automation Studio - one-click Windows launcher.

.DESCRIPTION
    Runs pre-flight checks (Python, MakeMKV, HandBrakeCLI, optical drive,
    built frontend), then starts the local automation server and opens the
    web studio in your default browser.

.PARAMETER Port
    HTTP port for the studio (default 5000).

.PARAMETER NoBrowser
    Do not open the browser automatically.

.EXAMPLE
    .\start.ps1

.EXAMPLE
    .\start.ps1 -Port 8080 -NoBrowser
#>
param(
    [int]$Port = 5000,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Write-Section([string]$Title) {
    Write-Host ""
    Write-Host ("=" * 62) -ForegroundColor DarkGray
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host ("=" * 62) -ForegroundColor DarkGray
}

Write-Section "NCIS DVD-to-Plex Automation Studio - Local Launcher"

# --- 1. Python -----------------------------------------------------------
$pyExe = $null
foreach ($candidate in @("python", "py")) {
    $cmd = Get-Command $candidate -ErrorAction SilentlyContinue
    if ($cmd) { $pyExe = $cmd.Source; break }
}
if (-not $pyExe) {
    Write-Host "[FAIL] Python not found on PATH." -ForegroundColor Red
    Write-Host "       Install Python 3 from https://www.python.org/downloads/"
    Write-Host "       (check 'Add python.exe to PATH' during setup), then re-run."
    exit 1
}
$pyVersion = (& $pyExe --version 2>&1) -join " "
Write-Host "[PASS] Python: $pyExe ($pyVersion)" -ForegroundColor Green

# --- 2. Built frontend ---------------------------------------------------
if (Test-Path (Join-Path $PSScriptRoot "dist\index.html")) {
    Write-Host "[PASS] Built frontend present: dist\" -ForegroundColor Green
} else {
    Write-Host "[WARN] dist\index.html not found - the web UI will not load." -ForegroundColor Yellow
    Write-Host "       Build it first:  npm install   then   npm run build"
}

# --- 3. MakeMKV / HandBrakeCLI (same search order as backend/server.py) ---
function Find-Tool([string]$Name, [string[]]$KnownPaths) {
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    foreach ($p in $KnownPaths) { if (Test-Path $p) { return $p } }
    return $null
}

$mkv = Find-Tool "makemkvcon64.exe" @(
    "C:\Program Files\MakeMKV\makemkvcon64.exe",
    "C:\Program Files (x86)\MakeMKV\makemkvcon64.exe",
    "C:\Program Files (x86)\MakeMKV\makemkv.exe"
)
if ($mkv) {
    Write-Host "[PASS] MakeMKV: $mkv" -ForegroundColor Green
} else {
    Write-Host "[WARN] MakeMKV not found - disc ripping will run in simulation mode." -ForegroundColor Yellow
    Write-Host "       Install from https://www.makemkv.com/download/"
}

$hb = Find-Tool "HandBrakeCLI.exe" @(
    "C:\Program Files\HandBrake\HandBrakeCLI.exe",
    "C:\Program Files (x86)\HandBrake\HandBrakeCLI.exe"
)
if ($hb) {
    Write-Host "[PASS] HandBrakeCLI: $hb" -ForegroundColor Green
} else {
    Write-Host "[WARN] HandBrakeCLI not found - transcoding will run in simulation mode." -ForegroundColor Yellow
    Write-Host "       Install the HandBrake desktop app (includes CLI): https://handbrake.fr/downloads.php"
}

# --- 4. Optical drive (WMI logical disks; DriveType 5 = CD-ROM) ---
$drives = @()
try {
    $drives = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=5" -ErrorAction Stop | ForEach-Object { $_.DeviceID })
} catch { Write-Host "[WARN] Drive detection failed: $($_.Exception.Message)" -ForegroundColor Yellow }
if ($drives.Count -gt 0) {
    Write-Host "[PASS] Optical drive(s): $($drives -join ', ')" -ForegroundColor Green
} else {
    Write-Host "[WARN] No optical CD/DVD drive detected." -ForegroundColor Yellow
    Write-Host "       Connect your DVD drive / insert a disc, then re-run."
}

# --- 5. Port already in use? ----------------------------------------------
function Test-Port([int]$p) {
    try {
        $c = New-Object System.Net.Sockets.TcpClient
        $c.Connect("127.0.0.1", $p)
        $c.Close()
        return $true
    } catch { return $false }
}

$studioUrl = "http://127.0.0.1:$Port"
if (Test-Port $Port) {
    Write-Host ""
    Write-Host "[INFO] Port $Port is already in use - assuming the studio server is already running." -ForegroundColor Cyan
    if (-not $NoBrowser) { Start-Process $studioUrl }
    exit 0
}

# --- 6. Launch -------------------------------------------------------------
Write-Section "Starting automation server"
$env:PORT = "$Port"
$env:HOST = "0.0.0.0"

if (-not $NoBrowser) {
    # Open the browser once /api/status answers (max ~20s), only on success.
    Start-Job -ScriptBlock {
        param($url, $p)
        $ok = $false
        for ($i = 0; $i -lt 40; $i++) {
            Start-Sleep -Milliseconds 500
            try {
                if ((Invoke-WebRequest "http://127.0.0.1:$p/api/status" -UseBasicParsing -TimeoutSec 1).StatusCode -eq 200) {
                    $ok = $true
                    break
                }
            } catch {}
        }
        if ($ok) { Start-Process $url }
    } -ArgumentList $studioUrl, $Port | Out-Null
}

Write-Host "Studio: $studioUrl   (press Ctrl+C to stop)" -ForegroundColor Cyan
& $pyExe (Join-Path $PSScriptRoot "backend\server.py")
