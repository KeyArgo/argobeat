#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import subprocess
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

WORKTREE = Path(__file__).resolve().parents[1]
MUSIC_DIR = WORKTREE / 'apps/web/public/audio/music/shared'
PROV_DIR = WORKTREE / 'apps/web/public/audio/music/provenance'
PACK_JSON = PROV_DIR / 'local-meditation-pack.json'
PACK_M3U = MUSIC_DIR / 'meditation-local-pack.m3u'
DURATION = 600


@dataclass(frozen=True)
class TrackSpec:
    slug: str
    title: str
    root_hz: float
    fifth_hz: float
    octave_hz: float
    noise_lp: int
    description: str


TRACKS = [
    TrackSpec(
        slug='still-lantern',
        title='Still Lantern',
        root_hz=146.83,
        fifth_hz=220.00,
        octave_hz=293.66,
        noise_lp=900,
        description='Ultra-simple low D drone with a faint octave halo and soft filtered air.',
    ),
    TrackSpec(
        slug='breath-circle',
        title='Breath Circle',
        root_hz=98.00,
        fifth_hz=146.83,
        octave_hz=196.00,
        noise_lp=1100,
        description='Lower G-root meditation bed with gentle beating between near-unison layers.',
    ),
    TrackSpec(
        slug='temple-air',
        title='Temple Air',
        root_hz=130.81,
        fifth_hz=196.00,
        octave_hz=261.63,
        noise_lp=1400,
        description='Sparse C-root drone with a slightly brighter overtone stack and very light air texture.',
    ),
]


def ffprobe_json(path: Path) -> dict:
    result = subprocess.run(
        [
            'ffprobe', '-v', 'error', '-show_entries', 'format=duration,size,bit_rate',
            '-of', 'json', str(path),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(result.stdout)['format']


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def render(track: TrackSpec) -> dict:
    out_path = MUSIC_DIR / f'{track.slug}.mp3'
    detune = track.root_hz * 1.003
    filter_complex = (
        f"[0:a]volume=0.19,lowpass=f=420,highpass=f=35[a0];"
        f"[1:a]volume=0.13,lowpass=f=420,highpass=f=35[a1];"
        f"[2:a]volume=0.055,lowpass=f=900,highpass=f=90[a2];"
        f"[3:a]volume=0.018,lowpass=f={track.noise_lp},highpass=f=180[a3];"
        f"[a0][a1][a2][a3]amix=inputs=4:normalize=0,volume=1.9,"
        f"aformat=sample_rates=44100:channel_layouts=stereo,"
        f"afade=t=in:st=0:d=8,afade=t=out:st={DURATION - 8}:d=8,"
        f"alimiter=limit=0.94[mix]"
    )
    cmd = [
        'ffmpeg', '-y',
        '-f', 'lavfi', '-i', f'sine=frequency={track.root_hz}:sample_rate=44100:duration={DURATION}',
        '-f', 'lavfi', '-i', f'sine=frequency={detune:.5f}:sample_rate=44100:duration={DURATION}',
        '-f', 'lavfi', '-i', f'sine=frequency={track.fifth_hz}:sample_rate=44100:duration={DURATION}',
        '-f', 'lavfi', '-i', f'anoisesrc=color=pink:amplitude=0.15:sample_rate=44100:duration={DURATION}',
        '-filter_complex', filter_complex,
        '-map', '[mix]',
        '-c:a', 'libmp3lame',
        '-b:a', '256k',
        '-ar', '44100',
        '-ac', '2',
        str(out_path),
    ]
    subprocess.run(cmd, check=True)
    fmt = ffprobe_json(out_path)
    prov = {
        'provider': 'local-ffmpeg',
        'model': 'ffmpeg-lavfi-v1',
        'slug': track.slug,
        'title': track.title,
        'mood': 'meditate',
        'description': track.description,
        'audio_src': f'/audio/music/shared/{track.slug}.mp3',
        'provenance_src': f'/audio/music/provenance/{track.slug}.json',
        'duration_ms': int(float(fmt['duration']) * 1000),
        'sample_rate': 44100,
        'bitrate': int(fmt['bit_rate']),
        'bytes': int(fmt['size']),
        'sha256': sha256(out_path),
        'generated_at': datetime.now(UTC).isoformat(),
        'render_method': 'lavfi sine + filtered pink noise, mixed and limited in ffmpeg',
        'root_hz': track.root_hz,
        'fifth_hz': track.fifth_hz,
        'octave_hz': track.octave_hz,
        'duration_seconds': DURATION,
    }
    (PROV_DIR / f'{track.slug}.json').write_text(json.dumps(prov, indent=2) + '\n')
    return prov


def main() -> None:
    MUSIC_DIR.mkdir(parents=True, exist_ok=True)
    PROV_DIR.mkdir(parents=True, exist_ok=True)
    rendered = [render(track) for track in TRACKS]
    PACK_JSON.write_text(json.dumps({
        'provider': 'local-ffmpeg',
        'pack': 'local-meditation-pack',
        'mood': 'meditate',
        'generated_at': datetime.now(UTC).isoformat(),
        'tracks': rendered,
    }, indent=2) + '\n')
    PACK_M3U.write_text('#EXTM3U\n' + ''.join(
        f"#EXTINF:{int(track['duration_ms'] / 1000)},{track['title']}\n{track['slug']}.mp3\n"
        for track in rendered
    ))
    print(json.dumps({
        'rendered': [track['slug'] for track in rendered],
        'pack_json': str(PACK_JSON),
        'playlist': str(PACK_M3U),
    }, indent=2))


if __name__ == '__main__':
    main()
