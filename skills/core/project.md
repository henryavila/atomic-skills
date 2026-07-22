Single entry-point for Plan / Initiative / Task state in `.atomic-skills/`, with
Git-style subcommands and **lazy detail**. This router keeps dispatch, the no-args
summary, and always-resident invariants; full procedures live under
`{{ASSETS_PATH}}/` and are read on demand.

This skill implements a 3-level model that matches `@henryavila/aideck`. State lives under **`.atomic-skills/projects/<project-id>/`** — the **Project** is a real top level whose folder name IS the `<project-id>` (enumerate `projects/*/` to list them; a folder counts as a project only once it holds ≥1 `<plan-slug>/plan.md`):

- **Plan** — multi-phase project with narrative, principles, glossary, phases, exit gates (`.atomic-skills/projects/<project-id>/<plan-slug>/plan.md`)
- **Initiative** — one phase of a plan, materialized at `.atomic-skills/projects/<project-id>/<plan-slug>/phases/f<N>-<slug>.md`. A **standalone** unit of work is a *degenerate 1-phase plan* (same nested shape — its lone phase carries the work), NOT a separate top-level file.
- **Task** — atomic action inside a phase initiative (frontmatter `tasks[]`)

Per project, `.atomic-skills/projects/<project-id>/PROJECT-STATUS.md` is the index. **Legacy / coexistence:** flat `.atomic-skills/plans/<slug>.md` + `.atomic-skills/initiatives/<slug>.md` + top-level status may still exist; readers resolve nested first, then flat, and `atomic-skills:project migrate` cuts over. Schemas live in `meta/schemas/`; validate with `validate-state.js`. `schemaVersion` policy: accept `'0.1'`/`'0.2'`; writers emit `'0.1'` unless an explicit upgrade stamps `'0.2'`.

## Grammar

```
/atomic-skills:project                              → compact summary (no-args, cheap; no browser)
/atomic-skills:project status [--browser|--terminal|--list|--plan|--phase|--stack|--archived|--report]
/atomic-skills:project help [--html]         → GPS de terminal: onde estou + próximo passo (alias: `next`; `--html` abre o guia visual)
/atomic-skills:project verify [--fix]        → state ⇄ code check (READ-ONLY unless `--fix`; normalization gate only)
/atomic-skills:project reconcile             → dispose detection-drift candidates (signal→ask→verifier/ack; done stays closure authority)
/atomic-skills:project review [<slug>] [--with-code] [--mode=local|both]  → mutation-gated audit (delegated reviews; never closes/advances)
/atomic-skills:project new                          → fixed menu (plan | initiative) + discoverability hint
/atomic-skills:project new plan <slug>              → bootstrap a multi-phase Plan
/atomic-skills:project new initiative <slug>        → initiative (standalone or anchored to a phase)
/atomic-skills:project idea                         → capture an idea into the inbox (fork: Só salvar / Analisar)
/atomic-skills:project idea list                    → zero-token view of the ideas.md inbox
/atomic-skills:project idea promote <n>             → promote idea #n via the emergence ladder (ratify-gated)
/atomic-skills:project materialize <phase>          → phase descriptor → initiative + businessIntent gate (presence + find-weak-business-intent quality HARD)
/atomic-skills:project finalize <slug>              → publish plan/<slug> as a PR vs <integrationRef> (push + gh pr create); operator-prompted, pre-merge, pre-archive
/atomic-skills:project consolidate                  → merge-train integrate ≥2 READY worktrees into ONE PR (operator-prompted; <2 live WT = no-op, use finalize)
/atomic-skills:project done|push|pop|park|emerge|promote|unblock|switch|phase-done|phase-reopen|archive
/atomic-skills:project depend list [<plan>] | add <dependent> <prerequisite> | remove <dependent> <prerequisite> | resolve <dependent> <prerequisite> --archived
/atomic-skills:project why|re-ratify|scope-creep|review-due|detect-scope
/atomic-skills:project adopt <file.md>|discover|migrate [<slug>]|re-bootstrap <slug>|split-phase <id>
# valid but NOT in menu (intent via the ladder, or typed by power-users):
/atomic-skills:project new-task|new-phase|fork-plan
```

## Plan dependency operator model

The dashboard separates execution from lineage. Read **Caminho de execucao** for what can run now: `dependsOnPlans[]` drives `Liberado agora`, `Em andamento`, `Bloqueado`, and `Concluido`, and blocked rows name the prerequisite. Read **Surgiu de** only as lineage: if P1/F2/T-004 generated P2, show `Surgiu de P1 · F2/T-004`; P2 blocks only when `dependsOnPlans[]` also names P1.

## Dispatch table — load the detail file BEFORE acting

