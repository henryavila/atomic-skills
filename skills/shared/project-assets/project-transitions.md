# project — task / phase transitions (lazy detail)

Loaded by the router for: `done`, `phase-done`, `phase-reopen`, `switch`, `archive`, `detect-scope`, `reconcile`, and the per-task / exit-gate **Verifier execution patterns**. The router holds the always-resident pre-mutation gates (migration check, reconciliation gate, gate-status invariant); this file holds the per-command procedures plus the migration-check detail.

## Entity-file resolution (nested-first, flat-fallback)

Every step below that "loads", "moves", or "archives" a plan/initiative file resolves its path against the **nested** layout first and the legacy **flat** layout only as a fallback (see the router's layout model):

- **Plan** `<slug>` → `projects/<project-id>/<slug>/plan.md`; legacy `plans/<slug>.md`.
- **Phase initiative** of plan `<plan-slug>` → `projects/<project-id>/<plan-slug>/phases/f<N>-<slug>.md`; legacy `initiatives/<slug>.md`. A **standalone** initiative is its own degenerate 1-phase plan (`projects/<project-id>/<slug>/{plan.md,phases/<slug>.md}`).
- **Archive** → the layout's archive dir: nested `projects/<project-id>/<plan-slug>/phases/archive/<YYYY-MM>-<slug>.md` for a phase initiative (a whole plan is archived in place with `status: archived`); legacy flat `initiatives/archive/` + `plans/archive/`.
- **Index** → that project's `projects/<project-id>/PROJECT-STATUS.md`; legacy top-level `.atomic-skills/PROJECT-STATUS.md`.

Where a step writes `initiatives/…`, `plans/…`, or `PROJECT-STATUS.md` below, read it as "the resolved path for the active layout".

## Pre-mutation migration check (detail)

Every time you load an existing initiative or plan for mutation:
1. Parse its frontmatter.
2. If `schemaVersion` is absent or missing, this is a **legacy file**. STOP and prompt the user to invoke `atomic-skills:project migrate <slug>` (which handles the standalone-vs-in-plan choice and calls `src/migrate.js:migrateLegacyInitiative`). Abort the current mutation with: "Mutation cancelled — file is legacy. Run `atomic-skills:project migrate <slug>` first, then retry."

The pre-mutation check is the **only** way legacy files are touched, and migration itself is delegated to the `migrate` flow (`{{ASSETS_PATH}}/project-migrate.md`). This skill never silently writes legacy-shape YAML.

## Pre-mutation reconciliation gate (detail)

Every time you load an active initiative for a **mutating** command (`push`, `pop`, `park`, `emerge`, `promote`, `done`, `phase-done`, `phase-reopen`, `archive`, `switch`, `detect-scope`, `re-ratify`, `new-task`, `new-phase`), run this check AFTER the migration check and BEFORE executing the command:

1. Parse `tasks[]` from the active initiative's frontmatter.
2. Collect tasks where `status` is `active` AND `lastUpdated` is older than 24 hours from now.
3. If the collected list is empty → skip, proceed to the command.
4. If the list is non-empty → present a reconciliation prompt using {{ASK_USER_QUESTION_TOOL}}:

   ```
   ⚠ Unreconciled tasks detected (active >24h):

     T-001 "Add scopeBoundary to schema" — active 3d
     T-002 "Session-End reconciliation"  — active 1d

   For each: still active? done? blocked?
   ```

   Present one structured question per stale task (max 4; if more than 4, batch the oldest 4 first). Options per task: `Still active`, `Done`, `Blocked`, `Skip`.

5. Apply user answers immediately:
   - **Done** → run the `done <task-id>` flow (including auto-transition detection).
   - **Blocked** → set `status: blocked`, ask for `blockedBy[]` (optional), bump `lastUpdated`.
   - **Still active** → bump `lastUpdated` to now (acknowledges the task, resets the 24h clock).
   - **Skip** → no change, proceed.
6. After reconciliation, proceed to the original command.

The gate is skipped for read-only commands (`status` views, `why`, `scope-creep`). It is also skipped when the user is already running `done` on one of the stale tasks (avoid double-prompting).

The 24-hour threshold is configurable via `.atomic-skills/status/config.json` key `reconciliationThresholdHours` (default: 24). Set to `0` to disable.

## Stack frames: `push` / `pop`

### `push <description>`

1. Identify active initiative (via branch match or explicit `--slug` arg).
2. Read `stack:` from frontmatter.
3. Append new frame: `{id: <max_id+1>, title: "<description>", type: <inferred>, openedAt: <now>}`.
4. Save.
5. Announce: "Frame <N> pushed: <description>. Current depth: <N>."
6. If depth > `max_stack_depth_warning` (from config.json), warn: "Stack is deep — is this still the same initiative?"

Inferred types from verb: "research" → research; "test" → validation; "discuss" → discussion; otherwise → task.

### `pop [--resolve|--park|--emerge]`

0. If `stack:` is empty, abort with message: "Stack empty — nothing to pop."
1. Identify top frame of the stack.
2. Destination:
   - `--resolve` (default): remove from stack, add note in Done if it was a task
   - `--park`: route through the `park` flow (`{{ASSETS_PATH}}/project-emergence.md`) — including the ratify gate before the entry is written to `parked[]`
   - `--emerge`: route through the `emerge` flow (`{{ASSETS_PATH}}/project-emergence.md`) — including the ratify gate before the entry is written to `emerged[]`
3. Remove frame from stack.
4. Announce: "Frame <N> popped to <destination>. Current frame: <new top>."
5. Update `lastUpdated` and save.

`pop --resolve` skips the ratify gate entirely — resolving a frame doesn't create a new backlog entry, so there's nothing to articulate.

## `done <task-id>`

1. Locate task in `tasks:` (array). Find the entry where `id === <task-id>`.
2. Change `status: done`, set `closedAt: <now>`, refresh `lastUpdated: <now>`.
3. Recompute the initiative's dashboard rollups (`tasksDone`/`tasksTotal`/`gatesMet`/`gatesTotal` + per-gate `verifierLabel`/`evidenceSummary` — see § Dashboard rollups & focus markers below) by running `node scripts/refresh-state.js` (the one-pass aggregator: rollups + focus markers + the `focus.json` digest), then save the initiative file. Running refresh-state here is what keeps the statusline digest from drifting after a close.
4. **Auto-transition detection**: count remaining tasks with `status` in `{pending, active, blocked}`. If zero:
   - When the initiative has a `parentPlan`: announce "Last task of `<parentPlan>/<phaseId>` closed. Run `phase-done` to verify exit gates and advance the plan?". The next session's SessionStart hook also surfaces a 🔔 phase-transition reminder via the active-initiative pending-task count.
   - When the initiative is standalone: announce "All tasks of `<slug>` closed. Run `archive <slug>` or open a new initiative?".
   - Do NOT automatically run `phase-done` or `archive` — the user opts in (intrusive-actions rule).
5. Announce the task closure.

If the closing task has a non-empty `verifier:`, see **Per-task verifiers** below first.

## `reconcile`

The **only** completion-mutation path (Spec 1, Component B). `status`/`verify` *detect & report* completion drift read-only; `reconcile` is where the user disposes of each candidate. Subject to the standard pre-mutation gates (migration check, reconciliation gate). It NEVER fabricates a close: the detection signal (a changed deliverable) and the close authority (a passing verifier *or* an explicit human ack) are kept separate.

1. Run the deterministic detector: `node scripts/detect-completion.js --json` (add `--project <id>` when more than one project holds the resolved plan-slug; `--slug`/`--plan` to widen within the project). It returns `candidates[]`, each carrying `kind` (`task`|`criterion`), `id`, the resolved `initiativePath` (the **safe write target** — never a bare slug), `evidence` (`output-exists`|`commit-ref`), `paths`/`commit`, and `hasVerifier` + `verifier`.
2. If `drift` is false → announce "No completion drift — open entries carry no done-signal." and stop.
3. For each candidate (batch the **oldest 4 first**, mirroring the reconciliation gate), present a {{ASK_USER_QUESTION_TOOL}} whose options are **verifier-aware**:
   - **`hasVerifier: true`** → options `Run verifier` / `Still open` / `Skip`. There is **no "mark done" shortcut** — the only close path is running the verifier (the **Verifier execution patterns** below), which writes GATE-R2 `evidence` and, on pass, sets the entry `done`/`met`. A failing verifier leaves it open. This is forced by GATE-R2: an entry with a `shell`/`test`/`query` verifier cannot reach `done`/`met` without `evidence.passed === true`.
   - **`hasVerifier: false`** → options `Mark done` / `Still open` / `Skip`. `Mark done` is the manual-acknowledgement path — for a **task**, run the `done <id>` flow (incl. auto-transition + rollup recompute); for a **criterion**, the "No verifier present → manual ack" path → set `status: met`, `metAt: <now>`, write `evidence` (`verifierKind: manual`, `passed: true`). GATE-R2 does NOT gate verifier-absent entries, so manual ack is valid here.
   - **`Still open`** → bump the entry's `lastUpdated` to now (acknowledges; resets the signal clock so the same candidate doesn't re-surface immediately). No status change.
   - **`Skip`** → no change.
