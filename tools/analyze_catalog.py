#!/usr/bin/env python3
"""Analyze the deployed ArgoBeat audio catalog.

This script scores every manifest-referenced music and soundscape file with
objective audio features and mood-fit heuristics. It is intentionally local and
transparent: no medical claims, no hidden model, and no network calls.

Outputs:
  apps/web/public/audio-catalog-analysis.json
  AUDIO-CATALOG-ANALYSIS.md
"""

from __future__ import annotations

import json
import math
import re
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "packages/@argobeat/engine/src/soundscape/audio-manifest.ts"
PUBLIC_REPORT = ROOT / "apps/web/public/audio-catalog-analysis.json"
MD_REPORT = ROOT / "AUDIO-CATALOG-ANALYSIS.md"
MUSIC_ROOT = ROOT / "apps/web/public/audio/music"
SOUNDSCAPE_ROOT = ROOT / "apps/web/public/audio/soundscapes"
SAMPLE_RATE = 22050

MOODS = ["focus", "deepWork", "relax", "meditate", "sleep"]

AUTO_CATEGORIES = {
    "focus": {"rain", "stream", "forest"},
    "deepWork": {"rain", "stream", "forest"},
    "relax": {"ocean", "forest", "stream", "rain", "fire", "wind"},
    "meditate": {"wind", "space"},
    "sleep": {"ocean", "rain", "wind"},
}

MOOD_RULES = {
    "focus": {"centroid": (850, 1800), "rms": (-26, -12), "high_max": 0.36, "transient_max": 5.5, "duration_min": 60},
    "deepWork": {"centroid": (700, 1500), "rms": (-28, -13), "high_max": 0.30, "transient_max": 4.8, "duration_min": 90},
    "relax": {"centroid": (450, 1250), "rms": (-32, -15), "high_max": 0.24, "transient_max": 4.0, "duration_min": 90},
    "meditate": {"centroid": (350, 1050), "rms": (-34, -16), "high_max": 0.18, "transient_max": 3.2, "duration_min": 120},
    "sleep": {"centroid": (250, 850), "rms": (-38, -19), "high_max": 0.12, "transient_max": 2.5, "duration_min": 180},
}

STRICT_CATEGORY_MOODS = {"sleep", "meditate"}


@dataclass
class TrackRef:
    kind: str
    track_id: str
    name: str
    path: Path
    category: str | None = None


def extract_block(source: str, marker: str) -> str:
    start = source.index(marker)
    bracket = source.index("{", start)
    depth = 0
    for i in range(bracket, len(source)):
        if source[i] == "{":
            depth += 1
        elif source[i] == "}":
            depth -= 1
            if depth == 0:
                return source[bracket + 1:i]
    raise ValueError(f"Could not extract block for {marker}")


def parse_manifest() -> tuple[list[TrackRef], list[TrackRef], dict[str, list[str]]]:
    source = MANIFEST.read_text()

    soundscape_block = extract_block(source, "export const SOUNDSCAPE_TRACKS")
    soundscapes: list[TrackRef] = []
    for category, block in re.findall(r"(\w+): \[([\s\S]*?)\n  \]", soundscape_block):
        for track_id, name, file_name in re.findall(
            r"\{ id: '([^']+)', name: '([^']+)', file: '([^']+)' \}",
            block,
        ):
            soundscapes.append(
                TrackRef(
                    kind="soundscape",
                    track_id=track_id,
                    name=name,
                    category=category,
                    path=SOUNDSCAPE_ROOT / category / file_name,
                )
            )

    library_block = source[source.index("const SHARED_MUSIC_LIBRARY"):source.index("function moodPlaylist")]
    library: dict[str, TrackRef] = {}
    for key, track_id, name, file_name in re.findall(
        r"'?([\w-]+)'?: \{ id: '([^']+)', name: '([^']+)', file: '([^']+)' \}",
        library_block,
    ):
        library[key] = TrackRef(
            kind="music",
            track_id=track_id,
            name=name,
            path=MUSIC_ROOT / file_name,
        )

    playlists: dict[str, list[str]] = {}
    music_tracks: dict[str, TrackRef] = {}
    for mood, ids_blob in re.findall(r"(\w+): moodPlaylist\(\[([\s\S]*?)\]\)", source):
        ids = re.findall(r"'([^']+)'", ids_blob)
        playlists[mood] = ids
        for track_id in ids:
            if track_id not in library:
                raise ValueError(f"Unknown music track in {mood}: {track_id}")
            music_tracks[track_id] = library[track_id]

    return list(music_tracks.values()), soundscapes, playlists


