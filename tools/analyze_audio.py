#!/usr/bin/env python3
"""ArgoBeat audio quality and target-rate marker analysis.

This tool measures objective audio properties only. It can verify that an
export contains target-rate audio modulation; it cannot prove neurological or
medical effects.

Usage:
  python tools/analyze_audio.py --file session.wav --mood focus
  python tools/analyze_audio.py --file session.wav --mood focus --target-hz 14.8
  python tools/analyze_audio.py --hybrid focus-new.wav --current focus-old.wav --mood focus
"""

import argparse
import json
import sys
from pathlib import Path

import librosa
import numpy as np


MOOD_TARGETS = {
    'focus': {'lufs': (-20, -14), 'centroid': (1000, 1600), 'bpm': (72, 96), 'hz': 15.0},
    'deepWork': {'lufs': (-20, -14), 'centroid': (900, 1500), 'bpm': (76, 100), 'hz': 18.0},
    'relax': {'lufs': (-22, -16), 'centroid': (700, 1300), 'bpm': (55, 85), 'hz': 10.0},
    'meditate': {'lufs': (-22, -16), 'centroid': (500, 1100), 'bpm': (45, 75), 'hz': 6.0},
    'sleep': {'lufs': (-24, -18), 'centroid': (400, 1000), 'bpm': (35, 70), 'hz': 2.0},
}

UNIVERSAL = {
    'harmonic_ratio': 0.55,
    'noise_floor': -45,
    'repetition': 0.35,
    'spectral_spread': (400, 1600),
    'short_loop_similarity': 0.98,
    'target_prominence_db': 6.0,
    'target_share': 0.005,
    'sample_peak_dbfs': -1.0,
    'clipped_samples': 0,
}


def _to_mono(y: np.ndarray) -> np.ndarray:
    if y.ndim == 1:
        return y
    return np.mean(y, axis=0)


def _envelope_metrics(y: np.ndarray, sr: int, target_hz: float) -> dict:
    """Measure target-rate amplitude modulation in a decoded waveform."""
    frame = 256
    hop = 220
    if y.size < frame * 4:
        return {}

    env = []
    for i in range(0, y.size - frame, hop):
        env.append(np.sqrt(np.mean(y[i:i + frame] ** 2)))

    envelope = np.asarray(env, dtype=np.float64)
    envelope_sr = sr / hop
    envelope -= np.mean(envelope)
    if envelope.size < 8 or np.max(np.abs(envelope)) < 1e-9:
        return {}

    spectrum = np.abs(np.fft.rfft(envelope * np.hanning(envelope.size))) ** 2
    freqs = np.fft.rfftfreq(envelope.size, d=1 / envelope_sr)

    search = (freqs >= max(0.1, target_hz - 0.75)) & (freqs <= target_hz + 0.75)
    if not np.any(search):
        return {}

    search_indices = np.flatnonzero(search)
    peak_index = search_indices[np.argmax(spectrum[search])]

    local = (freqs >= max(0.1, target_hz - 4.0)) & (freqs <= target_hz + 4.0)
    local &= ~((freqs >= target_hz - 0.75) & (freqs <= target_hz + 0.75))
    median_power = float(np.median(spectrum[local])) if np.any(local) else 1e-18
    peak_power = float(spectrum[peak_index])
    prominence_db = 10 * np.log10((peak_power + 1e-18) / (median_power + 1e-18))

    band = (freqs >= 0.5) & (freqs <= 25.0)
    target = (freqs >= target_hz - 0.5) & (freqs <= target_hz + 0.5)
    target_share = float(np.sum(spectrum[target]) / (np.sum(spectrum[band]) + 1e-18))

    return {
        'entrainment_target_hz': round(target_hz, 2),
        'entrainment_peak_hz': round(float(freqs[peak_index]), 2),
        'entrainment_prominence_db': round(float(prominence_db), 1),
        'entrainment_target_share': round(target_share, 4),
    }


def _short_loop_similarity(y: np.ndarray, sr: int) -> float:
    """Estimate repeated 10-second spectral texture similarity."""
    seg_len = 10 * sr
    if y.size < seg_len * 3:
        return 1.0

    features = []
    for start in range(0, y.size - seg_len + 1, seg_len):
        segment = y[start:start + seg_len]
        spec = np.abs(librosa.stft(segment, n_fft=2048, hop_length=1024))
        profile = np.mean(librosa.amplitude_to_db(spec + 1e-10), axis=1)
        features.append(profile / (np.linalg.norm(profile) + 1e-10))

    max_sim = -1.0
    for i in range(len(features)):
        for j in range(i + 1, len(features)):
            max_sim = max(max_sim, float(np.dot(features[i], features[j])))
    return max_sim