4. After applying dispositions, recompute the initiative's dashboard rollups by running `node scripts/refresh-state.js` (rollups + focus markers + the `focus.json` digest, one pass) and save. If closing the last open task of a phase initiative, the `done` flow's auto-transition fires the `phase-done` offer at the right time — that loop-close is the whole point of making this moment reliably reachable.

This is the pause-point applied to completion, as an explicit verb — so `status`/`verify` keep their read-only semantics and the user is never trapped (every candidate has a valid action for its verifier state).

## `phase-done`

Invoked when the active initiative is the phase initiative of an active plan AND all its tasks are closed. Iterates the phase's exit gate criteria, archives the phase initiative, advances `currentPhase` per the dependency graph, and seeds the next phase's initiative.

1. Load the active initiative. Verify it has `parentPlan` + `phaseId` set. Else abort.
2. Load the parent plan (resolve `<parentPlan>` nested-first: `projects/<project-id>/<parentPlan>/plan.md`, legacy `.atomic-skills/plans/<parentPlan>.md`). Locate the phase by `phaseId`. Read `phase.exitGate.criteria` AND `initiative.exitGates` (combine; phase-level criteria are authoritative for the gate).
3. For each criterion (status === `pending`) → apply the **Verifier execution patterns** below.
4. After iterating: report status summary. Continue to advance only when every criterion is `met` OR was explicitly `deferred` with a `deferredReason`.
5. If any criterion is still `pending` after iteration: ask "Some gates remain pending. Mark phase done anyway? (y/N)". On `n`, leave initiative in `active` state and stop. On `y`, document the override (set `deferredReason` on the remaining criteria) and proceed to step 6.
6. **Review gate** — run `atomic-skills:review-code` on the phase diff. This step is mandatory unless `--skip-review` is passed explicitly.
   - Compute the diff range: from the phase initiative's `started` timestamp (find the closest commit via `git log --before=<started> -1 --format=%H`) to HEAD.
   - **Pick the mode by the destructive-diff signal (G5).** Compute `review-code`'s `DESTRUCTIVE` signal over this range (the deterministic heuristic in `skills/core/review-code.md` → *Destructive-diff signal*: any whole non-test file deleted, any schema/data drop token, or deletion-dominated churn). When `DESTRUCTIVE` is true, run **`--mode=both`** — a destructive phase is exactly where a same-model local pass false-greens the orphaned-data / dangling-reference regression a delete leaves behind, so cross-model is not optional. Otherwise run `--mode=local`. A user may still downgrade a destructive phase to `--mode=local`, but only as an explicit, recorded override (note it in the self-review block alongside the review outcome) — never by default. `--skip-review` is the only way to skip entirely.
   - Run `atomic-skills:review-code <range> --mode=<both|local>`. The convergence rule (plateau detection, `--max-iterations`) applies automatically.
   - Apply blocker/critical findings. If fixes are committed, the review range shifts — this is expected and handled by the convergence rule.
   - **Codex review tracking integration**: before archiving, check `.atomic-skills/status/last-review.json`. If `lastReviewedCommit` ≠ HEAD, announce: "Phase `<id>` is closing with `<N>` commits / `<L>` lines un-reviewed since last codex review. Run cross-model review against `<lastReviewedCommit>..HEAD` before archiving? (y/N)". On `y`: invoke `review-due` (`{{ASSETS_PATH}}/project-drift.md`). Apply blocker/critical fixes, then proceed.
   - If `--skip-review` was passed: record `Codex review: SKIPPED at phase-done (user requested --skip-review)` in the self-review block (see § "Self-review" below) and proceed.
   - **Record the review gate on the phase descriptor (G2 — GATE-R3 precondition).** Before the phase can be set `done` (step 8), write `phases[<this>].reviewGate` on the parent `plan.md`: on a clean review, `{ status: passed, at: <reviewed HEAD sha>, mode: <local|both>, reviewFile: <path if written>, verifiedAt: <now> }`; on `--skip-review`, `{ status: skipped, reason: <why>, verifiedAt: <now> }`. This is the durable, machine-checkable counterpart to the prose self-review block: `validate-state` GATE-R3 HARD-FAILS a `done` phase whose `reviewGate` claims `passed` without an `at` sha, or `skipped` without a `reason`. **Do not advance to step 7/8 until `reviewGate` is recorded** — a phase reaches `done` only *after* its review gate is honestly stamped, never before (this is the "never `done` before review" precondition: until then the phase stays `active`/verify-pending).
   - **Distill lessons — part of the DEFINITION of phase-done, not optional (G1, the Spec-2 capture).** A `review-code` finding *generates* learning, but nothing aggregates it where the NEXT phase will read it — so the lesson evaporates unless the user happens to ask (the F0-decommission "15k orphaned emails" lesson was nearly lost exactly this way). After the review gate, **draft the phase's lessons from real failure signals only** — confirmed `review-code` findings (especially a cross-model blocker the local pass missed), reopened/blocked tasks, deferred gates, the phase diff, and user corrections made this phase. For each, write one entry: a `statement` (what went wrong, blameless) + a `corrective` (the locus + what to do next time — Self-Refine actionable shape), `scope: reusable` if it generalizes beyond this phase else `local`, `appliesTo: []` (all future phases) or specific `phaseId`s, `status: open`, `confidence: 2` (ExpeL born-2), `evidence` (link to the review file / self-review), `createdAt`/`validatedAt: <now>`. Then **present a `Proposed lessons:` block and have the user ratify / edit / reject** (the existing ratify-gate; selective + capped + blameless — verify-before-store). Write the ratified set to the per-initiative lessons file `.atomic-skills/projects/<project-id>/<parentPlan>/lessons/<initiative-slug>.md` (create it if absent: `{ schemaVersion, slug: <initiative-slug>, projectId, parentPlan, lessons: [...] }`), then `npm run validate-state` that file. A clean phase with no failure signal records **zero lessons explicitly** (note "no lessons distilled — clean phase" in the self-review block) — silence ≠ zero; the step is always *answered*. The phase-start gate (`project-create-initiative.md`) is what surfaces these into the next phase via `node scripts/list-lessons.js --phase <id>`.
