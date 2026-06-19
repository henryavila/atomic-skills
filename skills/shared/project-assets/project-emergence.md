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

The agent's proposal block must follow this exact shape. The `Drafted context` block is mandatory for every magnitude (1-7); the user must `ratify` it before the agent applies anything. For the rungs that **create a task or a phase** (`promote`, `new-task`, `new-phase`, `split-phase`), the block ALSO carries a mandatory `Drafted summary` — the one-line "what this does" the dashboard shows; it is authored + ratified in the same gate (never deferred), in the **install-configured communication language** (the `manifest.json` `language`). See skills/core/project.md → "Phase summaries" / "Task summaries".

```
Proposed mutation: <magnitude name, e.g. "new task in different phase">

  atomic-skills:project new-task --target F2 \
    --title "Add canary smoke test for cross-landlord case" \
    --blocked-by T-002 \
    --tags critical

  Drafted summary (✋ task/phase-creating rungs — shown on the dashboard; install-configured language):
    summary: <one concise line: what this task/phase does — distinct from the title>

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

Both `Reasoning` and `Drafted context` are mandatory. The first defends against magnitude inflation; the second defends against title-only stubs. A proposal block that omits either is malformed — the agent must re-print it correctly, not proceed. For task/phase-creating rungs the `Drafted summary` is mandatory too — omitting it is the same malformation (the dashboard would render a bare id/title).

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
4. **Draft + ratify the `summary`** — ALWAYS, fresh or stale (the parked entry never carried one, so it is authored here, NOT inherited). Show a one-line summary (install-configured communication language, derived from the parked title + `context.solves`) and have the user ratify it: fold it into the step-3 prompt when that runs, or show it on its own for fresh items. This step is unconditional — never skip it on the fresh-item path.
5. Add to `tasks:` (array): `{id: '<id>', title: <parking title>, summary: <ratified one-line>, status: pending, lastUpdated: <now>, provenance: { surfacedAt: <parked surfacedAt>, surfacedDuring: "promote(<current-init>)", surfacedBy: human }, context: { …carried from parked, lastReviewedAt: now …}}`. The carried context's `ratifiedAt` is preserved (proof the human articulated this once); `lastReviewedAt` advances if step 3 ran. **`summary` is mandatory** — a promoted task with no summary renders bare in the dashboard Agora.
6. Remove item from `parked:`.
7. **Completion-signal nudge (Component E, soft):** if the promoted task carries neither a `verifier` nor an `outputs[].path`, ask whether to add one so it can be auto-detected as done (decline is allowed — the task just stays invisible to `detect-completion` and must be closed by hand). Same nudge as `new-task` step 10; `node scripts/find-signalless-tasks.js` audits the gap.
8. Run `node scripts/find-missing-task-summaries.js` (zero-token backstop, same as `new-task`) — a non-zero exit means the summary slipped; author it before announcing. Then announce the new task ID.

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
8. **MANDATORY**: set `summary` — the one-line "what this task does" from the ratified `Drafted summary`, in the install-configured communication language. This is the dashboard-visible string (Agora + Initiative-detail); a task created with no summary contradicts the "skill always generates" guarantee (skills/core/project.md → "Task summaries").
9. Append to `tasks[]`, bump initiative `lastUpdated`. Then run `node scripts/find-missing-task-summaries.js` (zero-token; it scans every initiative in both layouts) — a non-zero exit means a straggler slipped through; author it before declaring the task created. Running it here closes the `--target <non-current-phase>` gap that the view-time *gate* (project-view.md Step 0 only blocks on the active plan's current-phase rows) would not otherwise block on.
10. **Cognitive load warnings** (non-blocking):
   - If `description` exceeds `maxTaskDescriptionLines` (default 15 from config.json): warn "Task description is N lines (limit: 15). Consider splitting into sub-tasks or moving detail to the initiative body."
   - If `acceptance[]` exceeds `maxTaskAcceptance` (default 5 from config.json): warn "Task has N acceptance criteria (limit: 5). Focus on the most critical assertions."
   - **Completion-signal nudge (Component E, soft — never a hard gate):** if the task has **neither** a `verifier` **nor** at least one `outputs[].path`, surface "T-00x has no completion signal (verifier or outputs.path); add one so it can be auto-detected as done? (the alternative is it stays invisible to `detect-completion` and must be closed by hand)." The user MAY decline (some tasks are genuinely unverifiable). This is the mechanism that keeps the `none` blind spot rare; `node scripts/find-signalless-tasks.js` audits the gap for backfill.
   - Warnings do NOT block task creation — the user can proceed after acknowledging.
11. Validate against schema. Save file.
12. If `--target` differs from current active initiative, surface a note: "task added to F2 (not the active phase F0)".

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
4. **Ratify gate**: print the `Proposed mutation:` block with the drafted phase descriptor, the change to `phases[]` order, the drafted `summary` (one-line what-this-phase-does, install-configured language), AND the drafted `context` block. HALT until `ratify` / edited context / `cancel`.
5. On ratify (or edited context):
   - Append phase descriptor to `phases[]` with `summary: <ratified one-line>`, `provenance: { surfacedAt: now, surfacedDuring: "<current-init>/<task-or-frame>", surfacedBy: <human|ai> }` and `context: { …ratified values…, ratifiedAt: now, ratifiedBy: human, lastReviewedAt: now }`.
   - Create the phase initiative file at `.atomic-skills/projects/<project-id>/<plan-slug>/phases/<id-lower>-<slug>.md` (legacy flat `.atomic-skills/initiatives/<plan-slug>-<id>-<slug>.md`) from the template, with `status: pending`, `parentPlan: <plan-slug>`, `phaseId: <id>`, and the same ratified `summary` (the Home "Agora"/timeline read it from both surfaces — see skills/core/project.md → "Phase summaries").
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
5. Move tasks between the new initiatives per the user's split. Preserve `provenance` per task; add `originalPhaseId: <id>` to provenance for moved tasks. Moved tasks keep their existing `context` AND `summary` (no re-ratify, no re-author — both were done when each task was added). The new sub-phases get their phase `summary` via the new-phase semantics in step 4.
6. Mark the original phase as `archived` (not `done` — splitting is not completion). Move its initiative to the resolved archive dir (nested `projects/<project-id>/<plan-slug>/phases/archive/`, legacy `initiatives/archive/`).
7. Update plan `currentPhase` if it pointed at the split phase: set to the first new sub-phase that is `active` or `pending`.
8. Validate everything. Roll back on any failure.

## `fork-plan <child-slug> --from <phaseId> --mode pause|parallel [--task <T>]` (rung 7.5)

A phase of an in-flight plan has grown into work that deserves its **own plan** — bigger than `split-phase` (rung 7, still inside the same plan), but it does **not** replace the parent (that is rung 8 `adopt … supersedes`). The phase is forked into a **child plan** linked to the parent by a bidirectional edge; the parent survives and resumes at the anchor phase when the child completes. This is rung **7.5** — additive and reversible, never a substitution.

> **Invocation:** `fork-plan` is a **top-level** verb (`/atomic-skills:project fork-plan <child-slug> --from <phaseId> …`), not part of the `new` menu — it ratifies a parent/child link and then hands off to the `new plan` flow.

`fork-plan` does exactly two things: **(1)** ratifies the fork edge on the parent (the `context` gate — `solves`/`trigger`/`assumesStillValid` — like every emergent item), and **(2)** hands off to the `new plan` flow so the child passes the DESIGN gate (R-ORCH-09) and gets its own `design.md` like any plan. The verb never duplicates `new plan`; it only ratifies the edge and delegates.

**The link lives in a sidecar, not inline.** Under the published aiDeck 0.1.0 consumer the edge fields cannot live in `plan.md` / phase frontmatter (`spawnedFrom` is `.strict()` and drops the whole card; `spawnedPlans` is silently stripped). So `fork-plan` writes the edge to the non-aiDeck-facing `links.json` sidecar via the F0 helpers in `src/links-sidecar.js` (`setSpawnedFrom` on the child, `addSpawnedPlan` on the parent). The inline migration is deferred to F5 (gated on aiDeck ≥ 0.1.2). Forking is **intra-project**; the `mode` lives only on the child's `spawnedFrom`.

### Argument parse

Parse the invocation into:

- `<child-slug>` (positional, required) — the slug of the child plan to create. Must be a valid `common.schema.json#/$defs/slug`.
- `--from <phaseId>` (required) — the **anchor phase** of the parent that is being forked. Must reference an existing phase id in the active plan. For `--mode pause` it must additionally be the plan's **`currentPhase`** (the active phase) — you fork the phase you are executing; pausing a non-active phase is meaningless. Abort with a clear message if either check fails.
- `--mode pause|parallel` (required) — the parent's lifecycle while the child runs. See "Mode semantics" below. A value outside the two-token enum is a parse error (malformed invocation). **`parallel` parses as a syntactically valid value but is rejected at runtime in F1** (step 2) because its cross-worktree state protocol is F2 — do not rely on the enum to reject it.
- `--task <T>` (optional) — the concrete task of the anchor phase that triggered the fork, recorded as `spawnedFrom.taskId`. Omitted when the trigger was the phase as a whole.

