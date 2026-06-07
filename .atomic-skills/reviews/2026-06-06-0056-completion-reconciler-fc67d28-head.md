---
date: 2026-06-06T00:56:31Z
topic: completion-reconciler-fc67d28-head
artifact: fc67d28..HEAD
skill: review-code
reviewer: gpt-5.3-codex
codex_version: codex-cli 0.128.0
final_verdict: needs_changes (all findings fixed in this session)
counts_final: {blocker: 0, critical: 0, major: 4, minor: 1, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 3, minor: 1, nit: 0}
framing_delta: {dropped: 0, maintained: 4, emerged: 1}
schema_version: "1.0"
---

# Cross-Model Review — completion reconciler (fc67d28..HEAD)

Mode: both (local sealed-envelope agent → codex two-pass). Local + codex findings
were disjoint; all were triaged and fixed in this session (see "Fixes applied").

## Local review (sealed-envelope agent) — 5 findings

| # | Severity | File:line | Summary | Disposition |
|---|----------|-----------|---------|-------------|
| L1 | critical | detect-completion.js (output-exists compare) | Lexical ISO compare across `+00:00` vs `Z` | FIXED (isAfter/epoch) |
| L2 | major | detect-completion.js / find-signalless (statSync walk) | Not fail-open: dangling symlink throws | FIXED (isDir + CLI guard) |
| L3 | major | detect-completion.js (commitsSince) | `git --since` inclusive, not strict-after | FIXED (epoch strict filter) |
| L4 | major | detect-completion.js (criterion outputs) | Gate output-exists dead (schema has no outputs) | FIXED (drop crit.outputs + docs) |
| L5 | minor | tests | tz/criterion/fail-open paths untested | FIXED (added regression tests) |

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 3, minor: 1, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The detector misses normal completion cases and can surface drift for the wrong active work item because its path/timestamp resolution and default target selection do not match the hook context. The Stop hook also fails to run the new detector for the nested project layout, which is the layout the new detector and docs otherwise support.

## Findings

### F-001 [major] correctness — scripts/detect-completion.js:168-171

**Evidence:**
```js
  for (const p of paths) {
    if (!existsSync(join(repoRoot, p))) continue;
    const changedAt = lastCommitDateForPath(repoRoot, p) || fsMtimeIso(repoRoot, p);
    if (changedAt && hasText(anchorTs) && changedAt > anchorTs) changedPaths.push(p);
  }
```

**Claim:** A tracked output file that existed before the task anchor and is modified but not committed is not detected as `output-exists`.

**Impact:** In a normal agent turn that edits an existing declared output file and reaches the Stop hook before committing, `lastCommitDateForPath()` returns the old commit date, the newer filesystem mtime is ignored, and the task is not surfaced for reconciliation. This regresses the previous Stop-hook behavior for existing outputs and delays or loses the completion prompt until a later commit happens.

**Recommendation:** Detect dirty/uncommitted paths explicitly, or compare both commit date and filesystem mtime and use the newer timestamp when the working tree path is modified.

**Confidence:** high

---

### F-002 [major] correctness — scripts/detect-completion.js:277-290

**Evidence:**
```js
  // Default: the active initiative of the active plan. Among active plans pick the
  // most-recently-updated (deterministic; mirrors the SessionStart hook), then its
  // currentPhase initiative (status active), else the first active initiative.
  const activePlans = plans.filter((p) => p.planFm.status === 'active');
  const pool = activePlans.length ? activePlans : plans;
  pool.sort((a, b) => String(b.planFm.lastUpdated || '').localeCompare(String(a.planFm.lastUpdated || ''))
    || a.planFile.localeCompare(b.planFile));
  const primary = pool[0];
  const inits = listInitiativesForPlan(primary);
  const activeInits = inits.filter((i) => i.fm.status === 'active');
  const byCurrentPhase = activeInits.find((i) => primary.planFm.currentPhase && i.fm.phaseId === primary.planFm.currentPhase);
  const chosen = byCurrentPhase || activeInits[0] || inits[0];
  if (!chosen) return [];
  return [{ projectId: primary.projectId, initiativePath: chosen.file, fm: chosen.fm, planFm: primary.planFm }];
```

**Claim:** Bare detector calls do not resolve the same active initiative as the hooks when multiple active plans exist and the current branch selects a different plan than the most recently updated one.

