#!/usr/bin/env python3
"""
ArgoBeat audio normalization tool.

Normalizes all soundscape and music files to consistent loudness targets:
  Soundscapes → -18 LUFS, TP=-1.5 dBTP
  Music       → -14 LUFS, TP=-1.0 dBTP

Dynamic files (fire, thunder, singing bowls) get light compression first
to tame transients before normalization.

Usage:
  python3 tools/normalize-audio.py              # normalize everything
  python3 tools/normalize-audio.py --music      # music only
  python3 tools/normalize-audio.py --soundscape # soundscapes only
  python3 tools/normalize-audio.py --check      # measure levels, no changes
  python3 tools/normalize-audio.py --upload     # normalize + upload to R2

See AUDIO-PIPELINE.md for full documentation.
"""
import argparse, os, shutil, subprocess, sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────────

ROOT    = Path(__file__).parent.parent
SC_DIR  = ROOT / "apps/web/public/audio/soundscapes"
MUS_DIR = ROOT / "apps/web/public/audio/music/shared"
BACKUP  = Path(f"/mnt/AllShare/Argobeat/sounds-originals-prenorm-{date.today().strftime('%Y%m%d')}")
R2_BUCKET = "argobeat-audio"

# ── Targets ──────────────────────────────────────────────────────────────────

SC_LUFS  = -18
SC_TP    = -1.5
MUS_LUFS = -14
MUS_TP   = -1.0

# Files with high dynamic range — compress before normalizing
DYNAMIC_FILES = {
    "fire/crackling-fire.mp3", "fire/inside-fireplace.mp3", "fire/campfire-bush.mp3",
    "thunder/thunder-straget.mp3",
    "gongs/singing-bowl-tibetan.mp3", "gongs/singing-bowl-eflat.mp3", "gongs/singing-bowl-deep.mp3",
    "rain/thunderstorm-rain-loop.mp3",
    "forest/forest-night-ambience.mp3", "forest/night-owls.mp3", "forest/forest-birds-branches.mp3",
}

# ── Helpers ──────────────────────────────────────────────────────────────────

def measure(f: Path) -> tuple[float | None, float | None]:
    r = subprocess.run(
        ["ffmpeg", "-i", str(f), "-af", "loudnorm=print_format=json", "-f", "null", "-"],
        capture_output=True, text=True
    )
    lufs = tp = None
    for line in r.stderr.splitlines():
        if '"input_i"' in line:
            lufs = float(line.split(":")[1].strip().strip('", '))
        if '"input_tp"' in line:
            tp = float(line.split(":")[1].strip().strip('", '))
    return lufs, tp


def backup_file(src: Path, base: Path):
    rel = src.relative_to(base)
    bk = BACKUP / base.name / rel
    bk.parent.mkdir(parents=True, exist_ok=True)
    if not bk.exists():
        shutil.copy2(src, bk)


def ffmpeg_normalize(src: Path, dst: Path, lufs: float, tp: float, compress: bool = False):
    af = (
        f"acompressor=threshold=-25dB:ratio=4:attack=5:release=300:makeup=6dB,"
        f"loudnorm=I={lufs}:TP={tp}:LRA=11:print_format=none"
        if compress else
        f"loudnorm=I={lufs}:TP={tp}:LRA=11:print_format=none"
    )
    r = subprocess.run([
        "ffmpeg", "-y", "-i", str(src),
        "-af", af,
        "-ar", "44100", "-ac", "2", "-codec:a", "libmp3lame", "-q:a", "2",
        str(dst),
    ], capture_output=True)
    return r.returncode == 0, r.stderr.decode(errors="ignore")[-200:]


def r2_upload(local: Path, key: str) -> bool:
    r = subprocess.run([
        "wrangler", "r2", "object", "put", f"{R2_BUCKET}/{key}",
        f"--file={local}", "--content-type=audio/mpeg", "--remote",
    ], capture_output=True, text=True)
    return "complete" in r.stdout.lower() or "complete" in r.stderr.lower()

# ── Tasks ────────────────────────────────────────────────────────────────────

def check_file(f: Path, target_lufs: float) -> str:
    lufs, tp = measure(f)
    if lufs is None:
        return "ERROR (could not measure)"
    delta = lufs - target_lufs
    status = "OK" if abs(delta) <= 2 else f"OFF by {delta:+.1f} dB"
    clip = " CLIPPING" if tp and tp > 0 else ""
    return f"{lufs:.1f} LUFS  tp={tp:.1f}{clip}  [{status}]"


def process_soundscape(f: Path, upload: bool) -> tuple[str, str]:
    rel = str(f.relative_to(SC_DIR))
    backup_file(f, SC_DIR)
    compress = rel in DYNAMIC_FILES
    tmp = f.with_suffix(".tmp.mp3")
    ok, err = ffmpeg_normalize(f, tmp, SC_LUFS, SC_TP, compress=compress)
    if not ok:
        return rel, f"FAIL: {err}"
    os.replace(tmp, f)
    if upload:
        r2_upload(f, f"soundscapes/{rel}")
    return rel, "OK" + (" [compressed]" if compress else "") + (" [uploaded]" if upload else "")


def process_music(f: Path, upload: bool) -> tuple[str, str]:
    name = f.name
    backup_file(f, MUS_DIR)
    tmp = f.with_suffix(".tmp.mp3")
    ok, err = ffmpeg_normalize(f, tmp, MUS_LUFS, MUS_TP)
    if not ok:
        return name, f"FAIL: {err}"
    os.replace(tmp, f)
    if upload:
        r2_upload(f, f"music/shared/{name}")
    return name, "OK" + (" [uploaded]" if upload else "")

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--music",      action="store_true", help="Process music only")
    ap.add_argument("--soundscape", action="store_true", help="Process soundscapes only")
    ap.add_argument("--check",      action="store_true", help="Measure only, no changes")
    ap.add_argument("--upload",     action="store_true", help="Upload to R2 after normalizing")
    ap.add_argument("--workers",    type=int, default=6, help="Parallel workers (default 6)")
    args = ap.parse_args()

    do_sc  = not args.music  or args.soundscape
    do_mus = not args.soundscape or args.music

    if args.check:
        print("=== SOUNDSCAPES (target -18 LUFS) ===")
        for f in sorted(SC_DIR.rglob("*.mp3")):
            print(f"  {f.relative_to(SC_DIR)}: {check_file(f, SC_LUFS)}")
        print("\n=== MUSIC (target -14 LUFS) ===")
        for f in sorted(MUS_DIR.glob("*.mp3")):
            print(f"  {f.name}: {check_file(f, MUS_LUFS)}")
        return

    print(f"Backups → {BACKUP}")
    if args.upload:
        print("Will upload to R2 after normalizing.")

    ok = fail = 0
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futs = {}
        if do_sc:
            for f in sorted(SC_DIR.rglob("*.mp3")):
                futs[pool.submit(process_soundscape, f, args.upload)] = "sc"
        if do_mus:
            for f in sorted(MUS_DIR.glob("*.mp3")):
                futs[pool.submit(process_music, f, args.upload)] = "mus"

        for fut in as_completed(futs):
            name, status = fut.result()
            if "FAIL" in status:
                fail += 1
                print(f"  ✗ {name}: {status}")
            else:
                ok += 1
                print(f"  ✓ {name}: {status}")

    print(f"\nDone: {ok} OK, {fail} failed")
    if fail:
        sys.exit(1)


if __name__ == "__main__":
    main()
