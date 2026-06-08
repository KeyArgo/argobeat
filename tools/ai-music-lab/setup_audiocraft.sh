#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  python3.10 -m venv --system-site-packages .venv
fi

source .venv/bin/activate
python -m pip install --upgrade pip setuptools wheel

if [ ! -d audiocraft-src ]; then
  git clone https://github.com/facebookresearch/audiocraft.git audiocraft-src
fi

python - <<'PY'
from pathlib import Path

audio_py = Path("audiocraft-src/audiocraft/data/audio.py")
text = audio_py.read_text()

old = "import av\nimport subprocess as sp\n"
new = "import subprocess as sp\ntry:\n    import av  # type: ignore\nexcept ImportError:\n    av = None\n"
if old in text and new not in text:
    text = text.replace(old, new)

old = "    logger = logging.getLogger('libav.mp3')\n"
new = "    if av is None:\n        raise RuntimeError(\"PyAV is not installed. Use formats supported by soundfile/ffmpeg only.\")\n    logger = logging.getLogger('libav.mp3')\n"
if old in text and new not in text:
    text = text.replace(old, new)

text = text.replace(
    "    if filepath.suffix in ['.flac', '.ogg']:  # TODO: Validate .ogg can be safely read with av_info\n",
    "    if av is None or filepath.suffix in ['.flac', '.ogg', '.wav']:  # TODO: Validate .ogg can be safely read with av_info\n",
)
text = text.replace(
    "    if fp.suffix in ['.flac', '.ogg']:  # TODO: check if we can safely use av_read for .ogg\n",
    "    if av is None or fp.suffix in ['.flac', '.ogg', '.wav']:  # TODO: check if we can safely use av_read for .ogg\n",
)

audio_py.write_text(text)
PY

cd audiocraft-src
python -m pip install --no-cache-dir -e . --no-deps
python -m pip install --no-cache-dir \
  "numpy<2" \
  einops \
  flashy \
  "hydra-core>=1.1" \
  hydra_colorlog \
  julius \
  num2words \
  sentencepiece \
  huggingface_hub \
  tqdm \
  "transformers>=4.31.0" \
  demucs \
  librosa \
  soundfile \
  torchmetrics \
  encodec \
  protobuf \
  "spacy==3.7.6" \
  torchdiffeq

cd ..
python -m pip install --no-cache-dir --no-deps xformers==0.0.29.post2

cat <<'EOF'
Setup complete.

Next:
  source .venv/bin/activate
  python make_comparison_samples.py --out-dir /home/argo/tmp/argobeat-ai-compare --duration 10 --seed 424242

Commercial note:
  pretrained Meta AudioCraft/JASCO weights are NOT SAFE FOR COMMERCIAL USE by default.
EOF
