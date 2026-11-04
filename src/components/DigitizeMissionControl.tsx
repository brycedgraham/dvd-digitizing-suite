import React, { useState, useEffect, useRef } from 'react';
import { PipelineSettings, WorkerState, DiscProgress } from '../types';
import { getSeasonInfo, getEpisodesBySeasonAndDisc } from '../data/ncisCatalog';
import {
  Disc,
  Play,
  RotateCw,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  FolderCog,
  Terminal,
  Cpu,
  ArrowRight,
  ShieldAlert,
  Sliders,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface DigitizeMissionControlProps {
  selectedSeason: number;
  setSelectedSeason: (season: number) => void;
  selectedDisc: number;
  setSelectedDisc: (disc: number) => void;
  settings: PipelineSettings;
  setSettings: React.Dispatch<React.SetStateAction<PipelineSettings>>;
  onGoToMapping: () => void;
  onMarkDiscCompleted: () => void;
}

export const DigitizeMissionControl: React.FC<DigitizeMissionControlProps> = ({
  selectedSeason,
  setSelectedSeason,
  selectedDisc,
  setSelectedDisc,
  settings,
  setSettings,
  onGoToMapping,
  onMarkDiscCompleted,
}) => {
  const [dvdDrive, setDvdDrive] = useState('D:');
  const [isServerConnected, setIsServerConnected] = useState(false);
  const [isCheckingServer, setIsCheckingServer] = useState(false);
  const [serverState, setServerState] = useState<WorkerState>({
    status: 'idle',
    stage: 0,
    progress_percent: 0,
    logs: ['[System Ready] Awaiting user command.'],
    detected_tools: {
      handbrake: null,
      makemkv: null,
      dvd_drives: ['D:'],
    },
    ripped_tracks: [],
  });

  const [showLogs, setShowLogs] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  const episodes = getEpisodesBySeasonAndDisc(selectedSeason, selectedDisc);
  const seasonInfo = getSeasonInfo(selectedSeason);

  const isPollingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Poll Python local backend at http://127.0.0.1:5000/api/status
  const checkBackendStatus = async (isManual = false) => {
    if (isPollingRef.current && !isManual) return;
    if (isManual) {
      setIsCheckingServer(true);
    }
    isPollingRef.current = true;

    // Clean up any in-flight controller
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // 4000ms timeout allows Windows disk/optical drive I/O to respond without premature abort
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch('http://127.0.0.1:5000/api/status', {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data: WorkerState = await res.json();
        setServerState(data);
        setIsServerConnected(true);
        if (data.detected_tools?.dvd_drives && data.detected_tools.dvd_drives.length > 0) {
          setDvdDrive((prev) => (prev ? prev : data.detected_tools.dvd_drives[0]));
        }
      } else {
        setIsServerConnected(false);
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Expected on cancellation or unmount
        return;
      }
      setIsServerConnected(false);
    } finally {
      isPollingRef.current = false;
      if (isManual) {
        setIsCheckingServer(false);
      }
    }
  };

  useEffect(() => {
    checkBackendStatus(true);
    const interval = setInterval(() => checkBackendStatus(false), 3000);
    return () => {
      clearInterval(interval);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // 1-Click Digitize Disc Handler
  const handleDigitizeClick = async () => {
    if (isServerConnected) {
      try {
        await fetch('http://127.0.0.1:5000/api/rip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dvd_drive: dvdDrive,
            scratch_dir: settings.sourceDirectory,
            season: selectedSeason,
            disc: selectedDisc,
          }),
        });
        checkBackendStatus();
      } catch (err) {
        alert('Failed to contact local Python server: ' + err);
      }
    } else {
      // Run interactive browser-based simulation
      runSimulation();
    }
  };

  // Simulated run for preview or when Python server is not yet started
  const runSimulation = () => {
    setIsSimulating(true);
    setServerState((prev) => ({
      ...prev,
      status: 'ripping',
      stage: 2,
      progress_percent: 10,
      logs: [
        ...prev.logs,
        `[SIMULATION] Scanning optical drive ${dvdDrive} for Season ${selectedSeason} Disc ${selectedDisc}...`,
        `[SIMULATION] Filtered out ~15GB 'Play All' title track automatically.`,
        `[SIMULATION] Found 4 individual episode titles (~1.1 GB each).`,
      ],
    }));

    let progress = 10;
    const interval = setInterval(() => {
      progress += 20;
      if (progress >= 100) {
        clearInterval(interval);
        setIsSimulating(false);
        setServerState((prev) => ({
          ...prev,
          status: 'awaiting_mapping',
          stage: 3,
          progress_percent: 100,
          ripped_tracks: episodes.map((ep, idx) => ({
            sourceFile: `C:\\MakeMKV_Rips\\NCIS_S0${selectedSeason}_D${selectedDisc}\\title_t0${idx}.mkv`,
            filename: `title_t0${idx}.mkv`,
            durationEstimate: `${ep.runtimeMinutes}:15`,
            durationMinutes: ep.runtimeMinutes + 0.25,
            fileSizeMb: 1080 + idx * 30,
            trackIndex: idx,
          })),
          logs: [
            ...prev.logs,
            `[SIMULATION] MakeMKV rip completed! 4 titles ready for episode title verification.`,
          ],
        }));
      } else {
        setServerState((prev) => ({
          ...prev,
          progress_percent: progress,
          logs: [...prev.logs, `[SIMULATION] Ripping disc data: ${progress}% completed`],
        }));
      }
    }, 600);
  };

  const handleReset = async () => {
    if (isServerConnected) {
      await fetch('http://127.0.0.1:5000/api/reset', { method: 'POST' });
      checkBackendStatus();
    } else {
      setServerState((prev) => ({
        ...prev,
        status: 'idle',
        stage: 0,
        progress_percent: 0,
        ripped_tracks: [],
      }));
    }
  };

  const isBusy = serverState.status === 'ripping' || serverState.status === 'transcoding' || isSimulating;

  return (
    <div className="space-y-6">
      {/* Top Banner: Status & Server Bridge */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Disc className="w-5 h-5 animate-spin-slow" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  1-Click Disc Digitization Mission Control
                </h3>
                <p className="text-xs text-slate-400">
                  Automate optical drive reading, MakeMKV lossless ripping, and HandBrake DVD deinterlacing.
                </p>
              </div>
            </div>
          </div>

          {/* Connection Pill */}
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
                isServerConnected
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  isServerConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                }`}
              />
              <span>
                {isServerConnected
                  ? 'Python Worker Online (:5000)'
                  : 'Simulation / Offline Mode'}
              </span>
            </div>

            <button
              onClick={() => checkBackendStatus(true)}
              disabled={isCheckingServer}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Refresh connection status"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isCheckingServer ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 5-Stage Visual Stepper */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          {[
            { step: 1, label: '1. DVD Inserted', active: true, done: true },
            {
              step: 2,
              label: '2. Lossless Rip',
              active: serverState.stage >= 2,
              done: serverState.stage > 2,
            },
            {
              step: 3,
              label: '3. Map & Verify',
              active: serverState.stage >= 3,
              done: serverState.stage > 3,
            },
            {
              step: 4,
              label: '4. Decomb Transcode',
              active: serverState.stage >= 4,
              done: serverState.stage > 4,
            },
            {
              step: 5,
              label: '5. In Plex Library',
              active: serverState.stage >= 5,
              done: serverState.stage === 5,
            },
          ].map((s) => (
            <div
              key={s.step}
              className={`p-2.5 rounded-lg border flex items-center gap-2 transition-all ${
                s.done
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                  : s.active
                  ? 'bg-amber-500/10 border-amber-500 text-amber-300 font-semibold shadow-sm ring-1 ring-amber-500/20'
                  : 'bg-slate-950/60 border-slate-800/80 text-slate-500'
              }`}
            >
              {s.done ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <span className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center text-[9px] shrink-0">
                  {s.step}
                </span>
              )}
              <span className="truncate">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Target Disc & Hardware Configuration Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <FolderCog className="w-4 h-4 text-amber-400" />
            Hardware & Target Selection
          </span>
          <span className="text-xs font-mono text-slate-400">
            Season {selectedSeason} · Disc {selectedDisc} ({episodes.length} episodes on disc)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          {/* DVD Drive Input */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Optical DVD Drive
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={dvdDrive}
                  onChange={(e) => setDvdDrive(e.target.value.toUpperCase())}
                  disabled={isBusy}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 font-mono text-white focus:ring-1 focus:ring-amber-500"
                  placeholder="D:"
                />
              </div>
              <span className="text-slate-400 font-mono text-[11px] shrink-0">
                (Tray Ready)
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Drive letter where NCIS DVD is inserted
            </p>
          </div>

          {/* Scratch Temp Folder */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              MakeMKV Scratch Folder
            </label>
            <input
              type="text"
              value={settings.sourceDirectory}
              onChange={(e) => setSettings({ ...settings, sourceDirectory: e.target.value })}
              disabled={isBusy}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 font-mono text-white focus:ring-1 focus:ring-amber-500"
              placeholder="C:\MakeMKV_Rips"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Fast SSD/HDD with at least 10 GB free
            </p>
          </div>

          {/* Plex Destination */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Plex TV Library Destination
            </label>
            <input
              type="text"
              value={settings.plexLibraryDirectory}
              onChange={(e) =>
                setSettings({ ...settings, plexLibraryDirectory: e.target.value })
              }
              disabled={isBusy}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 font-mono text-white focus:ring-1 focus:ring-amber-500"
              placeholder="P:\Plex Media\TV Shows"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Appends \NCIS (2003)\Season {String(selectedSeason).padStart(2, '0')}
            </p>
          </div>
        </div>
      </div>

      {/* Main Action Hub: Big Digitize Button or Mapping Alert */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center space-y-4">
        {serverState.status === 'awaiting_mapping' ? (
          /* When ripping is done, invite user to the Episode Mapping Page with Video Player */
          <div className="max-w-xl mx-auto space-y-3 py-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-white">
              Disc Ripped Successfully! Ready to Verify Titles
            </h4>
            <p className="text-xs text-slate-300">
              {serverState.ripped_tracks.length} title tracks extracted from Disc {selectedDisc}. Use the
              interactive Video Player to verify episode title cards in the first ~15 minutes before encoding.
            </p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={onGoToMapping}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-2 shadow-lg transition-transform active:scale-95"
              >
                <span>Open Episode Mapping & Video Player</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={handleReset}
                className="px-3 py-2 text-xs text-slate-400 hover:text-white"
              >
                Reset
              </button>
            </div>
          </div>
        ) : (
          /* Normal State: Big Digitize Button */
          <div className="max-w-xl mx-auto space-y-3 py-2">
            <button
              onClick={handleDigitizeClick}
              disabled={isBusy}
              className={`w-full max-w-md mx-auto py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl transition-all ${
                isBusy
                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 hover:shadow-amber-500/20 active:scale-95'
              }`}
            >
              {isBusy ? (
                <>
                  <RotateCw className="w-5 h-5 animate-spin" />
                  <span>
                    {serverState.status === 'ripping' ? 'Ripping DVD Tracks...' : 'Transcoding...'} ({serverState.progress_percent}%)
                  </span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  <span>Digitize Disc {selectedDisc} (Season {selectedSeason})</span>
                </>
              )}
            </button>

            <p className="text-xs text-slate-400">
              Extracts clean episode tracks from DVD drive <strong>{dvdDrive}</strong>, ignores the ~15GB Play All track,
              and prepares files for title card verification.
            </p>
          </div>
        )}

        {/* Real-time Progress Bar */}
        {(isBusy || serverState.progress_percent > 0) && (
          <div className="max-w-xl mx-auto space-y-1.5 pt-2">
            <div className="flex justify-between text-xs font-mono text-slate-400">
              <span>{serverState.current_episode || 'Processing Disc...'}</span>
              <span className="text-amber-400 font-bold">{serverState.progress_percent}%</span>
            </div>
            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-amber-500 transition-all duration-300"
                style={{ width: `${serverState.progress_percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Live Terminal Log Drawer */}
        <div className="max-w-2xl mx-auto pt-2">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="text-[11px] font-mono text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1.5 mx-auto"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>{showLogs ? 'Hide Live Terminal Output' : 'Show Live Terminal Output'}</span>
          </button>

          {showLogs && (
            <pre className="mt-2 p-3 bg-slate-950 rounded-lg border border-slate-800 text-left font-mono text-[11px] text-amber-200/90 max-h-48 overflow-y-auto scrollbar-thin">
              {serverState.logs.join('\n')}
            </pre>
          )}
        </div>
      </div>

      {/* Python Server Helper Notice */}
      {!isServerConnected && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-amber-400" />
              Run the Python Automation Engine on your Windows PC:
            </span>
            <p className="text-slate-400 text-[11px]">
              Open PowerShell in the app folder and run <code className="text-amber-300">python backend/server.py</code> to connect directly to your optical drive!
            </p>
          </div>

          <div className="bg-slate-950 px-3 py-1.5 rounded font-mono text-[11px] text-amber-300 border border-slate-800 shrink-0 select-all">
            python backend/server.py
          </div>
        </div>
      )}
    </div>
  );
};
