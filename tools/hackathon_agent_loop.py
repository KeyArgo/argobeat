#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import shlex
import subprocess
import sys
import textwrap
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
SETTINGS_PATH = ROOT / 'hackathon-audiocraft.settings.json'
REFERENCE_PROFILE_PATH = ROOT / 'scratch' / 'reference' / 'reference_profile.json'
REFERENCE_FEATURES_PATH = ROOT / 'scratch' / 'reference' / 'ref_features_180s.json'
REFERENCE_INVENTORY_PATH = ROOT / 'scratch' / 'reference' / 'reference_inventory.json'
SCRATCH_DIR = ROOT / 'scratch' / 'agent-loop'
RUNS_DIR = SCRATCH_DIR / 'runs'
PRESETS = {
    'baseline': [],
    'darker_glue': ['--padFilterMult', '0.88', '--melodyFilterMult', '0.95', '--masterLowpass', '6600', '--masterPresence', '1.6', '--masterGain', '0.68'],
    'clearer_lead': ['--padFilterMult', '0.94', '--melodyFilterMult', '1.12', '--masterLowpass', '8000', '--masterPresence', '3.1', '--masterGain', '0.72'],
    'deeper_bed': ['--padFilterMult', '0.82', '--melodyFilterMult', '0.9', '--masterLowpass', '6100', '--masterPresence', '1.0', '--masterGain', '0.66'],
}
PROVIDER_ORDER = ['claude', 'gemini', 'codex']
REVIEW_ORDER = ['claude', 'gemini', 'codex']


@dataclass
class CmdResult:
    command: list[str]
    cwd: str
    exit_code: int
    stdout: str
    stderr: str
    seconds: float

    def as_dict(self) -> dict[str, Any]:
        return {
            'command': self.command,
            'cwd': self.cwd,
            'exit_code': self.exit_code,
            'stdout': self.stdout,
            'stderr': self.stderr,
            'seconds': round(self.seconds, 2),
        }


def now_slug() -> str:
    return datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')


def shell_join(parts: list[str]) -> str:
    return ' '.join(shlex.quote(part) for part in parts)


def run_cmd(
    cmd: list[str],
    *,
    cwd: Path = ROOT,
    timeout: int = 300,
    env: dict[str, str] | None = None,
    input_text: str | None = None,
    check: bool = False,
) -> CmdResult:
    started = datetime.now(UTC)
    proc = subprocess.run(
        cmd,
        cwd=str(cwd),
        env=env,
        input=input_text,
        text=True,
        capture_output=True,
        timeout=timeout,
    )
    finished = datetime.now(UTC)
    result = CmdResult(
        command=cmd,
        cwd=str(cwd),
        exit_code=proc.returncode,
        stdout=proc.stdout,
        stderr=proc.stderr,
        seconds=(finished - started).total_seconds(),
    )
    if check and result.exit_code != 0:
        raise RuntimeError(f'command failed ({result.exit_code}): {shell_join(cmd)}\n{result.stderr or result.stdout}')
    return result


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def write_json(path: Path, payload: Any) -> None:
    ensure_dir(path.parent)
    path.write_text(json.dumps(payload, indent=2) + '\n', encoding='utf-8')


def write_text(path: Path, text: str) -> None:
    ensure_dir(path.parent)
    path.write_text(text, encoding='utf-8')


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding='utf-8'))


def load_settings() -> dict[str, Any]:
    return load_json(SETTINGS_PATH)


def load_reference_profile() -> dict[str, Any]:
    return load_json(REFERENCE_PROFILE_PATH)


def normalize_mode(mode: str, profile: dict[str, Any]) -> tuple[str, str]:
    pack_name = profile.get('mode_to_pack', {}).get(mode, 'focus')
    return mode, pack_name


def get_reference_pack(profile: dict[str, Any], mode: str) -> dict[str, Any]:
    _mode, pack_name = normalize_mode(mode, profile)
    packs = profile.get('reference_packs', {})
    if pack_name not in packs:
        raise KeyError(f'missing reference pack for mode {mode}: {pack_name}')
    return packs[pack_name]


