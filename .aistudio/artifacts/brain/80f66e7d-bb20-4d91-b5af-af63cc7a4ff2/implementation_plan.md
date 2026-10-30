# NCIS DVD-to-Plex Digitization & Automation Studio

A dedicated media pipeline and batch automation workspace engineered for digitizing NCIS DVD box sets (Seasons 1–8), matching MakeMKV raw disc titles to canonical Plex episode naming, generating optimized HandBrake deinterlacing presets, and exporting one-click Windows PowerShell batch pipelines.

## User Review & Critical Decisions

> [!IMPORTANT]
> Key choices confirmed in Phase 1:
> - **Platform & Environment**: Windows with PowerShell and Command Prompt.
> - **Workflow Architecture**: Interactive web studio with disc-by-disc episode matcher, Plex renamer, and script generator.
> - **Encoding & Quality**: HandBrake automated batch transcoding with DVD deinterlacing (comb detection + Yadif/Decomb) to eliminate 480i telecine combing while targeting optimal Plex direct-play compatibility.

- **Plex Standard Naming Compliance**: Follows official Plex TV specifications: `NCIS (2003)/Season {XX}/NCIS (2003) - S{XX}E{YY} - {Episode Title}.mkv`.
- **Disc Title Mapping Strategy**: Discs usually contain 4 episodes plus extras. The tool provides a built-in disc-by-disc map for Seasons 1–8, with runtime-based filtering (filtering out short featurettes under 20 mins) and visual drag-and-drop reordering for non-sequential title tracks.
- **PowerShell Script Strategy**: Self-contained, robust PowerShell scripts (`Convert-NCIS.ps1`, `Rename-PlexEpisodes.ps1`) that check for `HandBrakeCLI.exe` in `PATH` or Program Files, preserve original audio/subtitles, and provide progress feedback in terminal.

---

## 1. Overview & Core Concept

- **What It Does**: Digitizing 8 seasons of NCIS represents ~186 episodes across 48+ DVD discs. Ripping with MakeMKV creates generic filenames like `title_t00.mkv` that are out of order, laced with extra featurettes, and interlaced (480i). This studio provides an end-to-end companion tool to:
  1. Map raw MakeMKV files to exact NCIS episodes per disc using a curated database of Seasons 1–8.
  2. Filter out bloopers, commentaries, and menu loops automatically based on typical 42–45 minute runtimes.
  3. Generate and export custom HandBrake presets configured for DVD telecine/interlacing removal and 5.1 surround sound.
  4. Generate ready-to-execute Windows PowerShell and Batch scripts to automate transcoding and moving files directly into Plex libraries.
  5. Track digitizing progress across all 48 discs and 8 seasons with persistent local storage.
- **Target Persona**: Home media archivist and Plex server administrator digitizing large multi-disc DVD box sets on a Windows PC.
- **Key Value**: Replaces hours of error-prone manual file renaming, track guessing, and HandBrake queue clicking with a fast, structured, 3-click workflow.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Select Season & Disc**: User picks Season (1 to 8) and Disc (1 to 6). The app renders the disc's expected episodes, air dates, runtimes, synopses, and expected title track count.
2. **Input Ripped Files**: User drags and drops raw MakeMKV files or pastes file names from their folder (e.g. `title_t00.mkv`, `title_t01.mkv`). The system auto-matches them against the disc's episodes and highlights suspected bonus featurettes.
3. **Inspect & Adjust**: User can drag to reorder if tracks were mastered out of order, preview exact Plex filenames, and toggle episode audio/subtitle settings.
4. **Generate HandBrake Preset & Scripts**:
   - One-click copy/download of `HandBrake_NCIS_DVD_Optimized.json` preset.
   - One-click copy or download of `Process-NCIS-Disc.ps1` (PowerShell) and `Process-NCIS-Disc.bat` (batch).
   - One-click copy of the pure rename script for already-encoded files.
5. **Track Season Progress**: Check off discs as Ripped, Encoded, or Added to Plex, viewing total progress (e.g. `Season 2: 18/24 episodes digitized`).

### Visual Identity & Theme
- **Domain Aesthetic**: High-utility, dark slate media engineering console inspired by modern audiovisual workstations and Plex/Jellyfin dashboards.
- **Color Palette**:
  - Canvas: Dark neutral slate (`#0B0F17` / `#0F172A`)
  - Structural Panels: Deep charcoal with hairline border (`#1E293B`, `border-slate-800`)
  - Primary Accent: Precision Amber/Cyan (`#F59E0B` for HandBrake/actions, `#0284C7` for Plex/library)
  - Typography: Crisp sans (`Plus Jakarta Sans`) paired with monospace tabular figures (`JetBrains Mono` / `tabular-nums`) for file sizes, timestamps, and terminal commands.
