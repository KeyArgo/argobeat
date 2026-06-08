#!/usr/bin/env python3
"""
Ambient Track Generator — Create meditation/relaxation tracks from nature sounds

Usage:
    # Simple rain track (5 minutes)
    python3 ambient-gen.py --type meditate --duration 300

    # Rain + stream + drone (10 minutes)
    python3 ambient-gen.py --type meditate --layers rain,stream --drone --duration 600

    # Sleep track with gongs every 5 minutes
    python3 ambient-gen.py --type sleep --layers rain,wind --gongs --gong-interval 300 --duration 1800

    # Focus track with nature sounds
    python3 ambient-gen.py --type focus --layers stream,birds --drone --drone-bpm 120 --duration 600
"""
import argparse
import subprocess
import sys
import random
from pathlib import Path

# Sound library paths
SOUND_LIB = Path("/mnt/AllShare/Argobeat/Scratch Board/cloudflare-backup-2026-06-01/audio/soundscapes")
SOUND_MAP = {
    "rain": SOUND_LIB / "rain",
    "stream": SOUND_LIB / "stream",
    "wind": SOUND_LIB / "wind",
    "ocean": SOUND_LIB / "ocean",
    "birds": SOUND_LIB / "birds",
    "fire": SOUND_LIB / "fire",
    "gongs": SOUND_LIB / "gongs",
}

# Profile configurations
PROFILES = {
    "focus": {
        "drone_bpm": 120,
        "drone_instrument": "synth-pad",
        "drone_volume": -20,
        "nature_volume": -15,
        "fade_in": 3,
        "fade_out": 5,
    },
    "deep-work": {
        "drone_bpm": 90,
        "drone_instrument": "strings-drone",
        "drone_volume": -22,
        "nature_volume": -12,
        "fade_in": 5,
        "fade_out": 8,
    },
    "relax": {
        "drone_bpm": 60,
        "drone_instrument": "felt-piano",
        "drone_volume": -22,
        "nature_volume": -8,
        "fade_in": 5,
        "fade_out": 8,
    },
    "meditate": {
        "drone_bpm": 40,
        "drone_instrument": "synth-pad",
        "drone_volume": -25,
        "nature_volume": -15,
        "fade_in": 8,
        "fade_out": 12,
    },
    "sleep": {
        "drone_bpm": 30,
        "drone_instrument": "bass-drone",
        "drone_volume": -30,
        "nature_volume": -18,
        "fade_in": 15,
        "fade_out": 20,
    },
}


def get_sounds(category):
    """Get all sounds in a category."""
    sound_dir = SOUND_MAP.get(category)
    if not sound_dir or not sound_dir.exists():
        return []
    return list(sound_dir.glob("*.mp3")) + list(sound_dir.glob("*.wav"))


