# project — task / phase transitions (lazy detail)

Loaded by the router for: `done`, `phase-done`, `phase-reopen`, `switch`, `archive`, `detect-scope`, `reconcile`, and the per-task / exit-gate **Verifier execution patterns**. The router holds the always-resident pre-mutation gates (migration check, reconciliation gate, gate-status invariant); this file holds the per-command procedures plus the migration-check detail.

## Entity-file resolution (nested-first, flat-fallback)

Every step below that "loads", "moves", or "archives" a plan/initiative file resolves its path against the **nested** layout first and the legacy **flat** layout only as a fallback (see the router's layout model):

- **Plan** `<slug>` → `projects/<project-id>/<slug>/plan.md`; legacy `plans/<slug>.md`.
- **Phase initiative** of plan `<plan-slug>` → `projects/<project-id>/<plan-slug>/phases/f<N>-<slug>.md`; legacy `initiatives/<slug>.md`. A **standalone** initiative is its own degenerate 1-phase plan (`projects/<project-id>/<slug>/{plan.md,phases/<slug>.md}`).
- **Archive** → the layout's archive dir: nested `projects/<project-id>/<plan-slug>/phases/archive/<YYYY-MM>-<slug>.md` for a phase initiative (a whole plan is archived in place with `status: archived`); legacy flat `initiatives/archive/` + `plans/archive/`.
- **Index** → that project's `projects/<project-id>/PROJECT-STATUS.md`; legacy top-level `.atomic-skills/PROJECT-STATUS.md`.

### Fuzzy identifier resolution (applies to every id/slug/phase arg — C-8 / E3#3)

A user resuming after a break knows *what* they want ("reopen the validation phase") but not the exact token (`f0.5-validation`). So every verb that takes a `<slug>` / `<phase-id>` / `<task-id>` (`switch`, `phase-reopen`, `materialize`, `unblock`, `done`, `why`, `depend`, `split-phase`) resolves its argument leniently instead of demanding an exact match:

1. **Exact id/slug** → use it.
2. **Else case-insensitive prefix / substring of the id OR the human `title`/`summary`** across the candidate set (active plan's phases/tasks, or plans for `switch`). A single match → use it (echo the resolved id: "Resolved 'validation' → `f0.5-validation`").
3. **Multiple matches** → list them and disambiguate via {{ASK_USER_QUESTION_TOOL}} (never guess).
4. **Zero matches** → print the valid ids for that verb's scope (the same list the abort messages already show) so the next attempt is one copy away — never just "not found".

This is resolution only; it does not relax any gate. `materialize` already accepts id-or-slug — this generalizes that leniency to the rest so a wrong first guess costs a disambiguation, not a browser round-trip.

Where a step writes `initiatives/…`, `plans/…`, or `PROJECT-STATUS.md` below, read it as "the resolved path for the active layout".

## Pre-mutation migration check (detail)

Every time you load an existing initiative or plan for mutation:
1. Parse its frontmatter.
2. If `schemaVersion` is absent or missing, this is a **legacy file**. STOP and prompt the user to invoke `atomic-skills:project migrate <slug>` (which handles the standalone-vs-in-plan choice and calls `src/migrate.js:migrateLegacyInitiative`). Abort the current mutation with: "Mutation cancelled — file is legacy. Run `atomic-skills:project migrate <slug>` first, then retry."

The pre-mutation check is the **only** way legacy files are touched, and migration itself is delegated to the `migrate` flow (`{{ASSETS_PATH}}/project-migrate.md`). This skill never silently writes legacy-shape YAML.

## Pre-mutation reconciliation gate (detail)

Every time you load an active initiative for a **mutating** command (`push`, `pop`, `park`, `emerge`, `promote`, `done`, `phase-done`, `phase-reopen`, `archive`, `switch`, `detect-scope`, `re-ratify`, `new-task`, `new-phase`), run this check AFTER the migration check and BEFORE executing the command. `materialize` can be the command that creates the phase initiative; when no active initiative exists, it skips this active-initiative reconciliation gate and runs its own plan-level pre-flight. When called from `phase-done`/`switch`/`phase-reopen`, the caller has already run this gate.

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

## `unblock <task-id>` (C-1 / B2#3 — the missing exit from `blocked`)

`blocked` is a first-class open task status (the reconciliation gate sets it, and auto-transition counts it among remaining work), but it had **no documented forward transition** — a blocked task could only be `done` (needs its verifier to pass) or hand-edited, which the Iron Law forbids. `unblock` is that exit. It is a mutating command (subject to the pre-mutation gates); it does NOT close the task — it returns it to workable state.

1. Locate the task `<task-id>` in the active initiative's `tasks[]`. If its `status` is not `blocked`, report that and stop (nothing to unblock).
2. If it carries `blockedBy[]`, show each blocker and its current status. Confirm with the user that the blocker is resolved (or that they want to unblock regardless). A blocker task that is itself still open is a warning, not a hard stop — the user may have unblocked out-of-band.
3. Set `status: active` (or `pending` if the user has not started it), clear `blockedBy[]`, bump `lastUpdated`. Leave `evidence`/`closedAt` untouched (the task was never closed).
4. Run `node "$PKG_ROOT/scripts/refresh-state.js"` so rollups/focus reflect the reopened work, and save.

## Plan dependency block guidance (`dependsOnPlans[]`)

Before a transition or next-action view tells the operator to execute a plan, it must surface plan-level blockers from `dependsOnPlans[]` separately from phase/task dependencies. Build the project plan graph with `src/plan-dependencies.js` and treat `blockedByPlans[<plan-slug>]` as the operational source of truth; `spawnedFrom` and `phases[].spawnedPlans` explain origin only and never open or close execution by themselves.

When a plan is blocked, print the blocked path in this shape: `plan <dependent> is blocked by prerequisite plan <prerequisite> (status: <status>)`. Then print the resume path: switch to the prerequisite plan and finish it when its status is `active`, `paused`, or `pending`; when the prerequisite is `done`, rerun the original transition; when the prerequisite is `archived`, keep the dependent blocked unless the edge records an explicit archived-resolution decision (`release.archived: resolved`). A transition that detects such a blocker stops before changing plan/phase status, so the operator never advances a blocked plan by following stale next-action prose.

Use the same split in dashboard prose and next-action prose: **Caminho de execucao**
is the operational lane, while **Surgiu de** is lineage. Example:
P1/F2/T-004 generating P2 renders `Surgiu de P1 · F2/T-004`; P2 enters
`Bloqueado` only when `dependsOnPlans[]` also names P1 as its prerequisite.
Without that edge, the lineage row never blocks execution.

## Microcommit checkpoints

Every mutating transition that closes a task or advances a phase ends with an explicit-path git checkpoint. Run these via {{BASH_TOOL}} and keep unrelated dirty files unstaged:

- Inspect first with `{{BASH_TOOL}} git status --short` and `{{BASH_TOOL}} git diff --name-only`.
- Stage only the files written by the transition with `{{BASH_TOOL}} git add <explicit-paths>`.
- For a single task close, commit the state checkpoint as `{{BASH_TOOL}} git commit -m "chore(project): checkpoint <plan> <phase> <task-id>"`.
- For a phase boundary, create one coordinator-owned close checkpoint shaped as `{{BASH_TOOL}} git commit -m "chore(project): advance <plan> <phase>"`.

Never use `git add .` or `git add -A`. If `git diff --name-only` includes paths that do not belong to the current transition, leave them unstaged and report them in the `## Session handoff` block instead of sweeping them into the checkpoint.


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
   - `--park`: route through the `park` flow (`{{ASSETS_PATH}}/project-emergence.md`) — including the ratify gate before the entry is written to `parked[]`. Treat the delegated flow as a transaction that returns one of `applied` / `cancelled` / `blocked`.
   - `--emerge`: route through the `emerge` flow (`{{ASSETS_PATH}}/project-emergence.md`) — including the ratify gate before the entry is written to `emerged[]`. Treat the delegated flow as a transaction that returns one of `applied` / `cancelled` / `blocked`.
3. **Transactional pop boundary:** remove the frame from `stack[]` ONLY after the chosen destination reports `applied`. If the user replies `cancel`, gives a non-ratify response, the delegated flow blocks on validation, or the write to `parked[]`/`emerged[]` fails, leave the frame in place, leave `lastUpdated` unchanged, and announce: "Pop cancelled — frame <N> remains on the stack."
4. For `--resolve`, the destination is local and the transaction is immediately `applied`; remove the frame.
5. Announce: "Frame <N> popped to <destination>. Current frame: <new top>."
6. Update `lastUpdated` and save.

`pop --resolve` skips the ratify gate entirely — resolving a frame doesn't create a new backlog entry, so there's nothing to articulate.

## `done <task-id>`

`done` is the closure authority for task state. It does not consume task-evidence
written by `verify-claim`; a caller may run `verify-claim` as pre-close
confidence, but task closure evidence is written only by this flow from the
task's own `verifier:`. Do NOT consume `verify-claim` output as task evidence.

1. Locate task in `tasks:` (array). Find the entry where `id === <task-id>`.
2. **Verifier handling is the first state-changing gate.** If the task has a non-empty `verifier:`, apply **Per-task verifiers** below now and keep the result as candidate `tasks[].evidence`. A deterministic `shell`/`test`/`query` verifier must produce `evidence.passed === true` (and `testsCollected > 0` for `kind: test`) before closure continues. If the verifier fails, is skipped, has no real runner, or lacks required evidence, leave the task's `status` unchanged and stop; do not emit completion, recompute rollups, or checkpoint a close. For a `manual` verifier or no verifier, the manual-ack path in `verifier-exec.md` is the only non-deterministic close path.
3. Choose one immutable `closedAt: <now>` and derive `idempotencyKey = buildDoneIdempotencyKey({ projectId, planSlug, phaseId, taskId, closedAt })`. Build one close bundle containing task `status: done`, `closedAt`/`lastUpdated`, the passing evidence, the new `nextAction`, and the complete `## Session handoff` fields. **Advance `nextAction` (C-5)** to exactly one verified imperative: the next unblocked task, the unblock path when only blocked tasks remain, `Run \`phase-done\`` when an in-plan phase has no open tasks, or `Run \`archive <slug>\`` for a standalone initiative.
4. Execute `executeDoneTransaction(...)` from `scripts/done-transaction.js`. `effects.loadInitiative` must reload the authoritative project/plan/phase initiative inside the coordinator's identity lock; the lock scope is `projectId/planSlug/phaseId/taskId` and deliberately excludes `closedAt`. The coordinator verifies that the close scope and unique task belong to that fresh initiative, persists the immutable close bundle plus digest in a durable recovery marker, then in order: persists the complete close bundle; runs `refresh-state`; calls `ensureCompletion(root, { event: 'task-done', projectId, planSlug, phaseId, taskId, idempotencyKey })`; finds or creates the explicit-path checkpoint containing initiative state, handoff, derived state, and analytics; confirms the task-owned worktree is clean; finally removes the marker. Never append the event before durable close state.
5. On retry, read the marker and resume only the unfinished stage against fresh authoritative state. A changed close bundle/evidence/handoff fails closed; `ensureCompletion` returns the existing immutable event for the same key; a stored checkpoint is reauthenticated by `findCheckpoint` before cleanup. A concurrent call with another timestamp observes the already-done authoritative task and reuses its original close without a second event or checkpoint. The marker remains at `.atomic-skills/status/done-transactions/<sha256>.json` after any failed boundary and is removed only after the complete checkpoint is authenticated and proven clean.
6. **Microcommit checkpoint**: the transaction stages only its explicit initiative, handoff, derived-state, and analytics paths and creates `{{BASH_TOOL}} git commit -m "chore(project): checkpoint <plan> <phase> <task-id>"`. The recovery marker is deliberately untracked and excluded from the commit. If unrelated dirty files pre-existed, leave them unstaged and name them in the announcement.
7. **Auto-transition detection**: count remaining tasks with `status` in `{pending, active, blocked}`. If zero:
   - When the initiative has a `parentPlan`: announce "Last task of `<parentPlan>/<phaseId>` closed. Run `phase-done` to verify exit gates and advance the plan?". The next session's SessionStart hook also surfaces a 🔔 phase-transition reminder via the active-initiative pending-task count.
   - When the initiative is standalone: announce "All tasks of `<slug>` closed. Run `archive <slug>` or open a new initiative?".
   - Do NOT automatically run `phase-done` or `archive` — the user opts in (intrusive-actions rule).
8. Announce the task closure and the checkpoint commit sha.

## `reconcile`

The **only** completion-drift disposition path (Spec 1, Component B).
`detect-completion` remains pure read-only; `reconcile` is where the user
disposes of each candidate, while `done` remains the only task closure
authority. Subject to the standard pre-mutation gates (migration check,
reconciliation gate). It NEVER fabricates a close: the detection signal (a
changed deliverable), the acknowledgement anchor, and the close authority (a
passing verifier or an explicit human ack routed through `done`) stay separate.

1. Run the deterministic detector: `node "$PKG_ROOT/scripts/detect-completion.js" --json` (add `--project <id>` when more than one project holds the resolved plan-slug; `--slug`/`--plan` to widen within the project). It returns `candidates[]`, each carrying `kind` (`task`|`criterion`), `id`, the resolved `initiativePath` (the **safe write target** — never a bare slug), `evidence` (`output-exists`|`commit-ref`), `paths`/`commit`, and `hasVerifier` + `verifier`.
2. If `drift` is false → announce "No completion drift — open entries carry no done-signal." and stop.
3. For each candidate (batch the **oldest 4 first**, mirroring the reconciliation gate), present a {{ASK_USER_QUESTION_TOOL}} whose options are **verifier-aware**:
   - **Fresh-read write token:** immediately before applying any disposition that writes, re-read `candidate.initiativePath` from disk and locate the entry by `kind` + `id` again. Never write back a parsed snapshot captured before the prompt. If the entry is missing, already closed, or its verifier/context changed since detection, skip that candidate and re-run `detect-completion.js --json` after the current batch; this avoids stale snapshot writes after another session edited the same initiative.
   - **`hasVerifier: true`** → options `Run verifier` / `Still open` / `Skip`. There is **no "mark done" shortcut** — the only close path is running the verifier (the **Verifier execution patterns** below), which writes GATE-R2 `evidence` and, on pass, sets the entry `done`/`met`. A failing verifier leaves it open. This is forced by GATE-R2: an entry with a `shell`/`test`/`query` verifier cannot reach `done`/`met` without `evidence.passed === true`.
   - **`hasVerifier: false`** → options `Mark done` / `Still open` / `Skip`. `Mark done` is the manual-acknowledgement path — for a **task**, run the `done <id>` flow (incl. auto-transition + rollup recompute); for a **criterion**, the "No verifier present → manual ack" path → set `status: met`, `metAt: <now>`, write `evidence` (`verifierKind: manual`, `passed: true`). GATE-R2 does NOT gate verifier-absent entries, so manual ack is valid here.
   - For every reconciled **task** that reaches `done` (verifier-backed or manual `Mark done`), emit exactly one `task-done` completion event through the `done <id>` flow's `appendCompletion` / `append-completion` instruction, carrying `projectId`, `planSlug`, `phaseId`, and `taskId` for that task. Criterion-only acknowledgements do not emit task completion events.
   - **`Still open`** → use only a schema-supported detection anchor. For a
     **task candidate**, bump that task's `lastUpdated` to now. For a
     **criterion candidate**, bump the initiative's top-level `lastUpdated` to
     now; the strict `ExitCriterion` shape intentionally does not support
     `lastUpdated`. Either acknowledgement resets the signal clock used by
     `detect-completion` so that candidate does not re-surface immediately.
     Change no status, evidence, `metAt`, `closedAt`, event, or rollup here.
   - **`Skip`** → no change.
4. After applying dispositions, recompute the initiative's dashboard rollups by running `node "$PKG_ROOT/scripts/refresh-state.js"` (rollups + focus markers + the `focus.json` digest, one pass) and save. If closing the last open task of a phase initiative, the `done` flow's auto-transition fires the `phase-done` offer at the right time — that loop-close is the whole point of making this moment reliably reachable.

This is the pause-point applied to completion, as an explicit verb — so `status`/`verify` keep their read-only semantics and the user is never trapped (every candidate has a valid action for its verifier state).

## `phase-done`

Invoked when the active initiative is the phase initiative of an active plan AND all its tasks are closed. Iterates the phase's exit gate criteria, archives the phase initiative, advances `currentPhase` per the dependency graph, and seeds the next phase's initiative.

1. Load the active initiative. Verify it has `parentPlan` + `phaseId` set. Else abort.
2. Load the parent plan (resolve `<parentPlan>` nested-first: `projects/<project-id>/<parentPlan>/plan.md`, legacy `.atomic-skills/plans/<parentPlan>.md`). Locate the phase by `phaseId`. Read `phase.exitGate.criteria` AND `initiative.exitGates` (combine; phase-level criteria are authoritative for the gate).
3. Run the pure phase-done preflight before any gate verifier or review: call `classifyPhaseDonePreflight(...)` with fresh plan/descriptor/initiative/tasks. Identity, DAG, or open-task failure stops with zero verifier, review, event, archive, or state writes.
4. For each criterion (`status === pending`) → apply the **Verifier execution patterns** below against the current clean code checkpoint. Keep the resulting gate mutations as transaction candidates (not independent state writes), and stamp every passing `evidence` with `verifiedCommit: <full current HEAD>`. Report the status summary and continue only when every criterion is `met` with `evidence.passed: true` at that same commit.
5. Any `pending`, `failed`, `declined`, `deferred`, `skipped`, or evidence-less criterion is non-terminal: leave the initiative `active` (or explicitly `paused`) and STOP. Never offer defer/skip as a phase-close override, and never convert an unverified gate to `met`.
6. **Review gate** — run `atomic-skills:review-code` on the phase diff. This step is mandatory for terminal closure.
   - **Clean-tree precondition:** before invoking review, require `git status --porcelain` to be empty. Checkpoint intended task/gate evidence with explicit paths first; unrelated dirty work must be committed or stashed. A dirty tree blocks review and phase closure rather than letting the recorded SHA omit pending bytes.
   - Compute the diff range: from the phase initiative's `started` timestamp (find the closest commit via `git log --before=<started> -1 --format=%H`) to HEAD.
   - **Pick the mode by the destructive-diff signal (G5).** Compute `review-code`'s `DESTRUCTIVE` signal over this range (the deterministic heuristic in `skills/core/review-code.md` → *Destructive-diff signal*: any whole non-test file deleted, any schema/data drop token, or deletion-dominated churn). When `DESTRUCTIVE` is true, run **`--mode=both`** — a destructive phase is exactly where a same-model local pass false-greens the orphaned-data / dangling-reference regression a delete leaves behind, so cross-model is not optional. Otherwise run `--mode=local`. A user may still downgrade a destructive phase to `--mode=local`, but only as an explicit, recorded override (note it in the self-review block alongside the review outcome) — never by default. Terminal closure has no review-skip path.
   - Run `atomic-skills:review-code <range> --mode=<both|local>`. The convergence rule (plateau detection, `--max-iterations`) applies automatically.
   - Apply blocker/critical findings. If fixes are committed, the review range shifts — this is expected and handled by the convergence rule.
   - **Codex review tracking integration**: before archiving, check `.atomic-skills/status/last-review.json`. If `lastReviewedCommit` ≠ HEAD, announce: "Phase `<id>` is closing with `<N>` commits / `<L>` lines un-reviewed since last codex review. Run cross-model review against `<lastReviewedCommit>..HEAD` before archiving? (y/N)". On `y`: invoke `review-due` (`{{ASSETS_PATH}}/project-drift.md`). Apply blocker/critical fixes, then proceed.
   - **Record the review gate on the phase descriptor (G2 — GATE-R3 precondition).** Build the candidate `phases[<this>].reviewGate` in memory as `{ status: passed, at: <full reviewed HEAD sha>, mode: <local|codex|both>, reviewFile: <repository-local .atomic-skills/reviews path>, verifiedAt: <now> }`. The receipt bytes and gate/lessons mutations remain transaction candidates until the close commit; `worktreeDirty` describes unrelated bytes outside those candidates, avoiding a self-referential commit-SHA receipt. Immediately before the first phase-close write, re-read the plan and initiative, set `currentHead` from `git rev-parse HEAD`, verify the candidate review SHA with `git cat-file -e <sha>^{commit}`, and verify the candidate receipt contains that SHA. When the authoritative gates include `F4-G3`, also run `{{BASH_TOOL}} node "$PKG_ROOT/scripts/materialize-state.js" --check-history-receipt <configured-receipt-path> --plan <resolved-plan-path>` and set `historyReceiptCurrent: true` only from exit `0`; the CLI binds receipt identity and sources to the unique configured successor barrier, while a missing, stale, skipped, or deferred receipt stays false. Set `reviewCommitExists`/`reviewFileMatches` from those checks, and call `classifyPhaseDoneCommit({ plan: <fresh plan>, phase: <fresh descriptor>, initiative: <fresh initiative>, tasks: <fresh tasks>, exitGates: <fresh authoritative gates>, reviewGate: <candidate>, currentHead, reviewCommitExists, reviewFileMatches, historyReceiptCurrent, worktreeDirty, lessonsState: <recorded|none>, requireLessons: true })` from `scripts/lifecycle-order-guard.js`. Every exit-gate `evidence.verifiedCommit` and `reviewGate.at` must equal `currentHead`; if review applied a fix or any other commit moved HEAD, rerun every gate verifier at the new HEAD before retrying. If the guard returns `blocked`, print `reason` + `recommendedCommand` and STOP without writing review metadata, lessons, archive state, events, or successor state. Only an allowed result may atomically persist the candidates and continue. **Do not advance to step 7/8 until this commit guard allows and `reviewGate` is recorded.**
   - **Distill lessons — part of the DEFINITION of phase-done, not optional (G1, the Spec-2 capture).** A `review-code` finding *generates* learning, but nothing aggregates it where the NEXT phase will read it — so the lesson evaporates unless the user happens to ask (the F0-decommission "15k orphaned emails" lesson was nearly lost exactly this way). After the review gate, **draft the phase's lessons from real failure signals only** — confirmed `review-code` findings (especially a cross-model blocker the local pass missed), reopened/blocked tasks, deferred gates, the phase diff, and user corrections made this phase. For each, write one entry: a `statement` (what went wrong, blameless) + a `corrective` (the locus + what to do next time — Self-Refine actionable shape), `scope: reusable` if it generalizes beyond this phase else `local`, `appliesTo: []` (all future phases) or specific `phaseId`s, `status: open`, `confidence: 2` (ExpeL born-2), `evidence` (link to the review file / self-review), `createdAt`/`validatedAt: <now>`. Then **present a `Proposed lessons:` block and have the user ratify / edit / reject** (the existing ratify-gate; selective + capped + blameless — verify-before-store). Write the ratified set to the per-initiative lessons file `.atomic-skills/projects/<project-id>/<parentPlan>/lessons/<initiative-slug>.md` (create it if absent: `{ schemaVersion, slug: <initiative-slug>, projectId, parentPlan, lessons: [...] }`), then `node "$PKG_ROOT/scripts/validate-state.js"` that file. A clean phase with no failure signal records **zero lessons explicitly** (note "no lessons distilled — clean phase" in the self-review block) — silence ≠ zero; the step is always *answered*. The phase-start gate (`project-create-initiative.md`) is what surfaces these into the next phase via `node "$PKG_ROOT/scripts/list-lessons.js" --project <project-id> --plan <parentPlan> --phase <next-phase-id>`.
7. **Advance the plan** — call `src/transition.js`:`proposeAdvance(plan, phaseId)` to decide what's next. The function returns one of four shapes:
   - `{ kind: 'blocked', eligible: [], blockers: [...] }` — the graph is open but no phase is startable, or it contains an unknown/self/cyclic dependency. Print the stable blocker codes and STOP; zero eligible is never evidence that the plan is complete.
   - `{ kind: 'plan-done', eligible: [] }` — no more eligible phases. Offer to mark the plan itself `status: done` and `archive` it.
   - `{ kind: 'single', next: '<id>', alternatives: [...] }` — propose "Phase `<id>` done. Advance `currentPhase` to `<next>`? (y/N)". List `alternatives` so the user can override before accepting.
   - `{ kind: 'parallel-choice', eligible: [...] }` — when the plan has `parallelismAllowed: true`, ask "Which of `<eligible...>` should be activated now? Select one or more (or `none`)".
   Before presenting any of the above, call `src/transition.js`:`unknownDeps(plan)`. If it returns non-empty, surface the typos to the user and abort the advance — the dependency graph is broken.
   Also apply **Plan dependency block guidance (`dependsOnPlans[]`)** before offering the next executable phase: if the current plan is blocked by a prerequisite plan, print the prerequisite, its status, and the resume path, then stop before writing `currentPhase` or phase statuses.
8. On the user's accept of an advance:
   - Call `executePhaseDoneTransaction(...)` from `scripts/phase-done-transaction.js` exactly once with the guarded candidate bundle. Every bullet below is implemented **inside** that coordinator's named effects; none is an independent write path:
     - `effects.loadState` reloads the authoritative plan, unique descriptor, initiative, tasks, and gate mirrors inside a `projectId/planSlug/phaseId` lock that excludes `closedAt`; a concurrent later timestamp therefore reuses the terminal phase instead of creating another close.
     - `effects.findCommit` authenticates an existing close checkpoint for this derived key.
     - `effects.commit` atomically persists the mirrored gates, review receipt, lessons, terminal plan/initiative state, archive move, handoff and selected plan advance using explicit paths, then returns the full `closeSha`.
     - `effects.emit` calls `ensureCompletion(root, { event: 'phase-done', projectId, planSlug, phaseId, taskId: null, idempotencyKey, closeSha, ts: close.closedAt, actuals })`.
     - `effects.materializeSuccessor` publishes a descriptor-only successor through `materializeState({ prerequisiteCloseSha: closeSha, ... })`. When a successor was accepted, pass its complete identity/path/hash manifest on `input.successor`; the coordinator persists and digests that manifest before commit, requires the effect, and rejects any changed or omitted manifest on recovery. With no accepted successor, omit both the manifest and effect.
     - `effects.assertClean` proves that no task-owned bytes remain outside the durable recovery marker.
     A retry reuses the marker and authenticated `closeSha`; it never reruns the new-close commit guard after the close commit and never performs a terminal effect outside the coordinator.
   - **Propagate completion to the initiative** (inside `effects.commit`, BEFORE archiving):
     a. Assert again that all tasks were already closed individually by `done <task-id>` and that each close emitted its own completion event. `phase-done` never mutates an open task. Emit no `task-done` completion events here; `effects.emit` emits exactly one `phase-done` completion event with the derived `idempotencyKey` and `closeSha`, carrying the phase's aggregate actuals once. Compute `actuals` with `computePhaseActuals(phaseStarted, { cwd: root, sinceCommit: phaseStartedCommit })`, where `phaseStartedCommit` is the initiative's immutable `startedCommit` and `phaseStarted` is its phase timestamp fallback. Omit unavailable actuals; never invent them.
     b. Mirror initiative `exitGates[]` from the authoritative phase criteria by `id`. Every matching phase criterion must already be `met` with passing evidence; copy `status`, `metAt`, and `evidence` exactly. A pending/failed/deferred/skipped/evidence-less criterion aborts before archiving and returns to steps 3–5; this is a gate leak. If an initiative-only gate has no matching phase criterion, preserve its current status and never coerce it to `met`.
     c. Set initiative `status: done`, `lastUpdated: <now>`, `nextAction: null`.
     d. Recompute the initiative's dashboard rollups (`tasksDone`/`tasksTotal`/`gatesMet`/`gatesTotal`; now all tasks and gates are closed with passing evidence) + per-gate `verifierLabel`/`evidenceSummary` by running `node "$PKG_ROOT/scripts/refresh-state.js"` (rollups + focus markers + the `focus.json` digest), then save the initiative file.
   - Update the parent plan's matching phase descriptor to `status: done` — **only with `reviewGate` already recorded (step 6)**; GATE-R3 rejects a `done` phase whose review claim is missing its `at`/`reason` anchor. Set the plan's `currentPhase` to the picked next phase (or to the first of multiple in parallel mode), and refresh the plan root `lastUpdated`.
   - Run `archive <slug>` on the just-closed initiative so its file moves to the resolved archive dir (nested `projects/<project-id>/<plan-slug>/phases/archive/`, legacy `initiatives/archive/`).
   - For each newly-active phase id, set the phase descriptor to
     `status: active` and refresh the plan root `lastUpdated`. If the matching initiative
     file exists, set that initiative to `status: active` and refresh
     `lastUpdated`, then run `refresh-state`. If the initiative file is absent
     (descriptor-only), run `atomic-skills:project materialize <phase-id>` with
     the full selected active phase id set so parallel-choice phases beyond the
     first pass pre-flight; do not propose `new initiative` for descriptor-only
     phases.
   - Save the plan + PROJECT-STATUS.md.
   - **Microcommit checkpoints**: `effects.commit` stages explicit phase-boundary paths only and creates the single authenticated close checkpoint `{{BASH_TOOL}} git commit -m "chore(project): advance <plan> <phase>"`. Never use `git add .` or `git add -A`.
9. On user decline (or `plan-done` accept without `currentPhase` change):
   - Invoke the same `executePhaseDoneTransaction(...)` boundary with the same `loadState`, `findCommit`, `commit`, `emit`, and `assertClean` effects, but omit both `input.successor` and `materializeSuccessor`, and keep `currentPhase` unchanged.
   - Inside `effects.commit`, propagate completion using steps 8a-d, set the parent descriptor `status: done`, archive the initiative, and create the no-successor close checkpoint with explicit paths only.

### Self-review against gates (at phase-done)

Before archiving the initiative, append a `## Self-review against code-quality gates` block to the initiative file body:

```markdown
## Self-review against code-quality gates

- **G1 read-before-claim**: N tasks closed, each linked to source lines in its `outputs[]` field. / N/A — phase was pure planning (no code).
- **G2 soft-language**: scanned `nextAction` + task descriptions + criterion descriptions for the ban list; 0 violations (or list with rewrites).
- **G6 reference-or-strike**: K exit criteria, K met with passing `evidence:` populated, 0 deferred/skipped/unverified.
- **G10 gate-must-be-able-to-fail**: each exit criterion states its `FAILS when …` — the concrete red condition. Vanity criteria (no input makes them red) rewritten to a falsifiable claim or struck. Criteria without a stateable failure: <list, or "none">.
- **Codex review**: ran via `atomic-skills:project review-due` at HEAD = `<sha>`, verdict `<v>`, counts `<…>`, file `.atomic-skills/reviews/<…>.md`.
- **Review gate (G2)**: recorded on the phase descriptor as `reviewGate: { status: passed, at: <sha>, mode: <local|both> }`. This prose line is the human audit; the descriptor field is the machine-checkable one GATE-R3 enforces — they must agree.
- **Lessons (G1)**: distilled M lesson(s) into `lessons/<initiative-slug>.md` (K reusable, L local), ratified by the user — or `no lessons distilled (clean phase)`. The next phase's start gate dispositions the reusable+open ones.
```

The block stays with the archived initiative so future spelunking can audit whether the gates were applied AND whether the codex review ran. Silent skipping is forbidden — the phase does not close without the checkpoint. The prose self-review and the structured `phases[].reviewGate` (GATE-R3) are written together at phase-done — the prose for humans, the field for the validator.

## Dashboard rollups & focus markers (recompute on status change)

> Moved here from the `project` router (resident → lazy): these are recomputed by the mutating transitions below (`done`, `phase-done`, `reconcile`, `switch`), so the canonical mechanism lives with the flows that run it.

**Dashboard rollups.** The generic aiDeck reads state in place and has no compute engine, so the dashboard's progress meters read precomputed scalars. On every task or exit-gate **status** change in an initiative, recompute and write its rollups onto the initiative frontmatter: `tasksTotal` = `tasks.length`, `tasksDone` = count(tasks with `status: done`), `gatesTotal` = `exitGates.length`, `gatesMet` = count(exitGates with `status: met`). The same pass also derives, onto each `exitGates[]` element, the flat gate-evidence scalars the dashboard binds as columns — `verifierLabel` (the gate's `verifier` kind + key arg, truncated) and `evidenceSummary` (one-line digest of `evidence`/`deferredReason`, omitted while pending) — because generic widgets cannot read the nested `verifier`/`evidence` objects. The deterministic batch (re)compute + drift-fixer is `node "$PKG_ROOT/scripts/compute-rollups.js"` (idempotent; safe to run anytime to backfill or repair).

**Dashboard focus markers + status hygiene.** The dashboard Home ("Foco") shows the active plan(s) and the current phase, but aiDeck cannot join plan→initiative, so two derived markers are precomputed by `node "$PKG_ROOT/scripts/reconcile-focus.js"`: `planActive` (on the plan record + carried to phase rows + on each initiative — true iff the parent plan is `active`) and `current` (on the initiative that is the active plan's `currentPhase`). The same pass enforces a hygiene invariant — **a paused plan must not leave an `active` phase behind**: any `active` phase under a `paused` plan (in the plan's `phases[]` descriptor AND the matching initiative) is demoted to `paused`. Run it on every **plan-status** change and whenever the project-status view opens (it is idempotent). This is the focus counterpart to the rollups: same read-in-place constraint, same precompute discipline.

**The recompute aggregator (`refresh-state`).** The mutating transitions above (`done`, `reconcile`, `phase-done`, `switch`) do NOT call the two scripts separately — they run `node "$PKG_ROOT/scripts/refresh-state.js"`, the single idempotent chokepoint that funnels, in order, `compute-rollups` (rollups) → `reconcile-focus` (focus markers + the paused-plan hygiene invariant) → `emit-focus` (the flat `focus.json` digest the external statusline reads). `compute-rollups.js`/`reconcile-focus.js` remain the components above; `refresh-state.js` is how every state mutation invokes them in one pass. Routing the recompute through refresh-state is what keeps the `focus.json` digest from drifting between sessions — a raw edit that runs it leaves rollups, focus markers, AND the digest consistent, independent of any session hook.

## Verifier execution patterns (`verify_exit_gate` workflow) — moved to `verifier-exec.md`

The canonical executor (the `evidence` shape, the GATE-R2 met-invariant, and the per-kind workflows `shell`/`manual`/`query`/`test`, No-verifier, Per-task verifiers, and the G9 mutation-kill note) is the **single source** in `{{READ_TOOL}} {{ASSETS_PATH}}/verifier-exec.md`. `phase-done`, per-task `verifier:` fields, `archive`'s gate-resolution step, and `reconcile` all delegate there — read it before running any verifier. Do NOT inline the executor back into these callers (one definition, many callers).

---

# Cold-path transitions (rare — read on demand)

The flows above (`push`/`pop`, `done`, `reconcile`, `phase-done`) are the hot path run most sessions. The transitions below are infrequent (reopen / scope / archive / switch); they live below the fold so the hot path stays at the top of the file.

## `phase-reopen`

Reverse of `phase-done`. Used when a closed phase needs more work (regression, scope expansion).

1. Identify the target phase (by `phaseId` arg or by reading the parent plan's last-done phase).
2. Locate the initiative file (resolved per the active layout). Check both the live path (nested `projects/<project-id>/<plan-slug>/phases/f<N>-<slug>.md`, legacy `initiatives/<slug>.md`) and its archive dir (nested `…/phases/archive/`, legacy `initiatives/archive/`). Note whether it is archived (do NOT move yet).
3. Resolve the target phase descriptor in the parent plan. If neither the live/archive initiative file nor the descriptor exists, abort with the valid phase ids/slugs.
4. Confirm with user: "Reopen phase `<id>`? If it is descriptor-only, this materializes it; otherwise it sets initiative status back to active, clears `metAt` on all criteria, and resets all tasks to pending."
5. On accept:
   - If the matching initiative file is absent (descriptor-only), run `atomic-skills:project materialize <phase-id>` as an internal transition caller with the selected active phase id set containing the reopened target; do not propose `new initiative` for descriptor-only phases. `materialize` owns the businessIntent/decompose/write/validate flow; this command does not duplicate it or overwrite an existing initiative file.
   - If the matching initiative file exists, reuse it:
     - If the initiative file was archived: move it back to its live resolved path (nested `projects/<project-id>/<plan-slug>/phases/f<N>-<slug>.md`, legacy `initiatives/<slug>.md`).
     - Set initiative `status: active`.
     - Set every `exitGate[].status` and `phases[<id>].exitGate.criteria[].status` to `pending`; clear `metAt`.
     - Set all `tasks[].status = 'pending'`; clear `tasks[].closedAt`; refresh `tasks[].lastUpdated = <now>`.
6. Leave every other `done` or `archived` phase untouched; only the explicitly reopened target may move back to `active` or be materialized.
7. If the plan had advanced past this phase, leave `currentPhase` unchanged (user decides whether to re-route).
8. Save. Update PROJECT-STATUS.md.

## `detect-scope`

Wrap `scripts/detect-scope.js` to suggest a `scope.paths` value based on recent git activity.

1. Run `node "$PKG_ROOT/scripts/detect-scope.js" --json --branch=<active-branch> --limit=20` via {{BASH_TOOL}}.
2. Parse the JSON output. Present the top groupings to the user as a checklist.
3. On user accept: write the accepted globs into the active initiative's `scope.paths`. Save.
4. If the initiative already had `scope.paths`: merge (union) with the new suggestions; ask user before overwriting any existing entry.

## `archive [<slug>]`

Works on both plans and initiatives. If `<slug>` resolves to a plan (nested `projects/<project-id>/<slug>/plan.md`, legacy `.atomic-skills/plans/<slug>.md`), archive the plan **and propagate** to its child initiatives.

1. Identify target (arg or active initiative). Detect kind by resolved file location.
1a. **Lifecycle-order guard (HARD gate — before fork-resume, status flips, moves, or teardown offers):** call `classifyLifecycleOrder` from `scripts/lifecycle-order-guard.js` on the resolved target.
   - For a plan archive, pass `{ command: 'archive', targetKind: 'plan', target: <plan slice with slug/status/branch/references/integration proof> }`. If it returns `blocked`, print `reason` and `recommendedCommand`, then STOP before step 2. The usual predecessor is `finalize <slug>`, then merge, then `archive <slug>`.
   - For an internal phase archive produced by `phase-done`, pass `{ command: 'archive', targetKind: 'phase', caller: 'phase-done' }`; this is the named `phase-archive` exception. Do not use the plan archive path for `phases/archive/` moves.
   - For historical imports, route through the named `discover` / `historical-discover` exception instead of silently treating an active branch plan as integrated.
2. **Fork-link resume gate (a HARD gate — read the edge BEFORE any finalize)**: when the target is a plan, read its child→parent edge with `getSpawnedFrom(<target-plan-dir>)` (`src/links-sidecar.js`) **before** touching the plan's status or moving any file.
   - When `getSpawnedFrom` returns `null`, skip this gate silently → continue to step 3 — a non-forked plan archives exactly as it did before.
   - When the edge is present (`{ plan, phaseId, mode }`) the target is a fork child of plan `plan` at anchor phase `phaseId` (degrau 7.5 — the `spawnedFrom` edge written at fork time). This gate now **controls whether step 3 runs at all**: execute the **`fork-resume`** step below (it offers the resume — opt-in, printed, **NEVER applied automatically** — and applies it per mode/decision).
     - Before executing `fork-resume`, re-use the lifecycle-order guard result from step 1a. If the child lacks finalize/consolidate publication or merged integration proof, STOP here and print the guard's `recommendedCommand`; do not resume the parent and do not record `pendingWriteback`.
     - **Only on accept + a successful parent resume** (parallel `writebackOrDefer` → `{ ok: true }`, or pause writes + `refresh-state` all succeeded) → continue to step 3 (finalize the child).
     - **On refuse / no-TTY / writeback conflict / write failure** → `fork-resume` has recorded the durable `pendingWriteback` on the child; **STOP the `archive` command here** — do **not** run step 3/4, do **not** set `status: archived`, do **not** move any file. The child stays `active`/un-archived until recovery (step 4 of `fork-resume`). Announce the deferred resume + the recovery path. This stop is the transaction-order invariant made executable: a literal step-by-step executor must not fall through to step 3.
3. **Plan archival**:
   - Before changing the plan, validate every child initiative with `parentPlan === <slug>`. Each child must already be `done` or `archived`; every task must already have been closed individually by `done <task-id>` with its immutable `closedAt` and completion event; every gate must be `met` with passing evidence. If any child fails, STOP and route it through `done` and `phase-done`. Plan archive never closes child work or defers a child gate.
   - Set the plan's `status: archived`.
   - For every validated child initiative with `status: done`: set its `status: archived` and move the file to the resolved archive dir (nested `projects/<project-id>/<slug>/phases/archive/<YYYY-MM>-<phase-slug>.md`, legacy `initiatives/archive/<YYYY-MM>-<slug>.md`). Preserve children already archived. Never propagate `archived` onto an active, paused, or pending child.
   - **Nested:** the plan is archived in-place: the plan folder stays in place under `projects/<project-id>/` with `status: archived` (the `phases/archive/` subdir holds its closed phases) and zero git effect. The `status: archived` flip is logical-only: no worktree removal, no branch deletion, no integration. **Legacy flat:** move the plan file to `plans/archive/<YYYY-MM>-<slug>.md`.
4. **Initiative archival**:
   - **Plan-anchored hard gate:** a plan-anchored initiative requires every task to have already been closed individually by `done` (including `closedAt` and its completion event), initiative status already `done`, and all authoritative/mirrored gates already `met` with passing evidence. Require the matching plan descriptor to be terminal with the same gate status and evidence. On any mismatch or open item, STOP without mutation and route to `done <task-id>` or `phase-done`. Archive must never bulk-close a task, run/defer a plan gate, or synthesize phase completion.
   - **Standalone-only gate resolution:** a standalone initiative has no `phase-done`, so first require all tasks already closed through `done`. For each open `exitGates[]` entry, run its verifier per the **Verifier execution patterns** (or ask the user when `kind: manual`), then set `status: met` with passing evidence, or explicitly `deferred` with the user's reason when the standalone archival policy accepts the skip. Never use this standalone defer policy for a plan-anchored initiative.
   - Set the initiative's `status: archived`.
   - Move file to the resolved archive dir (nested `projects/<project-id>/<plan-slug>/phases/archive/<YYYY-MM>-<slug>.md`, legacy `initiatives/archive/<YYYY-MM>-<slug>.md`).
5. Update PROJECT-STATUS.md: remove archived rows from active tables; append to "Recently Archived" (keep last 10).
6. **Adjacent worktree teardown offer (`worktree-teardown`)** — operator-prompted, never automatic. Default is keep the worktree. This offer is separate from the logical archive flip above; archiving still has zero git effect even when teardown is skipped or blocked.
   - Use `scripts/worktree-teardown.js` as the invariant source. Resolve **both refs** via `resolveBaseRef({ routingConfig })` → `{ integrationRef, baseRef }` (it consumes the F1 `resolveIntegrationRef`). **`resolveBaseRef` returns `null`** when routing is unconfigured or neither `origin/<ref>` nor `<ref>` resolves — do NOT destructure `null`; in that case call `isTeardownSafe({ branch, prIdentity })` with `baseRef`/`integrationRef` left `undefined`, so the guard returns `blocked('indeterminate-base')` instead of throwing. Otherwise read the published **PR identity** from the plan's `references[]` — the `{ kind: url, path: <pr-url>, label: "PR #<number>" }` entry recorded by `finalize` Step 4 (`{{ASSETS_PATH}}/project-finalize.md`) — as `prIdentity`, then call `isTeardownSafe({ branch: 'plan/<slug>', baseRef, integrationRef, prIdentity })`. **Passing `integrationRef` + `prIdentity` is what closes the finalize→teardown handoff**: the producer (`finalize`) records the `pr-url`, and this consumer must read it — call it with `{ branch, baseRef }` alone and the guard returns `blocked('indeterminate-base')`/`blocked('pr-identity-missing')` and never reads the recorded identity, blocking teardown for every merged plan. **Do not change the `isTeardownSafe` contract** (`scripts/worktree-teardown.js`); this is call-site wiring only.
   - `outcome: 'nothing-to-remove'` — when the plan's branch is `null`/absent or no worktree was ever materialized, show no teardown prompt. The archive status flip remains zero-git and logical-only.
   - `outcome: 'safe'` — integration is proven. Offer to remove the worktree with `git worktree remove <path>` followed by `git worktree prune`, and optionally delete the branch with `git branch -d plan/<slug>` (lowercase `-d`; native git is the second guard).
   - `outcome: 'blocked'` — teardown is not proven-safe. Reasons surface the gap: `indeterminate-base` (no resolvable `{integrationRef, baseRef}`), `pr-identity-missing`/`pr-identity-ambiguous` (no recorded `pr-url`), `gh-unauthenticated`/`gh-lookup-failed`, `not-merged`, `base-ref-mismatch`, `head-ref-missing`, or `residue-beyond-head` (squash residue past the PR head). Do not remove anything; surface that the work is not proven integrated and block teardown. Safe failure over-blocks, never over-deletes — and `indeterminate-base`/`pr-identity-missing` **no longer fire for a MERGED plan whose `pr-url` is recorded** (the wired call now resolves `safe` via the live `gh pr view <prIdentity>`: `state == MERGED` + `baseRefName == integrationRef` + matching `headRefOid`).
7. Announce: "Archived `<slug>` (+<N> child initiatives if plan)".

### `fork-resume` (applies the offer from `archive` step 2)

Runs only when `archive` step 2 read a `spawnedFrom` edge `{ plan, phaseId, mode }` off the child being archived. It resumes the parent `plan` at its anchor phase `phaseId`, deterministically across both fork modes (`pause` / `parallel`) and all four decision paths (accept / refuse / no-TTY / failed-writeback).

**Transaction-order invariant:** the parent writeback **precedes** the child-archive finalize (`archive` steps 3–4). A declined, deferred, or failed writeback persists a durable `pendingWriteback` (`op: resumeParent`) on the **child's** sidecar and the child does **not** finalize until recovery — there is never a child archived while the parent is left in an inconsistent state.

**Resume mutation (both modes, identical target state):** set the parent plan `status: active`; set the anchor phase `phaseId` to `status: active` in the parent's `phases[]` descriptor **and** in its matching initiative file; set `currentPhase: <phaseId>` — the **named anchor** from the edge, never the by-status active phase. The dual-location phase-status edit (`phases[]` descriptor + the matching initiative file, resolved nested-first at `projects/<project-id>/<plan>/phases/f<N>-<slug>.md`) uses the **same mechanism as `phase-reopen` step 4 / `switch`'s cascade** — do not invent a separate edit path. Capture the parent plan.md content token (`contentToken`, `src/parallel-state.js`) at read time as `readToken` for the marker / CAS.

1. **Decide (opt-in):** with a TTY, prompt "Resume parent `<plan>` at anchor `<phaseId>`? [accept / refuse]". With **no TTY**, do NOT prompt — take the no-TTY path directly (record the durable marker, step 4). This is the **only** prompt in `fork-resume`; the accept/refuse decision it captures drives every mode branch below, so there is no second prompt site to guard.
2. **mode `parallel`** (parent lives on its own branch/worktree):
   - **Resolve the parent's canonical state file first (deterministic — `docs/design/plan-fork-parallel-state.md` §2):** (i) read the parent's `branch:` from the child's **stale** parent-plan copy — the `spawnedFrom` edge carries no branch, but `branch:` is stable across the fork; abort with a clear error if it is absent/`null` (parallel requires the parent on a named worktree). (ii) `git worktree list --porcelain` → `parseWorktrees` (`src/parallel-state.js`), then `resolveCanonicalParentDir({ parentSlug: <plan>, parentBranch, projectId, worktrees })`; the canonical file is `<dir>/plan.md` (nested-first, flat-fallback). A parent branch matching **no** worktree — or **more than one** — aborts without writing (never guess a target).
   - **accept** → call `writebackOrDefer({ canonicalFile, childPlanDir, readToken, mutate: <resume mutation>, pending: { target: 'parent-plan', parent: <plan>, op: 'resumeParent', args: { phaseId }, readToken, detectedAt: <now> } })`. On `{ ok: true }` the parent is resumed and any stale marker cleared → continue to `archive` steps 3–4 (finalize the child). On `{ ok: false, conflict, deferred }` the parent moved since the read — the call has **already** recorded the durable `pendingWriteback` (it never leaves recording to the caller); **abort the archive finalize**, surface the conflict + recovery, leave the child `active`/un-archived.
   - **refuse / no-TTY** → do NOT writeback. Record the durable `pendingWriteback` (`op: resumeParent`, same shape) via `recordPendingWriteback` so the resume is replayable, and do **not** finalize the child archive (child stays open with a pending-resume; parent untouched).
3. **mode `pause`** (parent in the same tree, paused by the fork — direct write, no CAS, so durability is the caller's responsibility, not `writebackOrDefer`'s):
   - **accept (marker-before-mutation ordering — mandatory):** the pause writes touch **two** files (parent plan.md + anchor initiative) non-atomically, so the recovery marker must exist *before* the first write, not after a failure. (i) `recordPendingWriteback(childPlanDir, { target: 'parent-plan', parent: <plan>, op: 'resumeParent', args: { phaseId }, readToken, detectedAt: <now> })` **first**. (ii) apply the resume mutation to the parent plan.md, then the anchor initiative file, then run `node "$PKG_ROOT/scripts/refresh-state.js"` (cascade focus markers + the `focus.json` digest). (iii) **only after all three writes succeed**, `clearPendingWriteback(childPlanDir)` and continue to `archive` steps 3–4. If any of (ii) throws (one file written, the other not), the marker from (i) **stands** — leave it, STOP the archive (do not finalize the child), surface the partial-resume + recovery. Recovery (step 4) replays the declarative `op`/`args` against the parent's then-current state, which converges a partial write idempotently.
   - **refuse / no-TTY** → `recordPendingWriteback` the durable `pendingWriteback` (`op: resumeParent`) and do **not** finalize the child (parent untouched).
4. **Recovery:** a later `fork-resume` (or `reconcile`) reads the child's `pendingWriteback`, replays the declarative `op`/`args` against the parent's then-current state, clears the marker on success, and only then may the child finalize. The marker is declarative (`op` + `args` re-applied to fresh state), never a byte patch.
   - **Crash window (parallel success-then-crash):** the writeback and the child-archive finalize span two worktrees and are not one atomic transaction. If the process dies after `writebackOrDefer` returned `{ ok: true }` (the marker is already cleared) but before the child finalized, the parent is resumed while the child is left `active` with **no** marker. This is recoverable, not corrupt: re-running `archive` on the still-`active` child re-reads the edge (step 2) and re-offers, and the **resume mutation is idempotent** on an already-active parent (the `status`/`currentPhase`/anchor-phase edits are no-ops on a parent already in that target state), so the second pass converges and finalizes the child without double-resuming. No state is lost — the only cost is a redundant re-offer.

## `switch <slug>`

Works at 2 levels: switching plans, OR switching initiatives within the active plan / among standalone.

**`switch <slug>` IS the resume path for a `paused` plan/initiative (C-1 / E1#5).** There is no separate `resume` verb: a paused target is accepted (step 2/3 allow `status: paused`) and set back to `active`. So a manually-paused plan (or one paused by a prior `switch` / `fork-plan --mode pause` / the single-focus pre-flight) is resumed by simply switching to it. The no-args summary and `status --list` mark paused plans so the operator knows what to switch back to.

1. Detect kind (resolve nested-first, then legacy flat): is there a plan at `projects/<project-id>/<slug>/plan.md` (legacy `.atomic-skills/plans/<slug>.md`)? OR a phase/standalone initiative at `projects/<project-id>/<plan-slug>/phases/f<N>-<slug>.md` (legacy `.atomic-skills/initiatives/<slug>.md`)? OR a phase descriptor id/slug in the currently active plan whose initiative file is absent (descriptor-only)?
2. **Plan switch**:
   - Find target plan; abort if `status` not in {`active`, `paused`}.
   - Apply **Plan dependency block guidance (`dependsOnPlans[]`)** before setting the target active. If the target is blocked, print the prerequisite plan(s), their statuses, and the resume path; leave the current active plan unchanged.
   - Set any other active plan to `status: paused` — **and cascade: pause its `active` phase** (in the plan's `phases[]` descriptor AND the matching initiative file). A paused plan must never leave an `active` phase behind.
   - Set target plan to `status: active`.
   - Resolve the target plan's `currentPhase` (or its `active` phase descriptor when `currentPhase` is absent). If the matching initiative file exists, reuse it: set that initiative to `status: active`, refresh `lastUpdated`, and do not overwrite it. If the initiative file is absent (descriptor-only), run `atomic-skills:project materialize <phase-id>` as an internal transition caller with the selected active phase id set containing the target active/current phase, after the old active plan/initiative has been paused/demoted and before reporting the switch complete; do not propose `new initiative` for descriptor-only phases.
   - Update PROJECT-STATUS.md, then run `node "$PKG_ROOT/scripts/refresh-state.js"` (cascades the pause + refreshes the dashboard `planActive`/`current` focus markers AND the `focus.json` digest in one pass).
3. **Initiative switch**:
   - Find target initiative or target phase descriptor; abort if an existing initiative is not active/paused.
   - If target has `parentPlan` ≠ currently-active plan's slug: warn and offer to also switch the plan.
   - Set any other active initiative to `status: paused`.
   - If the matching initiative file exists, reuse it: set target initiative to `status: active`, refresh `lastUpdated`, and do not overwrite it.
   - If the matching initiative file is absent and the active plan descriptor has the target phase (descriptor-only), set the target phase descriptor to `status: active`, set `currentPhase` to that phase id, then run `atomic-skills:project materialize <phase-id>` as an internal transition caller with the selected active phase id set containing the target phase. Do this after any old active initiative is paused and before reporting the switch complete; do not propose `new initiative` for descriptor-only phases.
   - Update PROJECT-STATUS.md, then run `node "$PKG_ROOT/scripts/refresh-state.js"` (the active-initiative change flips the `current` focus marker, so refresh the markers + the `focus.json` digest in the same pass).
4. Announce.
