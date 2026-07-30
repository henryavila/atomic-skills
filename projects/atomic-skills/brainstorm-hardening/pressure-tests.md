# brainstorm-hardening — pressure-tests (F3 / T-010)

> **Date:** 2026-07-30. **Method:** additive scenarios only (design Decision 12 / source.md F3).  
> **ScopeBoundary:** do **not** re-run the full Inc3 suite (`docs/design/project-orchestrator/08-inc3-pressure-tests.md`). These scenarios pressure-test **new** skip paths and fidelity escapes from brainstorm-hardening (Interview always, research-digest, always debate, design-gates detectors, thin router + assert-creation-stage, more-text-worse).  
> **Outcome expected of the shipped package:** each rationalization below maps to a named **Red-Flag**, **detector exit ≠ 0**, or **`assert-creation-stage` fail** — not to “remember the long paragraph.”

## Scope — what was tested vs exempt

**Owned (this record):** skip Interview under time pressure; skip debate because “obvious”; empty research digest theater; skip creation stage without assert; monólito / more-text increases ignore (router fidelity).

**Exempt (cite, do not re-grade):** Inc3 premature-convergence / critic-ceiling / WHAT-before-HOW blocks already recorded in `08-inc3-pressure-tests.md`. R-ORCH-03 lanes (ad-hoc / single-task / `adopt`) remain DESIGN-exempt — not false-positives for these detectors.

## Method (lightweight)

Each scenario stacks **≥3 pressure factors** (time · authority · plausibility · fatigue · sunk-cost).  
**RED** = rationalization an agent under pressure would use to skip the gate.  
**GREEN** = explicit counter already shipped: Red-Flag text, detector, or `assert-creation-stage` exit code.  
This file is a **mapping record** (dogfood / announce evidence), not a live multi-agent RED→GREEN re-run of Inc3.

## Scenarios (≥5 required)

### PT-1 — Skip Interview under time pressure

| Field | Content |
|-------|---------|
| **id** | PT-1 |
| **factors** | time + authority + plausibility |
| **RED rationalization** | “User said ship the plan today / lead already knows the problem — **skip interview**, invent Context from the goal arg, go straight to write-up.” |
| **Counter (GREEN)** | Red-Flag in `skills/core/brainstorm.md`: *“I'll skip the Interview — the goal arg is enough.”* HARD-GATE: multi-phase always runs B0 Interview. Bare `ok`/`yes` without spine ≠ acceptance (`interview.md`). |
| **Detector / fail** | `find-missing-design-process.js` exits **1** when `interviewAccepted` missing on design-gates receipt; Stage 4 / B5 HARD-BLOCK. `find-weak-design.js` fails short/missing Interview section. |
| **verdict** | **countered** (Red-Flag + design-gates / find-missing / find-weak) |

### PT-2 — Skip debate because “obvious”