7. **Advance the plan** — call `src/transition.js`:`proposeAdvance(plan, phaseId)` to decide what's next. The function returns one of three shapes:
   - `{ kind: 'plan-done', eligible: [] }` — no more eligible phases. Offer to mark the plan itself `status: done` and `archive` it.
   - `{ kind: 'single', next: '<id>', alternatives: [...] }` — propose "Phase `<id>` done. Advance `currentPhase` to `<next>`? (y/N)". List `alternatives` so the user can override before accepting.
   - `{ kind: 'parallel-choice', eligible: [...] }` — when the plan has `parallelismAllowed: true`, ask "Which of `<eligible...>` should be activated now? Select one or more (or `none`)".
   Before presenting any of the above, call `src/transition.js`:`unknownDeps(plan)`. If it returns non-empty, surface the typos to the user and abort the advance — the dependency graph is broken.
8. On the user's accept of an advance:
   - **Propagate completion to the initiative** (BEFORE archiving):
     a. Set all `tasks[].status = 'done'`, `tasks[].closedAt = <now>`, `tasks[].lastUpdated = <now>` for any task not already `done`.
     b. For each `exitGates[]` in the initiative with `status !== 'met'`: set `status: met`, `metAt: <now>`. If the matching plan criterion (by `id`) has an `evidence` block, copy it to the initiative exitGate.
     c. Set initiative `status: done`, `lastUpdated: <now>`, `nextAction: null`.
     d. Recompute the initiative's dashboard rollups (`tasksDone`/`tasksTotal`/`gatesMet`/`gatesTotal`; now all tasks done + gates met) + per-gate `verifierLabel`/`evidenceSummary` by running `node scripts/refresh-state.js` (rollups + focus markers + the `focus.json` digest), then save the initiative file.
   - Update the parent plan's matching phase: `status: done`, `lastUpdated: <now>` — **only with `reviewGate` already recorded (step 6)**; GATE-R3 rejects a `done` phase whose review claim is missing its `at`/`reason` anchor. Set the plan's `currentPhase` to the picked next phase (or to the first of multiple in parallel mode).
   - Run `archive <slug>` on the just-closed initiative so its file moves to the resolved archive dir (nested `projects/<project-id>/<plan-slug>/phases/archive/`, legacy `initiatives/archive/`).
   - For each newly-active phase id, propose `atomic-skills:project new initiative <plan-slug>-<phase-id-lower>-<phase-title-kebab>` to materialize the next initiative. The `new initiative` flow already seeds the initiative's first stack frame from `initiative.template.md`.
   - Save the plan + PROJECT-STATUS.md.
