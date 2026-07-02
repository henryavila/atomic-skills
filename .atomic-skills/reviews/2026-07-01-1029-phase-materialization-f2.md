# phase-materialization F2 - review-code local

- **Date:** 2026-07-01 10:29 UTC
- **Scope:** `e775c489d96d48ba1f3c41c15a46b42eccbac125..71d21049539b5db3408834155c1f6b24970d8144`
- **Mode:** local degraded inline
- **Verdict:** approved_with_remediation
- **Counts:** 0B/0C/1M/0m/0n

## Capture

Destructive signal: false. The phase diff is additive lazy phase materialization, reader prose/tests, and state evidence; it does not delete whole non-test files, does not carry schema/data drop tokens, and is not deletion-dominated.

Local review isolation degraded for two reasons:

- The installed `review-code` bundle referenced `diff-capture.md`, but that asset was not present in the installed skill tree.
- The available multi-agent tool contract says not to spawn subagents unless the user explicitly asks for subagents, delegation, or parallel agent work.

I therefore captured the same range and reviewed it inline, then fixed the one confirmed finding before stamping the gate.

`git diff --check e775c489d96d48ba1f3c41c15a46b42eccbac125 71d21049539b5db3408834155c1f6b24970d8144` reported blank-line-at-EOF issues in generated/project state markdown files only. No code file had whitespace errors.

## Finding

### M1 - Flat businessIntent detector could materialize a descriptor-only phase from another plan

Severity: major.

`scripts/find-missing-business-intent.js` indexed legacy flat initiatives globally by `phaseId`. In a flat layout with `plans/plan-a.md` containing descriptor-only `F0`, and `initiatives/plan-b-f0.md` belonging to a different plan with `parentPlan: plan-b`, the detector treated `plan-a/F0` as materialized because the phase id matched. That produced a false positive against a phase that D5 says must be skipped until materialized.

Fix applied in `71d21049539b5db3408834155c1f6b24970d8144`: key flat initiatives by `(parentPlan, phaseId)` first, preserve a phaseId-only fallback only for a single unscoped legacy initiative, and add a cross-plan regression.

Code anchors after the fix:

- `scripts/find-missing-business-intent.js:151` flat legacy matching comment and indexes.
- `scripts/find-missing-business-intent.js:174` exact-or-unambiguous fallback resolver.
- `tests/phase-materialization/find-missing-business-intent.test.js:155` cross-plan regression.

## Verification

- `rtk node --test tests/phase-materialization/find-missing-business-intent.test.js` exited 0: 11 tests, 11 pass, 0 fail.
- `rtk node --test 'tests/phase-materialization/*.test.js'` exited 0: 27 tests, 27 pass, 0 fail.
- `rtk npm test` exited 0: 1495 tests, 1487 pass, 0 fail, 8 skipped, 179 suites.
- `rtk npm run validate-skills` exited 0: all 15 skills valid.
- `rtk node scripts/validate-state.js .atomic-skills/projects/atomic-skills/phase-materialization/plan.md .atomic-skills/projects/atomic-skills/phase-materialization/phases/f2-materializacao-lazy-leitores-distingue.md` exited 0 before the archive move: both files valid.

## Self-review against code-quality gates

- G1 read-before-claim: applied - the finding was reproduced with a failing regression before the detector change, then re-run green.
- G2 soft-language: applied - verdict is anchored in explicit test commands and counts.
- G3 anti-tautology: applied - the regression asserts the observable report is empty for a descriptor-only phase sharing only the phase id with another plan.
- G4 fixture realism: applied - the test uses the real flat legacy `plans/` + `initiatives/` shape and real frontmatter fields.
- G7 anti-premature-abstraction: applied - the fix changes the existing flat index only; no new scanner abstraction was introduced.
