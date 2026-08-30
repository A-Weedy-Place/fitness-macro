#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVE="$ROOT/data/usda-source/sr-legacy.zip"
mkdir -p "$(dirname "$ARCHIVE")"
if [[ ! -f "$ARCHIVE" ]]; then
  curl -L --fail 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip' -o "$ARCHIVE"
fi
export UV_PROJECT_ENVIRONMENT="${UV_PROJECT_ENVIRONMENT:-$ROOT/data/voice-venv}"
export USDA_SR_ARCHIVE="$ARCHIVE"
export USDA_LOCAL_INDEX="${USDA_LOCAL_INDEX:-$ROOT/data/usda-sr-index.json}"
uv sync --project "$ROOT/voice"
uv run --project "$ROOT/voice" python "$ROOT/scripts/import_usda_sr.py"