9. On user decline (or `plan-done` accept without `currentPhase` change):
   - **Propagate completion to the initiative** (same steps 8a-d above).
   - Set the parent plan's phase `status: done` and stop without seeding a successor.

### Self-review against gates (at phase-done)

Before archiving the initiative, append a `## Self-review against code-quality gates` block to the initiative file body:

```markdown
## Self-review against code-quality gates

- **G1 read-before-claim**: N tasks closed, each linked to source lines in its `outputs[]` field. / N/A — phase was pure planning (no code).
- **G2 soft-language**: scanned `nextAction` + task descriptions + criterion descriptions for the ban list; 0 violations (or list with rewrites).
- **G6 reference-or-strike**: K exit criteria, J met with `evidence:` populated, L deferred with `deferredReason:`, M unverified-and-flagged.
- **Codex review**: ran via `atomic-skills:project review-due` at HEAD = `<sha>`, verdict `<v>`, counts `<…>`, file `.atomic-skills/reviews/<…>.md`. / SKIPPED at phase-done per user (`<reason or "no reason given">`).
- **Review gate (G2)**: recorded on the phase descriptor as `reviewGate: { status: <passed|skipped>, at: <sha>, mode: <local|both>, reason: <if skipped> }`. This prose line is the human audit; the descriptor field is the machine-checkable one GATE-R3 enforces — they must agree.
- **Lessons (G1)**: distilled M lesson(s) into `lessons/<initiative-slug>.md` (K reusable, L local), ratified by the user — or `no lessons distilled (clean phase)`. The next phase's start gate dispositions the reusable+open ones.
```