**Impact:** SessionStart and Stop can display completion drift for a different project or phase than the initiative they just loaded into context. A user following the prompt can run `reconcile` and be asked to close tasks from unrelated active work.

**Recommendation:** Make hook calls pass the resolved active target to the detector, or add branch-aware/default resolution to `detectCompletion` so it matches the existing SessionStart active-plan selection.

**Confidence:** high

---

### F-003 [major] backward compatibility — skills/shared/project-assets/hooks/stop.sh:73-103

**Evidence:**
```bash
  if [[ -d "$PLANS_DIR" ]]; then
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      [[ "$(get_field "$f" status)" == "active" ]] || continue
      local pbranch
      pbranch=$(get_field "$f" branch)
      if [[ -n "$branch" && -n "$pbranch" && "$pbranch" == "$branch" && -z "$branch_matched" ]]; then
        branch_matched="$f"
      fi
      local mtime
      mtime=$(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f" 2>/dev/null || echo 0)
      if (( mtime > newest_mtime )); then
        newest_mtime=$mtime
        newest="$f"
      fi
    done < <(find "$PLANS_DIR" -maxdepth 1 -type f -name '*.md' ! -name '*.rendered.md' 2>/dev/null)
    active_plan="${branch_matched:-$newest}"
  fi

  if [[ -n "$active_plan" ]]; then
    plan_slug=$(basename "$active_plan" .md)
    current_phase_id=$(get_field "$active_plan" currentPhase)
    if [[ -d "$INITIATIVES_DIR" && -n "$current_phase_id" ]]; then
      while IFS= read -r f; do
        [[ -z "$f" ]] && continue
        [[ "$(get_field "$f" parentPlan)" == "$plan_slug" ]] || continue
        [[ "$(get_field "$f" phaseId)" == "$current_phase_id" ]] || continue
        [[ "$(get_field "$f" status)" == "active" ]] || continue
```

**Claim:** The Stop hook’s active-initiative resolver only scans legacy flat `plans/` and `initiatives/`, so the new completion-drift detector is skipped for nested `projects/<id>/<slug>/` state.

**Impact:** Repositories migrated to the nested layout get no Stop-hook completion drift prompt even when open tasks have changed declared outputs. That makes one of the two required hook integrations ineffective for the primary nested layout.

**Recommendation:** Update `detect_active_initiative()` to mirror SessionStart’s nested-first resolution, or remove this flat-only gate and let `detect-completion.js` resolve nested targets directly.

**Confidence:** high

---

### F-004 [minor] correctness — scripts/detect-completion.js:170-171

**Evidence:**
```js
    const changedAt = lastCommitDateForPath(repoRoot, p) || fsMtimeIso(repoRoot, p);
    if (changedAt && hasText(anchorTs) && changedAt > anchorTs) changedPaths.push(p);
```

**Claim:** Timestamp ordering is done with string comparison even though valid state timestamps may use `Z` or `±HH:MM` offsets.

**Impact:** A valid anchor such as `2026-06-01T00:30:00+02:00` can be chronologically before a `Z` timestamp that sorts lexically earlier, causing missed or spurious drift detection for user-authored or imported state that uses non-UTC offsets.

**Recommendation:** Parse both timestamps to epoch milliseconds and compare numeric times; treat unparsable timestamps as no signal.

**Confidence:** medium

## Questions (non-findings)

- None.

## Out of scope

- JSON schema changes were not reviewed as a proposed modification.
- Reconcile closing behavior was treated as documented procedure, not executable code in this diff.
## Pass 2 (informed)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 4, minor: 1, nit: 0}
reviewer: gpt-5.3-codex
pass: informed
schema_version: "1.0"
---

## Summary
The final risk profile is unchanged for the hook integration issues: the detector can miss normal uncommitted edits, can select a different active plan than the hooks, and the Stop hook still skips nested-layout projects before invoking the detector. The external constraints add one schema-backed correctness issue: exit-gate output detection relies on a field valid state cannot contain.

## Findings

### F-001 [major] correctness — scripts/detect-completion.js:168-171

**Evidence:**
```js
  for (const p of paths) {
    if (!existsSync(join(repoRoot, p))) continue;
    const changedAt = lastCommitDateForPath(repoRoot, p) || fsMtimeIso(repoRoot, p);
    if (changedAt && hasText(anchorTs) && changedAt > anchorTs) changedPaths.push(p);
  }
```