def decode_audio(path: Path) -> np.ndarray:
    cmd = [
        "ffmpeg",
        "-v",
        "error",
        "-i",
        str(path),
        "-ac",
        "1",
        "-ar",
        str(SAMPLE_RATE),
        "-f",
        "f32le",
        "-",
    ]
    raw = subprocess.check_output(cmd)
    return np.frombuffer(raw, dtype=np.float32)


def db(value: float) -> float:
    return 20.0 * math.log10(max(value, 1e-12))


def frame_rms(y: np.ndarray, frame: int = 2048, hop: int = 1024) -> np.ndarray:
    if y.size < frame:
        return np.asarray([float(np.sqrt(np.mean(y * y)))])
    values = []
    for start in range(0, y.size - frame + 1, hop):
        chunk = y[start:start + frame]
        values.append(float(np.sqrt(np.mean(chunk * chunk))))
    return np.asarray(values)


def spectral_metrics(y: np.ndarray) -> dict[str, float]:
    frame = 4096
    hop = 4096
    freqs = np.fft.rfftfreq(frame, d=1 / SAMPLE_RATE)
    centroids = []
    low = []
    mid = []
    high = []
    spreads = []

    if y.size < frame:
        padded = np.pad(y, (0, frame - y.size))
        starts = [0]
    else:
        padded = y
        starts = range(0, y.size - frame + 1, hop)

    window = np.hanning(frame)
    for start in starts:
        chunk = padded[start:start + frame] * window
        power = np.abs(np.fft.rfft(chunk)) ** 2
        total = float(np.sum(power) + 1e-18)
        centroid = float(np.sum(freqs * power) / total)
        centroids.append(centroid)
        spreads.append(float(np.sqrt(np.sum(((freqs - centroid) ** 2) * power) / total)))
        low.append(float(np.sum(power[freqs < 250]) / total))
        mid.append(float(np.sum(power[(freqs >= 250) & (freqs < 4000)]) / total))
        high.append(float(np.sum(power[freqs >= 4000]) / total))

    return {
        "centroid_hz": round(float(np.mean(centroids)), 1),
        "spectral_spread_hz": round(float(np.mean(spreads)), 1),
        "low_ratio": round(float(np.mean(low)), 4),
        "mid_ratio": round(float(np.mean(mid)), 4),
        "high_ratio": round(float(np.mean(high)), 4),
    }


def short_loop_similarity(y: np.ndarray) -> float:
    segment = 10 * SAMPLE_RATE
    if y.size < segment * 3:
        return 1.0

    frame = 4096
    profiles = []
    for start in range(0, y.size - segment + 1, segment):
        chunk = y[start:start + segment]
        spectra = []
        for frame_start in range(0, chunk.size - frame + 1, frame):
            frame_chunk = chunk[frame_start:frame_start + frame] * np.hanning(frame)
            spectra.append(np.abs(np.fft.rfft(frame_chunk)))
        if not spectra:
            continue
        profile = np.log1p(np.mean(np.asarray(spectra), axis=0))
        profiles.append(profile / (np.linalg.norm(profile) + 1e-12))

    if len(profiles) < 2:
        return 1.0

    max_sim = 0.0
    for i in range(len(profiles)):
        for j in range(i + 1, len(profiles)):
            max_sim = max(max_sim, float(np.dot(profiles[i], profiles[j])))
    return round(max_sim, 4)


def analyze_file(ref: TrackRef) -> dict[str, Any]:
    print(f"Analyzing {ref.kind}: {ref.track_id}", flush=True)
    if not ref.path.exists():
        return {"error": "missing", "path": str(ref.path.relative_to(ROOT))}

    y = decode_audio(ref.path)
    if y.size == 0:
        return {"error": "empty", "path": str(ref.path.relative_to(ROOT))}

    rms = float(np.sqrt(np.mean(y * y)))
    peak = float(np.max(np.abs(y)))
    rms_frames = frame_rms(y)
    deltas = np.abs(np.diff(rms_frames))
    median_delta = float(np.median(deltas) + 1e-9) if deltas.size else 1e-9
    transient_index = float(np.percentile(deltas, 95) / median_delta) if deltas.size else 0.0
    crest = peak / (rms + 1e-12)

    metrics = {
        "duration_s": round(float(y.size / SAMPLE_RATE), 1),
        "rms_db": round(db(rms), 2),
        "peak_dbfs": round(db(peak), 2),
        "crest_factor": round(float(crest), 2),
        "transient_index": round(transient_index, 2),
        "clipped_samples": int(np.sum(np.abs(y) >= 0.999)),
        "short_loop_similarity": short_loop_similarity(y),
        **spectral_metrics(y),
    }
    return metrics


