Single entry-point for tracking Plan / Initiative / Task state in `.atomic-skills/`. Git-style subcommand grammar with **lazy detail**: this router holds only the dispatch table, the no-args summary, and the always-resident invariants. Each subcommand's full procedure lives in a detail file under `{{ASSETS_PATH}}/` and is read on demand.

This skill implements a 3-level model that matches `@henryavila/aideck`:

- **Plan** — multi-phase project with narrative, principles, glossary, phases, exit gates (`.atomic-skills/plans/<slug>.md`)
- **Initiative** — one phase of a plan, OR a standalone unit of work (`.atomic-skills/initiatives/<slug>.md`)
- **Task** — atomic action inside an initiative (frontmatter `tasks[]`)

Standalone initiatives (no `parentPlan`) coexist with plan-anchored initiatives. Plans are optional; a project may run with only initiatives. State files conform to JSON Schemas in `meta/schemas/` (`plan.schema.json`, `initiative.schema.json`, `common.schema.json`). Validate via `npm run validate-state`. Canonical `schemaVersion` is `'0.1'`.

## Grammar

```
/atomic-skills:project                              → compact summary (no-args, cheap; no browser)
/atomic-skills:project status [--browser|--terminal|--list|--plan|--phase|--stack|--archived|--report]
/atomic-skills:project verify                → reconcile state ⇄ code (NEW)
/atomic-skills:project new                          → fixed menu (plan | initiative) + discoverability hint
/atomic-skills:project new plan <slug>              → bootstrap a multi-phase Plan
/atomic-skills:project new initiative <slug>        → initiative (standalone or anchored to a phase)
/atomic-skills:project done|push|pop|park|emerge|promote|switch|phase-done|phase-reopen|archive
/atomic-skills:project why|re-ratify|scope-creep|review-due|detect-scope
/atomic-skills:project adopt <file.md>|discover|migrate <slug>|re-bootstrap <slug>|split-phase <id>
# valid but NOT listed in the menu (use by intent via the emergence ladder, or typed by power-users):
/atomic-skills:project new-task|new-phase
```

## Dispatch table — load the detail file BEFORE acting

The procedures are NOT in this router. For each subcommand: **PARSE the arg, then `{{READ_TOOL}}` the detail file, then execute its steps.** Do not act from the table alone — the table only tells you which file holds the procedure.

| Subcommand(s) | Detail file (read first) |
|---|---|
| `status`, `status --browser`, `--terminal`, `--list`, `--plan`, `--phase`, `--stack`, `--archived`, `--report`, disambiguation | `{{READ_TOOL}} {{ASSETS_PATH}}/project-view.md` |
| `verify` | `{{READ_TOOL}} {{ASSETS_PATH}}/project-verify.md` |
| first-time setup (`.atomic-skills/` absent) | `{{READ_TOOL}} {{ASSETS_PATH}}/project-setup.md` |
| `new plan <slug>`, `adopt <file.md>` | `{{READ_TOOL}} {{ASSETS_PATH}}/project-create-plan.md` |
| `new initiative <slug>` | `{{READ_TOOL}} {{ASSETS_PATH}}/project-create-initiative.md` |
| `discover` | `{{READ_TOOL}} {{ASSETS_PATH}}/project-discover.md` |
| `park`, `emerge`, `emerge --target`, `promote`, `new-task`, `new-phase`, `split-phase` | `{{READ_TOOL}} {{ASSETS_PATH}}/project-emergence.md` |
| `done`, `phase-done`, `phase-reopen`, `switch`, `archive`, `detect-scope`, `push`, `pop`, verifier patterns | `{{READ_TOOL}} {{ASSETS_PATH}}/project-transitions.md` |
| `migrate <slug>`, `re-bootstrap <slug>` | `{{READ_TOOL}} {{ASSETS_PATH}}/project-migrate.md` |
| `scope-creep`, `why`, `re-ratify`, `review-due`, CODEX REVIEW line | `{{READ_TOOL}} {{ASSETS_PATH}}/project-drift.md` |

