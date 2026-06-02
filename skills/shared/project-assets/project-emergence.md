# project — emergent work (proposal / ratify / commit) (lazy detail)

Loaded by the router for: `park`, `emerge`, `promote`, `new-task`, `new-phase`, `split-phase`, and the cross-phase `emerge --target`. The router holds the **ambient trigger recognition** + the magnitude→action table as always-resident invariants; this file holds the per-rung procedures.

Work that surfaces mid-execution (new task, new phase, scope split) is the most common reason a 10-phase × 10-task plan drifts into 14-phase × 18-task chaos. This skill handles it through a three-stage **agent-proposes / user-ratifies / agent-commits** pattern. The middle stage — `ratify` — is the hard gate that prevents cryptic title-only stubs from ever entering the backlog. Every emergent item carries a `context` block (`solves`, `trigger`, `assumesStillValid`) ratified by the human BEFORE the file is touched.

The cost of skipping ratify is exactly the failure mode this section exists to prevent: months later, looking at `parked[]` or `emerged[]`, neither the human nor the agent can tell what the entry was about, why it was added, or whether it still matters. The ratify step trades 30 seconds at surfacing time for a backlog that survives the read at any later point.

## When the agent enters proposal mode

Any time the user says (in conversation) something like:

> "while doing this, I realized we also need to <X>"
> "this depends on something we haven't planned"
> "we should add a task to fix <Y> before continuing"
> "<Z> is bigger than we thought, needs its own phase"

The agent does NOT add anything directly. It classifies the request through the **emergence ladder** (table in the router), picks the right magnitude, drafts a `context` block, prints a `Proposed mutation:` block, and waits for the user to:

- type **`ratify`** (apply the drafted context verbatim), OR
- paste an **edited Drafted-context block** (the agent applies the edited version), OR
- type **`cancel`** (abort, no file touched).

A generic "ok" / "do it" / "yes" reply MUST be treated as the agent asking the user to be more specific — never as ratify. The point of the ratify gate is that the human reads and approves the WHY before it lands on disk. A reflexive "yes" would defeat that.

## Proposed-mutation print format

The agent's proposal block must follow this exact shape. The `Drafted context` block is mandatory for every magnitude (1-7); the user must `ratify` it before the agent applies anything.

```
Proposed mutation: <magnitude name, e.g. "new task in different phase">

  atomic-skills:project new-task --target F2 \
    --title "Add canary smoke test for cross-landlord case" \
    --blocked-by T-002 \
    --tags critical

  Drafted context (✋ ratify or edit before applying):
    solves:  <one sentence: the concrete problem this addresses;
              if removed tomorrow, what would degrade?>
    trigger: <one sentence: the specific observation that surfaced this;
              the incident, the code-review note, the test that failed>
    assumesStillValid:
      - <premise 1 — if it stops being true, item becomes moot>
      - <premise 2>

  Provenance: surfaced during F0/T-002 (this conversation), surfacedBy: ai
  Reasoning:  <one line: why this magnitude, not the rung below or above>
  Cost:       <fast / medium / heavy — what changes on disk>

To apply: reply "ratify" (accept context as drafted), OR paste a corrected
Drafted-context block, OR "cancel".
```

Both `Reasoning` and `Drafted context` are mandatory. The first defends against magnitude inflation; the second defends against title-only stubs. A proposal block that omits either is malformed — the agent must re-print it correctly, not proceed.

### How to draft a useful context (so the user doesn't reject the ratify)

- **`solves`** answers "what concrete pain does this address?". `Audit may be incomplete` beats `Investigate Patrimony Clone`. A title doubled into a verb is a tell that the agent didn't actually understand the WHY — re-read the user's message before drafting.
- **`trigger`** is the literal observation that surfaced this. `Reviewing F1 design docs we noticed it references the same auth path F0 audits` beats `seemed relevant`. If the trigger is "the agent thought of it", say that — `surfacedBy: ai` already records the source.
- **`assumesStillValid`** lists 1-3 premises that, if invalidated, make the item moot. They're the antidote to backlog rot: a `lastReviewedAt` re-ratify check asks "are these still true?" and an item with zero premises offers no answer.

