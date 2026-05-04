#!/usr/bin/env python3
"""
Focus track generation — Post Rock / High Neural Effect style.
Based on reference analysis from work.wav / foc index.txt.

Target: High complexity, high brightness, 90-130 BPM, driving and brooding.
Instruments: Electric guitar, processed strings, arp synth, electric bass, drums.
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

# ---------------------------------------------------------------------------
# Focus tracks — Post Rock / High Neural Effect inspired by reference material
# All targeting beta band (12-18 Hz) stimulation through musical intensity
# ---------------------------------------------------------------------------
TRACKS = [
    # High energy post-rock, driving drums
    dict(slug="nightdrive-run", title="Nightdrive Run", mood="focus", prompt=(
        "Post-rock instrumental, 112 BPM, driving electric guitar riff with high gain, "
        "pounding acoustic drum kit, thick electric bass groove, arp synth countermelody, "
        "processed strings swelling underneath, brooding and intense, no vocals, "
        "high complexity, climactic build, dark and focused energy"
    )),
    # Maximum drive, cinematic
    dict(slug="automaton-state", title="Automaton State", mood="focus", prompt=(
        "Post-rock instrumental, 130 BPM, aggressive electric guitar with distortion, "
        "fast acoustic drumset with tight snare, syncopated electric bass, "
        "arp synth running underneath, cinematic processed strings, "
        "mysterious and brooding, no vocals, maximum rhythmic drive, complex arrangement"
    )),
    # Cinematic + orchestral for deep focus
    dict(slug="neural-drive", title="Neural Drive", mood="focus", prompt=(
        "Cinematic instrumental, 110 BPM, orchestral brass stabs, electronic percussion, "
        "arp synth bass pulse, processed strings tension, organic percussion layering, "
        "epic and inspiring, no vocals, high complexity, driving forward momentum, "
        "designed for sustained cognitive engagement"
    )),
    # Electronic + dark for deep work
    dict(slug="vital-signal", title="Vital Signal", mood="focus", prompt=(
        "Electronic instrumental, 120 BPM, driving arp synth bass, dark ambient pads, "
        "heavy electronic percussion with tight kick, brooding and ominous, "
        "no melody hook, no vocals, high complexity, high brightness, "
        "relentless forward drive, intense and focused"
    )),
    # Post-rock with piano
    dict(slug="catch-release", title="Catch and Release", mood="focus", prompt=(
        "Post-rock instrumental, 85 BPM, electric guitar build with clean to distortion, "
        "acoustic drumset, chimes/bells accent, electric bass, electric keys, "
        "processed strings rising, hopeful and epic, no vocals, high complexity, "
        "high brightness, dynamic range from quiet to powerful"
    )),
    # Deep work — lower BPM, maximum weight
    dict(slug="deep-automaton", title="Deep Automaton", mood="deepWork", prompt=(
        "Post-rock instrumental, 90 BPM, heavy electric guitar with processing, "
        "slow powerful drums, deep electric bass, textural soundscape underneath, "
        "dark and heavy, no vocals, brooding and ominous, complex layering, "
        "designed for 90-minute deep work sessions, never breaks concentration"
    )),
    # Deep work — driving and steady
    dict(slug="flow-state-engine", title="Flow State Engine", mood="deepWork", prompt=(
        "Electronic instrumental, 95 BPM, steady arp synth grid, deep sub bass pulse, "
        "minimal but driving electronic percussion, dark pads evolving slowly, "
        "ominous and relentless, no melody hook, no vocals, high complexity, "
        "industrial texture, engineered for sustained cognitive flow"
    )),
    # Deep work — cinematic weight
    dict(slug="iron-current", title="Iron Current", mood="deepWork", prompt=(
        "Cinematic instrumental, 100 BPM, orchestral strings tension build, "
        "heavy organic percussion, synth bass underpinning, brass stabs punctuating, "
        "epic and heavy, no vocals, complex arrangement, high brightness, "
        "powerful and focused energy for long deep work sessions"
    )),
]

def require_key():
    key = os.getenv("MINIMAX_API_KEY")
    if not key: sys.exit("Missing MINIMAX_API_KEY")
    return key

def generate(prompt, key):
    payload = {
        "model": "music-2.6",  # Try paid tier for better quality/length
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
        # Try free tier as fallback
        payload["model"] = "music-2.6-free"
        r = requests.post(API_URL,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json=payload, timeout=1800)
        r.raise_for_status()
        data = r.json()
        hex_audio = (data.get("data") or {}).get("audio", "")
        if not hex_audio:
            raise RuntimeError(f"No audio: {json.dumps(data)[:300]}")
    trace = (data.get("base_resp") or {}).get("request_id", "")
    return bytes.fromhex(hex_audio), trace, data.get("model", payload["model"])

def write_prov(slug, mood, title, path, trace, prompt, model):
    import subprocess
    dur = 0
    try:
        r = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","json",str(path)],
            capture_output=True, text=True)
        dur = int(float(json.loads(r.stdout)["format"]["duration"]) * 1000)
    except: pass
    stat = path.stat()
    sha = hashlib.sha256(path.read_bytes()).hexdigest()
    prov = {
        "provider": "MiniMax", "model": model, "slug": slug, "title": title,
        "mood": mood, "prompt": prompt,
        "audio_src": f"/audio/music/shared/{slug}.mp3",
        "provenance_src": f"/audio/music/provenance/{slug}.json",
        "trace_id": trace, "duration_ms": dur, "sample_rate": 44100,
        "bitrate": 256000, "bytes": stat.st_size, "sha256": sha,
        "generated_at": datetime.now(UTC).isoformat(),
        "style": "post-rock-high-neural-effect",
        "reference": "work.wav / foc-index.txt"
    }
    (PROV_DIR / f"{slug}.json").write_text(json.dumps(prov, indent=2)+"\n")
    print(f"  provenance → {slug}.json ({dur//1000}s)")

def main():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--moods", nargs="*")
    args = p.parse_args()

    MUSIC_DIR.mkdir(parents=True, exist_ok=True)
    PROV_DIR.mkdir(parents=True, exist_ok=True)

    tracks = [t for t in TRACKS if not args.moods or t["mood"] in args.moods]

    if args.dry_run:
        for t in tracks:
            print(f"[{t['mood']}] {t['title']} — {t['slug']}")
            print(f"  {t['prompt'][:100]}...")
        return

    key = require_key()
    for i, t in enumerate(tracks, 1):
        out = MUSIC_DIR / f"{t['slug']}.mp3"
        print(f"\n[{i}/{len(tracks)}] {t['title']} ({t['mood']})")
        if out.exists():
            size = out.stat().st_size / 1024 / 1024
            print(f"  SKIP — exists ({size:.1f}MB)")
            continue
        print("  Generating…", flush=True)
        t0 = time.time()
        try:
            audio, trace, model = generate(t["prompt"], key)
        except Exception as e:
            print(f"  ERROR: {e}")
            continue
        out.write_bytes(audio)
        size = out.stat().st_size / 1024 / 1024
        elapsed = time.time() - t0
        print(f"  OK: {size:.1f}MB in {elapsed:.0f}s via {model}")
        write_prov(t["slug"], t["mood"], t["title"], out, trace, t["prompt"], model)
        if i < len(tracks):
            time.sleep(3)

    print(f"\n=== Done. Wire new slugs into audio-manifest.ts ===")

if __name__ == "__main__":
    main()
