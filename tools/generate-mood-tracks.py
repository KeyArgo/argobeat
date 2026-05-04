#!/usr/bin/env python3
"""
Generate 2 MiniMax music tracks per ArgoBeat mood (10 tracks total).
Outputs to apps/web/public/audio/music/shared/ + provenance JSON.

Usage:
  export MINIMAX_API_KEY=sk-api-...
  python3 tools/generate-mood-tracks.py
  python3 tools/generate-mood-tracks.py --moods meditate sleep   # specific moods only
  python3 tools/generate-mood-tracks.py --dry-run                # print prompts, don't call API
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

import requests

API_URL = "https://api.minimax.io/v1/music_generation"

WORKTREE = Path(__file__).resolve().parents[1]
MUSIC_DIR = WORKTREE / "apps/web/public/audio/music/shared"
PROV_DIR = WORKTREE / "apps/web/public/audio/music/provenance"

# ---------------------------------------------------------------------------
# Track definitions — 2 per mood
# ---------------------------------------------------------------------------
TRACKS = [
    # ── Focus (beta 12–18 Hz) ───────────────────────────────────────────────
    dict(
        slug="ember-focus-ii",
        title="Ember Focus II",
        mood="focus",
        prompt=(
            "Lo-fi hip hop instrumental, 88 BPM, warm Rhodes piano, mellow guitar chords, "
            "light vinyl crackle, soft kick and hi-hat, steady groove for concentration, "
            "no vocals, no lyrics, no melody arc, loops seamlessly"
        ),
    ),
    dict(
        slug="signal-clear",
        title="Signal Clear",
        mood="focus",
        prompt=(
            "Minimal ambient electronic, 92 BPM, clean arpeggiated synth in D minor, "
            "subtle bass drone, light percussion, modern study music, bright but not harsh, "
            "instrumental only, loopable"
        ),
    ),
    # ── Deep Work (beta 16–20 Hz) ───────────────────────────────────────────
    dict(
        slug="deep-current-ii",
        title="Deep Current II",
        mood="deepWork",
        prompt=(
            "Dark ambient electronic, evolving synth pads, low sub drone, slight atmospheric tension, "
            "95 BPM, no percussion, no vocals, sustained immersion, engineered for long creative sessions, "
            "cinematic and serious, instrumental"
        ),
    ),
    dict(
        slug="late-session",
        title="Late Session",
        mood="deepWork",
        prompt=(
            "Post-rock ambient instrumental, slow build, clean reverb guitar arpeggios, "
            "muted bass, brooding pads, 88 BPM, no lyrics, coffee-shop darkness, "
            "deep concentration, seamless loop"
        ),
    ),
    # ── Relax (alpha 8–12 Hz) ───────────────────────────────────────────────
    dict(
        slug="afternoon-open",
        title="Afternoon Open",
        mood="relax",
        prompt=(
            "Gentle acoustic ambient, fingerpicked nylon string guitar, soft piano accents, "
            "warm reverb, afternoon light, 68 BPM, relaxed and unhurried, "
            "no vocals, minimal percussion, loopable"
        ),
    ),
    dict(
        slug="drift-easy",
        title="Drift Easy",
        mood="relax",
        prompt=(
            "Chillwave ambient, dreamy analog synthesizers, slow tempo 64 BPM, "
            "ocean reverb tail, warm pads, laid-back, slightly nostalgic, "
            "no lyrics, no hard beats, loopable"
        ),
    ),
    # ── Meditate (theta 4–7 Hz) ─────────────────────────────────────────────
    dict(
        slug="gong-horizon",
        title="Gong Horizon",
        mood="meditate",
        prompt=(
            "Tibetan gong meditation music, deep resonant gong strikes with long decay, "
            "Himalayan singing bowl overtones, sparse low piano tones, "
            "432 Hz tuning, long silence between strikes, pure stillness, "
            "no melody, no rhythm, no vocals, ceremonial and grounding"
        ),
    ),
    dict(
        slug="bowl-breath",
        title="Bowl Breath",
        mood="meditate",
        prompt=(
            "Singing bowl drone meditation, sustained crystal bowl harmonics, "
            "deep cello drone underneath, wind harmonics, minimal, "
            "spacious and still, theta brainwave entrainment support, "
            "no percussion, no melody arc, loopable, deeply calming"
        ),
    ),
    # ── Sleep (delta 0.5–3.5 Hz) ────────────────────────────────────────────
    dict(
        slug="still-water",
        title="Still Water",
        mood="sleep",
        prompt=(
            "Ultra-soft sleep music, single piano notes with very long sustain and decay, "
            "50 BPM, deep silence between notes, no melody progression, "
            "pure calm, no dynamics, lullaby texture, "
            "no percussion, no bass, no vocals, for sleep onset"
        ),
    ),
    dict(
        slug="quiet-field",
        title="Quiet Field",
        mood="sleep",
        prompt=(
            "Sleep ambient drone, soft sustained pad chord, barely audible, "
            "extremely slow evolution, delta wave support, "
            "completely still, no percussion, no melody, no vocals, "
            "whisper-quiet, designed to fade into sleep"
        ),
    ),
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def require_key() -> str:
    key = os.getenv("MINIMAX_API_KEY")
    if not key:
        sys.exit("Missing MINIMAX_API_KEY in environment. Set it or source .env first.")
    return key


def generate_track(prompt: str, key: str) -> bytes:
    payload = {
        "model": "music-2.6-free",
        "prompt": prompt,
        "output_format": "hex",
        "lyrics_optimizer": False,
        "is_instrumental": True,
        "aigc_watermark": False,
        "audio_setting": {
            "sample_rate": 44100,
            "bitrate": 256000,
            "format": "mp3",
        },
    }
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    resp = requests.post(API_URL, headers=headers, json=payload, timeout=1800)
    resp.raise_for_status()
    data = resp.json()
    hex_audio = (data.get("data") or {}).get("audio", "")
    if not hex_audio:
        raise RuntimeError(f"No audio in response: {json.dumps(data)[:400]}")
    trace_id = (data.get("base_resp") or {}).get("request_id") or data.get("trace_id", "")
    return bytes.fromhex(hex_audio), trace_id, data


def write_provenance(slug: str, mood: str, title: str, audio_path: Path, trace_id: str, prompt: str) -> None:
    stat = audio_path.stat()
    sha = hashlib.sha256(audio_path.read_bytes()).hexdigest()

    # Get duration via ffprobe if available
    duration_ms = 0
    try:
        import subprocess
        r = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "json", str(audio_path)],
            capture_output=True, text=True
        )
        duration_ms = int(float(json.loads(r.stdout)["format"]["duration"]) * 1000)
    except Exception:
        pass

    prov = {
        "provider": "MiniMax",
        "model": "music-2.6-free",
        "slug": slug,
        "title": title,
        "mood": mood,
        "prompt": prompt,
        "audio_src": f"/audio/music/shared/{slug}.mp3",
        "provenance_src": f"/audio/music/provenance/{slug}.json",
        "trace_id": trace_id,
        "duration_ms": duration_ms,
        "sample_rate": 44100,
        "bitrate": 256000,
        "bytes": stat.st_size,
        "sha256": sha,
        "generated_at": datetime.now(UTC).isoformat(),
    }
    prov_path = PROV_DIR / f"{slug}.json"
    prov_path.write_text(json.dumps(prov, indent=2) + "\n")
    print(f"  provenance → {prov_path.name}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--moods", nargs="*", help="Only generate for these moods")
    parser.add_argument("--dry-run", action="store_true", help="Print prompts only, don't call API")
    parser.add_argument("--skip-existing", action="store_true", default=True,
                        help="Skip tracks whose MP3 already exists (default: true)")
    args = parser.parse_args()

    MUSIC_DIR.mkdir(parents=True, exist_ok=True)
    PROV_DIR.mkdir(parents=True, exist_ok=True)

    tracks = TRACKS
    if args.moods:
        tracks = [t for t in TRACKS if t["mood"] in args.moods]
        if not tracks:
            sys.exit(f"No tracks match moods: {args.moods}")

    if args.dry_run:
        for t in tracks:
            print(f"\n[{t['mood']}] {t['title']} ({t['slug']})")
            print(f"  {t['prompt']}")
        return

    key = require_key()
    total = len(tracks)

    for i, track in enumerate(tracks, 1):
        slug = track["slug"]
        out_path = MUSIC_DIR / f"{slug}.mp3"

        print(f"\n[{i}/{total}] {track['title']} ({track['mood']})")

        if args.skip_existing and out_path.exists():
            print(f"  SKIP — already exists: {out_path.name}")
            continue

        print(f"  Generating via MiniMax…")
        t0 = time.time()
        try:
            audio_bytes, trace_id, raw = generate_track(track["prompt"], key)
        except Exception as e:
            print(f"  ERROR: {e}")
            continue

        elapsed = round(time.time() - t0, 1)
        out_path.write_bytes(audio_bytes)
        size_mb = out_path.stat().st_size / 1024 / 1024
        print(f"  OK: {size_mb:.1f}MB in {elapsed}s  trace={trace_id}")

        write_provenance(slug, track["mood"], track["title"], out_path, trace_id, track["prompt"])

        # Brief pause between API calls
        if i < total:
            time.sleep(2)

    print(f"\n=== Done. {total} tracks processed. ===")
    print(f"Add new slugs to MUSIC_TRACKS in audio-manifest.ts to wire them into the engine.")


if __name__ == "__main__":
    main()