- **Micro-Interactions**:
  - Smooth drag-and-drop track reordering.
  - One-click copy-to-clipboard with instant visual confirmation.
  - Interactive file duration filter slider to isolate main episodes from bonus featurettes.
  - Interactive terminal command preview with parameter toggles (H.264 vs H.265, RF quality, audio passthrough).

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Built-in NCIS Seasons 1–8 Complete Episode Catalog
- **Chosen Approach**: Ship a complete, pre-bundled offline JSON dataset containing all 186 episodes of NCIS Seasons 1 to 8, with disc-to-episode mapping (Discs 1–6 per season), standard runtimes, US air dates, and synopses.
- **Why**: Allows instant, zero-latency matching without requiring external API keys (TMDB/TVDb), internet access, or rate limits. Works completely offline.
- **Alternative Considered**: Relying on live TVDB/TMDB API calls, which require users to create developer accounts and paste API keys.

### Decision 2: DVD Deinterlacing & Telecine Settings in HandBrake
- **Chosen Approach**: Pre-configure HandBrake settings specifically for NTSC DVD video:
  - Video Filter: `--comb-detect --decomb` (or Yadif fallback) to remove interlaced combing artifacts from 480i DVD video without degrading progressive frames.
  - Anamorphic: Strict or Automatic anamorphic flag to preserve the correct 16:9 or 4:3 aspect ratio without squishing.
  - Codec: H.264 (RF 19) for universal direct play, with an option for H.265 (RF 20) for 40% smaller storage.
  - Audio: English AC3 5.1 passthrough + Stereo AAC fallback.
- **Why**: Interlacing artifacts are the #1 visual defect users encounter when ripping 2000s DVDs like NCIS. Automating this eliminates the jagged lines on motion.

### Decision 3: Script Output: Both Standalone Renamer & End-to-End HandBrakeCLI Pipeline
- **Chosen Approach**: Provide two script modes:
  1. *Pure Renamer Script*: For users who prefer to run the HandBrake GUI manually and just need instant, error-free Plex file renaming.
  2. *Automated Batch Pipeline Script*: PowerShell script taking a source folder of MakeMKV rips, automatically queuing HandBrakeCLI with the custom preset, and writing directly to the Plex destination folder with verified filenames.
- **Why**: Caters to both users who want hands-on encoding control and users who want set-and-forget background transcoding.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│             NCIS DVD-to-Plex Digitization Studio (React 19)            │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│  Season & Disc Nav  │   │  Disc-Track Matcher │   │ HandBrake & Script  │
│  - Seasons 1 to 8   │   │  - Drag & Drop Drop │   │  - CLI Generator    │
│  - Discs 1 to 6     │   │  - Bonus Filter     │   │  - Preset JSON      │
│  - Progress Monitor │   │  - Plex Rename View │   │  - PowerShell Script│
└──────────┬──────────┘   └──────────┬──────────┘   └──────────┬──────────┘
           │                         │                         │
           ▼                         ▼                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      NCIS Master Episode Catalog                       │
│      186 Episodes · Seasons 1-8 · Disc Map · Runtimes · Synopses       │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Local Storage State Persistence                      │
│      - Box Set Progress (Discs Ripped / Encoded / Added to Plex)       │
│      - User Path Config (HandBrakeCLI path, Source, Plex Dest)         │
│      - Preferred Encoding Presets & Quality Sliders                    │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State
- `NcisEpisode`: `{ id, season, episode, title, discNumber, trackOnDisc, runtimeMinutes, airDate, synopsis, isSpecial }`
- `DiscStatus`: `{ season, disc, ripped: boolean, encoded: boolean, inPlex: boolean, notes: string }`
- `PipelineConfig`: `{ sourceDir, plexOutputDir, handbrakePath, codec: 'h264'|'h265', qualityRf: number, decomb: boolean, audioMode: string }`
- `MatchedFile`: `{ rawName, estimatedDuration, matchedEpisodeId, isFeaturette, targetPlexName }`

### Verification Plan
- Verify all 8 seasons and ~186 episodes are complete and accurately mapped to standard DVD disc layouts.
- Verify file drag-and-drop parsing, manual filename pasting, and runtime filtering.
- Verify generated PowerShell script syntax (`Rename-Item`, `HandBrakeCLI`, error handling, file paths with spaces).
- Test generated HandBrake preset JSON against HandBrake 1.7+ preset schema.
- Run `compile_applet` to ensure zero compilation or TypeScript errors.