**Claim:** A tracked output file that existed before the task anchor and is modified but not committed is not detected as `output-exists`.

**Impact:** In a normal agent turn that edits an existing declared output file and reaches the Stop hook before committing, `lastCommitDateForPath()` returns the old commit date, the newer filesystem mtime is ignored, and the task is not surfaced for reconciliation.

**Recommendation:** Detect dirty/uncommitted paths explicitly, or compare both commit date and filesystem mtime and use the newer timestamp when the working tree path is modified.

**Confidence:** high

---

### F-002 [major] correctness — scripts/detect-completion.js:277-290

**Evidence:**
```js
  // Default: the active initiative of the active plan. Among active plans pick the
  // most-recently-updated (deterministic; mirrors the SessionStart hook), then its
  // currentPhase initiative (status active), else the first active initiative.
  const activePlans = plans.filter((p) => p.planFm.status === 'active');
  const pool = activePlans.length ? activePlans : plans;
  pool.sort((a, b) => String(b.planFm.lastUpdated || '').localeCompare(String(a.planFm.lastUpdated || ''))
    || a.planFile.localeCompare(b.planFile));
  const primary = pool[0];
  const inits = listInitiativesForPlan(primary);
  const activeInits = inits.filter((i) => i.fm.status === 'active');
  const byCurrentPhase = activeInits.find((i) => primary.planFm.currentPhase && i.fm.phaseId === primary.planFm.currentPhase);
  const chosen = byCurrentPhase || activeInits[0] || inits[0];
  if (!chosen) return [];
  return [{ projectId: primary.projectId, initiativePath: chosen.file, fm: chosen.fm, planFm: primary.planFm }];
```

**Claim:** Bare detector calls do not resolve the same active initiative as the hooks when multiple active plans exist and the current branch selects a different plan than the most recently updated one.

**Impact:** SessionStart and Stop can display completion drift for a different project or phase than the initiative they just loaded into context. A user following the prompt can run `reconcile` and be asked to close tasks from unrelated active work.

**Recommendation:** Make hook calls pass the resolved active target to the detector, or add branch-aware/default resolution to `detectCompletion` so it matches the existing hook active-plan selection.

**Confidence:** high

---

### F-003 [major] backward compatibility — skills/shared/project-assets/hooks/stop.sh:73-103

**Evidence:**
```bash
  if [[ -d "$PLANS_DIR" ]]; then
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      [[ "$(get_field "$f" status)" == "active" ]] || continue
      local pbranch
      pbranch=$(get_field "$f" branch)
      if [[ -n "$branch" && -n "$pbranch" && "$pbranch" == "$branch" && -z "$branch_matched" ]]; then
        branch_matched="$f"
      fi
      local mtime
      mtime=$(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f" 2>/dev/null || echo 0)
      if (( mtime > newest_mtime )); then
        newest_mtime=$mtime
        newest="$f"
      fi
    done < <(find "$PLANS_DIR" -maxdepth 1 -type f -name '*.md' ! -name '*.rendered.md' 2>/dev/null)
    active_plan="${branch_matched:-$newest}"
  fi

  if [[ -n "$active_plan" ]]; then
    plan_slug=$(basename "$active_plan" .md)
    current_phase_id=$(get_field "$active_plan" currentPhase)
    if [[ -d "$INITIATIVES_DIR" && -n "$current_phase_id" ]]; then
      while IFS= read -r f; do
        [[ -z "$f" ]] && continue
        [[ "$(get_field "$f" parentPlan)" == "$plan_slug" ]] || continue
        [[ "$(get_field "$f" phaseId)" == "$current_phase_id" ]] || continue
        [[ "$(get_field "$f" status)" == "active" ]] || continue
```

**Claim:** The Stop hook’s active-initiative resolver only scans legacy flat `plans/` and `initiatives/`, so the new completion-drift detector is skipped for nested `projects/<id>/<slug>/` state.

**Impact:** Repositories using the nested layout get no Stop-hook completion drift prompt even when open tasks have changed declared outputs, making one of the two required hook integrations ineffective for that layout.

**Recommendation:** Update `detect_active_initiative()` to mirror SessionStart’s nested-first resolution, or remove this flat-only gate and let `detect-completion.js` resolve nested targets directly.

