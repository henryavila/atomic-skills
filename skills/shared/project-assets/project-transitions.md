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
3. Recompute the initiative's dashboard rollups (`tasksDone`/`tasksTotal`/`gatesMet`/`gatesTotal` + per-gate `verifierLabel`/`evidenceSummary` — see project.md → Dashboard rollups; or `node scripts/compute-rollups.js`), then save the initiative file.
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
4. After applying dispositions, recompute the initiative's dashboard rollups (or `node scripts/compute-rollups.js`) and save. If closing the last open task of a phase initiative, the `done` flow's auto-transition fires the `phase-done` offer at the right time — that loop-close is the whole point of making this moment reliably reachable.

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
     d. Recompute the initiative's dashboard rollups (`tasksDone`/`tasksTotal`/`gatesMet`/`gatesTotal`; now all tasks done + gates met) + per-gate `verifierLabel`/`evidenceSummary`, then save the initiative file.
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

## Verifier execution patterns (`verify_exit_gate` workflow)

Applies to **each** `ExitCriterion` with `status === 'pending'` (or any criterion the user asks to re-verify). Used by `phase-done`, by per-task `verifier:` fields, by `archive`'s gate-resolution step, and by ad-hoc verification from the user.

The output of every successful (or attempted) verification is stamped into the criterion's optional `evidence` block. The shape is:

```yaml
evidence:
  verifierKind: shell | query | test | manual
  verifiedAt: <ISO8601>
  passed: true | false
  exitCode: <integer>          # shell / test — observed process exit code
  testsCollected: <integer>    # test only — number of tests the runner actually ran
  rowCount: <integer>          # query only
  outputSummary: "<≤500 chars excerpt or user note>"
  mutation:                    # test only, OPTIONAL (G9 mutation-kill)
    target: "<file:line>"
    change: "<behavioral mutation applied at target>"
    killedBy: ["<test(s) that went RED on the mutation>"]
    killTranscript: "<≤500-char inject → RED → revert → GREEN excerpt>"
```

`evidence` is REQUIRED to set `status: met` when a deterministic verifier (`shell`/`test`/`query`) is present. This is not advisory: **`scripts/validate-state.js` enforces the met-invariant (GATE-R2)** and HARD-FAILS any `met` criterion (or `done` task) whose `shell`/`test`/`query` verifier lacks `evidence.passed === true` — plus, for `kind: test`, `evidence.testsCollected > 0` (a pattern matching 0 tests is **never** `met`), and for `kind: query`, a numeric `evidence.rowCount`. So a verifier result must come from a REAL run, not an assertion. Without passing evidence, the criterion stays `pending` (manual override → `deferred` with `deferredReason`). `kind: manual` and verifier-absent criteria are not gated by GATE-R2 (the manual-acceptance gate and user-overrides govern those).

### `kind: shell`

1. Present the criterion `id` + `description` + the full `command` to the user.
2. Ask: "Run this verifier? (y/N)" — intrusive-actions rule applies.
3. On `y`: execute with {{BASH_TOOL}}, capture exit code AND a tail of stdout (≤500 chars). Compare exit code with `expectExitCode` (default `0`).
4. Write `evidence`:
   - `verifierKind: shell`, `verifiedAt: <now>`
   - `exitCode: <observed>`, `passed: <bool>`
   - `outputSummary: <stdout tail>`
5. If `passed === true`: set `status: met`, `metAt: <now>`.
6. If `passed === false`: ask "Mark `deferred` with a reason, retry, or leave pending?".
   - On `deferred`: keep the `evidence` block (so the failed run is recorded), set `status: deferred`, capture `deferredReason`.
   - On retry: loop back to step 3.
   - On leave-pending: keep `evidence` (records the failed attempt) but leave `status: pending`.

### `kind: manual`

1. Present the criterion `id` + `description` + the verifier's `description`.
2. Ask: "Confirm this criterion is met? (y/n/defer)".
3. Write `evidence`:
   - `verifierKind: manual`, `verifiedAt: <now>`
   - `passed: <true if y else false>`
   - `outputSummary: <user's note, or empty>`
4. On `y`: set `status: met`, `metAt: <now>`.
5. On `n`: ask "Mark `deferred` (with reason) or leave `pending`?". Apply.
6. On `defer`: capture `deferredReason`, set `status: deferred`.

### `kind: query` (DEFERRED-BY-DESIGN — no DB connection)

This repository assumes **no live DB connection**, so `kind: query` is deferred by design — NOT a silent stub. A user-pasted row count must **never** flip a criterion to `met`: that is exactly the fabricated-pass hole the gate system exists to kill (GATE-R2 hard-fails a `met` query criterion that lacks a numeric `evidence.rowCount` from a real run).