A missing required argument is a malformed invocation: print the usage line and stop, touch nothing.

### Steps

1. **Resolve the parent + validate the anchor.** Load the active plan. If there is no active plan, abort: "fork-plan requires an active plan." Validate `--from <phaseId>` against `phases[]`. For `--mode pause`, also require `--from` to equal the plan's `currentPhase` (abort otherwise — see the arg-parse note). Validate `--task <T>` (when given) against the anchor phase initiative's `tasks[]`.
2. **Reject `--mode parallel` (F1) — before any gate or write.** `parallel` is a syntactically valid value but its cross-worktree state protocol is **F2** (see "Mode semantics"). Reject it here, before the pre-mutation gates, the cycle-check, the ratify gate, and any sidecar write, printing the F2 message below. Nothing is touched. Only `--mode pause` proceeds past this step in F1. (The rejection is a numbered step precisely so an executor walking the list top-to-bottom cannot reach the step-8 write with `parallel`.)
3. **Pre-mutation gates.** Run the resident pre-mutation gates (migration check + reconciliation) on the anchor-phase initiative, exactly as the other emergent rungs do.
4. **Cycle-check — BEFORE the ratify gate, before any write to either sidecar.** This is the design's *detecção de ciclo* guard (D5): a child must never fork one of its own ancestors, and a plan cannot fork itself. Build the parent→child adjacency from the project's existing edges and test the proposed `parent → child` edge with the F0 helpers in `src/spawn-graph.js` — **do not reimplement the detection here**:
   - Collect every plan in the project that carries a `spawnedPlans` map (read each via `getSpawnedPlans` from `src/links-sidecar.js`), shaped as `{ slug, spawnedPlans }`. **Always include the prospective parent in this list** — with `spawnedPlans: {}` when it has no sidecar yet (a first-time fork) — so `buildAdjacency` (`src/spawn-graph.js`, which only adds slugs present in its input) always materializes the parent node. Pass the list to `buildAdjacency(plans)`.
   - Call `wouldCreateCycle(adjacency, <parent-slug>, <child-slug>)`. It returns `true` when `<child-slug> === <parent-slug>` (self-fork) or when `<child-slug>` can already reach `<parent-slug>` along ≥1 spawn edges (forking an ancestor).
   - **On `true`: abort atomically.** Print the offending edge (e.g. "fork rejected — `<child>` is an ancestor of `<parent>`; this would close a cycle (`detecção de ciclo`, D5)") and **write nothing to either sidecar** — the ratify gate is never reached, so no `context` lands and neither `setSpawnedFrom` nor `addSpawnedPlan` runs. The check precedes ratify precisely so a cycle is refused before the human is asked to ratify a fork that cannot exist.
   - On `false`: proceed to the ratify gate.