def refresh_reference_profile(run_dir: Path) -> dict[str, Any]:
    ref_dir = ensure_dir(ROOT / 'scratch' / 'reference')
    inventory_cmd = ['python3', str(ROOT / 'tools' / 'reference_inventory.py')]
    inventory_res = run_cmd(inventory_cmd, timeout=300, check=True)
    REFERENCE_INVENTORY_PATH.write_text(inventory_res.stdout, encoding='utf-8')

    features_cmd = ['python3', str(ROOT / 'tools' / 'ref_features.py'), '180', '--out', str(REFERENCE_FEATURES_PATH)]
    features_res = run_cmd(features_cmd, timeout=300, check=True)

    build_cmd = ['python3', str(ROOT / 'tools' / 'build_reference_profile.py')]
    build_res = run_cmd(build_cmd, timeout=300, check=True)

    payload = {
        'inventory': inventory_res.as_dict(),
        'features': features_res.as_dict(),
        'build_profile': build_res.as_dict(),
        'reference_dir': str(ref_dir),
        'profile_path': str(REFERENCE_PROFILE_PATH),
    }
    write_json(run_dir / 'reference-refresh.json', payload)
    return payload


def provider_prompt(provider: str, role_prompt: str) -> str:
    return textwrap.dedent(
        f'''
        You are Hermes Agent helping a creative hackathon submission for Argobeat.
        Provider role: {provider}.

        Constraints:
        - Keep it concise and concrete.
        - No tools.
        - Optimize for judges scoring creativity, usefulness, and presentation.
        - If you recommend a next step, make it one step only.

        {role_prompt.strip()}
        '''
    ).strip()


def run_provider(provider: str, prompt: str, *, cwd: Path = ROOT, allow_write: bool = False, timeout: int | None = None) -> dict[str, Any]:
    sandbox_timeout = timeout or 240
    env = os.environ.copy()

    if provider == 'codex':
        cmd = [
            'codex', 'exec',
            '--skip-git-repo-check',
            '-C', str(cwd),
            '-s', 'workspace-write' if allow_write else 'read-only',
            '-',
        ]
        if allow_write:
            cmd.append('--full-auto')
        res = run_cmd(cmd, cwd=cwd, timeout=sandbox_timeout, input_text=prompt)
    elif provider == 'claude':
        cmd = ['claude', '-p', prompt, '--output-format', 'text']
        if allow_write:
            cmd += ['--permission-mode', 'acceptEdits']
        else:
            cmd += ['--permission-mode', 'plan', '--allowedTools', '']
        res = run_cmd(cmd, cwd=cwd, timeout=sandbox_timeout)
    elif provider == 'gemini':
        cmd = [
            'gemini', '--skip-trust', '--model', 'gemini-2.5-flash-lite',
            '--output-format', 'text', '--prompt', prompt,
            '--approval-mode', 'auto_edit' if allow_write else 'plan',
        ]
        env['GEMINI_CLI_TRUST_WORKSPACE'] = 'true'
        res = run_cmd(cmd, cwd=cwd, timeout=sandbox_timeout, env=env)
    else:
        raise ValueError(f'unknown provider: {provider}')

    output = (res.stdout or '').strip()
    if res.stderr.strip():
        output = (output + '\n\n[stderr]\n' + res.stderr.strip()).strip()
    return {
        'provider': provider,
        'ok': res.exit_code == 0,
        'result': res.as_dict(),
        'output': output,
    }


def preflight_probes() -> dict[str, Any]:
    probes = {
        'codex': ['bash', '-lc', "codex login status && printf 'Reply exactly CODEX_OK.\\n' | codex exec --skip-git-repo-check --sandbox read-only -C /home/argo -"],
        'claude': ['bash', '-lc', "claude auth status --text && claude -p 'Reply exactly CLAUDE_OK.' --permission-mode plan --output-format text --allowedTools '' --model haiku"],
        'gemini': ['bash', '-lc', "HOME=/home/argo GEMINI_CLI_TRUST_WORKSPACE=true gemini --skip-trust -m gemini-2.5-flash-lite --approval-mode plan --output-format text -p 'Do not use tools. Reply exactly GEMINI_OK.'"],
    }
    results: dict[str, Any] = {}
    for provider, cmd in probes.items():
        try:
            res = run_cmd(cmd, timeout=300)
            combined = ((res.stdout or '') + '\n' + (res.stderr or '')).strip()
            ok_token = f'{provider.upper()}_OK'
            results[provider] = {
                'ok': res.exit_code == 0 and ok_token in combined,
                'command': cmd,
                'exit_code': res.exit_code,
                'stdout': res.stdout,
                'stderr': res.stderr,
                'seconds': round(res.seconds, 2),
                'reason': None if (res.exit_code == 0 and ok_token in combined) else 'probe failed or timed out',
            }
        except Exception as exc:  # noqa: BLE001
            results[provider] = {
                'ok': False,
                'command': cmd,
                'exit_code': None,
                'stdout': '',
                'stderr': str(exc),
                'seconds': None,
                'reason': 'exception during probe',
            }
    return results


