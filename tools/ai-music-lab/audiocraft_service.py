#!/usr/bin/env python3.10
from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from starlette.background import BackgroundTask

from local_audiocraft import (
    COMMERCIAL_WARNING,
    DEFAULT_JASCO_MODEL,
    DEFAULT_MUSICGEN_MODEL,
    generate_jasco,
    generate_musicgen,
)


app = FastAPI(title="ArgoBeat AudioCraft Service", version="0.1.0")


class GenerateRequest(BaseModel):
    backend: str = Field(default="musicgen", pattern="^(musicgen|jasco)$")
    prompt: str
    duration: float = 10.0
    chords: str | None = None
    model: str | None = None


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "commercial_status": "not_safe_for_commercial_use_by_default",
    }


@app.post("/api/generate")
def generate(req: GenerateRequest):
    temp_dir = TemporaryDirectory(prefix="argobeat-audiocraft-")
    stem = Path(temp_dir.name) / "generated"
    try:
        if req.backend == "musicgen":
            result = generate_musicgen(
                req.prompt,
                stem,
                model_name=req.model or DEFAULT_MUSICGEN_MODEL,
                duration_s=req.duration,
            )
        else:
            if not req.chords:
                raise HTTPException(status_code=400, detail="JASCO requests require `chords`.")
            result = generate_jasco(
                req.prompt,
                req.chords,
                stem,
                model_name=req.model or DEFAULT_JASCO_MODEL,
            )
    except HTTPException:
        temp_dir.cleanup()
        raise
    except Exception as exc:
        temp_dir.cleanup()
        raise HTTPException(status_code=500, detail=str(exc))

    headers = {
        "X-Argo-Backend": result.backend,
        "X-Argo-Model": result.model,
        "X-Argo-Commercial-Status": COMMERCIAL_WARNING,
    }
    return FileResponse(
        result.output_path,
        media_type="audio/wav",
        filename=result.output_path.name,
        headers=headers,
        background=BackgroundTask(temp_dir.cleanup),
    )