The block stays with the archived initiative so future spelunking can audit whether the gates were applied AND whether the codex review ran. Silent skipping is forbidden — the phase does not close without the checkpoint. The prose self-review and the structured `phases[].reviewGate` (GATE-R3) are written together at phase-done — the prose for humans, the field for the validator.

## Dashboard rollups & focus markers (recompute on status change)

> Moved here from the `project` router (resident → lazy): these are recomputed by the mutating transitions below (`done`, `phase-done`, `reconcile`, `switch`), so the canonical mechanism lives with the flows that run it.

**Dashboard rollups.** The generic aiDeck reads state in place and has no compute engine, so the dashboard's progress meters read precomputed scalars. On every task or exit-gate **status** change in an initiative, recompute and write its rollups onto the initiative frontmatter: `tasksTotal` = `tasks.length`, `tasksDone` = count(tasks with `status: done`), `gatesTotal` = `exitGates.length`, `gatesMet` = count(exitGates with `status: met`). The same pass also derives, onto each `exitGates[]` element, the flat gate-evidence scalars the dashboard binds as columns — `verifierLabel` (the gate's `verifier` kind + key arg, truncated) and `evidenceSummary` (one-line digest of `evidence`/`deferredReason`, omitted while pending) — because generic widgets cannot read the nested `verifier`/`evidence` objects. The deterministic batch (re)compute + drift-fixer is `node scripts/compute-rollups.js` (idempotent; safe to run anytime to backfill or repair).