def range_score(value: float, lo: float, hi: float) -> float:
    if lo <= value <= hi:
        return 1.0
    span = max(hi - lo, 1e-9)
    distance = lo - value if value < lo else value - hi
    return max(0.0, 1.0 - distance / span)


def max_score(value: float, max_value: float) -> float:
    if value <= max_value:
        return 1.0
    return max(0.0, 1.0 - (value - max_value) / max(max_value, 1e-9))


def score_for_mood(metrics: dict[str, Any], mood: str, kind: str, category: str | None = None) -> dict[str, Any]:
    if "error" in metrics:
        return {"score": 0, "verdict": "missing", "reasons": [metrics["error"]]}

    rules = MOOD_RULES[mood]
    points = 0.0
    reasons: list[str] = []

    centroid_score = range_score(metrics["centroid_hz"], *rules["centroid"])
    points += centroid_score * 25
    if centroid_score < 0.8:
        reasons.append(f"centroid {metrics['centroid_hz']} Hz outside {rules['centroid'][0]}-{rules['centroid'][1]} Hz")

    rms_score = range_score(metrics["rms_db"], *rules["rms"])
    points += rms_score * 20
    if rms_score < 0.8:
        reasons.append(f"loudness {metrics['rms_db']} dB outside {rules['rms'][0]} to {rules['rms'][1]} dB")

    high_score = max_score(metrics["high_ratio"], rules["high_max"])
    points += high_score * 18
    if high_score < 0.8:
        reasons.append(f"high-frequency energy {metrics['high_ratio']:.1%} above {rules['high_max']:.1%}")

    transient_score = max_score(metrics["transient_index"], rules["transient_max"])
    points += transient_score * 17
    if transient_score < 0.8:
        reasons.append(f"transient index {metrics['transient_index']} above {rules['transient_max']}")

    peak_score = max_score(metrics["peak_dbfs"], -1.0)
    points += peak_score * 10
    if peak_score < 1.0:
        reasons.append(f"peak {metrics['peak_dbfs']} dBFS should be <= -1 dBFS")

    duration_min = rules["duration_min"] if kind == "music" else min(rules["duration_min"], 120)
    duration_score = min(1.0, metrics["duration_s"] / duration_min)
    points += duration_score * 10
    if duration_score < 0.8:
        reasons.append(f"duration {metrics['duration_s']}s short for {mood}")

    category_penalty = 0
    if kind == "soundscape" and category and category not in AUTO_CATEGORIES[mood]:
        category_penalty = 12
        reasons.append(f"{category} is not an automatic {mood} category")

    if kind == "soundscape" and mood in {"sleep", "meditate"} and metrics["short_loop_similarity"] >= 0.995:
        if metrics["duration_s"] < 120:
            points -= 8
        reasons.append(f"short-loop risk {metrics['short_loop_similarity']} similarity")

    score = max(0, min(100, round(points - category_penalty)))
    if score >= 85:
        verdict = "ideal"
    elif score >= 72:
        verdict = "good"
    elif score >= 58:
        verdict = "usable"
    else:
        verdict = "wrong"

    if kind == "soundscape" and mood in STRICT_CATEGORY_MOODS and category and category not in AUTO_CATEGORIES[mood]:
        verdict = "wrong"
        reasons.append(f"{mood} hard gate: category is opt-in only")

    if mood == "sleep" and kind == "soundscape" and metrics["duration_s"] < 120:
        verdict = "wrong"
        reasons.append("sleep hard gate: short file can expose audible loop seams")

    if mood == "sleep" and (metrics["transient_index"] > 3.5 or metrics["high_ratio"] > 0.18):
        verdict = "wrong"
        reasons.append("sleep hard gate: too bright or transient")

    return {"score": score, "verdict": verdict, "reasons": reasons[:5]}


