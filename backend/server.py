#!/usr/bin/env python3
"""
NCIS DVD-to-Plex Local Automation Server
Zero-dependency Python 3 backend that interfaces with your Windows optical DVD drive,
MakeMKV CLI (makemkvcon64.exe), and HandBrakeCLI (HandBrakeCLI.exe).
Provides HTTP REST endpoints and HTTP Byte-Range video streaming for in-browser video verification.
"""

import os
import sys
import json
import time
import re
import string
import threading
import subprocess
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
try:
    from http.server import ThreadingHTTPServer as BaseHTTPServer
except ImportError:
    from socketserver import ThreadingMixIn
    class BaseHTTPServer(ThreadingMixIn, HTTPServer):  # type: ignore
        daemon_threads = True

from urllib.parse import urlparse, parse_qs

PORT = int(os.environ.get("PORT", "5000"))
HOST = os.environ.get("HOST", "0.0.0.0")

def is_client_disconnect(exc: Exception) -> bool:
    """Detect if an exception is an expected client disconnect (browser closed tab, refreshed, aborted fetch)."""
    if isinstance(exc, (ConnectionResetError, ConnectionAbortedError, BrokenPipeError)):
        return True
    if isinstance(exc, OSError):
        # 10053: WSAECONNABORTED, 10054: WSAECONNRESET on Windows; 32: EPIPE, 104: ECONNRESET on POSIX
        winerror = getattr(exc, "winerror", None)
        errno = getattr(exc, "errno", None)
        if winerror in (10053, 10054) or errno in (32, 104):
            return True
    return False

class RobustThreadingHTTPServer(BaseHTTPServer):
    """Multi-threaded HTTP server that cleanly handles concurrent requests and suppresses client abort stack traces."""
    daemon_threads = True
    allow_reuse_address = True

    def handle_error(self, request, client_address):
        """Suppress noisy tracebacks for expected client disconnects (tab closed, page reloaded, fetch aborted)."""
        exc_type, exc_value, _ = sys.exc_info()
        if exc_type is not None:
            if issubclass(exc_type, (ConnectionResetError, ConnectionAbortedError, BrokenPipeError)):
                return
            if issubclass(exc_type, OSError):
                winerror = getattr(exc_value, "winerror", None)
                errno = getattr(exc_value, "errno", None)
                if winerror in (10053, 10054) or errno in (32, 104):
                    return
        super().handle_error(request, client_address)

# Global pipeline state
STATE = {
    "status": "idle",  # idle, scanning, ripping, awaiting_mapping, transcoding, completed, error
    "stage": 0,        # 0 to 5
    "progress_percent": 0.0,
    "current_file": "",
    "current_episode": "",
    "eta_seconds": 0,
    "speed_fps": 0.0,
    "logs": [],
    "detected_tools": {
        "handbrake": None,
        "makemkv": None,
        "dvd_drives": []
    },
    "ripped_tracks": [],
    "error_message": None
}

STATE_LOCK = threading.Lock()

def add_log(message: str, level: str = "info"):
    with STATE_LOCK:
        timestamp = time.strftime("%H:%M:%S")
        entry = f"[{timestamp}] [{level.upper()}] {message}"
        print(entry)
        STATE["logs"].append(entry)
        if len(STATE["logs"]) > 200:
            STATE["logs"].pop(0)

def detect_optical_dvd_drives():
    """Detect optical CD/DVD drives on Windows, Linux, and Docker."""
    drives = []
    env_drive = os.environ.get("OPTICAL_DRIVE")
    if env_drive:
        drives.append(env_drive)

    if sys.platform == "win32":
        try:
            import ctypes
            bitmask = ctypes.windll.kernel32.GetLogicalDrives()
            for letter in string.ascii_uppercase:
                if bitmask & 1:
                    drive_path = f"{letter}:\\"
                    drive_type = ctypes.windll.kernel32.GetDriveTypeW(drive_path)
                    # DRIVE_CDROM = 5
                    if drive_type == 5:
                        drives.append(f"{letter}:")
                bitmask >>= 1
        except Exception as e:
            add_log(f"Drive detection fallback: {e}", "warn")
            if not drives:
                drives = ["D:"]
    else:
        # Linux / Docker container checks
        linux_candidates = ["/dev/sr0", "/dev/sr1", "/dev/cdrom", "/dev/dvd"]
        for dev in linux_candidates:
            if os.path.exists(dev) and dev not in drives:
                drives.append(dev)

        if not drives:
            drives = ["/dev/sr0"]

    return drives

