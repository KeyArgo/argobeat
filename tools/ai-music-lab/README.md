# Argobeat AI Music Lab

Standalone AudioCraft test harness for `argobeat`.

This module is intentionally separate from the core engine so it remains:

- modular
- forkable
- easier to publish
- optional for local AI-music experiments

## Commercial Status

Pretrained Meta AudioCraft and JASCO weights are:

- `NOT SAFE FOR COMMERCIAL USE` by default
- suitable for research and evaluation
- not suitable as a shipping paid-product backend unless replaced with commercially cleared weights

## What Is Here

- `setup_audiocraft.sh`
  - creates a local Python 3.10 venv
  - clones AudioCraft
  - patches around the `PyAV` blocker for this inference workflow
  - installs a generation-focused dependency set
- `local_audiocraft.py`
  - reusable local wrappers for MusicGen and JASCO
- `audiocraft_service.py`
  - standalone FastAPI service exposing `/health` and `/api/generate`
- `make_comparison_samples.py`
  - generates:
    - `argobeat` procedural sample
    - MusicGen sample
    - JASCO sample if gated model access is present

## Setup

```bash
cd /mnt/homes/galileo/argo/Development/argobeat/tools/ai-music-lab
./setup_audiocraft.sh
```

## MusicGen Test

```bash
source /mnt/homes/galileo/argo/Development/argobeat/tools/ai-music-lab/.venv/bin/activate
python /mnt/homes/galileo/argo/Development/argobeat/tools/ai-music-lab/make_comparison_samples.py \
  --out-dir /home/argo/tmp/argobeat-ai-compare \
  --duration 10 \
  --seed 424242
```

## JASCO Requirement

JASCO will not work until you:

1. get access to `facebook/jasco-chords-drums-400M`
2. accept the model terms on Hugging Face
3. export a token:

```bash
export HF_TOKEN=hf_your_token_here
```

## Standalone Service

```bash
source /mnt/homes/galileo/argo/Development/argobeat/tools/ai-music-lab/.venv/bin/activate
python -m uvicorn audiocraft_service:app --host 127.0.0.1 --port 8010
```

Health check:

```bash
curl -sS http://127.0.0.1:8010/health
```

## Current Findings

- `argobeat` currently sounds more synthetic than the model-generated baseline
- local MusicGen works
- local JASCO runner works up to the gated model download step
- GPU inference is valid on a 4070 Ti, but other active GPU workloads can force OOM
