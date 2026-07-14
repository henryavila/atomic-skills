---
date: 2026-07-14T14:32:17-03:00
topic: integrity-remediation-f0-phase-859598f-r15
artifact: b2a845a5d7e832c88622cb21c89aff6ee33927e1..859598f01d4b3c3481cfcf4bacb649fa83532a5b
skill: review-code
reviewer: gpt-5-codex
codex_version: 0.144.3
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 5, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 3, minor: 0, nit: 0}
framing_delta: {dropped: 0, maintained: 3, emerged: 2}
triage_remaining: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
schema_version: "1.0"
---

# Cross-Model Review — integrity-remediation F0 phase 859598f r15

## Capture manifest

- Ref: b2a845a5d7e832c88622cb21c89aff6ee33927e1..859598f01d4b3c3481cfcf4bacb649fa83532a5b
- Captured diff: 5,428,527 bytes / 117,195 lines / 89 files
- SHA-256: 89a9252b5438ee83d1a1571012f47f4be9fee9a2c2a87c3041d82de3ca2cbc53
- Patch id: affc91599e94399be113b5eb07acfd44031e6d25
- Raw Pass 1 SHA-256: 58d3853761656b6bcb35adf39c210103be34cfd80fea501843852742f975a86d
- Raw Pass 2 SHA-256: f6fe86055f0eaa387958e1f1bbefa2444441097d67c78dc385039615ddd026b2
- Mode: codex; model override: codex-auto-review; reasoning: high; sandbox: read-only
- Worktree was clean before capture and remained read-only during both passes.

## Structural validation

- Pass 1: frontmatter, verdict, counts, pass id, three findings and mandatory fields validated.
- Pass 2: frontmatter, verdict, counts, reconciliation headers and five final findings validated.
- Reconciliation: all three blind findings maintained and two findings emerged from the disclosed contracts.

## Operator scope triage

- Final F-001/F-002 major — validated and fixed. `project-verify.md` now reuses the router-validated `PKG_ROOT` for both the normalizer and review-receipt checker.
- Final F-003 major — validated and fixed. The consumer-runtime test now rejects every executable `$ROOT/` reference and requires both installed paths.
- Final F-004/F-005 major — validated and fixed. Both `new plan` and `adopt` build an optional Bash argument array from `git rev-parse HEAD`; outside Git the empty array omits the complete option pair.
- Delegated decisions: repair the entire repeated recipe instead of treating the placeholders as prose; retain the timestamp fallback outside Git; execute both documented materialization blocks from a marker-backed consumer as the regression boundary.
- Remaining substantive count after remediation at `6b2c020`: zero blocker, zero critical, zero major, zero minor. A fresh clean-checkpoint review remains required for phase approval.

## Remediation evidence

- RED: the focused consumer-runtime suite collected seven tests, with five passing and the two new/updated regressions failing before the skill fixes.
- GREEN: the same focused suite passed 7/7 after remediation.
- Integrated runtime/render/parity set: 97/97 tests passed across consumer resolution, project rendering, runtime closure, and install/uninstall parity.
- Diff check was clean before the remediation commit.

## Pass 1 output

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 3, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The installed-runtime hardening is incomplete in `project-verify.md`. Two verify subflows now invoke `"$ROOT/..."` even though the router establishes `PKG_ROOT`, so the documented commands resolve to `/src/...` and `/scripts/...` at runtime instead of the installed package. That breaks both `verify --fix` and the plan-review-receipt backstop.

The test surface does not catch this regression. One of the new consumer-runtime tests explicitly expects the broken `$ROOT/src/normalize.js` string, so CI will continue to pass while the `verify` flow remains unusable.

## Findings

### F-001 [major] correctness — skills/shared/project-assets/project-verify.md:48

**Evidence:**
```md
- Every check below runs `node "$PKG_ROOT/scripts/<x>.js"`. The project router resolves and validates this exact package root before loading this asset; reuse it without another fallback.
- **FAIL:** print the validator's errors verbatim. If `--fix` was passed, first run `node "$ROOT/src/normalize.js" .atomic-skills/`, using the package root already validated by check 0, then re-run `validate-state`.
```

**Claim:** The `verify --fix` path calls `src/normalize.js` through an undefined `$ROOT` variable instead of the validated `$PKG_ROOT`.

**Impact:** In a normal shell this expands to `node "/src/normalize.js" .atomic-skills/`, so the documented safe-normalization path cannot run and `project verify --fix` fails precisely when schema drift needs repair.

**Recommendation:** Replace `$ROOT` with `$PKG_ROOT` here and add a contract test that validates the rendered `verify --fix` command string.

