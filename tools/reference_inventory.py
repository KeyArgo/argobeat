#!/usr/bin/env python3
"""Summarize reference audio files and index notes for AudioCraft."""

from __future__ import annotations

import json
import re
import subprocess
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
import os

# Set ARGOBEAT_REF_DIR to point at your reference audio directory.
# Expected layout: <ref_dir>/sessions/*.wav and <ref_dir>/<mood> index.txt
_REF_DIR = Path(os.environ.get('ARGOBEAT_REF_DIR', ROOT / 'reference'))
SESSIONS = _REF_DIR / 'sessions'
INDEX_FILES = {
    'focus': _REF_DIR / 'foc index.txt',
    'creative': _REF_DIR / 'creative index.txt',
    'learn': _REF_DIR / 'learn index.txt',
    'motivate': _REF_DIR / 'motivate index.txt',
}


def ffprobe_duration_and_size(path: Path) -> dict:
    result = subprocess.run(
        [
            'ffprobe', '-v', 'error', '-show_entries', 'format=duration,size',
            '-of', 'json', str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    data = json.loads(result.stdout)
    fmt = data.get('format', {})
    duration = float(fmt.get('duration', 0.0))
    size = int(fmt.get('size', 0))
    return {
        'duration_seconds': round(duration, 2),
        'duration_minutes': round(duration / 60.0, 2),
        'size_bytes': size,
        'size_mb': round(size / 1024 / 1024, 1),
    }


def parse_index(path: Path) -> dict:
    text = path.read_text() if path.exists() else ''
    lines = text.splitlines()
    entries = []
    urls = [line.strip() for line in lines if line.strip().startswith('http')]
    i = 0
    while i < len(lines):
        title = lines[i].strip()
        if not title or title.startswith('http'):
            i += 1
            continue
        if i + 2 >= len(lines):
            break
        provider = lines[i + 1].strip()
        genre_bpm = lines[i + 2].strip()
        if not provider or '•' not in genre_bpm:
            i += 1
            continue
        entry = {'title': title, 'provider': provider, 'genre_bpm': genre_bpm}
        j = i + 3
        while j < len(lines):
            if j + 2 < len(lines):
                maybe_title = lines[j].strip()
                maybe_provider = lines[j + 1].strip()
                maybe_genre = lines[j + 2].strip()
                if maybe_title and maybe_provider and '•' in maybe_genre:
                    break
            key = lines[j].strip()
            if key in {'Mental State', 'Activity', 'Moods', 'Instrumentation', 'Complexity', 'Brightness'} and j + 1 < len(lines):
                entry[key.lower().replace(' ', '_')] = lines[j + 1].strip()
                j += 2
                continue
            j += 1
        entries.append(entry)
        i = j

    bpm_values = []
    genre_counter = Counter()
    mood_counter = Counter()
    instr_counter = Counter()
    complexity_counter = Counter()
    brightness_counter = Counter()

    for entry in entries:
        match = re.match(r'^(.*?)\s*•\s*(\d+)\s*BPM$', entry['genre_bpm'])
        if match:
            genre_counter[match.group(1).strip()] += 1
            bpm_values.append(int(match.group(2)))
        for mood in [m.strip() for m in entry.get('moods', '').split(',') if m.strip()]:
            mood_counter[mood] += 1
        for inst in [m.strip() for m in entry.get('instrumentation', '').split(',') if m.strip()]:
            instr_counter[inst] += 1
        if entry.get('complexity'):
            complexity_counter[entry['complexity']] += 1
        if entry.get('brightness'):
            brightness_counter[entry['brightness']] += 1

    return {
        'path': str(path),
        'entries': len(entries),
        'titles': [entry['title'] for entry in entries],
        'reference_urls': urls,
        'avg_bpm': round(sum(bpm_values) / len(bpm_values), 1) if bpm_values else None,
        'bpms': bpm_values,
        'genres': genre_counter.most_common(),
        'top_moods': mood_counter.most_common(10),
        'top_instrumentation': instr_counter.most_common(10),
        'complexity': dict(complexity_counter),
        'brightness': dict(brightness_counter),
    }


def main() -> int:
    wav_files = sorted(SESSIONS.glob('*.wav'))
    audio_summary = {path.name: ffprobe_duration_and_size(path) for path in wav_files}
    index_summary = {name: parse_index(path) for name, path in INDEX_FILES.items()}
    payload = {
        'sessions_dir': str(SESSIONS),
        'audio_files': audio_summary,
        'indexes': index_summary,
    }
    print(json.dumps(payload, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
