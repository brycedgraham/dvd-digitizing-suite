import React, { useState } from 'react';
import { NCIS_SEASONS, getEpisodesBySeasonAndDisc } from '../data/ncisCatalog';
import { DiscProgress } from '../types';
import {
  CheckCircle2,
  HardDrive,
  Clock,
  Sparkles,
  Download,
  Upload,
  RotateCcw,
  Disc,
  Layers,
  ChevronRight,
} from 'lucide-react';

interface BoxSetTrackerProps {
  discProgressList: DiscProgress[];
  setDiscProgressList: React.Dispatch<React.SetStateAction<DiscProgress[]>>;
  onSelectDisc: (season: number, disc: number) => void;
  activeSeason: number;
}

export const BoxSetTracker: React.FC<BoxSetTrackerProps> = ({
  discProgressList,
  setDiscProgressList,
  onSelectDisc,
  activeSeason,
}) => {
  const [filterSeason, setFilterSeason] = useState<number | 'all'>('all');
  const [copiedBackup, setCopiedBackup] = useState(false);

  // Compute metrics
  const totalDiscs = 48; // across seasons 1-8
  const rippedDiscsCount = discProgressList.filter((d) => d.isRipped).length;
  const encodedDiscsCount = discProgressList.filter((d) => d.isEncoded).length;
  const inPlexDiscsCount = discProgressList.filter((d) => d.isInPlex).length;

  // Approximate episode count in Plex
  let episodesInPlex = 0;
  discProgressList.forEach((d) => {
    if (d.isInPlex) {
      const eps = getEpisodesBySeasonAndDisc(d.season, d.disc);
      episodesInPlex += eps.length;
    }
  });

  const totalEpisodes = 186;
  const overallPercentage = Math.round((episodesInPlex / totalEpisodes) * 100) || 0;

  // Estimated stats
  const estimatedGbInH264 = (episodesInPlex * 0.72).toFixed(1); // ~720MB per episode in H.264 RF19
  const estimatedHoursSaved = (episodesInPlex * 0.18).toFixed(1); // ~11 minutes saved per episode vs manual file typing/renaming/queueing

  // Toggle milestone state
  const toggleMilestone = (season: number, disc: number, field: 'isRipped' | 'isEncoded' | 'isInPlex') => {
    setDiscProgressList((prev) => {
      const existingIndex = prev.findIndex((p) => p.season === season && p.disc === disc);
      if (existingIndex >= 0) {
        const updated = [...prev];
        const current = updated[existingIndex];
        const nextVal = !current[field];

        // Cascading logic: if marking InPlex true, auto-mark Ripped and Encoded true
        let newRipped = current.isRipped;
        let newEncoded = current.isEncoded;
        let newInPlex = current.isInPlex;

        if (field === 'isInPlex' && nextVal) {
          newRipped = true;
          newEncoded = true;
          newInPlex = true;
        } else if (field === 'isEncoded' && nextVal) {
          newRipped = true;
          newEncoded = true;
        } else {
          if (field === 'isRipped') newRipped = nextVal;
          if (field === 'isEncoded') newEncoded = nextVal;
          if (field === 'isInPlex') newInPlex = nextVal;
        }

        updated[existingIndex] = {
          ...current,
          isRipped: newRipped,
          isEncoded: newEncoded,
          isInPlex: newInPlex,
          updatedAt: new Date().toISOString(),
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            season,
            disc,
            isRipped: field === 'isRipped' || field === 'isEncoded' || field === 'isInPlex',
            isEncoded: field === 'isEncoded' || field === 'isInPlex',
            isInPlex: field === 'isInPlex',
            updatedAt: new Date().toISOString(),
          },
        ];
      }
    });
  };

  // Mark all discs of a season as completed
  const markWholeSeasonCompleted = (seasonNum: number) => {
    const seasonInfo = NCIS_SEASONS.find((s) => s.season === seasonNum);
    if (!seasonInfo) return;

    setDiscProgressList((prev) => {
      const filtered = prev.filter((p) => p.season !== seasonNum);
      const newItems: DiscProgress[] = Array.from(
        { length: seasonInfo.totalDiscs },
        (_, i) => ({
          season: seasonNum,
          disc: i + 1,
          isRipped: true,
          isEncoded: true,
          isInPlex: true,
          updatedAt: new Date().toISOString(),
        })
      );
      return [...filtered, ...newItems];
    });
  };

  // Export progress JSON
  const exportProgressJson = () => {
    const dataStr = JSON.stringify(discProgressList, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NCIS_Plex_Progress_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import progress JSON
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          setDiscProgressList(parsed);
        }
      } catch (err) {
        alert('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
  };

  const seasonsToRender =
    filterSeason === 'all'
      ? NCIS_SEASONS
      : NCIS_SEASONS.filter((s) => s.season === filterSeason);

  return (
    <div className="space-y-6">
      {/* High Level Progress Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
            Box Set Digitized
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">
              {episodesInPlex}
            </span>
            <span className="text-xs font-mono text-slate-400">
              / {totalEpisodes} episodes ({overallPercentage}%)
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2.5 overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${overallPercentage}%` }}
            />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
            Discs Processed
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">
              {inPlexDiscsCount}
            </span>
            <span className="text-xs font-mono text-slate-400">
              / {totalDiscs} total discs
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            {rippedDiscsCount} Ripped · {encodedDiscsCount} Encoded
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
            Plex Library Space
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">
              ~{estimatedGbInH264} GB
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            Full 8 seasons estimated: ~130 GB in H.264
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
            Pipeline Time Saved
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-amber-400">
              ~{estimatedHoursSaved} hrs
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            From automated track matching & batching
          </div>
        </div>
      </div>

      {/* Filter and Backup Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <span className="text-xs font-semibold text-slate-400 shrink-0">Filter:</span>
          <button
            onClick={() => setFilterSeason('all')}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
              filterSeason === 'all'
                ? 'bg-amber-500 text-slate-950 font-semibold'
                : 'bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            All Seasons
          </button>
          {NCIS_SEASONS.map((s) => (
            <button
              key={s.season}
              onClick={() => setFilterSeason(s.season)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors shrink-0 ${
                filterSeason === s.season
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              S{s.season}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>Import Backup</span>
            <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
          </label>

          <button
            onClick={exportProgressJson}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Backup</span>
          </button>
        </div>
      </div>

      {/* Season by Season Breakdown */}
      <div className="space-y-4">
        {seasonsToRender.map((season) => {
          const completedDiscs = discProgressList.filter(
            (p) => p.season === season.season && p.isInPlex
          ).length;
          const isSeasonFinished = completedDiscs === season.totalDiscs;

          return (
            <div
              key={season.season}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4"
            >
              {/* Season Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-white">
                      Season {season.season} ({season.year})
                    </h4>
                    {isSeasonFinished && (
                      <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Season Complete
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {season.totalEpisodes} episodes · {season.totalDiscs} DVDs · {season.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono text-slate-300">
                    {completedDiscs} / {season.totalDiscs} Discs in Plex
                  </span>
                  {!isSeasonFinished && (
                    <button
                      onClick={() => markWholeSeasonCompleted(season.season)}
                      className="px-2.5 py-1 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
                    >
                      Mark All Discs Complete
                    </button>
                  )}
                </div>
              </div>

              {/* Discs Grid for This Season */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: season.totalDiscs }, (_, i) => i + 1).map((discNum) => {
                  const eps = getEpisodesBySeasonAndDisc(season.season, discNum);
                  const status = discProgressList.find(
                    (p) => p.season === season.season && p.disc === discNum
                  );

                  return (
                    <div
                      key={discNum}
                      className={`p-3.5 rounded-lg border transition-all ${
                        status?.isInPlex
                          ? 'bg-slate-950/80 border-emerald-500/30 ring-1 ring-emerald-500/10'
                          : 'bg-slate-950 border-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <Disc className="w-4 h-4 text-amber-400" />
                          <span className="text-xs font-bold text-white">Disc {discNum}</span>
                        </div>
                        <button
                          onClick={() => onSelectDisc(season.season, discNum)}
                          className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-0.5 font-medium"
                        >
                          <span>Open in Matcher</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-[11px] text-slate-300 mb-3 space-y-0.5">
                        <div className="font-semibold text-slate-200">
                          Episodes {eps[0]?.episode}–{eps[eps.length - 1]?.episode} ({eps.length} eps):
                        </div>
                        <div className="text-slate-400 text-[10px] truncate">
                          {eps.map((e) => e.title).join(', ')}
                        </div>
                      </div>

                      {/* 3 Milestone Checkboxes */}
                      <div className="pt-2 border-t border-slate-800/80 grid grid-cols-3 gap-1.5 text-[11px]">
                        <button
                          onClick={() => toggleMilestone(season.season, discNum, 'isRipped')}
                          className={`py-1 px-1.5 rounded text-center font-medium transition-colors ${
                            status?.isRipped
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                              : 'bg-slate-900 text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          1. Ripped
                        </button>

                        <button
                          onClick={() => toggleMilestone(season.season, discNum, 'isEncoded')}
                          className={`py-1 px-1.5 rounded text-center font-medium transition-colors ${
                            status?.isEncoded
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-slate-900 text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          2. Encoded
                        </button>

                        <button
                          onClick={() => toggleMilestone(season.season, discNum, 'isInPlex')}
                          className={`py-1 px-1.5 rounded text-center font-medium transition-colors ${
                            status?.isInPlex
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-900 text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          3. In Plex
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
