import os

from faster_whisper import WhisperModel

model = os.getenv("WHISPER_MODEL", "base")
directory = os.getenv("WHISPER_MODEL_DIR")
print(f"Downloading/checking multilingual Whisper model: {model}")
WhisperModel(model, device="cpu", compute_type="int8", download_root=directory)
print("Local speech model is ready.")