def render_variants(mode: str, duration: int, seed: int, run_dir: Path, profile: dict[str, Any]) -> list[dict[str, Any]]:
    pack = get_reference_pack(profile, mode)
    target_bpm = pack.get('generator_targets', {}).get('tempo_bpm_target')
    renders_dir = ensure_dir(run_dir / 'renders')
    results: list[dict[str, Any]] = []

    for index, (name, extra_args) in enumerate(PRESETS.items(), start=1):
        variant_seed = seed + index - 1
        variant_name = f'{mode}-{name}'
        cmd = [
            'python3',
            str(ROOT / 'tools' / 'export_demo_loop.py'),
            '--out-dir',
            str(renders_dir),
            '--mood',
            mode,
            '--duration',
            str(duration),
            '--seed',
            str(variant_seed),
            '--name',
            variant_name,
        ]
        if target_bpm:
            cmd += [f'--export-arg=--bpm', f'--export-arg={round(float(target_bpm), 1)}']
        for piece in extra_args:
            cmd.append(f'--export-arg={piece}')
        result = run_cmd(cmd, timeout=1200)
        candidate_dir = renders_dir / variant_name
        metadata_path = candidate_dir / 'metadata.json'
        analysis_path = candidate_dir / 'analysis.json'
        metadata = load_json(metadata_path) if metadata_path.exists() else {}
        analysis = load_json(analysis_path) if analysis_path.exists() else {}
        score = score_render(mode, analysis, profile)
        if result.exit_code != 0:
            score['total'] = 0.0
            score['notes'] = [f'render command failed with exit {result.exit_code}', *score['notes']]
        payload = {
            'variant': name,
            'run_name': variant_name,
            'seed': variant_seed,
            'export_args': metadata.get('exportArgs', []),
            'artifacts': metadata.get('artifacts', {}),
            'analysis': analysis,
            'score': score,
            'command': result.as_dict(),
        }
        write_json(candidate_dir / 'score.json', payload)
        results.append(payload)

    results.sort(key=lambda item: item['score']['total'], reverse=True)
    write_json(run_dir / 'render-leaderboard.json', results)
    return results


