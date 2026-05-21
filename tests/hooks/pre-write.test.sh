#!/usr/bin/env bash
# Tests for pre-write.sh (PreToolUse emergent-work provenance gate)
set -euo pipefail

HOOK="$(pwd)/skills/shared/project-status-assets/hooks/pre-write.sh"
PASS=0; FAIL=0

run() { echo "TEST: $1"; }
ok()  { PASS=$((PASS+1)); echo "  PASS"; }
no()  { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }

# Always feed the hook with `printf '%s'` — zsh's `echo` interprets `\n` in
# string contents and corrupts JSON payloads with escaped newlines.
feed() { printf '%s' "$1" | bash "$HOOK"; }

# Initiative skeleton with a single original task.
write_initiative_one_task() {
  local file=$1
  cat > "$file" <<EOF
---
schemaVersion: '0.1'
slug: i
title: 'X'
goal: 'Y'
status: active
branch: null
started: 2026-05-20T00:00:00Z
lastUpdated: 2026-05-20T00:00:00Z
nextAction: null
exitGates: []
stack: []
tasks:
  - id: T-001
    title: 'foo'
    status: pending
    lastUpdated: 2026-05-20T00:00:00Z
parked: []
emerged: []
---

# Body
EOF
}

# Initiative skeleton with one original + one emergent (with provenance).
write_initiative_with_provenance() {
  local file=$1
  cat > "$file" <<EOF
---
schemaVersion: '0.1'
slug: i
title: 'X'
goal: 'Y'
status: active
branch: null
started: 2026-05-20T00:00:00Z
lastUpdated: 2026-05-20T00:00:00Z
nextAction: null
exitGates: []
stack: []
tasks:
  - id: T-001
    title: 'foo'
    status: pending
    lastUpdated: 2026-05-20T00:00:00Z
  - id: T-002
    title: 'emergent'
    status: pending
    lastUpdated: 2026-05-20T00:00:00Z
    provenance:
      surfacedAt: 2026-05-20T18:14:16Z
      surfacedDuring: i/T-001
      surfacedBy: human
parked: []
emerged: []
---
EOF
}

write_plan_one_phase() {
  local file=$1
  cat > "$file" <<EOF
---
schemaVersion: '0.1'
slug: p
title: 'Plan'
version: '1.0'
status: active
started: 2026-05-20T00:00:00Z
lastUpdated: 2026-05-20T00:00:00Z
currentPhase: F0
parallelismAllowed: false
phases:
  - id: F0
    slug: phase-zero
    title: 'Phase 0'
    goal: 'goal'
    dependsOn: []
    subPhaseCount: 0
    status: active
    exitGate:
      summary: 'gate'
      criteria: []
---
EOF
}

# Render an initiative body containing N tasks. Items in `prov_ids_csv` get a
# `provenance` block. Items in `ctx_ids_csv` get a complete `context` block
# (solves + trigger + ratifiedAt). The two are independent so tests can isolate
# "has provenance but no context" violations.
render_initiative_full() {
  local n=$1 prov_ids_csv=${2:-} ctx_ids_csv=${3:-}
  local body
  body=$(cat <<EOF
---
schemaVersion: '0.1'
slug: i
title: 'X'
goal: 'Y'
status: active
branch: null
started: 2026-05-20T00:00:00Z
lastUpdated: 2026-05-20T00:00:00Z
nextAction: null
exitGates: []
stack: []
tasks:
EOF
)
  local i id has_prov has_ctx IFS_OLD=$IFS
  for ((i=1; i<=n; i++)); do
    id=$(printf 'T-%03d' "$i")
    has_prov=no; has_ctx=no
    if [[ -n "$prov_ids_csv" ]]; then
      IFS=',' read -ra arr <<< "$prov_ids_csv"
      for p in "${arr[@]}"; do [[ "$p" == "$id" ]] && has_prov=yes; done
    fi
    if [[ -n "$ctx_ids_csv" ]]; then
      IFS=',' read -ra arr <<< "$ctx_ids_csv"
      for p in "${arr[@]}"; do [[ "$p" == "$id" ]] && has_ctx=yes; done
    fi
    IFS=$IFS_OLD
    body+=$(printf '\n  - id: %s\n    title: \047task-%d\047\n    status: pending\n    lastUpdated: 2026-05-20T00:00:00Z' "$id" "$i")
    if [[ "$has_prov" == "yes" ]]; then
      body+=$(printf '\n    provenance:\n      surfacedAt: 2026-05-20T18:14:16Z\n      surfacedDuring: i/T-001\n      surfacedBy: human')
    fi
    if [[ "$has_ctx" == "yes" ]]; then
      body+=$(printf '\n    context:\n      solves: \047real problem statement here\047\n      trigger: \047concrete trigger here\047\n      ratifiedAt: 2026-05-20T18:15:00Z\n      ratifiedBy: human')
    fi
  done
  body+=$(printf '\nparked: []\nemerged: []\n---\n')
  printf '%s' "$body"
}

