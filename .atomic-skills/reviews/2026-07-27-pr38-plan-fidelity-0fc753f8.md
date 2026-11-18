# Plan fidelity review — automate-default-and-operator-gates

## Overall verdict

Load-bearing pure helpers, unit tests, and skill prose for F0–F4 are largely present in the current tree. The strongest delivery is F0 (`isAutomateActive` default-ON + Mode-1 escape), F1 present-before-PASS stamp shape, F2 `intentVsDelivered` under `forbidSkip`, F3 checklist file, and F4 pure authenticity/disposition/statusRoot/exitGate helpers with tests. Residual risk concentrates on **live assert wiring**: `scripts/assert-automate-gate.js` is stamp-first (no session `automateActive`), does not inject dual-leg/eval **content** reads, and does not load open major findings into `canRunPhaseDone`. Dogfood file correctly does **not** claim live PASS.

**Score estimate: ~88% partial-weighted / ~76% fully matched** (17 load-bearing claims; content-floor + assert session-default gaps counted partial, not missing).

Counts: **matched 13 · partial 4 · missing 0 · extra 0**.

---

## F0 — automate default

### Claim: bare implement / no CLI mode + no stamp ⇒ `isAutomateActive` true
- Status: **matched**
- Confidence: **high**
- Evidence:
  - `src/implement-mode.js:241-242` — `// F0: bare implement / no opt-out → pure-maestro default ON.` then `return true;`
  - `src/implement-mode.js:203-206` — clear only short-circuits to false when `clearExecutionMode === true`
  - `tests/implement-mode.test.js:143-167` — `isAutomateActive({}) === true`; parse without mode + active true
- Notes: Precedence docs at `src/implement-mode.js:177-188` match implementation.

### Claim: `--mode=1` / `mode:1` ⇒ false
- Status: **matched**
- Confidence: **high**
- Evidence:
  - `src/implement-mode.js:212-221` — known non-automate CLI returns false
  - `tests/implement-mode.test.js:169-177` — argv matrix `--mode=1`, `mode:1`, `--mode mode1` → false
  - `tests/implement-mode.test.js:57-63` — parse + active false for mode 1
- Notes: Also overrides stamp (`tests/implement-mode.test.js:205-237`).

### Claim: `mode=automate` and stamp-alone still true; `clearExecutionMode` false alone does not kill stamp
- Status: **matched**
- Confidence: **high**
- Evidence:
  - `src/implement-mode.js:214-216` — cli automate → true
  - `src/implement-mode.js:230-233` — stamp automate → true
  - `tests/implement-mode.test.js:180-203` — stamp-alone re-entry true with `clearExecutionMode: false`
  - `tests/implement-mode.test.js:252-269` — clear true wins even with automate CLI/stamp
- Notes: Unstamp alone falls through to default ON (F0), not Mode 1 (`tests/implement-mode.test.js:362-382`).

### Claim: Prose says automate default + Mode-1 escape
- Status: **matched**
- Confidence: **high**
- Evidence:
  - `skills/core/implement.md:5` — “Automate is the default… Mode 1 requires explicit escape: `--mode=1` / `mode:1`”
  - `skills/shared/implement-automate-maestro.md:6-9` — bare implement default; Mode 1 escape
  - `skills/shared/implement-antipatterns.md:25` — bare implement is not Mode 1 post-F0
- Notes: Iron-law / table language consistent across implement + antipatterns.

---

## F1 — decision-review present-before-PASS + AskUserQuestion-only

### Claim: `buildDecisionPackage` helper with empty/non-empty packages
- Status: **matched**
- Confidence: **high**
- Evidence:
  - `src/decision-review-package.js:141-170` — builds `phaseId`, `path`, `entries`, `empty`, `summaryMarkdown`
  - `src/decision-review-package.js:9-11` — `NO_DECISIONS_BANNER` for empty
  - `tests/decision-review-package.test.js:22-100` — non-empty + empty banner cases
- Notes: Pure; never stamps PASS (`tests/decision-review-package.test.js:119-127`).

