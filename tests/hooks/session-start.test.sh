#!/usr/bin/env bash
# Tests for session-start.sh (v2: 3-level + aiDeck-aware)
set -euo pipefail

HOOK="$(pwd)/skills/shared/project-assets/hooks/session-start.sh"
PASS=0; FAIL=0
TEST_HOME=$(mktemp -d)
export HOME="$TEST_HOME"
trap 'rm -rf "$TEST_HOME"' EXIT

run() { echo "TEST: $1"; }
ok()  { PASS=$((PASS+1)); echo "  PASS"; }
no()  { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }

# Helper: write a frontmatter block for a Plan.
write_plan() {
  local file=$1 slug=$2 status=$3 phase=$4 branch=${5:-}
  cat > "$file" <<EOF
---
schemaVersion: '0.1'
slug: ${slug}
title: 'Test Plan ${slug}'
version: '1.0'
status: ${status}
started: 2026-05-20T00:00:00Z
lastUpdated: 2026-05-20T00:00:00Z
$( [[ -n "$branch" ]] && echo "branch: ${branch}" )
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

# Helper: write an Initiative frontmatter block. tasks_status is a CSV of
# task statuses (one task per status).
write_initiative() {
  local file=$1 slug=$2 status=$3 branch=$4 parent=$5 phase=$6 tasks_csv=${7:-}
  {
    echo "---"
    echo "schemaVersion: '0.1'"
    echo "slug: ${slug}"
    echo "title: 'Test Initiative ${slug}'"
    echo "goal: 'goal'"
    echo "status: ${status}"
    if [[ -n "$branch" ]]; then echo "branch: ${branch}"; else echo "branch: null"; fi
    echo "started: 2026-05-20T00:00:00Z"
    echo "lastUpdated: 2026-05-20T00:00:00Z"
    echo "nextAction: 'do thing'"
    if [[ -n "$parent" ]]; then echo "parentPlan: ${parent}"; fi
    if [[ -n "$phase" ]]; then echo "phaseId: ${phase}"; fi
    echo "exitGates: []"
    echo "stack:"
    echo "  - { id: 1, title: 'work', type: task, openedAt: 2026-05-20T00:00:00Z }"
    echo "tasks:"
    if [[ -n "$tasks_csv" ]]; then
      local i=0
      IFS=',' read -ra arr <<< "$tasks_csv"
      for s in "${arr[@]}"; do
        i=$((i+1))
        printf "  - id: T-%03d\n" "$i"
        printf "    title: 'Task %d'\n" "$i"
        printf "    status: %s\n" "$s"
        printf "    lastUpdated: 2026-05-20T00:00:00Z\n"
      done
    fi
    echo "parked: []"
    echo "emerged: []"
    echo "---"
    echo ""
    echo "# Body"
  } > "$file"
}

# Stub git so the hook sees a controlled branch in each TMP repo. We just init
# a tiny git repo per test where we need a branch.
init_git_branch() {
  local branch=$1
  git init -q --initial-branch="$branch" . 2>/dev/null || {
    git init -q .
    git checkout -q -b "$branch" 2>/dev/null || git symbolic-ref HEAD "refs/heads/$branch"
  }
}

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

# Test 3: active Plan → injects plan section with current phase
TMP=$(mktemp -d); cd "$TMP"
init_git_branch main
mkdir -p .atomic-skills/plans .atomic-skills/initiatives
write_plan .atomic-skills/plans/migration.md migration active F0
run "active Plan exists → Active Plan section + current phase"
out=$(bash "$HOOK")
echo "$out" | grep -q "Active Plan: migration" && ok || no "missing 'Active Plan: migration': $out"
echo "$out" | grep -q "Current phase:" && ok || no "missing 'Current phase:'"
echo "$out" | grep -q "\`F0\`" && ok || no "phase id F0 not surfaced"
cd - >/dev/null; rm -rf "$TMP"

# Test 4: active Plan + matching initiative → both injected
TMP=$(mktemp -d); cd "$TMP"
init_git_branch feature/x
mkdir -p .atomic-skills/plans .atomic-skills/initiatives
write_plan .atomic-skills/plans/migration.md migration active F0
write_initiative .atomic-skills/initiatives/work.md work active feature/x migration F0 "pending,done"
run "Plan + matching Initiative → both injected"
out=$(bash "$HOOK")
echo "$out" | grep -q "Active Plan: migration" && ok || no "missing plan"
echo "$out" | grep -q "Current Initiative: work" && ok || no "missing initiative"
echo "$out" | grep -q "(migration/F0)" && ok || no "missing plan/phase breadcrumb"
cd - >/dev/null; rm -rf "$TMP"

# Test 5: plan branch mismatch → warning surfaced
TMP=$(mktemp -d); cd "$TMP"
init_git_branch main
mkdir -p .atomic-skills/plans
write_plan .atomic-skills/plans/p.md p active F0 release-branch
run "Plan branch ≠ current branch → warning"
out=$(bash "$HOOK")
echo "$out" | grep -q "Plan branch" && echo "$out" | grep -q "current branch" && ok || no "no mismatch warning: $out"
cd - >/dev/null; rm -rf "$TMP"

# Test 6: initiative with 0 pending/active tasks → phase-transition signal
TMP=$(mktemp -d); cd "$TMP"
init_git_branch feature/x
mkdir -p .atomic-skills/plans .atomic-skills/initiatives
write_plan .atomic-skills/plans/p.md p active F0
write_initiative .atomic-skills/initiatives/i.md i active feature/x p F0 "done,done"
run "Initiative with 0 pending/active tasks → phase-transition signal"
out=$(bash "$HOOK")
echo "$out" | grep -q "phase-done" && ok || no "missing phase-transition signal: $out"
cd - >/dev/null; rm -rf "$TMP"

# Test 6b: F-003 regression — blocked tasks count as remaining work
TMP=$(mktemp -d); cd "$TMP"
init_git_branch feature/x
mkdir -p .atomic-skills/plans .atomic-skills/initiatives
write_plan .atomic-skills/plans/p.md p active F0
write_initiative .atomic-skills/initiatives/i.md i active feature/x p F0 "done,blocked"
run "F-003: initiative with one 'blocked' task → NO phase-transition signal"
out=$(bash "$HOOK")
if echo "$out" | grep -q "phase-done"; then
  no "blocked task should NOT trigger phase-transition: $out"
else
  ok
fi
cd - >/dev/null; rm -rf "$TMP"

# Test 7: initiative branch mismatch warning
TMP=$(mktemp -d); cd "$TMP"
init_git_branch main
mkdir -p .atomic-skills/plans .atomic-skills/initiatives
write_plan .atomic-skills/plans/p.md p active F0
write_initiative .atomic-skills/initiatives/i.md i active feature/y p F0 "pending"
run "Initiative branch ≠ current branch → warning"
out=$(bash "$HOOK")
echo "$out" | grep -q "Initiative branch" && ok || no "missing initiative branch warning: $out"
cd - >/dev/null; rm -rf "$TMP"

# Test 8: standalone initiative (no plan) → branch-matched, marked standalone
TMP=$(mktemp -d); cd "$TMP"
init_git_branch hotfix/x
mkdir -p .atomic-skills/initiatives
write_initiative .atomic-skills/initiatives/hf.md hf active hotfix/x "" "" "pending"
run "Standalone initiative → branch-matched + (standalone) tag"
out=$(bash "$HOOK")
echo "$out" | grep -q "Current Initiative: hf" && ok || no "missing standalone initiative"
echo "$out" | grep -q "(standalone)" && ok || no "missing (standalone) tag"
cd - >/dev/null; rm -rf "$TMP"

# Test 9: paused plan is ignored
TMP=$(mktemp -d); cd "$TMP"
init_git_branch main
mkdir -p .atomic-skills/plans
write_plan .atomic-skills/plans/p.md p paused F0
run "paused Plan ignored → no Active Plan section"
out=$(bash "$HOOK")
if echo "$out" | grep -q "Active Plan:"; then no "should not surface paused plan: $out"; else ok; fi
cd - >/dev/null; rm -rf "$TMP"

# Test 10a: ~/.atomic-skills/env (preferred) → dashboard URL injected
TMP=$(mktemp -d); cd "$TMP"
init_git_branch main
mkdir -p .atomic-skills
fake_home=$(mktemp -d)
mkdir -p "$fake_home/.atomic-skills"
cat > "$fake_home/.atomic-skills/env" <<EOF
export AS_DASHBOARD_URL='http://127.0.0.1:7777'
EOF
run "AS_DASHBOARD_URL present → Dashboard running section"
out=$(HOME="$fake_home" bash "$HOOK")
echo "$out" | grep -q "Dashboard running" && ok || no "missing 'Dashboard running' section: $out"
echo "$out" | grep -q "127.0.0.1:7777" && ok || no "missing dashboard URL"
rm -rf "$fake_home"
cd - >/dev/null; rm -rf "$TMP"

# Test 10b: legacy ~/.aideck/env fallback
TMP=$(mktemp -d); cd "$TMP"
init_git_branch main
mkdir -p .atomic-skills
fake_home=$(mktemp -d)
mkdir -p "$fake_home/.aideck"
cat > "$fake_home/.aideck/env" <<EOF
export AIDECK_URL='http://127.0.0.1:7778'
export AIDECK_PORT=7778
EOF
run "Legacy ~/.aideck/env fallback → Dashboard URL injected"
out=$(HOME="$fake_home" bash "$HOOK")
echo "$out" | grep -q "Dashboard running" && ok || no "missing 'Dashboard running': $out"
echo "$out" | grep -q "127.0.0.1:7778" && ok || no "missing legacy URL"
rm -rf "$fake_home"
cd - >/dev/null; rm -rf "$TMP"

# Test 10c: AS_DASHBOARD_URL wins over legacy when both present
TMP=$(mktemp -d); cd "$TMP"
init_git_branch main
mkdir -p .atomic-skills
fake_home=$(mktemp -d)
mkdir -p "$fake_home/.atomic-skills" "$fake_home/.aideck"
echo "export AS_DASHBOARD_URL='http://127.0.0.1:9999'" > "$fake_home/.atomic-skills/env"
echo "export AIDECK_URL='http://127.0.0.1:7777'" > "$fake_home/.aideck/env"
run "Both env files present → AS_DASHBOARD_URL wins"
out=$(HOME="$fake_home" bash "$HOOK")
echo "$out" | grep -q "9999" && ok || no "expected 9999, got: $out"
if echo "$out" | grep -q "7777"; then no "legacy URL should not appear: $out"; else ok; fi
rm -rf "$fake_home"
cd - >/dev/null; rm -rf "$TMP"

# ============================================================================
# Nested-layout tests (projects/<id>/<slug>/{plan.md,phases/*.md}) — Inc7/F5
# ============================================================================

# Test 11: nested active Plan → Active Plan section; slug derives from the
# directory name (plan file is `plan.md`, not `<slug>.md`).
TMP=$(mktemp -d); cd "$TMP"
init_git_branch main
mkdir -p .atomic-skills/projects/acme/migration/phases
write_plan .atomic-skills/projects/acme/migration/plan.md migration active F0
run "nested active Plan → Active Plan section + slug from dir"
out=$(bash "$HOOK")
echo "$out" | grep -q "Active Plan: migration" && ok || no "missing 'Active Plan: migration' (nested): $out"
echo "$out" | grep -q "\`F0\`" && ok || no "phase id F0 not surfaced (nested)"
cd - >/dev/null; rm -rf "$TMP"

# Test 12: nested Plan + matching phase initiative (sibling phases/ dir) → both.
TMP=$(mktemp -d); cd "$TMP"
init_git_branch feature/x
mkdir -p .atomic-skills/projects/acme/migration/phases
write_plan .atomic-skills/projects/acme/migration/plan.md migration active F0
write_initiative .atomic-skills/projects/acme/migration/phases/f0-work.md f0-work active feature/x migration F0 "pending,done"
run "nested Plan + matching phase initiative → both injected"
out=$(bash "$HOOK")
echo "$out" | grep -q "Active Plan: migration" && ok || no "missing plan (nested)"
echo "$out" | grep -q "Current Initiative: f0-work" && ok || no "missing initiative (nested): $out"
echo "$out" | grep -q "(migration/F0)" && ok || no "missing plan/phase breadcrumb (nested)"
cd - >/dev/null; rm -rf "$TMP"

# Test 12b: nested active plan wins before legacy flat branch-match fallback.
TMP=$(mktemp -d); cd "$TMP"
init_git_branch feature/x
mkdir -p .atomic-skills/projects/acme/nested/phases .atomic-skills/plans .atomic-skills/initiatives
write_plan .atomic-skills/projects/acme/nested/plan.md nested active F0
write_initiative .atomic-skills/projects/acme/nested/phases/f0-nested.md f0-nested active "" nested F0 "pending"
write_plan .atomic-skills/plans/flat.md flat active F0 feature/x
write_initiative .atomic-skills/initiatives/flat-i.md flat-i active feature/x flat F0 "pending"
run "nested active Plan wins over legacy flat branch match"
out=$(bash "$HOOK")
echo "$out" | grep -q "Active Plan: nested" && ok || no "nested plan should win: $out"
if echo "$out" | grep -q "Active Plan: flat"; then
  no "legacy flat plan should not win when nested active plan exists: $out"
else
  ok
fi
cd - >/dev/null; rm -rf "$TMP"

# Test 13: per-project PROJECT-STATUS.md (no top-level) → injected head.
TMP=$(mktemp -d); cd "$TMP"
init_git_branch main
mkdir -p .atomic-skills/projects/acme/migration/phases
printf "# Project Status Index\n\nper-project-index-line\n" > .atomic-skills/projects/acme/PROJECT-STATUS.md
write_plan .atomic-skills/projects/acme/migration/plan.md migration active F0
run "per-project PROJECT-STATUS.md (no top-level) → injected head"
out=$(bash "$HOOK")
echo "$out" | grep -q "per-project-index-line" && ok || no "expected per-project index head: $out"
cd - >/dev/null; rm -rf "$TMP"

# Test 13b: nested project index wins over legacy top-level index.
TMP=$(mktemp -d); cd "$TMP"
init_git_branch main
mkdir -p .atomic-skills/projects/acme/migration/phases
printf "# Project Status Index\n\nlegacy-top-level-line\n" > .atomic-skills/PROJECT-STATUS.md
printf "# Project Status Index\n\nnested-project-line\n" > .atomic-skills/projects/acme/PROJECT-STATUS.md
write_plan .atomic-skills/projects/acme/migration/plan.md migration active F0
run "nested PROJECT-STATUS.md wins over legacy top-level index"
out=$(bash "$HOOK")
echo "$out" | grep -q "nested-project-line" && ok || no "expected nested project index: $out"
if echo "$out" | grep -q "legacy-top-level-line"; then
  no "legacy top-level index should not win when nested index exists: $out"
else
  ok
fi
cd - >/dev/null; rm -rf "$TMP"

# Test 14: nested standalone (degenerate 1-phase plan) → branch-matched phase.
TMP=$(mktemp -d); cd "$TMP"
init_git_branch hotfix/x
mkdir -p .atomic-skills/projects/acme/hf/phases
write_plan .atomic-skills/projects/acme/hf/plan.md hf active F0
write_initiative .atomic-skills/projects/acme/hf/phases/hf.md hf active hotfix/x hf F0 "pending"
run "nested standalone phase → branch-matched initiative surfaced"
out=$(bash "$HOOK")
echo "$out" | grep -q "Current Initiative: hf" && ok || no "missing nested branch-matched initiative: $out"
cd - >/dev/null; rm -rf "$TMP"

# Test 15: fresh repo with NO commits + active initiative → must NOT hang and
# must still emit (regression for the section-6 `git log` set -e/pipefail bug).
TMP=$(mktemp -d); cd "$TMP"
init_git_branch feature/x   # init only — zero commits
mkdir -p .atomic-skills/projects/acme/migration/phases
write_plan .atomic-skills/projects/acme/migration/plan.md migration active F0
write_initiative .atomic-skills/projects/acme/migration/phases/f0-work.md f0-work active feature/x migration F0 "pending"
run "no-commit repo + active initiative → emits without hanging"
out=$(perl -e 'alarm 20; exec @ARGV' -- bash "$HOOK" 2>/dev/null); rc=$?
[[ "$rc" == "0" ]] && ok || no "hook exited $rc (hang/abort on commit-less repo)"
echo "$out" | grep -q "Current Initiative: f0-work" && ok || no "no initiative emitted on commit-less repo: $out"
cd - >/dev/null; rm -rf "$TMP"

echo ""
echo "RESULT: $PASS passed, $FAIL failed"
[[ "$FAIL" == "0" ]]