# --- T1: tool_name not in scope (Read) → exit 0, no log ---------------------
TMP=$(mktemp -d); cd "$TMP"
mkdir -p .atomic-skills/initiatives .atomic-skills/status
printf '{"emergent_strict_mode":false}' > .atomic-skills/status/config.json
write_initiative_one_task .atomic-skills/initiatives/i.md
PAYLOAD=$(jq -n --arg fp "$TMP/.atomic-skills/initiatives/i.md" \
  '{tool_name:"Read", tool_input:{file_path:$fp}}')
run "T1: tool_name=Read → exit 0, no log"
feed "$PAYLOAD"
rc=$?
[[ "$rc" == "0" ]] && ok || no "expected 0, got $rc"
[[ ! -f .atomic-skills/status/emergent-drift.log ]] && ok || no "log unexpectedly written"
cd - >/dev/null; rm -rf "$TMP"

# --- T2: file_path outside .atomic-skills/ → exit 0, no log -----------------
TMP=$(mktemp -d); cd "$TMP"
mkdir -p .atomic-skills/initiatives .atomic-skills/status
printf '{"emergent_strict_mode":false}' > .atomic-skills/status/config.json
NEW=$(render_initiative_full 2)
PAYLOAD=$(jq -n --arg fp "$TMP/src/foo.md" --arg ct "$NEW" \
  '{tool_name:"Write", tool_input:{file_path:$fp, content:$ct}}')
run "T2: file_path outside .atomic-skills/{initiatives,plans}/ → exit 0"
feed "$PAYLOAD"
rc=$?
[[ "$rc" == "0" ]] && ok || no "expected 0, got $rc"
[[ ! -f .atomic-skills/status/emergent-drift.log ]] && ok || no "log unexpectedly written"
cd - >/dev/null; rm -rf "$TMP"

# --- T3: SKIP-EMERGENT flag → exit 0 (bypass) -------------------------------
TMP=$(mktemp -d); cd "$TMP"
mkdir -p .atomic-skills/initiatives .atomic-skills/status
printf '{"emergent_strict_mode":true}' > .atomic-skills/status/config.json
write_initiative_one_task .atomic-skills/initiatives/i.md
touch .atomic-skills/status/SKIP-EMERGENT
NEW=$(render_initiative_full 2)
PAYLOAD=$(jq -n --arg fp "$TMP/.atomic-skills/initiatives/i.md" --arg ct "$NEW" \
  '{tool_name:"Write", tool_input:{file_path:$fp, content:$ct}}')
run "T3: SKIP-EMERGENT flag bypasses gate even in strict mode"
feed "$PAYLOAD"
rc=$?
[[ "$rc" == "0" ]] && ok || no "expected 0, got $rc"
cd - >/dev/null; rm -rf "$TMP"

# --- T4: Write creating new file → exit 0 (original materialization) --------
TMP=$(mktemp -d); cd "$TMP"
mkdir -p .atomic-skills/initiatives .atomic-skills/status
printf '{"emergent_strict_mode":true}' > .atomic-skills/status/config.json
NEW=$(render_initiative_full 5)  # 5 original tasks, no provenance
PAYLOAD=$(jq -n --arg fp "$TMP/.atomic-skills/initiatives/i.md" --arg ct "$NEW" \
  '{tool_name:"Write", tool_input:{file_path:$fp, content:$ct}}')
run "T4: file creation with N tasks (no provenance) → exit 0"
feed "$PAYLOAD"
rc=$?
[[ "$rc" == "0" ]] && ok || no "expected 0, got $rc (file creation should pass)"
[[ ! -f .atomic-skills/status/emergent-drift.log ]] && ok || no "log unexpectedly written"
cd - >/dev/null; rm -rf "$TMP"