### Claim: Gate fails closed without `packagePresentedAt` / package present evidence under automate (including session default)
- Status: **partial**
- Confidence: **high**
- Evidence (matched core):
  - `src/decision-review-gate.js:68-103` — `hasDecisionPackagePresentEvidence` fails without presentedAt/path
  - `src/decision-review-gate.js:173-177` — passed stamp without present evidence fails closed
  - `src/decision-review-gate.js:45-55` — `isDurableAutomateForDecisionReview` true on stamp **or** `automateActive: true`
  - `tests/decision-review-gate.test.js:146-172` — stamp + session `automateActive` alone fail without present evidence
  - `tests/decision-review-gate.test.js:216-228` — `canRunPhaseDone` wires present-before-PASS
- Residual risk:
  - Durable activation is **not** `isAutomateActive({})` auto-true; it needs stamp or explicit `automateActive: true` (`src/plan-end-review.js:291-299`).
  - `scripts/assert-automate-gate.js:961-982` calls `canRunPhaseDone` with **only** `planExecutionMode` from frontmatter — no `automateActive`. Pre-stamp first session: assert phase-done **does not** enforce present-before-PASS even though prose demands it (`skills/shared/implement-automate-maestro.md:11-16`).
- Notes: With durable stamp present, fail-closed is solid. Session-default path is helper/test-complete, CLI incomplete.

### Claim: Prose — free-text recovery banned; decline re-Ask; package body same turn as PASS
- Status: **matched**
- Confidence: **high**
- Evidence:
  - `skills/shared/implement-decision-log.md:149-211` — present-before-PASS HARD; AskUserQuestion-only; free-text ban; decline → re-Ask/STOP; same-turn package body
  - `skills/shared/implement-automate-maestro.md:143-145` — same rules in maestro hard rules
  - `skills/shared/implement-antipatterns.md:40` — free-text recovery antipattern
- Notes: Prose-only enforcement (as expected); no machine check that host rendered package body in chat.

---

## F2 — plan-end intent-vs-delivered

### Claim: `buildIntentSurface` / `buildDeliveredSurface` / brief
- Status: **matched**
- Confidence: **high**
- Evidence:
  - `src/plan-end-intent-surface.js:247-351` — `buildIntentSurface`
  - `src/plan-end-intent-surface.js:396-499` — `buildDeliveredSurface`
  - `src/plan-end-intent-surface.js:695-793` — `buildIntentVsDeliveredBrief` with empty-checklist warning under automate
  - `tests/plan-end-intent-surface.test.js` — describes for surface builders (imports + cases at top of file / line 175+)
- Notes: Also exports `buildIntentVsDeliveredRows` scoring helper.

### Claim: `planEndReviewOk` / `automatePlanEndGatesOk` require non-empty `intentVsDelivered` under automate
- Status: **matched**
- Confidence: **high**
- Evidence:
  - `src/plan-end-review.js:174-188` — `intentVsDeliveredOk` fails empty/non-array/bad status
  - `src/plan-end-review.js:234-238` — under `forbidSkip`, missing/empty IVD fails `planEndReviewOk`
  - `src/plan-end-review.js:361-383` — `automatePlanEndGatesOk` always uses `{ forbidSkip: true }` under durable automate
  - `tests/plan-end-review.test.js:397-427` — empty/missing/unknown status fail; valid statuses pass
  - `tests/plan-end-review.test.js:765-787` — empty IVD fails under stamp and session `automateActive`
- Notes: Outside automate (forbidSkip off), IVD optional (`tests/plan-end-review.test.js:430-435`).

### Claim: assert finalize fails without `intentVsDelivered`
- Status: **matched**
- Confidence: **high**
- Evidence:
  - `scripts/assert-automate-gate.js:998-1014` — finalize → `canFinalizeOrArchive` with receipt
  - `scripts/assert-automate-gate.js:536-547` — blocked message surfaces missing/empty `intentVsDelivered`
  - `tests/assert-automate-gate.test.js:823-857` — exit 1 when IVD missing under automate
- Notes: Requires durable stamp on plan frontmatter (same stamp-first pattern as other durable gates).

### Claim: Maestro Step I prose covers intent-vs-delivered order
- Status: **matched**
- Confidence: **high**
- Evidence:
  - `skills/shared/implement-automate-maestro.md:134` — Step I fixed order: surfaces → brief → external-both → stamp IVD → userValidatedAt → assert finalize
  - `skills/shared/implement-automate-maestro.md:150` — empty IVD HARD-BLOCK finalize
