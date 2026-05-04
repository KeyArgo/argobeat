#!/usr/bin/env python3
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REFERENCE_DIR = ROOT / 'scratch' / 'reference'
INVENTORY_PATH = REFERENCE_DIR / 'reference_inventory.json'
FEATURES_PATH = REFERENCE_DIR / 'ref_features_180s.json'
OUTPUT_PATH = REFERENCE_DIR / 'reference_profile.json'

SOURCE_MAP = {
    'focus': {
        'feature_key': 'deep_work_ref',
        'audio_filename': 'work.wav',
        'segment_file': 'work_segments.json',
        'index_key': 'focus',
        'generator_modes': ['focus', 'deepWork'],
        'notes': 'Use as the main work/focus calibration pack. deepWork should stay slightly darker than focus while preserving momentum.',
    },
    'creative': {
        'feature_key': 'creative_ref',
        'audio_filename': 'creative.wav',
        'segment_file': 'creative_segments.json',
        'index_key': 'creative',
        'generator_modes': ['creative'],
        'notes': 'Use for exploratory, cinematic, or left-turn texture tuning.',
    },
    'learn': {
        'feature_key': 'learn_ref',
        'audio_filename': 'learn.wav',
        'segment_file': 'learn_segments.json',
        'index_key': 'learn',
        'generator_modes': ['learn'],
        'notes': 'Use for teaching/reading support beds that stay present without getting sleepy.',
    },
    'motivate': {
        'feature_key': 'motivate_ref',
        'audio_filename': 'motivate.wav',
        'segment_file': 'motivate_segments.json',
        'index_key': 'motivate',
        'generator_modes': ['motivate'],
        'notes': 'Use for the strongest forward-drive variant and for demo moments that need an obvious lift.',
    },
}


def top_labels(items: list[list], limit: int = 6) -> list[str]:
    return [str(name) for name, _count in items[:limit]]


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding='utf-8'))


def build_pack(name: str, config: dict, inventory: dict, features: dict) -> dict:
    index_summary = inventory['indexes'][config['index_key']]
    audio_summary = inventory['audio_files'][config['audio_filename']]
    segment_path = REFERENCE_DIR / config['segment_file']
    segments = load_json(segment_path) if segment_path.exists() else None
    feature_snapshot = features[config['feature_key']]

    pack = {
        'reference_pack': name,
        'generator_modes': config['generator_modes'],
        'notes': config['notes'],
        'reference_audio': {
            'filename': config['audio_filename'],
            **audio_summary,
        },
        'index_summary': {
            'entries': index_summary['entries'],
            'avg_bpm': index_summary.get('avg_bpm'),
            'bpms': index_summary.get('bpms', []),
            'top_moods': top_labels(index_summary.get('top_moods', [])),
            'top_instrumentation': top_labels(index_summary.get('top_instrumentation', [])),
            'genres': top_labels(index_summary.get('genres', [])),
            'brightness': index_summary.get('brightness', {}),
            'complexity': index_summary.get('complexity', {}),
            'titles': index_summary.get('titles', []),
        },
        'feature_snapshot': feature_snapshot,
        'segment_candidates': segments,
        'generator_targets': {
            'tempo_bpm_target': index_summary.get('avg_bpm', feature_snapshot.get('tempo_bpm_est')),
            'tempo_bpm_est_from_audio': feature_snapshot.get('tempo_bpm_est'),
            'centroid_hz_target': feature_snapshot.get('centroid_hz'),
            'bandwidth_hz_target': feature_snapshot.get('bandwidth_hz'),
            'rms_db_target': feature_snapshot.get('rms_db'),
            'peak_dbfs_target': feature_snapshot.get('peak_dbfs'),
            'brightness_bias': max(index_summary.get('brightness', {}), key=index_summary.get('brightness', {}).get, default='unknown'),
            'complexity_bias': max(index_summary.get('complexity', {}), key=index_summary.get('complexity', {}).get, default='unknown'),
            'mood_keywords': top_labels(index_summary.get('top_moods', [])),
            'instrument_keywords': top_labels(index_summary.get('top_instrumentation', [])),
        },
    }
    return pack


def main() -> int:
    inventory = load_json(INVENTORY_PATH)
    features = load_json(FEATURES_PATH)
    packs = {name: build_pack(name, config, inventory, features) for name, config in SOURCE_MAP.items()}

    profile = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'inventory_path': str(INVENTORY_PATH),
        'features_path': str(FEATURES_PATH),
        'reference_packs': packs,
        'mode_to_pack': {
            'focus': 'focus',
            'deepWork': 'focus',
            'creative': 'creative',
            'learn': 'learn',
            'motivate': 'motivate',
        },
        'quick_targets': {
            mode: packs[pack]['generator_targets']
            for mode, pack in {
                'focus': 'focus',
                'deepWork': 'focus',
                'creative': 'creative',
                'learn': 'learn',
                'motivate': 'motivate',
            }.items()
        },
    }

    OUTPUT_PATH.write_text(json.dumps(profile, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'wrote': str(OUTPUT_PATH), 'packs': list(packs.keys())}, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