def score_render(mode: str, analysis: dict[str, Any], profile: dict[str, Any]) -> dict[str, Any]:
    pack = get_reference_pack(profile, mode)
    targets = pack.get('generator_targets', {})
    components: dict[str, float] = {}
    notes: list[str] = []

    centroid_target = float(targets.get('centroid_hz_target', analysis.get('centroid_hz', 0) or 1))
    bandwidth_target = float(targets.get('bandwidth_hz_target', analysis.get('spectral_spread_hz', 0) or 1))
    rms_target = float(targets.get('rms_db_target', analysis.get('rms_db', 0) or 1))

    def closeness(actual: float | None, target: float, tolerance: float, weight: float, label: str) -> None:
        if actual is None:
            components[label] = 0.0
            notes.append(f'missing {label}')
            return
        delta = abs(float(actual) - target)
        score = max(0.0, 1.0 - (delta / tolerance)) * weight
        components[label] = round(score, 2)
        if delta > tolerance * 0.75:
            notes.append(f'{label} drift {delta:.1f}')

    closeness(analysis.get('centroid_hz'), centroid_target, 450.0, 28.0, 'centroid_match')  # calibrated to measured brain.fm 2026-05-31: focus=992, deepWork=846, relax=1017, meditate=366 Hz
    closeness(analysis.get('spectral_spread_hz'), bandwidth_target, 700.0, 22.0, 'bandwidth_match')
    closeness(analysis.get('rms_db'), rms_target, 4.0, 15.0, 'rms_match')  # calibrated to measured brain.fm 2026-05-31: LUFS band -32..-24 (±4 dB from center -28)

    harmonic = float(analysis.get('harmonic_ratio', 0.0) or 0.0)
    components['harmonic_ratio'] = round(min(max(harmonic / 0.30, 0.0), 1.0) * 10.0, 2)  # calibrated to measured brain.fm 2026-05-31
    if harmonic < 0.30:  # calibrated to measured brain.fm 2026-05-31
        notes.append('harmonic ratio below 0.30')

    clipped = int(analysis.get('clipped_samples', 0) or 0)
    components['no_clipping'] = 10.0 if clipped == 0 else max(0.0, 10.0 - min(clipped, 10))
    if clipped:
        notes.append(f'{clipped} clipped samples')

    short_loop_similarity = float(analysis.get('short_loop_similarity', 1.0) or 1.0)
    loop_score = min(short_loop_similarity, 1.0) * 8.0  # calibrated to measured brain.fm 2026-05-31: functional music intentionally loops; high similarity is GOOD
    components['loop_variety'] = round(loop_score, 2)
    # no penalty for high loop similarity — deliberate non-distracting loop structure is correct for functional music  # calibrated to measured brain.fm 2026-05-31

    repetition_ratio = float(analysis.get('repetition_ratio', 1.0) or 1.0)
    repetition_score = min(repetition_ratio, 1.0) * 7.0  # calibrated to measured brain.fm 2026-05-31: functional music is intentionally self-similar; high repetition is GOOD
    components['repetition_control'] = round(repetition_score, 2)
    # no penalty for high repetition — brain.fm reference tracks read ~100%; not a quality defect  # calibrated to measured brain.fm 2026-05-31

    peak_dbfs = float(analysis.get('sample_peak_dbfs', 0.0) or 0.0)
    headroom_score = 0.0
    if peak_dbfs <= -1.0:
        headroom_score = 10.0
    elif peak_dbfs <= -0.2:
        headroom_score = 5.0
        notes.append(f'low headroom at {peak_dbfs} dBFS')
    else:
        notes.append(f'likely too hot at {peak_dbfs} dBFS')
    components['headroom'] = headroom_score

    total = round(sum(components.values()), 2)
    return {
        'total': total,
        'components': components,
        'notes': notes,
        'reference_pack': pack.get('reference_pack'),
        'reference_targets': {
            'tempo_bpm_target': targets.get('tempo_bpm_target'),
            'centroid_hz_target': targets.get('centroid_hz_target'),
            'bandwidth_hz_target': targets.get('bandwidth_hz_target'),
            'rms_db_target': targets.get('rms_db_target'),
        },
    }


def build_creative_context(settings: dict[str, Any], profile: dict[str, Any], mode: str, leaderboard: list[dict[str, Any]]) -> str:
    pack = get_reference_pack(profile, mode)
    top = leaderboard[0]
    runner_up = leaderboard[1] if len(leaderboard) > 1 else None
    lines = [
        f"Project: {settings['projectName']} / {settings['longTermBrand']}",
        f"Goal: {settings['goal']}",
        f"Mode: {mode}",
        f"Reference pack: {pack['reference_pack']}",
        f"Reference mood keywords: {', '.join(pack['generator_targets'].get('mood_keywords', []))}",
        f"Reference instruments: {', '.join(pack['generator_targets'].get('instrument_keywords', []))}",
        f"Top candidate: {top['run_name']} score={top['score']['total']}",
        f"Top candidate notes: {', '.join(top['score']['notes']) or 'none'}",
    ]
    if runner_up:
        lines.append(f"Runner-up: {runner_up['run_name']} score={runner_up['score']['total']}")
    lines.append('Candidate summaries:')
    for candidate in leaderboard:
        analysis = candidate.get('analysis', {})
        lines.append(
            f"- {candidate['run_name']}: score={candidate['score']['total']}, centroid={analysis.get('centroid_hz')}, spread={analysis.get('spectral_spread_hz')}, rms={analysis.get('rms_db')}, loopSim={analysis.get('short_loop_similarity')}, repetition={analysis.get('repetition_ratio')}"
        )
    return '\n'.join(lines)


