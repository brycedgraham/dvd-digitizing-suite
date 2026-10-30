import React from 'react';
import {
  BookOpen,
  Disc,
  Sliders,
  Terminal,
  FolderTree,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Cpu,
} from 'lucide-react';

export const WorkflowGuide: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Intro Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-amber-400" />
          <h3 className="text-base font-bold text-white">
            NCIS DVD Box Set Automation & Best Practices Guide
          </h3>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Digitizing 8 seasons of NCIS (~48 discs, 186 episodes) is a massive project. Following this streamlined 3-step workflow will save you dozens of hours of manual clicking and naming while ensuring pristine DVD video quality without interlacing artifacts.
        </p>
      </div>

      {/* Step 1: MakeMKV */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
          <span className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center font-mono">
            1
          </span>
          <h4 className="text-sm font-bold text-white">
            MakeMKV Ripping Discipline: Avoid the "Play All" Trap
          </h4>
        </div>

        <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
          <p>
            When you insert an NCIS DVD into MakeMKV, you will typically see 5 to 7 titles. A common pitfall is ripping the <strong>"Play All" title</strong>:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="p-3 bg-rose-950/20 border border-rose-800/40 rounded-lg space-y-1">
              <span className="font-semibold text-rose-300 block text-xs">
                ❌ Don't Rip: The "Play All" Title (~15 GB)
              </span>
              <p className="text-[11px] text-slate-400">
                This title contains all 4 episodes joined together as one giant continuous movie. If ripped, you will have to manually split it later with MKVToolNix.
              </p>
            </div>

            <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-lg space-y-1">
              <span className="font-semibold text-emerald-300 block text-xs">
                ✅ Do Rip: Individual ~1.1 GB Titles (4 per disc)
              </span>
              <p className="text-[11px] text-slate-400">
                Select the 4 separate titles with runtimes between 42:00 and 45:00 minutes. Each represents one standalone episode.
              </p>
            </div>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
            <div className="font-semibold text-amber-300 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Audio & Subtitle Track Selection in MakeMKV:</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Expand each title in MakeMKV and make sure the <strong>Dolby Digital 3/2.1 (5.1 surround)</strong> audio track and English VOBSUB subtitles are checked. Uncheck foreign language dubs (unless desired) to save ripping time.
            </p>
          </div>
        </div>
      </div>

      {/* Step 2: HandBrake DVD Deinterlacing */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
          <span className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center font-mono">
            2
          </span>
          <h4 className="text-sm font-bold text-white">
            HandBrake Encoding: Solving the Interlaced 480i Problem
          </h4>
        </div>

        <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
          <p>
            DVD video in North America is <strong>NTSC 480i</strong> (480 lines interlaced at 29.97 fps or telecined 24p film). Playing raw DVD rips on modern progressive displays (OLED, 4K TVs, monitors) creates ugly horizontal comb lines during action scenes (chases, shootouts, rapid movement).
          </p>

          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-2">
            <span className="font-semibold text-white block">
              Optimal HandBrake DVD Filter Settings:
            </span>
            <ul className="space-y-1.5 text-[11px] text-slate-400 list-disc list-inside">
              <li>
                <strong className="text-slate-200">Decomb Filter:</strong> Enable <code className="text-amber-300">--comb-detect --decomb</code>. This dynamically scans every frame; if a frame is interlaced, it deinterlaces it, but if it is progressive, it touches nothing, preserving maximum image sharpness.
              </li>
              <li>
                <strong className="text-slate-200">Framerate:</strong> Set to <code className="text-amber-300">Peak Framerate (PFR)</code> or Same as Source. Do not force 60fps.
              </li>
              <li>
                <strong className="text-slate-200">Anamorphic:</strong> Set to <code className="text-amber-300">Strict or Auto Anamorphic</code>. DVDs store widescreen as 720x480 with non-square pixels. Strict anamorphic preserves the proper 16:9 widescreen ratio without stretching faces or squishing cars.
              </li>
              <li>
                <strong className="text-slate-200">Audio Passthrough:</strong> Use <code className="text-amber-300">-E copy:ac3</code> to pass through the DVD's original 5.1 surround sound without re-encoding loss.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Step 3: Setting Up HandBrakeCLI on Windows */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
          <span className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center font-mono">
            3
          </span>
          <h4 className="text-sm font-bold text-white">
            Installing HandBrakeCLI on Windows (1-Command Setup)
          </h4>
        </div>

        <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
          <p>
            To use the automated batch transcode scripts generated in the <strong>PowerShell Pipeline</strong> tab, you need <code className="text-amber-300">HandBrakeCLI.exe</code>. You can install it in seconds using Windows Package Manager:
          </p>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-amber-300 text-xs select-all">
            winget install HandBrake.HandBrake.CLI
          </div>

          <p className="text-[11px] text-slate-400">
            Or download the CLI ZIP directly from the official HandBrake site (<code className="text-slate-300">handbrake.fr/downloads2.php</code>) and extract <code className="text-slate-300">HandBrakeCLI.exe</code> to <code className="text-slate-300">C:\Program Files\HandBrake\</code>.
          </p>
        </div>
      </div>

      {/* Step 4: Official Plex TV Naming Rules */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
          <span className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center font-mono">
            4
          </span>
          <h4 className="text-sm font-bold text-white">
            Plex TV Show Library Naming Standard
          </h4>
        </div>

        <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
          <p>
            Plex relies on the directory and filename pattern to match with The Movie Database (TMDb) and TheTVDB. Our studio generates exact Plex-compliant paths:
          </p>

          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 space-y-1">
            <div className="text-amber-400 font-semibold">P:\Plex Media\TV Shows\</div>
            <div className="pl-4 text-slate-200">└── NCIS (2003)\</div>
            <div className="pl-8 text-slate-300">├── Season 01\</div>
            <div className="pl-12 text-emerald-400">├── NCIS (2003) - S01E01 - Yankee White.mkv</div>
            <div className="pl-12 text-emerald-400">├── NCIS (2003) - S01E02 - Hung Out to Dry.mkv</div>
            <div className="pl-12 text-emerald-400">└── NCIS (2003) - S01E03 - Seadog.mkv</div>
            <div className="pl-8 text-slate-300">└── Season 02\</div>
            <div className="pl-12 text-emerald-400">└── NCIS (2003) - S02E01 - See No Evil.mkv</div>
          </div>

          <p className="text-[11px] text-slate-400">
            Notice the <code className="text-slate-200">(2003)</code> release year in the show folder and file names. This prevents Plex from confusing the original series with spinoffs like <em>NCIS: Los Angeles</em>, <em>NCIS: New Orleans</em>, <em>NCIS: Hawai'i</em>, or <em>NCIS: Sydney</em>!
          </p>
        </div>
      </div>

      {/* Step 5: Advanced Unattended Options (ARM) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-amber-400" />
          <h4 className="text-sm font-bold text-white">
            Looking for 100% Zero-Touch Hardware Automation? (A.R.M.)
          </h4>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          If you plan to digitize hundreds more DVD and Blu-ray discs in the future and want an automated disc drive that rips on disc insertion and ejects when done, consider researching <strong>Automatic Ripping Machine (A.R.M.)</strong>. It runs on a dedicated Linux box or Docker container and pairs with HandBrake and MakeMKV to automatically transcode and tag discs the moment you close the tray.
        </p>
      </div>
    </div>
  );
};