# --- T5: add task WITH provenance + complete context → exit 0, no log -------
TMP=$(mktemp -d); cd "$TMP"
mkdir -p .atomic-skills/initiatives .atomic-skills/status
printf '{"emergent_strict_mode":false}' > .atomic-skills/status/config.json
write_initiative_one_task .atomic-skills/initiatives/i.md
NEW=$(render_initiative_full 2 "T-002" "T-002")  # T-002 has provenance + context
PAYLOAD=$(jq -n --arg fp "$TMP/.atomic-skills/initiatives/i.md" --arg ct "$NEW" \
  '{tool_name:"Write", tool_input:{file_path:$fp, content:$ct}}')
run "T5: add task with provenance + ratified context → exit 0, no log"
feed "$PAYLOAD"
rc=$?
[[ "$rc" == "0" ]] && ok || no "expected 0, got $rc"
[[ ! -f .atomic-skills/status/emergent-drift.log ]] && ok || no "log unexpectedly written"
cd - >/dev/null; rm -rf "$TMP"

# --- T6: add task WITHOUT provenance, dry-run → exit 0 + log written --------
TMP=$(mktemp -d); cd "$TMP"
mkdir -p .atomic-skills/initiatives .atomic-skills/status
printf '{"emergent_strict_mode":false}' > .atomic-skills/status/config.json
write_initiative_one_task .atomic-skills/initiatives/i.md
NEW=$(render_initiative_full 2)  # no provenance on T-002
PAYLOAD=$(jq -n --arg fp "$TMP/.atomic-skills/initiatives/i.md" --arg ct "$NEW" \
  '{tool_name:"Write", tool_input:{file_path:$fp, content:$ct}}')
run "T6: add task w/o provenance (dry-run) → exit 0 + log entry"
feed "$PAYLOAD"
rc=$?
[[ "$rc" == "0" ]] && ok || no "expected 0 (dry-run), got $rc"
[[ -f .atomic-skills/status/emergent-drift.log ]] && ok || no "log missing"
grep -q '"mode": "dry-run"' .atomic-skills/status/emergent-drift.log && ok || no "missing dry-run marker"
grep -q 'task:T-002 (no provenance)' .atomic-skills/status/emergent-drift.log && ok || no "missing violation entry"
cd - >/dev/null; rm -rf "$TMP"

# --- T7: add task WITHOUT provenance, strict_mode → exit 2 ------------------
TMP=$(mktemp -d); cd "$TMP"
mkdir -p .atomic-skills/initiatives .atomic-skills/status
printf '{"emergent_strict_mode":true}' > .atomic-skills/status/config.json
write_initiative_one_task .atomic-skills/initiatives/i.md
NEW=$(render_initiative_full 2)
PAYLOAD=$(jq -n --arg fp "$TMP/.atomic-skills/initiatives/i.md" --arg ct "$NEW" \
  '{tool_name:"Write", tool_input:{file_path:$fp, content:$ct}}')
run "T7: add task w/o provenance + strict → exit 2 with stderr"
set +e
out=$(feed "$PAYLOAD" 2>&1)
rc=$?
set -e
[[ "$rc" == "2" ]] && ok || no "expected exit 2, got $rc"
printf '%s' "$out" | grep -q "user-ratifies" && ok || no "expected ratify-flow explanation in stderr"
printf '%s' "$out" | grep -q "task:T-002 (no provenance)" && ok || no "expected violation id in stderr"
cd - >/dev/null; rm -rf "$TMP"

# --- T8: update existing task status (no addition) → exit 0, no log ---------
TMP=$(mktemp -d); cd "$TMP"
mkdir -p .atomic-skills/initiatives .atomic-skills/status
printf '{"emergent_strict_mode":true}' > .atomic-skills/status/config.json
write_initiative_one_task .atomic-skills/initiatives/i.md
# Apply an Edit that just flips status: pending → status: active
PAYLOAD=$(jq -n --arg fp "$TMP/.atomic-skills/initiatives/i.md" \
  --arg os "status: pending" --arg ns "status: active" \
  '{tool_name:"Edit", tool_input:{file_path:$fp, old_string:$os, new_string:$ns}}')
run "T8: update existing task (no new id) → exit 0"
feed "$PAYLOAD"
rc=$?
[[ "$rc" == "0" ]] && ok || no "expected 0, got $rc"
[[ ! -f .atomic-skills/status/emergent-drift.log ]] && ok || no "log unexpectedly written"
cd - >/dev/null; rm -rf "$TMP"

