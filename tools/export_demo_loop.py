#!/usr/bin/env python3
"""Generate, save, and analyze one ArgoBeat export in a single command."""

import argparse
import json
import shlex
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VENV_PYTHON = ROOT / '.venv' / 'bin' / 'python3'
ANALYZE_PYTHON = str(VENV_PYTHON if VENV_PYTHON.exists() else sys.executable)
MOOD_TARGETS = {
    'focus': {'lufs': (-20, -14), 'centroid': (1000, 1600), 'bpm': (72, 96), 'hz': 15.0},
    'deepWork': {'lufs': (-20, -14), 'centroid': (900, 1500), 'bpm': (76, 100), 'hz': 18.0},
    'relax': {'lufs': (-22, -16), 'centroid': (700, 1300), 'bpm': (55, 85), 'hz': 10.0},
    'meditate': {'lufs': (-22, -16), 'centroid': (500, 1100), 'bpm': (45, 75), 'hz': 6.0},
    'sleep': {'lufs': (-24, -18), 'centroid': (400, 1000), 'bpm': (35, 70), 'hz': 2.0},
}
UNIVERSAL = {
    'harmonic_ratio': 0.55,
    'noise_floor': -45,
    'repetition': 0.35,
    'spectral_spread': (400, 1600),
    'short_loop_similarity': 0.98,
    'target_prominence_db': 6.0,
    'target_share': 0.005,
    'sample_peak_dbfs': -1.0,
    'clipped_samples': 0,
}


def run(cmd: list[str]) -> None:
    print(f"$ {' '.join(shlex.quote(part) for part in cmd)}")
    subprocess.run(cmd, check=True, cwd=ROOT)


def default_name(mood: str, duration: int, seed: int) -> str:
    return f'{mood}-{duration}s-seed{seed}'


def check_pass(value: float, target_range: tuple[float, float] | None = None, target_min: float | None = None, target_max: float | None = None) -> str:
    if target_range:
        lo, hi = target_range
        return 'PASS' if lo <= value <= hi else 'FAIL'
    if target_min is not None:
        return 'PASS' if value >= target_min else 'FAIL'
    if target_max is not None:
        return 'PASS' if value <= target_max else 'FAIL'
    return 'INFO'


