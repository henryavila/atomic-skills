#!/usr/bin/env bash
# atomic-skills:project-status — Stop hook
# Validates that code edits triggered a status file update. Dry-run logs; strict blocks via exit 2.
set -euo pipefail

PROJ_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
CONFIG="$PROJ_DIR/.atomic-skills/status/config.json"
LOG="$PROJ_DIR/.atomic-skills/status/stop.log"
SKIP_FLAG="$PROJ_DIR/.atomic-skills/status/SKIP"

# Emergency bypass (24h grace)
if [[ -f "$SKIP_FLAG" ]]; then
  skip_mtime=$(stat -c %Y "$SKIP_FLAG" 2>/dev/null || stat -f %m "$SKIP_FLAG" 2>/dev/null || echo 0)
  now=$(date +%s)
  [[ $((now - skip_mtime)) -lt 86400 ]] && exit 0
fi

# Parse stdin payload
payload=$(cat)
transcript_path=$(printf '%s' "$payload" | jq -r '.transcript_path // empty' 2>/dev/null || echo "")
stop_hook_active=$(printf '%s' "$payload" | jq -r '.stop_hook_active // false' 2>/dev/null || echo "false")

# Loop prevention (Anthropic-recommended)
[[ "$stop_hook_active" == "true" ]] && exit 0

# Config must exist
[[ ! -f "$CONFIG" ]] && exit 0

strict_mode=$(jq -r '.strict_mode // false' "$CONFIG")
mapfile -t source_globs < <(jq -r '.source_globs[]' "$CONFIG")

# Determine active initiative by branch
branch=$(git -C "$PROJ_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
[[ -z "$branch" ]] && exit 0

active=""
if [[ -d "$PROJ_DIR/.atomic-skills/initiatives" ]]; then
  while IFS= read -r f; do
    grep -q "^status: active$" "$f" && grep -q "^branch: $branch$" "$f" && { active="$f"; break; }
  done < <(find "$PROJ_DIR/.atomic-skills/initiatives" -maxdepth 1 -name '*.md')
fi
[[ -z "$active" ]] && exit 0

# Check code edits since last user turn
[[ -z "$transcript_path" || ! -f "$transcript_path" ]] && exit 0

last_user_ts=$(tac "$transcript_path" 2>/dev/null | grep -m1 '"role":"user"' | jq -r '.timestamp // empty' 2>/dev/null || echo "")
[[ -z "$last_user_ts" ]] && exit 0

# Build regex from source_globs
glob_pattern=$(IFS='|'; echo "${source_globs[*]}")
code_edits=$(jq -r --arg ts "$last_user_ts" \
  'select(.timestamp > $ts and (.tool_use.name == "Write" or .tool_use.name == "Edit")) | .tool_use.input.file_path // empty' \
  "$transcript_path" 2>/dev/null | grep -E "$glob_pattern" || true)
[[ -z "$code_edits" ]] && exit 0

# Check initiative mtime vs turn start
initiative_mtime=$(stat -c %Y "$active" 2>/dev/null || stat -f %m "$active" 2>/dev/null || echo 0)
turn_start_ts=$(date -d "$last_user_ts" +%s 2>/dev/null || echo 0)

if [[ "$initiative_mtime" -lt "$turn_start_ts" ]]; then
  msg="Code edited without updating $(basename "$active"). Update stack/parking lot/tasks before ending turn."
  if [[ "$strict_mode" == "true" ]]; then
    echo "$msg" >&2
    exit 2
  else
    mkdir -p "$(dirname "$LOG")"
    echo "[$(date -Iseconds)] DRY-RUN would-block: $msg" >> "$LOG"
    exit 0
  fi
fi

exit 0