The procedures are NOT in this router. For each subcommand: **PARSE the arg, then `{{READ_TOOL}}` the detail file, then execute its steps.** Do not act from the table alone — the table only tells you which file holds the procedure.

| Subcommand(s) | Detail file (read first) |
|---|---|
| `status`, `status --browser`, `--terminal`, `--list`, `--plan`, `--phase`, `--stack`, `--archived`, `--report`, disambiguation | `{{READ_TOOL}} {{ASSETS_PATH}}/project-view.md` |
| `help`, `help --html`, `next` | `{{READ_TOOL}} {{ASSETS_PATH}}/project-help.md` |
| `verify`, `verify --fix` | `{{READ_TOOL}} {{ASSETS_PATH}}/project-verify.md` |
| `review`, `review <slug>`, `review --with-code`, `review --mode=` | `{{READ_TOOL}} {{ASSETS_PATH}}/project-review.md` |
| first-time setup (project setup sentinel absent) | `{{READ_TOOL}} {{ASSETS_PATH}}/project-setup.md` |
| `new plan <slug>`, `adopt <file.md>` | `{{READ_TOOL}} {{ASSETS_PATH}}/project-create-plan.md` |
| `new initiative <slug>` | `{{READ_TOOL}} {{ASSETS_PATH}}/project-create-initiative.md` |
| `discover` | `{{READ_TOOL}} {{ASSETS_PATH}}/project-discover.md` |
| `park`, `emerge`, `emerge --target`, `promote`, `new-task`, `new-phase`, `split-phase`, `fork-plan` | `{{READ_TOOL}} {{ASSETS_PATH}}/project-emergence.md` |
| `depend`, `depend list`, `depend add`, `depend remove`, `depend resolve` | `{{READ_TOOL}} {{ASSETS_PATH}}/project-dependencies.md` |
| `idea`, `idea list`, `idea promote <n>` | `{{READ_TOOL}} {{ASSETS_PATH}}/project-idea.md` |
| `materialize <phase>` | `{{READ_TOOL}} {{ASSETS_PATH}}/project-materialize.md` |
| `done`, `phase-done`, `phase-reopen`, `switch`, `archive`, `detect-scope`, `reconcile`, `unblock`, `push`, `pop`, verifier patterns | `{{READ_TOOL}} {{ASSETS_PATH}}/project-transitions.md` |
| `finalize <slug>` | `{{READ_TOOL}} {{ASSETS_PATH}}/project-finalize.md` |
| `consolidate` | `{{READ_TOOL}} {{ASSETS_PATH}}/project-consolidate.md` |
| `migrate` (bare = cut-over), `migrate <slug>`, `re-bootstrap <slug>` | `{{READ_TOOL}} {{ASSETS_PATH}}/project-migrate.md` |
| `scope-creep`, `why`, `re-ratify`, `review-due`, CROSS-MODEL REVIEW line | `{{READ_TOOL}} {{ASSETS_PATH}}/project-drift.md` |

Lazy-load is NOT optional. For any subcommand above: **STOP. `{{READ_TOOL}}` the listed file before you act.** Acting from memory of a similar command is the failure mode this architecture exists to prevent.

## Initial detection (run on every invocation)

With {{BASH_TOOL}}, run the **Project setup sentinel**; directory presence is
never authoritative:

- **Configured:** read `.atomic-skills/PROJECT-STATUS.md` and require
  `schemaVersion` plus `# Project Status Index`, OR at least one nested
  `.atomic-skills/projects/<project-id>/<plan-slug>/plan.md` passes
  `validate-state`. Continue with normal resolution only after one branch passes.
- **Legacy coexistence:** scan flat `.atomic-skills/plans/*.md` and
  `.atomic-skills/initiatives/*.md` independently, even when a configured
  sentinel also exists. Do not run fresh setup over it when legacy-only; do not
  delete or overwrite it. Read `{{ASSETS_PATH}}/project-migrate.md` and enter its
  diagnostic/migration flow.
- **Setup required:** absent/malformed state or a `.atomic-skills/` that already
  exists or is empty. Enter **setup mode** via
  `{{ASSETS_PATH}}/project-setup.md`, preserving malformed artifacts for its
  repair diff. `.atomic-skills/manifest.json` is installer ledger metadata and
  `.atomic-skills/hooks/version-check.sh` is installer runtime; they never count
  as its sentinel.

Configured state prefers nested
`projects/<project-id>/<plan-slug>/{plan.md,phases/f<N>-*.md}`; otherwise use the
top index with flat `plans/*.md`/`initiatives/*.md`. Resolve plan/phase, then
branch; no match runs `project-view.md` disambiguation.

## No-args — compact summary (cheap; does NOT open the browser)