- Notes: Aligns with F2 design.

---

## F3 — dogfood checklist

### Claim: `docs/kb/automate-default-dogfood.md` rows for default, Mode-1 escape, package before PASS, intentVsDelivered + finalize block
- Status: **matched**
- Confidence: **high**
- Evidence:
  - `docs/kb/automate-default-dogfood.md:3` — “checklist only — does **not** claim dogfood already passed”
  - `docs/kb/automate-default-dogfood.md:17-22` — F0 default / Mode-1 / F1 present / F2 IVD summary table
  - `docs/kb/automate-default-dogfood.md:45-48` — A1 bare default; A3 `--mode=1` escape
  - `docs/kb/automate-default-dogfood.md:71-76` — D2 package body same turn; D4 present evidence; D5 AskUserQuestion-only
  - `docs/kb/automate-default-dogfood.md:95-98` — I3 non-empty IVD; I4 finalize blocked without it
- Notes: Aggregate DOGFOOD PASS checkbox is unchecked (`docs/kb/automate-default-dogfood.md:115-119`). **No over-claim of live dogfood.**

---

## F4 — authenticity / disposition / statusRoot / exitGate mirror

### Claim: dual-leg authenticity — reject stub/binary; accept dual non-stub
- Status: **partial**
- Confidence: **high**
- Evidence (matched pure path + path shape):
  - `src/phase-review-gate.js:9-12` — design: min size, non-binary, not one-line stub; accept dual non-stub CLEAN/findings
  - `src/phase-review-gate.js:134-212` — `receiptContentAuthenticity` rejects null-byte, undersize, one-line stub
  - `src/phase-review-gate.js:417-426` — `phaseReviewHonesty` always requires ≥2 dual-leg paths under mode both
  - `tests/phase-review-gate.test.js:79-125` — stub/binary reject; dual non-stub accept; single reviewFile reject
- Residual risk:
  - Content floor only runs when `checkAuthenticity` / `receiptContents` / `readFile` supplied (`src/phase-review-gate.js:498-513`).
  - `canRunPhaseDone` / `assert-automate-gate` phase-done path do **not** pass those — so live assert enforces dual **paths** + honesty, not stub body bytes, unless a caller injects content.
- Notes: Medium floor by design; path dual-leg is always on under durable automate.

### Claim: evaluation content floor (thin report fails)
- Status: **partial**
- Confidence: **high**
- Evidence:
  - `src/phase-evaluation-gate.js:27-30` — `EVALUATION_REPORT_MIN_BYTES = 120`
  - `src/phase-evaluation-gate.js:77-143` — thin 2-line verdict-only fails; needs structured keys or min bytes
  - `tests/phase-evaluation-gate.test.js:231-248` — thin reject / structured accept
  - `src/phase-evaluation-gate.js:324-328` — content check opt-in via reportContents/readFile/checkAuthenticity
- Residual risk: same as dual-leg — assert/`canRunPhaseDone` default path only runs `evaluationGateHonesty` (reportPath required for passed), not content floor without injection.
- Notes: Pointer honesty (`reportPath` non-empty) is always enforced under durable automate.

### Claim: major disposition requires operator token
- Status: **partial**
- Confidence: **high**
- Evidence (matched helper + canRunPhaseDone wire):
  - `src/automate-orchestrator-gates.js:262-338` — `majorDispositionAllowsClose`: accept|defer|fix; decline ≠ accept; host judgment after decline fails
  - `src/automate-orchestrator-gates.js:406-417` — wired in `canRunPhaseDone` before decision-review
  - `tests/automate-orchestrator-gates.test.js:482-524` — token required; decline/host-judgment fail
  - Prose: `skills/shared/implement-automate-maestro.md:86,177`
- Residual risk:
  - `scripts/assert-automate-gate.js:961-982` never passes `openMajorFindings` / disposition — with empty findings the gate is inactive. Live CLI will not block und dispositioned majors unless a higher layer injects them.
- Notes: Helper + unit + prose complete; assert integration incomplete.