def find_executable(name: str, standard_win_paths: list):
    """Locate CLI executable in PATH or standard Program Files locations."""
    # Check PATH first
    for path_dir in os.environ.get("PATH", "").split(os.pathsep):
        if not path_dir.strip():
            continue
        candidate = os.path.join(path_dir.strip(), name)
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate

    # Check known Windows locations
    for win_path in standard_win_paths:
        if not win_path:
            continue
        expanded = os.path.expandvars(win_path)
        if os.path.isfile(expanded):
            return expanded

    return None

def refresh_detected_tools(custom_handbrake: str = None):
    """Scan the system for HandBrakeCLI and MakeMKV with exhaustive Windows path coverage."""
    localappdata = os.environ.get("LOCALAPPDATA", r"C:\Users\Default\AppData\Local")
    userprofile = os.environ.get("USERPROFILE", r"C:\Users\Default")

    hb_paths = [
        custom_handbrake,
        os.environ.get("HANDBRAKE_CLI"),
        r"C:\Program Files\HandBrake\HandBrakeCLI.exe",
        r"C:\Program Files (x86)\HandBrake\HandBrakeCLI.exe",
        r"C:\HandBrake\HandBrakeCLI.exe",
        r"C:\HandBrakeCLI\HandBrakeCLI.exe",
        r"C:\Tools\HandBrakeCLI.exe",
        r"C:\ProgramData\chocolatey\bin\HandBrakeCLI.exe",
        os.path.join(localappdata, r"Programs\HandBrake\HandBrakeCLI.exe"),
        os.path.join(userprofile, r"scoop\shims\HandBrakeCLI.exe"),
    ]

    mkv_paths = [
        os.environ.get("MAKEMKV_CLI"),
        r"C:\Program Files (x86)\MakeMKV\makemkvcon64.exe",
        r"C:\Program Files\MakeMKV\makemkvcon64.exe",
        r"C:\Program Files (x86)\MakeMKV\makemkv.exe",
        r"C:\MakeMKV\makemkvcon64.exe",
        r"C:\ProgramData\chocolatey\bin\makemkvcon64.exe",
        os.path.join(userprofile, r"scoop\shims\makemkvcon64.exe"),
    ]

    # Search for winget package directory dynamically if on Windows
    winget_dir = os.path.join(localappdata, r"Microsoft\WinGet\Packages")
    if os.path.isdir(winget_dir):
        for root, _, files in os.walk(winget_dir):
            if "HandBrakeCLI.exe" in files:
                hb_paths.insert(0, os.path.join(root, "HandBrakeCLI.exe"))
            if "makemkvcon64.exe" in files:
                mkv_paths.insert(0, os.path.join(root, "makemkvcon64.exe"))

    hb_cli = find_executable("HandBrakeCLI.exe", [p for p in hb_paths if p]) or find_executable("HandBrakeCLI", []) or find_executable("handbrake-cli", [])
    mkv_cli = find_executable("makemkvcon64.exe", [p for p in mkv_paths if p]) or find_executable("makemkvcon", [])
    drives = detect_optical_dvd_drives()

    # Check if HandBrake GUI is present without CLI
    has_hb_gui = False
    gui_paths = [
        r"C:\Program Files\HandBrake\HandBrake.exe",
        r"C:\Program Files (x86)\HandBrake\HandBrake.exe",
    ]
    for gp in gui_paths:
        if os.path.isfile(gp):
            has_hb_gui = True
            break

    with STATE_LOCK:
        STATE["detected_tools"]["handbrake"] = hb_cli
        STATE["detected_tools"]["handbrake_gui_only"] = (not hb_cli and has_hb_gui)
        STATE["detected_tools"]["makemkv"] = mkv_cli
        STATE["detected_tools"]["dvd_drives"] = drives

    if hb_cli:
        add_log(f"Detected HandBrakeCLI: {hb_cli}")
    elif has_hb_gui:
        add_log("Detected HandBrake GUI (HandBrake.exe), but HandBrakeCLI.exe is missing! Run 'winget install HandBrake.HandBrake.CLI' to install the CLI.", "warn")
    else:
        add_log("HandBrakeCLI: NOT FOUND (Run 'winget install HandBrake.HandBrake.CLI' or install from handbrake.fr)", "warn")

    add_log(f"Detected MakeMKV: {mkv_cli or 'NOT FOUND'}")
    add_log(f"Detected Optical DVD drives: {', '.join(drives)}")
    return hb_cli

