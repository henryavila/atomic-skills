#!/usr/bin/env bash
# --automate pen. No lock → allow (exit 0). Lock held → node decides;
# missing node, missing script, or a deny exits 2. SKIP does not bypass this.
# A missing AUTOMATE_PEN_LOCK override falls through to on-disk pen.lock /
# probe.lock instead of allowing the write.
set -euo pipefail

PROJ_DIR="${GROK_WORKSPACE_ROOT:-${CLAUDE_PROJECT_DIR:-$PWD}}"
PEN_LOCK="$PROJ_DIR/.atomic-skills/status/automate/pen.lock"
ON_DISK_PROBE="$PROJ_DIR/.atomic-skills/status/automate/probe.lock"

LOCK=""
if [[ -n "${AUTOMATE_PEN_LOCK:-}" && -f "$AUTOMATE_PEN_LOCK" ]]; then
  LOCK="$AUTOMATE_PEN_LOCK"
elif [[ -f "$PEN_LOCK" ]]; then
  LOCK="$PEN_LOCK"
elif [[ -n "${AUTOMATE_PROBE_LOCK:-}" && -f "$AUTOMATE_PROBE_LOCK" ]]; then
  LOCK="$AUTOMATE_PROBE_LOCK"
elif [[ -f "$ON_DISK_PROBE" ]]; then
  LOCK="$ON_DISK_PROBE"
else
  exit 0
fi

ROOT=""
if [[ -f "$HOME/.atomic-skills/package-root" ]]; then
  ROOT=$(cat "$HOME/.atomic-skills/package-root")
fi

SCRIPT=""
if [[ -n "$ROOT" && -f "$ROOT/scripts/automate-pen-hook.js" ]]; then
  SCRIPT="$ROOT/scripts/automate-pen-hook.js"
elif [[ -f "$PROJ_DIR/scripts/automate-pen-hook.js" ]]; then
  SCRIPT="$PROJ_DIR/scripts/automate-pen-hook.js"
fi

if [[ -z "$SCRIPT" ]]; then
  echo "automate pen: hook script missing while a lock is set" >&2
  exit 2
fi

export AUTOMATE_PEN_LOCK="$LOCK"
if ! node "$SCRIPT"; then
  exit 2
fi
exit 0
