# Automated NCIS DVD Digitize Studio with Video Title Verifier

A streamlined, automated server-side digitization architecture driven by a zero-setup **Python automation engine** (`server.py`), featuring a 1-click "Digitize Disc" mission control, and a dedicated **Episode Mapping Page with an integrated Video Player** for verifying episode title cards in the first 2–15 minutes.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Revisions based on your feedback:
> - **Selected Backend: Python**: Selected Python as the primary, easiest-to-run automation engine. It requires zero compilation, runs directly on Windows via `python server.py`, and includes native HTTP byte-range streaming so video files can be previewed smoothly in the browser.
> - **Integrated Video Player & Title Verifier**: Added an in-app video player directly into the Episode Mapping page. Ripped tracks can be played immediately, with quick-jump buttons (**+2 min, +5 min, +10 min, +15 min**) to instantly jump to the opening credits or title freeze-frame to confirm episode identity before HandBrake encoding begins.
> - **2-Step "Digitize & Review" Flow**:
>   1. **Step 1 (Rip)**: User selects optical DVD drive letter and clicks **"Digitize Disc"**. Python runs `makemkvcon` in the background and extracts clean episode tracks.
>   2. **Step 2 (Map & Verify)**: App presents the **Episode Mapping Page** with the video player. User verifies title cards and confirms mapping.
>   3. **Step 3 (Encode & Plex)**: Python launches `HandBrakeCLI` with NTSC 480i Decomb and writes directly into your Plex folder structure:
>      `Plex\TV Shows\NCIS (2003)\Season XX\NCIS (2003) - SXXEYY - Title.mkv`

---

## 1. Overview & Core Concept

- **The User Problem**: Ripping multi-disc DVD box sets manually requires juggling MakeMKV, HandBrake, manual file renaming, and guessing which `title_t00.mkv` corresponds to which episode. Because DVDs sometimes master episodes in non-chronological title tracks, users must visually confirm which episode is which.
- **The Solution**:
  1. A lightweight Python backend (`server.py`) that acts as a bridge between the browser UI and local Windows tools (`makemkvcon64.exe`, `HandBrakeCLI.exe`, optical drives).
  2. A 1-Click "Digitize" interface that triggers disc ripping and notifies when complete.
  3. A dedicated **Episode Mapping & Video Preview Page**:
     - Automatically matches tracks by runtime (~43 min = episode).
     - Lets the user play the video file inside the app with 1-click shortcuts to the 2–15 minute title marks.
     - Allows instant track re-ordering, episode title confirmation, and bonus extra tagging.
  4. One-click transcode with HandBrakeCLI with NTSC 480i Decomb deinterlacing and automatic Plex library placement.

---

## 2. Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                   NCIS Digitize Studio (React Frontend)                │
│  - 1-Click Digitize Mission Control     - Episode Mapping Review Page  │
│  - Built-in Video Player & Title HUD   - Box Set Progress Tracker     │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ REST / Streaming (localhost:5000)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 Local Automation Engine (Python server.py)             │
│  - Optical Drive Detector (Windows WMI/CIM & drive status)             │
│  - MakeMKV CLI Runner (subprocess makemkvcon64.exe)                    │
│  - Video Streamer (HTTP Byte-Range streaming for preview player)       │
│  - HandBrakeCLI Runner (with real-time progress parsing & decomb)      │
│  - Plex Destination Writer (creates Season XX folders & Plex names)    │
└──────────────────┬──────────────────────────────────┬──────────────────┘
                   │                                  │
                   ▼                                  ▼
      ┌─────────────────────────┐        ┌─────────────────────────┐
      │ MakeMKV (makemkvcon64)  │        │ HandBrake (HandBrakeCLI)│
      │ Lossless DVD Extraction │        │ DVD Decomb & Audio Sync │
      └─────────────────────────┘        └─────────────────────────┘
```

---

## 3. User Experience & Visual Design

### View 1: 1-Click Digitize Mission Control
- **Optical Drive & Paths**:
  - Optical DVD Drive selector (e.g. `D:`) with auto-detect button.
  - Scratch Temp Ripping folder (`C:\MakeMKV_Rips\NCIS`).
  - Plex TV Library destination (`X:\Media\TV Shows`).
- **Primary CTA**: Large **"Digitize Disc"** button with live status badge (`Ready`, `Ripping DVD...`, `Awaiting Mapping`, `Transcoding...`, `Finished`).
- **Live Worker Status**: Heartbeat indicator showing whether the local Python server is connected (`● Python Server Online on port 5000`) or running in demo simulation mode with 1-click launch instructions.

### View 2: Episode Mapping & Integrated Video Player
- **Split Layout (Video Player on Left / Episode Matcher on Right)**:
  - **Integrated Video Player**:
    - HTML5 Video Player connected to the local video stream or local file object.
    - **Title Card Verification Bar**: Quick-jump buttons:
      - `[Jump to 2:00]`: Typically intro tease / cold open.
      - `[Jump to 5:00]`: Main title sequence / episode title card display.
      - `[Jump to 10:00]`: Autopsy / bullpen intro scenes.
      - `[Jump to 15:00]`: Case exposition & guest star titles.
    - Candidate Episode Card showing expected synopsis, guest stars, and air date for rapid visual confirmation.
    - One-click button: **"Confirm Title Matches Episode"** with instant visual green checkmark.
  - **Track Mapping Grid**:
    - List of ripped tracks (`title_t00.mkv`, `title_t01.mkv`, etc.) with durations and sizes.
    - Dropdown or drag handles to change assigned episode if the disc had them reversed.
    - Tag as Bonus Extra / Special Feature toggle.
    - **"Confirm All & Start HandBrake Transcoding"** primary action button.

### View 3: Live HandBrake Transcode HUD
- Live encoding progress bar (e.g., `Task 2 of 4: 58% · 148 fps · 4.5x speed`).
- Estimated completion time and live terminal log drawer.
- Automatic update to the Box Set Progress Tracker when completed!

---

## 4. Python Server Architecture (`backend/server.py`)

- **Lightweight & Portable**: Single standalone Python file (`server.py`) using Python standard libraries (`http.server`, `subprocess`, `threading`, `json`, `pathlib`, `urllib`), with zero mandatory external pip dependencies:
  - `GET /api/status`: Scans for optical drives, HandBrakeCLI, and MakeMKV paths.
  - `POST /api/rip`: Invokes `makemkvcon64.exe` against the selected optical drive, filtering out the ~15GB Play All track.
  - `GET /api/stream?file=...`: HTTP Byte-Range compliant streaming endpoint (`status 206 Partial Content`) allowing the HTML5 video player in the browser to seek smoothly to any minute of raw MKV/MP4 files.
  - `POST /api/transcode`: Invokes `HandBrakeCLI.exe` with `--comb-detect --decomb`, AC3 5.1 passthrough, and stereo AAC downmix, outputting directly to the Plex destination folder.
  - `GET /api/progress`: Returns real-time percentage, current episode, and log messages.

---

## 5. Verification Plan

1. Verify Python server script executes cleanly under Python 3.8+ on Windows.
2. Verify HTML5 video player component handles both local backend streaming and client-side File API video playback.
3. Verify title card quick-jump buttons (`+2m`, `+5m`, `+10m`, `+15m`) accurately set video currentTime.
4. Verify episode mapping table updates dynamically and locks in user confirmations.
5. Verify seamless fallback between connected live Python worker and demo simulation.
6. Run `compile_applet` and `lint_applet` to confirm zero compilation and TypeScript errors.
