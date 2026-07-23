# Automate orchestrator: prose vs runtime (realistic path)

**Status:** living note after the H1/H2/M* remediation (2026-07).  
**Related:** `skills/core/implement.md` pure-maestro Steps A–I, `src/automate-orchestrator-gates.js`.

## The honest problem

`implement --mode=automate` is **skill-driven orchestration**: the host agent is
the maestro. There is **no** long-running Node process that spawns writers,
waits on leases, and refuses illegal transitions by force.

What *is* machine-checked today:

| Layer | What | Enforceability |
|-------|------|----------------|
| Pure helpers | mode, claim report, lease acquire, plan-end predicates, evaluation gate, `automate-orchestrator-gates` | Strong if the agent *calls* them |
| Schema / validate-state | executionMode, planEndReview shape, evaluationGate shape, reviewGate GATE-R3 | Strong on disk state |
| Skill prose | Steps A–I, code-only fence, materialize refuse | Soft — model discipline |
| Full maestro runtime | spawn + sync-wait + merge loop | **Not built** |

Building a full autonomous orchestrator (daemon, multi-host spawn, merge
supervisor) is a **multi-month product**, not a cleanup PR. It also fights the
repo’s host model (Claude / Codex / Grok each own process tools differently).

## What to do instead (phased, realistic)

### Layer 1 — Hard STOP helpers (done / keep growing)

Pure functions the skill **must** call before advancing. Already landed:

- `canSpawnPhaseWriter` — lease status
- `canCloseTasksFromClaims` — claim validate + optional reachability
- `canRunPhaseDone` — evaluationGate under durable stamp
- `canFinalizeOrArchive` — plan-end + user validation (stamp-first)

**Next cheap wins:** wire the same predicates into `validate-state` as
**warnings → errors** under `executionMode: automate` (evaluationGate present
on done phases; planEndReview when status archived/finalizing).

### Layer 2 — Thin CLI “assert” (1–2 days)

```bash
node scripts/assert-automate-gate.js --plan <slug> --gate spawn|done|phase-done|finalize
```

Reads disk state, prints ok/blocked + reason, exit 1 on block. Agents run it
before transitions; CI can run finalize gate on stamped plans. Still no spawn.

### Layer 3 — Host-local runner (weeks, optional)

A **per-host** script (not cross-host daemon) that:

1. Builds work-order from initiative
2. Acquires lease
3. Prints a sealed phase-writer brief to stdout / file
4. Waits for claim-report path drop
5. Validates claims, prints merge commands

Human or agent still runs git merge and `done`. Reduces “forgot step D.5”.

### Layer 4 — Full maestro (only if product-critical)

**Non-goal for the current implement-phase-agents plan.** Layer 4 full daemon
(workqueue + multi-host spawn + crash recovery) is **not** in scope and is **not**
implemented by host-thin phase agents / phase-start package work.

Only if automate becomes the default path for many plans *after* Layers 1–2 dogfood:

- Workqueue + durable step cursor in `.atomic-skills/status/`
- Provider-specific spawn adapters (Claude Task, Codex, Grok subagent)
- Crash recovery from lease + handoff

**Do not start Layer 4** until Layers 1–2 have dogfood evidence of real failures
(skipped evaluation, finalize without plan-end, claim without merge).

## What not to do

- A second top-level skill `automate.md` that reimplements implement
- Silent Mode-1 fallback when writer fails
- Silent auto-materialize / silent auto-PASS / blank-fill of `businessIntent` (skill may draft; operator validate-only only)
- Pretending prose = runtime in marketing docs
- Claiming Layer 4 full daemon is shipped when only skill prose + STOP helpers exist

## Operator mental model

Under automate the operator model is **host-thin phase agents** plus a
**phase-start package** ritual — not a full maestro daemon (Layer 4 remains a
non-goal for this plan).

1. **Phase-start package ritual (draft + ratify allowed; silent auto-PASS not).**
   At **phase-start**, the skill presents a **draft** package: phase **objective**
   + **task list** (id + title, titles advisory) + a **drafted** `businessIntent`.
   Your role is **validate-only** for the BI spine (edit fields, then explicit
   ratify). **No durable BI write** and **no materialize publish** while the phase
   is still descriptor-only until you ratify. After ratify, the host materializes
   from the sidecar with your **ratified** spine (not a blank invent form). Durable
   title renames require re-spec. Blank-fill BI and silent auto-PASS are forbidden
   — you own the spine, the skill drafts it. Draft+ratify is the intended path;
   silent auto-PASS is not.
2. **`implement --mode=automate`** once per plan (stamp). Host stays **host-thin**:
   no product source edits; no product diagnostic entrypoints except **verbatim**
   verifiers. One **fresh phase agent** per phase (constructed brief; no host
   chat history) only after package ratify (+ materialize when needed) and work-order.
3. Maestro follows A–I; STOP helpers refuse illegal jumps when invoked.
4. Before **phase-done** under automate, fixed order only:
   all phase tasks done → **evaluation agent** → stamp **`evaluationGate`**
   (`buildEvaluationGate` / `canRunPhaseDone`) → **decision-review** mandatory
   **manual hardgate** (only you write **operator PASS**; agents never write
   decision-review PASS) → **then** `phase-done` with `review-code --mode=both`.
5. **Finalize** only after durable plan-end `external-both` (codex|grok|claude legs) + your validation timestamp.
   **Skip is forbidden under durable automate:** `planEndReviewOk(..., { forbidSkip: true })` —
   `--skip-plan-end-review` with any reason does **not** open finalize/archive while
   `executionMode: automate` remains. Phase evaluation and phase-done `review-code`
   are likewise mandatory (`phaseEvaluationAllowsClose` only accepts passed+pass;
   `phaseReviewMode` never returns local/skip under automate).

If a step is skipped, **fail closed** (blocked gate) — never treat a skipped gate as “looks done”.

## Plan quality guards

- Skill may **draft** `businessIntent` in the phase-start package; operator is
  **validate-only** (BI field edit allowed, then ratify). Draft+ratify is allowed
  under F4; forbidden: silent auto-PASS of drafted BI, durable BI write / materialize
  publish **before** ratify, silent auto-materialize with unratified BI, and
  blank-fill BI forms under automate (Mode-1 bare materialize may still use the
  blank-form proof-of-work path).
- Quality HARD: `find-weak-business-intent.js` after presence.
- Fingerprint refuse emits D9 `fingerprint_refuse` (fail-open); report via `scripts/report-plan-quality.js`.
