#!/usr/bin/env python3.10
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

from local_audiocraft import (
    DEFAULT_JASCO_MODEL,
    DEFAULT_MUSICGEN_MODEL,
    generate_jasco,
    generate_musicgen,
)


def run() -> int:
    parser = argparse.ArgumentParser(description="Generate Argobeat vs AudioCraft comparison files.")
    parser.add_argument("--out-dir", default="/home/argo/tmp/argobeat-ai-compare")
    parser.add_argument("--seed", type=int, default=424242)
    parser.add_argument("--duration", type=int, default=10)
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    argobeat_file = out_dir / "argobeat-focus.wav"
    prompt = (
        "Focused instrumental electronic music, steady pulse, soft keys, gentle bass, "
        "clear beat, low fatigue, not cinematic, not noisy, not aggressive"
    )
    chords = "Am@0,C@2,F@4,G@6,Am@8"

    subprocess.run(
        [
            "/home/argo/bin/argobeat",
            "export",
            str(argobeat_file),
            "--mood",
            "focus",
            "--duration",
            str(args.duration),
            "--seed",
            str(args.seed),
        ],
        check=True,
    )

    results: dict[str, str | dict[str, str]] = {
        "argobeat": str(argobeat_file),
        "musicgen": "",
        "jasco": "",
        "notes": {},
    }

    try:
        musicgen_result = generate_musicgen(
            prompt,
            out_dir / "musicgen-focus",
            model_name=DEFAULT_MUSICGEN_MODEL,
            duration_s=args.duration,
        )
        results["musicgen"] = str(musicgen_result.output_path)
        results["notes"]["musicgen"] = f"Generated with {musicgen_result.model} on {musicgen_result.device}"
    except RuntimeError as exc:
        if "CUDA out of memory" not in str(exc):
            raise
        musicgen_result = generate_musicgen(
            prompt,
            out_dir / "musicgen-focus-cpu",
            model_name=DEFAULT_MUSICGEN_MODEL,
            duration_s=args.duration,
            device="cpu",
        )
        results["musicgen"] = str(musicgen_result.output_path)
        results["notes"]["musicgen"] = (
            "GPU generation hit CUDA OOM because other processes were occupying VRAM. "
            f"Retried on CPU with {musicgen_result.model}."
        )

    try:
        jasco_result = generate_jasco(
            prompt,
            chords,
            out_dir / "jasco-focus",
            model_name=DEFAULT_JASCO_MODEL,
        )
        results["jasco"] = str(jasco_result.output_path)
        results["notes"]["jasco"] = f"Generated with {jasco_result.model} on {jasco_result.device}"
    except Exception as exc:
        results["jasco"] = "unavailable"
        results["notes"]["jasco"] = (
            "JASCO model is still gated. Add HF_TOKEN and accept model access. "
            f"Current failure: {exc}"
        )

    report_path = out_dir / "report.json"
    report_path.write_text(json.dumps(results, indent=2))
    print(report_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
