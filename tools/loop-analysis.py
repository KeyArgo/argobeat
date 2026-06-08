#!/usr/bin/env python3
"""
Loop Analysis Tool for ArgoBeat Audio Candidates

Finds optimal loop points for audio files by analyzing spectral similarity,
amplitude continuity, and phase coherence between candidate end/start pairs.
Generates loop test WAVs and JSON reports.
"""

import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np
import soundfile as sf


def load_audio(filepath):
    """Load audio file using soundfile (WAV) or fallback for MP3."""
    ext = Path(filepath).suffix.lower()
    if ext == '.mp3':
        # Try pydub/ffmpeg for mp3
        try:
            from pydub import AudioSegment
            audio = AudioSegment.from_file(filepath)
            audio = audio.set_channels(1).set_frame_rate(44100)
            samples = np.array(audio.get_array_of_samples(), dtype=np.float32)
            samples = samples / 32768.0
            return samples, 44100
        except ImportError:
            # Fallback: use ffmpeg via subprocess to convert to wav first
            import subprocess
            import tempfile
            tmp_wav = tempfile.mktemp(suffix='.wav')
            subprocess.run(['ffmpeg', '-y', '-i', filepath, '-ac', '1', '-ar', '44100', tmp_wav],
                           capture_output=True)
            data, sr = sf.read(tmp_wav, dtype='float32')
            if data.ndim > 1:
                data = data.mean(axis=1)
            os.unlink(tmp_wav)
            return data, sr
    else:
        data, sr = sf.read(filepath, dtype='float32')
        if data.ndim > 1:
            data = data.mean(axis=1)
        return data, sr


def find_zero_crossings(audio, region_start, region_end):
    """Find zero-crossing points in a region of audio."""
    region = audio[region_start:region_end]
    if len(region) < 2:
        return []

    crossings = []
    for i in range(1, len(region)):
        if (region[i-1] >= 0 and region[i] < 0) or (region[i-1] < 0 and region[i] >= 0):
            crossings.append(region_start + i)
    return crossings


