# Phase evaluation agent — read-only assessment (lazy asset)

Consumed by `skills/core/implement.md` when `isAutomateActive` (pure maestro Step F). The **evaluation agent** is a **separate** agent from the phase writer: fresh context, **read-only**, structured pass/fail against the phase goal, exit gates, and `businessIntent` spine.

Not a top-level skill. Distinct from `review-code` (diff adversarial review) and from the phase writer (code-only implementation).

---

## Fixed order (HARD)

Under automate, phase close order is fixed:

1. **All phase tasks `done`** — each closed by the orchestrator via post-merge verifier pass (+ complex-task review when required). Writer claims alone never suffice.
2. **Evaluation agent** (this contract) — fresh context, not the writer; structured pass/fail vs phase goal + exit gates + `businessIntent`.
3. **Persist `evaluationReport` on disk** under `.atomic-skills/reviews/` (path like `.atomic-skills/reviews/eval-<planSlug>-<phaseId>.md` or equivalent documented path). The evaluator (or orchestrator on its behalf after the structured return) **must write this file before** any gate stamp. Soft "looks good" narrative is not a report.
4. **Stamp `phases[<id>].evaluationGate`** on the parent plan via `buildEvaluationGate` (`src/phase-evaluation-gate.js`) — **only after** the report path exists:
   - pass → `{ status: passed, verdict: pass, reportPath: <non-empty path to evaluationReport>, at: <HEAD>, verifiedAt: <ISO> }`
   - rare skip → `{ status: skipped, operatorSkip: true, reason: <non-empty> }` (operator-owned only; never silent; never reason-alone)
   - residual after disposition → `{ status: failed-dispositioned, disposition: accept|defer|fix, reason: <non-empty> }`
   Machine check: `phaseEvaluationAllowsClose` / `evaluationGateHonesty` / `canRunPhaseDone` must return `ok: true` before phase-done. Authenticity (R3): **passed without non-empty `reportPath` is forge and is rejected**; **skipped without `operatorSkip: true` + non-empty reason is forge and is rejected**.
5. **Then** `phase-done` with `review-code --mode=both` (automate default — **not** `external-both`; plan-end is the only `external-both` gate).

Do not run phase-done before the evaluation agent completes, the **evaluationReport is on disk**, **and** `evaluationGate` is stamped with authenticity fields (or the operator records an explicit `operatorSkip`+reason / disposition — rare; still not silent).

---

## What the evaluation agent is

| Does | Does not |
|------|----------|
| Read phase initiative, plan phase descriptor, MERGED product tree, claim reports, task evidence | Edit product source |
| Assess goal / exit gates / `businessIntent` (`value`, `workflow`, `rules`, `outOfScope`, `doneWhen`) | Write durable `.atomic-skills/` state, handoff, rollups, lessons |
| Return structured pass/fail + findings (severity + path/reason) | Call `done`, `phase-done`, finalize, archive |
| Surface drift from ratified spine | Self-certify the phase as closed |

**Never writes product source or durable project state** (plan frontmatter, handoff, rollups, tasks). The structured `evaluationReport` file under `.atomic-skills/reviews/` is the allowed evidence artifact the orchestrator points to via `evaluationGate.reportPath` — the evaluator still does **not** stamp `phases[].evaluationGate` itself. The orchestrator alone logs dispositions, stamps the gate, and runs transitions.

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

### Persist report before gate stamp (HARD — authenticity R3)

1. Write the structured report to **`.atomic-skills/reviews/`** (e.g. `.atomic-skills/reviews/eval-<planSlug>-<phaseId>.md`) with the shape above.
2. Return the **absolute or repo-relative `reportPath`** to the orchestrator.
3. Orchestrator stamps via `buildEvaluationGate({ status: 'passed', verdict: 'pass', reportPath, at, verifiedAt })` — `buildEvaluationGate` **requires** non-empty `reportPath` for `passed` and refuses forge-friendly partial stamps.
4. Do **not** stamp `evaluationGate` with `status: passed` without a real report path. Do **not** invent `skipped` without operator mandate (`operatorSkip: true` + non-empty reason).

Evaluation pass does **not** finalize the plan and does **not** auto-run `phase-done` — it only unlocks the Step G assert + phase-done order.

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

Record at least: routing choices, skip of evaluation (if any) with **`operatorSkip: true` + non-empty reason** (and stamp those fields on `evaluationGate`), re-dispatch count + why, scope-exit events, review/evaluation severity dispositions (accept/defer/fix), and the `reportPath` when evaluation passed.

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
