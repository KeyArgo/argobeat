#!/usr/bin/env python3
"""Copy new ArgoBeat audio into deployable folders.

The script intentionally does not rewrite the TypeScript manifest. It keeps
the risky part explicit by printing the exact manifest entry to review.
"""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MUSIC_SHARED = ROOT / 'apps/web/public/audio/music/shared'
SOUNDSCAPES = ROOT / 'apps/web/public/audio/soundscapes'
VALID_CATEGORIES = {'rain', 'ocean', 'forest', 'cafe', 'fire', 'space', 'stream', 'wind', 'thunder'}


def slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r'[^a-z0-9]+', '-', value)
    return value.strip('-') or 'track'


def duration(path: Path) -> str:
    try:
        result = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', str(path)],
            check=True,
            capture_output=True,
            text=True,
        )
        return f'{float(result.stdout.strip()):.1f}s'
    except Exception:
        return 'unknown duration'


def copy_unique(src: Path, dest_dir: Path, slug: str) -> Path:
    suffix = src.suffix.lower() or '.mp3'
    dest = dest_dir / f'{slug}{suffix}'
    if dest.exists():
        raise FileExistsError(f'Destination already exists: {dest}')
    dest_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)
    return dest


def main() -> None:
    parser = argparse.ArgumentParser(description='Ingest an ArgoBeat audio file')
    parser.add_argument('kind', choices=['music', 'soundscape'])
    parser.add_argument('file', type=Path)
    parser.add_argument('--title', required=True, help='Human-readable track title')
    parser.add_argument('--id', help='Stable id/slug. Defaults to title slug.')
    parser.add_argument('--category', choices=sorted(VALID_CATEGORIES), help='Required for soundscapes')
    args = parser.parse_args()

    src = args.file.expanduser().resolve()
    if not src.exists():
        print(f'File not found: {src}', file=sys.stderr)
        sys.exit(1)
    if src.suffix.lower() not in {'.mp3', '.wav', '.ogg', '.flac'}:
        print('Expected an audio file ending in .mp3, .wav, .ogg, or .flac', file=sys.stderr)
        sys.exit(1)

    track_id = slugify(args.id or args.title)

    if args.kind == 'music':
        dest = copy_unique(src, MUSIC_SHARED, track_id)
        manifest_entry = f"  '{track_id}': {{ id: '{track_id}', name: '{args.title}', file: 'shared/{dest.name}' }},"
        print(f'Copied music: {dest.relative_to(ROOT)} ({duration(dest)})')
        print('\nAdd this inside SHARED_MUSIC_LIBRARY in audio-manifest.ts:')
        print(manifest_entry)
        print('\nThen add the track id to the moodPlaylist arrays where it belongs:')
        print(f"  '{track_id}',")
    else:
        if not args.category:
            print('--category is required for soundscape ingestion', file=sys.stderr)
            sys.exit(1)
        dest = copy_unique(src, SOUNDSCAPES / args.category, track_id)
        manifest_entry = f"    {{ id: '{args.category}-{track_id}', name: '{args.title}', file: '{dest.name}' }},"
        print(f'Copied soundscape: {dest.relative_to(ROOT)} ({duration(dest)})')
        print(f'\nAdd this inside SOUNDSCAPE_TRACKS.{args.category} in audio-manifest.ts:')
        print(manifest_entry)

    print('\nValidate with:')
    print('  pnpm audio:validate')


if __name__ == '__main__':
    main()
