import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from faster_whisper import WhisperModel

app = FastAPI(title="FitnessMacro local speech-to-text")
_model = None


def get_model() -> WhisperModel:
    global _model
    if _model is None:
        model_name = os.getenv("WHISPER_MODEL", "base")
        model_dir = os.getenv("WHISPER_MODEL_DIR")
        _model = WhisperModel(
            model_name,
            device=os.getenv("WHISPER_DEVICE", "cpu"),
            compute_type=os.getenv("WHISPER_COMPUTE_TYPE", "int8"),
            download_root=model_dir,
            cpu_threads=max(1, int(os.getenv("WHISPER_CPU_THREADS", "4"))),
        )
    return _model


@app.get("/health")
def health():
    return {
        "ready": True,
        "engine": "faster-whisper",
        "model": os.getenv("WHISPER_MODEL", "base"),
        "device": os.getenv("WHISPER_DEVICE", "cpu"),
    }


@app.post("/inference")
async def inference(
    file: UploadFile = File(...),
    response_format: str = Form("json"),
    language: str | None = Form(None),
):
    del response_format
    audio = await file.read()
    if not audio:
        raise HTTPException(status_code=400, detail="empty_audio")
    if len(audio) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="audio_too_large")

    suffix = Path(file.filename or "recording.m4a").suffix or ".m4a"
    temporary_path = ""
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temporary:
            temporary.write(audio)
            temporary_path = temporary.name
        segments, info = get_model().transcribe(
            temporary_path,
            language=language or None,
            beam_size=3,
            vad_filter=True,
            condition_on_previous_text=False,
            initial_prompt="Food diary: quantities, Pakistani and South Asian dishes, ingredients, meals and drinks.",
        )
        text = " ".join(segment.text.strip() for segment in segments if segment.text.strip()).strip()
        if not text:
            raise HTTPException(status_code=422, detail="empty_transcription")
        return {
            "text": text,
            "language": info.language,
            "languageProbability": round(float(info.language_probability), 4),
        }
    finally:
        if temporary_path:
            Path(temporary_path).unlink(missing_ok=True)

