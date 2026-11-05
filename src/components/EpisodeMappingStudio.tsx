import React, { useState, useRef, useEffect } from 'react';
import { NcisEpisode, DiscTrackMapping, PipelineSettings } from '../types';
import { getEpisodesBySeasonAndDisc, formatPlexName, formatPlexPath } from '../data/ncisCatalog';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Film,
  Sparkles,
  ArrowRight,
  Clock,
  Check,
  ChevronRight,
  Upload,
  Layers,
  HelpCircle,
  FileVideo,
} from 'lucide-react';

interface EpisodeMappingStudioProps {
  selectedSeason: number;
  selectedDisc: number;
  settings: PipelineSettings;
  onStartTranscode: (mappings: DiscTrackMapping[], overwrite?: boolean) => void;
}

export const EpisodeMappingStudio: React.FC<EpisodeMappingStudioProps> = ({
  selectedSeason,
  selectedDisc,
  settings,
  onStartTranscode,
}) => {
  const episodes = getEpisodesBySeasonAndDisc(selectedSeason, selectedDisc);
  const [activeTrackIndex, setActiveTrackIndex] = useState<number>(0);
  const [verifiedTracks, setVerifiedTracks] = useState<Record<number, boolean>>({});
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(135); // Start at ~2:15 title mark
  const [duration, setDuration] = useState<number>(2620); // ~43:40
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [customFileUrl, setCustomFileUrl] = useState<string | null>(null);
  const [existingPlexFiles, setExistingPlexFiles] = useState<string[]>([]);
  const [overwritePlex, setOverwritePlex] = useState<boolean>(false);

  // Initialize track mappings
  const [inspection, setInspection] = useState<any>(null);
  const [detectedHb, setDetectedHb] = useState<{ handbrake: string | null; handbrake_gui_only?: boolean }>({
    handbrake: null,
  });

  // Helper to build initial mappings with real or fallback filenames and full targetPlexName
  const buildInitialMappings = (scratchTracks?: any[]): DiscTrackMapping[] => {
    return episodes.map((ep, idx) => {
      const scratch = scratchTracks && scratchTracks[idx];
      return {
        trackId: `track-${idx}`,
        sourceFile: scratch ? scratch.sourceFile : `title_t0${idx}.mkv`,
        filename: scratch ? scratch.filename : `title_t0${idx}.mkv`,
        targetPlexName: formatPlexName(ep),
        fileSizeMb: scratch ? scratch.fileSizeMb : (1080 + idx * 35),
        durationEstimate: `${ep.runtimeMinutes}:20`,
        matchedEpisode: ep,
        isExcluded: false,
        isSpecialExtra: false,
      };
    });
  };

  // Initialize track mappings
  const [mappings, setMappings] = useState<DiscTrackMapping[]>(() => buildInitialMappings());

  // Check which episodes are already encoded in Plex destination and check scratch folder
  useEffect(() => {
    const fetchInspection = async () => {
      try {
        const [inspectRes, statusRes] = await Promise.allSettled([
          fetch('http://127.0.0.1:5000/api/inspect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              scratch_dir: settings.sourceDirectory,
              plex_dir: settings.plexLibraryDirectory,
              season: selectedSeason,
              disc: selectedDisc,
            }),
          }),
          fetch('http://127.0.0.1:5000/api/status'),
        ]);

        if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
          const st = await statusRes.value.json();
          if (st.detected_tools) {
            setDetectedHb({
              handbrake: st.detected_tools.handbrake,
              handbrake_gui_only: st.detected_tools.handbrake_gui_only,
            });
          }
        }

        if (inspectRes.status === 'fulfilled' && inspectRes.value.ok) {
          const data = await inspectRes.value.json();
          setInspection(data);
          const filenames = (data.plex_episodes || []).map((e: { filename: string }) => e.filename.toLowerCase());
          setExistingPlexFiles(filenames);

          // If real ripped scratch tracks are available, bind their exact paths
          if (data.scratch_tracks && data.scratch_tracks.length > 0) {
            setMappings((prev) => {
              return prev.map((m, idx) => {
                const s = data.scratch_tracks[idx];
                if (s) {
                  return {
                    ...m,
                    sourceFile: s.sourceFile,
                    filename: s.filename,
                    fileSizeMb: s.fileSizeMb,
                    targetPlexName: m.matchedEpisode ? formatPlexName(m.matchedEpisode) : m.customPlexName,
                  };
                }
                return m;
              });
            });
          }
        }
      } catch {
        // Ignored if offline
      }
    };
    fetchInspection();
  }, [selectedSeason, selectedDisc, settings.plexLibraryDirectory, settings.sourceDirectory]);

  // Re-sync when season/disc changes
  useEffect(() => {
    setMappings(buildInitialMappings(inspection?.scratch_tracks));
    setActiveTrackIndex(0);
    setVerifiedTracks({});
    setCurrentTime(135);
  }, [selectedSeason, selectedDisc]);

  const activeMapping = mappings[activeTrackIndex] || mappings[0];
  const activeEpisode = activeMapping?.matchedEpisode;

  // Canvas-based simulated video title card renderer for smooth in-browser demonstration
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const renderFrame = () => {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Gradient background
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(1, '#020617');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Crosshairs & Grid Lines (NCIS tech visual motif)
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, 0);
      ctx.lineTo(canvas.width / 2, canvas.height);
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      // Film timecode overlay
      ctx.font = '12px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
      const mins = Math.floor(currentTime / 60);
      const secs = Math.floor(currentTime % 60);
      const timeStr = `TC: 01:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:12  [480i NTSC 29.97fps]`;
      ctx.fillText(timeStr, 20, 30);

      // Scene simulation based on playback time
      if (currentTime < 90) {
        // Cold Open
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('COLD OPENING / CRIME SCENE', canvas.width / 2 - 140, canvas.height / 2 - 20);
        ctx.font = '13px "Public Sans", sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText(`Raw Track: ${activeMapping.sourceFile}`, canvas.width / 2 - 80, canvas.height / 2 + 10);
      } else if (currentTime >= 90 && currentTime <= 240) {
        // Iconic Freeze Frame & Title Card
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(canvas.width / 2 - 280, canvas.height / 2 - 60, 560, 120);

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.strokeRect(canvas.width / 2 - 280, canvas.height / 2 - 60, 560, 120);

        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        ctx.fillText('NCIS TITLE SEQUENCE CARD', canvas.width / 2 - 260, canvas.height / 2 - 35);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(`"${activeEpisode?.title || 'Unknown Episode'}"`, canvas.width / 2 - 260, canvas.height / 2);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '13px "Public Sans", sans-serif';
        ctx.fillText(
          `Season ${selectedSeason}, Episode ${activeEpisode?.episode || '?'} · Air Date: ${activeEpisode?.airDate || '2003'}`,
          canvas.width / 2 - 260,
          canvas.height / 2 + 30
        );
      } else {
        // Bullpen / Investigation Scene
        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('NCIS SQUAD ROOM / ACT I', canvas.width / 2 - 120, canvas.height / 2 - 20);
        ctx.font = '13px "Public Sans", sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText(activeEpisode?.synopsis || '', canvas.width / 2 - 220, canvas.height / 2 + 15);
      }

      if (isPlaying) {
        setCurrentTime((t) => {
          if (t >= duration) {
            setIsPlaying(false);
            return 0;
          }
          return t + 0.15;
        });
      }

      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animId);
  }, [currentTime, isPlaying, activeEpisode, activeMapping]);

  // Jump to specific title sequence marks
  const jumpToTime = (seconds: number) => {
    setCurrentTime(seconds);
  };

  // Toggle verification for current track
  const confirmCurrentTrackTitle = () => {
    setVerifiedTracks((prev) => ({
      ...prev,
      [activeTrackIndex]: true,
    }));

    // Auto-advance to next unverified track
    if (activeTrackIndex < mappings.length - 1) {
      setActiveTrackIndex(activeTrackIndex + 1);
      setCurrentTime(135); // Reset to ~2:15 title card mark
    }
  };

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Handle local video file drop or selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomFileUrl(url);
    }
  };

  // Swap / re-assign episode
  const handleEpisodeChange = (trackIdx: number, episodeId: string) => {
    const selectedEp = episodes.find((e) => e.id === episodeId) || null;
    setMappings((prev) => {
      const updated = [...prev];
      updated[trackIdx] = {
        ...updated[trackIdx],
        matchedEpisode: selectedEp,
        targetPlexName: selectedEp ? formatPlexName(selectedEp) : undefined,
      };
      return updated;
    });
  };

  const allVerified = mappings.every((_, idx) => verifiedTracks[idx]);

  return (
    <div className="space-y-6">
      {/* Page Title & Instructions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Film className="w-5 h-5 text-amber-400" />
              Episode Mapping & Video Title Verifier
            </h3>
            <p className="text-xs text-slate-400">
              Season {selectedSeason}, Disc {selectedDisc} · Verify the episode title card in the first ~15 minutes before encoding.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                allVerified
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}
            >
              {Object.keys(verifiedTracks).length} of {mappings.length} Tracks Title-Verified
            </span>
          </div>
        </div>

        {/* HandBrakeCLI / Tool Detection Warning Banner */}
        {detectedHb.handbrake_gui_only && (
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="space-y-0.5">
              <span className="font-bold text-amber-300 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                HandBrake Desktop GUI detected, but HandBrakeCLI is missing!
              </span>
              <p className="text-slate-300 text-[11px]">
                The HandBrake desktop application does not include the CLI needed for automated transcoding. Run the command on the right in PowerShell to install it.
              </p>
            </div>
            <code className="bg-slate-950 px-2.5 py-1 rounded text-amber-300 font-mono text-[11px] border border-amber-500/30 select-all shrink-0">
              winget install HandBrake.HandBrake.CLI
            </code>
          </div>
        )}

        {/* Scratch Source Info */}
        {inspection && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-slate-300 font-semibold">Scratch Source:</span>
              <span className="text-amber-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                {inspection.scratch_dir} ({inspection.scratch_valid_count} MKV tracks found)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-300 font-semibold">Plex Destination:</span>
              <span className="text-blue-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                {inspection.plex_dir}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Dual-Panel Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): In-App Video Player & Quick-Jump Bar */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            {/* Player Viewport */}
            <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
              {customFileUrl ? (
                <video
                  src={customFileUrl}
                  controls
                  className="w-full h-full object-contain"
                />
              ) : (
                <canvas
                  ref={canvasRef}
                  width={640}
                  height={360}
                  className="w-full h-full object-contain cursor-pointer"
                  onClick={() => setIsPlaying(!isPlaying)}
                />
              )}

              {/* Watermark / Track Overlay */}
              <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur px-2.5 py-1 rounded border border-slate-800 text-[11px] font-mono text-slate-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>
                  {activeMapping.sourceFile} · Track #{activeTrackIndex + 1}
                </span>
              </div>
            </div>

            {/* Quick-Jump Title Verification Shortcuts */}
            <div className="p-4 bg-slate-950/80 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-400" />
                  Jump to Title Card / Key Moments:
                </span>
                <span className="font-mono text-amber-400 font-bold">
                  {formatTime(currentTime)} / ~43:40
                </span>
              </div>

              {/* Quick Jump Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <button
                  onClick={() => jumpToTime(45)}
                  className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded border border-slate-800 text-center transition-colors"
                >
                  <div className="font-mono font-bold text-amber-300">0:45</div>
                  <div className="text-[10px] text-slate-400">Cold Open</div>
                </button>

                <button
                  onClick={() => jumpToTime(135)}
                  className="py-1.5 px-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded border border-amber-500/40 text-center transition-colors ring-1 ring-amber-500/30"
                >
                  <div className="font-mono font-bold text-amber-400">2:15 ★</div>
                  <div className="text-[10px] text-amber-200/90">Title Card Freeze</div>
                </button>

                <button
                  onClick={() => jumpToTime(300)}
                  className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded border border-slate-800 text-center transition-colors"
                >
                  <div className="font-mono font-bold text-slate-300">5:00</div>
                  <div className="text-[10px] text-slate-400">Act 1 Start</div>
                </button>

                <button
                  onClick={() => jumpToTime(600)}
                  className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded border border-slate-800 text-center transition-colors"
                >
                  <div className="font-mono font-bold text-slate-300">10:00</div>
                  <div className="text-[10px] text-slate-400">Squad Room</div>
                </button>
              </div>

              {/* Playback Controls Bar */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                  </button>
                  <button
                    onClick={() => jumpToTime(0)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    title="Rewind to start"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-slate-400 font-mono pl-1">
                    Playing simulated title feed (or drop local file below)
                  </span>
                </div>

                <label className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Load Local Video File</span>
                  <input type="file" accept="video/*" onChange={handleFileSelect} className="hidden" />
                </label>
              </div>
            </div>

            {/* Candidate Episode Information & Title Confirmation Box */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
                    Assigned Episode Candidate
                  </span>
                  <h4 className="text-base font-bold text-white">
                    S{String(selectedSeason).padStart(2, '0')}E{String(activeEpisode?.episode || 1).padStart(2, '0')}: {activeEpisode?.title}
                  </h4>
                </div>

                {/* Confirm Title Matches Button */}
                <button
                  onClick={confirmCurrentTrackTitle}
                  className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
                    verifiedTracks[activeTrackIndex]
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 active:scale-95'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {verifiedTracks[activeTrackIndex] ? 'Title Confirmed ✓' : 'Confirm Title Matches'}
                  </span>
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {activeEpisode?.synopsis}
              </p>

              {activeEpisode?.notableFeature && (
                <div className="text-[11px] text-amber-300/90 bg-amber-500/10 px-2.5 py-1.5 rounded border border-amber-500/20">
                  ★ {activeEpisode.notableFeature}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Disc Tracks Table & Transcode Action */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-400" />
                Disc {selectedDisc} Track List
              </h4>
              <span className="text-xs text-slate-400 font-mono">
                {mappings.length} Titles
              </span>
            </div>

            <div className="space-y-2.5">
              {mappings.map((m, idx) => {
                const ep = m.matchedEpisode;
                const isSelected = idx === activeTrackIndex;
                const isVerified = verifiedTracks[idx];

                return (
                  <div
                    key={m.trackId}
                    className={`p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-slate-950 border-amber-500 ring-1 ring-amber-500/30'
                        : isVerified
                        ? 'bg-slate-950/70 border-emerald-500/30'
                        : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setActiveTrackIndex(idx);
                            setCurrentTime(135);
                          }}
                          className={`font-mono text-xs font-semibold px-2 py-0.5 rounded border transition-colors ${
                            isSelected
                              ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                              : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                          }`}
                        >
                          {m.sourceFile}
                        </button>
                        <span className="text-[11px] font-mono text-slate-400">
                          ~{m.durationEstimate}
                        </span>
                      </div>

                      {isVerified ? (
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Title Verified
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setActiveTrackIndex(idx);
                            setCurrentTime(135);
                          }}
                          className="text-[11px] text-amber-400 hover:text-amber-300 font-medium"
                        >
                          Verify in Player →
                        </button>
                      )}
                    </div>

                    {/* Assigned Episode Dropdown & In-Plex status */}
                    <div className="space-y-1">
                      <select
                        value={ep?.id || ''}
                        onChange={(e) => handleEpisodeChange(idx, e.target.value)}
                        className="w-full text-xs bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:ring-1 focus:ring-amber-500 font-medium"
                      >
                        {episodes.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            S{String(candidate.season).padStart(2, '0')}E
                            {String(candidate.episode).padStart(2, '0')}: {candidate.title}
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                        <span className="truncate">
                          Plex: {ep ? formatPlexName(ep) : 'Unassigned'}
                        </span>
                        {ep && existingPlexFiles.includes(formatPlexName(ep).toLowerCase()) && (
                          <span className="text-emerald-400 font-semibold shrink-0 ml-2 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            Already in Plex (Will skip)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Idempotent Plex Status & Primary Action Button */}
            <div className="pt-3 border-t border-slate-800 space-y-2.5">
              {mappings.some((m) => m.matchedEpisode && existingPlexFiles.includes(formatPlexName(m.matchedEpisode).toLowerCase())) && (
                <div className="bg-slate-950 p-2.5 rounded-lg border border-emerald-500/30 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>
                      {mappings.filter((m) => m.matchedEpisode && existingPlexFiles.includes(formatPlexName(m.matchedEpisode).toLowerCase())).length} of {mappings.length} episodes already in Plex
                    </span>
                  </span>
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer hover:text-slate-200">
                    <input
                      type="checkbox"
                      checked={overwritePlex}
                      onChange={(e) => setOverwritePlex(e.target.checked)}
                      className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-900"
                    />
                    <span>Force re-encode all</span>
                  </label>
                </div>
              )}

              <button
                onClick={() => onStartTranscode(mappings, overwritePlex)}
                className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
              >
                <span>
                  {mappings.some((m) => m.matchedEpisode && existingPlexFiles.includes(formatPlexName(m.matchedEpisode).toLowerCase())) && !overwritePlex
                    ? `Confirm & Transcode Missing (${mappings.length - mappings.filter((m) => m.matchedEpisode && existingPlexFiles.includes(formatPlexName(m.matchedEpisode).toLowerCase())).length} remaining)`
                    : 'Confirm All & Start HandBrake Transcoding'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-[11px] text-slate-400 text-center">
                Decomb will deinterlace 480i DVD frames and write directly into your Plex TV shows library.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
