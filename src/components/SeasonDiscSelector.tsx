import React from 'react';
import { NCIS_SEASONS, getEpisodesBySeasonAndDisc, getSeasonInfo } from '../data/ncisCatalog';
import { DiscProgress } from '../types';
import { Disc, CheckCircle2, Clock, Sparkles } from 'lucide-react';

interface SeasonDiscSelectorProps {
  selectedSeason: number;
  setSelectedSeason: (season: number) => void;
  selectedDisc: number;
  setSelectedDisc: (disc: number) => void;
  discProgressList: DiscProgress[];
}

export const SeasonDiscSelector: React.FC<SeasonDiscSelectorProps> = ({
  selectedSeason,
  setSelectedSeason,
  selectedDisc,
  setSelectedDisc,
  discProgressList,
}) => {
  const currentSeasonInfo = getSeasonInfo(selectedSeason);
  const currentEpisodes = getEpisodesBySeasonAndDisc(selectedSeason, selectedDisc);

  // Helper to check disc state
  const getDiscStatus = (season: number, disc: number) => {
    return discProgressList.find((p) => p.season === season && p.disc === disc);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4 shadow-sm">
      {/* Season Selection Bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            1. Select Season (Box Set 1–8)
          </span>
          <span className="text-xs text-slate-400 font-mono">
            {currentSeasonInfo?.year} · {currentSeasonInfo?.totalEpisodes} Episodes · {currentSeasonInfo?.totalDiscs} Discs
          </span>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {NCIS_SEASONS.map((s) => {
            const isSelected = s.season === selectedSeason;
            // Count completed discs for this season
            const completedDiscs = discProgressList.filter(
              (p) => p.season === s.season && p.isInPlex
            ).length;

            return (
              <button
                key={s.season}
                onClick={() => {
                  setSelectedSeason(s.season);
                  // Default to disc 1 when switching seasons
                  setSelectedDisc(1);
                }}
                className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-lg border transition-all text-center ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500 text-amber-300 shadow-sm'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <span className="text-sm font-bold tracking-tight">Season {s.season}</span>
                <span className="text-[10px] font-mono mt-0.5 text-slate-400">
                  {completedDiscs}/{s.totalDiscs} in Plex
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Disc Selection Bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            2. Select Disc on Tray
          </span>
          <span className="text-xs text-slate-400">
            DVD mastering: 4 episodes per disc + bonus featurettes
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {Array.from({ length: currentSeasonInfo?.totalDiscs || 6 }, (_, i) => i + 1).map((discNum) => {
            const isSelected = discNum === selectedDisc;
            const status = getDiscStatus(selectedSeason, discNum);
            const epsOnDisc = getEpisodesBySeasonAndDisc(selectedSeason, discNum);

            let statusColor = 'text-slate-500';
            let statusText = 'Not Started';
            if (status?.isInPlex) {
              statusColor = 'text-emerald-400';
              statusText = 'In Plex';
            } else if (status?.isEncoded) {
              statusColor = 'text-amber-400';
              statusText = 'Encoded';
            } else if (status?.isRipped) {
              statusColor = 'text-sky-400';
              statusText = 'Ripped';
            }

            return (
              <button
                key={discNum}
                onClick={() => setSelectedDisc(discNum)}
                className={`p-3 rounded-lg border text-left transition-all relative ${
                  isSelected
                    ? 'bg-slate-800 border-amber-500 shadow-sm ring-1 ring-amber-500/30'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Disc className={`w-4 h-4 ${isSelected ? 'text-amber-400' : 'text-slate-400'}`} />
                    <span className="text-xs font-bold text-white">Disc {discNum}</span>
                  </div>
                  {status?.isInPlex && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}
                </div>

                <div className="text-[11px] text-slate-400 truncate">
                  Eps {epsOnDisc[0]?.episode}–{epsOnDisc[epsOnDisc.length - 1]?.episode}
                </div>

                <div className={`text-[10px] font-mono mt-1 ${statusColor}`}>
                  {statusText}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Disc Content Strip */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-slate-300">
          <span className="font-semibold text-white">
            Season {selectedSeason}, Disc {selectedDisc}:
          </span>
          <span>{currentEpisodes.length} episodes on disc</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-400">Total runtime: ~{currentEpisodes.length * 44} minutes</span>
          {currentEpisodes.some((e) => e.bonusFeaturesOnDisc && e.bonusFeaturesOnDisc.length > 0) && (
            <>
              <span className="text-slate-600">·</span>
              <span className="text-amber-400/90 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Includes DVD Bonus Featurettes
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 text-[11px] text-slate-400 font-mono">
          <span>MakeMKV titles expected: {currentEpisodes.length} + bonus</span>
        </div>
      </div>
    </div>
  );
};