def build_checks(mood: str, analysis: dict[str, object]) -> list[dict[str, str]]:
    targets = MOOD_TARGETS.get(mood, MOOD_TARGETS['focus'])
    rows = [
        {
            'metric': 'Spectral Centroid',
            'value': f"{analysis['centroid_hz']} Hz",
            'target': f"{targets['centroid'][0]}-{targets['centroid'][1]}",
            'status': check_pass(float(analysis['centroid_hz']), target_range=targets['centroid']),
        },
        {
            'metric': 'Spectral Spread',
            'value': f"{analysis['spectral_spread_hz']} Hz",
            'target': f"{UNIVERSAL['spectral_spread'][0]}-{UNIVERSAL['spectral_spread'][1]}",
            'status': check_pass(float(analysis['spectral_spread_hz']), target_range=UNIVERSAL['spectral_spread']),
        },
        {
            'metric': 'Harmonic Energy',
            'value': f"{analysis['harmonic_ratio']:.3f}",
            'target': f">={UNIVERSAL['harmonic_ratio']}",
            'status': check_pass(float(analysis['harmonic_ratio']), target_min=UNIVERSAL['harmonic_ratio']),
        },
        {
            'metric': 'RMS Loudness',
            'value': f"{analysis['rms_db']} dB",
            'target': f"{targets['lufs'][0]} to {targets['lufs'][1]}",
            'status': check_pass(float(analysis['rms_db']), target_range=targets['lufs']),
        },
        {
            'metric': 'Noise Floor',
            'value': f"{analysis['noise_floor_db']} dB",
            'target': f"<{UNIVERSAL['noise_floor']}",
            'status': check_pass(float(analysis['noise_floor_db']), target_max=UNIVERSAL['noise_floor']),
        },
        {
            'metric': 'Tempo',
            'value': f"{analysis['tempo_bpm']} BPM",
            'target': f"{targets['bpm'][0]}-{targets['bpm'][1]}",
            'status': check_pass(float(analysis['tempo_bpm']), target_range=targets['bpm']),
        },
        {
            'metric': 'Repetition Ratio',
            'value': f"{float(analysis['repetition_ratio']):.1%}",
            'target': f"<{UNIVERSAL['repetition']:.0%}",
            'status': check_pass(float(analysis['repetition_ratio']), target_max=UNIVERSAL['repetition']),
        },
        {
            'metric': 'Short Loop Similarity',
            'value': f"{analysis['short_loop_similarity']:.3f}",
            'target': f"<{UNIVERSAL['short_loop_similarity']}",
            'status': check_pass(float(analysis['short_loop_similarity']), target_max=UNIVERSAL['short_loop_similarity']),
        },
        {
            'metric': 'Sample Peak',
            'value': f"{analysis['sample_peak_dbfs']} dBFS",
            'target': f"<={UNIVERSAL['sample_peak_dbfs']}",
            'status': check_pass(float(analysis['sample_peak_dbfs']), target_max=UNIVERSAL['sample_peak_dbfs']),
        },
        {
            'metric': 'Clipped Samples',
            'value': str(analysis['clipped_samples']),
            'target': str(UNIVERSAL['clipped_samples']),
            'status': check_pass(int(analysis['clipped_samples']), target_max=UNIVERSAL['clipped_samples']),
        },
    ]

    if 'entrainment_peak_hz' in analysis:
        target_error = abs(float(analysis['entrainment_peak_hz']) - float(analysis['entrainment_target_hz']))
        rows.extend([
            {
                'metric': 'Target Mod Peak',
                'value': f"{analysis['entrainment_peak_hz']} Hz",
                'target': f"{analysis['entrainment_target_hz']} +/-0.75",
                'status': check_pass(target_error, target_max=0.75),
            },
            {
                'metric': 'Target Prominence',
                'value': f"{analysis['entrainment_prominence_db']} dB",
                'target': f">={UNIVERSAL['target_prominence_db']}",
                'status': check_pass(float(analysis['entrainment_prominence_db']), target_min=UNIVERSAL['target_prominence_db']),
            },
            {
                'metric': 'Target Power Share',
                'value': f"{float(analysis['entrainment_target_share']):.2%}",
                'target': f">={UNIVERSAL['target_share']:.2%}",
                'status': check_pass(float(analysis['entrainment_target_share']), target_min=UNIVERSAL['target_share']),
            },
        ])

    if analysis.get('stereo_pan_prominence_db') is not None:
        rows.append({
            'metric': 'Stereo Pan Prom.',
            'value': f"{analysis['stereo_pan_prominence_db']} dB",
            'target': f">={UNIVERSAL['target_prominence_db']}",
            'status': check_pass(float(analysis['stereo_pan_prominence_db']), target_min=UNIVERSAL['target_prominence_db']),
        })

    return rows


