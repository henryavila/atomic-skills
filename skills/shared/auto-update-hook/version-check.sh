#!/usr/bin/env bash
# atomic-skills auto-update — SessionStart hook
# Checks npm registry asynchronously, notifies via additionalContext if a newer version exists.
# Designed to never break Claude Code startup: any error → exit 0 silently.
#
# The cache and the manifest can come from a cloned repository, so everything
# read from them is untrusted: only digits reach bash arithmetic, and only
# strict versions reach the message the agent reads.
set -uo pipefail

DIGITS_PATTERN='^[0-9]{1,12}$'
VERSION_PATTERN='^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$'
DEFAULT_TTL=86400

is_digits() {
  [[ $1 =~ $DIGITS_PATTERN ]]
}

is_version() {
  [[ ${#1} -le 40 && $1 =~ $VERSION_PATTERN ]]
}

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
TTL_SECONDS="${ATOMIC_SKILLS_UPDATE_CHECK_TTL:-$DEFAULT_TTL}"  # default 24h
is_digits "$TTL_SECONDS" || TTL_SECONDS=$DEFAULT_TTL
TTL_SECONDS=$((10#$TTL_SECONDS))
NOW=$(date +%s 2>/dev/null || true)
is_digits "$NOW" || NOW=0
NOW=$((10#$NOW))

# Installed version (from manifest); anything but a strict version is absent.
installed=""
if command -v jq >/dev/null 2>&1; then
  installed=$(jq -r '.version // empty' "$MANIFEST" 2>/dev/null || true)
fi
is_version "$installed" || exit 0

# Cached latest from previous async fetch; invalid fields are ignored.
latest=""
last_check=0
if [[ -f "$CACHE_FILE" ]] && command -v jq >/dev/null 2>&1; then
  cached_latest=$(jq -r '.latest_version // empty' "$CACHE_FILE" 2>/dev/null || true)
  cached_last_check=$(jq -r '.last_check // 0' "$CACHE_FILE" 2>/dev/null || true)
  if is_version "$cached_latest"; then
    latest=$cached_latest
  fi
  if is_digits "$cached_last_check"; then
    last_check=$((10#$cached_last_check))
  fi
fi

age=$(( NOW - last_check ))

# If cache stale (or missing), dispatch background fetch
if [[ $age -ge $TTL_SECONDS ]]; then
  (
    if command -v npm >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then
      new_latest=$(npm view @henryavila/atomic-skills version 2>/dev/null || true)
      if is_version "$new_latest"; then
        jq -n --arg latest "$new_latest" --argjson now "$NOW" \
          '{latest_version: $latest, last_check: $now}' > "$CACHE_FILE" 2>/dev/null || true
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

# Scope-aware update command (project installs need --project)
if [[ "$SCOPE" == "project" ]]; then
  UPDATE_CMD="npx -y @henryavila/atomic-skills@latest install --yes --project"
else
  UPDATE_CMD="npx -y @henryavila/atomic-skills@latest install --yes"
fi

# Build notification message
msg="## Atomic Skills Update Available
atomic-skills **v${latest}** disponível (instalado: v${installed}, scope: ${SCOPE}).
Atualizar:
\`\`\`bash
${UPDATE_CMD}
\`\`\`
(Para silenciar: \`export ATOMIC_SKILLS_NO_UPDATE_CHECK=1\`)"

# Emit additionalContext
if command -v jq >/dev/null 2>&1; then
  jq -n --arg ctx "$msg" \
    '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $ctx}}' 2>/dev/null || true
fi

exit 0