1. Present the criterion `id` + `description` + `sql` + `expectRowCount` (if any).
2. **Escape hatch (only path to `met`):** if — and only if — the caller supplies a real connection command, execute it with {{BASH_TOOL}}, capture the actual `rowCount`, and write `evidence` (`verifierKind: query`, `verifiedAt: <now>`, `rowCount: <observed integer>`, `passed: <rowCount === expectRowCount>`, `outputSummary`). Set `status: met` only when `passed === true`.
3. **Default (no connection command):** set `status: deferred`, write `deferredReason` (e.g. `"query verifiers run out-of-band; no DB connection in this repo"`), and write `evidence` with `passed: false` and NO fabricated `rowCount`. Do not ask the user to type a row count — a self-reported number is not evidence.

### `kind: test`

Mirrors `kind: shell` — the runner is executed for real and its result, not a self-report, is the evidence.

1. Present the criterion `id` + `description` + `runner` + `pattern`.
2. Ask: "Run the test pattern (`<runner> <pattern>`)? (y/N)" — intrusive-actions rule applies.
3. On `y`: execute `<runner> <pattern>` with {{BASH_TOOL}}, capture the exit code AND a tail of stdout (≤500 chars). **Parse the number of tests the runner actually collected/ran** from its output (e.g. node `# tests N` / `ℹ tests N`; jest `Tests: … total`; pytest `collected N items`). A run is `passed` only when the **exit code is 0 AND `testsCollected > 0`**.
4. Write `evidence`:
   - `verifierKind: test`, `verifiedAt: <now>`
   - `exitCode: <observed>`, `testsCollected: <parsed integer>`, `passed: <bool>`
   - `outputSummary: <stdout tail>`
5. If `passed === true`: set `status: met`, `metAt: <now>`.
6. If `passed === false` — **including the paranoid false-greens: non-zero exit, 0 tests collected, runner-not-found / count unparseable** (treat all three as `passed: false`, never `met`) — ask "Mark `deferred` with a reason, retry, or leave pending?".
   - On `deferred`: keep the `evidence` block (records the failed/empty run), set `status: deferred`, capture `deferredReason`.
   - On retry: loop back to step 3.
   - On leave-pending: keep `evidence`, leave `status: pending`.

> **G9 mutation-kill (optional, behavioral-test gate):** for a `kind: test` criterion guarding a NAMED acceptance criterion, after a GREEN run you MAY inject one adversarially-chosen behavioral mutation at a recorded `file:line`, re-run, and confirm a test goes RED (then revert → GREEN). Record it in `evidence.mutation` (`target`/`change`/`killedBy`/`killTranscript`). A surviving behavioral mutant = tautological/mock-only test = HARD FAIL — do not mark `met`.

### No verifier present

Treat as `kind: manual` with an empty `description`. Ask the user for explicit ack before marking `met`.

### Per-task verifiers (`tasks[].verifier`)

When closing a task (`done <task-id>`) whose entry has a non-empty `verifier:`, apply the same per-kind workflow above **before** marking the task done. Write the result into the task's own `evidence:` block (schemaVersion 0.2, `tasks[].evidence`, the exact same shape as criterion evidence) and stamp `closedAt`. Do NOT record it as a free-text note in `description` — a prose string is unparseable, so it can never be machine-enforced. GATE-R2 covers `done` tasks identically: a task with a `shell`/`test`/`query` verifier that is `done` without passing `evidence` HARD-FAILS `validate-state`.

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
2. **Plan archival**:
   - Set the plan's `status: archived`.
   - For every initiative with `parentPlan === <slug>` and `status` in {`active`, `paused`, `pending`}: set its `status: archived`, move file to the resolved archive dir (nested `projects/<project-id>/<slug>/phases/archive/<YYYY-MM>-<phase-slug>.md`, legacy `initiatives/archive/<YYYY-MM>-<slug>.md`).
   - **Nested:** the plan is archived in-place: the plan folder stays in place under `projects/<project-id>/` with `status: archived` (the `phases/archive/` subdir holds its closed phases) and zero git effect. The `status: archived` flip is logical-only: no worktree removal, no branch deletion, no integration. **Legacy flat:** move the plan file to `plans/archive/<YYYY-MM>-<slug>.md`.
3. **Initiative archival**:
   - **Resolve open exit gates first** (applies to BOTH standalone and plan-anchored initiatives — standalone has no `phase-done`, so this is the only place its gates get closed). For each `exitGates[]` entry whose `status` is not already `met` or `deferred`: run its `verifier` per the **Verifier execution patterns** (or ask the user when `kind: manual`), then set `status: met` (`metAt: <now>`, plus `evidence` when a verifier ran) on pass, or `status: deferred` (`deferredReason`) when the user skips it. **Never set `done`** — that is a Task status; gate status is `pending`/`met`/`deferred` only (see the *Gate status invariant* in the router). If the user wants to archive without verifying, mark the remaining gates `deferred` with a reason — do not leave them `pending` and do not coerce them to `done`.
   - If the initiative has `parentPlan` and the matching plan phase has `status: done`, verify that the initiative `status` is `done` (not `active`/`pending`). If not, apply the propagation steps from `phase-done` step 8a-d first (set all tasks `done`, exitGates `met`, initiative `status: done`), then continue.
   - Set the initiative's `status: archived`.
   - Move file to the resolved archive dir (nested `projects/<project-id>/<plan-slug>/phases/archive/<YYYY-MM>-<slug>.md`, legacy `initiatives/archive/<YYYY-MM>-<slug>.md`).
