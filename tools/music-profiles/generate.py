#!/usr/bin/env python3
"""
ArgoBeat Music Generator — Profile-Based

Usage:
    python3 generate.py --profile focus --instrument guitar-swells --bpm 120 --seed 42
    python3 generate.py --profile meditate --instrument chimes-bells --bpm 50 --seed 123
    python3 generate.py --profile sleep --instrument bass-drone --bpm 45 --seed 456
    python3 generate.py --profile focus --instrument piano-strings --bpm 115 --duration 60 --steps 80
"""
import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Profile configurations
PROFILES = {
    "focus": {
        "bpm_range": (100, 130),
        "rhythm": "minimal rhythm, not zero — enough to feel like music",
        "sound": "dark, warm, motivating, low harshness, productive background",
        "style": "focus music, background music for concentration",
        "avoid": "no guitar, no strings, no bright lead, no harsh highs",
        "lowpass": 1500,
        "volume_db": -16,
        "instruments": [
            "warm muted electric piano, soft filtered synth pulse",
            "analog synth pad, warm analog",
            "felt piano, soft sustained chords",
            "clean low arpeggio, muted synth keys",
        ],
        "seed_offset": 0,
    },
    "deep-work": {
        "bpm_range": (80, 100),
        "rhythm": "very minimal rhythm, subdued",
        "sound": "dark, warm, subdued, low event density, steady concentration",
        "style": "deep work music, flow state background",
        "avoid": "no guitar, no strings, no bright sounds, no dramatic changes",
        "lowpass": 1400,
        "volume_db": -18,
        "instruments": [
            "analog synth pad, slowly evolving, dark warm",
            "felt piano, soft sustained chords",
            "sub bass drone, deep bass, barely audible",
        ],
        "seed_offset": 500,
    },
    "relax": {
        "bpm_range": (50, 80),
        "rhythm": "no rhythm, no beat",
        "sound": "calm, pleasant, serene, subdued drone, gentle nature",
        "style": "relaxing ambient, serene nature calm",
        "avoid": "no storms, no thunder, no crashing waves, no wind howling, no dramatic nature",
        "lowpass": 1200,
        "volume_db": -17,
        "instruments": [
            "analog synth pad, warm analog, slowly evolving",
            "felt piano, soft keys, sustained chords",
            "orchestral strings, sustained bowing, barely audible",
        ],
        "nature_layers": [
            "gentle rain, steady soft rain",
            "soft stream, trickling water",
            "distant ocean, gentle lapping waves",
            "light birds, occasional chirping",
        ],
        "seed_offset": 1000,
    },
    "meditate": {
        "bpm_range": (30, 50),
        "rhythm": "no rhythm, very sparse events, lots of silence",
        "sound": "trance-like, sparse gongs, singing bowls, long decay, ritual calm, Buddhist temple",
        "style": "meditation music, temple soundscape, trance calm",
        "avoid": "no busy chimes, no nature sounds, no melody, no rhythm",
        "lowpass": 1000,
        "volume_db": -20,
        "instruments": [
            "singing bowls, gongs, long decay, sparse",
            "gongs, bells, mallets, textural, very slow, ritual",
            "analog synth pad, warm analog, minimal, deep drone",
        ],
        "seed_offset": 2000,
    },
    "sleep": {
        "bpm_range": (20, 40),
        "rhythm": "no rhythm, no changes, near-static, almost silent",
        "sound": "almost nothing happening, soft hum, no surprises, muffled",
        "style": "sleep audio, brown noise, near-static hum",
        "avoid": "no events, no melody, no gongs, no birds, no bright sounds, no rhythm",
        "lowpass": 800,
        "volume_db": -22,
        "instruments": [
            "very light brown noise, soft hum, minimal",
            "sub bass drone, deep bass, barely audible",
            "analog synth pad, warm analog, nearly silent",
        ],
        "seed_offset": 3000,
    },
}

# Instrument name mapping
INSTRUMENT_MAP = {
    "muted-keys": "warm muted electric piano, soft filtered synth pulse",
    "synth-pad": "analog synth pad, warm analog",
    "felt-piano": "felt piano, soft sustained chords",
    "clean-arp": "clean low arpeggio, muted synth keys",
    "bass-drone": "sub bass drone, deep bass, barely audible",
    "singing-bowls": "singing bowls, gongs, long decay, sparse",
    "gongs": "gongs, bells, mallets, textural, very slow, ritual",
    "brown-noise": "very light brown noise, soft hum, minimal",
    "gentle-rain": "gentle rain, steady soft rain, serene",
    "soft-stream": "soft stream, trickling water, peaceful",
}


