---
date: 2026-06-17T23:00:00Z
topic: wlf-f7-dedup-review-ledger
artifact: d12e2e6..83d2ee1 (scripts/review-ledger.js, tests/review-ledger.test.js, skills/core/review-code.md §0.5, skills/shared/project-assets/project-drift.md)
skill: review-code
reviewer: gpt-5-codex
codex_version: codex-cli 0.141.0
final_verdict: needs_changes (all findings resolved)
counts_final: {blocker: 0, critical: 0, major: 5, minor: 2, nit: 2}
counts_blind: {blocker: 0, critical: 0, major: 5, minor: 1, nit: 0}
framing_delta: {dropped: 0, maintained: 5, emerged: 0}
schema_version: "1.0"
mode: both
---

# Cross-Model Review — wlf-f7-dedup-review-ledger (phase-done F7, plan-closing)

Phase F7 review gate (`--mode=both`, lesson-driven: new logic — the surface-review ledger
+ its dedup wiring — per wlf-f1..f6 L-001). F7 is the LAST phase of the plan. Subject =
the 4 hand-authored source files (the work-order is `.atomic-skills/` state, excluded;
generated `docs/skills/` excluded). Both halves consumed the byte-identical captured diff
(sha 9ab0b6e…). This was the heaviest review of the plan — fitting for the last/largest phase.

## Local review (sealed-envelope, same-model clean context)

verdict: findings_exist · counts: major=1 minor=1 nit=2

| # | Severity | File:line | Summary | Resolution |
|---|----------|-----------|---------|------------|
| L1 | major | project-drift.md + project-transitions.md:124 | four `jq '.lastReviewedCommit'` pointer readers left reading an NDJSON file the new write path produces; the "mirror" was hand-waved | FIXED (= codex C5) — both docs now declare the flip a COORDINATED DEFERRED follow-up; pointer stays until lockstep migration; dedup reads it fail-safe. |
| L2 | minor | review-ledger.js:62 | dead `typeof serialized === 'string'` branch in safeRecordLine (unreachable) | FIXED — simplified. |
| L3 | nit | test:69 | byte-preservation test re-derived the impl's `trimEnd` transform (mildly tautological) | FIXED — independent byte-exact test added (C1). |
| L4 | nit | test (coverage) | untested branches (non-object record, whitespace-only, single malformed line, empty mode) | FIXED — 3 tests added. |

> The local pass judged the module LOGIC clean (purity/never-throws/append) and found the
> doc producer/consumer gap; it MISSED the four runtime-logic majors below — 7th consecutive
> phase the cross-model catches logic the same-model rationalizes.

## Pass 1 (blind)

verdict: needs_changes · counts: {blocker: 0, critical: 0, major: 5, minor: 1, nit: 0} · reviewer: gpt-5-codex

- **C1 [major] byte-preserve — review-ledger.js:96** — `recordReview` used
  `content.trimEnd()`, dropping a last line's trailing whitespace → result not byte-prefixed
  by the original → union-merge losslessness claim false.
- **C2 [major] pointer misclassify — review-ledger.js:32** — `isLegacyPointer` flagged a
  valid one-line NDJSON record that carried a `lastReviewedCommit` field → dropped as legacy.
- **C3 [major] malformed proof — review-ledger.js:116** — `alreadyReviewed` counted a
  partial record (`{mode, commitSha}` with no `patchId`) as positive proof → a crafted/corrupt
  line could skip a review.
- **C4 [major] never-throws — review-ledger.js:109** — `alreadyReviewed` threw on a `range`
  with a throwing `commitSha` getter (no catch), violating the never-throws contract.
- **C5 [major] doc producer/consumer — project-drift.md:111** — same as local L1 (the
  pointer readers vs the NDJSON write path; the hand-waved mirror). Cross-model agreement.
- **minor test:69** — byte-preservation test encodes the bug instead of detecting it (= local L3).

## Pass 2 (informed)

verdict: clean · reviewer: gpt-5-codex

reconciliation: maintained C1–C5/L2 as closed · dropped none · **emerged 0**.

- C1 closed (byte-preserving `endsWith` append). C2 closed (legacy excludes a valid record).
  C3 closed (`isValidRecord` gate: only mode+commitSha+patchId counts). C4 closed (top-level
  try/catch → false). C5 closed (both docs declare the coordinated deferred flip; pointer
  inert-but-safe). L2 closed. Confirmed `isValidRecord` requiring `patchId` rejects no
  legitimate proof `recordReview` writes. No new defect with full intent.

## Fixes applied in this session

All findings resolved single-threaded post-review (commit `83d2ee1`):

- **C1** → byte-preserving append: `const sep = content.endsWith('\n') ? '' : '\n'` (no trim).
- **C2** → `isLegacyPointer` requires `lastReviewedCommit` AND `!isValidRecord(parsed)`.
- **C3** → new `isValidRecord` (non-empty `mode`+`commitSha`+`patchId`); `alreadyReviewed`
  matches only valid records.
- **C4** → `alreadyReviewed` wrapped in try/catch → `false`.
- **L2** → `safeRecordLine` dead branch removed.
- **C5/L1** → `review-code.md` Step 0.5 + `project-drift.md` State-file ⚠️ note + `review-due`
  step 5: the NDJSON flip is a COORDINATED DEFERRED follow-up (writer + four jq-pointer
  readers — CODEX REVIEW line, review-due base, phase-done, transitions archive-gate —
  migrate in lockstep); until then `last-review.json` stays the legacy pointer, the dedup
  reads it fail-safe (inert-but-safe, never a false skip), and the record-back-write does NOT
  unilaterally flip a project's format.
- Tests 13 → 20 (independent byte-preserve, C2/C3/C4 locks, malformed/whitespace/empty-mode).

Post-fix verification (merged primary @ 83d2ee1): `node --test tests/review-ledger.test.js`
→ 20/20; grep anchors (`review-dedup` ×2, `project-review-dedup`) + `npm run validate-skills`
15/15; `npm run validate-state` exit 0.

## Self-review against code-quality gates

- G1 read-before-claim: each fix located its lines before editing.
- G3 anti-tautology: the new tests name the mutation they kill (revert byte-preserve →
  trailing-space test red; revert isValidRecord → partial-proof test red; revert try/catch →
  throwing-getter test red; revert legacy-exclusion → C2 test red).
- G4 fixture realism: real record/pointer/NDJSON shapes.
- G7 anti-premature-abstraction: one `isValidRecord` helper; no speculative layering.