## `park <description>` (rung 1)

1. Identify active initiative.
2. **Ratify gate**: print the `Proposed mutation:` block with the drafted `context` (solves/trigger/assumesStillValid). HALT until `ratify` / edited context / `cancel`. Park items live in `parked[]` indefinitely — without a ratified context, the entry decays into a title-only stub no one can interpret three months later. The ratify is what justifies parking instead of just discussing.
3. On ratify: append to `parked:`: `{title: "<description>", surfacedAt: <now>, fromFrame: <current-top-id>, context: { …ratified values…, ratifiedAt: now, ratifiedBy: human, lastReviewedAt: now }}`.
4. Save.

## `emerge <description>` (rung 2)

1. Identify active initiative.
2. **Ratify gate**: same shape as `park`. HALT until ratify / edited / cancel.
3. On ratify: append to `emerged:`: `{title: "<description>", surfacedAt: <now>, promoted: false, context: { …ratified values…, ratifiedAt: now, ratifiedBy: human, lastReviewedAt: now }}`.
4. Save.
5. Offer: "Create new initiative now for '<description>'? (run `atomic-skills:project new initiative <slug>`)" — if yes, hand off to the `new initiative` flow (`{{ASSETS_PATH}}/project-create-initiative.md`).

### `emerge --target <phaseId> "<title>"`

Extension of the existing `emerge` command. Without `--target`, behaves as the base `emerge` above. With `--target`, adds to the target phase's initiative `emerged[]` instead — useful when the surfacing context is task-A-in-F0 but the emerging item belongs to F2.

Same ratify gate as base `emerge` — the `--target` flag only changes WHERE the entry lands, not whether the user must ratify the `context` block.

## `promote <parking-item-title-or-index>` (rung 3)

1. Locate item in `parked:`. Confirm it carries a `context` block (it must — schema requires it for every parked entry).
2. Generate next task ID (`T-<NNN+1>` based on the highest existing).
3. **Re-ratify check** (only if `context.lastReviewedAt` is older than `parkedZombieDays` in config — default 30): print the existing context, ask "Premises still valid? `ratify` to keep, paste edits to update, `cancel` to abort." Fresh items skip this prompt — their context was just ratified.
4. Add to `tasks:` (array): `{id: '<id>', title: <parking title>, status: pending, lastUpdated: <now>, provenance: { surfacedAt: <parked surfacedAt>, surfacedDuring: "promote(<current-init>)", surfacedBy: human }, context: { …carried from parked, lastReviewedAt: now …}}`. The carried context's `ratifiedAt` is preserved (proof the human articulated this once); `lastReviewedAt` advances if step 3 ran.
5. Remove item from `parked:`.
6. Announce new task ID.

## `new-task [--target <phaseId>] "<title>" [options]` (rungs 4-5)

Adds a task to an active initiative. NOT listed in the `new` menu — created by intent via the ladder, or typed directly by power users.

Options:
- `--target <phaseId>` (default: current active initiative). If specified, finds the active initiative whose `phaseId` matches.
- `--blocked-by <task-id>[,<task-id>...]` — sets `blockedBy[]`.
- `--tags <tag>[,<tag>...]` — sets `tags[]`.
- `--verifier-shell "<command>"` — sets `verifier: { kind: shell, command: ... }`.
- `--description "<text>"` — sets `description`.
- `--scope-boundary "<text>"[,"<text>"...]` — sets `scopeBoundary[]` (explicit "do NOT do X" exclusions).
- `--acceptance "<assertion>"[,"<assertion>"...]` — sets `acceptance[]` (max 5, `it()`-style assertions).

When `--scope-boundary` or `--acceptance` are NOT provided, the agent SHOULD still draft them in the `Proposed mutation:` block if the task is non-trivial (more than a config change). The user can delete them during ratify. This makes exclusions and success criteria visible by default.

