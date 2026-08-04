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
| Schema / validate-state | executionMode, planEndReview shape, evaluationGate, reviewGate GATE-R3, deliveryAuditGate | Strong on disk state |
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
- `canRunPhaseDone` — evaluationGate **and** lessonsState **and** reviewGate **and** deliveryAuditGate under durable stamp (Mode-1 + pure-maestro hard-require delivery audit)
- `canFinalizeOrArchive` — plan-end + user validation (stamp-first); plan-end `intentVsDelivered` is **not** a substitute for per-phase `deliveryAuditGate`

**Next cheap wins:** wire the same predicates into `validate-state` as
**warnings → errors** under `executionMode: automate` (evaluationGate + deliveryAuditGate
present on done phases; planEndReview when status archived/finalizing).

### Layer 2 — Thin CLI “assert” (**landed** — F0)

```bash
node scripts/assert-automate-gate.js --plan <slug> --gate spawn|claims|done|phase-done|finalize
```

**Path:** `scripts/assert-automate-gate.js` (unit tests: `tests/assert-automate-gate.test.js`).
Wraps Layer-1 helpers: lease read → `canSpawnPhaseWriter`; claim report →
`canCloseTasksFromClaims`; plan evaluation/lessons/review/**deliveryAudit** → `canRunPhaseDone`; plan-end
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

### Layer 3 — Host-local runner (`scripts/automate-phase-run.js`)

**CLI entry:** `scripts/automate-phase-run.js` (library: `src/automate-phase-run-lib.js`;
pure builders: `src/automate-work-order.js`, `src/automate-sealed-brief.js`).

A **per-host** runner (not cross-host daemon) that:

1. **`prepare`** — builds work-order from initiative (SPEC-admitted pending/active
   tasks only); acquires writer lease (`src/writer-lease.js`); cuts a **sibling**
   worktree (never nested under the plan worktree); writes a **sealed brief**
   (work-order + code-only fence + claim-report shape — no host chat history);
   prints spawn instructions for the host.
2. **`validate`** — parses/validates the claim report (`src/claim-report.js`);
   optional reachability; prints merge commands for writer branch → plan branch.

Human or host agent still runs **spawn**, git merge, and orchestrator `done`.
The runner does **not** spawn writers from Node and does **not** call
`done` / `phase-done`. Skill Step C order: assert spawn → **prepare** → host
spawn → **validate** → merge → assert done.

**Honesty of guarantee (1+A+B):**

| Mechanism | What it guarantees |
|-----------|-------------------|
| Skill spawn recipe (#1) | Correct tool call is unambiguous (e.g. Grok `spawn_subagent` + `general-purpose`) — **soft** discipline |
| Layer 3 runner (A) | Guided work-order / lease / sealed brief / claim validate path — **hard channel**, still host-invoked spawn |
| Plan-tree product fence (B) | Under durable automate, `assert-automate-gate --gate done` / `canDoneFromAutomateClaims` **fails closed** when plan-branch **product** paths changed outside claim `paths[]` coverage — **blocks close**, not process-forced spawn |

**Prose alone does not force spawn.** Host product commit on the plan branch
under automate is a red flag; the fence is the machine stop on illegal *close*.

### Layer 4 — Full maestro (explicit non-goal)

**Non-goal for automate-writer-runtime and current implement path.** Layer 4 full
daemon (workqueue + multi-host spawn + crash recovery + provider spawn adapters)
is **not** in scope and is **not** shipped by skill recipe + Layer 3 runner +
product fence.

Only if automate dogfood of Layers 1–3 + fence proves residual failures that
status/assert cannot catch:

- Workqueue + multi-host recovery beyond the thin Layer 2.5 cursor
- Provider-specific spawn adapters (Claude Task, Codex, Grok subagent as supervised loop)
- Crash recovery from lease + handoff as a supervised loop

**Do not claim Layer 4 shipped** when only skill prose + STOP helpers + runner +
fence exist.

## What not to do

- A second top-level skill `automate.md` that reimplements implement
- Silent Mode-1 fallback when writer fails
- Silent auto-materialize / silent auto-PASS / blank-fill of `businessIntent` (skill may draft; operator validate-only only)
- Pretending prose = runtime in marketing docs
- Claiming Layer 4 full daemon is shipped when only skill prose + STOP helpers + Layer 3 runner + fence exist
- Treating the Grok/portable spawn recipe as process-forced spawn (it is not — fence blocks **close**)

## Operator mental model

1. **Materialize** each phase (you own `businessIntent` — automate never invents spine).
2. **`implement --mode=automate`** once per plan (stamp). Mode 1 is the **execution driver**; automate is **pure maestro** (orchestrator-only).
3. Maestro follows A–I; STOP helpers + **`assert-automate-gate`** + **maestro cursor** refuse illegal jumps when invoked (spawn/done/phase-done/finalize). Step C prefers **`scripts/automate-phase-run.js` prepare → spawn → validate** (Layer 3).
4. After phase-done, cursor sits at **`awaiting-operator-advance`** (pause) until you **continue** via `clearContinue` (`operator-continue` token). No multi-phase auto-run; no auto-materialize; generic ok is not enough.
5. **Finalize** only after durable plan-end `external-both` (codex|grok|claude legs) + your **`userValidatedAt`** validation timestamp (`assert-automate-gate --gate finalize`).
**Assert + cursor + pause + product fence** are the fail-closed set: Layer-2 CLI, Layer-2.5 step file, post phase-done operator authority, and plan-tree product-source fence on done. If a step is skipped, prefer **fail closed** (blocked `assert-automate-gate` / illegal cursor step / `awaiting-operator-advance` / product fence) over “looks done”.
**Host product commit on the plan branch under automate** is a red flag — use writer→merge only.

### Lessons distill (hard under automate — no skip)

Dogfood: pure-maestro multi-phase skipped phase-end lessons (no `Proposed lessons:`, no operator ratify, no `lessons/` file). That is a skill-step skip, not a clean phase.

Under durable `executionMode: automate`, `canRunPhaseDone` / `assert-automate-gate --gate phase-done` / `preflightPhaseDone` require an **answered** lessons gate before advance:

| `lessonsState` | Required |
|----------------|----------|
| `recorded` | non-empty `lessonsPath` after distill + operator ratify → `lessons/<initiative>.md` |
| `none` | explicit zero-lessons (clean phase) — **omitting the field is invalid** |

Helpers: `src/phase-lessons-gate.js` (`phaseLessonsAllowsClose`, `buildLessonsState`). Code: `phase-done-lessons-open`.

### Phase review both (hard under automate — no skip)

Dogfood: `reviewGate.mode: local` without real `review-code --mode=both`. Under stamp,
`canRunPhaseDone` / preflight / commitGuard / assert require:

| `reviewGate` | Required |
|--------------|----------|
| `status: passed` | `mode` ∈ both \| both-* \| external-both, real `at` SHA, non-empty `reviewFile` |
| `status: passed` + `mode: local` | only with non-empty `overrideReason` (operator downgrade) |
| `status: skipped` | `operatorSkip: true` + non-empty `reason` |

Helper: `src/phase-review-gate.js` (`phaseReviewAllowsClose`). Code: `phase-done-review-open`.

### Delivery audit (hard on every phase-done — never skippable)

Dogfood risk: soft-suggest `audit-delivery` after phase-done, stamp `status: skipped` /
`operatorSkip`, or treat review-code / green suite / plan-end `intentVsDelivered` as
substitutes. **Illegal.**

Under Mode-1 **and** pure-maestro, every `phase-done` requires a real
`atomic-skills:audit-delivery` run and durable stamp before advance:

| `deliveryAuditGate` | Required |
|---------------------|----------|
| `status: passed` | non-empty `reportPath` to real report under `.atomic-skills/reviews/`, verdict `CLOSED` \| `PARTIAL`, `verifiedAt` |
| `verdict: OPEN` | **never** stamps passed / never allows phase-done |
| `status: skipped` / `operatorSkip` | **illegal** — honesty fails closed |

Helpers: `src/phase-delivery-audit-gate.js` (`deliveryAuditGateHonesty`,
`deliveryAuditAllowsClose`, `buildDeliveryAuditGate`, authenticity floor on report
body). Codes include `phase-done-delivery-audit-open`. Plan-end lifecycle
`intentVsDelivered` (`matched`\|`partial`\|`missing`\|`extra`) is **not** a
substitute for this phase gate.

### Complex before done (auto-loaded on assert --gate done)

`assert-automate-gate --gate done` loads the phase initiative and builds
`complexTasks` via `src/automate-complex-from-initiative.js` (weight/tags +
`--complex-receipts` map or `task.reviewReceipt`). Complex without both-mode
receipt fails closed.

### lastAssert mutation fence

On done/phase-done, assert writes `lastAssert: { gate, ok, at }` on the maestro
cursor. Skill must call `lastAssertAllows(cursor, gate)` before mutating task
or phase terminal state — fail closed if assert was skipped or failed.

### Plan-tree product fence (Layer B — assert done)

Pure module: `src/automate-product-fence.js` (`planTreeProductFenceOk`).
Wired into `canDoneFromAutomateClaims` / `assert-automate-gate --gate done` when
the CLI injects plan-branch paths via `--plan-diff-file` or `--base-ref`
(`git diff --name-only <baseRef>..HEAD`).

- **Product path** = not under `.atomic-skills/` (state allowlist).
- Uncovered product path on plan branch ⇒ **blocked** (fail closed).
- Empty product diff ⇒ ok.
- Fence blocks **close**, not process-forced spawn.
- Migration: automate plans that previously closed with host Mode-1 product
  commits on the plan tree will fail assert done until they use writer→merge
  with claim path coverage.

Dogfood checklist: `docs/kb/automate-writer-runtime-dogfood.md`.