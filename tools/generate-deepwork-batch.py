#!/usr/bin/env python3
"""
Deep Work batch — 15 tracks to reach 90 min total.
Reference: work.wav (38 min post-rock/heavy), motivate index (Vital Pulse, Undetected style).
Target: sustained, heavy, varied — no listener fatigue over 90-min sessions.
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
    # Heavy post-rock sustained
    dict(slug="weight-bearing", title="Weight Bearing", mood="deepWork", prompt=(
        "Post-rock instrumental, 88 BPM, heavy sustained electric guitar, "
        "powerful slow drumset, deep electric bass, orchestral strings swell, "
        "dark and heavy, no vocals, for 90-minute engineering sessions, "
        "never breaks concentration, brooding and immersive"
    )),
    dict(slug="stone-circuit", title="Stone Circuit", mood="deepWork", prompt=(
        "Post-rock instrumental, 95 BPM, dual heavy guitar texture, "
        "driving bass, acoustic drumset with authority, processed strings, "
        "mysterious and complex, no vocals, HIGH complexity, "
        "for sustained deep creative work, never melodic or distracting"
    )),
    dict(slug="black-lattice", title="Black Lattice", mood="deepWork", prompt=(
        "Post-rock instrumental, 82 BPM, dark heavy guitar, slow powerful drums, "
        "deep resonant bass, dark ambience underneath, ominous and epic, "
        "no vocals, very heavy, for the longest most demanding work sessions"
    )),
    # Industrial electronic
    dict(slug="grid-state", title="Grid State", mood="deepWork", prompt=(
        "Industrial electronic instrumental, 94 BPM, heavy mechanical beat, "
        "dense synthesizer texture, low ominous bass drone, metallic percussion, "
        "relentless and dark, no vocals, no melody, pure momentum, "
        "for sustained technical deep work, high intensity"
    )),
    dict(slug="forge-current", title="Forge Current", mood="deepWork", prompt=(
        "Electronic instrumental, 98 BPM, thick arp synth bass pulse, "
        "heavy kick and snare, layered dark pads, industrial texture, "
        "brooding and driving, no vocals, HIGH complexity, ominous, "
        "engineered for 90-minute deep work"
    )),
    dict(slug="thermal-run", title="Thermal Run", mood="deepWork", prompt=(
        "Electronic post-rock hybrid, 92 BPM, sequenced synth arp, "
        "live drums driving, electric guitar tension, dark ambient pad, "
        "mysterious and driving, no vocals, complex arrangement, "
        "for sustained engineering and creative sessions"
    )),
    # Cinematic orchestral
    dict(slug="iron-resolve", title="Iron Resolve", mood="deepWork", prompt=(
        "Cinematic orchestral instrumental, 96 BPM, heavy orchestral strings tension, "
        "powerful brass accents, heavy organic percussion, synth bass underpinning, "
        "epic and serious, no vocals, HIGH complexity, designed for demanding work"
    )),
    dict(slug="pressure-front", title="Pressure Front", mood="deepWork", prompt=(
        "Cinematic instrumental, 100 BPM, orchestral strings building tension, "
        "electronic percussion layered with orchestra, dark synth bed, "
        "brooding and epic, no vocals, complex and layered, "
        "serious and immersive for deep work"
    )),
    dict(slug="undetected-run", title="Undetected Run", mood="deepWork", prompt=(
        "Cinematic instrumental, 110 BPM, orchestral brass stabs, arp synth, "
        "electronic and organic percussion layered, processed strings, "
        "epic and ponderous, no vocals, MEDIUM complexity, MEDIUM brightness, "
        "for motivation and sustained focus during engineering work"
    )),
    # Progressive dark ambient
    dict(slug="deep-construct", title="Deep Construct", mood="deepWork", prompt=(
        "Dark ambient post-rock, 78 BPM, slow evolving guitar texture, "
        "deep bass drone, heavy drums entering late, processed strings, "
        "atmospheric and heavy, no vocals, epic and slow-building, "
        "for the deepest most demanding creative sessions"
    )),
    dict(slug="null-state", title="Null State", mood="deepWork", prompt=(
        "Dark ambient electronic, 86 BPM, dense evolving synth pads, "
        "heavy sub bass pulse, sparse electronic percussion, "
        "completely immersive, no melody, no vocals, ominous texture, "
        "for deep technical concentration requiring maximum focus"
    )),
    dict(slug="sector-nine", title="Sector Nine", mood="deepWork", prompt=(
        "Electronic instrumental, 93 BPM, mechanical grid beat, "
        "layered synthesizer pads evolving slowly, deep bass, "
        "cold and industrial, no vocals, HIGH complexity, relentless, "
        "designed for sustained 90-minute engineering deep work"
    )),
    # Varied tempo for session fatigue prevention
    dict(slug="mass-transit", title="Mass Transit", mood="deepWork", prompt=(
        "Post-rock instrumental, 104 BPM, faster driving guitar, "
        "tight drumset, punchy bass, textural soundscape bed, "
        "intense and driving, no vocals, for mid-session energy maintenance, "
        "slightly faster than usual deep work for momentum"
    )),
    dict(slug="cold-logic", title="Cold Logic", mood="deepWork", prompt=(
        "Electronic instrumental, 85 BPM, minimal cold arp synth, "
        "sparse but heavy kick pattern, deep bass, dark pads, "
        "precise and methodical, no vocals, for analytical deep work phases, "
        "deliberate and controlled intensity"
    )),
    dict(slug="vital-engine", title="Vital Engine", mood="deepWork", prompt=(
        "Electronic instrumental, 120 BPM, driving arp synth bass, "
        "heavy electronic percussion, dark brooding pads, ominous and powerful, "
        "no vocals, HIGH complexity, HIGH intensity, "
        "for the most demanding high-stakes work sessions"
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
                "model": model, "prompt": prompt, "output_format": "hex",
                "lyrics_optimizer": False, "is_instrumental": True,
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
            if model == "music-2.6": print(f"  paid tier: {e}, trying free...")
    raise RuntimeError("All models failed")

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
    prov = {"provider":"MiniMax","model":model,"slug":slug,"title":title,"mood":mood,
            "prompt":prompt,"audio_src":f"/audio/music/shared/{slug}.mp3",
            "provenance_src":f"/audio/music/provenance/{slug}.json",
            "trace_id":trace,"duration_ms":dur,"sample_rate":44100,"bitrate":256000,
            "bytes":stat.st_size,"sha256":sha,"generated_at":datetime.now(UTC).isoformat()}
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
        for t in TRACKS: print(f"[{t['mood']}] {t['title']}")
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
    print(f"\n=== Done ===")

if __name__ == "__main__":
    main()