Steps:
1. Resolve target initiative (current active OR by `--target` phaseId).
2. **Reconciliation gate**: run the pre-mutation reconciliation gate (held in the router) — scan `tasks[]` for `status: active` entries with `lastUpdated` older than `reconciliationThresholdHours` (default 24). If found, present them and reconcile before proceeding.
3. Generate next task id: scan `tasks[].id`, pick the next `T-NNN` (zero-pad to 3).
4. **Ratify gate**: print the `Proposed mutation:` block (including the drafted `context`). HALT until the user replies `ratify` / pastes an edited context block / `cancel`. Without a ratify reply, do NOT proceed to steps 5+.
5. Build the task object: `{id, title, status: pending, lastUpdated: now, …}`.
6. **MANDATORY**: set `provenance: { surfacedAt: now, surfacedDuring: "<current-initiative-slug>/<current-frame-or-task-id>", surfacedBy: <human|ai> }`. `surfacedBy: human` when the user typed the command directly; `surfacedBy: ai` when the agent surfaced it and the user only ratified.
7. **MANDATORY**: set `context: { solves, trigger, assumesStillValid?, ratifiedAt: now, ratifiedBy: human, lastReviewedAt: now }` — from the ratified block (verbatim if the user typed `ratify`, edited version if they pasted corrections).
8. Append to `tasks[]`, bump initiative `lastUpdated`.
9. **Cognitive load warnings** (non-blocking):
   - If `description` exceeds `maxTaskDescriptionLines` (default 15 from config.json): warn "Task description is N lines (limit: 15). Consider splitting into sub-tasks or moving detail to the initiative body."
   - If `acceptance[]` exceeds `maxTaskAcceptance` (default 5 from config.json): warn "Task has N acceptance criteria (limit: 5). Focus on the most critical assertions."
   - Warnings do NOT block task creation — the user can proceed after acknowledging.
10. Validate against schema. Save file.
11. If `--target` differs from current active initiative, surface a note: "task added to F2 (not the active phase F0)".

## `new-phase <id> "<title>" --after <other-id> [options]` (rung 6)

Inserts a new phase into the active plan. Heavy ritual — creates a new initiative file too. NOT listed in the `new` menu — created by intent via the ladder, or typed directly.

Options:
- `<id>` — phase id, must be unique. Convention: use `<base>.5` for inserts (`F0.5`), or next integer for appends.
- `<title>` — phase title.
- `--after <other-id>` — the phase this new one depends on. Sets `dependsOn: [<other-id>]`.
- `--parallel-with <id>` — declares parallel pairing.
- `--track <id>` — assigns to a track if the plan has them.
- `--goal "<text>"` — short goal sentence.

Steps:
1. Load the active plan. If no active plan, abort with: "new-phase requires an active plan. Run `atomic-skills:project new plan <slug>` to create one first."
2. **Reconciliation gate**: run the pre-mutation reconciliation gate (router) on the active phase initiative.
3. Validate `<id>` not in `phases[]`. Validate `--after` references an existing phase id.
4. **Ratify gate**: print the `Proposed mutation:` block with the drafted phase descriptor, the change to `phases[]` order, AND the drafted `context` block. HALT until `ratify` / edited context / `cancel`.
5. On ratify (or edited context):
   - Append phase descriptor to `phases[]` with `provenance: { surfacedAt: now, surfacedDuring: "<current-init>/<task-or-frame>", surfacedBy: <human|ai> }` and `context: { …ratified values…, ratifiedAt: now, ratifiedBy: human, lastReviewedAt: now }`.
   - Create the phase initiative file at `.atomic-skills/projects/<project-id>/<plan-slug>/phases/<id-lower>-<slug>.md` (legacy flat `.atomic-skills/initiatives/<plan-slug>-<id>-<slug>.md`) from the template, with `status: pending`, `parentPlan: <plan-slug>`, `phaseId: <id>`.
   - Save plan + initiative.
   - Validate both files via `npm run validate-state`.
