# Evaluation report — brainstorm-hardening F2

**planSlug:** brainstorm-hardening  
**phaseId:** F2  
**phaseTitle:** Receipts, stage assert, create-plan split, Stage 4 wire  
**verdict:** pass  
**at:** eec9c3cd631a3a87dc43677df18e2c5b939193d6  
**evaluatedAt:** 2026-07-30T17:27:30Z  
**productCommits:**
- `e90b2762` feat(brainstorm): design-gates and creation-gates helpers
- `68d7ec1b` feat(brainstorm): design process detectors and creation stage assert
- `00778857` feat(project): Stage 4 and brainstorm B5 HARD-BLOCK on design detectors
- `5e266737` feat(project): thin create-plan router plus new-plan/stage-N.md
- `e84fa3a0` feat(brainstorm-hardening): merge F2 phase writer (T-006..T-009)
- `eec9c3cd` chore(project): checkpoint brainstorm-hardening F2 T-006..T-009  

**phaseFile:** `.atomic-skills/projects/atomic-skills/brainstorm-hardening/phases/f2-receipts-stage-assert-create-plan-split.md`  
**planFile:** `.atomic-skills/projects/atomic-skills/brainstorm-hardening/plan.md`  
**claimsFile:** `.atomic-skills/status/automate/brainstorm-hardening-claims.json`

## Findings

1. **severity:** note · **area:** exit-gate · **gateId:** G-F2-1 · **summary:** Re-ran `node --test tests/design-gates.test.js tests/creation-gates.test.js tests/find-missing-design-process.test.js tests/find-weak-design.test.js tests/assert-creation-stage.test.js` at HEAD `eec9c3cd` → exit 0; **55 pass / 0 fail / 10 suites / duration_ms ~523**. Matches phase goal for design-gates + creation-gates + detectors + assert-creation-stage unit coverage.

2. **severity:** note · **area:** exit-gate · **gateId:** G-F2-2 · **summary:** Wiring + stage router verifier green: `rg` finds `find-missing-design-process` and `find-weak-design` in `project-create-plan.md`; `new-plan/stage-6.md` exists; `assert-creation-stage` present in router + stage-6; subset unit suite **46 pass / 0 fail**. Stage 4 procedure order in `new-plan/stage-4.md` and router summary is lint-design → find-missing-design-process → find-weak-design → lint-source with **HARD-BLOCK** language. Brainstorm B5 embeds the same detectors and **HARD-BLOCKs** handoff.

3. **severity:** note · **area:** exit-gate · **gateId:** G-F2-3 · **summary:** `rg -q 'adopt|ad-hoc|adhoc|single-task|R-ORCH-03|exempt' tests/find-missing-design-process.test.js` exit 0; suite **14 pass / 0 fail**. Negative tests prove exempt lanes do not false-positive: unit `evaluateDesignProcess(null, {lane:'adopt'})` → ok+exempt; CLI `--lane adopt|ad-hoc|single-task` exit 0 without receipt; creation-gate `kind: adopt` exempts via `--creation-gate`. `find-weak-design` also has `CLI --lane adopt exits 0 (R-ORCH-03 exempt)`.

4. **severity:** note · **area:** product · **path:** `scripts/design-gates.js` · **summary:** schemaVersion `0.1`; fields `interviewAccepted`, `debateGate`, `researchDigest`, `criticVerdict`, `userApproved`, `status` (pending/ready). `missingDesignGateFields` + update refuse `ready` when incomplete. Tests cover create/update/read, happy ready path, missing fields demote ready, debateGate incomplete when `invoked: false`. Companion asset `skills/shared/brainstorm-assets/process-receipt.md` documents the receipt path and field table.

5. **severity:** note · **area:** product · **path:** `scripts/creation-gates.js` · **summary:** `CREATION_STAGES` = `slug → design → source → decompose-confirm → bi-ratified → materialized → summaries → reviews → ready`. Monotonic advance only; illegal skip and reverse refused; idempotent same-stage advance allowed. Unit tests pin ordered list ending in `ready` and illegal skip/reverse.

