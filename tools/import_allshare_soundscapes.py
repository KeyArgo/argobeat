#!/usr/bin/env python3
"""Import the AllShare ambience library into a web-ready staging tree.

Preserves the source directory structure under a new project-local library root,
transcodes non-MP3 inputs to MP3, and writes a manifest of source-to-output
paths so the runtime manifest can be rebuilt against the new structure later.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = Path(os.environ.get("ARGOBEAT_SOUNDSCAPE_SOURCE", "/path/to/your/soundscape/library"))
DEST_ROOT = ROOT / "apps/web/public/audio/soundscapes-library"
MANIFEST_PATH = DEST_ROOT / "import-manifest.json"
ALLOWED_EXTENSIONS = {".wav", ".mp3", ".m4a", ".aiff", ".flac"}


def slugify(stem: str) -> str:
    stem = stem.lower().strip()
    stem = re.sub(r"[^a-z0-9]+", "-", stem)
    stem = re.sub(r"-+", "-", stem).strip("-")
    return stem or "track"


def iter_audio_files() -> list[Path]:
    files: list[Path] = []
    for path in SOURCE_ROOT.rglob("*"):
      if path.is_file() and path.suffix.lower() in ALLOWED_EXTENSIONS:
        files.append(path)
    return sorted(files)


def build_output_path(source: Path) -> Path:
    rel_parent = source.relative_to(SOURCE_ROOT).parent
    return DEST_ROOT / rel_parent / f"{slugify(source.stem)}.mp3"


def transcode(source: Path, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(source),
        "-vn",
        "-acodec",
        "libmp3lame",
        "-b:a",
        "192k",
        "-ar",
        "48000",
        str(output),
    ]
    subprocess.run(cmd, check=True)


def main() -> None:
    files = iter_audio_files()
    imported: list[dict[str, str]] = []

    DEST_ROOT.mkdir(parents=True, exist_ok=True)

    for source in files:
        output = build_output_path(source)
        transcode(source, output)
        imported.append(
            {
                "source": str(source),
                "output": str(output.relative_to(ROOT)),
            }
        )

    MANIFEST_PATH.write_text(json.dumps({"count": len(imported), "files": imported}, indent=2) + "\n")
    print(f"Imported {len(imported)} files into {DEST_ROOT}")
    print(f"Wrote manifest {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
