#!/usr/bin/env bash
# Tests for session-start.sh
set -euo pipefail

HOOK="$(pwd)/skills/shared/project-status-assets/hooks/session-start.sh"
PASS=0; FAIL=0

run() { echo "TEST: $1"; }
ok()  { PASS=$((PASS+1)); echo "  PASS"; }
no()  { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }

# Test 1: no .atomic-skills/ → empty context, exit 0
TMP=$(mktemp -d); cd "$TMP"
run "no .atomic-skills/ → empty context, exit 0"
out=$(bash "$HOOK")
[[ "$?" == "0" ]] && ok || no "nonzero exit"
echo "$out" | grep -q '"additionalContext": ""' && ok || no "expected empty additionalContext, got: $out"
cd - >/dev/null; rm -rf "$TMP"

# Test 2: with PROJECT-STATUS.md → injects head
TMP=$(mktemp -d); cd "$TMP"
mkdir -p .atomic-skills/initiatives
printf "# Project Status Index\n\nline2\nline3\n" > .atomic-skills/PROJECT-STATUS.md
run "PROJECT-STATUS.md exists → injects head"
out=$(bash "$HOOK")
echo "$out" | grep -q "Project Status Index" && ok || no "expected 'Project Status Index' in output"
cd - >/dev/null; rm -rf "$TMP"

echo ""
echo "RESULT: $PASS passed, $FAIL failed"
[[ "$FAIL" == "0" ]]
