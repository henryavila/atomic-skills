#!/usr/bin/env bash
# atomic-skills auto-update — SessionStart hook
# Checks npm registry asynchronously, notifies via additionalContext if a newer version exists.
# Designed to never break Claude Code startup: any error → exit 0 silently.
set -uo pipefail

# Opt-out via env var
if [[ -n "${ATOMIC_SKILLS_NO_UPDATE_CHECK:-}" ]]; then
  exit 0
fi

# Locate manifest: prefer project-scope, fall back to user-scope
PROJ_DIR="${GROK_WORKSPACE_ROOT:-${CLAUDE_PROJECT_DIR:-$PWD}}"
MANIFEST=""
SCOPE=""
if [[ -f "$PROJ_DIR/.atomic-skills/manifest.json" ]]; then
  MANIFEST="$PROJ_DIR/.atomic-skills/manifest.json"
  SCOPE="project"
  STATE_DIR="$PROJ_DIR/.atomic-skills"
elif [[ -f "$HOME/.atomic-skills/manifest.json" ]]; then
  MANIFEST="$HOME/.atomic-skills/manifest.json"
  SCOPE="user"
  STATE_DIR="$HOME/.atomic-skills"
else
  exit 0
fi

mkdir -p "$STATE_DIR" 2>/dev/null || exit 0

CACHE_FILE="$STATE_DIR/version-cache.json"
TTL_SECONDS="${ATOMIC_SKILLS_UPDATE_CHECK_TTL:-86400}"  # default 24h
NOW=$(date +%s 2>/dev/null || echo 0)

# Installed version (from manifest)
installed=""
if command -v jq >/dev/null 2>&1; then
  installed=$(jq -r '.version // empty' "$MANIFEST" 2>/dev/null || true)
fi
[[ -z "$installed" ]] && exit 0

# Cached latest from previous async fetch
latest=""
last_check=0
if [[ -f "$CACHE_FILE" ]] && command -v jq >/dev/null 2>&1; then
  latest=$(jq -r '.latest_version // empty' "$CACHE_FILE" 2>/dev/null || true)
  last_check=$(jq -r '.last_check // 0' "$CACHE_FILE" 2>/dev/null || echo 0)
fi

age=$(( NOW - last_check ))

# If cache stale (or missing), dispatch background fetch
if [[ $age -ge $TTL_SECONDS ]]; then
  (
    if command -v npm >/dev/null 2>&1; then
      new_latest=$(npm view @henryavila/atomic-skills version 2>/dev/null || echo "")
      if [[ -n "$new_latest" ]] && command -v jq >/dev/null 2>&1; then
        printf '{"latest_version":"%s","last_check":%s}\n' "$new_latest" "$NOW" > "$CACHE_FILE" 2>/dev/null || true
      fi
    fi
  ) >/dev/null 2>&1 &
  disown 2>/dev/null || true
fi

# If no cached value yet, nothing to compare — exit
[[ -z "$latest" ]] && exit 0

# Same version: nothing to notify
[[ "$installed" == "$latest" ]] && exit 0

# Determine if latest > installed via sort -V (semver-aware)
greater=$(printf '%s\n%s\n' "$installed" "$latest" | sort -V 2>/dev/null | tail -1)
[[ "$greater" != "$latest" ]] && exit 0

# Build notification message
msg="## Atomic Skills Update Available
atomic-skills **v${latest}** disponível (instalado: v${installed}, scope: ${SCOPE}).
Atualizar:
\`\`\`bash
npx -y @henryavila/atomic-skills@latest install --yes
\`\`\`
(Para silenciar: \`export ATOMIC_SKILLS_NO_UPDATE_CHECK=1\`)"

# Emit additionalContext
if command -v jq >/dev/null 2>&1; then
  jq -n --arg ctx "$msg" \
    '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $ctx}}' 2>/dev/null || true
fi

exit 0
