# implement-phase-agents — host-thin phase agents reference

**Plan slug:** `implement-phase-agents`  
**Kind:** durable reference (catalog pointer + session recovery)

## What shipped (contract summary)

1. **Host-thin phase agents** — under `implement --mode=automate`, the host is pure maestro (dispatch / merge / verify / state only). Product source is owned by a **fresh** code-only phase writer per phase. No concurrent writers; lease + descriptor-only gates refuse illegal spawn.

2. **Decision-review hardgate** — before `phase-done` under durable automate, both must allow close:
   - `evaluationGate` `{ status: passed, verdict: pass }`
   - `decisionReview` `{ status: passed, verifiedAt }` from **operator PASS only**
   - Machine: `canRunPhaseDone` / `assert-automate-gate --gate phase-done`
   - Agents never write decision-review PASS without explicit operator token in the same turn.

3. **Two-stop dogfood UX** — max **2 human stops per phase**:
   - Stop 1: phase-start package **validate-only ratify** (draft BI + objective + task list)
   - Stop 2: decision-log **PASS** (clear language; not literal-token-only)
   - No mid-phase micro-approvals between those two.

4. **Phase-start package order** — draft only → operator validate-only → explicit ratify → **then** materialize with ratified spine (Mode B) if descriptor-only → work-order → lease → spawn. No durable BI write before ratify. Blank-form Mode A is not the automate path.

## Supersession

**Supersedes** any prior guidance that **forbade handing materialize to the user** as the sole full-plan automate path, or that treated bare `project materialize <phase>` (Mode A blank invent) as the automate successor UX.

- Under **automate**, host orchestrates **package → ratify → materialize Mode B** (pre-ratified spine). Operator validates the draft package; host does not dump a blank BI form and walk away.
- Mode 1 may still hand off bare `project materialize` (Mode A). That is **not** the full-plan automate contract.
- Prior dogfood stop note (two-stop UX only) remains valid and is **linked, not removed**:
  - [reference-implement-phase-agents-dogfood-stops.md](reference-implement-phase-agents-dogfood-stops.md)

Do **not** remove or rewrite that dogfood-stops note away; this file is the broader catalog pointer that includes it.

## Operator dogfood

Checklist (pass/fail; does not claim already passed):

- `docs/kb/implement-phase-agents-dogfood.md`

Machine fixtures (descriptor-only spawn block + decision-review block):

- `tests/implement-phase-agents-contract.test.js`
- `tests/fixtures/implement-phase-agents/`

## Key paths

| Surface | Path |
|---------|------|
| Maestro | `skills/shared/implement-automate-maestro.md` |
| Phase writer | `skills/shared/implement-phase-writer.md` |
| Decision log | `skills/shared/implement-decision-log.md` |
| STOP helpers | `src/automate-orchestrator-gates.js` |
| Assert CLI | `scripts/assert-automate-gate.js` |
| Lazy materialize | `docs/kb/project-lazy-materialization.md` |
| Realism / layers | `docs/kb/automate-orchestrator-realism.md` |

## Recovery

On resume of plan `implement-phase-agents` with `executionMode: automate`:

1. Re-read this note + dogfood-stops note.
2. Check active phase handoff `nextAction` (package ritual vs spawn vs decision-review).
3. Preflight with `assert-automate-gate` before spawn / phase-done.
4. Do not re-introduce mid-phase micro-approvals or literal-token-only ceremony.