**Dashboard focus markers + status hygiene.** The dashboard Home ("Foco") shows the active plan(s) and the current phase, but aiDeck cannot join plan→initiative, so two derived markers are precomputed by `node scripts/reconcile-focus.js`: `planActive` (on the plan record + carried to phase rows + on each initiative — true iff the parent plan is `active`) and `current` (on the initiative that is the active plan's `currentPhase`). The same pass enforces a hygiene invariant — **a paused plan must not leave an `active` phase behind**: any `active` phase under a `paused` plan (in the plan's `phases[]` descriptor AND the matching initiative) is demoted to `paused`. Run it on every **plan-status** change and whenever the project-status view opens (it is idempotent). This is the focus counterpart to the rollups: same read-in-place constraint, same precompute discipline.

**The recompute aggregator (`refresh-state`).** The mutating transitions above (`done`, `reconcile`, `phase-done`, `switch`) do NOT call the two scripts separately — they run `node scripts/refresh-state.js`, the single idempotent chokepoint that funnels, in order, `compute-rollups` (rollups) → `reconcile-focus` (focus markers + the paused-plan hygiene invariant) → `emit-focus` (the flat `focus.json` digest the external statusline reads). `compute-rollups.js`/`reconcile-focus.js` remain the components above; `refresh-state.js` is how every state mutation invokes them in one pass. Routing the recompute through refresh-state is what keeps the `focus.json` digest from drifting between sessions — a raw edit that runs it leaves rollups, focus markers, AND the digest consistent, independent of any session hook.

## Verifier execution patterns (`verify_exit_gate` workflow) — moved to `verifier-exec.md`

The canonical executor (the `evidence` shape, the GATE-R2 met-invariant, and the per-kind workflows `shell`/`manual`/`query`/`test`, No-verifier, Per-task verifiers, and the G9 mutation-kill note) is the **single source** in `{{READ_TOOL}} {{ASSETS_PATH}}/verifier-exec.md`. `phase-done`, per-task `verifier:` fields, `archive`'s gate-resolution step, and `reconcile` all delegate there — read it before running any verifier. Do NOT inline the executor back into these callers (one definition, many callers).

---

# Cold-path transitions (rare — read on demand)

The flows above (`push`/`pop`, `done`, `reconcile`, `phase-done`) are the hot path run most sessions. The transitions below are infrequent (reopen / scope / archive / switch); they live below the fold so the hot path stays at the top of the file.

## `phase-reopen`

Reverse of `phase-done`. Used when a closed phase needs more work (regression, scope expansion).

