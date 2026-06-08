#!/usr/bin/env python3
"""
ArgoBeat verification + local demo harness.

The single source of truth for "did this change make the audio better?"
Renders ArgoBeat tracks, scores them with the project's OWN analyzer
(tools/analyze_audio.py, via --json-out — no fragile text parsing), reads
true integrated LUFS from ffmpeg ebur128 (summary block, not the fade-in
floor), and compares every metric against MEASURED brain.fm reference values.

Usage:
  # Render + score a matrix and print a comparison vs brain.fm:
  python3 tools/abx_verify.py render --moods focus,sleep --seeds 111,222 --duration 60

  # Score already-rendered WAVs:
  python3 tools/abx_verify.py score /path/a.wav:focus /path/b.wav:sleep

  # (Re)measure the brain.fm reference slices themselves:
  python3 tools/abx_verify.py refs

Outputs: prints a table; writes JSON + SUMMARY.md under --out (default
/tmp/abx-verify). Always prints the list of WAV paths so you can LISTEN.

This harness makes NO audio judgement — objective metrics only. The final
"does it sound good" gate is your ears (see the printed PLAY list).
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ANALYZER = REPO / "tools" / "analyze_audio.py"
# Use the project venv python if it has librosa, else the analysis venv.
PY_CANDIDATES = [
    "/tmp/argobeat-analysis-venv/bin/python3",
    str(REPO / ".venv" / "bin" / "python3"),
    sys.executable,
]

# ── MEASURED brain.fm reference values (2026-05-31, /mnt/AllShare/Argobeat/) ──
# Measured by running real brain.fm tracks through THIS analyzer. These are the
# real targets to match, not the fictional ones currently in analyze_audio.py.
# focus<-focus.flac  deepWork<-work.wav  relax<-creative.wav  meditate<-meditate.wav
BRAINFM = {
    "focus":    {"centroid_hz": 992,  "harmonic_ratio": 0.343, "rms_db": -30.3,
                 "tempo_bpm": 136.0, "noise_floor_db": -32.9, "entrainment_target_share": 0.0136,
                 "entrainment_peak_hz": 15.67, "spectral_spread_hz": 1294},
    "deepWork": {"centroid_hz": 846,  "harmonic_ratio": 0.422, "rms_db": -28.6,
                 "tempo_bpm": 139.7, "noise_floor_db": -32.4, "entrainment_target_share": 0.0052,
                 "entrainment_peak_hz": 17.37, "spectral_spread_hz": 1428},
    "relax":    {"centroid_hz": 1017, "harmonic_ratio": 0.457, "rms_db": -29.7,
                 "tempo_bpm": 120.2, "noise_floor_db": -33.0, "entrainment_target_share": 0.0043,
                 "entrainment_peak_hz": 10.68, "spectral_spread_hz": 1420},
    "meditate": {"centroid_hz": 366,  "harmonic_ratio": 0.632, "rms_db": -28.7,
                 "tempo_bpm": 0.0,   "noise_floor_db": -32.5, "entrainment_target_share": 0.0116,
                 "entrainment_peak_hz": 5.27, "spectral_spread_hz": 624},
    # sleep: no measured brain.fm ref yet (no sleep-named source file). Inherit
    # meditate-ish expectations until a real sleep reference is measured.
    "sleep":    {"centroid_hz": 437,  "harmonic_ratio": 0.60, "rms_db": -29.0,
                 "tempo_bpm": 0.0,   "noise_floor_db": -32.5, "entrainment_target_share": 0.0116,
                 "entrainment_peak_hz": 2.0, "spectral_spread_hz": 1083},
}

# Reference source files (for `refs` subcommand)
REF_SOURCES = {
    "focus": "focus.flac", "deepWork": "work.wav",
    "relax": "creative.wav", "meditate": "meditate.wav",
}
REF_DIR = Path("/mnt/AllShare/Argobeat")

# Metrics where being CLOSE to brain.fm matters (abs tolerance per metric).
# We grade ArgoBeat as "matches brain.fm" if within tolerance OR strictly better
# in the obvious direction (louder up to bfm, cleaner noise floor, etc).
CLOSE_TOL = {
    "centroid_hz": 200, "spectral_spread_hz": 300, "harmonic_ratio": 0.12,
    "rms_db": 3.0, "tempo_bpm": 25, "noise_floor_db": 4.0,
    "entrainment_target_share": 0.004, "entrainment_peak_hz": 1.0,
}


def pick_python():
    for p in PY_CANDIDATES:
        try:
            r = subprocess.run([p, "-c", "import librosa"], capture_output=True)
            if r.returncode == 0:
                return p
        except Exception:
            continue
    return sys.executable


PY = pick_python()


def true_lufs(path: str):
    """Integrated LUFS + true peak from ffmpeg ebur128 SUMMARY block (not fade-in)."""
    r = subprocess.run(["ffmpeg", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True)
    t = r.stderr
    summ = t.split("Summary:")[-1] if "Summary:" in t else t
    out = {}
    m = re.search(r"I:\s*(-?[\d.]+)\s*LUFS", summ)
    out["true_lufs"] = float(m.group(1)) if m else None
    m = re.search(r"Peak:\s*(-?[\d.]+)\s*dBFS", summ)
    out["true_peak_dbfs"] = float(m.group(1)) if m else None
    return out


def analyze(path: str, mood: str, out_dir: Path) -> dict:
    """Run the project analyzer, return its JSON dict (authoritative scorer)."""
    jp = out_dir / (Path(path).stem + ".analysis.json")
    target_hz = BRAINFM.get(mood, {}).get("entrainment_peak_hz")
    cmd = [PY, str(ANALYZER), "--file", path, "--mood", mood, "--json-out", str(jp)]
    if target_hz:
        cmd += ["--target-hz", str(target_hz)]
    subprocess.run(cmd, cwd=REPO, capture_output=True, text=True)
    if not jp.exists():
        return {}
    data = json.loads(jp.read_text())
    data.update(true_lufs(path))
    return data


def render(mood: str, seed: int, duration: int, out_dir: Path,
           extra: list[str]) -> Path | None:
    out = out_dir / f"{mood}_s{seed}_d{duration}.wav"
    cmd = ["bash", "tools/argobeat", "export", "--output", str(out),
           "--mood", mood, "--duration", str(duration), "--seed", str(seed)] + extra
    r = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True)
    if not out.exists():
        print(f"  RENDER FAILED {mood}/{seed}: {r.stderr[-400:] or r.stdout[-400:]}",
              file=sys.stderr)
        return None
    return out


def grade(mood: str, m: dict) -> list[tuple]:
    """Return [(metric, argo_val, bfm_val, verdict)]. verdict: MATCH/BETTER/OFF."""
    ref = BRAINFM.get(mood, {})
    rows = []
    for key in ["centroid_hz", "spectral_spread_hz", "harmonic_ratio", "rms_db",
                "tempo_bpm", "noise_floor_db", "entrainment_target_share",
                "entrainment_peak_hz"]:
        av = m.get(key)
        bv = ref.get(key)
        if av is None or bv is None:
            rows.append((key, av, bv, "n/a"))
            continue
        tol = CLOSE_TOL.get(key, 0)
        delta = abs(av - bv)
        if delta <= tol:
            verdict = "MATCH"
        else:
            # direction-aware "better": louder(rms up toward bfm), cleaner(noise lower),
            # more harmonic(higher), more AM(higher) count as better even if not within tol
            better = (
                (key == "rms_db" and av > bv) or
                (key == "noise_floor_db" and av < bv) or
                (key == "harmonic_ratio" and av > bv) or
                (key == "entrainment_target_share" and av >= bv)
            )
            verdict = "BETTER" if better else "OFF"
        rows.append((key, av, bv, verdict))
    # always-objective extras
    rows.append(("clipped_samples", m.get("clipped_samples"), 0,
                 "MATCH" if (m.get("clipped_samples") or 0) == 0 else "OFF"))
    rows.append(("true_lufs", m.get("true_lufs"), ref.get("rms_db"), "info"))
    return rows


def fmt(v):
    if isinstance(v, float):
        return f"{v:.3f}" if abs(v) < 10 else f"{v:.1f}"
    return str(v)


def report(results: list[dict], out_dir: Path):
    lines = ["# ArgoBeat vs brain.fm — verification", ""]
    for r in results:
        mood, path, m = r["mood"], r["path"], r["metrics"]
        lines.append(f"## {mood}  `{path}`")
        if not m:
            lines.append("  (analysis failed)\n"); continue
        lines.append("")
        lines.append("| metric | argobeat | brain.fm | verdict |")
        lines.append("|---|---|---|---|")
        for key, av, bv, verdict in grade(mood, m):
            mark = {"MATCH": "✅", "BETTER": "✅+", "OFF": "❌", "info": "·", "n/a": "?"}.get(verdict, "")
            lines.append(f"| {key} | {fmt(av)} | {fmt(bv)} | {mark} {verdict} |")
        offs = [k for k, av, bv, v in grade(mood, m) if v == "OFF"]
        lines.append("")
        lines.append(f"**OFF metrics:** {', '.join(offs) if offs else 'none — matches/beats brain.fm'}")
        lines.append("")
    # PLAY list — the human acceptance gate
    lines.append("## ▶ PLAY THESE (your ears are the final gate)")
    for r in results:
        lines.append(f"- {r['mood']}: `{r['path']}`")
    txt = "\n".join(lines)
    (out_dir / "SUMMARY.md").write_text(txt)
    (out_dir / "results.json").write_text(json.dumps(results, indent=2, default=float))
    print(txt)
    print(f"\n[written] {out_dir}/SUMMARY.md  |  {out_dir}/results.json")
    print(f"[python]  {PY}")


def cmd_render(args):
    out_dir = Path(args.out); out_dir.mkdir(parents=True, exist_ok=True)
    moods = args.moods.split(",")
    seeds = [int(s) for s in args.seeds.split(",")]
    extra = args.export_args.split() if args.export_args else []
    results = []
    jobs = [(mo, se) for mo in moods for se in seeds]
    for i, (mo, se) in enumerate(jobs, 1):
        print(f"[{i}/{len(jobs)}] render {mo}/{se} d{args.duration} ...", flush=True)
        w = render(mo, se, args.duration, out_dir, extra)
        if not w:
            continue
        m = analyze(str(w), mo, out_dir)
        results.append({"mood": mo, "seed": se, "path": str(w), "metrics": m})
    report(results, out_dir)


def cmd_score(args):
    out_dir = Path(args.out); out_dir.mkdir(parents=True, exist_ok=True)
    results = []
    for spec in args.files:
        path, _, mood = spec.partition(":")
        mood = mood or "focus"
        print(f"score {mood} {path} ...", flush=True)
        m = analyze(path, mood, out_dir)
        results.append({"mood": mood, "path": path, "metrics": m})
    report(results, out_dir)


def cmd_refs(args):
    out_dir = Path(args.out); out_dir.mkdir(parents=True, exist_ok=True)
    results = []
    for mood, src in REF_SOURCES.items():
        f = REF_DIR / src
        if not f.exists():
            print(f"  missing ref {f}", file=sys.stderr); continue
        sl = out_dir / f"ref_{mood}.wav"
        subprocess.run(["ffmpeg", "-y", "-i", str(f), "-ss", "300", "-t", "60",
                        "-ar", "44100", "-ac", "2", str(sl)], capture_output=True)
        m = analyze(str(sl), mood, out_dir)
        results.append({"mood": mood, "path": str(sl), "metrics": m})
    report(results, out_dir)


def main():
    ap = argparse.ArgumentParser(description="ArgoBeat verification + demo harness")
    sub = ap.add_subparsers(dest="cmd", required=True)
    pr = sub.add_parser("render"); pr.set_defaults(fn=cmd_render)
    pr.add_argument("--moods", default="focus,deepWork,relax,meditate,sleep")
    pr.add_argument("--seeds", default="424242")
    pr.add_argument("--duration", type=int, default=60)
    pr.add_argument("--export-args", default="")
    pr.add_argument("--out", default="/tmp/abx-verify")
    ps = sub.add_parser("score"); ps.set_defaults(fn=cmd_score)
    ps.add_argument("files", nargs="+", help="path:mood ...")
    ps.add_argument("--out", default="/tmp/abx-verify")
    pf = sub.add_parser("refs"); pf.set_defaults(fn=cmd_refs)
    pf.add_argument("--out", default="/tmp/abx-verify-refs")
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
