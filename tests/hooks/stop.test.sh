#!/usr/bin/env bash
# Tests for stop.sh (v2: scope-drift detection)
set -euo pipefail

HOOK="$(pwd)/skills/shared/project-status-assets/hooks/stop.sh"
PASS=0; FAIL=0

run() { echo "TEST: $1"; }
ok()  { PASS=$((PASS+1)); echo "  PASS"; }
no()  { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }

init_git_branch() {
  local branch=$1
  git init -q --initial-branch="$branch" . 2>/dev/null || {
    git init -q .
    git checkout -q -b "$branch" 2>/dev/null || git symbolic-ref HEAD "refs/heads/$branch"
  }
}

# Write a Plan (mirror session-start tests).
write_plan() {
  local file=$1 slug=$2 status=$3 phase=$4
  cat > "$file" <<EOF
---
schemaVersion: '0.1'
slug: ${slug}
title: 'Test Plan ${slug}'
version: '1.0'
status: ${status}
started: 2026-05-20T00:00:00Z
lastUpdated: 2026-05-20T00:00:00Z
currentPhase: ${phase}
parallelismAllowed: false
principles: []
glossary: []
phases:
  - id: ${phase}
    slug: phase-zero
    title: 'Phase 0'
    goal: 'goal'
    dependsOn: []
    subPhaseCount: 0
    status: active
    exitGate:
      summary: 'gate'
      criteria: []
references: []
---

# Body
EOF
}

# Write an Initiative; scope_paths is a CSV of path entries (empty for scope-less).
write_initiative() {
  local file=$1 slug=$2 status=$3 branch=$4 parent=$5 phase=$6 scope_csv=${7:-}
  {
    echo "---"
    echo "schemaVersion: '0.1'"
    echo "slug: ${slug}"
    echo "title: 'Initiative ${slug}'"
    echo "goal: 'goal'"
    echo "status: ${status}"
    if [[ -n "$branch" ]]; then echo "branch: ${branch}"; else echo "branch: null"; fi
    echo "started: 2026-05-20T00:00:00Z"
    echo "lastUpdated: 2026-05-20T00:00:00Z"
    echo "nextAction: 'go'"
    [[ -n "$parent" ]] && echo "parentPlan: ${parent}"
    [[ -n "$phase" ]] && echo "phaseId: ${phase}"
    echo "exitGates: []"
    if [[ -n "$scope_csv" ]]; then
      echo "scope:"
      echo "  paths:"
      IFS=',' read -ra arr <<< "$scope_csv"
      for p in "${arr[@]}"; do
        printf "    - %s\n" "$p"
      done
    fi
    echo "stack:"
    echo "  - { id: 1, title: 'work', type: task, openedAt: 2026-05-20T00:00:00Z }"
    echo "tasks: []"
    echo "parked: []"
    echo "emerged: []"
    echo "---"
    echo ""
    echo "# Body"
  } > "$file"
}

# Synthesize a Claude Code transcript JSONL with a user turn at `user_ts`
# followed by tool_use Edit/Write events at increasing timestamps. file_paths
# is a CSV.
write_transcript() {
  local file=$1 user_ts=$2 paths_csv=$3
  : > "$file"
  printf '{"role":"user","timestamp":"%s","content":"go"}\n' "$user_ts" >> "$file"
  local i=0
  IFS=',' read -ra arr <<< "$paths_csv"
  for p in "${arr[@]}"; do
    i=$((i+1))
    # 2026-05-20T00:00:01Z + i seconds. Keep it simple — strings sort
    # lexicographically because zero-padded.
    local ts
    ts=$(printf '2026-05-20T00:00:%02dZ' "$((i+10))")
    printf '{"role":"assistant","timestamp":"%s","tool_use":{"name":"Edit","input":{"file_path":"%s"}}}\n' "$ts" "$p" >> "$file"
  done
}

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