Lazy-load is NOT optional. For any subcommand above: **STOP. `{{READ_TOOL}}` the listed file before you act.** Acting from memory of a similar command is the failure mode this architecture exists to prevent.

## Initial detection (run on every invocation)

Run with {{BASH_TOOL}}:
- `test -d .atomic-skills/` — if absent, enter **setup mode** (read `{{ASSETS_PATH}}/project-setup.md`).
- If present, read `.atomic-skills/PROJECT-STATUS.md`:
  - Determine the **active Plan** (if any) and its `currentPhase`.
  - Determine the **active Initiative** (phase initiative of the active plan, OR a standalone initiative).
  - If the current branch matches no active initiative → run the disambiguation flow (in `project-view.md`).

## No-args — compact summary (cheap; does NOT open the browser)

Plain `/atomic-skills:project` with no subcommand prints a 5-line summary and stops. It does NOT spawn aiDeck or open a browser (that is `status --browser`). Produce these lines from `.atomic-skills/` directly:

```
PLAN     <plan-slug> · phase <id> — <title>            (or "none — standalone only")
INIT     <init-slug> · <N/M tasks done>, <B blocked>   (active initiative)
NEXT     <nextAction>
CODEX    <CODEX REVIEW line — see project-drift.md>
          → /atomic-skills:project status        (dashboard / full view)
```

If `.atomic-skills/` is absent: print one line — `No .atomic-skills/ yet — run \`/atomic-skills:project\` and I'll set it up.` — then enter setup mode.

---

# ALWAYS-RESIDENT INVARIANTS (never lazy — they gate or trigger every subcommand)

## Iron Law

NO IMPLEMENTATION WITHOUT ANCHORED INITIATIVE.

Every code-modifying session must be anchored to an active initiative in `.atomic-skills/initiatives/<slug>.md` (standalone or under an active plan), or the user must explicitly declare "ad-hoc".

## Pre-mutation gates (apply before ANY mutating subcommand)

Run these in order on the active initiative BEFORE executing a mutating command (`push`, `pop`, `park`, `emerge`, `promote`, `done`, `phase-done`, `phase-reopen`, `archive`, `switch`, `detect-scope`, `re-ratify`, `new-task`, `new-phase`). Skip them for read-only commands (`status` views, `why`, `scope-creep`).

1. **Migration check.** Parse frontmatter. If `schemaVersion` is absent → STOP. Abort with: "Mutation cancelled — file is legacy. Run `atomic-skills:project migrate <slug>` first, then retry." (Full detail: `project-transitions.md`.)
2. **Reconciliation gate.** Collect `tasks[]` where `status: active` AND `lastUpdated` older than 24h (configurable `reconciliationThresholdHours`, `0` disables). If non-empty, present each (max 4 oldest) via {{ASK_USER_QUESTION_TOOL}} with options `Still active` / `Done` / `Blocked` / `Skip`, apply answers, THEN proceed. Skipped when the user is already running `done` on the stale task. (Full detail: `project-transitions.md`.)

## Gate-status invariant

Exit-gate `status` is **`pending` / `met` / `deferred` ONLY**. It is NOT a Task status — never write `done`, `active`, or `blocked` on a gate. A completed gate is `met` (with `metAt`); a skipped gate is `deferred` (with `deferredReason`). aiDeck validates this enum with a `.strict()` schema and rejects the **entire** project state on the first violation, so one stray `done` on a gate makes the whole project card render `⊘ <project> — failed to load`. This is the single most common cause of that card.

## Ratify gate (every emergent item)

Emergent work (`park`/`emerge`/`promote`/`new-task`/`new-phase`/`split-phase`) NEVER lands on disk without a human-ratified `context` block (`solves`, `trigger`, `assumesStillValid`). The agent prints a `Proposed mutation:` block with a drafted context and HALTs. The user must reply `ratify` (apply verbatim), paste an edited context block, or `cancel`. **A generic "ok" / "yes" / "do it" is NOT ratify** — treat it as a request to be more specific and re-prompt. (Full format + per-rung steps: `project-emergence.md`.)