# --- T9: delete a task → exit 0, no log -------------------------------------
TMP=$(mktemp -d); cd "$TMP"
mkdir -p .atomic-skills/initiatives .atomic-skills/status
printf '{"emergent_strict_mode":true}' > .atomic-skills/status/config.json
write_initiative_with_provenance .atomic-skills/initiatives/i.md
# Write a version with only T-001 (T-002 removed) — no NEW ids → no violation
NEW=$(render_initiative_full 1)
PAYLOAD=$(jq -n --arg fp "$TMP/.atomic-skills/initiatives/i.md" --arg ct "$NEW" \
  '{tool_name:"Write", tool_input:{file_path:$fp, content:$ct}}')
run "T9: delete a task → exit 0"
feed "$PAYLOAD"
rc=$?
[[ "$rc" == "0" ]] && ok || no "expected 0, got $rc"
[[ ! -f .atomic-skills/status/emergent-drift.log ]] && ok || no "log unexpectedly written"
cd - >/dev/null; rm -rf "$TMP"

# --- T10: plan adds new phase WITHOUT provenance → log ----------------------
TMP=$(mktemp -d); cd "$TMP"
mkdir -p .atomic-skills/plans .atomic-skills/status
printf '{"emergent_strict_mode":false}' > .atomic-skills/status/config.json
write_plan_one_phase .atomic-skills/plans/p.md
NEW=$(cat <<EOF
---
schemaVersion: '0.1'
slug: p
title: 'Plan'
version: '1.0'
status: active
started: 2026-05-20T00:00:00Z
lastUpdated: 2026-05-20T00:00:00Z
currentPhase: F0
parallelismAllowed: false
phases:
  - id: F0
    slug: phase-zero
    title: 'Phase 0'
    goal: 'goal'
    dependsOn: []
    subPhaseCount: 0
    status: active
    exitGate:
      summary: 'gate'
      criteria: []
  - id: F1
    slug: phase-one
    title: 'Emergent phase'
    goal: 'goal'
    dependsOn: [F0]
    subPhaseCount: 0
    status: pending
    exitGate:
      summary: 'gate'
      criteria: []
---
EOF
)
PAYLOAD=$(jq -n --arg fp "$TMP/.atomic-skills/plans/p.md" --arg ct "$NEW" \
  '{tool_name:"Write", tool_input:{file_path:$fp, content:$ct}}')
run "T10: plan adds new phase w/o provenance (dry-run) → log entry"
feed "$PAYLOAD"
rc=$?
[[ "$rc" == "0" ]] && ok || no "expected 0, got $rc"
[[ -f .atomic-skills/status/emergent-drift.log ]] && ok || no "log missing"
grep -q 'phase:F1 (no provenance)' .atomic-skills/status/emergent-drift.log && ok || no "missing phase:F1 violation"
cd - >/dev/null; rm -rf "$TMP"

# --- T11: archive/ subdir edit → exit 0 (out of gated path) -----------------
TMP=$(mktemp -d); cd "$TMP"
mkdir -p .atomic-skills/initiatives/archive .atomic-skills/status
printf '{"emergent_strict_mode":true}' > .atomic-skills/status/config.json
write_initiative_one_task .atomic-skills/initiatives/archive/old.md
NEW=$(render_initiative_full 3)
PAYLOAD=$(jq -n --arg fp "$TMP/.atomic-skills/initiatives/archive/old.md" --arg ct "$NEW" \
  '{tool_name:"Write", tool_input:{file_path:$fp, content:$ct}}')
run "T11: archive/ subdir is out of gate → exit 0"
feed "$PAYLOAD"
rc=$?
[[ "$rc" == "0" ]] && ok || no "expected 0, got $rc"
cd - >/dev/null; rm -rf "$TMP"

# --- T12: malformed payload (missing tool_input) → exit 0 (fail-open) -------
TMP=$(mktemp -d); cd "$TMP"
mkdir -p .atomic-skills/status
printf '{"emergent_strict_mode":true}' > .atomic-skills/status/config.json
run "T12: missing tool_input → fail-open exit 0"
printf '%s' '{"tool_name":"Edit"}' | bash "$HOOK"
rc=$?
[[ "$rc" == "0" ]] && ok || no "expected 0, got $rc"
cd - >/dev/null; rm -rf "$TMP"

