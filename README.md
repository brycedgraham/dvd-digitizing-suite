# NCIS Seasons 1–8 DVD-to-Plex Digitization & Automation Studio

A dedicated media engineering toolkit and automation pipeline designed to digitize, deinterlace, transcode, and rename all 8 seasons of NCIS (~48 DVD box set discs, 186 episodes) for Plex Media Server on Windows.

---

## ⚡ 1-Click Automated Workflow

### 1. Launch the Local Python Automation Server
```powershell
# Open PowerShell in the project directory and start the zero-dependency backend
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
| `backend/server.py` | Local Python automation server (MakeMKV & HandBrake runner + video streamer). |
| `Dockerfile` | Multi-stage Docker build for Linux, Unraid, TrueNAS, and Docker Desktop. |
| `docker-compose.yml` | Container orchestration with optical drive pass-through and storage mounts. |
| `Test-NCISSetup.ps1` | Interactive PC environment doctor: checks tools, drives, storage, and script permissions. |
| `Encode-NCIS-SxxDyy.ps1` | Standalone batch PowerShell script if you prefer running without the Python server. |
| `Rename-NCIS-SxxDyy.ps1` | Fast standalone renamer for files already transcoded via the HandBrake desktop GUI. |
| `NCIS_DVD_Decomb.json` | Official HandBrake GUI preset file (import via *Presets → Options → Import from file*). |

---

## 🐳 Docker & Unraid Deployment

You can run the entire studio inside a Docker container with optical drive pass-through:

### 1. 1-Command Docker Run
```bash
docker run -d \
  --name ncis-dvd-studio \
  --restart unless-stopped \
  --device=/dev/sr0:/dev/sr0 \
  -p 5000:5000 \
  -v $(pwd)/scratch:/scratch \
  -v /path/to/plex/media:/plex \
  ncis-dvd-to-plex-studio:latest
```

### 2. Using Docker Compose
```bash
# Build and start container
docker compose up -d
```
Access the studio at `http://localhost:5000`.

### 3. Optical Drive Permissions on Linux
Ensure the user running Docker belongs to the `cdrom` group:
```bash
sudo usermod -aG cdrom $USER
```

---

## ❓ Troubleshooting FAQ

### "File cannot be loaded because running scripts is disabled on this system"
Run this command in PowerShell before executing scripts:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### Can I run the video player without starting the Python server?
Yes! The **Episode Mapping & Player** tab has a **"Load Local Video File"** button where you can select any `.mkv` or `.mp4` file directly from your computer, or use the built-in animated canvas preview.
