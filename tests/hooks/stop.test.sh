#!/usr/bin/env bash
# Tests for stop.sh
set -euo pipefail

HOOK="$(pwd)/skills/shared/project-status-assets/hooks/stop.sh"
PASS=0; FAIL=0

run() { echo "TEST: $1"; }
ok()  { PASS=$((PASS+1)); echo "  PASS"; }
no()  { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }

# Test 1: no initiative → exit 0
TMP=$(mktemp -d); cd "$TMP"
run "no active initiative → exit 0"
echo '{"stop_hook_active":false,"transcript_path":"/nonexistent"}' | bash "$HOOK"
[[ "$?" == "0" ]] && ok || no "nonzero"
cd - >/dev/null; rm -rf "$TMP"

# Test 2: stop_hook_active=true → exit 0 immediately
TMP=$(mktemp -d); cd "$TMP"
run "stop_hook_active=true → exit 0 (loop prevention)"
echo '{"stop_hook_active":true,"transcript_path":"/any"}' | bash "$HOOK"
[[ "$?" == "0" ]] && ok || no "nonzero"
cd - >/dev/null; rm -rf "$TMP"

# Test 3: SKIP file present → exit 0 silently
TMP=$(mktemp -d); cd "$TMP"
mkdir -p .atomic-skills/status
touch .atomic-skills/status/SKIP
run "SKIP sentinel → exit 0 within 24h"
echo '{"stop_hook_active":false,"transcript_path":"/any"}' | bash "$HOOK"
[[ "$?" == "0" ]] && ok || no "nonzero with SKIP present"
cd - >/dev/null; rm -rf "$TMP"

echo ""
echo "RESULT: $PASS passed, $FAIL failed"
[[ "$FAIL" == "0" ]]
