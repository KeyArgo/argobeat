#!/usr/bin/env python3
"""
Second batch — 3 additional MiniMax tracks per mood (15 total).
Run after generate-mood-tracks.py completes.
"""
from __future__ import annotations
import hashlib, json, os, sys, time
from datetime import UTC, datetime
from pathlib import Path
import requests

API_URL = "https://api.minimax.io/v1/music_generation"
WORKTREE = Path(__file__).resolve().parents[1]
MUSIC_DIR = WORKTREE / "apps/web/public/audio/music/shared"
PROV_DIR  = WORKTREE / "apps/web/public/audio/music/provenance"

TRACKS = [
    # ── Focus ───────────────────────────────────────────────────────────────
    dict(slug="morning-grid", title="Morning Grid", mood="focus", prompt=(
        "Jazz-hop instrumental, 92 BPM, bright piano chords, light brushed drums, "
        "upbeat but focused, warm coffee-shop energy, no vocals, loopable"
    )),
    dict(slug="steady-state", title="Steady State", mood="focus", prompt=(
        "Minimal ambient electronic, clean arpeggiated guitar synth hybrid, 88 BPM, "
        "C major, sustained clarity, modern productivity music, no lyrics, loopable"
    )),
    dict(slug="blue-hour-work", title="Blue Hour Work", mood="focus", prompt=(
        "Lo-fi chill hop, 84 BPM, mellow Rhodes, soft vinyl hiss, "
        "warm bass undertone, relaxed concentration, no vocals, instrumental loop"
    )),

    # ── Deep Work ───────────────────────────────────────────────────────────
    dict(slug="tunnel-vision", title="Tunnel Vision", mood="deepWork", prompt=(
        "Dark cinematic ambient, low sustained bass drone, slow evolving texture, "
        "no melody, immersive long-session concentration, 90 BPM, no vocals"
    )),
    dict(slug="code-noir", title="Code Noir", mood="deepWork", prompt=(
        "Minimal dark jazz instrumental, sparse piano chords, slow walking bass, "
        "soft brushed snare, 72 BPM, late-night creative session, no lyrics"
    )),
    dict(slug="deep-channel", title="Deep Channel", mood="deepWork", prompt=(
        "Post-rock ambient, slow building clean electric guitar, reverb swells, "
        "muted bass, no lyrics, engineering flow state, 86 BPM, loopable"
    )),

    # ── Relax ───────────────────────────────────────────────────────────────
    dict(slug="golden-hour", title="Golden Hour", mood="relax", prompt=(
        "Gentle bossa nova instrumental, nylon string guitar, soft piano, "
        "68 BPM, warm and unhurried, afternoon light, no vocals"
    )),
    dict(slug="soft-landing", title="Soft Landing", mood="relax", prompt=(
        "Ambient chill, warm analog pad chords, gentle acoustic guitar plucks, "
        "60 BPM, dreamy and soft, no percussion, no lyrics, loopable"
    )),
    dict(slug="porch-light", title="Porch Light", mood="relax", prompt=(
        "Acoustic folk ambient, fingerpicked guitar, subtle cello, "
        "65 BPM, nostalgic and warm, evening mood, no vocals, instrumental"
    )),

    # ── Meditate ────────────────────────────────────────────────────────────
    dict(slug="om-resonance", title="Om Resonance", mood="meditate", prompt=(
        "Deep drone meditation, low sustained Om-like vocal harmonic overtones, "
        "432 Hz tuning, no rhythm, pure resonance and breath space, "
        "Tibetan influence, no melody, deeply grounding"
    )),
    dict(slug="crystal-clear", title="Crystal Clear", mood="meditate", prompt=(
        "High-frequency crystal singing bowl meditation, pure harmonic overtones, "
        "long sustained notes with silence between, no rhythm, no melody arc, "
        "spacious and luminous, theta wave support"
    )),
    dict(slug="still-point", title="Still Point", mood="meditate", prompt=(
        "Minimal ambient meditation, single low piano note with long decay, "
        "soft wind drone underneath, 432 Hz, 10-second silence between notes, "
        "pure stillness, no melody progression, no percussion"
    )),

    # ── Sleep ───────────────────────────────────────────────────────────────
    dict(slug="fade-to-black", title="Fade to Black", mood="sleep", prompt=(
        "Extremely soft ambient drone, barely audible sustained pad chord, "
        "no melody, no rhythm, dissolving slowly into silence, "
        "delta wave support, whisper quiet, for deep sleep onset"
    )),
    dict(slug="dream-gate", title="Dream Gate", mood="sleep", prompt=(
        "Soft lullaby ambient, gentle music box single notes, very slow 45 BPM, "
        "long silence between notes, warm and sleepy, no percussion, "
        "no bass, fading into stillness"
    )),
    dict(slug="deep-rest", title="Deep Rest", mood="sleep", prompt=(
        "Ultra-minimal sleep ambient, low cello drone barely audible, "
        "sustained single note, no movement, no rhythm, no melody, "
        "pure silence with gentle texture underneath, for sleep onset"
    )),
]