# --- T13: Edit on .md adds task w/o provenance via Edit string replacement --
TMP=$(mktemp -d); cd "$TMP"
mkdir -p .atomic-skills/initiatives .atomic-skills/status
printf '{"emergent_strict_mode":false}' > .atomic-skills/status/config.json
write_initiative_one_task .atomic-skills/initiatives/i.md
OLD_STR="parked: []"
NEW_STR=$'  - id: T-002\n    title: \047emergent\047\n    status: pending\n    lastUpdated: 2026-05-20T00:00:00Z\nparked: []'
PAYLOAD=$(jq -n --arg fp "$TMP/.atomic-skills/initiatives/i.md" \
  --arg os "$OLD_STR" --arg ns "$NEW_STR" \
  '{tool_name:"Edit", tool_input:{file_path:$fp, old_string:$os, new_string:$ns}}')
run "T13: Edit path adds task w/o provenance → log entry"
feed "$PAYLOAD"
rc=$?
[[ "$rc" == "0" ]] && ok || no "expected 0 (dry-run), got $rc"
[[ -f .atomic-skills/status/emergent-drift.log ]] && ok || no "log missing"
grep -q 'task:T-002 (no provenance)' .atomic-skills/status/emergent-drift.log && ok || no "missing task:T-002 violation"
cd - >/dev/null; rm -rf "$TMP"

# --- T14: MultiEdit, mix of OK and missing provenance → log violation -------
TMP=$(mktemp -d); cd "$TMP"
mkdir -p .atomic-skills/initiatives .atomic-skills/status
printf '{"emergent_strict_mode":false}' > .atomic-skills/status/config.json
write_initiative_one_task .atomic-skills/initiatives/i.md
# Edit 1: legit addition with provenance. Edit 2: silent addition.
# NB: nested single-quotes inside $'...' would terminate the ANSI-C escape
# sequence and turn subsequent \n into literal backslash-n. Use \047 (ASCII for
# `'`) so the entire string stays inside the same $'...' quotation.
E1_OLD="parked: []"
E1_NEW=$'  - id: T-002\n    title: \047with-prov\047\n    status: pending\n    lastUpdated: 2026-05-20T00:00:00Z\n    provenance:\n      surfacedAt: 2026-05-20T18:14:16Z\n      surfacedBy: human\n    context:\n      solves: \047real problem here\047\n      trigger: \047concrete trigger here\047\n      ratifiedAt: 2026-05-20T18:15:00Z\n      ratifiedBy: human\nparked: []'
E2_OLD=$'  - id: T-002\n    title: \047with-prov\047\n    status: pending\n    lastUpdated: 2026-05-20T00:00:00Z\n    provenance:\n      surfacedAt: 2026-05-20T18:14:16Z\n      surfacedBy: human\n    context:\n      solves: \047real problem here\047\n      trigger: \047concrete trigger here\047\n      ratifiedAt: 2026-05-20T18:15:00Z\n      ratifiedBy: human'
E2_NEW=$'  - id: T-002\n    title: \047with-prov\047\n    status: pending\n    lastUpdated: 2026-05-20T00:00:00Z\n    provenance:\n      surfacedAt: 2026-05-20T18:14:16Z\n      surfacedBy: human\n    context:\n      solves: \047real problem here\047\n      trigger: \047concrete trigger here\047\n      ratifiedAt: 2026-05-20T18:15:00Z\n      ratifiedBy: human\n  - id: T-003\n    title: \047silent\047\n    status: pending\n    lastUpdated: 2026-05-20T00:00:00Z'
PAYLOAD=$(jq -n --arg fp "$TMP/.atomic-skills/initiatives/i.md" \
  --arg e1o "$E1_OLD" --arg e1n "$E1_NEW" \
  --arg e2o "$E2_OLD" --arg e2n "$E2_NEW" \
  '{tool_name:"MultiEdit", tool_input:{file_path:$fp, edits:[
    {old_string:$e1o, new_string:$e1n},
    {old_string:$e2o, new_string:$e2n}
  ]}}')
run "T14: MultiEdit mixed (one OK + one silent) → log only the silent one"
feed "$PAYLOAD"
rc=$?
[[ "$rc" == "0" ]] && ok || no "expected 0, got $rc"
[[ -f .atomic-skills/status/emergent-drift.log ]] && ok || no "log missing"
grep -q 'task:T-003 (no provenance)' .atomic-skills/status/emergent-drift.log && ok || no "missing task:T-003 violation"
! grep -q 'task:T-002' .atomic-skills/status/emergent-drift.log && ok || no "T-002 (legit) should NOT be in violations"
cd - >/dev/null; rm -rf "$TMP"