def analyze(filepath: str, sr: int = 44100, target_hz: float | None = None) -> dict:
    """Analyze a single audio file and return metrics."""
    y_raw, sr = librosa.load(filepath, sr=sr, mono=False)
    y = _to_mono(y_raw)
    duration = len(y) / sr

    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)[0]
    y_harm, _ = librosa.effects.hpss(y, margin=2.0)

    rms = np.sqrt(np.mean(y ** 2))
    sample_peak = float(np.max(np.abs(y)))
    frame_rms = []
    hop = 2048
    for i in range(0, len(y) - hop, hop // 2):
        frame_rms.append(np.sqrt(np.mean(y[i:i + hop] ** 2)))

    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    chroma = librosa.feature.chroma_cens(y=y, sr=sr, hop_length=512)
    n_frames = chroma.shape[1]
    rep_count = 0
    window = min(20, n_frames // 4)
    for i in range(n_frames):
        lo = max(0, i - window)
        hi = min(n_frames, i + window)
        segment = chroma[:, lo:hi]
        sims = []
        for j in range(segment.shape[1]):
            dot = np.dot(chroma[:, i], segment[:, j])
            norm = np.linalg.norm(chroma[:, i]) * np.linalg.norm(segment[:, j]) + 1e-10
            sims.append(dot / norm)
        if sum(1 for s in sims if s > 0.85) > 3:
            rep_count += 1

    stereo_pan_prominence_db = None
    if isinstance(y_raw, np.ndarray) and y_raw.ndim == 2 and y_raw.shape[0] >= 2 and target_hz:
        pan_metrics = _envelope_metrics(y_raw[0] - y_raw[1], sr, target_hz)
        stereo_pan_prominence_db = pan_metrics.get('entrainment_prominence_db')

    entrainment = _envelope_metrics(y, sr, target_hz) if target_hz else {}

    return {
        'file': filepath,
        'duration_s': round(duration, 1),
        'centroid_hz': round(float(np.mean(centroid))),
        'spectral_spread_hz': round(float(np.mean(bandwidth))),
        'harmonic_ratio': round(float(np.sum(y_harm ** 2) / (np.sum(y ** 2) + 1e-10)), 3),
        'rms_db': round(float(20 * np.log10(rms + 1e-10)), 1),
        'noise_floor_db': round(float(20 * np.log10(np.percentile(frame_rms, 10) + 1e-10)) if frame_rms else -60.0, 1),
        'tempo_bpm': round(float(np.atleast_1d(tempo)[0]), 1),
        'repetition_ratio': round(rep_count / max(n_frames, 1), 3),
        'short_loop_similarity': round(_short_loop_similarity(y, sr), 3),
        'sample_peak_dbfs': round(float(20 * np.log10(sample_peak + 1e-10)), 2),
        'clipped_samples': int(np.sum(np.abs(y) >= 0.999)),
        'stereo_pan_prominence_db': stereo_pan_prominence_db,
        **entrainment,
    }


def check_pass(value, target_range=None, target_min=None, target_max=None) -> str:
    if target_range:
        lo, hi = target_range
        return 'PASS' if lo <= value <= hi else 'FAIL'
    if target_min is not None:
        return 'PASS' if value >= target_min else 'FAIL'
    if target_max is not None:
        return 'PASS' if value <= target_max else 'FAIL'
    return 'INFO'


def print_single(results: dict, mood: str):
    targets = MOOD_TARGETS.get(mood, MOOD_TARGETS['focus'])
    print(f"\n{'=' * 72}")
    print(f"  ARGOBEAT AUDIO QA - {mood.upper()} MODE")
    print(f"{'=' * 72}")
    print(f"  File: {results['file']}")
    print(f"  Duration: {results['duration_s']}s")
    print(f"\n{'Metric':<25} {'Value':>14} {'Target':>18} {'Status':>8}")
    print(f"{'-' * 72}")

    rows = [
        ('Spectral Centroid', f"{results['centroid_hz']} Hz", f"{targets['centroid'][0]}-{targets['centroid'][1]}", check_pass(results['centroid_hz'], target_range=targets['centroid'])),
        ('Spectral Spread', f"{results['spectral_spread_hz']} Hz", f"{UNIVERSAL['spectral_spread'][0]}-{UNIVERSAL['spectral_spread'][1]}", check_pass(results['spectral_spread_hz'], target_range=UNIVERSAL['spectral_spread'])),
        ('Harmonic Energy', f"{results['harmonic_ratio']:.3f}", f">={UNIVERSAL['harmonic_ratio']}", check_pass(results['harmonic_ratio'], target_min=UNIVERSAL['harmonic_ratio'])),
        ('RMS Loudness', f"{results['rms_db']} dB", f"{targets['lufs'][0]} to {targets['lufs'][1]}", check_pass(results['rms_db'], target_range=targets['lufs'])),
        ('Noise Floor', f"{results['noise_floor_db']} dB", f"<{UNIVERSAL['noise_floor']}", check_pass(results['noise_floor_db'], target_max=UNIVERSAL['noise_floor'])),
        ('Tempo', f"{results['tempo_bpm']} BPM", f"{targets['bpm'][0]}-{targets['bpm'][1]}", check_pass(results['tempo_bpm'], target_range=targets['bpm'])),
        ('Repetition Ratio', f"{results['repetition_ratio']:.1%}", f"<{UNIVERSAL['repetition']:.0%}", check_pass(results['repetition_ratio'], target_max=UNIVERSAL['repetition'])),
        ('Short Loop Similarity', f"{results['short_loop_similarity']:.3f}", f"<{UNIVERSAL['short_loop_similarity']}", check_pass(results['short_loop_similarity'], target_max=UNIVERSAL['short_loop_similarity'])),
        ('Sample Peak', f"{results['sample_peak_dbfs']} dBFS", f"<={UNIVERSAL['sample_peak_dbfs']}", check_pass(results['sample_peak_dbfs'], target_max=UNIVERSAL['sample_peak_dbfs'])),
        ('Clipped Samples', str(results['clipped_samples']), str(UNIVERSAL['clipped_samples']), check_pass(results['clipped_samples'], target_max=UNIVERSAL['clipped_samples'])),
    ]

    if 'entrainment_peak_hz' in results:
        target_error = abs(results['entrainment_peak_hz'] - results['entrainment_target_hz'])
        rows.extend([
            ('Target Mod Peak', f"{results['entrainment_peak_hz']} Hz", f"{results['entrainment_target_hz']} +/-0.75", check_pass(target_error, target_max=0.75)),
            ('Target Prominence', f"{results['entrainment_prominence_db']} dB", f">={UNIVERSAL['target_prominence_db']}", check_pass(results['entrainment_prominence_db'], target_min=UNIVERSAL['target_prominence_db'])),
            ('Target Power Share', f"{results['entrainment_target_share']:.2%}", f">={UNIVERSAL['target_share']:.2%}", check_pass(results['entrainment_target_share'], target_min=UNIVERSAL['target_share'])),
        ])

    if results.get('stereo_pan_prominence_db') is not None:
        rows.append(('Stereo Pan Prom.', f"{results['stereo_pan_prominence_db']} dB", f">={UNIVERSAL['target_prominence_db']}", check_pass(results['stereo_pan_prominence_db'], target_min=UNIVERSAL['target_prominence_db'])))

    passes = 0
    for name, value, target, status in rows:
        print(f"{name:<25} {value:>14} {target:>18} {status:>8}")
        if status == 'PASS':
            passes += 1

    print(f"\n{'-' * 72}")
    print(f"  RESULT: {passes}/{len(rows)} PASS")
    print("  Note: this verifies audio markers, not medical or cognitive effects.")
    print(f"{'=' * 72}\n")


def print_comparison(hybrid: dict, current: dict, mood: str):
    print(f"\n{'=' * 72}")
    print(f"  ARGOBEAT COMPARISON - {mood.upper()} MODE")
    print(f"{'=' * 72}")
    print(f"{'Metric':<24} {'HYBRID':>14} {'CURRENT':>14}")
    print(f"{'-' * 56}")
    for key in [
        'centroid_hz',
        'rms_db',
        'sample_peak_dbfs',
        'clipped_samples',
        'repetition_ratio',
        'short_loop_similarity',
        'entrainment_peak_hz',
        'entrainment_prominence_db',
        'entrainment_target_share',
    ]:
        if key in hybrid or key in current:
            print(f"{key:<24} {str(hybrid.get(key, 'n/a')):>14} {str(current.get(key, 'n/a')):>14}")
    print(f"{'=' * 72}\n")


def main():
    parser = argparse.ArgumentParser(description='ArgoBeat audio QA')
    parser.add_argument('--file', help='Single file to analyze')
    parser.add_argument('--hybrid', help='New/hybrid audio file')
    parser.add_argument('--current', help='Current/baseline audio file')
    parser.add_argument('--mood', default='focus', choices=MOOD_TARGETS.keys())
    parser.add_argument('--target-hz', type=float, help='Exact session target Hz from export metadata')
    parser.add_argument('--json-out', help='Write structured analysis JSON to this path')
    args = parser.parse_args()

    target_hz = args.target_hz or MOOD_TARGETS[args.mood]['hz']

    try:
        if args.file:
            print(f"Analyzing: {args.file}")
            results = analyze(args.file, target_hz=target_hz)
            if args.json_out:
                out_path = Path(args.json_out)
                out_path.parent.mkdir(parents=True, exist_ok=True)
                out_path.write_text(json.dumps(results, indent=2) + '\n')
            print_single(results, args.mood)
        elif args.hybrid and args.current:
            print(f"Analyzing hybrid: {args.hybrid}")
            h = analyze(args.hybrid, target_hz=target_hz)
            print(f"Analyzing current: {args.current}")
            c = analyze(args.current, target_hz=target_hz)
            if args.json_out:
                out_path = Path(args.json_out)
                out_path.parent.mkdir(parents=True, exist_ok=True)
                out_path.write_text(json.dumps({'hybrid': h, 'current': c}, indent=2) + '\n')
            print_comparison(h, c, args.mood)
        else:
            parser.print_help()
            sys.exit(1)
    except Exception as exc:
        print(f"Analysis failed: {exc}", file=sys.stderr)
        sys.exit(2)


if __name__ == '__main__':
    main()
