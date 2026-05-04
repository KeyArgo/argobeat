#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT_DIR = Path(__file__).resolve().parent / 'outputs'
API_URL = 'https://api.minimax.io/v1/music_generation'


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Generate MiniMax Music 2.6 audio and save a local artifact.')
    parser.add_argument('--prompt', help='Prompt text. If omitted, uses --prompt-file.')
    parser.add_argument('--prompt-file', default=str(Path(__file__).resolve().parent / 'focus-prompt-v1.txt'))
    parser.add_argument('--model', default='music-2.6-free', help='MiniMax music model name')
    parser.add_argument('--out-dir', default=str(DEFAULT_OUT_DIR))
    parser.add_argument('--name', default=None, help='Output stem. Defaults to UTC timestamp + model slug.')
    parser.add_argument('--format', default='wav', choices=['wav', 'mp3', 'pcm'])
    parser.add_argument('--sample-rate', type=int, default=44100, choices=[16000, 24000, 32000, 44100])
    parser.add_argument('--bitrate', type=int, default=256000, choices=[32000, 64000, 128000, 256000])
    parser.add_argument('--instrumental', action='store_true', default=True)
    parser.add_argument('--with-watermark', action='store_true')
    parser.add_argument('--analyze-mood', default='focus')
    return parser.parse_args()


def load_prompt(args: argparse.Namespace) -> str:
    if args.prompt:
        return args.prompt.strip()
    return Path(args.prompt_file).read_text(encoding='utf-8').strip()


def require_key() -> str:
    key = os.getenv('MINIMAX_API_KEY') or os.getenv('MINIMAX_CN_API_KEY')
    if not key:
        raise SystemExit('Missing MINIMAX_API_KEY (or MINIMAX_CN_API_KEY) in environment.')
    return key


def utc_slug() -> str:
    return datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')


def analyze_audio(audio_path: Path, mood: str) -> dict | None:
    cmd = ['python3', str(ROOT / 'tools' / 'analyze_audio.py'), '--file', str(audio_path), '--mood', mood]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    return {
        'command': cmd,
        'exit_code': proc.returncode,
        'stdout': proc.stdout,
        'stderr': proc.stderr,
    }


def main() -> int:
    args = parse_args()
    prompt = load_prompt(args)
    key = require_key()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = args.name or f'{utc_slug()}-{args.model.replace("/", "-")}'
    audio_path = out_dir / f'{stem}.{args.format}'
    meta_path = out_dir / f'{stem}.json'

    payload = {
        'model': args.model,
        'prompt': prompt,
        'output_format': 'hex',
        'lyrics_optimizer': False,
        'is_instrumental': args.instrumental,
        'aigc_watermark': args.with_watermark,
        'audio_setting': {
            'sample_rate': args.sample_rate,
            'bitrate': args.bitrate,
            'format': args.format,
        },
    }

    headers = {
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
    }

    started = datetime.now(UTC)
    response = requests.post(API_URL, headers=headers, json=payload, timeout=1800)
    finished = datetime.now(UTC)

    try:
        data = response.json()
    except Exception:
        data = {'raw_text': response.text}

    hex_audio = ((data.get('data') or {}).get('audio')) if isinstance(data, dict) else None
    wrote_audio = False
    if response.ok and isinstance(hex_audio, str) and hex_audio:
        audio_path.write_bytes(bytes.fromhex(hex_audio))
        wrote_audio = True

    analysis = analyze_audio(audio_path, args.analyze_mood) if wrote_audio else None

    meta = {
        'api_url': API_URL,
        'http_status': response.status_code,
        'ok': response.ok,
        'started_at': started.isoformat(),
        'finished_at': finished.isoformat(),
        'elapsed_seconds': round((finished - started).total_seconds(), 2),
        'output_audio': str(audio_path) if wrote_audio else None,
        'payload': payload,
        'response': data,
        'analysis': analysis,
    }
    meta_path.write_text(json.dumps(meta, indent=2) + '\n', encoding='utf-8')

    print(json.dumps({
        'http_status': response.status_code,
        'audio_written': wrote_audio,
        'audio_path': str(audio_path) if wrote_audio else None,
        'meta_path': str(meta_path),
    }, indent=2))

    return 0 if wrote_audio else 1


if __name__ == '__main__':
    raise SystemExit(main())
