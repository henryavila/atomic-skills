#!/usr/bin/env bash
# Tests for .husky/pre-commit (T9 — codex F-001 follow-up)
# Verifies:
#   1. Staging a catalog input regenerates docs and auto-stages outputs
#   2. F-001 guard: if outputs have unstaged changes, hook ABORTS (exit 1)
#   3. Staging an unrelated file is a no-op
set -euo pipefail

REPO_ROOT="$(pwd)"
HOOK="$REPO_ROOT/.husky/pre-commit"
PASS=0; FAIL=0

run() { echo "TEST: $1"; }
ok()  { PASS=$((PASS+1)); echo "  PASS"; }
no()  { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }

# Each test runs in a tmpdir copy of the repo so we don't mutate real state.
# We copy only what the hook needs: .husky/, .git/ (init fresh), package.json,
# scripts/, meta/, skills/, src/dashboard/data/, README.md, and src/config.js.
mk_tmp_repo() {
  local tmp
  tmp=$(mktemp -d -t pre-commit-test-XXXXXX)
  (
    cd "$tmp"
    git init -q
    git config user.email "test@local"
    git config user.name "Test"
    git config commit.gpgsign false
  )
  # Copy the essentials. node_modules is symlinked (large; read-only).
  for d in .husky scripts meta skills src bin package.json package-lock.json README.md CHANGELOG.md; do
    if [[ -e "$REPO_ROOT/$d" ]]; then
      cp -R "$REPO_ROOT/$d" "$tmp/"
    fi
  done
  ln -s "$REPO_ROOT/node_modules" "$tmp/node_modules"
  (
    cd "$tmp"
    git add -A >/dev/null
    git commit -qm "baseline" || true
  )
  echo "$tmp"
}

# ─── Test 1: catalog input change triggers regen + auto-stage ───
run "stage meta/catalog.yaml → hook regenerates + auto-stages README + skills.generated.ts"
tmp=$(mk_tmp_repo)
(
  cd "$tmp"
  # Mutate a one_liner to force a measurable regen
  sed -i.bak "s/Diagnose root cause → write test → fix → verify/TEST DRIFT/" meta/catalog.yaml
  rm meta/catalog.yaml.bak
  git add meta/catalog.yaml
  # Capture pre-hook README content
  README_BEFORE=$(grep "fix.*Diagnose root cause\|fix.*TEST DRIFT" README.md | head -1 || true)
  # Run the hook
  if sh .husky/pre-commit >/tmp/hook-out-1.log 2>&1; then
    # After hook: README should be regenerated with TEST DRIFT
    if grep -q "TEST DRIFT" README.md; then
      # Staged files should include README.md
      if git diff --cached --name-only | grep -q "^README.md$"; then
        echo "  ok"
        exit 0
      else
        echo "  README.md not auto-staged"
        exit 1
      fi
    else
      echo "  README not regenerated. Hook log:"
      cat /tmp/hook-out-1.log
      exit 1
    fi
  else
    echo "  hook exited non-zero (expected success). Log:"
    cat /tmp/hook-out-1.log
    exit 1
  fi
) && ok || no "Test 1 failed"
rm -rf "$tmp"

# ─── Test 2: F-001 guard fires on unstaged README edit ───
run "stage catalog input WITH unstaged README → hook aborts with exit 1"
tmp=$(mk_tmp_repo)
(
  cd "$tmp"
  # Unstaged README edit
  echo "" >> README.md
  # Staged catalog input
  echo "# noop comment" >> meta/catalog.yaml
  git add meta/catalog.yaml
  # Run the hook — expect exit 1
  if sh .husky/pre-commit >/tmp/hook-out-2.log 2>&1; then
    echo "  hook returned 0 but should have aborted. Log:"
    cat /tmp/hook-out-2.log
    exit 1
  fi
  # Verify the abort message
  if grep -q "aborting: regenerator outputs have unstaged changes" /tmp/hook-out-2.log; then
    exit 0
  else
    echo "  expected F-001 guard message. Got:"
    cat /tmp/hook-out-2.log
    exit 1
  fi
) && ok || no "Test 2 failed"
rm -rf "$tmp"