def resolve_scratch_dir(scratch_dir: str, season: int, disc: int) -> Path:
    """Intelligently resolve scratch directory without double-nesting NCIS_S01_D1."""
    p = Path(scratch_dir)
    target_tag = f"NCIS_S{season:02d}_D{disc}"

    # 1. If p itself ends with NCIS_S01_D1 or similar (case-insensitive)
    if p.name.upper() == target_tag.upper():
        # Check if a nested folder was previously created
        nested = p / target_tag
        if nested.is_dir() and len(list(nested.glob("*.mkv"))) > 0:
            return nested
        return p

    # 2. If subfolder exists
    sub = p / target_tag
    if sub.is_dir():
        doubly_nested = sub / target_tag
        if doubly_nested.is_dir() and len(list(doubly_nested.glob("*.mkv"))) > 0:
            return doubly_nested
        return sub

    # 3. If p has .mkv files directly
    if p.is_dir() and len(list(p.glob("*.mkv"))) > 0:
        return p

    return sub

def resolve_source_file(input_file: str, scratch_path: Path, filename: str = None, idx: int = 0):
    """Resolve the source MKV file to an absolute existing file path on disk."""
    if input_file and os.path.isfile(input_file):
        return os.path.abspath(input_file)

    name_candidates = []
    if filename:
        name_candidates.append(filename)
    if input_file:
        name_candidates.append(Path(input_file).name)
    name_candidates.extend([
        f"title_t{idx:02d}.mkv",
        f"title_t0{idx}.mkv",
        f"title_{idx:02d}.mkv",
        f"title{idx:02d}.mkv",
    ])

    search_dirs = [scratch_path]
    if scratch_path.parent != scratch_path:
        search_dirs.append(scratch_path.parent)

    # Check subdirectories of scratch_path
    if scratch_path.is_dir():
        for item in scratch_path.iterdir():
            if item.is_dir():
                search_dirs.append(item)

    for s_dir in search_dirs:
        if not s_dir.is_dir():
            continue
        for name in name_candidates:
            candidate = s_dir / name
            if candidate.is_file() and candidate.stat().st_size > 5 * 1024 * 1024:
                return str(candidate.resolve())

    # Fallback: find any non-empty MKV by order
    if scratch_path.is_dir():
        all_mkvs = sorted([f for f in scratch_path.glob("*.mkv") if f.is_file() and f.stat().st_size > 5 * 1024 * 1024])
        if idx < len(all_mkvs):
            return str(all_mkvs[idx].resolve())

    return None

class NCISAutomationHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def handle(self):
        """Handle request while cleanly catching abrupt client disconnects (tab closed, reload)."""
        try:
            super().handle()
        except Exception as e:
            if is_client_disconnect(e):
                self.close_connection = True
            else:
                raise

    def safe_write(self, data: bytes) -> bool:
        """Safely write binary data to client socket, gracefully ignoring socket abortions."""
        try:
            self.wfile.write(data)
            self.wfile.flush()
            return True
        except Exception as e:
            if is_client_disconnect(e):
                self.close_connection = True
                return False
            raise

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Range")
        self.send_header("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length")

    def do_OPTIONS(self):
        try:
            self.send_response(200)
            self.send_cors_headers()
            self.end_headers()
        except Exception as e:
            if is_client_disconnect(e):
                self.close_connection = True
            else:
                raise

    def do_GET(self):
        try:
            parsed = urlparse(self.path)
            path = parsed.path
            query = parse_qs(parsed.query)

            # Health & System Status
            if path == "/api/status":
                with STATE_LOCK:
                    data = json.dumps(STATE).encode("utf-8")
                self.send_response(200)
                self.send_cors_headers()
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.safe_write(data)
                return

            # Target Folder File Inspector (Idempotency check)
            elif path == "/api/inspect":
                scratch_dir = query.get("scratch_dir", ["C:\\MakeMKV_Rips"])[0]
                plex_dir = query.get("plex_dir", ["P:\\Plex Media\\TV Shows"])[0]
                try:
                    season = int(query.get("season", [1])[0])
                    disc = int(query.get("disc", [1])[0])
                except (ValueError, TypeError):
                    season, disc = 1, 1

                info = self.inspect_target_folders(scratch_dir, plex_dir, season, disc)
                self.send_json_response(info)
                return

            # Video Streaming with HTTP Byte-Range support
            elif path == "/api/stream":
                file_param = query.get("file", [""])[0]
                if not file_param or not os.path.isfile(file_param):
                    self.send_response(404)
                    self.send_cors_headers()
                    self.end_headers()
                    self.safe_write(b"File not found")
                    return

                self.serve_video_range(file_param)
                return

            # Static Frontend Serving for Docker Single-Container Mode
            dist_dir = Path(__file__).resolve().parent.parent / "dist"
            if dist_dir.is_dir():
                target_file = dist_dir / (path.lstrip("/") or "index.html")
                if not target_file.is_file():
                    target_file = dist_dir / "index.html"

                if target_file.is_file():
                    ext = target_file.suffix.lower()
                    mimes = {
                        ".html": "text/html",
                        ".js": "application/javascript",
                        ".css": "text/css",
                        ".json": "application/json",
                        ".svg": "image/svg+xml",
                        ".png": "image/png",
                        ".ico": "image/x-icon",
                    }
                    ctype = mimes.get(ext, "application/octet-stream")
                    data = target_file.read_bytes()
                    self.send_response(200)
                    self.send_cors_headers()
                    self.send_header("Content-Type", ctype)
                    self.send_header("Content-Length", str(len(data)))
                    self.end_headers()
                    self.safe_write(data)
                    return

            # Default 404
            self.send_response(404)
            self.send_cors_headers()
            self.end_headers()
            self.safe_write(b"Not Found")
        except Exception as e:
            if is_client_disconnect(e):
                self.close_connection = True
            else:
                raise

    def do_POST(self):
        try:
            parsed = urlparse(self.path)
            path = parsed.path
            content_length = int(self.headers.get("Content-Length", 0))
            post_body = self.rfile.read(content_length) if content_length > 0 else b""
            payload = {}
            if post_body:
                try:
                    payload = json.loads(post_body.decode("utf-8"))
                except Exception:
                    pass

            if path == "/api/rip":
                # Start MakeMKV ripping task in background
                dvd_drive = payload.get("dvd_drive", "D:")
                scratch_dir = payload.get("scratch_dir", r"C:\MakeMKV_Rips\NCIS")
                season = int(payload.get("season", 1))
                disc = int(payload.get("disc", 1))
                force = bool(payload.get("force", False))

                threading.Thread(
                    target=self.run_makemkv_rip,
                    args=(dvd_drive, scratch_dir, season, disc, force),
                    daemon=True
                ).start()

                self.send_json_response({"status": "started", "message": "MakeMKV rip check started in background."})
                return

            elif path == "/api/transcode":
                # Start HandBrakeCLI batch transcode
                tracks = payload.get("tracks", [])
                plex_dir = payload.get("plex_dir", r"P:\Plex Media\TV Shows")
                scratch_dir = payload.get("scratch_dir", r"C:\MakeMKV_Rips")
                handbrake_path = payload.get("handbrake_path")
                season = int(payload.get("season", 1))
                disc = int(payload.get("disc", 1))
                rf_quality = int(payload.get("rf_quality", 19))
                codec = payload.get("codec", "x264")
                overwrite = bool(payload.get("overwrite", False))
                simulate = bool(payload.get("simulate", False))

                threading.Thread(
                    target=self.run_handbrake_transcode,
                    args=(tracks, plex_dir, scratch_dir, season, disc, rf_quality, codec, overwrite, handbrake_path, simulate),
                    daemon=True
                ).start()

                self.send_json_response({"status": "started", "message": "HandBrake transcode started in background."})
                return

            elif path == "/api/inspect":
                scratch_dir = payload.get("scratch_dir", r"C:\MakeMKV_Rips")
                plex_dir = payload.get("plex_dir", r"P:\Plex Media\TV Shows")
                season = int(payload.get("season", 1))
                disc = int(payload.get("disc", 1))
                info = self.inspect_target_folders(scratch_dir, plex_dir, season, disc)
                self.send_json_response(info)
                return

            elif path == "/api/reset":
                with STATE_LOCK:
                    STATE["status"] = "idle"
                    STATE["stage"] = 0
                    STATE["progress_percent"] = 0.0
                    STATE["error_message"] = None
                    STATE["ripped_tracks"] = []
                self.send_json_response({"status": "reset"})
                return

            self.send_response(404)
            self.send_cors_headers()
            self.end_headers()
        except Exception as e:
            if is_client_disconnect(e):
                self.close_connection = True
            else:
                raise

    def send_json_response(self, data: dict, status_code: int = 200):
        try:
            body = json.dumps(data).encode("utf-8")
            self.send_response(status_code)
            self.send_cors_headers()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.safe_write(body)
        except Exception as e:
            if is_client_disconnect(e):
                self.close_connection = True
            else:
                raise

    def serve_video_range(self, file_path: str):
        """Serve video files with HTTP 206 Partial Content support for smooth seeking."""
        file_size = os.path.getsize(file_path)
        range_header = self.headers.get("Range")

        # Determine mime type
        ext = os.path.splitext(file_path)[1].lower()
        content_type = "video/mp4" if ext in [".mp4", ".m4v"] else "video/x-matroska"

        if not range_header:
            # Stream entire file
            self.send_response(200)
            self.send_cors_headers()
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(file_size))
            self.send_header("Accept-Ranges", "bytes")
            self.end_headers()
            with open(file_path, "rb") as f:
                self.copy_file_range(f, self.wfile, 0, file_size - 1)
            return

        # Parse range header: e.g. "bytes=0-1024"
        match = re.match(r"bytes=(\d+)-(\d*)", range_header)
        if not match:
            self.send_response(416)
            self.send_cors_headers()
            self.send_header("Content-Range", f"bytes */{file_size}")
            self.end_headers()
            return

        start = int(match.group(1))
        end_str = match.group(2)
        end = int(end_str) if end_str else file_size - 1

        if start >= file_size or end >= file_size or start > end:
            self.send_response(416)
            self.send_cors_headers()
            self.send_header("Content-Range", f"bytes */{file_size}")
            self.end_headers()
            return

        chunk_size = end - start + 1
        self.send_response(206)
        self.send_cors_headers()
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
        self.send_header("Content-Length", str(chunk_size))
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()

        with open(file_path, "rb") as f:
            self.copy_file_range(f, self.wfile, start, end)

    def copy_file_range(self, in_file, out_file, start_pos, end_pos):
        in_file.seek(start_pos)
        bytes_left = end_pos - start_pos + 1
        buffer_size = 64 * 1024
        while bytes_left > 0:
            to_read = min(buffer_size, bytes_left)
            chunk = in_file.read(to_read)
            if not chunk:
                break
            try:
                out_file.write(chunk)
                out_file.flush()
            except Exception as e:
                if is_client_disconnect(e):
                    self.close_connection = True
                    break
                raise
            bytes_left -= len(chunk)



    def inspect_target_folders(self, scratch_dir: str, plex_dir: str, season: int, disc: int):
        """Inspect target scratch and Plex directories to report existing files for idempotent execution."""
        target_scratch = resolve_scratch_dir(scratch_dir, season, disc)
        target_plex = Path(plex_dir) / "NCIS (2003)" / f"Season {season:02d}"

        scratch_tracks = []
        if target_scratch.is_dir():
            for idx, f in enumerate(sorted(target_scratch.glob("*.mkv"))):
                if f.is_file():
                    size_mb = round(f.stat().st_size / (1024 * 1024))
                    scratch_tracks.append({
                        "filename": f.name,
                        "sourceFile": str(f.resolve()),
                        "fileSizeMb": size_mb,
                        "trackIndex": idx,
                        "isValid": size_mb >= 50
                    })

        plex_episodes = []
        if target_plex.is_dir():
            for f in sorted(list(target_plex.glob("*.mkv")) + list(target_plex.glob("*.mp4"))):
                if f.is_file():
                    size_mb = round(f.stat().st_size / (1024 * 1024))
                    plex_episodes.append({
                        "filename": f.name,
                        "targetFile": str(f.resolve()),
                        "fileSizeMb": size_mb,
                        "isValid": size_mb >= 25
                    })

        return {
            "season": season,
            "disc": disc,
            "scratch_dir": str(target_scratch),
            "scratch_exists": target_scratch.is_dir(),
            "scratch_tracks": scratch_tracks,
            "scratch_valid_count": len([t for t in scratch_tracks if t["isValid"]]),
            "plex_dir": str(target_plex),
            "plex_exists": target_plex.is_dir(),
            "plex_episodes": plex_episodes,
            "plex_valid_count": len([e for e in plex_episodes if e["isValid"]])
        }

    def run_makemkv_rip(self, dvd_drive: str, scratch_dir: str, season: int, disc: int, force: bool = False):
        with STATE_LOCK:
            STATE["status"] = "ripping"
            STATE["stage"] = 2
            STATE["progress_percent"] = 5.0
            STATE["error_message"] = None

        target_dir = resolve_scratch_dir(scratch_dir, season, disc)
        target_dir.mkdir(parents=True, exist_ok=True)
        add_log(f"Target scratch folder: {target_dir}")

        # Idempotency check: scan for existing non-empty ripped files (> 50MB)
        existing_mkv = sorted([
            f for f in target_dir.glob("*.mkv")
            if f.is_file() and f.stat().st_size > 50 * 1024 * 1024
        ])

        if existing_mkv and not force:
            add_log(f"[IDEMPOTENT] Found {len(existing_mkv)} valid ripped track(s) already in {target_dir}.")
            add_log(f"[IDEMPOTENT] Skipping optical disc read. Reusing existing lossless MKVs.")
            tracks_data = []
            for idx, f in enumerate(existing_mkv):
                size_mb = round(f.stat().st_size / (1024 * 1024))
                tracks_data.append({
                    "sourceFile": str(f.resolve()),
                    "filename": f.name,
                    "durationEstimate": "44:00",
                    "durationMinutes": 44.0,
                    "fileSizeMb": size_mb,
                    "trackIndex": idx
                })
            with STATE_LOCK:
                STATE["status"] = "awaiting_mapping"
                STATE["stage"] = 3
                STATE["progress_percent"] = 100.0
                STATE["ripped_tracks"] = tracks_data
            add_log(f"Loaded {len(tracks_data)} existing tracks! Ready for episode title verification.")
            return

        makemkv_bin = STATE["detected_tools"]["makemkv"]
        if not makemkv_bin:
            # Simulation / Demo fallback if MakeMKV is not installed
            add_log("MakeMKV executable not installed. Running simulated rip for demonstration...", "warn")
            for p in range(10, 101, 15):
                time.sleep(0.8)
                with STATE_LOCK:
                    STATE["progress_percent"] = float(p)
                add_log(f"Ripping optical disc streams: {p}%")

            # Generate mock track metadata and write placeholder files if target_dir exists
            mock_tracks = []
            for i in range(4):
                file_path = target_dir / f"title_t{i:02d}.mkv"
                if not file_path.exists():
                    try:
                        file_path.write_bytes(b"\x00" * 1024)
                    except Exception:
                        pass
                mock_tracks.append({
                    "sourceFile": str(file_path),
                    "filename": f"title_t{i:02d}.mkv",
                    "durationEstimate": "43:40",
                    "durationMinutes": 43.6,
                    "fileSizeMb": 1080 + (i * 25),
                    "trackIndex": i
                })

            with STATE_LOCK:
                STATE["status"] = "awaiting_mapping"
                STATE["stage"] = 3
                STATE["progress_percent"] = 100.0
                STATE["ripped_tracks"] = mock_tracks
            add_log(f"MakeMKV extracted 4 episode titles. Ready for episode mapping!")
            return

        # Execute real MakeMKV CLI command
        add_log(f"Starting MakeMKV rip from drive {dvd_drive} into {target_dir}")
        disc_target = f"dev:{dvd_drive}" if dvd_drive.startswith("/dev/") else "disc:0"
        cmd = [
            makemkv_bin,
            "-r",
            "mkv",
            disc_target,
            "all",
            str(target_dir),
            "--minlength=900"  # Filter out items under 15 mins (menu clips/intros)
        ]

        try:
            process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            for line in process.stdout:
                line_str = line.strip()
                if "PRGV:" in line_str:
                    # Parse progress PRGV:current,total,max
                    parts = line_str.replace("PRGV:", "").split(",")
                    if len(parts) >= 3 and int(parts[2]) > 0:
                        pct = (int(parts[0]) / int(parts[2])) * 100.0
                        with STATE_LOCK:
                            STATE["progress_percent"] = round(pct, 1)
                elif "Copy complete" in line_str or "Saving" in line_str:
                    add_log(line_str)

            process.wait()
            # Scan directory for generated files
            ripped_files = sorted(list(target_dir.glob("*.mkv")))
            tracks_data = []
            for idx, f in enumerate(ripped_files):
                size_mb = round(f.stat().st_size / (1024 * 1024))
                tracks_data.append({
                    "sourceFile": str(f),
                    "filename": f.name,
                    "durationEstimate": "44:00",
                    "durationMinutes": 44.0,
                    "fileSizeMb": size_mb,
                    "trackIndex": idx
                })

            with STATE_LOCK:
                STATE["status"] = "awaiting_mapping"
                STATE["stage"] = 3
                STATE["progress_percent"] = 100.0
                STATE["ripped_tracks"] = tracks_data
            add_log(f"MakeMKV finished successfully. Found {len(tracks_data)} ripped tracks.")

        except Exception as e:
            add_log(f"MakeMKV error: {e}", "error")
            with STATE_LOCK:
                STATE["status"] = "error"
                STATE["error_message"] = str(e)

    def run_handbrake_transcode(self, tracks: list, plex_dir: str, scratch_dir: str, season: int, disc: int, rf: int, codec: str, overwrite: bool = False, handbrake_path: str = None, simulate: bool = False):
        with STATE_LOCK:
            STATE["status"] = "transcoding"
            STATE["stage"] = 4
            STATE["progress_percent"] = 0.0
            STATE["error_message"] = None

        target_season_dir = Path(plex_dir) / "NCIS (2003)" / f"Season {season:02d}"
        try:
            target_season_dir.mkdir(parents=True, exist_ok=True)
            add_log(f"Target Plex library folder: {target_season_dir}")
        except Exception as e:
            add_log(f"[ERROR] Failed to access or create Plex destination folder '{target_season_dir}': {e}", "error")
            with STATE_LOCK:
                STATE["status"] = "error"
                STATE["error_message"] = f"Cannot write to Plex directory: {e}"
            return

        resolved_scratch = resolve_scratch_dir(scratch_dir, season, disc)
        add_log(f"Source scratch folder: {resolved_scratch}")

        # Ensure HandBrakeCLI is located
        hb_bin = STATE["detected_tools"].get("handbrake")
        if handbrake_path and os.path.isfile(handbrake_path):
            hb_bin = handbrake_path
        elif not hb_bin:
            hb_bin = refresh_detected_tools(handbrake_path)

        if not hb_bin and not simulate:
            has_gui = STATE["detected_tools"].get("handbrake_gui_only", False)
            if has_gui:
                add_log("[ERROR] HandBrake GUI is installed, but HandBrakeCLI.exe was not found!", "error")
                add_log("[FIX] HandBrake GUI does not include the CLI. Open PowerShell and run: winget install HandBrake.HandBrake.CLI", "error")
            else:
                add_log("[ERROR] HandBrakeCLI was not detected on this PC!", "error")
                add_log("[FIX] Install HandBrakeCLI via PowerShell: winget install HandBrake.HandBrake.CLI (or download from https://handbrake.fr/downloads.php)", "error")
            with STATE_LOCK:
                STATE["status"] = "error"
                STATE["error_message"] = "HandBrakeCLI.exe not found on system. Install via 'winget install HandBrake.HandBrake.CLI'"
            return

        encoder = "x265_10bit" if codec == "x265_10bit" else "x264"
        skipped_count = 0
        encoded_count = 0

        for idx, track in enumerate(tracks):
            # Resolve source input file on disk
            raw_input = track.get("sourceFile")
            raw_filename = track.get("filename")
            input_file = resolve_source_file(raw_input, resolved_scratch, raw_filename, idx)

            # Determine Plex output filename (prefer full canonical title with episode name)
            output_filename = track.get("targetPlexName")
            if not output_filename:
                matched_ep = track.get("matchedEpisode")
                if matched_ep and isinstance(matched_ep, dict):
                    ep_num = matched_ep.get("episode", idx + 1)
                    ep_title = matched_ep.get("title", f"Episode {ep_num}")
                    clean_title = re.sub(r'[\\/*?:"<>|]', "-", ep_title).strip()
                    output_filename = f"NCIS (2003) - S{season:02d}E{ep_num:02d} - {clean_title}.mkv"
                else:
                    output_filename = f"NCIS (2003) - S{season:02d}E{idx+1:02d}.mkv"

            output_file = str(target_season_dir / output_filename)

            with STATE_LOCK:
                STATE["current_file"] = output_filename
                STATE["current_episode"] = f"Track {idx+1}/{len(tracks)}: {output_filename}"

            # Idempotency check: check if destination file already exists and is non-empty (>25MB)
            if not overwrite and os.path.isfile(output_file):
                file_size = os.path.getsize(output_file)
                if file_size > 25 * 1024 * 1024:
                    size_mb = round(file_size / (1024 * 1024))
                    add_log(f"[IDEMPOTENT] [{idx+1}/{len(tracks)}] Already in Plex library: {output_filename} ({size_mb} MB). Skipping re-encode.")
                    skipped_count += 1
                    with STATE_LOCK:
                        overall_pct = ((idx + 1) / len(tracks)) * 100.0
                        STATE["progress_percent"] = round(overall_pct, 1)
                    continue

            # Verify input file exists
            if not input_file and not simulate:
                add_log(f"[ERROR] Source MKV file not found on disk for track {idx+1} ('{raw_input or raw_filename}')!", "error")
                add_log(f"[ERROR] Searched in: {resolved_scratch}. Please verify MakeMKV rip has completed.", "error")
                with STATE_LOCK:
                    STATE["status"] = "error"
                    STATE["error_message"] = f"Source MKV not found in {resolved_scratch} for {output_filename}"
                return

            add_log(f"[{idx+1}/{len(tracks)}] Encoding: {output_filename} with DVD Decomb (RF {rf})")
            if input_file:
                add_log(f"    Source: {input_file} ({round(os.path.getsize(input_file)/(1024*1024))} MB)")

            if simulate or not hb_bin:
                # Explicit simulation mode
                add_log(f"[SIMULATION ONLY - NO FILE CREATED] Simulating encode of {output_filename}...", "warn")
                for p in range(10, 101, 15):
                    time.sleep(0.5)
                    with STATE_LOCK:
                        overall = ((idx + (p / 100.0)) / len(tracks)) * 100.0
                        STATE["progress_percent"] = round(overall, 1)
                        STATE["speed_fps"] = 142.5
                add_log(f"[SIMULATION] Finished simulated pass for {output_filename} (No file written)")
                encoded_count += 1
                continue

            # Real HandBrakeCLI execution
            cmd = [
                hb_bin,
                "-i", input_file,
                "-o", output_file,
                "-e", encoder,
                "-q", str(rf),
                "--rate", "29.97",
                "--pfr",
                "--auto-anamorphic",
                "--comb-detect",
                "--decomb",
                "-a", "1,1",
                "-E", "copy:ac3,av_aac",
                "-B", "0,160",
                "-6", "0,dpl2",
                "--markers",
                "--optimize"
            ]

            try:
                proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, universal_newlines=True)
                last_hb_lines = []
                for line in proc.stdout:
                    line_str = line.strip()
                    last_hb_lines.append(line_str)
                    if len(last_hb_lines) > 20:
                        last_hb_lines.pop(0)

                    # Regex for HandBrake progress: e.g. 45.20 % (134.50 fps, avg 128.00 fps, ETA 00h02m14s)
                    m = re.search(r"(\d+\.\d+)\s*%", line_str)
                    if m:
                        track_pct = float(m.group(1))
                        overall_pct = ((idx + (track_pct / 100.0)) / len(tracks)) * 100.0
                        with STATE_LOCK:
                            STATE["progress_percent"] = round(overall_pct, 1)
                        # Extract fps
                        m_fps = re.search(r"([\d\.]+)\s*fps", line_str)
                        if m_fps:
                            with STATE_LOCK:
                                STATE["speed_fps"] = float(m_fps.group(1))

                proc.wait()
                if proc.returncode != 0:
                    add_log(f"[ERROR] HandBrakeCLI exited with code {proc.returncode} while encoding {output_filename}", "error")
                    for err_line in last_hb_lines[-6:]:
                        add_log(f"    HandBrake output: {err_line}", "error")
                    with STATE_LOCK:
                        STATE["status"] = "error"
                        STATE["error_message"] = f"HandBrakeCLI failed with exit code {proc.returncode} on {output_filename}"
                    return

                # Verify file was written to disk and has reasonable size (>10MB)
                if os.path.isfile(output_file) and os.path.getsize(output_file) > 10 * 1024 * 1024:
                    size_mb = round(os.path.getsize(output_file) / (1024 * 1024))
                    add_log(f"[SUCCESS] Transcoded & verified in Plex: {output_filename} ({size_mb} MB)")
                    encoded_count += 1
                else:
                    add_log(f"[ERROR] Output file missing or truncated: {output_file}", "error")
                    with STATE_LOCK:
                        STATE["status"] = "error"
                        STATE["error_message"] = f"Transcoded file was not created: {output_filename}"
                    return

            except Exception as e:
                add_log(f"Error encoding {output_filename}: {e}", "error")
                with STATE_LOCK:
                    STATE["status"] = "error"
                    STATE["error_message"] = str(e)
                return

        # Final verification: scan target_season_dir for real files
        verified_files = []
        if target_season_dir.is_dir():
            for vf in sorted(list(target_season_dir.glob("*.mkv")) + list(target_season_dir.glob("*.mp4"))):
                if vf.is_file() and vf.stat().st_size > 10 * 1024 * 1024:
                    verified_files.append(f"{vf.name} ({round(vf.stat().st_size / (1024*1024))} MB)")

        with STATE_LOCK:
            STATE["status"] = "completed"
            STATE["stage"] = 5
            STATE["progress_percent"] = 100.0

        if simulate:
            add_log("[SIMULATION COMPLETE] Simulated batch finished. To produce real video files, install HandBrakeCLI ('winget install HandBrake.HandBrake.CLI').", "warn")
        elif len(verified_files) > 0:
            add_log(f"[COMPLETED] {len(verified_files)} episode(s) ready in Plex library: {target_season_dir}")
            for vf_str in verified_files:
                add_log(f"  ✓ {vf_str}")
        else:
            add_log(f"[WARN] Encoding completed but no valid video files found in {target_season_dir}. Please review logs.", "warn")

def start_server():
    refresh_detected_tools()
    server = RobustThreadingHTTPServer((HOST, PORT), NCISAutomationHandler)
    print(f"\n=======================================================")
    print(f" NCIS DVD Automation Engine running at http://{HOST}:{PORT}")
    print(f" Connect your NCIS DVD-to-Plex Web Studio to localhost:{PORT}")
    print(f"=======================================================\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        server.server_close()

if __name__ == "__main__":
    start_server()
