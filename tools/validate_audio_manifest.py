#!/usr/bin/env python3
"""Validate ArgoBeat deployable audio manifests.

Checks that manifest-referenced files exist, music moods expose enough tracks,
and soundscape categories have enough choices to avoid obvious short-loop
fatigue.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'packages/@argobeat/engine/src/soundscape/audio-manifest.ts'
MUSIC_ROOT = ROOT / 'apps/web/public/audio/music'
SOUNDSCAPE_ROOT = ROOT / 'apps/web/public/audio/soundscapes'


def read_manifest() -> str:
    return MANIFEST.read_text()


def extract_block(source: str, start: str) -> str:
    start_index = source.index(start)
    brace_index = source.index('{', start_index)
    depth = 0
    for index in range(brace_index, len(source)):
        char = source[index]
        if char == '{':
            depth += 1
        elif char == '}':
            depth -= 1
            if depth == 0:
                return source[brace_index:index + 1]
    raise ValueError(f'Could not parse block: {start}')


def ffprobe_duration(path: Path) -> float | None:
    try:
        result = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', str(path)],
            check=True,
            capture_output=True,
            text=True,
        )
        return float(result.stdout.strip())
    except Exception:
        return None


def validate(min_tracks: int, min_soundscapes: int, min_duration: float) -> int:
    source = read_manifest()
    music_block = extract_block(source, 'export const MUSIC_TRACKS')
    soundscape_block = extract_block(source, 'export const SOUNDSCAPE_TRACKS')
    errors: list[str] = []
    warnings: list[str] = []

    music_files = sorted(set(re.findall(r"file: 'shared/([^']+)'", source)))
    for file_name in music_files:
        path = MUSIC_ROOT / 'shared' / file_name
        if not path.exists():
            errors.append(f'missing music file: {path.relative_to(ROOT)}')

    for mood, args in re.findall(r'(\w+): moodPlaylist\(\[([^\]]+)\]\)', music_block, flags=re.S):
        track_count = len(re.findall(r"'([^']+)'", args))
        if track_count < min_tracks:
            errors.append(f'{mood} has {track_count} music tracks, expected >= {min_tracks}')

    category_blocks = re.findall(r'(\w+): \[([\s\S]*?)\n  \]', soundscape_block)
    for category, block in category_blocks:
        files = re.findall(r"file: '([^']+)'", block)
        expected = 2 if category == 'fire' else min_soundscapes
        if len(files) < expected and category != 'thunder':
            warnings.append(f'{category} has {len(files)} soundscapes, target >= {expected}')
        for file_name in files:
            path = SOUNDSCAPE_ROOT / category / file_name
            if not path.exists():
                errors.append(f'missing soundscape file: {path.relative_to(ROOT)}')
                continue
            duration = ffprobe_duration(path)
            if duration is not None and duration < min_duration:
                warnings.append(f'{path.relative_to(ROOT)} is short: {duration:.1f}s')

    print('ArgoBeat audio manifest validation')
    print(f'Music files referenced: {len(music_files)}')
    print(f'Soundscape categories: {len(category_blocks)}')

    if warnings:
        print('\nWarnings:')
        for warning in warnings:
            print(f'  - {warning}')

    if errors:
        print('\nErrors:')
        for error in errors:
            print(f'  - {error}')
        return 1

    print('\nPASS: manifest files exist and minimum track counts are satisfied.')
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description='Validate ArgoBeat audio manifest')
    parser.add_argument('--min-tracks', type=int, default=21)
    parser.add_argument('--min-soundscapes', type=int, default=3)
    parser.add_argument('--min-duration', type=float, default=30.0)
    args = parser.parse_args()
    sys.exit(validate(args.min_tracks, args.min_soundscapes, args.min_duration))


if __name__ == '__main__':
    main()
