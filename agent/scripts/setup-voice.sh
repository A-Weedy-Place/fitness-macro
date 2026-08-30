#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if ! command -v uv >/dev/null 2>&1; then
  printf '%s\n' 'uv is required. Install it from https://docs.astral.sh/uv/ and rerun.' >&2
  exit 1
fi

export UV_PROJECT_ENVIRONMENT="${UV_PROJECT_ENVIRONMENT:-$ROOT/data/voice-venv}"
export WHISPER_MODEL="${WHISPER_MODEL:-base}"
export WHISPER_MODEL_DIR="${WHISPER_MODEL_DIR:-$ROOT/data/whisper-models}"
mkdir -p "$ROOT/data"
uv sync --project "$ROOT/voice"
uv run --project "$ROOT/voice" python "$ROOT/voice/prefetch.py"
printf '%s\n' "Voice is installed locally with multilingual model '$WHISPER_MODEL'."

