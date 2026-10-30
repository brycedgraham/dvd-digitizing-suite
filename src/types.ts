export interface NcisEpisode {
  id: string; // e.g. "s01e01"
  season: number; // 1-8
  episode: number; // 1-25
  overallEpisode: number; // 1-186
  title: string;
  discNumber: number; // 1-6
  trackOnDisc: number; // default track index 1-4
  runtimeMinutes: number; // e.g. 44
  airDate: string;
  synopsis: string;
  notableFeature?: string;
  bonusFeaturesOnDisc?: string[];
}

export interface DiscTrackMapping {
  trackId: string;
  sourceFile: string; // e.g. "title_t00.mkv"
  fileSizeMb?: number;
  durationEstimate?: string;
  matchedEpisode: NcisEpisode | null;
  isExcluded: boolean;
  isSpecialExtra: boolean;
  extraTitle?: string;
  customPlexName?: string;
}

export interface DiscProgress {
  season: number;
  disc: number;
  isRipped: boolean;
  isEncoded: boolean;
  isInPlex: boolean;
  notes?: string;
  updatedAt?: string;
}

export interface PipelineSettings {
  sourceDirectory: string; // e.g. "D:\RippedDVDs\NCIS_S01_D1"
  plexLibraryDirectory: string; // e.g. "P:\Plex Media\TV Shows"
  handbrakeCliPath: string; // e.g. "C:\Program Files\HandBrake\HandBrakeCLI.exe"
  videoCodec: 'x264' | 'x265_10bit';
  rfQuality: number; // e.g. 19 for x264, 21 for x265
  decombFilter: 'decomb' | 'yadif' | 'off';
  keepOriginalAudioTrack: boolean;
  addAacStereoFallback: boolean;
  subtitleMode: 'burn_in' | 'embed_vobsub' | 'none';
  deleteRawRipsAfterEncode: boolean;
  createSeasonSubfolder: boolean;
}

export type ActiveTab = 'matcher' | 'presets' | 'scripts' | 'tracker' | 'guide';
