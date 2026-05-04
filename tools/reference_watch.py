#!/usr/bin/env python3
"""Lightweight polling watcher for AudioCraft reference inputs."""

from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path

import os

# Set ARGOBEAT_REF_DIR to point at your reference audio directory.
_ROOT = Path(__file__).resolve().parent.parent
_REF_DIR = Path(os.environ.get('ARGOBEAT_REF_DIR', _ROOT / 'reference'))
SESSIONS = _REF_DIR / 'sessions'
TARGETS = [
    _REF_DIR / 'foc index.txt',
    _REF_DIR / 'creative index.txt',
    _REF_DIR / 'learn index.txt',
    _REF_DIR / 'motivate index.txt',
]
POLL_SECONDS = 60


def fingerprint() -> str:
    payload = {}
    for path in TARGETS:
        if path.exists():
            stat = path.stat()
            payload[str(path)] = {'mtime': stat.st_mtime, 'size': stat.st_size}
    for wav in sorted(SESSIONS.glob('*.wav')):
        stat = wav.stat()
        payload[str(wav)] = {'mtime': stat.st_mtime, 'size': stat.st_size}
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def summary() -> str:
    wavs = sorted(p.name for p in SESSIONS.glob('*.wav'))
    return json.dumps({
        'wav_count': len(wavs),
        'latest_wavs': wavs[-5:],
        'indexes': [p.name for p in TARGETS if p.exists()],
    })


def main() -> None:
    fp = fingerprint()
    print(f'REF-WATCH READY {summary()}', flush=True)
    while True:
        time.sleep(POLL_SECONDS)
        new_fp = fingerprint()
        if new_fp != fp:
            fp = new_fp
            print(f'REF-WATCH CHANGE {summary()}', flush=True)


if __name__ == '__main__':
    main()
