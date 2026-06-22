---
date: 2026-06-17T21:30:00Z
topic: wlf-f6-orphan-worktrees
artifact: 571f588..bb3183b (scripts/detect-orphan-worktrees.js, tests/detect-orphan-worktrees.test.js, skills/shared/project-assets/project-verify.md §9)
skill: review-code
reviewer: gpt-5-codex
codex_version: codex-cli 0.141.0
final_verdict: needs_changes (all findings resolved)
counts_final: {blocker: 0, critical: 0, major: 2, minor: 4, nit: 2}
counts_blind: {blocker: 0, critical: 0, major: 2, minor: 2, nit: 0}
framing_delta: {dropped: 3, maintained: 1, emerged: 1}
schema_version: "1.0"
mode: both
---

# Cross-Model Review — wlf-f6-orphan-worktrees (phase-done F6)

Phase F6 review gate (`--mode=both`, lesson-driven: new logic — the orphan-worktree
detector — per wlf-f1..f5 L-001). Subject = the 3 F6 source files (`findOrphanWorktrees`
+ its test + the `project-verify.md` check #9); `.atomic-skills/` state excluded. Both
halves consumed the byte-identical captured diff (sha 4d08a17…).

## Local review (sealed-envelope, same-model clean context)

verdict: findings_exist · counts: major=1 minor=3 nit=2

| # | Severity | File:line | Summary | Resolution |
|---|----------|-----------|---------|------------|
| L1 | major | test (whole file) | the `safelyIsMerged` try/catch is never exercised (no throwing `isMerged` test) → deleting the catch fails 0 tests | FIXED — throwing-isMerged test added (mutation-killing). |
| L2 | minor | test | no test for a worktree whose branch matches NO plan but is merged via ancestry | FIXED — no-matching-plan test added. |
| L3 | minor | test | no test for malformed array entries (`[null]`, non-object) | FIXED — malformed-entries test added. |
| L4 | minor | verify.md | doc names kind `archived-unintegrated-branch` (does not exist in code) | FIXED — doc names the real kinds (= codex F-003). |
| L5 | nit | verify.md | doc archived `reason` overclaims a parenthetical the code omits | FIXED — doc reason aligned to the emitted string. |
| L6 | nit | verify.md | report-shape shows 6 WARN rows but totals "5" (off-by-one, pre-existing) | FIXED — corrected 5→6 on the touched line. |

> The local pass judged the runtime **logic** "clean" (explicitly: "Logic correctness
> (A/B): clean") — and MISSED the condition-B/`isMerged` asymmetry the cross-model caught
> as major. 6th consecutive phase the same-model rationalizes a logic gap the cross-model finds.

## Pass 1 (blind)

verdict: needs_changes · counts: {blocker: 0, critical: 0, major: 2, minor: 2, nit: 0} · reviewer: gpt-5-codex

- **F-001 [major] logic — detect-orphan-worktrees.js:102** — condition B (archived
  classification) IGNORES `isMerged`: `{status:'archived', branch:'plan/x', pr:null}`
  with `isMerged('plan/x')===true` still emits `archived-never-pr` ("never reached
  develop") — false, the branch WAS merged. Asymmetry: A uses both merge signals, B
  only `pr.state`. Confidence: high.
- **F-002 [major] logic — :82** — duplicate plans for one branch: `plans.find` is
  first-match-wins; the MERGED signal on a non-first duplicate is missed → a live merged
  worktree not flagged. Confidence: high.
- **F-003 [minor] doc — verify.md:92** — documented kind `archived-unintegrated-branch`
  ≠ the emitted `archived-never-pr`/`archived-pr-open-unmerged`. Confidence: high.
- **F-004 [minor] test — test:69** — required edge branches untested (no-matching-plan,
  isMerged-throws, malformed entries). Confidence: high.

## Pass 2 (informed)

verdict: needs_changes · reviewer: gpt-5-codex

reconciliation: dropped F-001/F-003/F-004 (confirmed closed) · maintained F-002 (detection closed) · **emerged 1 minor**.

- **F-001/F-003/F-004** — CONFIRMED CLOSED (branch-level `isBranchMerged` applied
  symmetrically; doc names real kinds; 5 tests added).
- **F-002** — detection CLOSED (`isBranchMerged` scans all plans on the branch).
- **EMERGED [minor] metadata — detect-orphan-worktrees.js:95** — the WARN still named
  `matchingPlans[0]` (a stale archived dup) for `slug` even when the merged signal came
  from another plan → operator pointed at the wrong plan. FIXED: report the MERGED-PR
  plan → active plan → first fallback; F-002 lock-in test now asserts `slug === 'd-new'`.
- On "merged branch whose worktree is gone but plan still active": pass-2 judged it OUT
  of scope for this detector (active-state/completion drift, not an orphan worktree) — agreed.

## Fixes applied in this session

All findings resolved single-threaded post-review (commits `f2e0ab2`, `bb3183b`):

- **F-001 + F-002 (branch-level merge)** → `detect-orphan-worktrees.js`: replaced the
  per-plan `isFeatureMerged` with `isBranchMerged(branch, plans, isMerged)` (any plan on
  the branch with a MERGED PR, OR the injected ancestry predicate), applied symmetrically
  to condition A (flag a live worktree) and condition B (suppress an archived branch that
  actually reached the ref). This re-verify on the merged primary caught a self-introduced
  double-flag (A branch-level, B left per-plan → the F-002 lock-in test failed) before the
  branch-level helper was made symmetric — the test did its job.
- **F-003/L4 + L5 + L6 (doc)** → `project-verify.md`: real kind names + merged-suppress
  documented; reason aligned; report-shape count 5→6.
- **F-004/L1/L2/L3 (tests)** → 5 tests added; **pass-2 emerged slug-selection** → the
  reportedPlan precedence fix + slug assertion. Tests 6 → 11, all pass.

Post-fix verification (merged primary @ bb3183b): `node --test
tests/detect-orphan-worktrees.test.js` → 11/11; G-2 grep `detect-orphan-worktrees` +
`npm run validate-skills` 15/15; `npm run validate-state` exit 0.

## Self-review against code-quality gates

- G1 read-before-claim: each fix located its lines (the two loops, the helper, the doc bullets) before editing.
- G2 soft-language: fix descriptions state what changed.
- G3 anti-tautology: the added tests each name the mutation they kill (delete the catch → throwing-isMerged test red; revert branch-level → F-001/F-002 lock-ins red; per-plan slug → slug assertion red).
- G4 fixture realism: fixtures use real worktree/plan shapes ({path,branch,head}; {slug,branch,status,pr:{state}}).
- G7 anti-premature-abstraction: one small `isBranchMerged` helper replacing a per-plan one; no speculative layering.