## Emergence ladder — magnitude → action (RESIDENT so the agent recognizes ambient triggers)

This table is resident because the intent surfaces *outside* a command — in conversation ("while doing this I realized…"). If it were lazy, the skill would never notice the trigger. When the user says anything like *"we also need to X"*, *"this depends on something unplanned"*, *"X needs its own phase"*, *"X is bigger than we thought"* — DO NOT edit anything. Classify by magnitude, draft a `context`, print a `Proposed mutation:` block, and wait for ratify.

| Magnitude | Surface | Command |
|---|---|---|
| **1.** Note for later, no decision | "we should think about Z eventually" | `park "<title>"` |
| **2.** Real follow-up worth promoting | "Z deserves its own initiative someday" | `emerge "<title>"` |
| **3.** Promote a parked/emerged item to a task | "let's actually do that parked thing" | `promote <title-or-idx>` |
| **4.** New task in CURRENT phase | "T-002 needs T-008 to run first" | `new-task "<title>" [--blocked-by T-002] [--tags ...]` |
| **5.** New task in DIFFERENT phase | "F2 needs an extra task before it can finish" | `new-task --target F2 "<title>"` |
| **6.** New phase inserted into the plan | "Need a validation phase F0.5 between F0 and F1" | `new-phase <id> "<title>" --after <other-id> [--parallel-with ...]` |
| **7.** Phase grew too big — split | "F2 is now 18 tasks, split into F2a + F2b" | `split-phase <id>` |
| **8.** Strategic shift — half the plan is wrong | "rethink everything, this is a different project" | `adopt <new-source.md>` with `supersedes` link |

The ladder doubles in cost per step. Pick the lowest rung that fits; promote up only when explicitly justified. **Never default an "add a section to the plan" request to a *phase*** — a principle / glossary / reference edit is a body edit, not the heavy `new-phase` ritual.

## `new` menu (fixed, in order of belonging)

When the user runs `/atomic-skills:project new` (no entity), print exactly:

```
What do you want to create?
  1. plan        — new multi-phase project (narrative + phases + exit gates)
  2. initiative  — unit of work (standalone, or the initiative for one phase)

Phase or task? Just describe what came up — I classify it (emergence ladder)
and confirm with you at the ratify gate before writing anything.
```

`new` exposes only the two **file** entities. Phase/task are intent-driven (ladder) — `new-task` / `new-phase` still work if typed, but are not menu items.

## Schema quick-reference (authoritative files: `meta/schemas/`)

**Plan** (`plans/<slug>.md` frontmatter) — required: `schemaVersion: '0.1'`, `slug`, `title`, `version`, `status`, `started`, `lastUpdated`, `currentPhase` (string|null), `parallelismAllowed` (bool), `phases[]`. Optional: `branch`, `principles[]`, `glossary[]`, `tracks[]`, `interPhaseGates[]`, `supersedes`, `references[]`, `whatStaysValid[]`. Body = `narrative`.
- `PhaseDescriptor`: `id`, `slug`, `title`, `goal`, `dependsOn[]`, `subPhaseCount`, `exitGate {summary, criteria[]}`, `status`. Optional: `parallelWith[]`, `track`, `audience`, `externalImports[]`, `exitGateType`.
- `ExitCriterion`: `id`, `description`, `status` (`pending`/`met`/`deferred`). Optional: `verifier`, `metAt`, `deferredReason`, `evidence`.
- `ExitCriterionVerifier` (oneOf): `{kind: shell, command, expectExitCode?}` · `{kind: query, sql, expectRowCount?}` · `{kind: test, runner, pattern}` · `{kind: manual, description}`.