Plain `/atomic-skills:project` with no subcommand prints a 5-line summary and stops. It does NOT spawn aiDeck or open a browser (that is `status --browser`). Produce these lines from `.atomic-skills/` directly:

```
PLAN     <plan-slug> · phase <id> — <title>            (or "none — standalone only")
INIT     <init-slug> · <N/M tasks done>, <B blocked>   (active initiative)
NEXT     <nextAction>
XMODEL   <CROSS-MODEL REVIEW line — see project-drift.md>
IDEAS    <N> pending — `idea list`   (ONLY when N>0; omit the line otherwise)
DRIFT    <N task(s)/gate(s) look done — run `reconcile`>   (ONLY when drift; omit the line otherwise)
          → /atomic-skills:project status        (dashboard / full view)
```

Print `IDEAS` only when N>0, computed zero-token via `{{BASH_TOOL}} grep -c '· status:pending' <resolved ideas.md>` (single project → its ideas.md; otherwise sum `projects/*/ideas.md`; fail-open). Print `DRIFT` only when `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/detect-completion.js" --json` reports `drift: true` (pure-read, fail-open). Neither mutates; `reconcile` is the only **detection-drift-triggered** completion-mutation path (`done` remains task closure authority).

On **setup required**, print `No project lifecycle state yet — run
\`/atomic-skills:project\` and I'll set it up.` and enter setup mode (including a
ledger-only tree).

---

# ALWAYS-RESIDENT INVARIANTS (never lazy — they gate or trigger every subcommand)

## Iron Law

NO IMPLEMENTATION WITHOUT ANCHORED INITIATIVE.

Every code-modifying session must be anchored to an active initiative — a phase at `.atomic-skills/projects/<project-id>/<plan-slug>/phases/f<N>-*.md`, or a standalone unit (its own degenerate 1-phase plan); legacy flat fallback `.atomic-skills/initiatives/<slug>.md` — or the user must explicitly declare "ad-hoc".

## Pre-mutation gates (apply before ANY mutating subcommand)

Run these in order on the active initiative BEFORE executing a mutating command (`push`, `pop`, `park`, `emerge`, `promote`, `unblock`, `done`, `phase-done`, `phase-reopen`, `finalize`, `consolidate`, `archive`, `switch`, `depend add`, `depend remove`, `depend resolve`, `detect-scope`, `reconcile`, `re-ratify`, `new-task`, `new-phase`, `verify --fix`). Skip read-only. `materialize` exception: may create the initiative; `verify --fix` exception: its only allowed mutation is the normalization gate in `project-verify.md`. Callers gated.