def generate_track(profile, instrument, bpm, seed, duration=30, steps=60, output_dir=None):
    """Generate a single track using ACE-Step."""
    config = PROFILES[profile]
    
    # Build ACE-Step optimized prompt
    instrument_text = INSTRUMENT_MAP.get(instrument, instrument)
    style = config.get('style', f'{profile} music')
    avoid = config.get('avoid', 'no vocals')
    prompt = f"{style}, {bpm} bpm, {instrument_text}, {config['rhythm']}, {config['sound']}, {avoid}, no vocals, instrumental, loopable"
    
    # Output path
    if output_dir is None:
        output_dir = Path(f"/mnt/AllShare/Argobeat/generated/{profile}")
    else:
        output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    output_file = output_dir / f"{profile}-{instrument}-{bpm}bpm-seed{seed}.wav"
    
    print(f"Generating: {profile} | {instrument} | {bpm} BPM | seed={seed}")
    print(f"Prompt: {prompt}")
    
    # Build generation script
    gen_script = f'''
import sys, time, torch, torchaudio, soundfile as sf
from acestep.pipeline_ace_step import ACEStepPipeline

def _sf_save(filepath, src, sample_rate, format=None, backend=None, **kw):
    wav = src.detach().cpu().float()
    if wav.dim() == 2:
        wav = wav.t()
    sf.write(filepath, wav.numpy(), int(sample_rate))
torchaudio.save = _sf_save

pipe = ACEStepPipeline(
    checkpoint_dir="",
    dtype="bfloat16",
    torch_compile=False,
    cpu_offload=True,
    overlapped_decode=True,
)

t0 = time.time()
pipe(
    format="wav",
    audio_duration={duration},
    prompt="{prompt}",
    lyrics="[inst]",
    infer_step={steps},
    guidance_scale=8.5,
    scheduler_type="euler",
    cfg_type="apg",
    omega_scale=10.0,
    manual_seeds="{seed}",
    guidance_interval=0.5,
    guidance_interval_decay=0.0,
    min_guidance_scale=3.0,
    use_erg_tag=True,
    use_erg_lyric=False,
    use_erg_diffusion=True,
    oss_steps="",
    guidance_scale_text=0.0,
    guidance_scale_lyric=0.0,
    save_path="{output_file}",
)
print(f"Generated in {{time.time()-t0:.1f}}s")
'''
    
    script_path = f"/tmp/gen-{profile}-{instrument}.py"
    with open(script_path, "w") as f:
        f.write(gen_script)
    
    # Run generation
    result = subprocess.run(
        ["/mnt/homes/galileo/argo/Development/ACE-Step/.venv/bin/python", script_path],
        capture_output=True, text=True, timeout=300
    )
    
    if result.returncode != 0:
        print(f"FAILED: {result.stderr[:200]}")
        return None
    
    print(f"Generated: {output_file}")
    
    # Post-process
    processed_file = postprocess(output_file, config)

    # Write recipe manifest
    write_recipe(profile, instrument, bpm, seed, prompt, processed_file, config)

    return processed_file


def postprocess(input_file, config):
    """Apply post-processing chain."""
    output_file = input_file.parent / f"{input_file.stem}-processed.wav"
    
    # Step 1: Normalize to -6 dB first (headroom for limiting)
    # Step 2: Apply lowpass to remove harsh highs
    # Step 3: Compress to even out dynamics
    # Step 4: Brickwall limit to prevent ANY clipping
    # Step 5: Final normalize to target volume
    
    filters = [
        "loudnorm=I=-6:TP=-1:LRA=11",  # First pass: normalize with headroom
        f"lowpass=f={config['lowpass']}",  # Remove harsh highs
        "compand=attacks=0.3:decays=0.8:points=-80/-80|-45/-45|-27/-25|0/-10",  # Compress
        "alimiter=level_in=1:level_out=0.9:limit=0.9:attack=0.1:release=50",  # Brickwall limit
        f"loudnorm=I={config['volume_db']}:TP=-1:LRA=11",  # Final normalize
    ]
    filter_str = ",".join(filters)
    
    # Run ffmpeg
    result = subprocess.run([
        "ffmpeg", "-y", "-i", str(input_file),
        "-af", filter_str,
        str(output_file)
    ], capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"Post-processing failed: {result.stderr[:200]}")
        return input_file
    
    # Remove original, rename processed
    input_file.unlink()
    output_file.rename(input_file)
    
    # Get stats
    stats = subprocess.run([
        "ffmpeg", "-i", str(input_file), "-af", "volumedetect", "-f", "null", "-"
    ], capture_output=True, text=True)
    
    for line in stats.stderr.split("\n"):
        if "mean_volume" in line:
            print(f"  Volume: {line.strip()}")
    
    return input_file


