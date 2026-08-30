#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export UV_PROJECT_ENVIRONMENT="${UV_PROJECT_ENVIRONMENT:-$ROOT/data/voice-venv}"
export WHISPER_MODEL="${WHISPER_MODEL:-base}"
export WHISPER_MODEL_DIR="${WHISPER_MODEL_DIR:-$ROOT/data/whisper-models}"
export WHISPER_DEVICE="${WHISPER_DEVICE:-cpu}"
export WHISPER_COMPUTE_TYPE="${WHISPER_COMPUTE_TYPE:-int8}"
PORT="${WHISPER_PORT:-8080}"

if [[ ! -x "$UV_PROJECT_ENVIRONMENT/bin/uvicorn" ]]; then
  printf '%s\n' 'Voice is not installed. Run npm run voice:setup first.' >&2
  exit 1
fi

exec uv run --project "$ROOT/voice" uvicorn voice_server:app --app-dir "$ROOT/voice" --host 127.0.0.1 --port "$PORT"

