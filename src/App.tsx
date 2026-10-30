import React, { useState, useEffect } from 'react';
import { ActiveTab, PipelineSettings, DiscProgress, DiscTrackMapping } from './types';
import { Header } from './components/Header';
import { SeasonDiscSelector } from './components/SeasonDiscSelector';
import { TrackMatcher } from './components/TrackMatcher';
import { HandbrakePresetStudio } from './components/HandbrakePresetStudio';
import { ScriptGenerator } from './components/ScriptGenerator';
import { BoxSetTracker } from './components/BoxSetTracker';
import { WorkflowGuide } from './components/WorkflowGuide';
import { getEpisodesBySeasonAndDisc } from './data/ncisCatalog';

const DEFAULT_SETTINGS: PipelineSettings = {
  sourceDirectory: 'D:\\MakeMKV_Rips\\NCIS_S01_D1',
  plexLibraryDirectory: 'P:\\Plex Media\\TV Shows',
  handbrakeCliPath: 'C:\\Program Files\\HandBrake\\HandBrakeCLI.exe',
  videoCodec: 'x264',
  rfQuality: 19,
  decombFilter: 'decomb',
  keepOriginalAudioTrack: true,
  addAacStereoFallback: true,
  subtitleMode: 'embed_vobsub',
  deleteRawRipsAfterEncode: false,
  createSeasonSubfolder: true,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('matcher');
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [selectedDisc, setSelectedDisc] = useState<number>(1);

  // Persistent settings in localStorage
  const [settings, setSettings] = useState<PipelineSettings>(() => {
    try {
      const saved = localStorage.getItem('ncis_pipeline_settings');
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Persistent disc progress in localStorage
  const [discProgressList, setDiscProgressList] = useState<DiscProgress[]>(() => {
    try {
      const saved = localStorage.getItem('ncis_disc_progress');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ncis_pipeline_settings', JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings to localStorage', e);
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem('ncis_disc_progress', JSON.stringify(discProgressList));
    } catch (e) {
      console.error('Failed to save progress to localStorage', e);
    }
  }, [discProgressList]);

  // Update sourceDirectory suggestion dynamically when switching season or disc
  useEffect(() => {
    const sStr = String(selectedSeason).padStart(2, '0');
    // If the user hasn't heavily modified the source directory root
    setSettings((prev) => {
      const baseMatch = prev.sourceDirectory.match(/^(.*[\\/])(?:NCIS_S\d+_D\d+|Season\s*\d+.*)?$/i);
      const rootPath = baseMatch ? baseMatch[1] : 'D:\\MakeMKV_Rips\\';
      const updatedSource = `${rootPath}NCIS_S${sStr}_D${selectedDisc}`;
      return {
        ...prev,
        sourceDirectory: updatedSource,
      };
    });
  }, [selectedSeason, selectedDisc]);

  // Calculate completed episodes count
  let completedEpisodesCount = 0;
  discProgressList.forEach((d) => {
    if (d.isInPlex) {
      const eps = getEpisodesBySeasonAndDisc(d.season, d.disc);
      completedEpisodesCount += eps.length;
    }
  });

  const handleSelectDiscFromTracker = (season: number, disc: number) => {
    setSelectedSeason(season);
    setSelectedDisc(disc);
    setActiveTab('matcher');
  };

  const markCurrentDiscCompleted = () => {
    setDiscProgressList((prev) => {
      const idx = prev.findIndex((p) => p.season === selectedSeason && p.disc === selectedDisc);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          isRipped: true,
          isEncoded: true,
          isInPlex: true,
          updatedAt: new Date().toISOString(),
        };
        return copy;
      } else {
        return [
          ...prev,
          {
            season: selectedSeason,
            disc: selectedDisc,
            isRipped: true,
            isEncoded: true,
            isInPlex: true,
            updatedAt: new Date().toISOString(),
          },
        ];
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        completedEpisodesCount={completedEpisodesCount}
        totalEpisodesCount={186}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Season & Disc Bar - Present on Matcher, Presets, and Scripts tabs */}
        {(activeTab === 'matcher' || activeTab === 'presets' || activeTab === 'scripts') && (
          <SeasonDiscSelector
            selectedSeason={selectedSeason}
            setSelectedSeason={setSelectedSeason}
            selectedDisc={selectedDisc}
            setSelectedDisc={setSelectedDisc}
            discProgressList={discProgressList}
          />
        )}

        {/* Tab 1: Track & File Matcher */}
        {activeTab === 'matcher' && (
          <TrackMatcher
            selectedSeason={selectedSeason}
            selectedDisc={selectedDisc}
            plexLibraryPath={settings.plexLibraryDirectory}
            onMarkDiscCompleted={markCurrentDiscCompleted}
          />
        )}

        {/* Tab 2: HandBrake Preset Studio */}
        {activeTab === 'presets' && (
          <HandbrakePresetStudio settings={settings} setSettings={setSettings} />
        )}

        {/* Tab 3: Windows PowerShell Automation Scripts */}
        {activeTab === 'scripts' && (
          <ScriptGenerator
            selectedSeason={selectedSeason}
            selectedDisc={selectedDisc}
            settings={settings}
            setSettings={setSettings}
          />
        )}

        {/* Tab 4: Box Set Progress Tracker */}
        {activeTab === 'tracker' && (
          <BoxSetTracker
            discProgressList={discProgressList}
            setDiscProgressList={setDiscProgressList}
            onSelectDisc={handleSelectDiscFromTracker}
            activeSeason={selectedSeason}
          />
        )}

        {/* Tab 5: Workflow & CLI Setup Guide */}
        {activeTab === 'guide' && <WorkflowGuide />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-5 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            NCIS DVD-to-Plex Automation Studio · Built for Windows MakeMKV & HandBrake pipelines
          </p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Plex Media Standard Compliance</span>
            <span>·</span>
            <span>NTSC 480i Decomb Filter</span>
            <span>·</span>
            <span>186 Episodes (Seasons 1–8)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