6. **severity:** note · **area:** product · **path:** `scripts/find-missing-design-process.js`, `scripts/find-weak-design.js`, `scripts/assert-creation-stage.js` · **summary:** Detectors take explicit paths (no tree-wide scan). find-missing exits 1 on missing/not-ready; find-weak fails soft-language, non-goals echo, short interview (`MIN_INTERVIEW_LENGTH=80`), weak digest (empty/zero paths/few bullets); assert-creation-stage exits 1 on skip advance and early `--ready`. CLI exit codes enforce P6 (agents cannot close without exit 0).

7. **severity:** note · **area:** live-contract · **path:** `skills/shared/project-assets/new-plan/stage-4.md`, `skills/core/brainstorm.md` · **summary:** Stage 4 Contract: "HARD-BLOCK: lint-design → find-missing-design-process → find-weak-design + lint-source". B5 section runs lint-design + find-missing + find-weak and states any non-zero exit HARD-BLOCKS handoff. R-ORCH-03 exempts documented with `--lane` (never silent skip).

8. **severity:** note · **area:** product · **path:** `skills/shared/project-assets/project-create-plan.md` + `new-plan/stage-{1..9}.md` · **summary:** Router title is "(thin router)"; fidelity rule requires reading **only** `new-plan/stage-N.md` for current stage. Stage table 1–9 points at stage files. All nine stage files exist with `## Contract`. stage-6 states BI **draft-and-ratify** + `assert-creation-stage` advances (`bi-ratified`, `materialized`). stage-9 asserts `--ready`. Router + stage-6/9 name `assert-creation-stage`. Diff stat vs pre-split: `project-create-plan.md` **452 lines net deleted** in F2 product range (now 282 lines); acceptance allows thin deferral OR material shrink — both hold. Remaining bulk is adopt procedure + decompose heuristic reference + schema quick-ref (explicit non-stage body), not a re-monolith of Stages 1–9.

9. **severity:** note · **area:** tests · **path:** `tests/project.test.js` · **summary:** Pins: Stage 4 HARD-BLOCK detector order (lint-design then find-missing then find-weak); B5 HARD-BLOCK on design-gates; thin router defers to `new-plan/stage-N` + assert-creation-stage; stage-1..9 Contract presence; stage-6 draft-and-ratify; stage-9 assert-creation-stage. T-008/T-009 re-run: **project.test.js 69 pass**; with assert-creation-stage **80 pass / 0 fail**.

10. **severity:** note · **area:** scope · **summary:** F2 product file set is the five scripts + five test files + process-receipt + project-create-plan + stage-1..9 + brainstorm.md + project.test.js updates (23 files, +2871/−413). `scripts/find-weak-business-intent.js` has **zero commits** in F2 range (T-006 scopeBoundary). No `skills/**/review-plan*` changes (T-009: do not rewrite Stage 8 review-plan skill body). F3 outputs absent: `pressure-tests.md` and `dogfood-checklist.md` not present (correctly out of F2).

11. **severity:** note · **area:** residual-prose · **path:** `skills/core/brainstorm.md` L95 · **summary:** Still says sections are mandatory "and expanding toward Interview / Context / Non-goals as required" while F1 already made those always-required in `lint-design`. Non-blocking residual from F1 eval; not a G-F2 exit-gate miss (F2 scoped B5 detector wire, not the section list).

12. **severity:** note · **area:** residual · **path:** `project-create-plan.md` · **summary:** Router is not *minimal* (still carries adopt full procedure + decompose heuristics). Acceptance is met via explicit stage deferral + line reduction + tests. Optional follow-up (not F2 blocker): move adopt/heuristic bulk into lazy assets to further thin the router.

## businessIntentCheck

Phase `businessIntent` (from initiative frontmatter):

