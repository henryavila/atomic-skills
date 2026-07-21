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

Only if automate becomes the default path for many plans:

- Workqueue + durable step cursor in `.atomic-skills/status/`
- Provider-specific spawn adapters (Claude Task, Codex, Grok subagent)
- Crash recovery from lease + handoff

**Do not start Layer 4** until Layers 1–2 have dogfood evidence of real failures
(skipped evaluation, finalize without plan-end, claim without merge).

## What not to do

- A second top-level skill `automate.md` that reimplements implement
- Silent Mode-1 fallback when writer fails
- Auto-materialize with LLM-filled `businessIntent` (spine is operator authority)
- Pretending prose = runtime in marketing docs

## Operator mental model

1. **Materialize** each phase (you own `businessIntent`).
2. **`implement --mode=automate`** once per plan (stamp).
3. Maestro follows A–I; STOP helpers refuse illegal jumps when invoked.
4. **Finalize** only after durable plan-end `external-both` (codex|grok|claude legs) + your validation timestamp.

If a step is skipped, prefer **fail closed** (blocked gate) over “looks done”.