def build_report() -> dict[str, Any]:
    music_refs, soundscape_refs, playlists = parse_manifest()
    metric_cache: dict[Path, dict[str, Any]] = {}

    def metrics_for(ref: TrackRef) -> dict[str, Any]:
        if ref.path not in metric_cache:
            metric_cache[ref.path] = analyze_file(ref)
        return metric_cache[ref.path]

    music = []
    for ref in sorted(music_refs, key=lambda r: r.track_id):
        metrics = metrics_for(ref)
        mood_fit = {mood: score_for_mood(metrics, mood, "music") for mood in MOODS}
        placement = {mood: playlists[mood].index(ref.track_id) + 1 for mood in playlists if ref.track_id in playlists[mood]}
        music.append({
            "id": ref.track_id,
            "name": ref.name,
            "path": str(ref.path.relative_to(ROOT)),
            "metrics": metrics,
            "mood_fit": mood_fit,
            "playlist_position": placement,
        })

    soundscapes = []
    for ref in sorted(soundscape_refs, key=lambda r: (r.category or "", r.track_id)):
        metrics = metrics_for(ref)
        mood_fit = {mood: score_for_mood(metrics, mood, "soundscape", ref.category) for mood in MOODS}
        soundscapes.append({
            "id": ref.track_id,
            "name": ref.name,
            "category": ref.category,
            "path": str(ref.path.relative_to(ROOT)),
            "metrics": metrics,
            "mood_fit": mood_fit,
        })

    def approved_soundscapes(mood: str) -> list[str]:
        return [
            item["id"] for item in sorted(soundscapes, key=lambda x: -x["mood_fit"][mood]["score"])
            if item["category"] in AUTO_CATEGORIES[mood]
            and item["mood_fit"][mood]["verdict"] in {"ideal", "good"}
        ]

    def rejected_auto_soundscapes(mood: str) -> list[str]:
        return [
            item["id"] for item in sorted(soundscapes, key=lambda x: -x["mood_fit"][mood]["score"])
            if item["category"] in AUTO_CATEGORIES[mood]
            and item["mood_fit"][mood]["verdict"] == "wrong"
        ]

    summary = {
        "music_count": len(music),
        "soundscape_count": len(soundscapes),
        "sleep_music_wrong_or_usable": [
            item["id"] for item in sorted(music, key=lambda x: x["mood_fit"]["sleep"]["score"])
            if item["mood_fit"]["sleep"]["verdict"] in {"wrong", "usable"}
        ],
        "sleep_soundscape_approved": approved_soundscapes("sleep"),
        "sleep_soundscape_auto_rejected": rejected_auto_soundscapes("sleep"),
        "sleep_stream_rejected": [
            item["id"] for item in sorted(soundscapes, key=lambda x: x["id"])
            if item["category"] == "stream" and item["mood_fit"]["sleep"]["verdict"] == "wrong"
        ],
        "meditate_soundscape_approved": approved_soundscapes("meditate"),
        "meditate_soundscape_auto_rejected": rejected_auto_soundscapes("meditate"),
        "meditate_stream_rejected": [
            item["id"] for item in sorted(soundscapes, key=lambda x: x["id"])
            if item["category"] == "stream" and item["mood_fit"]["meditate"]["verdict"] == "wrong"
        ],
        "sleep_rms_target_db": MOOD_RULES["sleep"]["rms"],
        "stream_sleep_or_meditate_rejected": [
            item["id"] for item in sorted(soundscapes, key=lambda x: x["id"])
            if item["category"] == "stream"
            and (
                item["mood_fit"]["sleep"]["verdict"] == "wrong"
                or item["mood_fit"]["meditate"]["verdict"] == "wrong"
            )
        ],
        "known_catalog_gaps": [
            "No file-backed singing bowl, gong, or chime catalog assets are deployed.",
            "Current shared music is rejected for Sleep; Sleep is soundscape-only until true sleep music is added.",
            "Sleep auto soundscapes still need lower-transient, longer, professionally looped source files.",
            "This report is objective audio-feature QA, not proof of listener outcomes.",
        ],
    }

    return {
        "schema": "argobeat.audioCatalogAnalysis.v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_manifest": str(MANIFEST.relative_to(ROOT)),
        "analysis_method": "local ffmpeg decode plus numpy feature extraction and transparent mood-fit heuristics",
        "summary": summary,
        "mood_rules": MOOD_RULES,
        "auto_categories": {key: sorted(value) for key, value in AUTO_CATEGORIES.items()},
        "music": music,
        "soundscapes": soundscapes,
    }


