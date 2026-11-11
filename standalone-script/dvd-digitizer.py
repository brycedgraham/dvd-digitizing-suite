import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

HANDBRAKE_PATHS = [
    r"C:\Program Files\HandBrake\HandBrakeCLI.exe",
    r"C:\Tools\HandBrakeCLI.exe",
]
MAKEMKV_PATHS = [
    r"C:\Program Files (x86)\MakeMKV\makemkvcon64.exe",
    r"C:\Program Files (x86)\MakeMKV\makemkvcon.exe",
]


def find_tool(name: str, default_paths: list[str]) -> str:
    path = shutil.which(name)
    if path:
        return path
    for p in default_paths:
        if os.path.isfile(p):
            return p
    return ""


handbrake_bin = find_tool("HandBrakeCLI.exe", HANDBRAKE_PATHS)
makemkv_bin = find_tool("makemkvcon64.exe", MAKEMKV_PATHS) or find_tool(
    "makemkvcon.exe", MAKEMKV_PATHS
)


def draw_progress_bar(
    prefix: str, percent: float, suffix: str = "", bar_len: int = 28
) -> None:
    """Render a clean single-line terminal progress bar."""
    percent = max(0.0, min(100.0, percent))
    filled = int(round(bar_len * percent / 100.0))
    bar = "█" * filled + "░" * (bar_len - filled)
    line = f"\r  {prefix} |{bar}| {percent:5.1f}% {suffix}"
    # Pad with spaces to overwrite any leftover characters from longer previous lines
    sys.stdout.write(f"{line:<95}")
    sys.stdout.flush()


def ask_choice(
    prompt: str, options: list[str], default: int = 0, hint: str = ""
) -> int:
    print(f"\n{prompt}")
    if hint:
        for line in hint.splitlines():
            print(f"  [Tip] {line}")
        print()
    for idx, opt in enumerate(options, 1):
        marker = " (Default)" if idx - 1 == default else ""
        print(f"  [{idx}] {opt}{marker}")
    while True:
        choice = input(
            f"Select [1-{len(options)}] (Enter for {default + 1}): "
        ).strip()
        if not choice:
            return default
        if choice.isdigit() and 1 <= int(choice) <= len(options):
            return int(choice) - 1
        print("Invalid selection. Try again.")