# Test 4: scope-less initiative → no drift check
TMP=$(mktemp -d); cd "$TMP"
init_git_branch feat
mkdir -p .atomic-skills/initiatives .atomic-skills/status
echo '{"strict_mode":false}' > .atomic-skills/status/config.json
write_initiative .atomic-skills/initiatives/i.md i active feat "" "" ""  # no scope
write_transcript /tmp/t.jsonl 2026-05-20T00:00:00Z "$TMP/src/foo.js,$TMP/lib/bar.js"
run "scope-less initiative → exit 0 (no drift check)"
echo "{\"stop_hook_active\":false,\"transcript_path\":\"/tmp/t.jsonl\"}" | bash "$HOOK"
rc=$?
[[ "$rc" == "0" ]] && ok || no "expected 0, got $rc"
[[ ! -f .atomic-skills/status/drift.log ]] && ok || no "drift.log should not exist for scope-less initiative"
cd - >/dev/null; rm -rf "$TMP" /tmp/t.jsonl

# Test 5: all writes in scope → silent OK (no drift.log)
TMP=$(mktemp -d); cd "$TMP"
init_git_branch feat
mkdir -p .atomic-skills/initiatives .atomic-skills/status
echo '{"strict_mode":false}' > .atomic-skills/status/config.json
write_initiative .atomic-skills/initiatives/i.md i active feat "" "" "src/"
write_transcript /tmp/t.jsonl 2026-05-20T00:00:00Z "$TMP/src/a.js,$TMP/src/b.js"
run "all writes in scope → no drift.log"
echo "{\"stop_hook_active\":false,\"transcript_path\":\"/tmp/t.jsonl\"}" | bash "$HOOK"
rc=$?
[[ "$rc" == "0" ]] && ok || no "expected 0, got $rc"
[[ ! -f .atomic-skills/status/drift.log ]] && ok || no "drift.log should be absent"
cd - >/dev/null; rm -rf "$TMP" /tmp/t.jsonl

# Test 6: >50% out-of-scope (dry-run) → drift.log written, exit 0
TMP=$(mktemp -d); cd "$TMP"
init_git_branch feat
mkdir -p .atomic-skills/initiatives .atomic-skills/status
echo '{"strict_mode":false}' > .atomic-skills/status/config.json
write_initiative .atomic-skills/initiatives/i.md i active feat "" "" "src/"
write_transcript /tmp/t.jsonl 2026-05-20T00:00:00Z "$TMP/src/a.js,$TMP/lib/b.js,$TMP/lib/c.js"
run ">50% out-of-scope (dry-run) → log and exit 0"
echo "{\"stop_hook_active\":false,\"transcript_path\":\"/tmp/t.jsonl\"}" | bash "$HOOK"
rc=$?
[[ "$rc" == "0" ]] && ok || no "expected 0 (dry-run), got $rc"
[[ -f .atomic-skills/status/drift.log ]] && ok || no "drift.log missing"
grep -q '"mode": "dry-run"' .atomic-skills/status/drift.log && ok || no "missing dry-run marker"
grep -q '"out_of_scope": 2' .atomic-skills/status/drift.log && ok || no "wrong out_of_scope count"
cd - >/dev/null; rm -rf "$TMP" /tmp/t.jsonl

# Test 7: >50% out-of-scope + strict_mode → exit 2, no log
TMP=$(mktemp -d); cd "$TMP"
init_git_branch feat
mkdir -p .atomic-skills/initiatives .atomic-skills/status
echo '{"strict_mode":true}' > .atomic-skills/status/config.json
write_initiative .atomic-skills/initiatives/i.md i active feat "" "" "src/"
write_transcript /tmp/t.jsonl 2026-05-20T00:00:00Z "$TMP/lib/a.js,$TMP/lib/b.js,$TMP/lib/c.js"
run ">50% out-of-scope + strict_mode → exit 2"
set +e
out=$(echo "{\"stop_hook_active\":false,\"transcript_path\":\"/tmp/t.jsonl\"}" | bash "$HOOK" 2>&1)
rc=$?
set -e
[[ "$rc" == "2" ]] && ok || no "expected exit 2, got $rc: $out"
echo "$out" | grep -q "outside the scope" && ok || no "expected drift message in stderr"
cd - >/dev/null; rm -rf "$TMP" /tmp/t.jsonl