**Confidence:** high

---

### F-004 [major] correctness — scripts/detect-completion.js:323-328

**Evidence:**
```js
  for (const crit of Array.isArray(fm.exitGates) ? fm.exitGates : []) {
    if (!crit || typeof crit !== 'object') continue;
    if (crit.status !== 'pending') continue; // met / deferred are resolved
    const sig = classifyEntry({ id: crit.id, anchorTs: initAnchor, outputs: crit.outputs, repoRoot });
    if (sig.evidence === 'none') continue;
```

**Claim:** `output-exists` detection for exit criteria is unreachable for valid state because `exitCriterion` has no schema-supported `outputs` property.

**Impact:** Pending gates that are satisfied by changed deliverables cannot be detected through the advertised structured-output path unless the state becomes schema-invalid; they only surface if a later commit subject names the exact criterion id.

**Recommendation:** Stop relying on `crit.outputs` for gates unless schema support is added; otherwise document and implement gate detection as commit-id or verifier/manual-only.

**Confidence:** high

---

### F-005 [minor] correctness — scripts/detect-completion.js:170-171

**Evidence:**
```js
    const changedAt = lastCommitDateForPath(repoRoot, p) || fsMtimeIso(repoRoot, p);
    if (changedAt && hasText(anchorTs) && changedAt > anchorTs) changedPaths.push(p);
```

**Claim:** Timestamp ordering is done with string comparison even though git `%cI` emits numeric timezone offsets and state timestamps may use `Z` or other offsets.

**Impact:** A valid anchor and commit timestamp that use different offsets can compare in the wrong chronological order, causing spurious or missed `output-exists` drift detection.

**Recommendation:** Parse both timestamps to epoch milliseconds and compare numeric times; treat unparsable timestamps as no signal.

**Confidence:** medium

## Questions (non-findings)

- None.

## Out of scope

- JSON schema files themselves were not reviewed as modified artifacts.
- Reconcile closing behavior was treated as documented procedure, not executable code in this diff.
- The shell hooks’ required fail-open behavior was not challenged as a blocking failure mode.

## Pass 2 reconciliation

### Dropped from blind pass

- _(none)_

### Maintained

- F-001-blind → F-001-final [major] — same
- F-002-blind → F-002-final [major] — same
- F-003-blind → F-003-final [major] — same
- F-004-blind → F-005-final [minor] — same

### Emerged

- F-004-final [major] correctness — emerged: the external constraint that `exitCriterion` rejects `outputs` makes the detector’s `crit.outputs` path invalid for schema-valid gates.
## Fixes applied in this session

All local (L1–L5) and codex (F-001…F-005) findings were fixed before commit.
Codex F-004 == local L4 (criterion outputs); codex F-005 == local L1 (timezone).
Three codex findings were disjoint from the local pass:

- **F-001 (major)** detect-completion.js — output-exists ignored an existing
  tracked output edited-but-not-committed (`lastCommitDateForPath || fsMtimeIso`
  short-circuited to the stale commit date). FIX: count a path as changed if its
  last commit is after the anchor (epoch) OR it is git-dirty now (`pathIsDirty`
  via `git status --porcelain`); removed `fsMtimeIso` (mtime is reset on a fresh
  clone → would false-positive every path). Regression test added.
- **F-002 (major)** detect-completion.js — bare default resolution picked the
  most-recently-updated active plan, which can differ from the branch-matched
  plan the hooks loaded. FIX: branch-aware default — prefer the active plan whose
  `branch` matches the current git branch (`currentBranch`), fall back to newest;
  `detectCompletion` resolves the branch and threads it to `resolveTargets`.
  Regression test added.
- **F-003 (major)** stop.sh — the completion-drift block sat after
  `active=$(detect_active_initiative)` + `[[ -z "$active" ]] && exit 0`, and
  `detect_active_initiative` scans ONLY the flat layout → the block never ran for
  the nested `projects/` layout. FIX: moved the block before that resolution and
  dropped its `$active` dependency (the detector self-resolves nested-first +
  branch-aware); `active` is now resolved only for the scope-drift check below.

Verification: `node --test` detector suite 11/11 + signalless 2/2 green;
`npm run test:hooks` 31/29/66/5 green; `npm run validate-skills` green; full
suite 782/793 (the 3 failures are pre-existing: dashboard bundle not built).