**Confidence:** high

---

### F-002 [major] correctness — skills/shared/project-assets/project-verify.md:115

**Evidence:**
```md
### 10. Plan review receipt (read-only; creation-gate backstop)
Run `node "$ROOT/scripts/find-unreviewed-plans.js" .atomic-skills` (deterministic, zero-token, using the package root already validated by check 0).
```

**Claim:** The plan-review-receipt check is wired to the same undefined `$ROOT` variable, so the check-10 command is not runnable as written.

**Impact:** The `verify` flow cannot execute its review-receipt audit, which removes the documented backstop for plans missing `## Reviews` / `- internal:` receipts and lets reviewless plans evade this coherence pass.

**Recommendation:** Change the command to `node "$PKG_ROOT/scripts/find-unreviewed-plans.js" .atomic-skills` and cover this exact command in the runtime-resolution tests.

**Confidence:** high

---

### F-003 [major] missing behavioral test — tests/consumer-runtime-resolution.test.js:216-217

**Evidence:**
```js
assert.doesNotMatch(verify, /same 3-path way/)
assert.match(verify, /\$ROOT\/src\/normalize\.js/)
```

**Claim:** The new consumer-runtime test suite hard-codes the broken `$ROOT/src/normalize.js` string as the expected behavior.

**Impact:** CI will keep approving the invalid `verify` runtime contract, so fixing the skill text later will require changing the test and the current suite gives false confidence that the installed-runtime migration is correct.

**Recommendation:** Flip this assertion to require `\$PKG_ROOT\/src\/normalize\.js` and add a sibling assertion for the `find-unreviewed-plans.js` command so both broken `project-verify` call sites are covered.

**Confidence:** high

## Questions (non-findings)

## Out of scope

- Archived review transcript content under `.atomic-skills/reviews/`

## Pass 2 output

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 5, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
The blind-pass runtime findings remain valid against the disclosed constraints: `project-verify.md` still routes two executable checks through an undefined `$ROOT` variable even though the contract requires the already-validated `PKG_ROOT`, and the consumer-runtime test suite still encodes one of those broken command strings as expected behavior.

The constraints also expose a second contract break in `project-create-plan.md`. Both the default `new plan` flow and the `adopt` flow explicitly say `--started-commit` must be omitted outside a git repository, but the executable shell blocks still pass that flag unconditionally. Because `decompose-plan` validates `startedCommit` as a hex SHA, these documented commands fail in the exact non-git fallback path the contract says should remain supported.

## Findings

### F-001 [major] correctness — skills/shared/project-assets/project-verify.md:48

**Evidence:**
```md
- **FAIL:** print the validator's errors verbatim. If `--fix` was passed, first run `node "$ROOT/src/normalize.js" .atomic-skills/`, using the package root already validated by check 0, then re-run `validate-state`. Report what normalization changed. If files still fail after normalization, the failure is structural (not drift) — report it and recommend `migrate <slug>` for legacy files or manual repair.
```

**Claim:** The `verify --fix` path invokes the normalizer through `$ROOT`, but this asset's runtime contract only establishes `PKG_ROOT`, so the documented repair command is not resolvable from an installed consumer runtime.

**Impact:** `project verify --fix` fails instead of running the deterministic normalizer when schema repair is needed, breaking the safe-remediation path the check is supposed to provide.

**Recommendation:** Replace `$ROOT` with `$PKG_ROOT` in this command and add a rendered-skill contract test that executes the `verify --fix` command string from a consumer repo.

**Confidence:** high

---

### F-002 [major] correctness — skills/shared/project-assets/project-verify.md:115

