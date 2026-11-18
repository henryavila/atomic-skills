# Local adversarial code review — audit-delivery / deliveryAuditGate hardening

**Ref/scope:** b899f49b..92884a7c (product files)
**Mode:** local
**Provider:** local
**Date:** 2026-08-04
**Status:** needs_changes

## Analysis Summary

| Metric | Value |
|--------|-------|
| Files reviewed | 25 |
| blocker | 1 |
| critical | 1 |
| major | 4 |
| minor | 0 |
| Final status | needs_changes |

| # | Finding | Severity | File:line |
|---|---------|----------|-----------|
| 1 | `deliveryAuditGate` missing from plan schema under `additionalProperties: false` | blocker | meta/schemas/plan.schema.json:509–873 |
| 2 | Terminal `phase-done` lifecycle path never checks `deliveryAuditGate` | critical | scripts/lifecycle-order-guard.js:625–639, 665–716 |
| 3 | No validate-state GATE for delivery audit on automate done phases | major | scripts/validate-state.js:679–812 |
| 4 | Stamp honesty is shape-only; reportPath need not exist; CRITICAL→CLOSED forgeable | major | src/phase-delivery-audit-gate.js:86–155; scripts/assert-automate-gate.js:1016–1077 |
| 5 | assert CLI plan-root fallback can satisfy phase-done without per-phase stamp | major | scripts/assert-automate-gate.js:1036–1041 |
| 6 | Mode-1 phase-done SSOT / post-claim orchestrator docs omit delivery audit | major | skills/shared/project-assets/project-transitions.md; skills/shared/implement-phase-writer.md:181 |

---

## Full findings

### 1. Schema rejects durable `deliveryAuditGate` stamps (blocker)

**File:line:** `meta/schemas/plan.schema.json:509–511` (`phaseDescriptor.additionalProperties: false`); properties through `decisionReview` end ~833–873 with **no** `deliveryAuditGate` property.

**WHAT:** Skill/implement SSOT requires stamping `phases[].deliveryAuditGate` on plan frontmatter. The plan phase descriptor schema is closed (`additionalProperties: false`) and declares `reviewGate`, `evaluationGate`, `lessonsState`, `decisionReview`, etc., but not `deliveryAuditGate`.

**WHY:** Any honest persist of the stamp fails Ajv/`validate-state` schema validation the same way other unknown phase properties do.

**IMPACT:** Feature is self-blocking: agents that follow implement HARD-GATE and write the stamp produce invalid plan state; agents that omit the stamp can still advance via lifecycle (finding 2). Durable automate + validate-state workflows cannot record a valid gate.

**RECOMMENDATION:** Add `deliveryAuditGate` object to `phaseDescriptor.properties` (status enum `passed` only or including failed shapes; `reportPath` minLength 1; `verdict` enum CLOSED|PARTIAL; optional `verifiedAt`/`at`; `additionalProperties: false`). Mirror any aideck TS consumer if required. Add a schema unit test that accepts a valid stamp and rejects unknown nested keys.

---

### 2. Terminal phase-done does not enforce deliveryAuditGate (critical)

**File:line:** `scripts/lifecycle-order-guard.js:625–639` (`preflightPhaseDone` ends at evaluation + decisionReview only); `665–716` (`commitGuardPhaseDone` re-checks review/lessons/fingerprint, never delivery audit). Import list lines 17–18: `phaseEvaluationAllowsClose`, `decisionReviewAllowsPhaseDone` — **no** `deliveryAuditAllowsClose`.

**WHAT:** Machine terminal path for phase-done (`preflightPhaseDone` / `commitGuardPhaseDone` used by project transitions) enforces evaluation + decisionReview under automate, and review/lessons at commit guard, but never `deliveryAuditGate`.

**WHY:** Layer-1 `canRunPhaseDone` and `assert-automate-gate --gate phase-done` check delivery audit, but lifecycle is the path that actually allows terminal writes. Prose claims “never skippable” / Mode-1+maestro; lifecycle ignores the field.