def write_recipe(profile, instrument, bpm, seed, prompt, output_file, config):
    """Write a machine-readable recipe JSON alongside the generated track."""
    recipe = {
        "recipe_id": f"{profile}-{instrument.replace(' ', '-')}-{bpm}-seed{seed}",
        "category": profile,
        "created": datetime.now(timezone.utc).isoformat(),
        "source": {
            "nature_layers": [],
            "drone_source": "",
            "instrument": INSTRUMENT_MAP.get(instrument, instrument),
        },
        "generation": {
            "engine": "ace-step",
            "prompt": prompt,
            "lyrics": "[inst]",
            "bpm": bpm,
            "seed": seed,
            "audio_duration": 30,
            "infer_step": 60,
            "guidance_scale": 12.0,
            "scheduler_type": "euler",
            "cfg_type": "apg",
            "omega_scale": 10.0,
            "use_erg_tag": True,
            "use_erg_lyric": False,
            "use_erg_diffusion": True,
        },
        "post_processing": {
            "steps": [
                {"name": "normalize-headroom", "filter": "loudnorm=I=-6:TP=-1:LRA=11"},
                {"name": "lowpass", "filter": f"lowpass=f={config['lowpass']}"},
                {"name": "compress", "filter": "compand=attacks=0.3:decays=0.8:points=-80/-80|-45/-45|-27/-25|0/-10"},
                {"name": "limiter", "filter": "alimiter=level_in=1:level_out=0.9:limit=0.9:attack=0.1:release=50"},
                {"name": "final-normalize", "filter": f"loudnorm=I={config['volume_db']}:TP=-1:LRA=11"},
            ],
            "target_lufs": config["volume_db"],
            "target_true_peak": -1,
        },
        "output": {
            "filename": output_file.name,
            "format": "wav",
            "duration_seconds": 30,
            "sample_rate": 44100,
        },
        "listening": {
            "comfort_50_75": None,
            "no_harshness": None,
            "category_match": None,
            "notes": "",
        },
    }
    recipe_file = output_file.with_suffix(".json")
    with open(recipe_file, "w") as f:
        json.dump(recipe, f, indent=2)
    print(f"Recipe: {recipe_file}")
    return recipe_file


def main():
    parser = argparse.ArgumentParser(description="ArgoBeat Music Generator")
    parser.add_argument("--profile", required=True, choices=["focus", "deep-work", "relax", "meditate", "sleep"],
                        help="Music profile")
    parser.add_argument("--instrument", required=True,
                        help="Instrument (or 'random' for random from profile)")
    parser.add_argument("--bpm", type=int, help="BPM (default: middle of profile range)")
    parser.add_argument("--seed", type=int, default=42,
                        help="Random seed for reproducibility")
    parser.add_argument("--duration", type=float, default=30,
                        help="Duration in seconds (default: 30)")
    parser.add_argument("--steps", type=int, default=60,
                        help="Inference steps (default: 60)")
    parser.add_argument("--output-dir", help="Output directory")
    parser.add_argument("--batch", type=int, default=1,
                        help="Number of tracks to generate")
    
    args = parser.parse_args()
    config = PROFILES[args.profile]
    
    # Default BPM
    if args.bpm is None:
        args.bpm = (config["bpm_range"][0] + config["bpm_range"][1]) // 2
    
    # Validate BPM
    if args.bpm < config["bpm_range"][0] or args.bpm > config["bpm_range"][1]:
        print(f"Warning: BPM {args.bpm} outside profile range {config['bpm_range']}")
    
    # Generate batch
    for i in range(args.batch):
        seed = args.seed + i
        print(f"\n=== Track {i+1}/{args.batch} ===")
        generate_track(
            args.profile,
            args.instrument,
            args.bpm,
            seed,
            args.duration,
            args.steps,
            args.output_dir
        )
    
    out = args.output_dir or f"/mnt/AllShare/Argobeat/generated/{args.profile}/"
    print(f"\nDone! Generated {args.batch} track(s) in {out}")


if __name__ == "__main__":
    main()
