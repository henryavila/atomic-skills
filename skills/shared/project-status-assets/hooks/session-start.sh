#!/usr/bin/env bash
# atomic-skills:project-status — SessionStart hook
# Injects PROJECT-STATUS.md index + matching initiative detail via additionalContext.
set -euo pipefail

PROJ_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
STATUS_FILE="$PROJ_DIR/.atomic-skills/PROJECT-STATUS.md"
INITIATIVES_DIR="$PROJ_DIR/.atomic-skills/initiatives"

context=""

# 1. Inject project-level index (top 20 lines of PROJECT-STATUS.md)
if [[ -f "$STATUS_FILE" ]]; then
  context+="## Active Project Status"$'\n'
  context+="$(head -20 "$STATUS_FILE")"$'\n\n'
fi

# 2. Detect active initiative by branch match
branch=$(git -C "$PROJ_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
match=""
if [[ -n "$branch" && -d "$INITIATIVES_DIR" ]]; then
  match=$(grep -l "^branch: $branch$" "$INITIATIVES_DIR"/*.md 2>/dev/null | head -1)
  if [[ -z "$match" ]]; then
    match=$(grep -l "^branch: ${branch%%/*}" "$INITIATIVES_DIR"/*.md 2>/dev/null | head -1)
  fi
fi

# 3. Inject initiative detail (top 40 lines) if matched
if [[ -n "$match" ]]; then
  slug=$(basename "$match" .md)
  context+="## Current Initiative: $slug"$'\n'
  context+="$(head -40 "$match")"$'\n'
fi

# 4. Emit as JSON with additionalContext
if command -v jq >/dev/null 2>&1; then
  jq -n --arg ctx "$context" \
    '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $ctx}}'
else
  # Fallback: manual JSON escape via python3 if available, else basic sed escape
  if command -v python3 >/dev/null 2>&1; then
    escaped=$(printf '%s' "$context" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
  else
    escaped='"'$(printf '%s' "$context" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n' ' ')'"'
  fi
  printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":%s}}\n' "$escaped"
fi

exit 0
