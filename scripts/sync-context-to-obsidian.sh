#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTEXT_FILE="$ROOT_DIR/context.md"
OBSIDIAN_FILE="$ROOT_DIR/obsidian/Fitness App Project Context.md"
TEMP_FILE="$OBSIDIAN_FILE.tmp"

if [[ ! -f "$CONTEXT_FILE" ]]; then
  echo "context.md not found: $CONTEXT_FILE" >&2
  exit 1
fi

{
  printf '%s\n' '---'
  printf '%s\n' 'tags: [fitness-app, macronutrients, local-first, roadmap]'
  printf '%s\n' 'project: fitness-macro'
  printf 'updated: %s\n' "$(date +%F)"
  printf '%s\n\n' '---'
  sed '1{/^# context\.md$/d;}' "$CONTEXT_FILE"
} > "$TEMP_FILE"

mv "$TEMP_FILE" "$OBSIDIAN_FILE"
echo "Context synced to Obsidian note: $OBSIDIAN_FILE"