# --- T15: NotebookEdit on .md → exit 0 (notebook hook doesn't apply) --------
TMP=$(mktemp -d); cd "$TMP"
mkdir -p .atomic-skills/initiatives .atomic-skills/status
printf '{"emergent_strict_mode":true}' > .atomic-skills/status/config.json
write_initiative_one_task .atomic-skills/initiatives/i.md
PAYLOAD=$(jq -n --arg fp "$TMP/.atomic-skills/initiatives/i.md" \
  '{tool_name:"NotebookEdit", tool_input:{notebook_path:$fp, cell_id:"c1", new_source:"x"}}')
run "T15: NotebookEdit on a .md path → exit 0 (skipped)"
feed "$PAYLOAD"
rc=$?
[[ "$rc" == "0" ]] && ok || no "expected 0, got $rc"
cd - >/dev/null; rm -rf "$TMP"

# --- T16: config absent → exit 0 (hook installed but not configured) --------
TMP=$(mktemp -d); cd "$TMP"
mkdir -p .atomic-skills/initiatives .atomic-skills/status
write_initiative_one_task .atomic-skills/initiatives/i.md
NEW=$(render_initiative_full 2)
PAYLOAD=$(jq -n --arg fp "$TMP/.atomic-skills/initiatives/i.md" --arg ct "$NEW" \
  '{tool_name:"Write", tool_input:{file_path:$fp, content:$ct}}')
run "T16: config.json missing → exit 0 (no gating)"
feed "$PAYLOAD"
rc=$?
[[ "$rc" == "0" ]] && ok || no "expected 0, got $rc"
[[ ! -f .atomic-skills/status/emergent-drift.log ]] && ok || no "log unexpectedly written"
cd - >/dev/null; rm -rf "$TMP"

# --- T17: rendered.md is exempt --------------------------------------------
TMP=$(mktemp -d); cd "$TMP"
mkdir -p .atomic-skills/initiatives .atomic-skills/status
printf '{"emergent_strict_mode":true}' > .atomic-skills/status/config.json
write_initiative_one_task .atomic-skills/initiatives/i.md
# Pretend the rendered.md exists and is being written
cp .atomic-skills/initiatives/i.md .atomic-skills/initiatives/i.rendered.md
NEW=$(render_initiative_full 5)
PAYLOAD=$(jq -n --arg fp "$TMP/.atomic-skills/initiatives/i.rendered.md" --arg ct "$NEW" \
  '{tool_name:"Write", tool_input:{file_path:$fp, content:$ct}}')
run "T17: rendered.md derived artifact is exempt"
feed "$PAYLOAD"
rc=$?
[[ "$rc" == "0" ]] && ok || no "expected 0, got $rc"
cd - >/dev/null; rm -rf "$TMP"

# --- T18: add task with provenance but NO context → context violation -------
TMP=$(mktemp -d); cd "$TMP"
mkdir -p .atomic-skills/initiatives .atomic-skills/status
printf '{"emergent_strict_mode":false}' > .atomic-skills/status/config.json
write_initiative_one_task .atomic-skills/initiatives/i.md
NEW=$(render_initiative_full 2 "T-002")  # provenance YES, context NO
PAYLOAD=$(jq -n --arg fp "$TMP/.atomic-skills/initiatives/i.md" --arg ct "$NEW" \
  '{tool_name:"Write", tool_input:{file_path:$fp, content:$ct}}')
run "T18: provenance present but context missing → log entry naming the gaps"
feed "$PAYLOAD"
rc=$?
[[ "$rc" == "0" ]] && ok || no "expected 0 (dry-run), got $rc"
[[ -f .atomic-skills/status/emergent-drift.log ]] && ok || no "log missing"
grep -q 'task:T-002 (missing context' .atomic-skills/status/emergent-drift.log && ok || no "violation should be context-flavored, not provenance"
grep -q 'solves' .atomic-skills/status/emergent-drift.log && ok || no "expected 'solves' named in missing list"
grep -q 'trigger' .atomic-skills/status/emergent-drift.log && ok || no "expected 'trigger' named in missing list"
grep -q 'ratifiedAt' .atomic-skills/status/emergent-drift.log && ok || no "expected 'ratifiedAt' named in missing list"
cd - >/dev/null; rm -rf "$TMP"

