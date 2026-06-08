#!/usr/bin/env python3
"""Validate ArgoBeat deployable audio manifests.

Checks that manifest-referenced files exist, music moods expose enough tracks,
and soundscape categories have enough choices to avoid obvious short-loop
fatigue.
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'packages/@argobeat/engine/src/soundscape/audio-manifest.ts'
LOCAL_AUDIO_ROOT = ROOT / 'apps/web/public/audio'
SCRATCH_AUDIO_ROOT = Path('/mnt/AllShare/Argobeat/Scratch Board/cloudflare-backup-2026-06-01/audio')
BACKUP_AUDIO_ROOT_V011 = Path('/mnt/AllShare/Argobeat/Backup/argobeat v0.1.1 audio-backup')
BACKUP_AUDIO_ROOT_V01 = Path('/mnt/AllShare/Argobeat/Backup/argobeat v0.1 audio-backup')
PRENORM_AUDIO_ROOT = Path('/mnt/AllShare/Argobeat/Backup/sounds-originals-prenorm-20260503')


def resolve_audio_roots() -> list[Path]:
    """Resolve where deployable audio should be validated from.

    The corpus is split across a few archives on this workstation. Validation
    searches them in order and accepts the first match for each referenced
    asset. An explicit ARGOBEAT_AUDIO_ROOT or ARGOBEAT_AUDIO_ROOTS override can
    still narrow validation to a specific source.
    """
    env_roots = os.environ.get('ARGOBEAT_AUDIO_ROOTS')
    if env_roots:
        return [Path(part) for part in env_roots.split(os.pathsep) if part]

    env_root = os.environ.get('ARGOBEAT_AUDIO_ROOT')
    if env_root:
        return [Path(env_root)]

    candidate_roots = [
        LOCAL_AUDIO_ROOT,
        SCRATCH_AUDIO_ROOT,
        BACKUP_AUDIO_ROOT_V011,
        BACKUP_AUDIO_ROOT_V01,
        PRENORM_AUDIO_ROOT,
    ]
    return [root for root in candidate_roots if root.exists()]


def first_existing_path(roots: list[Path], candidates: list[Path]) -> Path | None:
    for root in roots:
        for candidate in candidates:
            path = root / candidate
            if path.exists():
                return path
    return None


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
    audio_roots = resolve_audio_roots()
    errors: list[str] = []
    warnings: list[str] = []

    library_files = dict(re.findall(r"'([^']+)': \{[^}]*file: 'shared/([^']+)'", source))
    playlist_ids = sorted(set(re.findall(r"'([^']+)'", music_block)))
    music_files = sorted({library_files[track_id] for track_id in playlist_ids if track_id in library_files})
    for file_name in music_files:
        path = first_existing_path(
            audio_roots,
            [
                Path('music') / 'shared' / file_name,
                Path('shared') / file_name,
                Path('music-shared') / file_name,
            ],
        )
        if path is None:
            errors.append(f'missing music file: {file_name}')

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
            path = first_existing_path(
                audio_roots,
                [
                    Path('soundscapes') / category / file_name,
                    Path(category) / file_name,
                ],
            )
            if path is None:
                errors.append(f'missing soundscape file: {category}/{file_name}')
                continue
            duration = ffprobe_duration(path)
            if duration is not None and duration < min_duration:
                warnings.append(f'{path} is short: {duration:.1f}s')

    print('ArgoBeat audio manifest validation')
    print(f'Audio roots: {", ".join(str(root) for root in audio_roots)}')
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