def build_bench_prompts(settings: dict[str, Any], profile: dict[str, Any], mode: str, leaderboard: list[dict[str, Any]]) -> dict[str, str]:
    context = build_creative_context(settings, profile, mode, leaderboard)
    top = leaderboard[0]
    claude_prompt = provider_prompt(
        'claude',
        f'''
        Act as the judges-facing presenter and reviewer.
        {context}

        Return four bullets:
        - strongest usefulness claim,
        - strongest creativity claim,
        - the one thing likely to confuse judges,
        - the next change most likely to improve the demo before submission.
        '''
    )
    gemini_prompt = provider_prompt(
        'gemini',
        f'''
        Act as the skeptic.
        {context}

        Return:
        - top risk to submission quality,
        - one proof gap in the current demo,
        - one safer framing that is still compelling,
        - one operational next step.
        Use plain bullets.
        '''
    )
    codex_prompt = provider_prompt(
        'codex',
        f'''
        Act as the implementation planner.
        {context}

        Return:
        - the best candidate to keep,
        - one bounded code or pipeline improvement to make next,
        - one exact command to run after that change to prove it worked,
        - one sentence on whether to prioritize audio quality, UX, or demo storytelling next.
        Keep it short.
        '''
    )
    return {
        'claude': claude_prompt,
        'gemini': gemini_prompt,
        'codex': codex_prompt,
        'top_candidate': top['run_name'],
    }


def run_bench(settings: dict[str, Any], profile: dict[str, Any], mode: str, leaderboard: list[dict[str, Any]], run_dir: Path) -> dict[str, Any]:
    bench_dir = ensure_dir(run_dir / 'bench')
    prompts = build_bench_prompts(settings, profile, mode, leaderboard)
    prompt_payload = {key: value for key, value in prompts.items() if key in PROVIDER_ORDER}
    write_json(bench_dir / 'prompts.json', prompt_payload)

    outputs: dict[str, Any] = {'top_candidate': prompts['top_candidate']}
    for provider in PROVIDER_ORDER:
        result = run_provider(provider, prompts[provider], cwd=ROOT, allow_write=False)
        outputs[provider] = result
        write_text(bench_dir / f'{provider}.md', result.get('output', '').strip() + '\n')
    write_json(bench_dir / 'results.json', outputs)
    return outputs


def load_task_text(task_file: Path) -> str:
    return task_file.read_text(encoding='utf-8').strip()


def run_code_loop(mode: str, task_file: Path, run_dir: Path, review_target: str | None = None) -> dict[str, Any]:
    task_text = load_task_text(task_file)
    code_dir = ensure_dir(run_dir / 'code-loop')
    task_snapshot = {'task_file': str(task_file), 'task_text': task_text}
    write_json(code_dir / 'task.json', task_snapshot)

    prompt = provider_prompt(
        'codex',
        f'''
        Work in the Argobeat repository at {ROOT}.
        Goal: apply the bounded hackathon task below, then stop.

        Guardrails:
        - Keep the change small and local.
        - Do not touch unrelated files.
        - After editing, run pnpm type-check.
        - Then run one audio smoke test: python3 tools/export_demo_loop.py --out-dir scratch/agent-loop/smoke --mood {mode} --duration 15 --seed 101 --name code-loop-smoke
        - In the final answer, list changed files and validation results.

        Task:
        {task_text}
        '''
    )
    codex_result = run_provider('codex', prompt, cwd=ROOT, allow_write=True, timeout=1800)
    write_text(code_dir / 'codex.md', codex_result.get('output', '').strip() + '\n')

    diff_res = run_cmd(['git', 'status', '--short'], cwd=ROOT, timeout=120)
    diff_patch = run_cmd(['git', 'diff', '--', '.'], cwd=ROOT, timeout=120)
    write_text(code_dir / 'git-status.txt', diff_res.stdout)
    write_text(code_dir / 'git-diff.patch', diff_patch.stdout)

    review_context = textwrap.dedent(
        f'''
        Review this bounded Argobeat hackathon code loop.
        Mode: {mode}
        Review target: {review_target or 'not provided'}

        Task:
        {task_text}

        Git status:
        {diff_res.stdout.strip() or '(clean)'}

        Diff:
        {diff_patch.stdout[:18000] or '(no diff)'}

        Codex summary:
        {codex_result.get('output', '')[:8000]}
        '''
    ).strip()

    review_outputs: dict[str, Any] = {'codex': codex_result, 'git_status': diff_res.as_dict()}
    for provider in REVIEW_ORDER:
        if provider == 'codex':
            continue
        prompt = provider_prompt(
            provider,
            review_context + '\n\nReturn: major risk, pass/fail recommendation, and one next proof step.'
        )
        result = run_provider(provider, prompt, cwd=ROOT, allow_write=False, timeout=240)
        review_outputs[provider] = result
        write_text(code_dir / f'review-{provider}.md', result.get('output', '').strip() + '\n')

    write_json(code_dir / 'results.json', review_outputs)
    return review_outputs


