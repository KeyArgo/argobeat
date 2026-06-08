#!/usr/bin/env python3.10
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import torch


LAB_DIR = Path(__file__).resolve().parent
AUDIOCRAFT_SRC = Path(os.environ.get("AUDIOCRAFT_SRC", str(LAB_DIR / "audiocraft-src")))
DEFAULT_CACHE_DIR = Path(os.environ.get("AUDIOCRAFT_CACHE_DIR", str(LAB_DIR / "cache")))
DEFAULT_JASCO_MODEL = "facebook/jasco-chords-drums-400M"
DEFAULT_MUSICGEN_MODEL = "facebook/musicgen-small"
COMMERCIAL_WARNING = (
    "NOT SAFE FOR COMMERCIAL USE: pretrained Meta AudioCraft/JASCO weights are "
    "typically non-commercial unless you replace them with commercially cleared weights."
)


@dataclass
class GenerationResult:
    backend: str
    model: str
    output_path: Path
    device: str
    warning: str | None = None


def ensure_env(cache_dir: str | Path | None = None) -> None:
    os.environ.setdefault("AUDIOCRAFT_CACHE_DIR", str(cache_dir or DEFAULT_CACHE_DIR))


def parse_chords(spec: str | Iterable[str]) -> list[tuple[str, float]]:
    items = spec.split(",") if isinstance(spec, str) else list(spec)
    chords: list[tuple[str, float]] = []
    for raw_item in items:
      item = str(raw_item).strip()
      if not item:
          continue
      if "@" not in item:
          raise ValueError(f"Invalid chord item '{item}'. Expected Am@0 style entries.")
      chord, time_s = item.split("@", 1)
      chords.append((chord.strip(), float(time_s.strip())))
    return chords


def get_device() -> str:
    return "cuda" if torch.cuda.is_available() else "cpu"


def _audio_write(stem: Path, wav: torch.Tensor, sample_rate: int) -> Path:
    from audiocraft.data.audio import audio_write

    stem.parent.mkdir(parents=True, exist_ok=True)
    audio_write(
        str(stem),
        wav.cpu().squeeze(0),
        sample_rate,
        strategy="loudness",
        loudness_compressor=True,
    )
    return stem.with_suffix(".wav")


def generate_musicgen(
    prompt: str,
    output_stem: str | Path,
    *,
    model_name: str = DEFAULT_MUSICGEN_MODEL,
    duration_s: float = 10.0,
    device: str | None = None,
    use_sampling: bool = True,
    top_k: int = 180,
    temperature: float = 1.0,
    cfg_coef: float = 3.5,
) -> GenerationResult:
    ensure_env()
    from audiocraft.models import MusicGen

    if device is None:
        device = get_device()
    model = MusicGen.get_pretrained(model_name, device=device)
    model.set_generation_params(
        use_sampling=use_sampling,
        top_k=top_k,
        temperature=temperature,
        duration=duration_s,
        cfg_coef=cfg_coef,
    )
    with torch.no_grad():
        wav = model.generate([prompt], progress=True)
    output_path = _audio_write(Path(output_stem), wav, model.sample_rate)
    return GenerationResult(
        backend="musicgen",
        model=model_name,
        output_path=output_path,
        device=device,
        warning=COMMERCIAL_WARNING,
    )


def generate_jasco(
    prompt: str,
    chords: str | Iterable[str],
    output_stem: str | Path,
    *,
    model_name: str = DEFAULT_JASCO_MODEL,
    device: str | None = None,
    cfg_coef_all: float = 5.0,
    cfg_coef_txt: float = 0.0,
) -> GenerationResult:
    ensure_env()
    from audiocraft.models import JASCO

    chord_map = AUDIOCRAFT_SRC / "assets" / "chord_to_index_mapping.pkl"
    if not chord_map.exists():
        raise FileNotFoundError(f"Missing chord map at {chord_map}")

    if device is None:
        device = get_device()
    model = JASCO.get_pretrained(
        model_name,
        device=device,
        chords_mapping_path=str(chord_map),
    )
    model.set_generation_params(
        cfg_coef_all=cfg_coef_all,
        cfg_coef_txt=cfg_coef_txt,
    )
    with torch.no_grad():
        wav = model.generate_music(
            descriptions=[prompt],
            chords=parse_chords(chords),
            progress=True,
        )
    output_path = _audio_write(Path(output_stem), wav, model.sample_rate)
    return GenerationResult(
        backend="jasco",
        model=model_name,
        output_path=output_path,
        device=device,
        warning=COMMERCIAL_WARNING,
    )