# ─── Test 3: unrelated file change is no-op (no regen, no validate) ───
run "stage unrelated file → hook is no-op (no regen logs)"
tmp=$(mk_tmp_repo)
(
  cd "$tmp"
  mkdir -p docs
  echo "unrelated doc" > docs/random.md
  git add docs/random.md
  if sh .husky/pre-commit >/tmp/hook-out-3.log 2>&1; then
    # No regen line should appear
    if grep -q "regenerating docs" /tmp/hook-out-3.log; then
      echo "  hook regenerated despite no catalog change. Log:"
      cat /tmp/hook-out-3.log
      exit 1
    fi
    # No validate-catalog should run either (no COUPLED_REGEX match)
    if grep -q "validate-catalog" /tmp/hook-out-3.log; then
      echo "  hook ran validate-catalog on unrelated change. Log:"
      cat /tmp/hook-out-3.log
      exit 1
    fi
    exit 0
  else
    echo "  hook failed on unrelated file. Log:"
    cat /tmp/hook-out-3.log
    exit 1
  fi
) && ok || no "Test 3 failed"
rm -rf "$tmp"

# ─── Test 4: worktree commit triggers regen via real git commit ───
run "git commit in worktree with catalog input → hook regenerates README"
BRANCH="pre-commit-test-wt-$$"
git branch "$BRANCH" HEAD 2>/dev/null
WDIR=$(mktemp -d -t wt-hook-XXXXXX)
git worktree add "$WDIR" "$BRANCH" -q 2>/dev/null
(
  cd "$WDIR"
  ln -s "$REPO_ROOT/node_modules" "$WDIR/node_modules" 2>/dev/null || true
  git config user.email "test@local"
  git config user.name "Test"
  git config commit.gpgsign false
  sed -i.bak "s/Diagnose root cause → write test → fix → verify/WORKTREE DRIFT/" meta/catalog.yaml
  rm meta/catalog.yaml.bak
  git add meta/catalog.yaml
  if git commit -m "test: worktree hook" >/tmp/hook-out-4.log 2>&1; then
    if grep -q "WORKTREE DRIFT" README.md; then
      if git diff-tree --no-commit-id --name-only -r HEAD | grep -q "^README.md$"; then
        exit 0
      else
        echo "  README.md not in commit"
        exit 1
      fi
    else
      echo "  README not regenerated in worktree. Log:"
      cat /tmp/hook-out-4.log
      exit 1
    fi
  else
    echo "  commit failed. Log:"
    cat /tmp/hook-out-4.log
    exit 1
  fi
) && ok || no "Test 4 failed (worktree)"
git worktree remove "$WDIR" --force 2>/dev/null || true
git branch -D "$BRANCH" 2>/dev/null || true

# ─── Test 5: HUSKY=0 disables hook ───
run "HUSKY=0 skips hook (no regen even with catalog input staged)"
tmp=$(mk_tmp_repo)
(
  cd "$tmp"
  sed -i.bak "s/Diagnose root cause → write test → fix → verify/HUSKY0 DRIFT/" meta/catalog.yaml
  rm meta/catalog.yaml.bak
  git add meta/catalog.yaml
  if HUSKY=0 sh .husky/pre-commit >/tmp/hook-out-5.log 2>&1; then
    if grep -q "HUSKY0 DRIFT" README.md; then
      echo "  README was regenerated despite HUSKY=0"
      exit 1
    fi
    exit 0
  else
    echo "  hook exited non-zero with HUSKY=0. Log:"
    cat /tmp/hook-out-5.log
    exit 1
  fi
) && ok || no "Test 5 failed"
rm -rf "$tmp"

# ─── Summary ───
echo ""
echo "pre-commit.test.sh: $PASS passed, $FAIL failed"
exit $FAIL