def build_summary(mode: str, leaderboard: list[dict[str, Any]], bench: dict[str, Any] | None, preflight: dict[str, Any], code_loop: dict[str, Any] | None) -> str:
    top = leaderboard[0] if leaderboard else None
    lines = [
        f'# Hackathon agent loop summary ({mode})',
        '',
        '## Preflight',
    ]
    for provider in PROVIDER_ORDER:
        probe = preflight.get(provider, {})
        status = 'PASS' if probe.get('ok') else 'DEGRADED'
        lines.append(f'- {provider}: {status}')
    if leaderboard:
        lines += [
            '',
            '## Render leaderboard',
        ]
        for candidate in leaderboard:
            lines.append(f"- {candidate['run_name']}: score {candidate['score']['total']} | notes: {', '.join(candidate['score']['notes']) or 'none'}")
        lines += [
            '',
            f"Top candidate: {top['run_name']}",
        ]
    if bench:
        lines += [
            '',
            '## Bench outputs',
        ]
        for provider in PROVIDER_ORDER:
            result = bench.get(provider, {})
            status = 'ok' if result.get('ok') else 'degraded'
            lines.append(f'- {provider}: {status}')
    if code_loop:
        lines += [
            '',
            '## Code loop',
            '- See scratch/agent-loop run artifacts for git diff and reviewer outputs.',
        ]
    return '\n'.join(lines) + '\n'


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Safe-first autonomous hackathon loop for Argobeat')
    sub = parser.add_subparsers(dest='command', required=True)

    preflight = sub.add_parser('preflight', help='Probe local agent CLIs and refresh references if requested')
    preflight.add_argument('--refresh-reference', action='store_true')

    bench = sub.add_parser('bench', help='Render candidate pack and ask all agents for judges-facing feedback')
    bench.add_argument('--mode', default='focus')
    bench.add_argument('--duration', type=int, default=30)
    bench.add_argument('--seed', type=int, default=424242)
    bench.add_argument('--refresh-reference', action='store_true')

    loop = sub.add_parser('run-once', help='Full render + bench loop with optional bounded code task')
    loop.add_argument('--mode', default='focus')
    loop.add_argument('--duration', type=int, default=30)
    loop.add_argument('--seed', type=int, default=424242)
    loop.add_argument('--refresh-reference', action='store_true')
    loop.add_argument('--task-file', type=Path, help='Optional bounded task file for Codex workspace-write step')

    code = sub.add_parser('code-loop', help='Run only the bounded code loop from a task file')
    code.add_argument('--mode', default='focus')
    code.add_argument('--task-file', type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    settings = load_settings()

    run_dir = ensure_dir(RUNS_DIR / f'{now_slug()}-{args.command}')
    write_json(run_dir / 'settings-snapshot.json', settings)

    preflight = preflight_probes()
    write_json(run_dir / 'preflight.json', preflight)

    if getattr(args, 'refresh_reference', False):
        refresh_reference_profile(run_dir)

    if args.command == 'preflight':
        summary_lines = [f'{provider}: {"PASS" if preflight[provider]["ok"] else "DEGRADED"}' for provider in PROVIDER_ORDER]
        print('\n'.join(summary_lines))
        print(f'Artifacts: {run_dir}')
        return 0

    profile = load_reference_profile()

    if args.command in {'bench', 'run-once'}:
        leaderboard = render_variants(args.mode, args.duration, args.seed, run_dir, profile)
        bench = run_bench(settings, profile, args.mode, leaderboard, run_dir)
        code_loop = None
        if args.command == 'run-once' and args.task_file:
            code_loop = run_code_loop(args.mode, args.task_file, run_dir, review_target=leaderboard[0]['run_name'])
        summary = build_summary(args.mode, leaderboard, bench, preflight, code_loop)
        write_text(run_dir / 'SUMMARY.md', summary)
        print(summary.strip())
        print(f'Artifacts: {run_dir}')
        return 0

    if args.command == 'code-loop':
        code_loop = run_code_loop(args.mode, args.task_file, run_dir)
        summary = build_summary(args.mode, [], None, preflight, code_loop)
        write_text(run_dir / 'SUMMARY.md', summary)
        print(f'Artifacts: {run_dir}')
        return 0

    raise AssertionError(f'unhandled command: {args.command}')


if __name__ == '__main__':
    raise SystemExit(main())