5. **Ratify gate.** Print the `Proposed mutation:` block for a fork — magnitude `fork-plan (phase → child plan)` — with the drafted `context` (`solves`/`trigger`/`assumesStillValid`) that justifies the fork, the resolved `--from`/`--mode`/`--task`, and a `Reasoning` line (why rung 7.5, not `split-phase` below or `supersedes` above). HALT until the user replies `ratify` / pastes an edited context block / `cancel`. A generic "ok"/"yes" is **not** ratify. Nothing below this step runs until ratify.
6. **Pause the parent — BEFORE the handoff (pause mode).** On `ratify`, set the parent plan `P` → `status: paused` and its anchor phase (`--from`, = `currentPhase`) → `status: paused`, then run `node scripts/refresh-state.js` (the paused-plan hygiene invariant + focus markers). Doing this **before** step 7 is mandatory: the `new plan` handoff runs a single-active-plan pre-flight (`{{ASSETS_PATH}}/project-create-plan.md` → Stage 6, R-FOCUS-01) that scans for other `active` plans; if the parent were still active here, that pre-flight would fire its multi-active resolution prompt and contradict the pause this verb owns. Pausing first leaves exactly one active plan (the child, born in step 7).
7. **Hand off to `new plan` (the child is materialized here).** Delegate to the `new plan` flow (`{{ASSETS_PATH}}/project-create-plan.md`) for `<child-slug>`: the child is a real plan and passes the DESIGN gate (R-ORCH-09). **The handoff can abort** — the DESIGN gate may HARD-BLOCK, or the user may cancel (Stage 5 "does NOT write to `.atomic-skills/`"). If it aborts: **no sidecar edge exists yet** (the writes are step 8), so the only rollback needed is to re-activate the parent + anchor phase paused in step 6 (un-pause `P`, anchor → `active`, `refresh-state`), then stop. Nothing is half-forked.
8. **Write the bidirectional edge — only after the child plan exists.** Now that step 7 has materialized the child:
   - Child: `setSpawnedFrom(<childPlanDir>, { plan: <parent-slug>, phaseId: <from>, taskId?: <T>, mode: <mode> })`. (`<childPlanDir>` now holds a real `plan.md`, so this is not an orphan write.)
   - Parent: `addSpawnedPlan(<parentPlanDir>, <from>, <child-slug>)` — idempotent; `spawnedPlans[<from>]` is an array (a phase may fork several children).
   The ratified `context`/`provenance` is recorded with the edge. Deferring the write to after child materialization is what prevents an orphan `<childPlanDir>/links.json` + a dangling parent edge when step 7 aborts.

