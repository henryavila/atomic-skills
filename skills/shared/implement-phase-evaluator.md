# Phase evaluation agent — read-only assessment (lazy asset)

Consumed by `skills/core/implement.md` when `isAutomateActive` (pure maestro Step F). The **evaluation agent** is a **separate** agent from the phase writer: fresh context, **read-only**, structured pass/fail against the phase goal, exit gates, and `businessIntent` spine.

Not a top-level skill. Distinct from `review-code` (diff adversarial review) and from the phase writer (code-only implementation).

---

## Fixed order (HARD)

Under automate, phase close order is fixed:

1. **All phase tasks `done`** — each closed by the orchestrator via post-merge verifier pass (+ complex-task review when required). Writer claims alone never suffice.
2. **Evaluation agent** (this contract) — fresh context, not the writer; structured pass/fail vs phase goal + exit gates + `businessIntent`.
3. **Stamp `phases[<id>].evaluationGate`** on the parent plan via `buildEvaluationGate` (`src/phase-evaluation-gate.js`):
   - **closing shape (only path under durable automate stamp):** `{ status: passed, verdict: pass, at: <HEAD>, verifiedAt: <ISO> }`
   - **non-closing shapes** (may be recorded via `buildEvaluationGate` for audit / residual path; **do not** satisfy close while the stamp holds):
     - rare skip → `{ status: skipped, reason: <non-empty> }` (operator-recorded, never silent)
     - residual after disposition → `{ status: failed-dispositioned, disposition: accept|defer|fix, reason: <non-empty> }`
   Machine check under durable automate: `phaseEvaluationAllowsClose` / `canRunPhaseDone` return `ok: true` **only** for `{ status: passed, verdict: pass }`. `skipped` and `failed-dispositioned` return `ok: false` — evaluation is mandatory under the stamp; clear `executionMode` (leave automate) before accepting residual risk.
4. **decision-review** mandatory **manual hardgate** — **operator PASS only**; the agent never writes decision-review PASS (silent auto-PASS forbidden).
5. **Then** `phase-done` with `review-code --mode=both` (automate default — **not** `external-both`; plan-end is the only `external-both` gate).

Do not run phase-done before the evaluation agent completes, `evaluationGate` is stamped with **`{ status: passed, verdict: pass }`** (explicit skip/disposition alone never enables phase-done under durable automate — clear executionMode first if residual must be accepted), **and** decision-review has operator PASS.

---

## What the evaluation agent is

| Does | Does not |
|------|----------|
| Read phase initiative, plan phase descriptor, MERGED product tree, claim reports, task evidence | Edit product source |
| Assess goal / exit gates / `businessIntent` (`value`, `workflow`, `rules`, `outOfScope`, `doneWhen`) | Write durable `.atomic-skills/` state, handoff, rollups, lessons |
| Return structured pass/fail + findings (severity + path/reason) | Call `done`, `phase-done`, finalize, archive |
| Surface drift from ratified spine | Self-certify the phase as closed |

**Never writes product source or project state.** The orchestrator alone logs dispositions and runs transitions.

---

## Structured assessment shape

```text
evaluationReport:
  planSlug, phaseId
  verdict: pass | fail
  findings: [
    {
      severity: blocker | critical | major | minor | note,
      area: goal | exitGate | businessIntent | scope | other,
      path?: string,          # verbatim when code/docs cited
      gateId?: string,        # exit gate id when applicable
      summary: string         # factual; no soft "looks good"
    },
    ...
  ]
  businessIntentCheck: {
    value, workflow, rules, outOfScope, doneWhen  # each: pass | fail | n/a + note
  }
  exitGates: [ { id, status: pass | fail | not-run, note? }, ... ]
```

- **Blocker** and **critical** findings block `phase-done` until fixed or operator-dispositioned.
- **Major** findings surface for operator triage (accept/defer/fix) and require a recorded disposition before phase-done.
- Soft language (`should` / `probably` / `looks done`) is banned in the verdict narrative (G2).

---

## Reopen protocol (on blocker/critical)

When the evaluation agent returns blocker or critical findings:

1. Orchestrator **reopens** affected tasks (status back to active) **or** creates blocking follow-up tasks with full SPEC admission (paths, `scopeBoundary`, `acceptance`, `verifier`) — do not improvise without SPEC.
2. Re-dispatch a **code-only** fix agent (same fence as `implement-phase-writer.md`) — max **2** re-dispatches, then mandatory operator stop.
3. After fix merge: re-run task verifiers and complex-task reviews on the fix range (post-merge mandatory).
4. Re-run the evaluation agent (or a scoped re-evaluation) until pass or operator disposition.
5. **Only then** allow `phase-done` with `review-code --mode=both`.

Never silent Mode-1 self-code under automate. Never mark the phase done because the evaluator "mostly" passed.

---

## Decision-log visibility

Every evaluation-related disposition the orchestrator takes must land in durable state the operator can audit:

- Initiative `## Session handoff` **decision log**, and/or
- A durable phase decisions block under `.atomic-skills/` owned by the orchestrator.

Record at least: routing choices, skip of evaluation (if any) with non-empty reason, re-dispatch count + why, scope-exit events, review/evaluation severity dispositions (accept/defer/fix).

---

## Plan end — user validates (after last phase)

After the last phase completes under automate:

1. Plan-end `external-both` + machine gate `planEndReviewOk` (`src/plan-end-review.js`).
2. **User validates** implementation and the durable decisions log (`userValidationOk` in `src/plan-end-review.js` — non-empty validation timestamp when automate is active).
3. Only then may the operator finalize / archive.

**Finalize and archive never auto-run** after the last phase turns green. The evaluation agent pass is necessary for phase-done order; it is **not** a substitute for the end-of-plan gate where the **user validates** implementation.

---

## Constructed brief (spawn)

Orchestrator builds a read-only brief:

1. Phase goal, exit gates, full `businessIntent` spine (verbatim).
2. List of closed task ids + evidence pointers + MERGED commit range.
3. Paths/files to inspect (optional focused list).
4. Output: `evaluationReport` shape above.

**MUST NOT** include orchestrator chat history or instruct the evaluator to edit files / call project transitions.

Portable primitives: {{BASH_TOOL}}, read-only {{INVESTIGATOR_TOOL}} / isolated subagent. Host-only APIs stay behind host-conditional ide blocks (`ide.*`).

---

## Cross-links

- Maestro Steps F–I: `skills/core/implement.md`
- Phase writer (code-only, never done): `skills/shared/implement-phase-writer.md`
- Plan-end predicates: `src/plan-end-review.js` (`planEndReviewOk`, `userValidationOk`)
- Antipatterns: silent Mode-1, self-certify — `skills/shared/implement-antipatterns.md`
