#!/usr/bin/env bash
# Tests for .husky/pre-commit.
#
# The hook only checks; it never regenerates, stages or commits. It must:
#   1. refuse a commit whose staged catalog input left generated docs stale,
#      naming `npm run generate-docs` as the next step;
#   2. accept a commit whose generated docs are fresh;
#   3. skip the docs check when no catalog input is staged;
#   4. honour HUSKY=0;
#   5. leave the index and the working tree exactly as it found them;
#   6. not stage an unstaged hand-written edit to a generated output.
set -euo pipefail

# A caller's HUSKY=0 must not leak into the hook invocations under test; only
# the explicit HUSKY=0 in Test 4 may bypass the hook.
unset HUSKY

REPO_ROOT="$(pwd)"
HOOK="$REPO_ROOT/.husky/pre-commit"
PASS=0
FAIL=0

run() { echo "TEST: $1"; }
ok() { PASS=$((PASS + 1)); echo "  PASS"; }
no() { FAIL=$((FAIL + 1)); echo "  FAIL: $1"; }

# Index + working tree snapshot used to prove the hook is side-effect free.
snapshot() {
  local dir=$1
  (
    cd "$dir"
    git status --porcelain
    git diff --cached --stat
  )
}

# Each test runs in a tmpdir copy of the repo so we don't mutate real state.
# We copy only what the hook needs: .husky/, .git/ (init fresh), package.json,
# scripts/, meta/, skills/, src/, site/, docs/, qa/ (without the Python venv),
# README.md and CHANGELOG.md. node_modules is symlinked (large; read-only).
mk_tmp_repo() {
  local tmp d entry
  tmp=$(mktemp -d -t pre-commit-test-XXXXXX)
  for d in .husky scripts meta skills src bin site docs package.json \
    package-lock.json README.md CHANGELOG.md .gitignore; do
    if [[ -e "$REPO_ROOT/$d" ]]; then
      cp -R "$REPO_ROOT/$d" "$tmp/"
    fi
  done
  mkdir -p "$tmp/qa"
  for entry in "$REPO_ROOT"/qa/*; do
    cp -R "$entry" "$tmp/qa/"
  done
  ln -s "$REPO_ROOT/node_modules" "$tmp/node_modules"
  (
    cd "$tmp"
    git init -q
    git config user.email "test@local"
    git config user.name "Test"
    git config commit.gpgsign false
    git config core.hooksPath .husky
    git add -A
    # Bypass the hook for the baseline commit: the test copy has no venv, and
    # the point of the tests is the hook invocation, not the baseline.
    HUSKY=0 git commit -qm "baseline"
  )
  echo "$tmp"
}

# ─── Test 1: stale docs + staged catalog input → hook refuses ───
run "stage catalog input leaving docs stale → hook refuses and names generate-docs"
tmp=$(mk_tmp_repo)
log=$(mktemp -t precommit-stale-XXXXXX)
if (
  cd "$tmp"
  sed -i.bak "s/Diagnose root cause → write test → fix → verify/STALE DOCS DRIFT/" meta/catalog.yaml
  rm meta/catalog.yaml.bak
  git add meta/catalog.yaml
  before=$(snapshot "$tmp")
  if sh "$HOOK" >"$log" 2>&1; then
    echo "  hook accepted stale generated docs"
    cat "$log"
    exit 1
  fi
  if ! grep -q "npm run generate-docs" "$log"; then
    echo "  refusal does not name 'npm run generate-docs'. Got:"
    cat "$log"
    exit 1
  fi
  if grep -q "STALE DOCS DRIFT" README.md; then
    echo "  hook rewrote README.md instead of only checking"
    exit 1
  fi
  after=$(snapshot "$tmp")
  if [[ "$before" != "$after" ]]; then
    echo "  hook changed the index or working tree"
    diff <(printf '%s\n' "$before") <(printf '%s\n' "$after") || true
    exit 1
  fi
); then
  ok
else
  no "Test 1 failed"
fi
rm -f "$log"
rm -rf "$tmp"

# ─── Test 2: fresh generated docs + staged catalog input → hook accepts ───
run "stage catalog input with fresh docs → hook accepts and changes nothing"
tmp=$(mk_tmp_repo)
log=$(mktemp -t precommit-fresh-XXXXXX)
if (
  cd "$tmp"
  sed -i.bak "s/Diagnose root cause → write test → fix → verify/FRESH DOCS DRIFT/" meta/catalog.yaml
  rm meta/catalog.yaml.bak
  npm run generate-docs >"$log" 2>&1
  git add -A
  before=$(snapshot "$tmp")
  if ! sh "$HOOK" >>"$log" 2>&1; then
    echo "  hook rejected fresh generated docs"
    cat "$log"
    exit 1
  fi
  after=$(snapshot "$tmp")
  if [[ "$before" != "$after" ]]; then
    echo "  hook changed the index or working tree"
    diff <(printf '%s\n' "$before") <(printf '%s\n' "$after") || true
    exit 1
  fi
); then
  ok
else
  no "Test 2 failed"
fi
rm -f "$log"
rm -rf "$tmp"

# ─── Test 3: no catalog input staged → no docs check ───
run "stage an unrelated file → hook skips the docs check"
tmp=$(mk_tmp_repo)
log=$(mktemp -t precommit-unrelated-XXXXXX)
if (
  cd "$tmp"
  # Make the generated docs stale in the worktree, but do not stage the cause.
  sed -i.bak "s/Diagnose root cause → write test → fix → verify/UNSTAGED DRIFT/" meta/catalog.yaml
  rm meta/catalog.yaml.bak
  echo "unrelated doc" >docs/random.md
  git add docs/random.md
  before=$(snapshot "$tmp")
  if ! sh "$HOOK" >"$log" 2>&1; then
    echo "  hook rejected an unrelated change"
    cat "$log"
    exit 1
  fi
  if grep -q "check-docs" "$log"; then
    echo "  hook ran the docs check without a staged catalog input. Log:"
    cat "$log"
    exit 1
  fi
  after=$(snapshot "$tmp")
  if [[ "$before" != "$after" ]]; then
    echo "  hook changed the index or working tree"
    diff <(printf '%s\n' "$before") <(printf '%s\n' "$after") || true
    exit 1
  fi
); then
  ok
else
  no "Test 3 failed"
fi
rm -f "$log"
rm -rf "$tmp"

# ─── Test 4: HUSKY=0 escapes the hook ───
run "HUSKY=0 skips the hook even with a stale catalog input staged"
tmp=$(mk_tmp_repo)
log=$(mktemp -t precommit-husky0-XXXXXX)
if (
  cd "$tmp"
  sed -i.bak "s/Diagnose root cause → write test → fix → verify/HUSKY0 DRIFT/" meta/catalog.yaml
  rm meta/catalog.yaml.bak
  git add meta/catalog.yaml
  before=$(snapshot "$tmp")
  if ! HUSKY=0 sh "$HOOK" >"$log" 2>&1; then
    echo "  hook exited non-zero with HUSKY=0"
    cat "$log"
    exit 1
  fi
  if grep -q "check-docs" "$log"; then
    echo "  hook ran the docs check despite HUSKY=0. Log:"
    cat "$log"
    exit 1
  fi
  after=$(snapshot "$tmp")
  if [[ "$before" != "$after" ]]; then
    echo "  hook changed the index or working tree"
    diff <(printf '%s\n' "$before") <(printf '%s\n' "$after") || true
    exit 1
  fi
); then
  ok
else
  no "Test 4 failed"
fi
rm -f "$log"
rm -rf "$tmp"

# ─── Test 5: a real git commit is refused on stale docs ───
run "git commit with stale generated docs → commit refused, HEAD unchanged"
tmp=$(mk_tmp_repo)
log=$(mktemp -t precommit-commit-XXXXXX)
if (
  cd "$tmp"
  sed -i.bak "s/Diagnose root cause → write test → fix → verify/COMMIT DRIFT/" meta/catalog.yaml
  rm meta/catalog.yaml.bak
  git add meta/catalog.yaml
  before=$(snapshot "$tmp")
  head_before=$(git rev-parse HEAD)
  if git commit -m "test: stale docs" >"$log" 2>&1; then
    echo "  git commit accepted stale generated docs"
    cat "$log"
    exit 1
  fi
  if ! grep -q "npm run generate-docs" "$log"; then
    echo "  refusal does not name 'npm run generate-docs'. Got:"
    cat "$log"
    exit 1
  fi
  head_after=$(git rev-parse HEAD)
  if [[ "$head_before" != "$head_after" ]]; then
    echo "  HEAD moved despite the refusal"
    exit 1
  fi
  after=$(snapshot "$tmp")
  if [[ "$before" != "$after" ]]; then
    echo "  refused commit changed the index or working tree"
    diff <(printf '%s\n' "$before") <(printf '%s\n' "$after") || true
    exit 1
  fi
); then
  ok
else
  no "Test 5 failed"
fi
rm -f "$log"
rm -rf "$tmp"

# ─── Test 6: fresh staged outputs + unstaged hand-written README edit ───
run "unstaged hand-written README edit → hook accepts and leaves the edit unstaged"
tmp=$(mk_tmp_repo)
log=$(mktemp -t precommit-readme-edit-XXXXXX)
if (
  cd "$tmp"
  sed -i.bak "s/Diagnose root cause → write test → fix → verify/README EDIT DRIFT/" meta/catalog.yaml
  rm meta/catalog.yaml.bak
  npm run generate-docs >"$log" 2>&1
  git add -A
  # A hand-written edit outside the generated markers must survive the hook
  # unstaged: a hook that runs `git add README.md` would sweep it into the
  # commit alongside the freshly generated outputs.
  printf '\nHand-written note for the commit hook test.\n' >>README.md
  staged_before=$(git diff --cached -- README.md)
  unstaged_before=$(git diff -- README.md)
  if [[ -z "$unstaged_before" ]]; then
    echo "  setup did not leave an unstaged README edit"
    exit 1
  fi
  before=$(snapshot "$tmp")
  if ! sh "$HOOK" >>"$log" 2>&1; then
    echo "  hook rejected fresh generated docs with an unstaged README edit"
    cat "$log"
    exit 1
  fi
  staged_after=$(git diff --cached -- README.md)
  unstaged_after=$(git diff -- README.md)
  if [[ "$staged_before" != "$staged_after" ]]; then
    echo "  hook changed the staged README"
    exit 1
  fi
  if [[ "$unstaged_before" != "$unstaged_after" ]]; then
    echo "  hook changed the unstaged README edit"
    exit 1
  fi
  after=$(snapshot "$tmp")
  if [[ "$before" != "$after" ]]; then
    echo "  hook changed the index or working tree"
    diff <(printf '%s\n' "$before") <(printf '%s\n' "$after") || true
    exit 1
  fi
); then
  ok
else
  no "Test 6 failed"
fi
rm -f "$log"
rm -rf "$tmp"

# ─── Summary ───
echo ""
echo "pre-commit.test.sh: $PASS passed, $FAIL failed"
exit "$FAIL"