def get_optical_drives() -> list[str]:
    try:
        cmd = [
            "powershell",
            "-NoProfile",
            "-Command",
            "Get-CimInstance Win32_CDROMDrive | Select-Object -ExpandProperty Drive",
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return [d.strip() for d in res.stdout.splitlines() if d.strip()]
    except Exception:
        return []


def rip_disc(
    drive_letter: str,
    output_folder: Path,
    title_name: str,
    rip_all: bool = False,
) -> list[Path]:
    """Run makemkvcon in robot mode (-r) and parse PRGV progress lines."""
    if not makemkv_bin:
        sys.exit(
            "Error: MakeMKV (makemkvcon) not found. Please install MakeMKV."
        )

    job_folder = output_folder / title_name
    job_folder.mkdir(parents=True, exist_ok=True)

    target_mode = "all" if rip_all else "largest"
    min_len = "600"

    print(f"\n--- Ripping Disc ({target_mode.upper()}) from {drive_letter} ---")

    # -r enables robot output; --progress=-same routes progress to stdout
    rip_cmd = [
        makemkv_bin,
        "-r",
        "--progress=-same",
        "mkv",
        f"dev:{drive_letter}",
        target_mode,
        str(job_folder),
        f"--minlength={min_len}",
    ]

    current_stage = "Initializing Drive"
    proc = subprocess.Popen(
        rip_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
    )

    if proc.stdout:
        for line in proc.stdout:
            line = line.strip()
            # PRGC:code,id,"Operation Name"
            if line.startswith("PRGC:") or line.startswith("PRGT:"):
                parts = line.split('"')
                if len(parts) >= 2:
                    current_stage = parts[1][:26]
            # PRGV:current,total,max (max is 65536)
            elif line.startswith("PRGV:"):
                try:
                    nums = line[5:].split(",")
                    current_val = int(nums[0])
                    total_val = int(nums[1])
                    max_val = int(nums[2])
                    if max_val > 0:
                        overall_pct = (total_val / max_val) * 100.0
                        task_pct = (current_val / max_val) * 100.0
                        draw_progress_bar(
                            "MakeMKV Rip",
                            overall_pct,
                            f"[{current_stage}: {task_pct:4.0f}%]",
                        )
                except (ValueError, IndexError):
                    pass

    proc.wait()
    draw_progress_bar("MakeMKV Rip", 100.0, "[Done]")
    print()

    if proc.returncode != 0:
        sys.exit(f"MakeMKV exited with error code {proc.returncode}.")

    created_mkvs = sorted(list(job_folder.glob("*.mkv")))
    if not created_mkvs:
        sys.exit("MakeMKV finished, but no .mkv files met the minimum length.")

    if not rip_all:
        largest = max(created_mkvs, key=lambda f: f.stat().st_size)
        return [largest]

    print(f"  Ripped {len(created_mkvs)} title(s) successfully.")
    return created_mkvs


def run_handbrake_with_progress(hb_cmd: list[str], label: str) -> None:
    """Run HandBrakeCLI and parse carriage-return progress lines into a clean bar."""
    re_encode = re.compile(
        r"Encoding: task (\d+ of \d+), (\d+\.\d+) %(?: \(([\d\.]+) fps, avg ([\d\.]+) fps, ETA ([\dhms]+)\))?"
    )
    re_scan = re.compile(
        r"Scanning title (\d+ of \d+), (\d+\.\d+) %(?:.*ETA ([\dhms]+))?"
    )

    proc = subprocess.Popen(
        hb_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )

    buffer = bytearray()
    if proc.stdout:
        while True:
            chunk = proc.stdout.read(128)
            if not chunk:
                break
            buffer.extend(chunk)
            # HandBrake uses \r for live updates and \n for log messages
            while b"\r" in buffer or b"\n" in buffer:
                idx_r = buffer.find(b"\r")
                idx_n = buffer.find(b"\n")
                if idx_r != -1 and (idx_n == -1 or idx_r < idx_n):
                    split_idx = idx_r
                else:
                    split_idx = idx_n

                raw_line = buffer[:split_idx].decode("utf-8", errors="replace")
                del buffer[: split_idx + 1]

                m_enc = re_encode.search(raw_line)
                if m_enc:
                    task_str, pct_str, fps, avg_fps, eta = m_enc.groups()
                    pct = float(pct_str)
                    stats = (
                        f"({avg_fps} fps | ETA {eta})"
                        if avg_fps and eta
                        else f"(Task {task_str})"
                    )
                    draw_progress_bar(label, pct, stats)
                    continue

                m_scan = re_scan.search(raw_line)
                if m_scan:
                    _, pct_str, eta = m_scan.groups()
                    pct = float(pct_str)
                    eta_str = f"ETA {eta}" if eta else "Scanning..."
                    draw_progress_bar("Subtitle Scan", pct, f"({eta_str})")

    proc.wait()
    if proc.returncode != 0:
        print()
        sys.exit(f"Error: HandBrakeCLI failed with exit code {proc.returncode}")

    draw_progress_bar(label, 100.0, "(Complete!)")
    print()


def main():
    # Enable ANSI escape sequences on Windows 10/11 console
    os.system("")

    print("=" * 72)
    print("  Universal Media Digitizer & HandBrake Wizard")
    print("=" * 72)

    if not handbrake_bin:
        sys.exit(
            "Error: HandBrakeCLI.exe not found in PATH or C:\\Program Files\\HandBrake."
        )

    # 1. Source Selection
    drives = get_optical_drives()
    source_options = [
        "Single existing video file (.mkv, .mp4, etc.)",
        "Folder of existing video files (Batch encode directory)",
    ]
    for d in drives:
        source_options.append(f"Physical Disc - Single Movie ({d})")
        source_options.append(
            f"Physical Disc - TV Show / Multi-Special Disc ({d})"
        )

    src_idx = ask_choice("1. Select Media Source:", source_options, default=0)

    title_input = input(
        "\nEnter Movie or Show Title (e.g., 'The Hunt for Red October (1990)'): "
    ).strip()
    safe_title = (
        "".join(c for c in title_input if c not in r'\/:*?"<>|')
        or "Encoded_Media"
    )

    is_raw_rip = False
    input_files: list[Path] = []

    if src_idx == 0:
        raw_path = input("Enter full path to source video file: ").strip('"')
        p = Path(raw_path)
        if not p.is_file():
            sys.exit(f"Error: File not found at {p}")
        input_files = [p]
    elif src_idx == 1:
        raw_dir = input(
            "Enter full path to folder containing .mkv/.mp4 files: "
        ).strip('"')
        p = Path(raw_dir)
        if not p.is_dir():
            sys.exit(f"Error: Directory not found at {p}")
        input_files = sorted(list(p.glob("*.mkv")) + list(p.glob("*.mp4")))
        if not input_files:
            sys.exit("No .mkv or .mp4 files found in that directory.")
    else:
        drive_offset = (src_idx - 2) // 2
        rip_all_titles = (src_idx - 2) % 2 == 1
        selected_drive = drives[drive_offset]
        raw_dir = Path.home() / "Videos" / "Raw_Rips"
        input_files = rip_disc(
            selected_drive, raw_dir, safe_title, rip_all=rip_all_titles
        )
        is_raw_rip = True

    output_dir = Path.home() / "Videos" / "Encoded"
    if len(input_files) > 1:
        output_dir = output_dir / safe_title
    output_dir.mkdir(parents=True, exist_ok=True)

    # 2. Content Type
    content_idx = ask_choice(
        "2. What type of content is this?",
        [
            "Live Action - Modern / Clean (Sharp digital or clean 35mm film)",
            "Live Action - Classic / Grainy (70s-90s film like Red October, Predator, heavy grain)",
            "2D Traditional Animation (Charlie Brown, classic cartoons, Anime)",
            "3D CGI Animation (Pixar, DreamWorks, smooth gradients)",
        ],
        default=0,
    )

    # 3. Deinterlacing
    deint_idx = ask_choice(
        "3. Deinterlacing / Frame Reconstruction:",
        [
            "Auto-Detect & Fix (Recommended for all DVDs: detelecine + comb-detect)",
            "Progressive Only (Clean Blu-ray/digital source, disable filters)",
            "Force Decomb (Stubborn interlaced TV/home video DVDs)",
        ],
        default=0,
    )

    # 4. Encoder Engine with Dynamic Advice
    encoder_hint = (
        "GPU (NVENC) is 10x-20x faster (~2 mins per DVD), ideal for TV seasons, 3D CGI, & general rips.\n"
        "CPU (x265/AV1) takes ~20-40 mins, but produces 15-25% smaller files and preserves\n"
        "heavy 80s/90s film grain, dark shadow gradients, and 2D cartoon outlines much better."
    )
    recommended_encoder = 2 if content_idx in (1, 2) else 0

    codec_idx = ask_choice(
        "4. Select Video Encoder (GPU vs CPU):",
        [
            "NVIDIA NVENC H.265 10-bit (GPU) - Blazing fast (~500+ fps), slightly larger files",
            "NVIDIA NVENC H.264 (GPU)        - Blazing fast, maximum legacy device compatibility",
            "CPU x265 10-bit (Software)      - Slower, best for Film Grain & 2D Animation (--tune)",
            "CPU SVT-AV1 10-bit (Software)   - Slower, highest modern compression + grain synthesis",
        ],
        default=recommended_encoder,
        hint=encoder_hint,
    )

    # 5. Subtitle & Foreign Dialogue Strategy
    sub_hint = (
        "Movies like 'The Hunt for Red October' use Forced Subtitles for Russian dialogue.\n"
        "'Foreign Audio Scan' automatically detects tracks that only appear during foreign speech."
    )
    sub_idx = ask_choice(
        "5. Subtitle & Foreign Dialogue Handling:",
        [
            "Auto-Detect Foreign Dialogue (Burn-In) + Keep All Subtitles (Best for Red October!)",
            "Auto-Detect Foreign Dialogue (Soft Flag Only) + Keep All Subtitles (Never touches pixels)",
            "Keep All Subtitle Tracks (No foreign scan pass - faster start, good for English-only films)",
            "English Subtitles Only (Strip extra international subtitle tracks)",
        ],
        default=0,
        hint=sub_hint,
    )

    # 6. Quality Tier
    quality_idx = ask_choice(
        "6. Select Target Quality:",
        [
            "Archival / Transparent (Larger file, near-lossless visual quality)",
            "Balanced (Recommended sweet spot for media servers)",
            "Space Saver (Smaller file size)",
        ],
        default=1,
    )

    # --- Configure Encoder Parameters ---
    encoder_map = {
        0: "nvenc_h265_10bit",
        1: "nvenc_h264",
        2: "x265_10bit",
        3: "svt_av1_10bit",
    }
    selected_encoder = encoder_map[codec_idx]
    is_nvenc = selected_encoder.startswith("nvenc")

    base_q = {
        "nvenc_h265_10bit": [19, 21, 24],
        "nvenc_h264": [18, 20, 23],
        "x265_10bit": [19, 21, 24],
        "svt_av1_10bit": [22, 25, 29],
    }[selected_encoder][quality_idx]

    extra_args = []

    if is_nvenc:
        preset = "slowest"
        encopts = ["spatial-aq=1:temporal-aq=1:rc-lookahead=32"]
        if content_idx == 1:
            base_q += 1
            encopts.append("aq-strength=6")
        elif content_idx in (2, 3):
            base_q -= 1
            encopts.append("aq-strength=12")
        extra_args = ["--encopts", ":".join(encopts)]
    else:
        preset = "5" if "svt_av1" in selected_encoder else "slow"
        if content_idx == 1:
            base_q += 1
            extra_args = (
                ["--encopts", "tune=0:film-grain=12"]
                if "svt_av1" in selected_encoder
                else ["--tune", "grain"]
            )
        elif content_idx == 2:
            base_q -= 1
            extra_args = (
                ["--encopts", "tune=0"]
                if "svt_av1" in selected_encoder
                else ["--tune", "animation"]
            )
        elif content_idx == 3:
            base_q -= 1
            if "svt_av1" in selected_encoder:
                extra_args = ["--encopts", "tune=0"]

    deint_flags = []
    if deint_idx == 0:
        deint_flags = ["--detelecine", "--comb-detect", "--decomb"]
    elif deint_idx == 2:
        deint_flags = ["--decomb"]

    if sub_idx == 0:
        sub_flags = [
            "--subtitle",
            "scan,1,2,3,4,5,6,7,8,9,10",
            "--subtitle-forced=1",
            "--subtitle-burned=scan",
        ]
    elif sub_idx == 1:
        sub_flags = [
            "--subtitle",
            "scan,1,2,3,4,5,6,7,8,9,10",
            "--subtitle-forced=1",
            "--subtitle-default=scan",
        ]
    elif sub_idx == 2:
        sub_flags = ["--all-subtitles"]
    else:
        sub_flags = ["--subtitle-lang-list", "eng", "--all-subtitles"]

    # Summary Confirmation
    print("\n" + "=" * 72)
    print(f"  Batch Title:   {safe_title} ({len(input_files)} file(s) queued)")
    print(f"  Output Folder: {output_dir}")
    print(
        f"  Encoder:       {selected_encoder} @ CQ/CRF {base_q} (Preset: {preset})"
    )
    print(
        f"  Extra Tuning:  {' '.join(extra_args) if extra_args else 'Default'}"
    )
    print(f"  Deinterlace:   {' '.join(deint_flags) if deint_flags else 'Off'}")
    print(f"  Subtitles:     {' '.join(sub_flags)}")
    print("=" * 72)

    if input("\nStart encoding queue? [Y/n]: ").strip().lower() not in (
        "",
        "y",
        "yes",
    ):
        sys.exit("Aborted by user.")

    # Process Queue
    for idx, in_file in enumerate(input_files, 1):
        if len(input_files) == 1:
            out_file = output_dir / f"{safe_title}.mkv"
        else:
            out_file = output_dir / f"{safe_title} - Part {idx:02d}.mkv"

        print(f"\n[{idx}/{len(input_files)}] Target: {out_file.name}")

        hb_cmd = (
            [
                handbrake_bin,
                "-i",
                str(in_file),
                "-o",
                str(out_file),
                "-f",
                "av_mkv",
                "-e",
                selected_encoder,
                "-q",
                str(base_q),
                "--preset",
                preset,
                "--all-audio",
                "--aencoder",
                "copy",
            ]
            + sub_flags
            + extra_args
            + deint_flags
        )

        run_handbrake_with_progress(hb_cmd, label="Encoding")

    print(
        f"\nAll {len(input_files)} file(s) encoded successfully to:\n  {output_dir}"
    )

    if is_raw_rip:
        cleanup = (
            input("\nDelete temporary raw MakeMKV files? [y/N]: ")
            .strip()
            .lower()
        )
        if cleanup in ("y", "yes"):
            shutil.rmtree(input_files[0].parent)
            print("Temporary raw rips deleted.")


if __name__ == "__main__":
    main()