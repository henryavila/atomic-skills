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

### Layer 2 — Thin CLI “assert” (**landed** — F0)

```bash
node scripts/assert-automate-gate.js --plan <slug> --gate spawn|claims|done|phase-done|finalize
```

**Path:** `scripts/assert-automate-gate.js` (unit tests: `tests/assert-automate-gate.test.js`).
Wraps Layer-1 helpers: lease read → `canSpawnPhaseWriter`; claim report →
`canCloseTasksFromClaims`; plan `evaluationGate` → `canRunPhaseDone`; plan-end
receipt + `userValidatedAt` → `canFinalizeOrArchive`.

Reads disk state, prints `ok` / `blocked: <reason>`, exit 1 on block. Skill prose
(`implement` pure-maestro Steps **C / E / G / I**, `project-transitions` /
`project-finalize`) **requires** this assert before spawn, done-batch,
phase-done, and finalize under automate — non-zero forbids advancing. Still no
spawn of writers (orchestration remains skill-driven).

### Layer 2.5 — Thin maestro step cursor (**landed** — F3 / R2)

**Not Layer 4.** A durable per-plan status file records pure-maestro position so
assert can refuse illegal step jumps without a spawn supervisor or multi-host
daemon.

| Piece | Path |
|-------|------|
| Module | `src/maestro-cursor.js` |
| Tests | `tests/maestro-cursor.test.js` |
| Status file | `.atomic-skills/status/automate/<plan-slug>.json` |

Shape: `{ step, phaseId, redispatchCount, claimReportPath?, leasePath?, updatedAt }`
with steps A–I plus pause `awaiting-operator-advance`. Legal transition table
rejects jumps (e.g. C→G). Under durable `executionMode: automate`,
`assert-automate-gate` reads the cursor and blocks spawn/done/phase-done/finalize
when the step does not match (spawn needs **C**, done **E**, phase-done **G**,
finalize **I**). Missing cursor initializes at **A** without throw; skill prose
must advance the cursor on each A–I boundary. Non-automate plans never require a
cursor. **Do not** treat this as Layer 4 workqueue + provider spawn adapters —
those remain non-goals until dogfood proves Layer 1–2.5 insufficient.

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

- Workqueue + multi-host recovery beyond the thin Layer 2.5 cursor
- Provider-specific spawn adapters (Claude Task, Codex, Grok subagent)
- Crash recovery from lease + handoff as a supervised loop

**Do not start Layer 4** until Layers 1–2 (+ thin cursor 2.5) have dogfood
evidence of real failures the status file cannot catch (skipped evaluation,
finalize without plan-end, claim without merge, host-local wait-loop needs).

## What not to do

- A second top-level skill `automate.md` that reimplements implement
- Silent Mode-1 fallback when writer fails
- Auto-materialize with LLM-filled `businessIntent` (spine is operator authority)
- Pretending prose = runtime in marketing docs

## Operator mental model

1. **Materialize** each phase (you own `businessIntent` — automate never invents spine).
2. **`implement --mode=automate`** once per plan (stamp). Mode 1 is the **execution driver**; automate is **pure maestro** (orchestrator-only).
3. Maestro follows A–I; STOP helpers + **`assert-automate-gate`** + **maestro cursor** refuse illegal jumps when invoked (spawn/done/phase-done/finalize).
4. After phase-done, cursor sits at **`awaiting-operator-advance`** (pause) until you **continue** via `clearContinue` (`operator-continue` token). No multi-phase auto-run; no auto-materialize; generic ok is not enough.
5. **Finalize** only after durable plan-end `external-both` (codex|grok|claude legs) + your **`userValidatedAt`** validation timestamp (`assert-automate-gate --gate finalize`).

**Assert + cursor + pause** are the cheap fail-closed trio: Layer-2 CLI, Layer-2.5 step file, post phase-done operator authority. If a step is skipped, prefer **fail closed** (blocked `assert-automate-gate` / illegal cursor step / `awaiting-operator-advance`) over “looks done”.

### Lessons distill (hard under automate — no skip)

Dogfood: pure-maestro multi-phase skipped phase-end lessons (no `Proposed lessons:`, no operator ratify, no `lessons/` file). That is a skill-step skip, not a clean phase.

Under durable `executionMode: automate`, `canRunPhaseDone` / `assert-automate-gate --gate phase-done` / `preflightPhaseDone` require an **answered** lessons gate before advance:

| `lessonsState` | Required |
|----------------|----------|
| `recorded` | non-empty `lessonsPath` after distill + operator ratify → `lessons/<initiative>.md` |
| `none` | explicit zero-lessons (clean phase) — **omitting the field is invalid** |

Helpers: `src/phase-lessons-gate.js` (`phaseLessonsAllowsClose`, `buildLessonsState`). Code: `phase-done-lessons-open`.
