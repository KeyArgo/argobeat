#!/usr/bin/env python3
"""Heuristic non-destructive splitter for long reference recordings.

Finds likely song/section boundaries from novelty in chroma + MFCC features,
then writes segment suggestions and optional ffmpeg cut commands.
"""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

import librosa
import numpy as np


def detect_boundaries(path: Path, min_segment_seconds: float = 180.0, max_boundaries: int = 8) -> dict:
    y, sr = librosa.load(path, sr=22050, mono=True)
    hop = 512
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop)
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13, hop_length=hop)
    feat = np.vstack([chroma, mfcc])
    feat = librosa.util.normalize(feat, axis=1)
    novelty = librosa.onset.onset_strength(S=feat, sr=sr, hop_length=hop, aggregate=np.median)
    frames_per_min = int((min_segment_seconds * sr) / hop)
    peak_frames = librosa.util.peak_pick(
        novelty,
        pre_max=64,
        post_max=64,
        pre_avg=16,
        post_avg=16,
        delta=0.15,
        wait=frames_per_min,
    )
    peak_times = librosa.frames_to_time(peak_frames, sr=sr, hop_length=hop)

    filtered = []
    last = 0.0
    for t in peak_times:
        if t - last >= min_segment_seconds:
            filtered.append(float(t))
            last = float(t)

    duration = float(librosa.get_duration(y=y, sr=sr))

    if not filtered:
        win_seconds = 10.0
        win = int(win_seconds * sr)
        starts = list(range(0, max(len(y) - win, 1), win))
        stats = []
        for start in starts:
            chunk = y[start:start + win]
            if len(chunk) < win // 2:
                continue
            chunk_centroid = float(np.mean(librosa.feature.spectral_centroid(y=chunk, sr=sr)))
            chunk_bandwidth = float(np.mean(librosa.feature.spectral_bandwidth(y=chunk, sr=sr)))
            chunk_rms = float(np.mean(librosa.feature.rms(y=chunk)))
            chunk_chroma = np.mean(librosa.feature.chroma_cqt(y=chunk, sr=sr), axis=1)
            vec = np.concatenate([
                np.array([chunk_centroid / 2000.0, chunk_bandwidth / 2000.0, chunk_rms * 100.0]),
                chunk_chroma,
            ])
            stats.append((start / sr, vec))
        changes = []
        for idx in range(1, len(stats)):
            t, vec = stats[idx]
            _, prev = stats[idx - 1]
            score = float(np.linalg.norm(vec - prev))
            changes.append((score, t))
        changes.sort(reverse=True)
        chosen = []
        for score, t in changes:
            if t < min_segment_seconds or duration - t < min_segment_seconds:
                continue
            if all(abs(t - existing) >= min_segment_seconds for existing in chosen):
                chosen.append(float(t))
            if len(chosen) >= max_boundaries:
                break
        filtered = sorted(chosen)

    if len(filtered) > max_boundaries:
        filtered = filtered[:max_boundaries]

    boundaries = [0.0] + [t for t in filtered if 0.0 < t < duration] + [duration]
    segments = []
    for idx, (start, end) in enumerate(zip(boundaries[:-1], boundaries[1:]), start=1):
        segments.append({
            'index': idx,
            'start': round(start, 2),
            'end': round(end, 2),
            'duration': round(end - start, 2),
        })
    return {
        'file': str(path),
        'duration': round(duration, 2),
        'candidate_boundaries': [round(t, 2) for t in filtered],
        'segments': segments,
    }


def ffmpeg_commands(path: Path, segments: list[dict], out_dir: Path) -> list[str]:
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = path.stem
    commands = []
    for segment in segments:
        out = out_dir / f"{stem}-segment{segment['index']:02d}.wav"
        commands.append(
            f"ffmpeg -y -i {path} -ss {segment['start']} -to {segment['end']} -c copy {out}"
        )
    return commands


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('file', type=Path)
    parser.add_argument('--min-seconds', type=float, default=180.0)
    parser.add_argument('--max-boundaries', type=int, default=8)
    parser.add_argument('--emit-ffmpeg', action='store_true')
    parser.add_argument('--out-dir', type=Path)
    args = parser.parse_args()

    result = detect_boundaries(args.file, args.min_seconds, args.max_boundaries)
    if args.emit_ffmpeg:
        out_dir = args.out_dir or args.file.parent / f"{args.file.stem}-segments"
        result['ffmpeg_commands'] = ffmpeg_commands(args.file, result['segments'], out_dir)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
