#!/usr/bin/env python3
"""ArgoBeat audio quality and target-rate marker analysis.

This tool measures objective audio properties only. It can verify that an
export contains target-rate audio modulation; it cannot prove neurological or
medical effects.

Science basis: brain.fm neural phase-locking research (2023-2024) and
Woods et al. (2024) on amplitude modulation for sustained attention.

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


# ── Mood targets ──────────────────────────────────────────────────────────
# Calibrated to measured brain.fm references 2026-05-31 (/mnt/AllShare/Argobeat)
# and cross-referenced with brain.fm's published science:
#   - Focus: beta (14-18 Hz) AND gamma (~40 Hz) — brain.fm targets both
#   - Deep Work: upper beta (16-20 Hz) — sustained high-attention beta
#   - Relax: alpha (8-12 Hz) — "calm, present-moment awareness" per brain.fm
#   - Meditate: theta (4-8 Hz) — "sustained attention and working memory" per brain.fm
#   - Sleep: delta (1-4 Hz) — brain.fm targets delta for restorative sleep
#
# BPM ranges: brain.fm says sleep music should be 60-80 BPM (resting heart rate);
# focus/deep-work can be wider since the entrainment is on the AM envelope, not tempo.
MOOD_TARGETS = {
    'focus': {
        'lufs': (-32, -24),
        'centroid': (800, 1600),
        'bpm': (75, 145),
        'hz': 15.0,           # primary: beta band
        'secondary_hz': 40.0, # brain.fm also targets gamma for focus
        'secondary_label': 'gamma',
    },
    'deepWork': {
        'lufs': (-32, -24),
        'centroid': (650, 1500),
        'bpm': (75, 150),
        'hz': 18.0,
        'secondary_hz': None,
        'secondary_label': None,
    },
    'relax': {
        'lufs': (-32, -24),
        'centroid': (650, 1300),
        'bpm': (50, 135),
        'hz': 10.0,           # alpha band
        'secondary_hz': None,
        'secondary_label': None,
    },
    'meditate': {
        'lufs': (-34, -24),
        'centroid': (300, 1100),
        'bpm': (0, 200),      # librosa may detect double-time on ambient
        'hz': 6.0,            # theta band — "sustained attention and working memory"
        'secondary_hz': None,
        'secondary_label': None,
    },
    'sleep': {
        'lufs': (-34, -24),
        'centroid': (300, 1000),
        'bpm': (60, 80),      # brain.fm: 60-80 BPM matches resting heart rate
        'hz': 2.0,            # delta band — slow-wave sleep
        'secondary_hz': None,
        'secondary_label': None,
    },
}

# ── Universal quality thresholds ──────────────────────────────────────────
# Calibrated 2026-05-31 against real brain.fm references.
UNIVERSAL = {
    'harmonic_ratio': 0.30,
    'noise_floor': -28,
    'repetition': 1.01,       # functional music is intentionally self-similar
    'spectral_spread': (400, 1600),
    'short_loop_similarity': 1.01,
    'target_prominence_db': 6.0,
    'target_share': 0.005,
    'sample_peak_dbfs': -1.0,
    'clipped_samples': 0,
    # ── New brain.fm-science-based metrics ──
    'modulation_depth_min': 0.02,   # minimum peak-to-trough AM depth (2%)
    'temporal_consistency_min': 0.60, # minimum score (0-1) for rate stability
    'spectral_complexity_max': 0.65,  # brain.fm "salience reduction" — lower is calmer
}


def _to_mono(y: np.ndarray) -> np.ndarray:
    if y.ndim == 1:
        return y
    return np.mean(y, axis=0)


def _envelope_metrics(y: np.ndarray, sr: int, target_hz: float) -> dict:
    """Measure target-rate amplitude modulation in a decoded waveform.

    Returns peak Hz, prominence, share, AND modulation depth.
    Modulation depth = (peak_env - trough_env) / (peak_env + trough_env)
    measured in the narrow band around the target frequency.
    """
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

    # ── Peak detection in narrow band ──
    search = (freqs >= max(0.1, target_hz - 0.75)) & (freqs <= target_hz + 0.75)
    if not np.any(search):
        return {}
    search_indices = np.flatnonzero(search)
    peak_index = search_indices[np.argmax(spectrum[search])]

    # ── Prominence vs local neighborhood ──
    local = (freqs >= max(0.1, target_hz - 4.0)) & (freqs <= target_hz + 4.0)
    local &= ~((freqs >= target_hz - 0.75) & (freqs <= target_hz + 0.75))
    median_power = float(np.median(spectrum[local])) if np.any(local) else 1e-18
    peak_power = float(spectrum[peak_index])
    prominence_db = 10 * np.log10((peak_power + 1e-18) / (median_power + 1e-18))

    # ── Target share in 0.5-25 Hz modulation band ──
    band = (freqs >= 0.5) & (freqs <= 25.0)
    target = (freqs >= target_hz - 0.5) & (freqs <= target_hz + 0.5)
    target_share = float(np.sum(spectrum[target]) / (np.sum(spectrum[band]) + 1e-18))

    # ── Modulation depth (brain.fm key metric) ──
    # Isolate the target-frequency component via bandpass, measure peak-to-trough
    target_bw = 2.0  # Hz bandwidth around target
    target_band = (freqs >= max(0.1, target_hz - target_bw)) & (freqs <= target_hz + target_bw)
    # Reconstruct narrow-band envelope via inverse FFT
    narrow_spectrum = np.zeros_like(spectrum)
    narrow_spectrum[target_band] = spectrum[target_band]
    narrow_env = np.fft.irfft(np.sqrt(narrow_spectrum + 1e-18) * np.exp(1j * np.angle(
        np.fft.rfft(envelope * np.hanning(envelope.size))
    )), n=envelope.size)
    if np.max(np.abs(narrow_env)) > 1e-9:
        peak_val = np.percentile(narrow_env, 95)
        trough_val = np.percentile(narrow_env, 5)
        denom = peak_val + trough_val
        mod_depth = max(0, (peak_val - trough_val) / denom) if denom > 1e-9 else 0
    else:
        mod_depth = 0

    return {
        'entrainment_target_hz': round(target_hz, 2),
        'entrainment_peak_hz': round(float(freqs[peak_index]), 2),
        'entrainment_prominence_db': round(float(prominence_db), 1),
        'entrainment_target_share': round(target_share, 4),
        'modulation_depth': round(float(mod_depth), 4),
    }


def _temporal_consistency(y: np.ndarray, sr: int, target_hz: float,
                          num_windows: int = 8) -> float:
    """Measure how stable the modulation rate is across the session.

    Divides audio into windows, measures peak Hz in each, and computes
    the coefficient of variation. Low CV = consistent = good.
    Returns a 0-1 score where 1 = perfectly stable.

    brain.fm: "reliable, structured rhythmic input the brain naturally tracks"
    """
    win_len = len(y) // num_windows
    if win_len < sr * 2:  # need at least 2s per window
        return 1.0

    peaks = []
    frame = 256
    hop = 220

    for w in range(num_windows):
        start = w * win_len
        end = min(start + win_len, len(y))
        chunk = y[start:end]

        env = []
        for i in range(0, chunk.size - frame, hop):
            env.append(np.sqrt(np.mean(chunk[i:i + frame] ** 2)))
        env = np.asarray(env, dtype=np.float64)
        env -= np.mean(env)
        if env.size < 8 or np.max(np.abs(env)) < 1e-9:
            continue

        envelope_sr = sr / hop
        spec = np.abs(np.fft.rfft(env * np.hanning(env.size))) ** 2
        freqs = np.fft.rfftfreq(env.size, d=1 / envelope_sr)

        search = (freqs >= max(0.1, target_hz - 1.5)) & (freqs <= target_hz + 1.5)
        if np.any(search):
            peak_idx = np.flatnonzero(search)[np.argmax(spec[search])]
            peaks.append(freqs[peak_idx])

    if len(peaks) < 3:
        return 0.5  # too little data

    peaks = np.array(peaks)
    mean_hz = np.mean(peaks)
    if mean_hz < 1e-6:
        return 0.5
    cv = np.std(peaks) / mean_hz  # coefficient of variation

    # CV of 0 = perfect stability → score 1.0
    # CV of 0.1 = 10% variation → score ~0.5
    # CV of 0.2+ = unstable → score near 0
    score = float(max(0.0, min(1.0, 1.0 - (cv * 5.0))))
    return round(score, 3)


def _spectral_complexity(y: np.ndarray, sr: int) -> float:
    """Measure spectral complexity (0-1). Lower = simpler/calmer.

    brain.fm "salience reduction": strategic removal of elements that
    grab attention. A calmer piece has fewer competing spectral peaks.

    Computed as: number of significant spectral peaks / total bins,
    weighted by how prominent they are.
    """
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=512))
    S_mean = np.mean(S, axis=1)

    if np.max(S_mean) < 1e-9:
        return 0.0

    # Normalize
    S_norm = S_mean / (np.max(S_mean) + 1e-10)

    # Count bins above -20 dB relative to peak
    threshold = 0.1  # -20 dB
    active_bins = np.sum(S_norm > threshold)
    total_bins = len(S_norm)

    # Also weight by entropy of the spectrum
    S_prob = S_norm / (np.sum(S_norm) + 1e-10)
    S_prob = S_prob[S_prob > 1e-10]
    entropy = -np.sum(S_prob * np.log2(S_prob))
    max_entropy = np.log2(total_bins)
    norm_entropy = entropy / max_entropy if max_entropy > 0 else 0

    # Combine: active bin ratio + entropy
    complexity = 0.5 * (active_bins / total_bins) + 0.5 * norm_entropy
    return round(float(complexity), 3)


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

    # ── New brain.fm-science-based metrics ──
    temporal = _temporal_consistency(y, sr, target_hz) if target_hz else None
    complexity = _spectral_complexity(y, sr)

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
        'temporal_consistency': temporal,
        'spectral_complexity': complexity,
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
    print(f"\n{'Metric':<28} {'Value':>14} {'Target':>20} {'Status':>8}")
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

    # ── Entrainment metrics ──
    if 'entrainment_peak_hz' in results:
        target_error = abs(results['entrainment_peak_hz'] - results['entrainment_target_hz'])
        rows.extend([
            ('Target Mod Peak', f"{results['entrainment_peak_hz']} Hz", f"{results['entrainment_target_hz']} +/-0.75", check_pass(target_error, target_max=0.75)),
            ('Target Prominence', f"{results['entrainment_prominence_db']} dB", f">={UNIVERSAL['target_prominence_db']}", check_pass(results['entrainment_prominence_db'], target_min=UNIVERSAL['target_prominence_db'])),
            ('Target Power Share', f"{results['entrainment_target_share']:.2%}", f">={UNIVERSAL['target_share']:.2%}", check_pass(results['entrainment_target_share'], target_min=UNIVERSAL['target_share'])),
        ])

    # ── Modulation depth (brain.fm key metric) ──
    if 'modulation_depth' in results:
        rows.append(('Modulation Depth', f"{results['modulation_depth']:.4f}", f">={UNIVERSAL['modulation_depth_min']}", check_pass(results['modulation_depth'], target_min=UNIVERSAL['modulation_depth_min'])))

    # ── Temporal consistency (brain.fm: "reliable, structured rhythmic input") ──
    if results.get('temporal_consistency') is not None:
        rows.append(('Temporal Stability', f"{results['temporal_consistency']:.3f}", f">={UNIVERSAL['temporal_consistency_min']}", check_pass(results['temporal_consistency'], target_min=UNIVERSAL['temporal_consistency_min'])))

    # ── Spectral complexity (brain.fm: "salience reduction") ──
    if results.get('spectral_complexity') is not None:
        rows.append(('Spectral Complexity', f"{results['spectral_complexity']:.3f}", f"<={UNIVERSAL['spectral_complexity_max']}", check_pass(results['spectral_complexity'], target_max=UNIVERSAL['spectral_complexity_max'])))

    if results.get('stereo_pan_prominence_db') is not None:
        rows.append(('Stereo Pan Prom.', f"{results['stereo_pan_prominence_db']} dB", f">={UNIVERSAL['target_prominence_db']}", check_pass(results['stereo_pan_prominence_db'], target_min=UNIVERSAL['target_prominence_db'])))

    passes = 0
    for name, value, target, status in rows:
        print(f"{name:<28} {value:>14} {target:>20} {status:>8}")
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
    print(f"{'Metric':<28} {'HYBRID':>14} {'CURRENT':>14}")
    print(f"{'-' * 56}")
    for key in [
        'centroid_hz',
        'rms_db',
        'sample_peak_dbfs',
        'clipped_samples',
        'repetition_ratio',
        'short_loop_similarity',
        'modulation_depth',
        'temporal_consistency',
        'spectral_complexity',
        'entrainment_peak_hz',
        'entrainment_prominence_db',
        'entrainment_target_share',
    ]:
        if key in hybrid or key in current:
            print(f"{key:<28} {str(hybrid.get(key, 'n/a')):>14} {str(current.get(key, 'n/a')):>14}")
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
