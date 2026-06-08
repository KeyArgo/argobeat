#!/usr/bin/env python3
"""
Ambient Sound Mixer — Mix nature sounds with generated drones

Usage:
    python3 ambient-mixer.py --sound rain --drone --drone-instrument synth-pad --duration 300
    python3 ambient-mixer.py --sound stream --no-drone --duration 600
    python3 ambient-mixer.py --sound wind --drone --drone-bpm 50 --duration 1800
"""
import argparse
import subprocess
import sys
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
        "-af", "volume=-10dB",
        str(output_file)
    ]
    subprocess.run(cmd, capture_output=True)
    return output_file


def generate_drone(duration, instrument, bpm, output_file):
    """Generate a drone pad."""
    # Use the existing generator
    gen_script = f'''
import sys, time, torch, torchaudio, soundfile as sf
from acestep.pipeline_ace_step import ACEStepPipeline

def _sf_save(filepath, src, sample_rate, format=None, backend=None, **kw):
    wav = src.detach().cpu().float()
    if wav.dim() == 2: wav = wav.t()
    sf.write(filepath, wav.numpy(), int(sample_rate))
torchaudio.save = _sf_save

pipe = ACEStepPipeline(checkpoint_dir="", dtype="bfloat16", torch_compile=False, cpu_offload=True, overlapped_decode=True)
pipe(format="wav", audio_duration={min(duration, 90)}, prompt="ambient drone, {bpm} bpm, {instrument}, no rhythm, dark, warm, consistent", lyrics="[inst]", infer_step=60, guidance_scale=10.0, scheduler_type="euler", cfg_type="apg", omega_scale=10.0, manual_seeds="42", guidance_interval=0.5, guidance_interval_decay=0.0, min_guidance_scale=3.0, use_erg_tag=True, use_erg_lyric=False, use_erg_diffusion=True, oss_steps="", guidance_scale_text=0.0, guidance_scale_lyric=0.0, save_path="{output_file}")
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


def mix_sounds(sound_file, drone_file, output_file, sound_volume=-10, drone_volume=-20):
    """Mix nature sound with drone."""
    cmd = [
        "ffmpeg", "-y",
        "-i", str(sound_file),
        "-i", str(drone_file),
        "-filter_complex",
        f"[0:a]volume={sound_volume}dB[s];[1:a]volume={drone_volume}dB[d];[s][d]amix=inputs=2:duration=first[out]",
        "-map", "[out]",
        str(output_file)
    ]
    subprocess.run(cmd, capture_output=True)
    return output_file


def main():
    parser = argparse.ArgumentParser(description="Ambient Sound Mixer")
    parser.add_argument("--sound", required=True, choices=list(SOUND_MAP.keys()),
                        help="Nature sound category")
    parser.add_argument("--drone", action="store_true",
                        help="Add generated drone layer")
    parser.add_argument("--drone-instrument", default="synth-pad",
                        help="Drone instrument (if --drone)")
    parser.add_argument("--drone-bpm", type=int, default=50,
                        help="Drone BPM (if --drone)")
    parser.add_argument("--duration", type=int, default=300,
                        help="Duration in seconds (default: 300)")
    parser.add_argument("--output-dir", default="/mnt/AllShare/Argobeat/generated/ambient",
                        help="Output directory")
    
    args = parser.parse_args()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Get sounds
    sounds = get_sounds(args.sound)
    if not sounds:
        print(f"No sounds found for {args.sound}")
        return
    
    print(f"Found {len(sounds)} {args.sound} sounds")
    
    # Pick the first sound (or random)
    sound_file = sounds[0]
    print(f"Using: {sound_file.name}")
    
    # Loop to duration
    looped_file = output_dir / f"{args.sound}-looped.wav"
    print(f"Looping to {args.duration}s...")
    loop_sound(sound_file, args.duration, looped_file)
    
    if args.drone:
        # Generate drone
        drone_file = output_dir / f"drone-{args.drone_instrument}-{args.drone_bpm}bpm.wav"
        print(f"Generating drone: {args.drone_instrument} @ {args.drone_bpm} BPM...")
        generate_drone(args.duration, args.drone_instrument, args.drone_bpm, drone_file)
        
        # Mix
        output_file = output_dir / f"{args.sound}-with-drone.wav"
        print("Mixing...")
        mix_sounds(looped_file, drone_file, output_file)
        
        print(f"\nDone! Output: {output_file}")
    else:
        print(f"\nDone! Output: {looped_file}")
        print("Tip: Add --drone to mix with a generated drone pad")


if __name__ == "__main__":
    main()