**Evidence:**
```md
Run `node "$ROOT/scripts/find-unreviewed-plans.js" .atomic-skills` (deterministic, zero-token, using the package root already validated by check 0). It reports every non-archived materialized plan whose body lacks a `## Reviews` section carrying a `- internal:` line — i.e. the mandatory adversarial review (project-create-plan.md Stage 8a) either never ran or left no receipt.
```

**Claim:** The plan-review-receipt check is wired to the same undefined `$ROOT` variable, so check 10 cannot run from the installed package root the router validated.

**Impact:** The `verify` flow loses its deterministic backstop for missing internal-review receipts, so plans created without the Stage 8 receipt can evade this coherence pass.

**Recommendation:** Change this command to `node "$PKG_ROOT/scripts/find-unreviewed-plans.js" .atomic-skills` and cover the exact rendered command in the runtime-resolution tests.

**Confidence:** high

---

### F-003 [major] missing behavioral test — tests/consumer-runtime-resolution.test.js:212-217

**Evidence:**
```js
assert.doesNotMatch(createPlan, /\$PWD\/src\/normalize\.js/)
assert.match(createPlan, /\$PKG_ROOT\/src\/normalize\.js/)
assert.match(createPlan, /--started-commit/)
assert.match(createPlan, /rev-parse HEAD/)
assert.doesNotMatch(verify, /same 3-path way/)
assert.match(verify, /\$ROOT\/src\/normalize\.js/)
```

**Claim:** The consumer-runtime regression test suite codifies the broken `project-verify` command string as the expected contract.

**Impact:** CI stays green while the installed-runtime `verify --fix` path is still broken, so future changes can continue shipping an unusable repair flow with false confidence from the dedicated runtime-resolution suite.

**Recommendation:** Flip the `verify` expectation to `$PKG_ROOT`, and add a sibling assertion for the `find-unreviewed-plans.js` command so both `project-verify` runtime call sites are covered.

**Confidence:** high

---

### F-004 [major] correctness — skills/shared/project-assets/project-create-plan.md:166-193

**Evidence:**
```md
Immediately before materialization, resolve the immutable phase-start anchor with
`{{BASH_TOOL}} git rev-parse HEAD`. When it succeeds, pass the returned SHA as
`--started-commit`; outside a git repository, omit that option pair silently and
retain the legacy timestamp fallback.

```bash
BUSINESS_INTENT_FILE="<exact-path-printed-above>"
STATUS=0
node "$PKG_ROOT/scripts/decompose-plan.js" materialize \
  --source '<source.md>' \
  --slug '<slug>' \
  --project-id '<project-id>' \
  --branch 'plan/<slug>' \
  --started-commit '<started-commit>' \
  --business-intent-file "$BUSINESS_INTENT_FILE" || STATUS=$?
rm -f "$BUSINESS_INTENT_FILE"
if [ "$STATUS" -ne 0 ]; then exit "$STATUS"; fi
```
```

**Claim:** The documented `new plan` materialization block unconditionally passes `--started-commit` even though the surrounding contract requires omitting that option outside a git repository.

**Impact:** In a non-git consumer checkout, following this executable recipe reaches `normalizeStartedCommit` with a non-SHA placeholder or empty value and aborts plan creation instead of falling back to the legacy timestamp path.

**Recommendation:** Make the shell block conditionally append the `--started-commit` pair only when `git rev-parse HEAD` succeeds, and add a rendered-skill test that exercises the non-git path.

**Confidence:** high

---

### F-005 [major] correctness — skills/shared/project-assets/project-create-plan.md:442-468

**Evidence:**
```md
Immediately before the transform, resolve the immutable F0 start anchor with
`{{BASH_TOOL}} git rev-parse HEAD`. When it succeeds, pass the SHA as
`--started-commit`; outside a git repository, omit that option pair silently.

```bash
BUSINESS_INTENT_FILE="<exact-path-printed-above>"
STATUS=0
node "$PKG_ROOT/scripts/decompose-plan.js" materialize \
  --source '<source-path>' \
  --slug '<slug>' \
  --project-id '<project-id>' \
  --branch '<branch-or-null>' \
  --started-commit '<started-commit>' \
  --business-intent-file "$BUSINESS_INTENT_FILE" || STATUS=$?
rm -f "$BUSINESS_INTENT_FILE"
if [ "$STATUS" -ne 0 ]; then exit "$STATUS"; fi
```
```

**Claim:** The `adopt` flow repeats the same unconditional `--started-commit` flag, contradicting its own documented non-git omission rule.

**Impact:** `project adopt` fails in marker-only or non-git environments where the flow is supposed to degrade gracefully, blocking adoption of pre-lifecycle plans outside a repository.

**Recommendation:** Apply the same conditional flag construction here as in the default flow, and add a non-git `adopt` regression test for the rendered command block.

**Confidence:** high

## Questions (non-findings)

- _(none)_

## Out of scope

- Archived transcript content under `.atomic-skills/reviews/`.
- The final `refresh-state` check-to-rename shared-writer race explicitly deferred to F4 by the briefing.

## Pass 2 reconciliation

### Dropped from blind pass

- _(none)_

### Maintained

- F-001-blind → F-001-final [major] — same
- F-002-blind → F-002-final [major] — same
- F-003-blind → F-003-final [major] — same

### Emerged

- F-004-final [major] correctness — emerged: the disclosed `startedCommit` contract requires omitting `--started-commit` outside git, which exposes the unconditional flag in `project-create-plan.md` as a real execution failure instead of a documentation nit.
- F-005-final [major] correctness — emerged: the same external constraint applies to the `adopt` recipe, revealing a second broken executable shell block in the same asset.