**Initiative** (`initiatives/<slug>.md` frontmatter) — required: `schemaVersion: '0.1'`, `slug`, `title`, `goal`, `status`, `branch` (string|null), `started`, `lastUpdated`, `nextAction` (string|null), `exitGates[]`, `stack[]`, `tasks[]`, `parked[]`, `emerged[]`. Optional: `parentPlan`, `phaseId` (both-or-neither), `audience`, `scope {paths[]}`, `externalImports[]`, `references[]`, `crossTaskRefs[]`. Body = `body`.
- `Task`: `id`, `title`, `status` (`pending`/`active`/`done`/`blocked`), `lastUpdated`. Optional: `description`, `closedAt`, `blockedBy[]`, `outputs[]`, `tags[]`, `resourceCounts`, `scopeBoundary[]`, `acceptance[]` (max 5), `verifier`, `provenance`, `context`.
- `StackFrame`: `id` (int ≥ 1), `title`, `type` (`task`/`research`/`validation`/`discussion`), `openedAt`.
- `CrossTaskRef`: `fromTaskId`, `toInitiativeSlug`, `toTaskId`, `relation` (`depends_on`/`extends`/`unblocks`/`references`). Optional: `note`.

Provenance + context (co-located on every emergent item; schema makes them inseparable):
- `provenance: { surfacedAt, surfacedDuring, surfacedBy, originalPhaseId? }` — `common.schema.json#/$defs/provenance`.
- `context: { solves, trigger, assumesStillValid?, ratifiedAt, ratifiedBy, lastReviewedAt }` — `common.schema.json#/$defs/context`.

You (LLM) can parse frontmatter YAML directly. For edge cases (nested quotes, multi-line, complex lists), invoke the `yaml` npm package via `node -e "import('yaml').then(...)"`. Bump `lastUpdated:` to now (`date -u +%Y-%m-%dT%H:%M:%SZ`) on every mutation.

## Code-quality gates (state files this skill writes)

Bound by `docs/kb/code-quality-gates.md`:
- **G1 read-before-claim** — when a Task description references existing code, paste the relevant source lines into `description`. No inferring from filenames.
- **G2 soft-language ban** — `nextAction`, task `description`, exit-criterion `description` MUST NOT contain `should`, `probably`, `may`, `typically`, `I think`. Convert to a verified statement or an `unverified: <why>` marker.
- **G6 reference-or-strike** — every exit-criterion claim carries a `verifier:` or an `unverified:` marker.

## Red Flags

If any of these thoughts appeared: STOP and validate.

- "I'll quickly edit this file without opening the initiative"
- "The current initiative probably matches, I don't need to check the branch"
- "Stack depth 7 is fine, it's still the same initiative"
- "This task is small, it doesn't need a task ID"
- "I'll act on this subcommand without reading its detail file"
- "A generic 'yes' counts as ratify"
- "The initiative is legacy snake_case but the change is small — I'll edit without migrating"
- "Phase has 3 tasks left but the exit gate is met, I'll just mark phase done"
- "I'll mark a gate `done`" (gates are `pending`/`met`/`deferred` only)

## Rationalization

| Temptation | Reality |
|------------|---------|
| "I remember how `done` works, I don't need to read project-transitions.md" | The detail files carry edge cases (auto-transition, verifiers, propagation) the router omits. Read first. |
| "Manual YAML parsing is fine, I don't need a parser library" | Manual parsing breaks on edge cases; use the `yaml` npm package for robustness. |
| "I don't know if this change is lateral or a new initiative, I'll guess" | Use the disambiguation flow; 5 questions resolve it. |
| "Exit gate is `manual` so just mark all `met` and move on" | The user must ack manually — that's the whole point of `manual` kind. |
| "Phase advance doesn't need exit gates verified" | It does. `phase-done` exists to make this explicit; never set a phase `done` without iterating the criteria. |
| "I can skip the aiDeck launch, the terminal view is enough" | For no-args and `--terminal`, yes. The dashboard (`status --browser`) shows richer context (Mermaid graphs, exit-gate status, real-time SSE). |