| Field | Result | Evidence |
|-------|--------|----------|
| **value** | pass | design-gates + detectors + assert-creation-stage enforce DESIGN fidelity on disk; create-plan is thin router + stage-N; Stage 4 and B5 HARD-BLOCK without receipts; adopt/ad-hoc/single-task exempt. Scripts, stage-4/B5 prose, and exempt tests all present and green. |
| **workflow** | pass | T-006 helpers (`design-gates.js`, `creation-gates.js`, process-receipt) green 18/18. T-007 detectors green 37/37. T-008 wire Stage 4 + B5 green (rg + project.test 69). T-009 stage split + assert green (stage-1..9 + router + stage-6 BI + assert pins; 80 tests with assert suite). All task statuses `done` with shell evidence on merge commit `e84fa3a0`. |
| **rules** | pass | R-ORCH-03 exempt implemented (`EXEMPT_LANES`, `--lane`, creation-gate kind adopt); monotonic stage only via `assert-creation-stage` / `assertCanAdvance`; Stage 8 review-plan skill body not rewritten; detectors fail on missing process (exit 1 + unit coverage). find-weak-business-intent rules untouched. |
| **outOfScope** | pass | F3 dogfood/pressure files absent. F0/F1 product not reworked as F2 scope. No web research path introduced. Stage 8 review-plan skill not rewritten (stage-8.md is create-plan stage body split, not the external review skill). |
| **doneWhen** | pass | G-F2-1..3 all green on evaluator re-run at HEAD `eec9c3cd` (see exitGates). |

## exitGates

### G-F2-1 — design-gates creation-gates detector and assert-creation-stage unit tests pass

- **status:** pass — exit code **0**
- **Command (verbatim):**  
  `node --test tests/design-gates.test.js tests/creation-gates.test.js tests/find-missing-design-process.test.js tests/find-weak-design.test.js tests/assert-creation-stage.test.js`
- **Evidence (evaluator re-run at HEAD `eec9c3cd`):**
  - `ℹ tests 55`
  - `ℹ suites 10`
  - `ℹ pass 55`
  - `ℹ fail 0`
  - `ℹ duration_ms 522.962417`
- **Coverage shape observed:** design-gates (9), creation-gates (9), assert-creation-stage unit+CLI (11), find-missing (14), find-weak (12).

### G-F2-2 — Stage 4 and brainstorm HARD-BLOCK detectors; stage router and stage-6 exist

- **status:** pass — exit code **0**
- **Command (verbatim):**  
  `rg -q 'find-missing-design-process' skills/shared/project-assets/project-create-plan.md && rg -q 'find-weak-design' skills/shared/project-assets/project-create-plan.md && test -f skills/shared/project-assets/new-plan/stage-6.md && rg -q 'assert-creation-stage' skills/shared/project-assets/project-create-plan.md skills/shared/project-assets/new-plan/stage-6.md && node --test tests/design-gates.test.js tests/find-missing-design-process.test.js tests/find-weak-design.test.js tests/assert-creation-stage.test.js`
- **Evidence:**
  - All `rg`/`test -f` subchecks exit 0 (rg1/rg2/stage6/assert = ok)
  - Unit subset: `ℹ tests 46` · `pass 46` · `fail 0` · `duration_ms ~510`
  - Additional wiring (beyond gate command, for confidence):  
    - `rg -q 'HARD-BLOCK|find-missing-design-process' project-create-plan.md` → ok  
    - `rg -q 'design-gates|find-missing-design-process' skills/core/brainstorm.md` → ok  
    - stage-1..9 all present  
    - `rg -q 'draft-and-ratify|Drafted|drafts the' stage-6.md` → ok  

### G-F2-3 — detectors do not false-positive adopt/ad-hoc/single-task exempt lanes

- **status:** pass — exit code **0**
- **Command (verbatim):**  
  `rg -q 'adopt|ad-hoc|adhoc|single-task|R-ORCH-03|exempt' tests/find-missing-design-process.test.js && node --test tests/find-missing-design-process.test.js`
- **Evidence:**
  - `exempt_rg=ok`
  - `ℹ tests 14` · `pass 14` · `fail 0` · `duration_ms ~414`
  - Named cases: `isExemptLane` recognizes adopt/ad-hoc/adhoc/single-task; missing receipt ok for adopt; CLI `--lane adopt|ad-hoc|single-task` exit 0; creation-gate kind adopt exempts.

## Scope check (T-006..T-009)

