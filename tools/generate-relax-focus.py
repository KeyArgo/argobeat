#!/usr/bin/env python3
"""
Relax + Focus batch — based on creative.wav / learn.wav / foc.wav reference material.

Relax (creative post-rock — Unhinged, Lapsed, Temple Edge style):
  Complex, driving, mysterious — NOT gentle acoustic. Users doing creative work.

Focus batch 2 (more variety — Diurnality, Greyed Out style):
  Piano-driven, floating/epic — complement the 130 BPM tracks already there.
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
    # ── Relax — creative post-rock (Unhinged / Lapsed reference style) ──────
    dict(slug="unhinged-flow", title="Unhinged Flow", mood="relax", prompt=(
        "Post-rock instrumental, 120 BPM, driving electric guitar with grit, "
        "acoustic drumset with crisp snare, electric bass groove, electric keys accent, "
        "mysterious and ponderous, no vocals, HIGH complexity, HIGH brightness, "
        "designed for creative work sessions, never settles into predictability"
    )),
    dict(slug="lapsed-current", title="Lapsed Current", mood="relax", prompt=(
        "Post-rock instrumental, 80 BPM, heavy electric guitar with distortion, "
        "powerful slow drumset, deep electric bass, textural soundscape underneath, "
        "dark and epic, no vocals, brooding and heavy, complex arrangement, "
        "for creative flow and deep thinking, serious and immersive"
    )),
    dict(slug="temple-edge", title="Temple Edge", mood="relax", prompt=(
        "Chimes and bowls instrumental, 120 BPM, mallet percussion lead, "
        "chimes and bells layered, textural soundscape bed, "
        "calm but complex, chill and dreamlike, floating sensation, "
        "no vocals, HIGH complexity, MEDIUM brightness, creative focus support"
    )),
    dict(slug="forked-current", title="Forked Current", mood="relax", prompt=(
        "Post-rock ambient instrumental, 90 BPM, clean electric guitar arpeggios, "
        "subtle brushed drums, warm bass, processed strings swell, "
        "hopeful and floating, epic and meditative, no vocals, "
        "HIGH complexity, broad dynamic range, for sustained creative sessions"
    )),

    # ── Focus batch 2 — piano-driven + epic variety ───────────────────────────
    dict(slug="diurnality-run", title="Diurnality Run", mood="focus", prompt=(
        "Post-rock instrumental, 70 BPM, acoustic piano lead with weight, "
        "orchestral strings underneath, slow electric guitar texture, "
        "electric bass, acoustic drumset, brooding and mysterious, "
        "medium complexity, medium brightness, no vocals, deep concentration"
    )),
    dict(slug="greyed-signal", title="Greyed Signal", mood="focus", prompt=(
        "Post-rock instrumental, 90 BPM, clean electric guitar with reverb, "
        "synth bass pulse underneath, textural soundscape bed, "
        "floating and inspiring, epic build, no percussion initially then drums enter, "
        "no vocals, floating and meditative, designed for focused creative engineering"
    )),
    dict(slug="cleft-engine", title="Cleft Engine", mood="focus", prompt=(
        "Post-rock instrumental, 85 BPM, dual electric guitar interplay, "
        "driving bass, organic and processed percussion, "
        "ponderous and brooding, no vocals, HIGH complexity, MEDIUM brightness, "
        "sustained engineering focus, never boring or repetitive"
    )),
]

def require_key():
    key = os.getenv("MINIMAX_API_KEY")
    if not key: sys.exit("Missing MINIMAX_API_KEY")
    return key

def generate(prompt, key):
    for model in ["music-2.6", "music-2.6-free"]:
        try:
            payload = {
                "model": model,
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
            if not hex_audio: continue
            trace = (data.get("base_resp") or {}).get("request_id", "")
            return bytes.fromhex(hex_audio), trace, model
        except Exception as e:
            if model == "music-2.6":
                print(f"  paid tier failed ({e}), trying free...")
    raise RuntimeError("All models failed")

def write_prov(slug, mood, title, path, trace, prompt, model):
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
    prov = {"provider":"MiniMax","model":model,"slug":slug,"title":title,"mood":mood,
            "prompt":prompt,"audio_src":f"/audio/music/shared/{slug}.mp3",
            "provenance_src":f"/audio/music/provenance/{slug}.json",
            "trace_id":trace,"duration_ms":dur,"sample_rate":44100,"bitrate":256000,
            "bytes":stat.st_size,"sha256":sha,"generated_at":datetime.now(UTC).isoformat(),
            "reference":"creative.wav/foc.wav index files"}
    (PROV_DIR / f"{slug}.json").write_text(json.dumps(prov, indent=2)+"\n")
    print(f"  provenance → {slug}.json ({dur//1000}s)")

def main():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    MUSIC_DIR.mkdir(parents=True, exist_ok=True)
    PROV_DIR.mkdir(parents=True, exist_ok=True)

    if args.dry_run:
        for t in TRACKS:
            print(f"[{t['mood']}] {t['title']} — {t['slug']}")
        return

    key = require_key()
    for i, t in enumerate(TRACKS, 1):
        out = MUSIC_DIR / f"{t['slug']}.mp3"
        print(f"\n[{i}/{len(TRACKS)}] {t['title']} ({t['mood']})")
        if out.exists():
            print(f"  SKIP — {out.stat().st_size/1024/1024:.1f}MB")
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
        print(f"  OK: {size:.1f}MB in {time.time()-t0:.0f}s via {model}")
        write_prov(t["slug"], t["mood"], t["title"], out, trace, t["prompt"], model)
        if i < len(TRACKS): time.sleep(2)

    print(f"\n=== Done — wire new slugs into audio-manifest.ts ===")

if __name__ == "__main__":
    main()