| Field | Content |
|-------|---------|
| **id** | PT-2 |
| **factors** | plausibility + fatigue + time |
| **RED rationalization** | “There's clearly one right approach / cheap to reverse — **skip debate**, document the approach cleanly.” |
| **Counter (GREEN)** | HARD-GATE + Red-Flag: *“There's clearly one right approach, I'll just write it up.”* and *skip Interview/research-digest/**debate** because one approach is obvious* → STOP. Multi-phase **always** `debate --gate`; no skip ladder. |
| **Detector / fail** | `find-missing-design-process.js` exits **1** when `debateGate` not recorded / receipt not ready. Stage 4 HARD-BLOCK on missing process. |
| **verdict** | **countered** (Red-Flag + find-missing-design-process) |

### PT-3 — Empty research digest theater

| Field | Content |
|-------|---------|
| **id** | PT-3 |
| **factors** | sunk-cost + plausibility + time |
| **RED rationalization** | “We already know the code — write an **empty digest** / one filler bullet / zero repo paths so B0b looks done.” |
| **Counter (GREEN)** | Red-Flag: *“Research digest can be empty / one filler bullet — we already know the code.”* B0b: weak if zero paths, &lt;3 useful bullets, or filler; weak/empty digest blocks B1. |
| **Detector / fail** | `find-weak-design.js` fails **weak digest** (empty digest theater). `find-missing-design-process.js` fails missing `researchDigest` on design-gates. |
| **verdict** | **countered** (Red-Flag + find-weak-design + find-missing) |

### PT-4 — Skip creation stage without assert

| Field | Content |
|-------|---------|
| **id** | PT-4 |
| **factors** | time + authority + plausibility |
| **RED rationalization** | “Stages are obvious — **skip assert-creation-stage**, jump slug → ready in prose / mark plan ready without advancing the monotonic stage.” |
| **Counter (GREEN)** | Router Red-Flag: *“I'll skip assert-creation-stage and mark the plan ready in prose.”* Rationalization row: *“Skip assert-creation-stage — stages are obvious”* → agents skip prose; **exit codes do not**. |
| **Detector / fail** | `scripts/assert-creation-stage.js` exits **1** on illegal skip (e.g. `slug` → `ready`) or early `--ready`. Resume reads creation-gates `stage` as authority. |
| **verdict** | **countered** (assert-creation-stage fail + router Red-Flag) |

### PT-5 — More text in monólito increases ignore

| Field | Content |
|-------|---------|
| **id** | PT-5 |
| **factors** | fatigue + sunk-cost + plausibility |
| **RED rationalization** | “Load the whole create-plan monólito + every stage-N at once / paste more Red-Flag walls so nothing is missed.” Under load the agent **ignores** middle sections (Interview, detectors, assert) anyway. |
| **Counter (GREEN)** | Design Decision 10 + router fidelity rule: thin router; read **only** `new-plan/stage-N.md` for current stage. Red-Flag: *“I'll load every stage-N.md at once to save turns.”* Decision 12: fidelity = **exit code / receipt**, not more Red Flags. |
| **Detector / fail** | Structural: monólito path removed as load-bearing; stage skip still fails `assert-creation-stage`; Stage 4 still runs lint + `find-missing-design-process` + `find-weak-design` regardless of ignored prose. |
| **verdict** | **countered** (thin stage-N router + assert-creation-stage + Stage 4 detectors; more text alone is non-goal) |

### PT-6 (bonus) — Skip Stage 4 detectors after “approved design”

| Field | Content |
|-------|---------|
| **id** | PT-6 |
| **factors** | authority + time + plausibility |
| **RED rationalization** | “User already said the design is fine / critic approved — skip `find-missing-design-process` / `find-weak-design` at Stage 4 and decompose.” |
| **Counter (GREEN)** | Stage 4 HARD-BLOCK chain: `lint-design` → `find-missing-design-process` → `find-weak-design` → `lint-source` (see router + `stage-4.md`). B5 handoff same detectors. |
| **Detector / fail** | Any non-zero exit HARD-BLOCKs Stage 4 / brainstorm B5. |
| **verdict** | **countered** (Stage 4 detector HARD-BLOCK) |

## Summary table

| id | escape | maps to |
|----|--------|---------|
| PT-1 | skip interview (time pressure) | Red-Flag + find-missing / find-weak |
| PT-2 | skip debate (obvious) | Red-Flag + find-missing (`debateGate`) |
| PT-3 | empty digest theater | Red-Flag + find-weak-design (weak digest) |
| PT-4 | skip creation stage without assert | **assert-creation-stage** exit 1 |
| PT-5 | monólito more text → ignore | thin stage-N router + exit-code gates |
| PT-6 | skip Stage 4 detectors | lint + find-missing + find-weak HARD-BLOCK |

## Non-goals for this record

- Re-running Inc3 multi-agent RED/GREEN loops.
- Adding more Red-Flag walls as the primary fidelity mechanism (design Decision 12).
- Changing Stage 8 `review-plan` behavior.
