# Operator dogfood checklist — implement-phase-agents

**Status:** checklist only — does **not** claim dogfood already passed.  
**Plan slug:** `implement-phase-agents`  
**Mode:** `implement --mode=automate` (host-thin pure maestro)

Use this on a **real multi-phase plan** under durable `executionMode: automate`.
Mark each item **PASS** or **FAIL**. Soft language (“looks fine”) is invalid.

## Hard UX rule (max 2 human stops per phase)

| Stop | When | Operator action | Not allowed |
|------|------|-----------------|-------------|
| **1. Package ratify** | Phase start (descriptor-only or new phase) | Validate drafted BI spine + objective/task list; **one** clear ratify (`ratify` / `aprovado` / clear accept) | Blank BI form; inventing task spine; mid-phase micro-acks |
| **2. Decision-log PASS** | Phase end (after tasks + eval + review-code both) | Read decision log; **one** clear PASS or FAIL | Literal-token-only ceremony; auto-PASS by host |

- **Max 2 human stops per phase** (package ratify + decision-log PASS).
- **No mid-phase micro-approvals** (per-finding “ok?”, per-fix re-approval, evaluation “ok?”, both-review “ok?” when no disposition required).
- **Clear PASS language** is enough (`aprovado`, `PASS`, `decision-review PASS`). Do **not** require only the magic string `decision-review PASS`.

Related session note: `.ai/memory/reference-implement-phase-agents-dogfood-stops.md`.

## Preflight (machine gates)

Run against the live plan (replace `<slug>` / `<project>`):

```bash
node scripts/assert-automate-gate.js --plan <slug> --project <project> --gate spawn
node scripts/assert-automate-gate.js --plan <slug> --project <project> --gate phase-done
# After claims exist (post-merge):
# node scripts/assert-automate-gate.js --plan <slug> --project <project> --gate done --claim-report <path>
# Plan end:
# node scripts/assert-automate-gate.js --plan <slug> --project <project> --gate finalize
```

| # | Check | PASS | FAIL |
|---|--------|------|------|
| P1 | `assert-automate-gate --gate spawn` **blocks** while active phase is descriptor-only / initiative missing | ☐ | ☐ |
| P2 | After package ratify + materialize + clean lease, `--gate spawn` **exits 0** | ☐ | ☐ |
| P3 | With `decisionReview` pending (or missing) under automate, `--gate phase-done` **exits non-zero** | ☐ | ☐ |
| P4 | After operator PASS stamps `decisionReview` **and** `evaluationGate` is passed+pass, `--gate phase-done` **exits 0** | ☐ | ☐ |

## Host-thin + phase agent (product path)

| # | Check | PASS | FAIL |
|---|--------|------|------|
| H1 | **Host did not edit product source** (maestro session: no product file content commits; only dispatch/merge/verify/state) | ☐ | ☐ |
| H2 | **Phase agent was spawned** (fresh phase writer for the phase; not host self-coding the work-order tasks) | ☐ | ☐ |
| H3 | Host did **not** run product diagnostic entrypoints except **verbatim** task verifiers | ☐ | ☐ |
| H4 | No second concurrent phase writer; lease clean before spawn (`assert-automate-gate --gate spawn`) | ☐ | ☐ |

## Phase-start package (multi-phase plan)

| # | Check | PASS | FAIL |
|---|--------|------|------|
| S1 | **Phase-start package draft** presented: phase objective + task list (id+title) + drafted `businessIntent` | ☐ | ☐ |
| S2 | Package was **draft only** while descriptor-only — **no durable BI write** before ratify | ☐ | ☐ |
| S3 | Operator path was **validate-only** on BI spine (blank form forbidden) | ☐ | ☐ |
| S4 | **Validate-only ratify observed** (one explicit accept; titles advisory / re-spec for durable rename) | ☐ | ☐ |
| S5 | After ratify, host materialize used **pre-ratified spine** (Mode B) — not Mode A blank invent under automate | ☐ | ☐ |
| S6 | No mid-phase micro-approvals between package ratify and decision-review | ☐ | ☐ |

## Decision log + decision-review

| # | Check | PASS | FAIL |
|---|--------|------|------|
| D1 | **Decision log has entries** under `.atomic-skills/projects/<id>/<slug>/decisions/<phaseId>.jsonl` | ☐ | ☐ |
| D2 | Re-dispatch / disposition / scope-exit events (if any) appear in the log with required fields | ☐ | ☐ |
| D3 | Host/agent **never** wrote `decisionReview status=passed` without operator token in the **same turn** | ☐ | ☐ |
| D4 | **Operator PASS on decision-review** recorded with clear PASS language (not literal-token-only) | ☐ | ☐ |
| D5 | On FAIL, `decisionReview` stamped failed and `currentPhase` did **not** advance | ☐ | ☐ (N/A if PASS path) |

## Phase close order

| # | Check | PASS | FAIL |
|---|--------|------|------|
| C1 | All phase tasks `done` **before** evaluation agent | ☐ | ☐ |
| C2 | Evaluation agent ran; `phases[].evaluationGate` stamped `{ status: passed, verdict: pass }` | ☐ | ☐ |
| C3 | Decision-review operator PASS **after** evaluationGate | ☐ | ☐ |
| C4 | `assert-automate-gate --gate phase-done` **ok** before `phase-done` | ☐ | ☐ |
| C5 | `phase-done` used `review-code --mode=both` (not `external-both` at phase close) | ☐ | ☐ |

## Aggregate dogfood result

| Outcome | Mark |
|---------|------|
| **DOGFOOD PASS** — every applicable row above is PASS | ☐ |
| **DOGFOOD FAIL** — any required row is FAIL | ☐ |

Do **not** mark DOGFOOD PASS in memory, plan status, or PR text until this checklist has been used on a real plan and all required rows are PASS.

## References

- Skills: `skills/core/implement.md`, `skills/shared/implement-automate-maestro.md`, `skills/shared/implement-decision-log.md`
- STOP helpers: `src/automate-orchestrator-gates.js` (`canSpawnHostThinPhaseWriter`, `canRunPhaseDone`)
- CLI: `scripts/assert-automate-gate.js` (`--gate spawn|done|phase-done|finalize`)
- Fixture tests: `tests/implement-phase-agents-contract.test.js`
- Memory: `.ai/memory/reference-implement-phase-agents.md`, `.ai/memory/reference-implement-phase-agents-dogfood-stops.md`
- Operator realism: `docs/kb/automate-orchestrator-realism.md`