### Mode semantics

`--mode` decides what happens to the **parent** while the child plan runs. The value lives on the child's `spawnedFrom.mode` (written in step 8).

- **`--mode pause` (fully implemented in F1).** The parent suspends and waits for the child at the anchor phase:
  - Parent plan `P` → `status: paused`, and its anchor phase (`--from <phaseId>`, constrained to be `currentPhase` — see step 1) → `status: paused`. This is the **same effect** `switch`/cascade-pause produces (`{{ASSETS_PATH}}/project-transitions.md` → `switch`, which demotes a paused plan's active phase), but `fork-plan` pauses the **named** `--from` phase explicitly rather than relying on cascade-pause's "demote whatever phase is active" — they coincide only because `--from` is required to be the active phase, and the explicit pause keeps the behavior correct even if that invariant ever loosens. The paused-plan hygiene invariant (`refresh-state` → `reconcile-focus`) then holds: no `active` phase is left under the paused parent.
  - This pause happens in **step 6, before the step-7 handoff** — so `new plan`'s single-active-plan pre-flight sees the parent already paused.
  - The child plan is born `active` (via the `new plan` handoff in step 7).
  - The resume — un-pausing `P` and reactivating the anchor phase when the child completes/archives — is **not** part of this rung; it is the archive-propagation loop delivered in a later phase. `fork-plan --mode pause` only establishes the paused parent + active child here.
- **`--mode parallel` (REJECTED until F2).** The parallel mode keeps the parent `active` in its own worktree alongside an `active` child in a separate worktree — which requires a cross-worktree **state protocol** (atomic, concurrency-safe writes to the shared project state from two live worktrees). That protocol does not exist yet; it is **F2** (`plan-fork-f2-protocolo-de-estado-parallel-cross-workt`). So in F1, `--mode parallel` is **rejected in step 2 — before any gate or write — with a clear message**:

  > `fork-plan --mode parallel` is not available yet — the cross-worktree state protocol it depends on lands in phase F2 (protocolo de estado parallel cross-worktree). Re-run with `--mode pause`, or wait for F2.

  The rejection is a **numbered procedure step** (step 2), not just prose here, so an executor walking Steps 1→8 cannot fall through to the step-8 write with `parallel`. No `spawnedFrom`/`spawnedPlans` edge and no cross-worktree state is ever written under `parallel` before the protocol exists — writing a `parallel` edge now would strand the project in a concurrency mode nothing can safely service.

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