# --- T19: provenance + partial context (only solves) → still violates -------
TMP=$(mktemp -d); cd "$TMP"
mkdir -p .atomic-skills/initiatives .atomic-skills/status
printf '{"emergent_strict_mode":true}' > .atomic-skills/status/config.json
write_initiative_one_task .atomic-skills/initiatives/i.md
NEW=$(cat <<EOF
---
schemaVersion: '0.1'
slug: i
title: 'X'
goal: 'Y'
status: active
branch: null
started: 2026-05-20T00:00:00Z
lastUpdated: 2026-05-20T00:00:00Z
nextAction: null
exitGates: []
stack: []
tasks:
  - id: T-001
    title: 'foo'
    status: pending
    lastUpdated: 2026-05-20T00:00:00Z
  - id: T-002
    title: 'partially-ratified'
    status: pending
    lastUpdated: 2026-05-20T00:00:00Z
    provenance:
      surfacedAt: 2026-05-20T18:14:16Z
      surfacedBy: human
    context:
      solves: 'a real solve statement'
parked: []
emerged: []
---
EOF
)
PAYLOAD=$(jq -n --arg fp "$TMP/.atomic-skills/initiatives/i.md" --arg ct "$NEW" \
  '{tool_name:"Write", tool_input:{file_path:$fp, content:$ct}}')
run "T19: partial context (only solves) + strict → exit 2 naming gaps"
set +e
out=$(feed "$PAYLOAD" 2>&1)
rc=$?
set -e
[[ "$rc" == "2" ]] && ok || no "expected exit 2, got $rc"
printf '%s' "$out" | grep -q "missing context" && ok || no "expected 'missing context' diagnostic in stderr"
printf '%s' "$out" | grep -q "trigger" && ok || no "expected 'trigger' named as missing"
printf '%s' "$out" | grep -q "ratifiedAt" && ok || no "expected 'ratifiedAt' named as missing"
# solves was present — should NOT appear in the missing list
! printf '%s' "$out" | grep -q "solves," && ok || no "'solves' should NOT be in missing list when present"
cd - >/dev/null; rm -rf "$TMP"

# --- T20: parked addition without context → log entry ----------------------
TMP=$(mktemp -d); cd "$TMP"
mkdir -p .atomic-skills/initiatives .atomic-skills/status
printf '{"emergent_strict_mode":false}' > .atomic-skills/status/config.json
write_initiative_one_task .atomic-skills/initiatives/i.md
# OLD has empty parked: []. NEW adds a parked entry with NO context.
NEW=$(cat <<EOF
---
schemaVersion: '0.1'
slug: i
title: 'X'
goal: 'Y'
status: active
branch: null
started: 2026-05-20T00:00:00Z
lastUpdated: 2026-05-20T00:00:00Z
nextAction: null
exitGates: []
stack: []
tasks:
  - id: T-001
    title: 'foo'
    status: pending
    lastUpdated: 2026-05-20T00:00:00Z
parked:
  - title: 'silent parked stub'
    surfacedAt: '2026-05-20T18:00:00Z'
    fromFrame: 1
emerged: []
---
EOF
)
PAYLOAD=$(jq -n --arg fp "$TMP/.atomic-skills/initiatives/i.md" --arg ct "$NEW" \
  '{tool_name:"Write", tool_input:{file_path:$fp, content:$ct}}')
run "T20: parked addition without context → log entry naming missing fields"
feed "$PAYLOAD"
rc=$?
[[ "$rc" == "0" ]] && ok || no "expected 0 (dry-run), got $rc"
[[ -f .atomic-skills/status/emergent-drift.log ]] && ok || no "log missing"
grep -q 'parked:2026-05-20T18:00:00Z (missing context' .atomic-skills/status/emergent-drift.log && ok || no "violation should be context-flavored for parked"
grep -q 'solves' .atomic-skills/status/emergent-drift.log && ok || no "expected 'solves' named"
cd - >/dev/null; rm -rf "$TMP"

# --- T21: parked addition with complete context → exit 0, no log -----------
TMP=$(mktemp -d); cd "$TMP"
mkdir -p .atomic-skills/initiatives .atomic-skills/status
printf '{"emergent_strict_mode":true}' > .atomic-skills/status/config.json
write_initiative_one_task .atomic-skills/initiatives/i.md
NEW=$(cat <<EOF
---
schemaVersion: '0.1'
slug: i
title: 'X'
goal: 'Y'
status: active
branch: null
started: 2026-05-20T00:00:00Z
lastUpdated: 2026-05-20T00:00:00Z
nextAction: null
exitGates: []
stack: []
tasks:
  - id: T-001
    title: 'foo'
    status: pending
    lastUpdated: 2026-05-20T00:00:00Z
parked:
  - title: 'legit parked'
    surfacedAt: '2026-05-20T18:00:00Z'
    fromFrame: 1
    context:
      solves: 'real concrete pain'
      trigger: 'observed during T-001 review'
      ratifiedAt: '2026-05-20T18:05:00Z'
      ratifiedBy: human
emerged: []
---
EOF
)
PAYLOAD=$(jq -n --arg fp "$TMP/.atomic-skills/initiatives/i.md" --arg ct "$NEW" \
  '{tool_name:"Write", tool_input:{file_path:$fp, content:$ct}}')
