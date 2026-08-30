#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

export LOCAL_TRANSCRIBE_URL="${LOCAL_TRANSCRIBE_URL:-http://127.0.0.1:8080}"
export LOCAL_TRANSCRIBE_MODE="${LOCAL_TRANSCRIBE_MODE:-whisper_cpp}"

if curl -fsS --max-time 2 http://127.0.0.1:8787/health >/dev/null 2>&1; then
  if curl -fsS --max-time 2 "$LOCAL_TRANSCRIBE_URL/health" >/dev/null 2>&1; then
    printf '%s\n' 'Fitness agent and local speech service are already running.'
    exit 0
  fi
  printf '%s\n' 'Port 8787 has an existing agent without a healthy speech service. Stop that terminal with Ctrl+C, then rerun this command.' >&2
  exit 1
fi

bash "$ROOT/scripts/run-voice.sh" &
VOICE_PID=$!
cleanup() { kill "$VOICE_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

for _ in $(seq 1 60); do
  if curl -fsS "$LOCAL_TRANSCRIBE_URL/health" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$VOICE_PID" 2>/dev/null; then
    wait "$VOICE_PID"
  fi
  sleep 1
done

cd "$ROOT"
npm run dev
