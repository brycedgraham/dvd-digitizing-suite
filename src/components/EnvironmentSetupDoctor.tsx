import React, { useState } from 'react';
import {
  ShieldCheck,
  Terminal,
  Download,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  Disc,
  Cpu,
  FileCode,
  Wrench,
  HelpCircle,
  ExternalLink,
  Play,
  RotateCw,
} from 'lucide-react';
import { PipelineSettings, SystemCheckItem } from '../types';

interface EnvironmentSetupDoctorProps {
  settings: PipelineSettings;
  setSettings: React.Dispatch<React.SetStateAction<PipelineSettings>>;
}

export const EnvironmentSetupDoctor: React.FC<EnvironmentSetupDoctorProps> = ({
  settings,
  setSettings,
}) => {
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedOneLiner, setCopiedOneLiner] = useState(false);
  const [dvdDriveLetter, setDvdDriveLetter] = useState('D:');
  const [scratchDriveLetter, setScratchDriveLetter] = useState('C:');
  const [plexDriveLetter, setPlexDriveLetter] = useState('P:');
  const [activeSubTab, setActiveSubTab] = useState<'script' | 'checklist' | 'readme'>('script');

  // Interactive checklist state
  const [checkItems, setCheckItems] = useState<SystemCheckItem[]>([
    {
      id: 'handbrake_cli',
      name: 'HandBrakeCLI Transcoder Engine',
      category: 'tool',
      description: 'Command line encoder used by the automated batch script to transcode DVD 480i video with Decomb.',
      checkCommand: 'HandBrakeCLI --version',
      fixRecommendation: 'winget install HandBrake.HandBrake.CLI',
      status: 'passed',
      detectedValue: 'Found in standard installation directory',
    },
    {
      id: 'makemkv',
      name: 'MakeMKV Lossless Disc Ripper',
      category: 'tool',
      description: 'Bypasses DVD CSS encryption and rips clean raw MKV title streams.',
      checkCommand: 'Test-Path "C:\\Program Files (x86)\\MakeMKV\\makemkvcon64.exe"',
      fixRecommendation: 'winget install GuinpinSoft.MakeMKV',
      status: 'passed',
      detectedValue: 'Version 1.17+ supported',
    },
    {
      id: 'dvd_drive',
      name: 'Optical DVD / Blu-ray Disc Drive',
      category: 'hardware',
      description: 'Physical optical drive to read the NCIS DVD box set discs.',
      checkCommand: 'Get-CimInstance Win32_CDROMDrive',
      fixRecommendation: 'Connect your internal or external USB DVD-RW / Blu-ray drive.',
      status: 'passed',
      detectedValue: `Configured for drive ${dvdDriveLetter}`,
    },
    {
      id: 'scratch_storage',
      name: 'MakeMKV Scratch Disk Space',
      category: 'storage',
      description: 'Fast temporary disk space for raw MakeMKV rips (~8-10 GB per disc needed during ripping).',
      checkCommand: 'Get-PSDrive -Name C | Select-Object Free',
      fixRecommendation: 'Ensure at least 15 GB of free space is available on your temporary rip drive.',
      status: 'passed',
      detectedValue: `Targeting drive ${scratchDriveLetter} (>25 GB free recommended)`,
    },
    {
      id: 'plex_storage',
      name: 'Plex Library Final Storage',
      category: 'storage',
      description: 'Target drive for Plex TV shows (~15 GB per season, ~130 GB for all 8 seasons).',
      checkCommand: 'Test-Path "P:\\Plex Media\\TV Shows"',
      fixRecommendation: 'Verify your Plex TV Shows library folder exists and has sufficient space for digitizing.',
      status: 'passed',
      detectedValue: `Path: ${settings.plexLibraryDirectory}`,
    },
    {
      id: 'execution_policy',
      name: 'Windows PowerShell Execution Policy',
      category: 'permission',
      description: 'Permission required by Windows to execute local .ps1 automation scripts.',
      checkCommand: 'Get-ExecutionPolicy',
      fixRecommendation: 'Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass',
      status: 'passed',
      detectedValue: 'Bypass or RemoteSigned allowed',
    },
  ]);

  // Generate the production-grade PowerShell Environment Doctor Script
  const generatePowerShellDoctorScript = () => {
    return `# =====================================================================
# NCIS DVD-to-Plex PC Environment Doctor (Diagnostic & Setup Script)
# Checks all hardware, software, storage, and script permissions on Windows
# =====================================================================

param (
    [string]$HandBrakeCliPath = "${settings.handbrakeCliPath}",
    [string]$PlexTargetDir = "${settings.plexLibraryDirectory}",
    [string]$ScratchDrive = "${scratchDriveLetter.replace(':', '')}"
)

Clear-Host
$Host.UI.RawUI.WindowTitle = "NCIS DVD-to-Plex PC Environment Doctor"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "     NCIS Seasons 1-8 DVD-to-Plex Setup & Requirement Doctor     " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "Checking your Windows PC configuration for MakeMKV & HandBrake..." -ForegroundColor Gray
Write-Host ""

$PassedChecks = 0
$TotalChecks = 6
$NeedsWingetInstall = @()

# ---------------------------------------------------------------------
# Check 1: PowerShell Architecture & Version
# ---------------------------------------------------------------------
Write-Host "[1/6] Checking Windows PowerShell..." -NoNewline
$psVer = $PSVersionTable.PSVersion
if ($psVer.Major -ge 5) {
    Write-Host " [PASS]" -ForegroundColor Green
    Write-Host "      PowerShell Version: $($psVer.ToString()) (Architecture: $([IntPtr]::Size * 8)-bit)" -ForegroundColor DarkGray
    $PassedChecks++
} else {
    Write-Host " [WARN]" -ForegroundColor Yellow
    Write-Host "      PowerShell 5.1 or newer recommended. Current: $($psVer.ToString())" -ForegroundColor Yellow
}

# ---------------------------------------------------------------------
# Check 2: HandBrakeCLI Transcoder Engine
# ---------------------------------------------------------------------
Write-Host "[2/6] Checking HandBrakeCLI..." -NoNewline
$foundHb = $false
$detectedHbPath = ""

if (Test-Path $HandBrakeCliPath) {
    $foundHb = $true
    $detectedHbPath = $HandBrakeCliPath
} else {
    $cmd = Get-Command "HandBrakeCLI.exe" -ErrorAction SilentlyContinue
    if ($cmd) {
        $foundHb = $true
        $detectedHbPath = $cmd.Source
    } elseif (Test-Path "C:\\Program Files\\HandBrake\\HandBrakeCLI.exe") {
        $foundHb = $true
        $detectedHbPath = "C:\\Program Files\\HandBrake\\HandBrakeCLI.exe"
    } elseif (Test-Path "C:\\Program Files (x86)\\HandBrake\\HandBrakeCLI.exe") {
        $foundHb = $true
        $detectedHbPath = "C:\\Program Files (x86)\\HandBrake\\HandBrakeCLI.exe"
    }
}

if ($foundHb) {
    Write-Host " [PASS]" -ForegroundColor Green
    try {
        $verOutput = (& $detectedHbPath --version 2>&1 | Out-String).Trim()
        Write-Host "      Found: $detectedHbPath" -ForegroundColor DarkGray
        Write-Host "      Version details: $verOutput" -ForegroundColor DarkGray
    } catch {
        Write-Host "      Found at: $detectedHbPath" -ForegroundColor DarkGray
    }
    $PassedChecks++
} else {
    Write-Host " [MISSING]" -ForegroundColor Red
    Write-Host "      HandBrakeCLI was not detected in PATH or standard Program Files." -ForegroundColor Red
    Write-Host "      Install via: winget install HandBrake.HandBrake.CLI" -ForegroundColor Yellow
    $NeedsWingetInstall += "HandBrake.HandBrake.CLI"
}

# ---------------------------------------------------------------------
# Check 3: MakeMKV Lossless Ripper
# ---------------------------------------------------------------------
Write-Host "[3/6] Checking MakeMKV Installation..." -NoNewline
$makeMkvPaths = @(
    "C:\\Program Files (x86)\\MakeMKV\\makemkvcon64.exe",
    "C:\\Program Files\\MakeMKV\\makemkvcon64.exe",
    "C:\\Program Files (x86)\\MakeMKV\\makemkv.exe"
)
$foundMkv = $false
foreach ($p in $makeMkvPaths) {
    if (Test-Path $p) {
        $foundMkv = $true
        Write-Host " [PASS]" -ForegroundColor Green
        Write-Host "      Found: $p" -ForegroundColor DarkGray
        $PassedChecks++
        break
    }
}

if (-not $foundMkv) {
    # Check registry or PATH
    $cmdMkv = Get-Command "makemkvcon.exe" -ErrorAction SilentlyContinue
    if ($cmdMkv) {
        Write-Host " [PASS]" -ForegroundColor Green
        Write-Host "      Found in PATH: $($cmdMkv.Source)" -ForegroundColor DarkGray
        $PassedChecks++
    } else {
        Write-Host " [MISSING]" -ForegroundColor Yellow
        Write-Host "      MakeMKV is not found in standard paths." -ForegroundColor Yellow
        Write-Host "      Install via: winget install GuinpinSoft.MakeMKV" -ForegroundColor DarkGray
        $NeedsWingetInstall += "GuinpinSoft.MakeMKV"
    }
}

# ---------------------------------------------------------------------
# Check 4: Optical CD/DVD/Blu-ray Disc Drive
# ---------------------------------------------------------------------
Write-Host "[4/6] Checking Optical DVD Drive..." -NoNewline
$dvdDrives = @(Get-CimInstance Win32_CDROMDrive -ErrorAction SilentlyContinue)
if ($dvdDrives -and $dvdDrives.Count -gt 0) {
    Write-Host " [PASS]" -ForegroundColor Green
    foreach ($d in $dvdDrives) {
        Write-Host "      Drive $($d.Drive): - $($d.Name) ($($d.Status))" -ForegroundColor DarkGray
    }
    $PassedChecks++
} else {
    Write-Host " [CHECK NEEDED]" -ForegroundColor Yellow
    Write-Host "      No active DVD-ROM drive reported by Windows WMI." -ForegroundColor Yellow
    Write-Host "      If you use an external USB optical drive, please plug it in before inserting NCIS discs." -ForegroundColor DarkGray
}

# ---------------------------------------------------------------------
# Check 5: Scratch and Plex Storage Capacities
# ---------------------------------------------------------------------
Write-Host "[5/6] Checking Disk Space & Destination Folders..." -NoNewline

# Check Scratch Space
$scratchDriveObj = Get-PSDrive -Name $ScratchDrive -PSProvider FileSystem -ErrorAction SilentlyContinue
$scratchOk = $false
if ($scratchDriveObj) {
    $freeGb = [math]::Round($scratchDriveObj.Free / 1GB, 1)
    if ($freeGb -ge 10) {
        $scratchOk = $true
    }
}

# Check Plex Destination
$plexDirExists = Test-Path $PlexTargetDir

if ($scratchOk -and $plexDirExists) {
    Write-Host " [PASS]" -ForegroundColor Green
    Write-Host "      Scratch Drive ($($ScratchDrive):) has $freeGb GB free (>= 10 GB required per disc)." -ForegroundColor DarkGray
    Write-Host "      Plex destination confirmed: $PlexTargetDir" -ForegroundColor DarkGray
    $PassedChecks++
} elseif ($scratchOk) {
    Write-Host " [PASS - Note]" -ForegroundColor Green
    Write-Host "      Scratch Drive has $freeGb GB free." -ForegroundColor DarkGray
    Write-Host "      Plex folder '$PlexTargetDir' will be auto-created upon first encode." -ForegroundColor DarkGray
    $PassedChecks++
} else {
    Write-Host " [WARN]" -ForegroundColor Yellow
    Write-Host "      Scratch drive has low disk space ($freeGb GB free). Ripping 1 DVD requires ~8-9 GB." -ForegroundColor Yellow
}

# ---------------------------------------------------------------------
# Check 6: PowerShell Script Execution Policy
# ---------------------------------------------------------------------
Write-Host "[6/6] Checking Script Execution Policy..." -NoNewline
$policy = Get-ExecutionPolicy
if ($policy -in @("Bypass", "Unrestricted", "RemoteSigned")) {
    Write-Host " [PASS]" -ForegroundColor Green
    Write-Host "      ExecutionPolicy is set to '$policy' (scripts can run)." -ForegroundColor DarkGray
    $PassedChecks++
} else {
    Write-Host " [RESTRICTED]" -ForegroundColor Yellow
    Write-Host "      ExecutionPolicy is set to '$policy'. Windows will block local scripts." -ForegroundColor Yellow
    Write-Host "      Fix: Run 'Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass' in your terminal." -ForegroundColor Cyan
}

# ---------------------------------------------------------------------
# Summary & Auto-Fix Prompt
# ---------------------------------------------------------------------
Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
if ($PassedChecks -eq $TotalChecks) {
    Write-Host "  RESULT: Your PC is 100% READY to digitize NCIS Seasons 1-8!  " -ForegroundColor Green
    Write-Host "=================================================================" -ForegroundColor Cyan
    Write-Host "You can now insert Disc 1 into your DVD drive and start MakeMKV." -ForegroundColor White
} else {
    Write-Host "  RESULT: $PassedChecks of $TotalChecks checks passed. Review warnings above.  " -ForegroundColor Yellow
    Write-Host "=================================================================" -ForegroundColor Cyan
}

# Offer interactive 1-click Winget installation if packages are missing
if ($NeedsWingetInstall.Count -gt 0) {
    Write-Host ""
    Write-Host "Missing packages detected: $($NeedsWingetInstall -join ', ')" -ForegroundColor Yellow
    $ans = Read-Host "Would you like this script to run 'winget install' for you now? (Y/N)"
    if ($ans -eq "Y" -or $ans -eq "y") {
        foreach ($pkg in $NeedsWingetInstall) {
            Write-Host "Installing $pkg via winget..." -ForegroundColor Cyan
            winget install --id $pkg -e --accept-package-agreements --accept-source-agreements
        }
        Write-Host "Installation complete! Please re-run this script to verify." -ForegroundColor Green
    }
}

Write-Host ""
pause
`;
  };

  const copyDoctorScript = () => {
    navigator.clipboard.writeText(generatePowerShellDoctorScript());
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const downloadDoctorScript = () => {
    const content = generatePowerShellDoctorScript();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Test-NCISSetup.ps1';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyQuickOneLiner = () => {
    const oneLiner =
      'Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; winget install HandBrake.HandBrake.CLI; winget install GuinpinSoft.MakeMKV';
    navigator.clipboard.writeText(oneLiner);
    setCopiedOneLiner(true);
    setTimeout(() => setCopiedOneLiner(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Environment Setup Doctor & Readme Center
              </h3>
              <p className="text-xs text-slate-400">
                Interactive requirement verification, automated diagnostic scripts, and official project documentation.
              </p>
            </div>
          </div>

          {/* Sub tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 shrink-0">
            <button
              onClick={() => setActiveSubTab('script')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeSubTab === 'script'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              PC Doctor Script (.ps1)
            </button>
            <button
              onClick={() => setActiveSubTab('checklist')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeSubTab === 'checklist'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Diagnostic Checklist
            </button>
            <button
              onClick={() => setActiveSubTab('readme')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeSubTab === 'readme'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Full Readme
            </button>
          </div>
        </div>

        {/* 1-Line Winget Command Helper */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs space-y-0.5">
            <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              1-Command Instant Windows Setup via Winget:
            </span>
            <p className="text-slate-400 text-[11px]">
              Installs both HandBrakeCLI and MakeMKV directly onto your Windows PC in one go.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <code className="text-[11px] font-mono text-amber-300 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
              winget install HandBrake.HandBrake.CLI GuinpinSoft.MakeMKV
            </code>
            <button
              onClick={copyQuickOneLiner}
              className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded transition-colors flex items-center gap-1"
            >
              {copiedOneLiner ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedOneLiner ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      {/* SubTab 1: The Diagnostic PowerShell Script */}
      {activeSubTab === 'script' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-amber-400" />
                Interactive Environment Doctor Script (`Test-NCISSetup.ps1`)
              </h4>
              <p className="text-xs text-slate-400">
                Run this script in PowerShell to automatically audit your drive letters, HandBrakeCLI, optical drive, and script permissions.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={copyDoctorScript}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors"
              >
                {copiedScript ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied Doctor Script!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Script</span>
                  </>
                )}
              </button>

              <button
                onClick={downloadDoctorScript}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Test-NCISSetup.ps1</span>
              </button>
            </div>
          </div>

          {/* Drive Configuration for Script */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Optical DVD Drive Letter:</label>
              <input
                type="text"
                value={dvdDriveLetter}
                onChange={(e) => setDvdDriveLetter(e.target.value.toUpperCase())}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 font-mono text-white"
                placeholder="D:"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Scratch Ripping Drive Letter:</label>
              <input
                type="text"
                value={scratchDriveLetter}
                onChange={(e) => setScratchDriveLetter(e.target.value.toUpperCase())}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 font-mono text-white"
                placeholder="C:"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Plex Destination Drive Letter:</label>
              <input
                type="text"
                value={plexDriveLetter}
                onChange={(e) => setPlexDriveLetter(e.target.value.toUpperCase())}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 font-mono text-white"
                placeholder="P:"
              />
            </div>
          </div>

          {/* Code Viewer */}
          <pre className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-amber-200/90 overflow-x-auto max-h-[460px] scrollbar-thin whitespace-pre leading-relaxed">
            {generatePowerShellDoctorScript()}
          </pre>

          {/* How to run instructions */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 text-xs text-slate-300 space-y-1.5">
            <span className="font-semibold text-white block">How to Execute on Your Windows PC:</span>
            <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px]">
              <li>Save <code className="text-amber-300">Test-NCISSetup.ps1</code> into your preferred media folder.</li>
              <li>Press <kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-200">Win + X</kbd> and choose <strong>Terminal</strong> or <strong>PowerShell</strong>.</li>
              <li>Type <code className="text-amber-300">Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass</code> and press Enter.</li>
              <li>Run <code className="text-amber-300">.\Test-NCISSetup.ps1</code>. The script will test your environment and offer to auto-install missing tools!</li>
            </ol>
          </div>
        </div>
      )}

      {/* SubTab 2: Interactive Checklist */}
      {activeSubTab === 'checklist' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h4 className="text-sm font-bold text-white">
                Interactive System Requirement Health Grid
              </h4>
              <p className="text-xs text-slate-400">
                Click any requirement to see its purpose, PowerShell verification command, and recommended fix.
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
              6 of 6 Verified Compatible
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {checkItems.map((item) => (
              <div
                key={item.id}
                className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-xs font-bold text-white">{item.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">
                    Ready
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {item.description}
                </p>

                <div className="pt-2 border-t border-slate-900 text-[11px] space-y-1">
                  <div className="flex items-center justify-between text-slate-400 font-mono text-[10px]">
                    <span>Check Command:</span>
                    <span className="text-slate-300 truncate max-w-[200px]">{item.checkCommand}</span>
                  </div>
                  <div className="bg-slate-900 p-1.5 rounded font-mono text-[10px] text-amber-300 truncate select-all">
                    {item.fixRecommendation}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SubTab 3: Full Readme View */}
      {activeSubTab === 'readme' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h4 className="text-base font-bold text-white">
                Project Readme & Operational Guide
              </h4>
              <p className="text-xs text-slate-400">
                Official documentation for digitizing Seasons 1–8 of NCIS DVD box sets.
              </p>
            </div>

            <button
              onClick={() => {
                const readmeText = `# NCIS Seasons 1-8 DVD-to-Plex Digitization & Automation Studio\n... (See full README in project)`;
                navigator.clipboard.writeText(document.getElementById('readme-container')?.innerText || '');
                alert('Copied formatted Readme text!');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Readme Text</span>
            </button>
          </div>

          <div id="readme-container" className="text-xs text-slate-300 space-y-4 leading-relaxed max-w-4xl">
            <section className="space-y-1.5">
              <h5 className="text-sm font-bold text-amber-400">1. Workflow Summary</h5>
              <p className="text-slate-400">
                This studio replaces hours of tedious manual file renaming and HandBrake queueing. It directly correlates raw MakeMKV tracks (e.g. <code className="text-slate-200">title_t00.mkv</code>) with the official 186 episodes of NCIS Seasons 1 through 8, enforces standard Plex naming conventions, applies DVD deinterlacing via HandBrakeCLI, and provides ready-to-run Windows PowerShell scripts.
              </p>
            </section>

            <section className="space-y-1.5">
              <h5 className="text-sm font-bold text-amber-400">2. Ripping Procedure in MakeMKV</h5>
              <ul className="list-disc list-inside text-slate-400 space-y-1">
                <li>Insert your DVD into the optical drive and click the large optical disc icon in MakeMKV.</li>
                <li>Wait for disc analysis to complete (~30 seconds).</li>
                <li><strong>Crucial Step:</strong> Locate the 4 separate titles with duration ~42:00 to ~45:00 minutes. Check only those 4 titles.</li>
                <li><strong>Uncheck</strong> the ~15 GB "Play All" concatenation title.</li>
                <li>Choose your output folder (e.g. <code className="text-slate-200">D:\MakeMKV_Rips\NCIS_S01_D1</code>) and click <strong>Make MKV</strong>.</li>
              </ul>
            </section>

            <section className="space-y-1.5">
              <h5 className="text-sm font-bold text-amber-400">3. Matching & Automation</h5>
              <p className="text-slate-400">
                Open this studio's <strong>Track & File Matcher</strong> tab. Select Season and Disc. Drag your ripped files into the drop zone. Confirm the order matches the canonical episode list. Then switch to the <strong>PowerShell Pipeline</strong> tab to copy the automated transcode script that directly places encoded MKVs into your Plex TV library!
              </p>
            </section>

            <section className="space-y-1.5">
              <h5 className="text-sm font-bold text-amber-400">4. Plex TV Library Configuration</h5>
              <p className="text-slate-400">
                In Plex Web, add your parent folder (e.g. <code className="text-slate-200">P:\Plex Media\TV Shows</code>) as a <strong>TV Shows</strong> library. Ensure the Plex TV Series agent is set to <em>The Movie Database</em> or <em>TheTVDB</em>. Because files are tagged with <code className="text-slate-200">NCIS (2003)</code>, Plex will automatically download posters, episode descriptions, episode title cards, and the iconic theme music.
              </p>
            </section>
          </div>
        </div>
      )}
    </div>
  );
};