1. **Migration check.** Parse frontmatter. If `schemaVersion` is absent → STOP. Abort with: "Mutation cancelled — file is legacy. Run `atomic-skills:project migrate <slug>` first, then retry." (Full detail: `project-transitions.md`.)
2. **Reconciliation gate.** Collect `tasks[]` where `status: active` AND `lastUpdated` older than 24h (configurable `reconciliationThresholdHours`, `0` disables). If non-empty, present each (max 4 oldest) via {{ASK_USER_QUESTION_TOOL}} with options `Still active` / `Done` / `Blocked` / `Skip`, apply answers, THEN proceed. Skipped when the user is already running `done` on the stale task. (Full detail: `project-transitions.md`.)
{{#if ide.grok}}
   On Grok Build, use native `ask_user_question` for those structured options. Soft project hooks require folder/hooks trust; when untrusted they fail-open (no SessionStart digest / PreToolUse gate) — not an install failure. See `docs/kb/grok-build-compatibility.md` §7.
{{/if}}

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
| **7.5.** Phase deserves its own plan — fork (parent survives, resumes at the anchor) | "F2 grew into its own multi-phase project, but the plan still stands and must resume after" | `fork-plan <child-slug> --from <phaseId> --mode pause\|parallel [--task <T>]` |
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

## Schema, rollups & summaries — lazy (NOT resident)

These are reference + procedure, not ambient triggers (P2), so they live with the detail file that runs them — `{{READ_TOOL}}` it when you need it:
- **Schema field-reference** (Plan / Initiative / Task / Stack / CrossTaskRef / provenance / context) → `{{ASSETS_PATH}}/project-create-plan.md`, the schema field-reference section.
- **Phase/Task summaries + level hygiene** (authored at materialization, enforced at decompose) → `{{ASSETS_PATH}}/project-create-plan.md` → `## Summaries & level hygiene`.
- **Dashboard rollups + focus markers** (recomputed on every task/gate **status** change) → `{{ASSETS_PATH}}/project-transitions.md` → `## Dashboard rollups & focus markers`.

## Completion drift (detect-report-reconcile — RESIDENT so the cadence never depends on memory)

In practice tasks/phases are **not** marked done when the work is done: code lands, tasks stay `pending`/`active`, and the drift is only found later by accident. The fix inverts the relationship — verifier-evidence-shaped *signals* actively TRIGGER detection on a forced cadence, while the close authority stays honest (GATE-R2 unchanged). Three rules, always resident:

1. **Detection is deterministic + read-only.** `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/detect-completion.js" [--project <id>] [--json]` (zero-token, exits non-zero on drift) is the single source of "looks done in the repo, still open in state". It classifies each open task / pending criterion by a *changed-deliverable* signal — `output-exists` (a declared `outputs[].path` exists + changed after the entry's anchor) or `commit-ref` (a commit after the anchor naming the exact id or touching an exact declared output). Timestamps are compared by epoch, not lexically (git's offset vs the `Z` anchors). **Tasks** can match either class; an **exit-criterion** has no `outputs` field in the schema, so a **gate is detected by the id-in-commit half of `commit-ref` only** (never `output-exists`). **A `verifier:`'s mere presence is NEVER a signal** (it is written before work starts — it is the *closing* mechanism, not detection); free-text `acceptance[]` prose is never parsed. The detector NEVER mutates and NEVER runs a verifier.
2. **`status` and `verify` DETECT & REPORT by default.** The no-args summary, every `status` view, and `verify` check #7 surface drift; they do not close tasks/gates. `status` refresh/repair writes require `project-view.md` prompts; `verify --fix` is only the `project-verify.md` normalization gate. SessionStart + Stop use the same detector (fail-open).
3. **`reconcile` is the ONLY detection-drift-triggered completion-mutation path** (mutating; subject to the pre-mutation gates). `done` remains the **closure authority** for task state — `reconcile` routes closes through verifier run / `done` / manual criterion ack; it never silent-auto-closes. It is verifier-aware: a candidate with a `shell`/`test`/`query` verifier offers **`Run verifier` only** (no "mark done" shortcut — GATE-R2 forbids closing it without passing evidence); a verifier-absent candidate offers **`Mark done`** (manual ack). The signal is the *reason to ask*, never the close itself. Detail: `project-transitions.md` → `reconcile`.

**Signal-at-creation (Component E).** Detection can only see tasks that carry a signal, so every task-creating path nudges the author to give one. `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/find-signalless-tasks.js"` (zero-token, exits non-zero) lists open tasks with neither a `verifier` nor an `outputs[].path` for backfill — the same replicable-detector pattern as `find-missing-task-summaries.js`. The nudge is soft (some tasks are genuinely unverifiable), but it shrinks the undetectable blind spot toward zero over a project's life.

## Phase-end lessons consolidation (G1 — RESIDENT: learning must outlive the phase)

A `review-code` finding *generates* learning; without a sink the next phase reads, it evaporates (the lesson dies unless the user happens to ask). The lessons loop closes that — capture at the end of a phase, disposition at the start of the next:

1. **Capture (phase-done).** Distilling lessons is part of the **definition** of phase-done (not optional). The agent drafts lessons from real failure signals (confirmed `review-code` findings — especially a cross-model blocker the local pass missed — reopened/blocked tasks, deferred gates, the diff, user corrections), the user ratifies/edits/rejects (selective, capped, blameless), and the ratified set is written to one file per initiative: `.atomic-skills/projects/<id>/<plan-slug>/lessons/<initiative-slug>.md`, validated against `meta/schemas/lesson.schema.json`. A clean phase records zero lessons *explicitly* — silence ≠ zero. Detail: `project-transitions.md` → `phase-done` (Distill).
2. **Disposition (phase-start).** On in-plan phase activation, `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/list-lessons.js" --project <project-id> --plan <plan-slug> --phase <phase-id>` feeds a HARD gate: each applicable lesson is dispositioned **Apply / Keep / Stale / Reject** before activation (`--skip-lessons` records why). Detail: `project-create-initiative.md` → step 6b.
3. **Measurement.** `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/list-lessons.js" --stats` prints the deterministic burndown (identified / open / closed / stale / reusable / recurrence). A non-zero **recurrence** count (a new lesson `recurrenceOf` a prior one) is the signal that learning isn't sticking — the user's success criterion made visible.

## Code-quality gates (state files this skill writes)

Bound by `docs/kb/code-quality-gates.md` (G1 read-before-claim, G2 soft-language ban, G6 reference-or-strike). Enforcement = authoring-time lint + self-review, NOT a `validate-state` gate (C-6). Full rules + why — `{{READ_TOOL}} {{ASSETS_PATH}}/project-create-plan.md` → `## Code-quality gates (plan creation)`.

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
