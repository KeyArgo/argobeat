#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

import librosa
import numpy as np

import os

# Reference audio files for tuning. Override with env vars or edit this dict
# to point at your own reference recordings.
DEFAULT_FILES = {
    'deep_work_ref': os.environ.get('ARGOBEAT_REF_DEEP_WORK', 'reference/work.wav'),
    'creative_ref': os.environ.get('ARGOBEAT_REF_CREATIVE', 'reference/creative.wav'),
    'learn_ref': os.environ.get('ARGOBEAT_REF_LEARN', 'reference/learn.wav'),
    'motivate_ref': os.environ.get('ARGOBEAT_REF_MOTIVATE', 'reference/motivate.wav'),
}


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description='Snapshot coarse reference audio features for Argobeat tuning.')
    parser.add_argument('duration', nargs='?', type=float, default=180.0, help='Seconds to analyze from the start of each file.')
    parser.add_argument('--out', type=Path, help='Optional JSON output path.')
    return parser


def collect_features(path: str, requested_duration: float) -> dict:
    y, sr = librosa.load(path, sr=22050, mono=True, duration=requested_duration)
    analyzed_seconds = float(librosa.get_duration(y=y, sr=sr))
    tempo = float(librosa.feature.tempo(y=y, sr=sr)[0])
    centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
    bandwidth = float(np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr)))
    rms = float(np.mean(librosa.feature.rms(y=y)))
    peak = float(np.max(np.abs(y)))
    return {
        'file': path,
        'requested_seconds': requested_duration,
        'analyzed_seconds': round(analyzed_seconds, 2),
        'tempo_bpm_est': round(tempo, 2),
        'centroid_hz': round(centroid, 1),
        'bandwidth_hz': round(bandwidth, 1),
        'rms_db': round(20 * np.log10(max(rms, 1e-9)), 2),
        'peak_dbfs': round(20 * np.log10(max(peak, 1e-9)), 2),
    }


def main() -> int:
    args = build_arg_parser().parse_args()
    out = {key: collect_features(path, args.duration) for key, path in DEFAULT_FILES.items()}
    rendered = json.dumps(out, indent=2)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(rendered + '\n', encoding='utf-8')
    print(rendered)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