def loop_sound(input_file, duration, output_file):
    """Loop a sound to target duration."""
    cmd = [
        "ffmpeg", "-y", "-stream_loop", str(duration // 300 + 1),
        "-i", str(input_file),
        "-t", str(duration),
        str(output_file)
    ]
    subprocess.run(cmd, capture_output=True)
    return output_file


def generate_drone(duration, instrument, bpm, output_file):
    """Generate a drone pad."""
    gen_script = f'''
import sys, time, torch, torchaudio, soundfile as sf
from acestep.pipeline_ace_step import ACEStepPipeline

def _sf_save(filepath, src, sample_rate, format=None, backend=None, **kw):
    wav = src.detach().cpu().float()
    if wav.dim() == 2: wav = wav.t()
    sf.write(filepath, wav.numpy(), int(sample_rate))
torchaudio.save = _sf_save

pipe = ACEStepPipeline(checkpoint_dir="", dtype="bfloat16", torch_compile=False, cpu_offload=True, overlapped_decode=True)
pipe(format="wav", audio_duration={min(duration, 90)}, prompt="ambient drone, {bpm} bpm, {instrument}, no rhythm, dark, warm, consistent, minimal", lyrics="[inst]", infer_step=60, guidance_scale=10.0, scheduler_type="euler", cfg_type="apg", omega_scale=10.0, manual_seeds="42", guidance_interval=0.5, guidance_interval_decay=0.0, min_guidance_scale=3.0, use_erg_tag=True, use_erg_lyric=False, use_erg_diffusion=True, oss_steps="", guidance_scale_text=0.0, guidance_scale_lyric=0.0, save_path="{output_file}")
'''
    script_path = f"/tmp/gen-drone.py"
    with open(script_path, "w") as f:
        f.write(gen_script)
    
    subprocess.run([
        "/mnt/homes/galileo/argo/Development/ACE-Step/.venv/bin/python", script_path
    ], capture_output=True)
    
    # Loop if needed
    if duration > 90:
        loop_sound(output_file, duration, output_file)
    
    return output_file


def add_gongs(audio_file, gong_interval, output_file):
    """Add gongs at regular intervals."""
    # Get gong sound
    gong_files = get_sounds("gongs")
    if not gong_files:
        print("No gong sounds found")
        return audio_file
    
    gong_file = gong_files[0]
    
    # Get audio duration
    probe = subprocess.run([
        "ffprobe", "-v", "quiet", "-show_entries", "format=duration",
        "-of", "csv=p=0", str(audio_file)
    ], capture_output=True, text=True)
    duration = float(probe.stdout.strip())
    
    # Create gong track (silence with gongs at intervals)
    gong_track = f"/tmp/gong-track.wav"
    
    # Build filter for adding gongs
    filter_parts = []
    inputs = ["-i", str(audio_file)]
    
    # Add gong at each interval
    gong_count = int(duration // gong_interval)
    for i in range(gong_count):
        start_time = (i + 1) * gong_interval
        inputs.extend(["-i", str(gong_file)])
        filter_parts.append(f"[{i+1}:a]adelay={int(start_time*1000)}|{int(start_time*1000)}[g{i}]")
    
    if not filter_parts:
        # No gongs to add, just copy
        subprocess.run(["cp", str(audio_file), str(output_file)])
        return output_file
    
    # Mix all gongs with original
    mix_inputs = "[0:a]"
    for i in range(gong_count):
        mix_inputs += f"[g{i}]"
    
    filter_str = ";".join(filter_parts)
    filter_str += f";{mix_inputs}amix=inputs={gong_count+1}:duration=first:dropout_transition=0[out]"
    
    cmd = ["ffmpeg", "-y"] + inputs + [
        "-filter_complex", filter_str,
        "-map", "[out]",
        str(output_file)
    ]
    
    subprocess.run(cmd, capture_output=True)
    return output_file


def mix_layers(layers, volumes, output_file):
    """Mix multiple audio layers."""
    if len(layers) == 1:
        subprocess.run(["cp", str(layers[0]), str(output_file)])
        return output_file
    
    inputs = []
    filter_parts = []
    
    for i, (layer, vol) in enumerate(zip(layers, volumes)):
        inputs.extend(["-i", str(layer)])
        filter_parts.append(f"[{i}:a]volume={vol}dB[v{i}]")
    
    # Mix all layers
    mix_str = "".join(f"[v{i}]" for i in range(len(layers)))
    filter_str = ";".join(filter_parts)
    filter_str += f";{mix_str}amix=inputs={len(layers)}:duration=first:dropout_transition=0[out]"
    
    cmd = ["ffmpeg", "-y"] + inputs + [
        "-filter_complex", filter_str,
        "-map", "[out]",
        str(output_file)
    ]
    
    subprocess.run(cmd, capture_output=True)
    return output_file


def add_fades(audio_file, fade_in, fade_out, output_file):
    """Add fade in and fade out."""
    # Get duration
    probe = subprocess.run([
        "ffprobe", "-v", "quiet", "-show_entries", "format=duration",
        "-of", "csv=p=0", str(audio_file)
    ], capture_output=True, text=True)
    duration = float(probe.stdout.strip())
    
    fade_out_start = duration - fade_out
    
    cmd = [
        "ffmpeg", "-y", "-i", str(audio_file),
        "-af", f"afade=t=in:d={fade_in},afade=t=out:st={fade_out_start}:d={fade_out}",
        str(output_file)
    ]
    
    subprocess.run(cmd, capture_output=True)
    return output_file


def main():
    parser = argparse.ArgumentParser(description="Ambient Track Generator")
    parser.add_argument("--type", required=True, choices=["focus", "deep-work", "relax", "meditate", "sleep"],
                        help="Track type")
    parser.add_argument("--layers", default="rain",
                        help="Comma-separated nature sound layers (e.g., rain,stream,wind)")
    parser.add_argument("--drone", action="store_true",
                        help="Add generated drone layer")
    parser.add_argument("--drone-bpm", type=int, help="Drone BPM (overrides profile default)")
    parser.add_argument("--drone-instrument", help="Drone instrument (overrides profile default)")
    parser.add_argument("--gongs", action="store_true",
                        help="Add gongs at regular intervals")
    parser.add_argument("--gong-interval", type=int, default=300,
                        help="Seconds between gongs (default: 300)")
    parser.add_argument("--duration", type=int, default=300,
                        help="Duration in seconds (default: 300)")
    parser.add_argument("--output-dir", default="/mnt/AllShare/Argobeat/generated/ambient",
                        help="Output directory")
    
    args = parser.parse_args()
    config = PROFILES[args.type]
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Parse layers
    layer_names = [l.strip() for l in args.layers.split(",")]
    
    print(f"Generating {args.type} track ({args.duration}s)")
    print(f"Layers: {layer_names}")
    print(f"Drone: {'Yes' if args.drone else 'No'}")
    print(f"Gongs: {'Yes' if args.gongs else 'No'}")
    print()
    
    # Generate layers
    layer_files = []
    layer_volumes = []
    
    for layer_name in layer_names:
        sounds = get_sounds(layer_name)
        if not sounds:
            print(f"Warning: No sounds found for {layer_name}")
            continue
        
        # Pick a random sound
        sound_file = random.choice(sounds)
        print(f"Layer: {layer_name} ({sound_file.name})")
        
        # Loop to duration
        layer_file = output_dir / f"temp-{layer_name}.wav"
        loop_sound(sound_file, args.duration, layer_file)
        
        layer_files.append(layer_file)
        layer_volumes.append(config["nature_volume"])
    
    # Add drone if requested
    if args.drone:
        drone_bpm = args.drone_bpm or config["drone_bpm"]
        drone_instrument = args.drone_instrument or config["drone_instrument"]
        
        print(f"Drone: {drone_instrument} @ {drone_bpm} BPM")
        
        drone_file = output_dir / "temp-drone.wav"
        generate_drone(args.duration, drone_instrument, drone_bpm, drone_file)
        
        layer_files.append(drone_file)
        layer_volumes.append(config["drone_volume"])
    
    if not layer_files:
        print("No layers to mix!")
        return
    
    # Mix layers
    print(f"\nMixing {len(layer_files)} layers...")
    mixed_file = output_dir / f"temp-mixed.wav"
    mix_layers(layer_files, layer_volumes, mixed_file)
    
    # Add gongs if requested
    if args.gongs:
        print(f"Adding gongs every {args.gong_interval}s...")
        gong_file = output_dir / "temp-gongs.wav"
        add_gongs(mixed_file, args.gong_interval, gong_file)
        mixed_file = gong_file
    
    # Add fades
    print("Adding fades...")
    output_file = output_dir / f"{args.type}-{args.layers.replace(',', '-')}-{args.duration}s.wav"
    add_fades(mixed_file, config["fade_in"], config["fade_out"], output_file)
    
    # Clean up temp files
    for layer_file in layer_files:
        if layer_file.exists():
            layer_file.unlink()
    if (output_dir / "temp-mixed.wav").exists():
        (output_dir / "temp-mixed.wav").unlink()
    if (output_dir / "temp-gongs.wav").exists():
        (output_dir / "temp-gongs.wav").unlink()
    
    print(f"\nDone! Output: {output_file}")


if __name__ == "__main__":
    main()
