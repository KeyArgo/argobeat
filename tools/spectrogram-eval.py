#!/usr/bin/env python3
"""
spectrogram-eval.py — Generate spectrogram visualizations for ArgoBeat audio candidates.

For each audio file, produces:
  1. Full spectrogram (time x frequency x amplitude) as PNG
  2. Low-frequency zoom spectrogram (0-500 Hz)
  3. Spectral centroid over time plot
  4. Waveform + RMS envelope overlay
  5. Loop boundary visualization (last 5s + first 5s overlaid) for files >= 60s

All plots use dark theme, 150 DPI, titled with the filename.
"""

import argparse
import os
import sys
import numpy as np
import librosa
import librosa.display
import matplotlib
matplotlib.use('Agg')  # headless rendering
import matplotlib.pyplot as plt
from pathlib import Path


def generate_all_plots(filepath: str, output_dir: str, sr_target: int = 22050):
    """Generate all visualization plots for a single audio file."""
    basename = os.path.splitext(os.path.basename(filepath))[0]
    print(f"  Processing: {basename}")

    # Load audio
    y, sr = librosa.load(filepath, sr=sr_target, mono=True)
    duration = librosa.get_duration(y=y, sr=sr)

    print(f"    Duration: {duration:.1f}s, Sample rate: {sr}, Samples: {len(y)}")

    # --- 1. Full spectrogram ---
    fig, ax = plt.subplots(figsize=(14, 8))
    S = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=256, fmax=sr//2)
    S_dB = librosa.power_to_db(S, ref=np.max)
    img = librosa.display.specshow(
        S_dB, sr=sr, x_axis='time', y_axis='mel', ax=ax, cmap='magma'
    )
    fig.colorbar(img, ax=ax, format='%+2.0f dB', shrink=0.8)
    ax.set_title(f'{basename} — Full Spectrogram (0–{sr//2} Hz)', fontsize=13, pad=10)
    fig.tight_layout()
    fig.savefig(os.path.join(output_dir, f'{basename}_spectrogram_full.png'), dpi=150, facecolor='black')
    plt.close(fig)
    print(f"    Saved: {basename}_spectrogram_full.png")

    # --- 2. Low-frequency zoom spectrogram (0-500 Hz) ---
    fig, ax = plt.subplots(figsize=(14, 5))
    S_low = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128, fmax=500)
    S_low_dB = librosa.power_to_db(S_low, ref=np.max)
    img = librosa.display.specshow(
        S_low_dB, sr=sr, x_axis='time', y_axis='hz', ax=ax, cmap='magma'
    )
    ax.set_ylim(0, 500)
    fig.colorbar(img, ax=ax, format='%+2.0f dB', shrink=0.8)
    ax.set_title(f'{basename} — Low-Frequency Zoom (0–500 Hz)', fontsize=13, pad=10)
    fig.tight_layout()
    fig.savefig(os.path.join(output_dir, f'{basename}_spectrogram_lowfreq.png'), dpi=150, facecolor='black')
    plt.close(fig)
    print(f"    Saved: {basename}_spectrogram_lowfreq.png")

    # --- 3. Spectral centroid over time ---
    fig, ax = plt.subplots(figsize=(14, 5))
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    times = librosa.times_like(centroid, sr=sr)
    ax.plot(times, centroid, color='#00ccff', linewidth=0.8)
    ax.fill_between(times, centroid, alpha=0.15, color='#00ccff')
    ax.set_ylabel('Frequency (Hz)')
    ax.set_xlabel('Time (s)')
    ax.set_title(f'{basename} — Spectral Centroid Over Time', fontsize=13, pad=10)
    ax.set_xlim(0, duration)
    # Add mean line
    mean_c = np.mean(centroid)
    ax.axhline(y=mean_c, color='#ff6666', linestyle='--', alpha=0.7, label=f'Mean: {mean_c:.0f} Hz')
    ax.legend(loc='upper right', fontsize=9)
    fig.tight_layout()
    fig.savefig(os.path.join(output_dir, f'{basename}_spectral_centroid.png'), dpi=150, facecolor='black')
    plt.close(fig)
    print(f"    Saved: {basename}_spectral_centroid.png")

    # --- 4. Waveform + RMS envelope overlay ---
    fig, ax = plt.subplots(figsize=(14, 5))
    t = np.linspace(0, duration, num=len(y))
    ax.plot(t, y, color='#4488cc', linewidth=0.3, alpha=0.7, label='Waveform')
    # RMS envelope
    frame_length = 2048
    hop_length = 512
    rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
    rms_times = librosa.times_like(rms, sr=sr, hop_length=hop_length)
    # Scale RMS to match waveform amplitude range for visual overlay
    max_abs = np.max(np.abs(y))
    if max_abs > 0:
        rms_scaled = rms * (max_abs / np.max(rms) if np.max(rms) > 0 else 1)
    else:
        rms_scaled = rms
    ax.plot(rms_times, rms_scaled, color='#ff4444', linewidth=1.5, alpha=0.9, label='RMS Envelope')
    ax.fill_between(rms_times, 0, rms_scaled, alpha=0.15, color='#ff4444')
    ax.set_ylabel('Amplitude')
    ax.set_xlabel('Time (s)')
    ax.set_title(f'{basename} — Waveform + RMS Envelope', fontsize=13, pad=10)
    ax.set_xlim(0, duration)
    ax.set_ylim(-max_abs * 1.1, max_abs * 1.1)
    ax.legend(loc='upper right', fontsize=9)
    fig.tight_layout()
    fig.savefig(os.path.join(output_dir, f'{basename}_waveform_rms.png'), dpi=150, facecolor='black')
    plt.close(fig)
    print(f"    Saved: {basename}_waveform_rms.png")

    # --- 5. Loop boundary visualization (files >= 60s) ---
    if duration >= 60.0:
        fig, ax = plt.subplots(figsize=(14, 5))
        boundary_sec = 5.0
        n_boundary = int(boundary_sec * sr)

        # Last 5 seconds
        last_5 = y[-n_boundary:]
        # First 5 seconds
        first_5 = y[:n_boundary]

        # Create a common time axis for overlay
        t_boundary = np.linspace(0, boundary_sec, n_boundary)

        ax.plot(t_boundary, last_5, color='#ff6644', linewidth=0.5, alpha=0.7, label='Last 5s')
        ax.plot(t_boundary, first_5, color='#44ccff', linewidth=0.5, alpha=0.7, label='First 5s')

        # Also show spectrograms of both in background for comparison
        ax2 = ax.twinx()
        S_last = librosa.feature.melspectrogram(y=last_5, sr=sr, n_mels=64, fmax=sr//2)
        S_first = librosa.feature.melspectrogram(y=first_5, sr=sr, n_mels=64, fmax=sr//2)
        S_last_dB = librosa.power_to_db(S_last, ref=np.max)
        S_first_dB = librosa.power_to_db(S_first, ref=np.max)

        # Compute spectral difference
        spec_diff = np.mean(np.abs(S_last_dB - S_first_dB))
        # RMS difference
        rms_last = np.sqrt(np.mean(last_5**2))
        rms_first = np.sqrt(np.mean(first_5**2))
        rms_diff_pct = abs(rms_last - rms_first) / max(rms_first, 1e-10) * 100

        ax.set_ylabel('Amplitude', color='#cccccc')
        ax2.set_yticks([])
        ax.set_xlabel('Time (s)')
        ax.set_title(
            f'{basename} — Loop Boundary (last 5s ↔ first 5s) | '
            f'Spec Δ: {spec_diff:.1f} dB, RMS Δ: {rms_diff_pct:.1f}%',
            fontsize=12, pad=10
        )
        ax.set_xlim(0, boundary_sec)
        ax.legend(loc='upper right', fontsize=9)

        fig.tight_layout()
        fig.savefig(os.path.join(output_dir, f'{basename}_loop_boundary.png'), dpi=150, facecolor='black')
        plt.close(fig)
        print(f"    Saved: {basename}_loop_boundary.png")
    else:
        print(f"    Skipping loop boundary (duration {duration:.1f}s < 60s)")


def main():
    parser = argparse.ArgumentParser(description='Generate spectrogram evaluations for audio files')
    parser.add_argument('--input', '-i', required=True, help='Input directory containing WAV/MP3 files')
    parser.add_argument('--output', '-o', required=True, help='Output directory for PNG spectrograms')
    parser.add_argument('--sr', type=int, default=22050, help='Target sample rate (default: 22050)')
    args = parser.parse_args()

    input_dir = args.input
    output_dir = args.output

    if not os.path.isdir(input_dir):
        print(f"ERROR: Input directory not found: {input_dir}")
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)

    # Find all audio files
    audio_extensions = {'.wav', '.mp3', '.flac', '.ogg'}
    audio_files = sorted([
        os.path.join(input_dir, f)
        for f in os.listdir(input_dir)
        if os.path.splitext(f)[1].lower() in audio_extensions
    ])

    if not audio_files:
        print(f"ERROR: No audio files found in {input_dir}")
        sys.exit(1)

    print(f"Found {len(audio_files)} audio file(s) in {input_dir}")
    print(f"Output directory: {output_dir}")
    print(f"Sample rate target: {args.sr}")
    print()

    for filepath in audio_files:
        try:
            generate_all_plots(filepath, output_dir, sr_target=args.sr)
            print()
        except Exception as e:
            print(f"  ERROR processing {os.path.basename(filepath)}: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc()
            print()

    print("Done!")


if __name__ == '__main__':
    main()
