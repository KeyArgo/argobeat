#!/usr/bin/env python3
"""
Generate tracks to reach ~1 hour per mood.
Focus: need ~25 more min (6 tracks)
Relax: need ~35 more min (9 tracks)
Sleep: need ~60 min (12 tracks — soft piano/atmospheric)

Reference:
- Focus: foc-index.txt (Foaming Seas, Delicate Drops, Incandescent, Solitude style)
- Relax: creative-index.txt (Forked Rivers, Gentle Creek, temple-edge variations)
- Sleep: ultra-soft, single piano notes, 45-60 BPM, deep silence
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
    # ── FOCUS batch 3 — textural/atmospheric + post-rock variety ─────────────
    dict(slug="foaming-seas-run", title="Foaming Seas Run", mood="focus", prompt=(
        "Atmospheric beach music for focus, 120 BPM, textural soundscape with music layer, "
        "water ambience texture, calm and chill and meditative and serene, "
        "LOW complexity, HIGH brightness, no vocals, for reading and coding sessions"
    )),
    dict(slug="delicate-focus", title="Delicate Focus", mood="focus", prompt=(
        "Rain atmospheric music for focus, 120 BPM, rain ambience texture woven with music, "
        "dreamlike and floating and calm and serene, MEDIUM complexity, HIGH brightness, "
        "no vocals, gentle rain texture with subtle musical layer, for concentration"
    )),
    dict(slug="incandescent-run", title="Incandescent Run", mood="focus", prompt=(
        "Post-rock instrumental for creativity, 85 BPM, clean electric guitar arpeggios, "
        "processed strings swell, organic bass, subtle percussion, "
        "floating and inspiring, no vocals, MEDIUM complexity, for creative engineering focus"
    )),
    dict(slug="solitude-drive", title="Solitude Drive", mood="focus", prompt=(
        "Post-rock instrumental solitude, 88 BPM, single electric guitar texture, "
        "synth bass undertone, textural soundscape bed, ponderous and floating, "
        "no vocals, LOW complexity, MEDIUM brightness, for deep solitary concentration"
    )),
    dict(slug="flight-feathers", title="Flight Feathers", mood="focus", prompt=(
        "Post-rock ambient for creativity, 90 BPM, clean guitar build, "
        "organic percussion entering slowly, processed strings, no lyrics, "
        "floating and hopeful, for creative focus sessions, MEDIUM complexity"
    )),
    dict(slug="cleft-engine", title="Cleft Engine II", mood="focus", prompt=(
        "Post-rock deep work, 78 BPM, heavy guitar slow build, "
        "orchestral strings tension, deep bass, ponderous and brooding, "
        "no vocals, MEDIUM complexity, for sustained engineering focus"
    )),

    # ── RELAX batch 2 — creative atmospheric + more post-rock variety ─────────
    dict(slug="forked-rivers", title="Forked Rivers", mood="relax", prompt=(
        "River atmospheric music for creativity, 120 BPM, textural soundscape with water, "
        "calm and chill and meditative and serene, LOW complexity, HIGH brightness, "
        "no vocals, gentle water texture with subtle musical layer, for creative relaxation"
    )),
    dict(slug="gentle-creek-flow", title="Gentle Creek Flow", mood="relax", prompt=(
        "Rainforest atmospheric, 120 BPM, rainforest ambience texture with music, "
        "calm and dreamlike and floating and meditative and serene, "
        "LOW complexity, HIGH brightness, no vocals, for creative decompression"
    )),
    dict(slug="aegean-drift", title="Aegean Drift", mood="relax", prompt=(
        "Beach atmospheric music for relax, 120 BPM, ocean texture, "
        "calm and chill and meditative, serene, LOW complexity, HIGH brightness, "
        "no vocals, warm and sunset feeling, for creative unwinding"
    )),
    dict(slug="northern-moss", title="Northern Moss", mood="relax", prompt=(
        "Forest atmospheric ambient, 120 BPM, forest ambience texture with music, "
        "dreamlike and floating and serene and meditative, LOW complexity, HIGH brightness, "
        "no vocals, for creative relaxation and decompression"
    )),
    dict(slug="within-waves", title="Within Waves", mood="relax", prompt=(
        "Underwater atmospheric ambient, 120 BPM, deep underwater texture, "
        "dreamlike and floating, calm, LOW complexity, MEDIUM brightness, "
        "no vocals, immersive and serene, for creative relaxation"
    )),
    dict(slug="dusk-signal", title="Dusk Signal", mood="relax", prompt=(
        "Post-rock atmospheric relax, 75 BPM, clean guitar ambient, "
        "dusk mood, warm and hopeful, slow build, no vocals, "
        "LOW complexity, MEDIUM brightness, for evening creative sessions"
    )),
    dict(slug="sacred-grove", title="Sacred Grove", mood="relax", prompt=(
        "Forest atmospheric for learning and creativity, 120 BPM, forest ambience, "
        "textural soundscape, calm and dreamlike and floating and serene, "
        "LOW complexity, HIGH brightness, no vocals, peaceful and inspiring"
    )),
    dict(slug="crystalline-spirit", title="Crystalline Spirit", mood="relax", prompt=(
        "Chimes and bowls atmospheric for creativity, 120 BPM, chimes and bells, "
        "mallets, textural soundscape, calm and chill and dreamlike and floating, "
        "HIGH complexity, MEDIUM brightness, no vocals, for creative meditation states"
    )),
    dict(slug="compass-rose", title="Compass Rose", mood="relax", prompt=(
        "Acoustic ambient relax, 68 BPM, acoustic guitar fingerpicking, "
        "warm cello undertone, gentle and unhurried, no vocals, "
        "LOW complexity, MEDIUM brightness, for decompression after intense work"
    )),

    # ── SLEEP — 12 tracks, ultra-soft, for ~1 hour total ─────────────────────
    dict(slug="dissolve-slowly", title="Dissolve Slowly", mood="sleep", prompt=(
        "Ultra-soft sleep ambient, single acoustic piano notes, 45 BPM, "
        "10 seconds of complete silence between each note, "
        "no melody arc, no rhythm, no percussion, warm and sleepy, "
        "delta wave support, for deep sleep onset"
    )),
    dict(slug="midnight-glass", title="Midnight Glass", mood="sleep", prompt=(
        "Sleep music, acoustic piano single note every 20 seconds, "
        "soft string drone barely audible underneath, 50 BPM, "
        "no melody, no rhythm, pure calm, lullaby softness, "
        "for sleep onset, whisper quiet"
    )),
    dict(slug="lunar-breath", title="Lunar Breath", mood="sleep", prompt=(
        "Sleep ambient, sustained acoustic piano chord, very slow decay, "
        "barely audible string pad, 45 BPM, no melody progression, "
        "no percussion, ultra-soft, for deep rest and sleep"
    )),
    dict(slug="drifting-dark", title="Drifting Dark", mood="sleep", prompt=(
        "Delta wave sleep ambient, dark sustained pad barely audible, "
        "no melody, no rhythm, no percussion, completely still, "
        "dissolving slowly, for deep sleep, 40 BPM"
    )),
    dict(slug="sleep-current", title="Sleep Current", mood="sleep", prompt=(
        "Sleep music, one soft acoustic piano note every 15 seconds, "
        "complete silence between, warm and safe feeling, no melody, "
        "no rhythm, no bass, 45 BPM, for sleep onset"
    )),
    dict(slug="evening-descent", title="Evening Descent", mood="sleep", prompt=(
        "Sleep ambient, acoustic piano very quiet single notes, "
        "ethnic strings barely audible drone, processed strings fade, "
        "50 BPM, dreamlike and floating, no melody arc, for sleep"
    )),
    dict(slug="hollow-light", title="Hollow Light", mood="sleep", prompt=(
        "Ultra-soft sleep music, chimes and bells single strike with long decay, "
        "20 seconds of silence between strikes, no melody, no rhythm, "
        "serene and still, delta wave, for deep rest"
    )),
    dict(slug="resting-depth", title="Resting Depth", mood="sleep", prompt=(
        "Sleep ambient drone, low cello sustained note barely audible, "
        "very slow evolution, no melody, no rhythm, no percussion, "
        "40 BPM, for deep sleep and rest, whisper quiet"
    )),
    dict(slug="night-pool", title="Night Pool", mood="sleep", prompt=(
        "Sleep music, acoustic piano one chord every 30 seconds, "
        "soft acoustic guitar harmonic resonance, 45 BPM, "
        "no melody, no rhythm, warm and peaceful, for sleep onset"
    )),
    dict(slug="between-breaths", title="Between Breaths", mood="sleep", prompt=(
        "Delta sleep ambient, sustained string pad barely audible, "
        "single piano note every 25 seconds, silence between, "
        "no melody arc, no percussion, 40 BPM, for deep sleep"
    )),
    dict(slug="soft-collapse", title="Soft Collapse", mood="sleep", prompt=(
        "Ultra-soft sleep, single bass note resonating very slowly, "
        "barely perceptible, no melody, no rhythm, fading into silence, "
        "40 BPM, delta wave support, for deep rest"
    )),
    dict(slug="tender-void", title="Tender Void", mood="sleep", prompt=(
        "Sleep ambient, acoustic piano one note every 20 seconds, "
        "long reverb tail, warm and safe, no melody, no rhythm, "
        "45 BPM, for sleep onset and deep rest"
    )),
]

def require_key():
    key = os.getenv("MINIMAX_API_KEY")
    if not key: sys.exit("Missing MINIMAX_API_KEY")
    return key

def generate(prompt, key):
    for model in ["music-2.6", "music-2.6-free"]:
        try:
            r = requests.post(API_URL,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"model": model, "prompt": prompt, "output_format": "hex",
                      "lyrics_optimizer": False, "is_instrumental": True, "aigc_watermark": False,
                      "audio_setting": {"sample_rate": 44100, "bitrate": 256000, "format": "mp3"}},
                timeout=1800)
            r.raise_for_status()
            data = r.json()
            hex_audio = (data.get("data") or {}).get("audio", "")
            if not hex_audio: continue
            trace = (data.get("base_resp") or {}).get("request_id", "")
            return bytes.fromhex(hex_audio), trace, model
        except Exception as e:
            if model == "music-2.6": print(f"  paid failed ({e}), trying free...")
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
    prov = {"provider":"MiniMax","model":model,"slug":slug,"title":title,"mood":mood,
            "prompt":prompt,"audio_src":f"/audio/music/shared/{slug}.mp3",
            "trace_id":trace,"duration_ms":dur,"sample_rate":44100,"bitrate":256000,
            "bytes":path.stat().st_size,"sha256":hashlib.sha256(path.read_bytes()).hexdigest(),
            "generated_at":datetime.now(UTC).isoformat()}
    (PROV_DIR / f"{slug}.json").write_text(json.dumps(prov, indent=2)+"\n")
    print(f"  provenance → {dur//1000}s")

def main():
    MUSIC_DIR.mkdir(parents=True, exist_ok=True)
    PROV_DIR.mkdir(parents=True, exist_ok=True)
    key = require_key()
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--moods", nargs="*")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    tracks = [t for t in TRACKS if not args.moods or t["mood"] in args.moods]
    if args.dry_run:
        for t in tracks: print(f"[{t['mood']}] {t['title']}")
        print(f"Total: {len(tracks)} tracks")
        return

    for i, t in enumerate(tracks, 1):
        out = MUSIC_DIR / f"{t['slug']}.mp3"
        print(f"\n[{i}/{len(tracks)}] {t['title']} ({t['mood']})")
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
        dur_s = out.stat().st_size / (256000/8)
        print(f"  OK: {size:.1f}MB ~{int(dur_s//60)}:{int(dur_s%60):02d} via {model}")
        write_prov(t["slug"], t["mood"], t["title"], out, trace, t["prompt"], model)
        if i < len(tracks): time.sleep(2)

    print(f"\n=== Done. {len(tracks)} tracks processed. ===")

if __name__ == "__main__":
    main()