def build_summary(run_dir: Path, metadata: dict[str, object], analysis: dict[str, object]) -> tuple[str, dict[str, int]]:
    checks = build_checks(str(metadata['mood']), analysis)
    passes = sum(1 for row in checks if row['status'] == 'PASS')
    failures = sum(1 for row in checks if row['status'] == 'FAIL')
    summary_lines = [
        '# ArgoBeat Demo Export Summary',
        '',
        f"- Run: `{metadata['runName']}`",
        f"- Created: `{metadata['createdAt']}`",
        f"- Mood: `{metadata['mood']}`",
        f"- Duration: `{metadata['durationSeconds']}s`",
        f"- Seed: `{metadata['seed']}`",
        f"- QA result: `{passes}/{len(checks)} PASS`",
        '',
        '## Artifacts',
        '',
        f"- Audio: `{metadata['artifacts']['audio']}`",
        f"- Analysis JSON: `{metadata['artifacts']['analysis']}`",
        f"- Metadata JSON: `{metadata['artifacts']['metadata']}`",
        f"- Summary: `{run_dir / 'SUMMARY.md'}`",
        '',
        '## Re-run',
        '',
        '```bash',
        shell_join(metadata['commands']['export']),
        shell_join(metadata['commands']['analyze']),
        '```',
        '',
        '## QA Snapshot',
        '',
        '| Metric | Value | Target | Status |',
        '| --- | ---: | ---: | --- |',
    ]
    for row in checks:
        summary_lines.append(f"| {row['metric']} | {row['value']} | {row['target']} | {row['status']} |")
    summary_lines.extend([
        '',
        'This summary is generated from `analysis.json` and is intended for quick operator review.',
    ])
    return '\n'.join(summary_lines) + '\n', {'pass': passes, 'fail': failures, 'total': len(checks)}


def main() -> int:
    parser = argparse.ArgumentParser(description='Generate and analyze one ArgoBeat demo export')
    parser.add_argument('--out-dir', required=True, help='Directory that will receive the run folder')
    parser.add_argument('--mood', default='focus', help='Export mood')
    parser.add_argument('--duration', type=int, default=30, help='Export duration in seconds')
    parser.add_argument('--seed', type=int, default=424242, help='Export seed')
    parser.add_argument('--name', help='Optional run folder / basename')
    parser.add_argument(
        '--export-arg',
        action='append',
        default=[],
        help='Extra raw argument to pass through to tools/argobeat export (repeatable)',
    )
    args = parser.parse_args()

    run_name = args.name or default_name(args.mood, args.duration, args.seed)
    run_dir = Path(args.out_dir).expanduser().resolve() / run_name
    run_dir.mkdir(parents=True, exist_ok=True)

    wav_path = run_dir / f'{run_name}.wav'
    metadata_path = run_dir / 'metadata.json'
    analysis_path = run_dir / 'analysis.json'
    summary_path = run_dir / 'SUMMARY.md'

    export_cmd = [
        str(ROOT / 'tools' / 'argobeat'),
        'export',
        '--output',
        str(wav_path),
        '--mood',
        args.mood,
        '--duration',
        str(args.duration),
        '--seed',
        str(args.seed),
        *args.export_arg,
    ]
    analyze_cmd = [
        ANALYZE_PYTHON,
        str(ROOT / 'tools' / 'analyze_audio.py'),
        '--file',
        str(wav_path),
        '--mood',
        args.mood,
        '--json-out',
        str(analysis_path),
    ]

    metadata = {
        'schema': 'argobeat.hackathonDemoExport.v1',
        'createdAt': datetime.now(UTC).isoformat().replace('+00:00', 'Z'),
        'mood': args.mood,
        'durationSeconds': args.duration,
        'seed': args.seed,
        'runName': run_name,
        'outputDirectory': str(run_dir),
        'artifacts': {
            'audio': str(wav_path),
            'metadata': str(metadata_path),
            'analysis': str(analysis_path),
            'summary': str(summary_path),
        },
        'commands': {
            'export': export_cmd,
            'analyze': analyze_cmd,
        },
        'exportArgs': args.export_arg,
    }
    metadata_path.write_text(json.dumps(metadata, indent=2) + '\n')

    run(export_cmd)
    run(analyze_cmd)

    analysis = json.loads(analysis_path.read_text(encoding='utf-8'))
    summary_text, qa_summary = build_summary(run_dir, metadata, analysis)
    summary_path.write_text(summary_text, encoding='utf-8')
    metadata['qaSummary'] = qa_summary
    metadata_path.write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')

    print('\nArtifacts:')
    print(f'  audio:    {wav_path}')
    print(f'  metadata: {metadata_path}')
    print(f'  analysis: {analysis_path}')
    print(f'  summary:  {summary_path}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