# Test 8: plan-anchored initiative → drift detected through plan→phase→initiative
TMP=$(mktemp -d); cd "$TMP"
init_git_branch feat
mkdir -p .atomic-skills/plans .atomic-skills/initiatives .atomic-skills/status
echo '{"strict_mode":false}' > .atomic-skills/status/config.json
write_plan .atomic-skills/plans/p.md p active F0
write_initiative .atomic-skills/initiatives/i.md i active "" p F0 "src/"
write_transcript /tmp/t.jsonl 2026-05-20T00:00:00Z "$TMP/lib/a.js,$TMP/lib/b.js,$TMP/lib/c.js"
run "plan-anchored initiative → drift detected via plan→phase resolution"
echo "{\"stop_hook_active\":false,\"transcript_path\":\"/tmp/t.jsonl\"}" | bash "$HOOK"
rc=$?
[[ "$rc" == "0" ]] && ok || no "expected 0, got $rc"
[[ -f .atomic-skills/status/drift.log ]] && ok || no "drift.log missing"
grep -q '"breadcrumb": "p/F0 ▸ i"' .atomic-skills/status/drift.log && ok || no "missing plan/phase breadcrumb"
cd - >/dev/null; rm -rf "$TMP" /tmp/t.jsonl

# Test 9: 50% out-of-scope (not >50%) → no warning
TMP=$(mktemp -d); cd "$TMP"
init_git_branch feat
mkdir -p .atomic-skills/initiatives .atomic-skills/status
echo '{"strict_mode":false}' > .atomic-skills/status/config.json
write_initiative .atomic-skills/initiatives/i.md i active feat "" "" "src/"
write_transcript /tmp/t.jsonl 2026-05-20T00:00:00Z "$TMP/src/a.js,$TMP/lib/b.js"
run "exactly 50% out-of-scope → no warning (threshold is strict >)"
echo "{\"stop_hook_active\":false,\"transcript_path\":\"/tmp/t.jsonl\"}" | bash "$HOOK"
rc=$?
[[ "$rc" == "0" ]] && ok || no "expected 0, got $rc"
[[ ! -f .atomic-skills/status/drift.log ]] && ok || no "drift.log should not exist at exactly threshold"
cd - >/dev/null; rm -rf "$TMP" /tmp/t.jsonl

# Test 10: configurable drift_threshold honored
TMP=$(mktemp -d); cd "$TMP"
init_git_branch feat
mkdir -p .atomic-skills/initiatives .atomic-skills/status
echo '{"strict_mode":false,"drift_threshold":0.1}' > .atomic-skills/status/config.json
write_initiative .atomic-skills/initiatives/i.md i active feat "" "" "src/"
write_transcript /tmp/t.jsonl 2026-05-20T00:00:00Z "$TMP/src/a.js,$TMP/src/b.js,$TMP/src/c.js,$TMP/lib/d.js"
run "drift_threshold=0.1 → 1/4 out triggers warning"
echo "{\"stop_hook_active\":false,\"transcript_path\":\"/tmp/t.jsonl\"}" | bash "$HOOK"
rc=$?
[[ "$rc" == "0" ]] && ok || no "expected 0"
[[ -f .atomic-skills/status/drift.log ]] && ok || no "drift.log missing"
cd - >/dev/null; rm -rf "$TMP" /tmp/t.jsonl

echo ""
echo "RESULT: $PASS passed, $FAIL failed"
[[ "$FAIL" == "0" ]]