run "T21: parked addition with complete context + strict → exit 0"
feed "$PAYLOAD"
rc=$?
[[ "$rc" == "0" ]] && ok || no "expected 0, got $rc"
[[ ! -f .atomic-skills/status/emergent-drift.log ]] && ok || no "log unexpectedly written"
cd - >/dev/null; rm -rf "$TMP"

# --- T22: emerged addition without context + strict → exit 2 ---------------
TMP=$(mktemp -d); cd "$TMP"
mkdir -p .atomic-skills/initiatives .atomic-skills/status
printf '{"emergent_strict_mode":true}' > .atomic-skills/status/config.json
write_initiative_one_task .atomic-skills/initiatives/i.md
NEW=$(cat <<EOF
---
schemaVersion: '0.1'
slug: i
title: 'X'
goal: 'Y'
status: active
branch: null
started: 2026-05-20T00:00:00Z
lastUpdated: 2026-05-20T00:00:00Z
nextAction: null
exitGates: []
stack: []
tasks:
  - id: T-001
    title: 'foo'
    status: pending
    lastUpdated: 2026-05-20T00:00:00Z
parked: []
emerged:
  - title: 'unratified emergence'
    surfacedAt: '2026-05-20T19:00:00Z'
    promoted: false
---
EOF
)
PAYLOAD=$(jq -n --arg fp "$TMP/.atomic-skills/initiatives/i.md" --arg ct "$NEW" \
  '{tool_name:"Write", tool_input:{file_path:$fp, content:$ct}}')
run "T22: emerged addition without context + strict → exit 2"
set +e
out=$(feed "$PAYLOAD" 2>&1)
rc=$?
set -e
[[ "$rc" == "2" ]] && ok || no "expected exit 2, got $rc"
printf '%s' "$out" | grep -q 'emerged:2026-05-20T19:00:00Z' && ok || no "expected emerged violation in stderr"
printf '%s' "$out" | grep -q 'missing context' && ok || no "expected 'missing context' diagnostic"
cd - >/dev/null; rm -rf "$TMP"

# --- T23: existing parked entry unchanged → no violation -------------------
TMP=$(mktemp -d); cd "$TMP"
mkdir -p .atomic-skills/initiatives .atomic-skills/status
printf '{"emergent_strict_mode":true}' > .atomic-skills/status/config.json
# OLD already has one parked entry (with full context). NEW just bumps lastUpdated.
cat > .atomic-skills/initiatives/i.md <<EOF
---
schemaVersion: '0.1'
slug: i
title: 'X'
goal: 'Y'
status: active
branch: null
started: 2026-05-20T00:00:00Z
lastUpdated: 2026-05-20T00:00:00Z
nextAction: null
exitGates: []
stack: []
tasks:
  - id: T-001
    title: 'foo'
    status: pending
    lastUpdated: 2026-05-20T00:00:00Z
parked:
  - title: 'pre-existing'
    surfacedAt: '2026-05-19T10:00:00Z'
    fromFrame: 1
    context:
      solves: 'real'
      trigger: 'real'
      ratifiedAt: '2026-05-19T10:05:00Z'
emerged: []
---
EOF
PAYLOAD=$(jq -n --arg fp "$TMP/.atomic-skills/initiatives/i.md" \
  --arg os "lastUpdated: 2026-05-20T00:00:00Z" --arg ns "lastUpdated: 2026-05-20T19:30:00Z" \
  '{tool_name:"Edit", tool_input:{file_path:$fp, old_string:$os, new_string:$ns}}')
run "T23: existing parked entry unchanged → exit 0, no violation"
feed "$PAYLOAD"
rc=$?
[[ "$rc" == "0" ]] && ok || no "expected 0, got $rc"
[[ ! -f .atomic-skills/status/emergent-drift.log ]] && ok || no "log unexpectedly written"
cd - >/dev/null; rm -rf "$TMP"

echo ""
echo "RESULT: $PASS passed, $FAIL failed"
[[ "$FAIL" == "0" ]]