**IMPACT:** Under durable automate, an agent that stamps eval + decisionReview + review + lessons and **skips** `assert-automate-gate --gate phase-done` (or forges only assert while calling lifecycle with incomplete inputs) can complete phase-done **without any delivery audit stamp**. Mode-1 always uses lifecycle and never hits deliveryAuditAllowsClose when automate is off.

**RECOMMENDATION:** In `commitGuardPhaseDone` (and optionally preflight after decisionReview), under durable automate call `deliveryAuditAllowsClose` with plan-phase-only resolution (same anti-spoof pattern as `evaluationGateOf`). Add lifecycle tests that green commit-guard input without deliveryAudit blocks with a stable code (e.g. `phase-done-delivery-audit-open`). Wire project-transitions step order to stamp + assert before commit guard.

---

### 3. validate-state has no delivery-audit GATE-R* (major)

**File:line:** `scripts/validate-state.js:679–812` (`checkEvaluationGate` / `checkDecisionReview` / call sites; zero `deliveryAudit` matches).

**WHAT:** Done phases under `executionMode: automate` get honesty checks for evaluationGate and decisionReview; there is no parallel check for `deliveryAuditGate`.

**WHY:** Even after schema allows the field, a done phase can permanently lack an audit stamp (or carry illegal skip shapes if ever allowed) without validate-state HARD-FAIL.

**IMPACT:** Post-hoc integrity is weaker than evaluation/decision gates; skipped or forged-absent audits do not surface on `verify`/`validate-state`.

**RECOMMENDATION:** Add GATE-R style check: automate + phase `status: done` ⇒ `deliveryAuditGateHonesty` ok (or explicit migration waiver policy). Reject `operatorSkip` / `status: skipped` if present. Test done phase missing stamp fails; honest CLOSED stamp passes.

---

### 4. Gate authenticity is forge-friendly (shape-only reportPath / verdict) (major)

**File:line:** `src/phase-delivery-audit-gate.js:86–155` (`deliveryAuditGateHonesty` — non-empty string reportPath + CLOSED|PARTIAL only); `scripts/assert-automate-gate.js:1016–1077` (reads stamp from frontmatter, no FS open of reportPath); skill residual/verdict rules in `skills/shared/audit-delivery-assets/verdict-gate.md:19–26` (CRITICAL never Accept-Recorded to CLOSED) are **not** machine-checked.

**WHAT:** Honesty accepts any non-empty `reportPath` and any `verdict` in {CLOSED, PARTIAL} with `status: passed`. Assert CLI has FS access but never proves the report exists or that body verdict/CRITICAL rows match the stamp. OPEN stamped as passed is rejected (good); CRITICAL residual + forged CLOSED is not.

**WHY:** Comments assign Accept Record / report content to “caller responsibility.” Unlike evaluation’s optional content floor path (`evaluationGateAuthenticity`), delivery has no content floor even when assert could `existsSync` + read.

**IMPACT:** `deliveryAuditGate: { status: passed, verdict: CLOSED, reportPath: '.atomic-skills/reviews/does-not-exist.md' }` (or a thin/fake file) satisfies pure + assert gates once stamp is readable. CRITICAL→CLOSED is a prose-only path.

**RECOMMENDATION:** At assert CLI boundary (I/O OK): require reportPath exists under repo/state root, min content floor (Intent Package / Verdict / Residual markers), and that file’s current **Verdict** line matches stamp verdict; reject CLOSED if ledger residual section still lists open CRITICAL (or require hash of report at `verifiedAt`). Keep pure honesty I/O-free; add optional authenticity helper + tests.

---

### 5. Plan-root `fm.deliveryAuditGate` fallback spoofs per-phase gate (major)

**File:line:** `scripts/assert-automate-gate.js:1036–1041`.