| Task | Outputs exist | scopeBoundary held | Re-run verifier |
|------|---------------|--------------------|-----------------|
| **T-006** | `scripts/design-gates.js`, `scripts/creation-gates.js`, `skills/shared/brainstorm-assets/process-receipt.md`, `tests/design-gates.test.js`, `tests/creation-gates.test.js` | No find-weak-business-intent edits (zero commits); helpers under scripts/status domain only | `node --test tests/design-gates.test.js tests/creation-gates.test.js` → exit 0 (**18/18**) |
| **T-007** | `scripts/find-missing-design-process.js`, `scripts/find-weak-design.js`, `scripts/assert-creation-stage.js` + three test files | Explicit CLI paths; R-ORCH-03 exempt negative tests; no false-fail on adopt/ad-hoc/single-task | three test files → exit 0 (**37/37**) |
| **T-008** | Detector names + HARD-BLOCK in create-plan surface and brainstorm B5; `tests/project.test.js` pins | Stage 8 receipt scripts not rewritten as T-008 deliverable; detector names on router kept after T-009 split | full T-008 shell chain → exit 0 (**project.test 69/69**) |
| **T-009** | stage-1..9 with Contract; thin router defers to stage-N; stage-6 draft-and-ratify; assert-creation-stage on router/stage-6/stage-9 | adopt remains thin pointer + reference procedure (no novel adopt behavior); no review-plan skill rewrite; Red Flags section not expanded into walls | full T-009 shell chain → exit 0 (**80 tests: 69 project + 11 assert**) |

**scopeBoundary exclusions held:** find-weak-business-intent rules unchanged; adopt/ad-hoc not false-failed; Stage 8 review-plan skill body not rewritten; F3 dogfood/pressure not delivered as product of F2; no mass rewrite of historical designs.

## Task re-verification (evaluator)

| Task | Claim status | Claim commit | Claim exitCode | Re-run exitCode | Notes |
|------|--------------|--------------|----------------|-----------------|-------|
| T-006 | claimed-pass | e90b2762 | 0 | 0 | 18/18; schemaVersion 0.1 + CREATION_STAGES monotonic |
| T-007 | claimed-pass | 68d7ec1b | 0 | 0 | 37/37; missing/not-ready/weak/skip/early-ready + R-ORCH-03 |
| T-008 | claimed-pass | 00778857 | 0 | 0 | Stage 4 + B5 HARD-BLOCK; project.test 69 |
| T-009 | claimed-pass | 5e266737 | 0 | 0 | stage-1..9 Contract; router defers; stage-6 BI + assert; 80 tests |

Merge/checkpoint commits `e84fa3a0` / `eec9c3cd` land the above on `plan/brainstorm-hardening` HEAD.

## Key contracts at HEAD (source of truth)

### CREATION_STAGES

```js
export const CREATION_STAGES = Object.freeze([
  'slug',
  'design',
  'source',
  'decompose-confirm',
  'bi-ratified',
  'materialized',
  'summaries',
  'reviews',
  'ready',
]);
```

### EXEMPT_LANES (R-ORCH-03)

```js
export const EXEMPT_LANES = Object.freeze([
  'adopt',
  'ad-hoc',
  'adhoc',
  'single-task',
  'singletask',
]);
```

### Stage 4 / B5 detector order (skill surface)

1. `scripts/lint-design.js`  
2. `scripts/find-missing-design-process.js`  
3. `scripts/find-weak-design.js`  
4. (Stage 4 only) `scripts/lint-source.js`  

Any non-zero exit **HARD-BLOCKS** decompose / handoff.

### design-gates receipt fields (v0.1)

`schemaVersion`, `interviewAccepted`, `debateGate`, `researchDigest`, `criticVerdict`, `userApproved`, `status`, `updatedAt` — path `.atomic-skills/status/design-gates/<projectId>-<slug>.json`.

## Summary

F2 phase goal is met on HEAD `eec9c3cd`. Durable **design-gates** and monotonic **creation-gates** helpers ship with unit tests; **find-missing-design-process**, **find-weak-design**, and **assert-creation-stage** fail closed on missing/weak/skip paths and **exempt R-ORCH-03** adopt/ad-hoc/single-task without false positives. **Stage 4** and brainstorm **B5** wire the detectors with HARD-BLOCK language. **create-plan** is a thin router over `new-plan/stage-1..9.md` (each with Contract); stage-6 is BI draft-and-ratify; stage advance is assert-gated. All exit gates G-F2-1..3 and task verifiers T-006..T-009 re-ran green. Out-of-scope F3 dogfood/pressure and Stage 8 review-plan rewrite remain absent.

**blockers:** none

**verdict:** pass  
**reportPath:** `.atomic-skills/reviews/eval-brainstorm-hardening-F2.md`