### Claim: decisionLog `statusRoot` normalize (no double `projects/`)
- Status: **matched**
- Confidence: **high**
- Evidence:
  - `src/decision-log.js:94-129` — `normalizeStatusRoot` strips trailing `projects/<id>`
  - `src/decision-log.js:168-174` — `decisionLogPath` uses normalize
  - `tests/decision-log.test.js:58-106` — double-projects cases
  - Prose: `skills/shared/implement-decision-log.md:34-43`
- Notes: Clear F4 delivery.

### Claim: exitGate mirror / hand-edit phase-done ban in prose
- Status: **matched**
- Confidence: **high**
- Evidence:
  - `src/lifecycle-order-guard.js:45-134` — `assertExitGateMirror` / terminal-pending fail closed; reason mentions hand-edit ban
  - `tests/lifecycle-order-guard.test.js:728-763` — plan met + initiative pending fails
  - `skills/shared/project-assets/project-transitions.md:270-271` — HARD before archive; no hand-edit phase-done
  - `skills/shared/implement-antipatterns.md:42,87` — hand-edit phase-done / force exitGates forbidden
- Residual risk (non-blocking for prose claim): not wired into `assert-automate-gate` / `canRunPhaseDone`; depends on transition skill following prose.
- Notes: Spec evidence targets include lifecycle guard + prose — both present.

---

## Gaps that block "plan fully met"

1. **Session-default → durable gate wiring in assert CLI** — Prose (`implement-automate-maestro.md:11-16`) requires pure-maestro under automate-default to feed `automateActive: true` / stamp into `canRunPhaseDone` / finalize / present-before-PASS. `assert-automate-gate.js` only reads `fm.executionMode`. Pre-stamp (or forgotten stamp) first session can run assert phase-done/finalize with durable gates **off**, despite `isAutomateActive({}) === true`. Load-bearing for F1 “including session default” and F0/F1 interaction.

2. **F4 content authenticity not on default close path** — Dual-leg and evaluation **content** floors exist and are unit-tested, but `canRunPhaseDone` / assert phase-done do not supply `readFile`/`receiptContents`/`reportContents`. A dual-path stamp pointing at stub files can pass honesty without content floor. If the plan intended medium floor always-on at phase-done, delivery is incomplete.

3. **Major disposition not loaded by assert** — `majorDispositionAllowsClose` is wired in `canRunPhaseDone` only when callers pass findings. Assert never loads open majors → CLI will not enforce operator disposition tokens.

These three do **not** erase the pure-helper/TDD delivery for F0–F4, but they block an unqualified “plan fully met / runtime hardgate complete” stamp.

---

## Over-claim risk (shipped stamp vs reality)

| Surface | Assessment |
|--------|------------|
| `docs/kb/automate-default-dogfood.md` | **Honest.** Explicitly checklist-only; DOGFOOD PASS unchecked; warns not to mark PASS in PR/memory without live plan. |
| Plan-end “85 matched” stamp (external) | **Do not trust.** This review scores ~88% partial-weighted / ~76% fully matched with **strict partials** on assert wiring; not 100%. |
| Skill prose gate activation (session default + stamp) | **Slight over-claim vs assert CLI.** Prose says first-session-before-stamp cannot skip present-before-PASS / IVD; pure helpers support `automateActive`, but Layer-2 assert is stamp-first only. |
| F4 “authenticity floor” marketing as always-on | **Over-claim risk** if read as assert-enforced content checks. Path dual-leg + reportPath honesty yes; stub/binary content no unless injected. |
| F3 scope | Dogfood covers F0–F2 only (stated); F4 dogfood not in this file — not an over-claim, just scope boundary. |

---

## Claim tally

| Phase | matched | partial | missing | extra |
|-------|---------|---------|---------|-------|
| F0 | 4 | 0 | 0 | 0 |
| F1 | 2 | 1 | 0 | 0 |
| F2 | 4 | 0 | 0 | 0 |
| F3 | 1 | 0 | 0 | 0 |
| F4 | 2 | 3 | 0 | 0 |
| **Total** | **13** | **4** | **0** | **0** |

- Fully matched: \(13/17 ≈ 76%\)
- Partial-weighted: \((13 + 0.5×4)/17 ≈ 88%\)