6. On any validation failure: roll back (delete just-written initiative, revert plan body). Surface errors verbatim.
7. **MANDATORY review**: run `atomic-skills:review-plan --mode=internal` against the updated plan. Surface findings. The user decides on Codex cross-model review per the standard intrusive-actions rule.

## `split-phase <id>` (rung 7)

A phase has grown too big. Split into two — typically `<id>a` and `<id>b`, but the user picks names interactively.

> **Invocation:** `split-phase` is a **top-level** verb (`/atomic-skills:project split-phase <id>`), not part of the `new` menu — it is a restructure, not the creation of one entity.

Steps:
1. Load the active plan + the phase's initiative. Show current state: N tasks, growth ratio, parked count.
2. Ask the user: "Split `<id>` into how many sub-phases? Suggest names + which tasks go to each."
3. **Ratify gate** (per new sub-phase): print one `Proposed mutation:` block per new phase being materialized, each with its own drafted context. The user can `ratify` once per phase or `ratify-all` to accept all drafts. `cancel` on any one aborts the entire split (no partial materialization).
4. Materialize the new phases (using `new-phase` semantics — provenance + plan body update + new initiative files), embedding each phase's ratified context.
5. Move tasks between the new initiatives per the user's split. Preserve `provenance` per task; add `originalPhaseId: <id>` to provenance for moved tasks. Moved tasks keep their existing `context` (no re-ratify — the articulation was already done when each task was added).
6. Mark the original phase as `archived` (not `done` — splitting is not completion). Move its initiative to the resolved archive dir (nested `projects/<project-id>/<plan-slug>/phases/archive/`, legacy `initiatives/archive/`).
7. Update plan `currentPhase` if it pointed at the split phase: set to the first new sub-phase that is `active` or `pending`.
8. Validate everything. Roll back on any failure.

## Why provenance + context live on the item itself (not a separate log)

Every emergent item carries two co-located blocks in its frontmatter:

- `provenance: { surfacedAt, surfacedDuring, surfacedBy, originalPhaseId? }` — the WHEN and WHO of the addition. Schema: `common.schema.json#/$defs/provenance`.
- `context: { solves, trigger, assumesStillValid?, ratifiedAt, ratifiedBy, lastReviewedAt }` — the WHY, articulated by the human at `ratify` time. Schema: `common.schema.json#/$defs/context`.

The schema makes them inseparable: any task/phase that carries `provenance` MUST also carry `context` (`if/then` constraint in initiative.schema.json and plan.schema.json). And every `parked[]` and `emerged[]` entry — emergent by definition — requires `context` unconditionally. Items shipped in the original materialization have neither field; their narrative lives in the plan or initiative body and the listing rendering falls back to `—`.

The choice (vs a separate `.atomic-skills/changelog.jsonl` or a `.atomic-skills/why/<id>.md` sidecar) was deliberate:

1. **The WHY survives initiative archive.** When the initiative moves to `archive/`, the context block moves with it. A separate log would either grow forever or rotate, breaking grep-style audits.
2. **`grep -A 12 "solves:" .atomic-skills/`** answers "show me what every emergent item is supposed to solve" in one line. No tooling needed.
3. **Dual-write would diverge.** Editing the task without updating the log is the default failure mode of any sidecar; making the WHY part of the same YAML eliminates the synchronization problem.
4. **The ratify gate has somewhere to write to.** Forcing the human to articulate `solves` + `trigger` only makes sense if those land on the item itself — a separate ratify log would feel ceremonial and get skipped.

Cost: no chronological cross-cuts the way a single log would give. The `scope-creep` view (`{{ASSETS_PATH}}/project-drift.md`) is the workaround — it aggregates context + provenance across all initiatives into chronologically-ordered tables on demand, including the stale-context section that surfaces items whose `lastReviewedAt` aged past `staleContextDays`.