4. Update PROJECT-STATUS.md: remove archived rows from active tables; append to "Recently Archived" (keep last 10).
5. **Adjacent worktree teardown offer (`worktree-teardown`)** — operator-prompted, never automatic. Default is keep the worktree. This offer is separate from the logical archive flip above; archiving still has zero git effect even when teardown is skipped or blocked.
   - Use `scripts/worktree-teardown.js` as the invariant source. Resolve **both refs** via `resolveBaseRef({ routingConfig })` → `{ integrationRef, baseRef }` (it consumes the F1 `resolveIntegrationRef`). **`resolveBaseRef` returns `null`** when routing is unconfigured or neither `origin/<ref>` nor `<ref>` resolves — do NOT destructure `null`; in that case call `isTeardownSafe({ branch, prIdentity })` with `baseRef`/`integrationRef` left `undefined`, so the guard returns `blocked('indeterminate-base')` instead of throwing. Otherwise read the published **PR identity** from the plan's `references[]` — the `{ kind: url, path: <pr-url>, label: "PR #<number>" }` entry recorded by `finalize` Step 4 (`{{ASSETS_PATH}}/project-finalize.md`) — as `prIdentity`, then call `isTeardownSafe({ branch: 'plan/<slug>', baseRef, integrationRef, prIdentity })`. **Passing `integrationRef` + `prIdentity` is what closes the finalize→teardown handoff**: the producer (`finalize`) records the `pr-url`, and this consumer must read it — call it with `{ branch, baseRef }` alone and the guard returns `blocked('indeterminate-base')`/`blocked('pr-identity-missing')` and never reads the recorded identity, blocking teardown for every merged plan. **Do not change the `isTeardownSafe` contract** (`scripts/worktree-teardown.js`); this is call-site wiring only.
   - `outcome: 'nothing-to-remove'` — when the plan's branch is `null`/absent or no worktree was ever materialized, show no teardown prompt. The archive status flip remains zero-git and logical-only.
   - `outcome: 'safe'` — integration is proven. Offer to remove the worktree with `git worktree remove <path>` followed by `git worktree prune`, and optionally delete the branch with `git branch -d plan/<slug>` (lowercase `-d`; native git is the second guard).
   - `outcome: 'blocked'` — teardown is not proven-safe. Reasons surface the gap: `indeterminate-base` (no resolvable `{integrationRef, baseRef}`), `pr-identity-missing`/`pr-identity-ambiguous` (no recorded `pr-url`), `gh-unauthenticated`/`gh-lookup-failed`, `not-merged`, `base-ref-mismatch`, `head-ref-missing`, or `residue-beyond-head` (squash residue past the PR head). Do not remove anything; surface that the work is not proven integrated and block teardown. Safe failure over-blocks, never over-deletes — and `indeterminate-base`/`pr-identity-missing` **no longer fire for a MERGED plan whose `pr-url` is recorded** (the wired call now resolves `safe` via the live `gh pr view <prIdentity>`: `state == MERGED` + `baseRefName == integrationRef` + matching `headRefOid`).
6. Announce: "Archived `<slug>` (+<N> child initiatives if plan)".

## `switch <slug>`

Works at 2 levels: switching plans, OR switching initiatives within the active plan / among standalone.

1. Detect kind (resolve nested-first, then legacy flat): is there a plan at `projects/<project-id>/<slug>/plan.md` (legacy `.atomic-skills/plans/<slug>.md`)? OR a phase/standalone initiative at `projects/<project-id>/<plan-slug>/phases/f<N>-<slug>.md` (legacy `.atomic-skills/initiatives/<slug>.md`)?
2. **Plan switch**:
   - Find target plan; abort if `status` not in {`active`, `paused`}.
   - Set any other active plan to `status: paused` — **and cascade: pause its `active` phase** (in the plan's `phases[]` descriptor AND the matching initiative file). A paused plan must never leave an `active` phase behind.
   - Set target plan to `status: active`.
   - Update PROJECT-STATUS.md, then run `node scripts/reconcile-focus.js` (cascades the pause + refreshes the dashboard `planActive`/`current` focus markers).
3. **Initiative switch**:
   - Find target initiative; abort if not active/paused.
   - If target has `parentPlan` ≠ currently-active plan's slug: warn and offer to also switch the plan.
   - Set any other active initiative to `status: paused`.
   - Set target initiative to `status: active`.
   - Update PROJECT-STATUS.md.
4. Announce.
