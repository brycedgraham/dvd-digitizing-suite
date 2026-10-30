import React, { useState, useEffect } from 'react';
import { NcisEpisode, DiscTrackMapping } from '../types';
import { getEpisodesBySeasonAndDisc, formatPlexName, formatPlexPath } from '../data/ncisCatalog';
import {
  FileVideo,
  ArrowUpDown,
  Check,
  Copy,
  FolderInput,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Eye,
  Trash2,
  HelpCircle,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

interface TrackMatcherProps {
  selectedSeason: number;
  selectedDisc: number;
  plexLibraryPath: string;
  onSendToPipeline?: (tracks: DiscTrackMapping[]) => void;
  onMarkDiscCompleted?: () => void;
}

export const TrackMatcher: React.FC<TrackMatcherProps> = ({
  selectedSeason,
  selectedDisc,
  plexLibraryPath,
  onMarkDiscCompleted,
}) => {
  const episodes = getEpisodesBySeasonAndDisc(selectedSeason, selectedDisc);
  const [tracks, setTracks] = useState<DiscTrackMapping[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedBatchScript, setCopiedBatchScript] = useState(false);
  const [inputPasteMode, setInputPasteMode] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [minEpisodeRuntimeMinutes, setMinEpisodeRuntimeMinutes] = useState(20);

  // Initialize or re-match when season or disc changes
  useEffect(() => {
    // Generate default tracks mapped 1:1 with disc episodes
    const initialTracks: DiscTrackMapping[] = episodes.map((ep, idx) => ({
      trackId: `track-${idx}`,
      sourceFile: `title_t0${idx}.mkv`,
      fileSizeMb: 1100 + Math.floor(Math.random() * 80),
      durationEstimate: `${ep.runtimeMinutes}:12`,
      matchedEpisode: ep,
      isExcluded: false,
      isSpecialExtra: false,
    }));

    // If the disc contains documented bonus features, append a bonus track
    const bonusFeatures = episodes.find((e) => e.bonusFeaturesOnDisc)?.bonusFeaturesOnDisc;
    if (bonusFeatures && bonusFeatures.length > 0) {
      initialTracks.push({
        trackId: `track-${initialTracks.length}`,
        sourceFile: `title_t0${initialTracks.length}.mkv`,
        fileSizeMb: 320,
        durationEstimate: '11:45',
        matchedEpisode: null,
        isExcluded: false,
        isSpecialExtra: true,
        extraTitle: bonusFeatures[0],
      });
    }

    setTracks(initialTracks);
  }, [selectedSeason, selectedDisc]);

  // Handle Drag & Drop of real files
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fileList = Array.from(e.dataTransfer.files);
      processNewFileList(fileList.map((f) => ({ name: f.name, size: f.size })));
    }
  };

  const processNewFileList = (fileItems: { name: string; size?: number }[]) => {
    // Sort naturally: title_t00.mkv, title_t01.mkv...
    const sorted = [...fileItems].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );

    const newMappings: DiscTrackMapping[] = sorted.map((file, idx) => {
      const sizeMb = file.size ? Math.round(file.size / (1024 * 1024)) : 1050;
      // If smaller than 500MB on DVD, likely a bonus featurette (<20 mins)
      const isSuspectedBonus = sizeMb < 500;
      const matchedEp = idx < episodes.length && !isSuspectedBonus ? episodes[idx] : null;

      return {
        trackId: `custom-track-${idx}-${Date.now()}`,
        sourceFile: file.name,
        fileSizeMb: sizeMb,
        durationEstimate: isSuspectedBonus ? '08:30' : '43:40',
        matchedEpisode: matchedEp,
        isExcluded: false,
        isSpecialExtra: isSuspectedBonus,
        extraTitle: isSuspectedBonus ? 'Behind the Scenes Featurette' : undefined,
      };
    });

    setTracks(newMappings);
  };

  // Parse pasted raw text (from command line dir /b or list of files)
  const handleApplyPasted = () => {
    if (!pastedText.trim()) return;
    const lines = pastedText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const fileItems = lines.map((line) => {
      // Clean up Windows quotes or full paths if user pasted full path
      const cleaned = line.replace(/^.*[\\/]/, '').replace(/"/g, '');
      return { name: cleaned };
    });

    processNewFileList(fileItems);
    setInputPasteMode(false);
    setPastedText('');
  };

  // Move track up
  const moveTrack = (index: number, direction: 'up' | 'down') => {
    const newTracks = [...tracks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newTracks.length) return;

    const temp = newTracks[index];
    newTracks[index] = newTracks[targetIndex];
    newTracks[targetIndex] = temp;

    // Re-assign standard episodes in order for non-bonus items
    let epIndex = 0;
    const reassigned = newTracks.map((t) => {
      if (t.isExcluded) {
        return { ...t, matchedEpisode: null };
      }
      if (t.isSpecialExtra) {
        return t;
      }
      const ep = epIndex < episodes.length ? episodes[epIndex] : null;
      epIndex++;
      return { ...t, matchedEpisode: ep };
    });

    setTracks(reassigned);
  };

  // Toggle excluded track
  const toggleExclude = (index: number) => {
    const updated = [...tracks];
    updated[index].isExcluded = !updated[index].isExcluded;

    // Recalculate episode assignments
    let epIndex = 0;
    const reassigned = updated.map((t) => {
      if (t.isExcluded) {
        return { ...t, matchedEpisode: null };
      }
      if (t.isSpecialExtra) {
        return t;
      }
      const ep = epIndex < episodes.length ? episodes[epIndex] : null;
      epIndex++;
      return { ...t, matchedEpisode: ep };
    });

    setTracks(reassigned);
  };

  // Toggle special extra status
  const toggleExtra = (index: number) => {
    const updated = [...tracks];
    const current = updated[index];
    updated[index] = {
      ...current,
      isSpecialExtra: !current.isSpecialExtra,
      matchedEpisode: !current.isSpecialExtra ? null : episodes[0],
      extraTitle: !current.isSpecialExtra ? 'Bonus Featurette' : undefined,
    };
    setTracks(updated);
  };

  // Copy target filename
  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Generate a quick PowerShell one-liner to rename these files in-place
  const generateInlinePowerShellRename = () => {
    const commands = tracks
      .filter((t) => !t.isExcluded)
      .map((t) => {
        let destName = '';
        if (t.matchedEpisode) {
          destName = formatPlexName(t.matchedEpisode);
        } else if (t.isSpecialExtra) {
          const sStr = String(selectedSeason).padStart(2, '0');
          const cleanTitle = (t.extraTitle || 'Featurette').replace(/[\\/:*?"<>|]/g, '-');
          destName = `NCIS (2003) - S${sStr}E00 - ${cleanTitle}.mkv`;
        }
        if (!destName) return '';
        return `Rename-Item -Path "${t.sourceFile}" -NewName "${destName}"`;
      })
      .filter(Boolean);

    return commands.join('\n');
  };

  const copyBatchScript = () => {
    const script = generateInlinePowerShellRename();
    navigator.clipboard.writeText(script);
    setCopiedBatchScript(true);
    setTimeout(() => setCopiedBatchScript(false), 2500);
  };

  // Validation metrics
  const activeMatchedCount = tracks.filter((t) => t.matchedEpisode && !t.isExcluded).length;
  const isDiscFullyMatched = activeMatchedCount === episodes.length;

  return (
    <div className="space-y-6">
      {/* Instructions & Drop Banner */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="border-2 border-dashed border-slate-700 hover:border-amber-500/60 bg-slate-900/40 rounded-xl p-5 text-center transition-colors relative"
      >
        <div className="flex flex-col items-center justify-center max-w-xl mx-auto space-y-2">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-amber-400">
            <FolderInput className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">
            MakeMKV Ripped Tracks for Season {selectedSeason}, Disc {selectedDisc}
          </h3>
          <p className="text-xs text-slate-400">
            Drag and drop your raw MKV files from MakeMKV here, or paste your file list. The studio
            will automatically correlate them with official TVDB/Plex episode titles.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              onClick={() => setInputPasteMode(!inputPasteMode)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              {inputPasteMode ? 'Close Paste Input' : 'Paste File Names (dir /b)'}
            </button>

            <button
              onClick={() => {
                // Quick reset / simulation
                const simulated = episodes.map((ep, idx) => ({
                  trackId: `sim-${idx}`,
                  sourceFile: `title_t0${idx}.mkv`,
                  fileSizeMb: 1040 + Math.floor(Math.random() * 60),
                  durationEstimate: `${ep.runtimeMinutes}:20`,
                  matchedEpisode: ep,
                  isExcluded: false,
                  isSpecialExtra: false,
                }));
                setTracks(simulated);
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Simulate MakeMKV Disc 1 Rips
            </button>
          </div>
        </div>

        {/* Expandable Paste Area */}
        {inputPasteMode && (
          <div className="mt-4 pt-4 border-t border-slate-800 text-left max-w-2xl mx-auto space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              Paste Raw Filenames (one per line, e.g. from Windows Command Prompt `dir /b *.mkv`):
            </label>
            <textarea
              rows={4}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="title_t00.mkv&#10;title_t01.mkv&#10;title_t02.mkv&#10;title_t03.mkv&#10;title_t04.mkv"
              className="w-full text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setInputPasteMode(false)}
                className="px-3 py-1 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyPasted}
                className="px-4 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors"
              >
                Match Files
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Matcher Toolbar & Verification Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              isDiscFullyMatched ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Matching Status
              </span>
              <span
                className={`text-xs font-semibold ${
                  isDiscFullyMatched ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {activeMatchedCount} of {episodes.length} Disc Episodes Assigned
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {isDiscFullyMatched
                ? 'All episodes on this DVD are cleanly mapped in canonical order.'
                : 'Review tracks below. Reorder tracks using the arrows if your DVD burned tracks out of episode order.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={copyBatchScript}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors"
            title="Copy PowerShell Rename-Item commands for all active tracks"
          >
            {copiedBatchScript ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied Rename Script!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Quick Rename Script</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Track List Mapping Cards */}
      <div className="space-y-2.5">
        {tracks.map((track, idx) => {
          const ep = track.matchedEpisode;
          const isExtra = track.isSpecialExtra;
          const isExcluded = track.isExcluded;

          // Generate target Plex Name
          let targetPlexFilename = '';
          if (ep) {
            targetPlexFilename = formatPlexName(ep);
          } else if (isExtra) {
            const sStr = String(selectedSeason).padStart(2, '0');
            const clean = (track.extraTitle || 'Featurette').replace(/[\\/:*?"<>|]/g, '-');
            targetPlexFilename = `NCIS (2003) - S${sStr}E00 - ${clean}.mkv`;
          } else {
            targetPlexFilename = `[Excluded / Unassigned]`;
          }

          const targetPlexFullPath = ep
            ? formatPlexPath(ep, plexLibraryPath)
            : `${plexLibraryPath}\\NCIS (2003)\\Season ${String(selectedSeason).padStart(
                2,
                '0'
              )}\\${targetPlexFilename}`;

          return (
            <div
              key={track.trackId}
              className={`border rounded-xl p-3.5 sm:p-4 transition-all ${
                isExcluded
                  ? 'bg-slate-950/40 border-slate-800/50 opacity-60'
                  : isExtra
                  ? 'bg-slate-900/70 border-amber-500/30'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Left side: Source file & Reorder Controls */}
                <div className="flex items-start gap-3">
                  {/* Reorder Buttons */}
                  <div className="flex flex-col items-center justify-center shrink-0 pt-0.5">
                    <button
                      onClick={() => moveTrack(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-20 disabled:hover:text-slate-500 transition-colors"
                      title="Move track up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <span className="text-[10px] font-mono text-slate-400 font-semibold">
                      #{idx + 1}
                    </span>
                    <button
                      onClick={() => moveTrack(idx, 'down')}
                      disabled={idx === tracks.length - 1}
                      className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-20 disabled:hover:text-slate-500 transition-colors"
                      title="Move track down"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Source File Badge */}
                  <div>
                    <div className="flex items-center gap-2">
                      <FileVideo className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="font-mono text-xs font-semibold text-white bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        {track.sourceFile}
                      </span>
                      {track.fileSizeMb && (
                        <span className="text-[11px] font-mono text-slate-400">
                          {track.fileSizeMb} MB
                        </span>
                      )}
                      {track.durationEstimate && (
                        <span className="text-[11px] font-mono text-slate-400">
                          · ~{track.durationEstimate}
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex items-center gap-2 text-[11px]">
                      {isExtra ? (
                        <span className="text-amber-400 flex items-center gap-1 font-medium">
                          <Sparkles className="w-3 h-3" /> Special Feature / Bonus Extra
                        </span>
                      ) : ep ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-medium">
                          <CheckCircle className="w-3 h-3" /> Matched to S{String(ep.season).padStart(2, '0')}E{String(ep.episode).padStart(2, '0')}
                        </span>
                      ) : (
                        <span className="text-slate-400">Unassigned track</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Middle: Matched Episode / Canonical Info */}
                <div className="flex-1 lg:px-4">
                  {ep ? (
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">
                          S{String(ep.season).padStart(2, '0')}E{String(ep.episode).padStart(2, '0')}: {ep.title}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          ({ep.airDate})
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                        {ep.synopsis}
                      </p>
                    </div>
                  ) : isExtra ? (
                    <div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={track.extraTitle || ''}
                          onChange={(e) => {
                            const updated = [...tracks];
                            updated[idx].extraTitle = e.target.value;
                            setTracks(updated);
                          }}
                          className="text-xs font-medium bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:ring-1 focus:ring-amber-500 w-64"
                          placeholder="Featurette / Extra Title"
                        />
                        <span className="text-[11px] text-amber-400">
                          Maps to S00 Special in Plex
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 italic">
                      This file is excluded or there are more ripped titles than episodes on this disc.
                    </div>
                  )}

                  {/* Plex Target Preview */}
                  {!isExcluded && (
                    <div className="mt-2 text-[11px] font-mono text-slate-300 bg-slate-950/80 px-2.5 py-1.5 rounded border border-slate-800/80 flex items-center justify-between gap-2 overflow-x-auto">
                      <span className="truncate text-amber-200/90">
                        {targetPlexFilename}
                      </span>
                      <button
                        onClick={() => copyToClipboard(targetPlexFilename, idx)}
                        className="text-slate-400 hover:text-white shrink-0 transition-colors p-0.5"
                        title="Copy Plex filename"
                      >
                        {copiedIndex === idx ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Right Action Controls */}
                <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                  <button
                    onClick={() => toggleExtra(idx)}
                    className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                      isExtra
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                    title="Toggle between regular episode and bonus extra"
                  >
                    {isExtra ? 'As Episode' : 'Make Extra'}
                  </button>

                  <button
                    onClick={() => toggleExclude(idx)}
                    className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                      isExcluded
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-rose-300'
                    }`}
                    title="Exclude track from batch conversion"
                  >
                    {isExcluded ? 'Restore' : 'Exclude'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Helpful Disc Layout Note */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-3 text-xs text-slate-400 space-y-1">
        <div className="flex items-center gap-1.5 font-semibold text-slate-300">
          <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
          <span>MakeMKV Disc Rip Tip:</span>
        </div>
        <p>
          Some NCIS DVD discs include a "Play All" title that is ~15GB and concatenates all 4 episodes into one giant video file.
          Always deselect the giant ~15GB title in MakeMKV and select the four separate ~1.1GB individual titles so each episode is ripped as an individual file.
        </p>
      </div>
    </div>
  );
};
