# NCIS Seasons 1–8 DVD-to-Plex Digitization & Automation Studio

A dedicated media engineering toolkit and automation pipeline designed to digitize, deinterlace, transcode, and rename all 8 seasons of NCIS (~48 DVD box set discs, 186 episodes) for Plex Media Server on Windows.

---

## ⚡ 1-Click Automated Workflow

### 1. Launch the Local Python Automation Server
**Recommended — one-click launcher:** double-click **`start.bat`**, or run in PowerShell:
```powershell
.\start.ps1                # default port 5000, opens browser when ready
.\start.ps1 -Port 8080     # custom port
.\start.ps1 -NoBrowser     # don't auto-open the browser
```
The launcher runs pre-flight checks (Python, MakeMKV, HandBrakeCLI, optical drive, built frontend in `dist\`), starts the server, and opens `http://127.0.0.1:5000` once it answers health checks. If port 5000 is already serving, it just re-opens the studio instead of starting a second instance.

Manual alternative (no pre-flight checks):
```powershell
python backend/server.py
```
The server starts at `http://127.0.0.1:5000` and automatically:
- Detects your optical DVD drive (e.g. `D:`)
- Detects installed `HandBrakeCLI.exe` and `MakeMKV`
- Enables HTTP byte-range video streaming for the in-app video player

### 2. Click "Digitize Disc" in the Web Studio
1. Select your **Season** (1–8) and **Disc** (1–6).
2. Confirm your optical drive letter (e.g. `D:`).
3. Click **"Digitize Disc"**. The backend invokes `makemkvcon64.exe`, automatically filters out the 15GB "Play All" track, and rips the 4 individual episode tracks into your temporary scratch folder.

### 3. Verify Title Cards with the Integrated Video Player
1. Click **"Open Episode Mapping & Video Player"**.
2. The studio loads each track with its runtime (~43:40).
3. Use the **Quick-Jump Title Verification Buttons**:
   - `0:45 (Cold Open)`: Verify opening scene.
   - `2:15 (Title Card Freeze)`: **Instantly see the episode title on screen!**
   - `5:00 (Act 1)`: Main story start.
   - `10:00 (Squad Room)` / `15:00 (Autopsy)`: Verify guest stars and plot.
4. Click **"Confirm Title Matches Episode"** to lock in the match.
5. If the DVD burned episodes out of order, simply pick the correct episode from the dropdown.

### 4. Transcode with HandBrake Decomb Directly to Plex
Click **"Confirm All & Start HandBrake Transcoding"**. The backend runs `HandBrakeCLI` with:
- `--comb-detect --decomb`: Deinterlaces 480i NTSC frames to prevent combing artifacts.
- `-a 1,1 -E copy:ac3,av_aac`: Preserves 5.1 surround sound + adds stereo AAC for mobile direct play.
- Outputs directly to:
  `Plex\TV Shows\NCIS (2003)\Season XX\NCIS (2003) - SXXEYY - Title.mkv`

---

## 📁 Plex TV Folder Structure

Plex requires strict naming with the series debut year `(2003)`:

```
P:\Plex Media\TV Shows\
└── NCIS (2003)\
    ├── Season 01\
    │   ├── NCIS (2003) - S01E01 - Yankee White.mkv
    │   ├── NCIS (2003) - S01E02 - Hung Out to Dry.mkv
    │   ├── NCIS (2003) - S01E03 - Seadog.mkv
    │   └── NCIS (2003) - S01E04 - The Immortals.mkv
    ├── Season 02\
    │   └── NCIS (2003) - S02E01 - See No Evil.mkv
    └── Season 00\  (DVD Featurettes & Specials)
        └── NCIS (2003) - S00E01 - Creating The Team.mkv
```

---

## 🛠️ Automated Scripts Included

| Script | Purpose |
| :--- | :--- |
| `start.ps1` | One-click Windows launcher: pre-flight checks, starts the server, opens the browser. |
| `start.bat` | Double-click wrapper for `start.ps1` (bypasses script execution policy). |
| `backend/server.py` | Local Python automation server (MakeMKV & HandBrake runner + video streamer). |
| `NCIS_DVD_Decomb.json` | Official HandBrake GUI preset file (import via *Presets → Options → Import from file*). |

---

## ❓ Troubleshooting FAQ

### "File cannot be loaded because running scripts is disabled on this system"
Run this command in PowerShell before executing scripts:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### Can I run the video player without starting the Python server?
Yes! The **Episode Mapping & Player** tab has a **"Load Local Video File"** button where you can select any `.mkv` or `.mp4` file directly from your computer, or use the built-in animated canvas preview.