def compute_stft_magnitude(audio, sr, n_fft=2048, hop_length=512):
    """Compute mean STFT magnitude spectrum for a segment of audio."""
    if len(audio) < n_fft:
        audio = np.pad(audio, (0, n_fft - len(audio)))
    # Compute STFT
    from numpy.fft import rfft
    windowed = np.array([
        audio[i:i+n_fft] * np.hanning(n_fft)
        for i in range(0, len(audio) - n_fft + 1, hop_length)
    ])
    if len(windowed) == 0:
        return np.zeros(n_fft // 2 + 1)
    magnitudes = np.abs(np.array([rfft(frame) for frame in windowed]))
    # Mean magnitude spectrum
    return magnitudes.mean(axis=0)


def cosine_similarity(a, b):
    """Compute cosine similarity between two vectors."""
    dot = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def score_loop_candidate(audio, sr, end_sample, start_sample,
                         window_size=2048, hop=512):
    """
    Score a loop candidate (end_point -> start_point) on 0-100 scale.
    Components:
      - Spectral continuity (cosine similarity of STFT magnitudes): 40%
      - Amplitude continuity (matching RMS levels): 30%
      - Phase coherence (correlation of adjacent waveform): 30%
    """
    # --- Spectral continuity (40 points) ---
    # Get STFT magnitudes for 1s window ending at end_sample and 1s window starting at start_sample
    window_samples = sr  # 1 second windows

    end_region_start = max(0, end_sample - window_samples)
    end_region = audio[end_region_start:end_sample]
    start_region = audio[start_sample:min(len(audio), start_sample + window_samples)]

    end_spectrum = compute_stft_magnitude(end_region, sr, window_size, hop)
    start_spectrum = compute_stft_magnitude(start_region, sr, window_size, hop)

    spec_sim = cosine_similarity(end_spectrum, start_spectrum)
    spectral_score = max(0, spec_sim) * 40.0

    # --- Amplitude continuity (30 points) ---
    # RMS of last 100ms before end and first 100ms after start
    analysis_window = int(0.1 * sr)  # 100ms
    end_chunk = audio[max(0, end_sample - analysis_window):end_sample]
    start_chunk = audio[start_sample:min(len(audio), start_sample + analysis_window)]

    if len(end_chunk) > 0 and len(start_chunk) > 0:
        rms_end = np.sqrt(np.mean(end_chunk ** 2))
        rms_start = np.sqrt(np.mean(start_chunk ** 2))
        # Relative difference
        max_rms = max(rms_end, rms_start)
        if max_rms > 1e-8:
            amp_ratio = min(rms_end, rms_start) / max_rms
        else:
            amp_ratio = 1.0  # both silent = perfect match
        amplitude_score = amp_ratio * 30.0
    else:
        amplitude_score = 0.0

    # --- Phase coherence (30 points) ---
    # Check waveform correlation around the junction
    coh_len = min(int(0.01 * sr), 440)  # ~10ms or 440 samples
    end_tail = audio[max(0, end_sample - coh_len):end_sample]
    start_head = audio[start_sample:min(len(audio), start_sample + coh_len)]

    if len(end_tail) > 1 and len(start_head) > 1:
        min_len = min(len(end_tail), len(start_head))
        end_tail = end_tail[:min_len]
        start_head = start_head[:min_len]
        # Remove DC
        end_tail = end_tail - end_tail.mean()
        start_head = start_head - start_head.mean()
        # Correlation
        denom = np.sqrt(np.sum(end_tail**2) * np.sum(start_head**2))
        if denom > 1e-10:
            corr = np.sum(end_tail * start_head) / denom
        else:
            corr = 0.0
        phase_score = max(0, corr) * 30.0
    else:
        phase_score = 0.0

    total_score = spectral_score + amplitude_score + phase_score
    return min(100.0, max(0.0, total_score))


def find_best_loop_point(audio, sr, num_candidates=20):
    """
    Find the best loop point by analyzing zero-crossings in last/first 20%.
    Returns (best_timestamp, best_score, all_scores).
    """
    duration_samples = len(audio)
    last_20_start = int(duration_samples * 0.80)
    first_20_end = int(duration_samples * 0.20)

    # Find zero-crossings in both regions
    end_crossings = find_zero_crossings(audio, last_20_start, duration_samples)
    start_crossings = find_zero_crossings(audio, 0, first_20_end)

    if not end_crossings:
        end_crossings = [duration_samples]
    if not start_crossings:
        start_crossings = [0]

    # If too many crossings, thin them out
    if len(end_crossings) > num_candidates:
        indices = np.linspace(0, len(end_crossings) - 1, num_candidates, dtype=int)
        end_crossings = [end_crossings[i] for i in indices]
    if len(start_crossings) > num_candidates:
        indices = np.linspace(0, len(start_crossings) - 1, num_candidates, dtype=int)
        start_crossings = [start_crossings[i] for i in indices]

    all_scores = []

    for end_sample in end_crossings:
        for start_sample in start_crossings:
            # Skip if loop would be too short (< 0.5s)
            loop_length = (duration_samples - end_sample) + start_sample
            if loop_length < int(0.5 * sr):
                continue

            score = score_loop_candidate(audio, sr, end_sample, start_sample)
            timestamp = end_sample / sr  # time where file should be cut
            all_scores.append({
                "end_sample": int(end_sample),
                "start_sample": int(start_sample),
                "timestamp": round(timestamp, 4),
                "score": round(score, 2)
            })

    if not all_scores:
        # Fallback: simple midpoint
        mid = duration_samples // 2
        return mid / sr, 0.0, []

    best = max(all_scores, key=lambda x: x["score"])
    return best["timestamp"], best["score"], all_scores


def generate_loop_test(audio, sr, loop_timestamp, output_path):
    """
    Generate a loop test WAV: last 3 seconds + first 3 seconds
    with a 50ms equal-power crossfade.
    """
    # Ensure stereo output for the crossfade visualization
    # But we work in mono internally
    crossfade_samples = int(0.050 * sr)  # 50ms
    segment_samples = int(3.0 * sr)     # 3 seconds

    # Find the actual loop point (nearest zero-crossing near the timestamp)
    loop_sample = int(loop_timestamp * sr)

    # Last 3 seconds ending at the loop point
    end_start = max(0, loop_sample - segment_samples)
    end_region = audio[end_start:loop_sample]
    # If shorter than 3s, pad with silence
    if len(end_region) < segment_samples:
        end_region = np.pad(end_region, (segment_samples - len(end_region), 0))

    # First 3 seconds starting at the loop point
    start_end = min(len(audio), loop_sample + segment_samples)
    start_region = audio[loop_sample:start_end]
    if len(start_region) < segment_samples:
        start_region = np.pad(start_region, (0, segment_samples - len(start_region)))

    # Equal-power crossfade
    # Using sin^2 / cos^2 curves for constant power
    fade_out = np.sin(np.linspace(np.pi / 2, 0, crossfade_samples)) ** 2
    fade_in = np.cos(np.linspace(np.pi / 2, 0, crossfade_samples)) ** 2

    # Build the loop test: [end_region] + [crossfade overlap] + [start_region]
    # The last crossfade_samples of end_region overlap with first crossfade_samples of start_region
    overlap_end = end_region[-crossfade_samples:].copy()
    overlap_start = start_region[:crossfade_samples].copy()

    # Apply crossfade
    faded_out = overlap_end * fade_out
    faded_in = overlap_start * fade_in
    crossfaded = faded_out + faded_in

    # Assemble: main end part (without crossfade region) + crossfade + remaining start part
    main_end = end_region[:-crossfade_samples]
    remaining_start = start_region[crossfade_samples:]

    result = np.concatenate([main_end, crossfaded, remaining_start])

    # Write as WAV (mono, at original sample rate)
    sf.write(output_path, result.astype(np.float32), sr, format='WAV', subtype='PCM_16')
    return result


def process_file(input_path, output_dir, filename):
    """Process a single audio file: find loop points, generate test WAV, save report."""
    filepath = os.path.join(input_path, filename)
    if not os.path.exists(filepath):
        print(f"  ERROR: File not found: {filepath}")
        return None

    print(f"  Loading {filename}...")
    audio, sr = load_audio(filepath)
    duration = len(audio) / sr
    print(f"    Duration: {duration:.2f}s, SR: {sr}, Samples: {len(audio)}")

    print(f"    Analyzing loop points...")
    best_timestamp, best_score, all_scores = find_best_loop_point(audio, sr)

    print(f"    Best loop point: {best_timestamp:.4f}s (score: {best_score:.1f}/100)")
    print(f"    Total candidates evaluated: {len(all_scores)}")

    # Generate loop test WAV
    stem = Path(filename).stem
    loop_wav_path = os.path.join(output_dir, f"{stem}_loop-test.wav")
    print(f"    Generating loop test WAV...")
    generate_loop_test(audio, sr, best_timestamp, loop_wav_path)
    print(f"    Saved: {loop_wav_path}")

    # Save JSON report
    report = {
        "filename": filename,
        "duration": round(duration, 4),
        "sample_rate": sr,
        "best_loop_timestamp": best_timestamp,
        "best_loop_score": best_score,
        "num_candidates": len(all_scores),
        "all_candidate_scores": all_scores
    }
    json_path = os.path.join(output_dir, f"{stem}_loop-report.json")
    with open(json_path, 'w') as f:
        json.dump(report, f, indent=2)
    print(f"    Saved report: {json_path}")

    return report


def main():
    parser = argparse.ArgumentParser(description="ArgoBeat Loop Analysis Tool")
    parser.add_argument('--input', '-i', required=True,
                        help='Input directory containing audio files')
    parser.add_argument('--output', '-o', required=True,
                        help='Output directory for loop test WAVs and reports')
    args = parser.parse_args()

    input_dir = args.input
    output_dir = args.output

    os.makedirs(output_dir, exist_ok=True)

    # Target files
    target_files = [
        "acestep-dark-focus-seed750401-mono.wav",
        "acestep-dark-focus-seed750401-narrow.wav",
        "minimax-quiet-orbit.mp3",
        "musicgen-bakeoff-v1.wav",
        "musicgen-bakeoff-v2.wav",
        "musicgen-listenpack-v1.wav",
        "musicgen-listenpack-v2.wav",
    ]

    print("=" * 70)
    print("ArgoBeat Loop Analysis Tool")
    print(f"Input:  {input_dir}")
    print(f"Output: {output_dir}")
    print("=" * 70)

    results = []
    for filename in target_files:
        print(f"\n[{filename}]")
        report = process_file(input_dir, output_dir, filename)
        if report:
            results.append(report)

    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    for r in results:
        print(f"  {r['filename']}")
        print(f"    Duration: {r['duration']:.2f}s | "
              f"Best loop: {r['best_loop_timestamp']:.4f}s | "
              f"Score: {r['best_loop_score']:.1f}/100")

    # Verify outputs
    print("\n" + "-" * 70)
    print("Output files created:")
    for f in os.listdir(output_dir):
        fpath = os.path.join(output_dir, f)
        size = os.path.getsize(fpath)
        print(f"  {f} ({size:,} bytes)")

    print(f"\nProcessed {len(results)}/{len(target_files)} files.")
    return 0


if __name__ == '__main__':
    sys.exit(main())