def write_json(report: dict[str, Any]) -> None:
    PUBLIC_REPORT.write_text(json.dumps(report, indent=2) + "\n")


def write_markdown(report: dict[str, Any]) -> None:
    lines = [
        "# ArgoBeat Audio Catalog Analysis",
        "",
        f"Generated: `{report['generated_at']}`",
        "",
        "This is local objective feature analysis, not medical or cognitive proof.",
        "",
        "## Summary",
        "",
        f"- Music tracks analyzed: {report['summary']['music_count']}",
        f"- Soundscapes analyzed: {report['summary']['soundscape_count']}",
        f"- Sleep music wrong/usable: {len(report['summary']['sleep_music_wrong_or_usable'])}",
        f"- Sleep soundscapes approved for automatic use: {len(report['summary']['sleep_soundscape_approved'])}",
        f"- Sleep automatic soundscapes rejected: {len(report['summary']['sleep_soundscape_auto_rejected'])}",
        f"- Rejected sleep stream/running-water files: {len(report['summary']['sleep_stream_rejected'])}",
        f"- Meditation soundscapes approved for automatic use: {len(report['summary']['meditate_soundscape_approved'])}",
        f"- Rejected meditation stream/running-water files: {len(report['summary']['meditate_stream_rejected'])}",
        f"- Running-water/stream sleep or meditation rejections: {len(report['summary']['stream_sleep_or_meditate_rejected'])}",
        "",
        "Sleep music is currently disabled in the UI because all deployed shared music fails the Sleep fit rules.",
        "Stream/running-water files are not eligible for automatic Sleep or Meditation use.",
        "",
        "## Sleep Music Ranking",
        "",
        "| Track | Score | Verdict | Reasons |",
        "|---|---:|---|---|",
    ]
    for item in sorted(report["music"], key=lambda x: -x["mood_fit"]["sleep"]["score"]):
        fit = item["mood_fit"]["sleep"]
        reasons = "; ".join(fit["reasons"]) or "fits objective thresholds"
        lines.append(f"| `{item['id']}` | {fit['score']} | {fit['verdict']} | {reasons} |")

    lines.extend([
        "",
        "## Sleep Soundscape Ranking",
        "",
        "| Soundscape | Category | Score | Verdict | Reasons |",
        "|---|---|---:|---|---|",
    ])
    for item in sorted(report["soundscapes"], key=lambda x: -x["mood_fit"]["sleep"]["score"]):
        fit = item["mood_fit"]["sleep"]
        reasons = "; ".join(fit["reasons"]) or "fits objective thresholds"
        lines.append(f"| `{item['id']}` | {item['category']} | {fit['score']} | {fit['verdict']} | {reasons} |")

    lines.extend([
        "",
        "## Meditation Soundscape Ranking",
        "",
        "| Soundscape | Category | Score | Verdict | Reasons |",
        "|---|---|---:|---|---|",
    ])
    for item in sorted(report["soundscapes"], key=lambda x: -x["mood_fit"]["meditate"]["score"]):
        fit = item["mood_fit"]["meditate"]
        reasons = "; ".join(fit["reasons"]) or "fits objective thresholds"
        lines.append(f"| `{item['id']}` | {item['category']} | {fit['score']} | {fit['verdict']} | {reasons} |")

    MD_REPORT.write_text("\n".join(lines) + "\n")


def main() -> int:
    try:
        report = build_report()
        write_json(report)
        write_markdown(report)
    except Exception as exc:
        print(f"catalog analysis failed: {exc}", file=sys.stderr)
        return 2

    print(f"Wrote {PUBLIC_REPORT.relative_to(ROOT)}")
    print(f"Wrote {MD_REPORT.relative_to(ROOT)}")
    print(f"Music tracks analyzed: {report['summary']['music_count']}")
    print(f"Soundscapes analyzed: {report['summary']['soundscape_count']}")
    print("Sleep music wrong/usable:", ", ".join(report["summary"]["sleep_music_wrong_or_usable"]) or "none")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
