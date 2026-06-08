#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class Track:
    path: Path
    duration_s: float
    size_bytes: int


def run(cmd: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, check=True, text=True, capture_output=True)


def probe_duration(path: Path) -> float:
    result = run([
        'ffprobe', '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'json',
        str(path),
    ])
    return float(json.loads(result.stdout)['format']['duration'])


def load_tracks(source_dir: Path) -> list[Track]:
    tracks = []
    for path in sorted(source_dir.glob('*.mp3')):
        tracks.append(Track(path=path, duration_s=probe_duration(path), size_bytes=path.stat().st_size))
    if not tracks:
        raise SystemExit(f'No .mp3 files found in {source_dir}')
    return tracks


def select_tracks(tracks: list[Track], mix_index: int, target_s: float, crossfade_s: float) -> list[Track]:
    count = len(tracks)
    strides = [2, 4, 5, 8, 10, 11, 13, 16, 17, 19, 20]
    stride = strides[mix_index % len(strides)]
    start = (mix_index * 3) % count

    chosen: list[Track] = []
    seen: set[int] = set()
    total = 0.0
    i = 0
    needed = target_s + crossfade_s * 4

    while total < needed or len(chosen) < 6:
        idx = (start + i * stride) % count
        if idx not in seen:
            chosen.append(tracks[idx])
            seen.add(idx)
            total += tracks[idx].duration_s
        i += 1
        if i > count * 3 and total >= target_s:
            break
        if len(seen) == count and total < needed:
            seen.clear()

    return chosen


def build_filter(track_count: int, target_s: float, crossfade_s: float) -> str:
    parts: list[str] = []
    for i in range(track_count):
        parts.append(f'[{i}:a]asetpts=PTS-STARTPTS[a{i}]')

    current = 'a0'
    for i in range(1, track_count):
        out = f'x{i}'
        parts.append(
            f'[{current}][a{i}]acrossfade=d={crossfade_s}:c1=tri:c2=tri[{out}]'
        )
        current = out

    fade_out_start = max(target_s - 1.5, 0)
    parts.append(
        f'[{current}]atrim=duration={target_s},asetpts=PTS-STARTPTS,'
        f'afade=t=in:st=0:d=1.5,afade=t=out:st={fade_out_start}:d=1.5[out]'
    )
    return ';'.join(parts)


def encode_mix(
    selected: list[Track],
    output_path: Path,
    target_s: float,
    crossfade_s: float,
    fmt: str,
    opus_bitrate: str,
) -> None:
    filter_graph = build_filter(len(selected), target_s, crossfade_s)
    cmd = ['ffmpeg', '-y']
    for track in selected:
        cmd.extend(['-i', str(track.path)])
    cmd.extend(['-filter_complex', filter_graph, '-map', '[out]'])

    if fmt == 'opus':
        cmd.extend(['-c:a', 'libopus', '-b:a', opus_bitrate, '-vbr', 'on'])
    elif fmt == 'flac':
        cmd.extend(['-c:a', 'flac', '-compression_level', '8'])
    else:
        raise ValueError(f'Unsupported format: {fmt}')

    cmd.append(str(output_path))
    subprocess.run(cmd, check=True)


def human_mb(size_bytes: int) -> float:
    return round(size_bytes / (1024 * 1024), 2)


def write_manifest(
    manifest_path: Path,
    mixes: list[dict],
    target_s: float,
    crossfade_s: float,
    formats: list[str],
    note: str,
) -> None:
    manifest = {
        'target_duration_seconds': target_s,
        'crossfade_seconds': crossfade_s,
        'formats': formats,
        'note': note,
        'mixes': mixes,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')


def write_readme(readme_path: Path, mixes: list[dict], formats: list[str], note: str) -> None:
    lines = [
        '# ArgoBeat showcase pack',
        '',
        note,
        '',
        f'Formats: {", ".join(formats)}',
        '',
        '| Mix | Duration | Files | Source tracks |',
        '|---|---:|---|---|',
    ]
    for mix in mixes:
        files = ', '.join(f"{f['name']} ({f['size_mb']} MB)" for f in mix['outputs'])
        sources = ', '.join(mix['source_tracks'])
        lines.append(f"| {mix['name']} | {mix['duration_minutes']} min | {files} | {sources} |")
    readme_path.write_text('\n'.join(lines) + '\n')


def main() -> None:
    parser = argparse.ArgumentParser(description='Generate long-form Argobeat showcase mixes from the shared music library.')
    parser.add_argument('--source-dir', default='apps/web/public/audio/music/shared')
    parser.add_argument('--out-dir', default='.hackathon-out/showcase-pack')
    parser.add_argument('--mix-count', type=int, default=10)
    parser.add_argument('--target-minutes', type=float, default=20)
    parser.add_argument('--crossfade-seconds', type=float, default=6)
    parser.add_argument('--formats', default='opus', help='Comma-separated: opus,flac')
    parser.add_argument('--opus-bitrate', default='96k')
    args = parser.parse_args()

    if shutil.which('ffmpeg') is None or shutil.which('ffprobe') is None:
        raise SystemExit('ffmpeg and ffprobe are required')

    source_dir = Path(args.source_dir)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    target_s = args.target_minutes * 60
    crossfade_s = args.crossfade_seconds
    formats = [item.strip() for item in args.formats.split(',') if item.strip()]
    tracks = load_tracks(source_dir)

    note = (
        'Source library is MP3-derived, so FLAC outputs are archival transcodes of the final mix, '
        'not mathematically source-lossless masters. Use Opus for small streaming assets; use FLAC '
        'only when you want a heavier archive copy of the composite.'
    )

    mixes: list[dict] = []
    for mix_index in range(args.mix_count):
        mix_name = f'focus-showcase-{mix_index + 1:02d}'
        selected = select_tracks(tracks, mix_index, target_s, crossfade_s)
        mix_dir = out_dir / mix_name
        mix_dir.mkdir(parents=True, exist_ok=True)

        outputs = []
        for fmt in formats:
            ext = 'opus' if fmt == 'opus' else 'flac'
            out_path = mix_dir / f'{mix_name}.{ext}'
            encode_mix(selected, out_path, target_s, crossfade_s, fmt, args.opus_bitrate)
            outputs.append({
                'name': out_path.name,
                'path': str(out_path.resolve()),
                'size_mb': human_mb(out_path.stat().st_size),
            })

        mixes.append({
            'name': mix_name,
            'duration_minutes': round(target_s / 60, 2),
            'source_tracks': [track.path.name for track in selected],
            'source_minutes_total': round(sum(track.duration_s for track in selected) / 60, 2),
            'outputs': outputs,
        })

    write_manifest(out_dir / 'manifest.json', mixes, target_s, crossfade_s, formats, note)
    write_readme(out_dir / 'README.md', mixes, formats, note)

    total_sizes = {}
    for fmt in formats:
        total_sizes[fmt] = human_mb(sum(
            Path(output['path']).stat().st_size
            for mix in mixes
            for output in mix['outputs']
            if output['name'].endswith('.opus' if fmt == 'opus' else '.flac')
        ))

    print(json.dumps({
        'out_dir': str(out_dir.resolve()),
        'mix_count': len(mixes),
        'formats': formats,
        'total_sizes_mb': total_sizes,
        'note': note,
    }, indent=2))


if __name__ == '__main__':
    main()