def require_key():
    key = os.getenv("MINIMAX_API_KEY")
    if not key:
        sys.exit("Missing MINIMAX_API_KEY")
    return key

def generate(prompt, key):
    payload = {
        "model": "music-2.6-free",
        "prompt": prompt,
        "output_format": "hex",
        "lyrics_optimizer": False,
        "is_instrumental": True,
        "aigc_watermark": False,
        "audio_setting": {"sample_rate": 44100, "bitrate": 256000, "format": "mp3"},
    }
    r = requests.post(API_URL,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json=payload, timeout=1800)
    r.raise_for_status()
    data = r.json()
    hex_audio = (data.get("data") or {}).get("audio", "")
    if not hex_audio:
        raise RuntimeError(f"No audio: {json.dumps(data)[:300]}")
    trace = (data.get("base_resp") or {}).get("request_id", "")
    return bytes.fromhex(hex_audio), trace

def write_prov(slug, mood, title, path, trace, prompt):
    import subprocess
    dur = 0
    try:
        r = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","json",str(path)],
            capture_output=True, text=True, timeout=30)
        dur = int(float(json.loads(r.stdout)["format"]["duration"]) * 1000)
    except Exception as e:
        print(f"  [warn] ffprobe failed for {path.name}: {e}", file=sys.stderr)
        dur = 0
    stat = path.stat()
    sha = hashlib.sha256(path.read_bytes()).hexdigest()
    prov = {"provider":"MiniMax","model":"music-2.6-free","slug":slug,"title":title,"mood":mood,
            "prompt":prompt,"audio_src":f"/audio/music/shared/{slug}.mp3",
            "provenance_src":f"/audio/music/provenance/{slug}.json",
            "trace_id":trace,"duration_ms":dur,"sample_rate":44100,"bitrate":256000,
            "bytes":stat.st_size,"sha256":sha,"generated_at":datetime.now(UTC).isoformat()}
    (PROV_DIR / f"{slug}.json").write_text(json.dumps(prov, indent=2)+"\n")

def main():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--moods", nargs="*")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    MUSIC_DIR.mkdir(parents=True, exist_ok=True)
    PROV_DIR.mkdir(parents=True, exist_ok=True)

    tracks = [t for t in TRACKS if not args.moods or t["mood"] in args.moods]

    if args.dry_run:
        for t in tracks:
            print(f"[{t['mood']}] {t['title']} — {t['slug']}")
        return

    key = require_key()
    for i, t in enumerate(tracks, 1):
        out = MUSIC_DIR / f"{t['slug']}.mp3"
        print(f"\n[{i}/{len(tracks)}] {t['title']} ({t['mood']})")
        if out.exists():
            print(f"  SKIP — exists ({out.stat().st_size//1024}KB)")
            continue
        print("  Generating…", flush=True)
        t0 = time.time()
        try:
            audio, trace = generate(t["prompt"], key)
        except Exception as e:
            print(f"  ERROR: {e}")
            continue
        out.write_bytes(audio)
        print(f"  OK: {out.stat().st_size/1024/1024:.1f}MB in {time.time()-t0:.0f}s")
        write_prov(t["slug"], t["mood"], t["title"], out, trace, t["prompt"])
        if i < len(tracks):
            time.sleep(2)
    print(f"\n=== Done. Add new slugs to audio-manifest.ts ===")

if __name__ == "__main__":
    main()