1. Identify the target phase (by `phaseId` arg or by reading the parent plan's last-done phase).
2. Locate the initiative file (resolved per the active layout). Check both the live path (nested `projects/<project-id>/<plan-slug>/phases/f<N>-<slug>.md`, legacy `initiatives/<slug>.md`) and its archive dir (nested `…/phases/archive/`, legacy `initiatives/archive/`). Note whether it is archived (do NOT move yet).
3. Confirm with user: "Reopen phase `<id>`? This sets initiative status back to active, clears `metAt` on all criteria, and resets all tasks to pending."
4. On accept:
   - If the initiative file was archived: move it back to its live resolved path (nested `projects/<project-id>/<plan-slug>/phases/f<N>-<slug>.md`, legacy `initiatives/<slug>.md`).
   - Set initiative `status: active`.
   - Set every `exitGate[].status` and `phases[<id>].exitGate.criteria[].status` to `pending`; clear `metAt`.
   - Set all `tasks[].status = 'pending'`; clear `tasks[].closedAt`; refresh `tasks[].lastUpdated = <now>`.
5. If the plan had advanced past this phase, leave `currentPhase` unchanged (user decides whether to re-route).
6. Save. Update PROJECT-STATUS.md.

## `detect-scope`

Wrap `scripts/detect-scope.js` to suggest a `scope.paths` value based on recent git activity.

1. Run `npm run detect-scope -- --json --branch=<active-branch> --limit=20` via {{BASH_TOOL}}.
2. Parse the JSON output. Present the top groupings to the user as a checklist.
3. On user accept: write the accepted globs into the active initiative's `scope.paths`. Save.
4. If the initiative already had `scope.paths`: merge (union) with the new suggestions; ask user before overwriting any existing entry.

## `archive [<slug>]`

Works on both plans and initiatives. If `<slug>` resolves to a plan (nested `projects/<project-id>/<slug>/plan.md`, legacy `.atomic-skills/plans/<slug>.md`), archive the plan **and propagate** to its child initiatives.

1. Identify target (arg or active initiative). Detect kind by resolved file location.
2. **Fork-link resume offer (read the edge BEFORE any finalize)**: when the target is a plan, read its child→parent edge with `getSpawnedFrom(<target-plan-dir>)` (`src/links-sidecar.js`) **before** touching the plan's status or moving any file. When the edge is present (`{ plan, phaseId, mode }`) the target is a fork child of plan `plan` at anchor phase `phaseId` (degrau 7.5 — the `spawnedFrom` edge written at fork time): **offer** to resume the parent at that anchor — the offer is opt-in, printed for the user, and is **NEVER applied automatically**. When `getSpawnedFrom` returns `null`, skip this step silently — a non-forked plan archives exactly as it did before. Reading the edge here, ahead of the finalize in steps 3–4, is what lets the `fork-resume` application keep its transaction order (the parent writeback precedes the child-archive finalize). The deterministic application of this offer across both modes (`pause` / `parallel`) and its edge cases (accept / refuse / no-TTY / failed writeback) is the **`fork-resume`** step below.
3. **Plan archival**:
   - Set the plan's `status: archived`.
   - For every initiative with `parentPlan === <slug>` and `status` in {`active`, `paused`, `pending`}: set its `status: archived`, move file to the resolved archive dir (nested `projects/<project-id>/<slug>/phases/archive/<YYYY-MM>-<phase-slug>.md`, legacy `initiatives/archive/<YYYY-MM>-<slug>.md`).
   - **Nested:** the plan folder stays in place under `projects/<project-id>/` with `status: archived` (the `phases/archive/` subdir holds its closed phases). **Legacy flat:** move the plan file to `plans/archive/<YYYY-MM>-<slug>.md`.
4. **Initiative archival**:
   - **Resolve open exit gates first** (applies to BOTH standalone and plan-anchored initiatives — standalone has no `phase-done`, so this is the only place its gates get closed). For each `exitGates[]` entry whose `status` is not already `met` or `deferred`: run its `verifier` per the **Verifier execution patterns** (or ask the user when `kind: manual`), then set `status: met` (`metAt: <now>`, plus `evidence` when a verifier ran) on pass, or `status: deferred` (`deferredReason`) when the user skips it. **Never set `done`** — that is a Task status; gate status is `pending`/`met`/`deferred` only (see the *Gate status invariant* in the router). If the user wants to archive without verifying, mark the remaining gates `deferred` with a reason — do not leave them `pending` and do not coerce them to `done`.
   - If the initiative has `parentPlan` and the matching plan phase has `status: done`, verify that the initiative `status` is `done` (not `active`/`pending`). If not, apply the propagation steps from `phase-done` step 8a-d first (set all tasks `done`, exitGates `met`, initiative `status: done`), then continue.
   - Set the initiative's `status: archived`.
   - Move file to the resolved archive dir (nested `projects/<project-id>/<plan-slug>/phases/archive/<YYYY-MM>-<slug>.md`, legacy `initiatives/archive/<YYYY-MM>-<slug>.md`).
5. Update PROJECT-STATUS.md: remove archived rows from active tables; append to "Recently Archived" (keep last 10).
6. Announce: "Archived `<slug>` (+<N> child initiatives if plan)".

### `fork-resume` (applies the offer from `archive` step 2)

Runs only when `archive` step 2 read a `spawnedFrom` edge `{ plan, phaseId, mode }` off the child being archived. It resumes the parent `plan` at its anchor phase `phaseId`, deterministically across both fork modes (`pause` / `parallel`) and all four decision paths (accept / refuse / no-TTY / failed-writeback).

**Transaction-order invariant:** the parent writeback **precedes** the child-archive finalize (`archive` steps 3–4). A declined, deferred, or failed writeback persists a durable `pendingWriteback` (`op: resumeParent`) on the **child's** sidecar and the child does **not** finalize until recovery — there is never a child archived while the parent is left in an inconsistent state.

**Resume mutation (both modes, identical target state):** set the parent plan `status: active`; set the anchor phase `phaseId` to `status: active` in the parent's `phases[]` descriptor **and** in its matching initiative file; set `currentPhase: <phaseId>` — the **named anchor** from the edge, never the by-status active phase. Capture the parent plan.md content token (`contentToken`, `src/parallel-state.js`) at read time as `readToken` for the marker / CAS.

1. **Decide (opt-in, non-interactive guard):** with a TTY, prompt "Resume parent `<plan>` at anchor `<phaseId>`? [accept / refuse]". With **no TTY**, do NOT prompt — take the no-TTY path directly (record the durable marker, step 4). This guard is on every prompt in this step, not just the first.
2. **mode `parallel`** (parent lives on its own branch/worktree):
   - **accept** → resolve the parent's canonical dir (`resolveCanonicalParentDir`), then call `writebackOrDefer({ canonicalFile: <parent plan.md>, childPlanDir, readToken, mutate: <resume mutation>, pending: { target: 'parent-plan', parent: <plan>, op: 'resumeParent', args: { phaseId }, readToken, detectedAt: <now> } })`. On `{ ok: true }` the parent is resumed and any stale marker cleared → continue to `archive` steps 3–4 (finalize the child). On `{ ok: false, conflict, deferred }` the parent moved since the read — the call has **already** recorded the durable `pendingWriteback` (it never leaves recording to the caller); **abort the archive finalize**, surface the conflict + recovery, leave the child `active`/un-archived.
   - **refuse / no-TTY** → do NOT writeback. Record the durable `pendingWriteback` (`op: resumeParent`, same shape) via `recordPendingWriteback` so the resume is replayable, and do **not** finalize the child archive (child stays open with a pending-resume; parent untouched).
3. **mode `pause`** (parent in the same tree, paused by the fork):
   - **accept** → apply the resume mutation directly to the parent plan.md + anchor initiative file (single writer, same tree — no CAS), then run `node scripts/refresh-state.js` to cascade focus markers + the `focus.json` digest. Continue to `archive` steps 3–4.
   - **refuse / no-TTY** → record the durable `pendingWriteback` (`op: resumeParent`) and do not finalize the child.
   - A **write failure** on accept is treated like the parallel conflict: the durable marker stands and the child does not finalize until recovery.
4. **Recovery:** a later `fork-resume` (or `reconcile`) reads the child's `pendingWriteback`, replays the declarative `op`/`args` against the parent's then-current state, clears the marker on success, and only then may the child finalize. The marker is declarative (`op` + `args` re-applied to fresh state), never a byte patch.

## `switch <slug>`

Works at 2 levels: switching plans, OR switching initiatives within the active plan / among standalone.

1. Detect kind (resolve nested-first, then legacy flat): is there a plan at `projects/<project-id>/<slug>/plan.md` (legacy `.atomic-skills/plans/<slug>.md`)? OR a phase/standalone initiative at `projects/<project-id>/<plan-slug>/phases/f<N>-<slug>.md` (legacy `.atomic-skills/initiatives/<slug>.md`)?
2. **Plan switch**:
   - Find target plan; abort if `status` not in {`active`, `paused`}.
   - Set any other active plan to `status: paused` — **and cascade: pause its `active` phase** (in the plan's `phases[]` descriptor AND the matching initiative file). A paused plan must never leave an `active` phase behind.
   - Set target plan to `status: active`.
   - Update PROJECT-STATUS.md, then run `node scripts/refresh-state.js` (cascades the pause + refreshes the dashboard `planActive`/`current` focus markers AND the `focus.json` digest in one pass).
3. **Initiative switch**:
   - Find target initiative; abort if not active/paused.
   - If target has `parentPlan` ≠ currently-active plan's slug: warn and offer to also switch the plan.
   - Set any other active initiative to `status: paused`.
   - Set target initiative to `status: active`.
   - Update PROJECT-STATUS.md, then run `node scripts/refresh-state.js` (the active-initiative change flips the `current` focus marker, so refresh the markers + the `focus.json` digest in the same pass).
4. Announce.