**WHAT:** For `--gate phase-done`, if `phase.deliveryAuditGate` is null, assert uses `fm.deliveryAuditGate` (plan root).

**WHY:** Lifecycle `evaluationGateOf` deliberately treats plan `phases[]` entry as authoritative and **does not** allow top-level spoof when a phase entry exists (`scripts/lifecycle-order-guard.js:430–441`). Delivery assert does the opposite for missing phase stamps.

**IMPACT:** One plan-level stamp (or leftover root field) can unlock every subsequent phase’s assert without a fresh per-phase audit-delivery run.

**RECOMMENDATION:** Resolve only `phases[current].deliveryAuditGate` under nested plans; never fall back to plan root when a phase slice exists. Align with `evaluationGateOf` / `decisionReviewOf` authority rules. Test: phase B without stamp + root stamp ⇒ blocked.

---

### 6. Mode-1 / phase-done SSOT and post-claim writer docs omit delivery audit (major)

**File:line:** `skills/shared/project-assets/project-transitions.md` — **zero** matches for `deliveryAudit` / `audit-delivery`; `skills/shared/implement-phase-writer.md:181` lists `canRunPhaseDone` / `preflightPhaseDone` as requiring only evaluationGate **and** decisionReview.

**WHAT:** implement.md and implement-automate-maestro.md claim hard deliveryAuditGate on every phase-done. The actual phase-done transition asset and the post-claim orchestrator checklist do not require running audit-delivery or stamping the gate.

**WHY:** Agents following project-transitions as Mode-1 SSOT never encounter the new hard-gate; agents following implement-phase-writer post-claim order stop at decision-review → preflight without audit-delivery.

**IMPACT:** “NEVER skippable on Mode-1 + pure-maestro” is prose-only for Mode-1 and incomplete for orchestrator checklists; drift increases skip rate in production sessions.

**RECOMMENDATION:** Insert an explicit phase-done step (Mode-1 + automate) in project-transitions: run audit-delivery → stamp `phases[].deliveryAuditGate` via `buildDeliveryAuditGate` → assert `--gate phase-done` before commit guard. Update implement-phase-writer post-claim list to include delivery audit before preflight. Add lint/transition-emits coverage if other gates are grepped that way.

---

## Non-findings / notes (not elevated)

- Pure honesty correctly rejects `status: skipped`, `operatorSkip: true`, empty reportPath, OPEN, and missing gate under durable automate (`phase-delivery-audit-gate.js` + unit tests).
- `canRunPhaseDone` order places delivery audit after decisionReview (`automate-orchestrator-gates.js:481–486`).
- Residual protocol / Accept Record CRITICAL→CLOSED ban is clear in skill assets; gap is machine enforcement (finding 4), not prose contradiction.
- Asset static reachability test (`tests/audit-delivery-assets.test.js`) is non-tautological for orphan assets; does not cover gate authenticity.

## Files reviewed (primary + call chain)

src/phase-delivery-audit-gate.js; src/automate-orchestrator-gates.js; scripts/assert-automate-gate.js; scripts/lifecycle-order-guard.js; scripts/validate-state.js (GATE-R sections); meta/schemas/plan.schema.json; meta/catalog.yaml (audit-delivery); skills/core/audit-delivery.md; skills/core/implement.md (HARD-GATE); skills/shared/implement-automate-maestro.md; skills/shared/implement-phase-writer.md; skills/shared/implement-antipatterns.md; skills/shared/project-assets/project-transitions.md; skills/shared/audit-delivery-assets/{verdict-gate,residual-hunt-protocol,reaudit-entry,intent-package,matrices,report-template}.md; tests/{phase-delivery-audit-gate,audit-delivery-assets,automate-orchestrator-gates,decision-review-gate}.test.js; tests/fixtures/implement-phase-agents/phase-done-allowed.json; src/plan-end-review.js (`isDurableAutomateActive`); src/phase-evaluation-gate.js (authenticity comparison).
