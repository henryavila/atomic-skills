# `atomic-skills:project` — Plan / Initiative / Task Tracking

> **Iron Law:** `NO IMPLEMENTATION WITHOUT ANCHORED INITIATIVE.`

**Plan / Initiative / Task state your agent reloads every session**

Resume a multi-day project and the agent has forgotten which phase you're in, what's parked, and why a task exists. `project` keeps Plan/Initiative/Task state in `.atomic-skills/` so every session reloads the exact frame — stack frames for side-investigations, an emergence ladder that classifies new work before it lands, exit gates that block advancing until criteria are met, and scope-creep detection. One git-style command for the whole lifecycle: view, create, mutate, discover, migrate, verify.

## Purpose

Track work via a Plan/Initiative/Task hierarchy through one thin-router skill: view current state (compact terminal or browser dashboard), create plans/initiatives, run daily mutations and phase transitions, discover in-flight work, adopt existing markdown plans, migrate legacy state, report drift, and reconcile state against code. Procedures load on demand from project-assets per subcommand.

## Usage

**When to use:**
- Resuming after a break — view current state (`status`)
- Starting a new multi-phase plan (`new plan`) or initiative (`new initiative`)
- Daily mutations: push/pop, park/emerge, promote, done, phase-done
- Organizing in-flight work scattered across repo (`discover`)
- Capturing an existing markdown plan (`adopt`)
- Migrating legacy state files (`migrate`)
- Checking drift / un-reviewed code / state-vs-code coherence (`scope-creep`, `verify`)

**When NOT to use:**
- One-shot questions or work that fits in the current session
- Editing .atomic-skills/ files by hand (use the subcommands — they set provenance + validate)

## Reference

**Subcommands**

*View*

| Command | Description |
|---------|-------------|
| `status [--browser\|--terminal\|--list\|--plan\|--phase\|--stack\|--archived\|--report]` | View current state: compact summary, browser dashboard, full terminal view, or filtered tables |
| `help [--html]` | Terminal GPS: where am I + the next concrete step, derived from real state; lifecycle-order blockers surface predecessor commands before archive/teardown (alias: next; --html opens the visual guide) |
| `verify [--fix] [--slug <slug>]` | Reconcile .atomic-skills/ against the repo: schema, legacy-layout, branch match, scope coverage, orphans, aiDeck coherence (read-only unless --fix) |

*Create*

| Command | Description |
|---------|-------------|
| `new [plan\|initiative] <slug>` | Create a Plan (multi-phase bootstrap) or an Initiative (standalone or anchored to a phase); bare `new` prints the menu |
| `discover [--dry-run\|--commit] [--scope=<list>] [--scan=<path>]` | Scan the repo (git, PRs, docs, roadmaps, memory), cluster signals, and propose Plans + Initiatives for approve/reject |
| `adopt <file.md>` | Capture an existing free-form markdown plan into structured Plan + Initiatives + Tasks; previews before materializing |

*Stack frames*

| Command | Description |
|---------|-------------|
| `push <description>` | Open a lateral stack frame on top of the current work; type is inferred from the verb |
| `pop [--resolve\|--park\|--emerge]` | Close the top frame with a destination: --resolve (drop), --park (note), or --emerge (follow-up) |

*Backlog*

| Command | Description |
|---------|-------------|
| `park <description>` | File a low-commitment note for later into parked[]; ratify gate forces a readable solves/trigger |
| `emerge <description>` | File a real follow-up into emerged[] (same ratify gate); --target <phaseId> lands it in another phase |
| `promote <title-or-idx>` | Turn a parked item into a real task (assigns next T-NNN, carries its context forward) |
| `idea [list \| promote <n>]` | Capture a raw idea into the ideas.md inbox (fork: just save / analyze); `idea list` is a zero-token view; `idea promote <n>` routes idea #n through the emergence ladder (ratify-gated) |

*Tasks & phases*

| Command | Description |
|---------|-------------|
| `done <task-id>` | Mark a task done and stamp closedAt; if it was the last open task, surfaces phase-done or archive |
| `reconcile` | Close tasks/gates that look done in the repo — the ONLY completion-mutation path; verifier-aware (Run verifier when one exists, Mark done only when verifier-absent) |
| `materialize <phase-id>` | Turn a descriptor-only phase into a full initiative file, capturing the businessIntent spine (value/workflow/rules/outOfScope/doneWhen) at a HARD gate — the bridge from a decomposed plan to `implement` |
| `unblock <task-id>` | Return a blocked task to workable state (does NOT close it) — the documented forward exit from `blocked`; surfaces blockedBy[] blockers and their status first |
| `phase-done` | Verify every exit-gate criterion via its verifier, run a mandatory code review, then advance currentPhase |
| `phase-reopen [<phase-id>]` | Reverse a phase-done: restore the initiative to active, clear metAt on criteria, reset tasks to pending |
| `split-phase <id>` | Split an over-sized phase into sub-phases, moving tasks (preserving provenance); archives the original as archived, not done |

*Lifecycle*

| Command | Description |
|---------|-------------|
| `finalize <slug>` | Publish the finished plan branch as a PR: push plan/<slug> + gh pr create --base <integrationRef>, record the PR url in plan state; requires explicit slug and runs before merge/archive |
| `consolidate` | Merge-train integrate the READY plans across ≥2 live worktrees into ONE integration branch + PR (the 1:N counterpart to finalize): typed-allowlist conflict policy, revert-of-revert for merged-then-reverted heads, eject-and-continue HALT; operator-prompted (<2 live worktrees = no-op → use finalize) |
| `archive [<slug>]` | Move a finished plan or initiative to archive/ after lifecycle-order guard confirms finalize/merge/integration; archiving a plan cascades to its child initiatives |
| `switch <slug>` | Pause the current plan/initiative and activate the target; offers to switch the plan too if it differs |
| `migrate [<slug>]` | Two modes: `migrate <slug>` converts a legacy (pre-0.1) initiative to schemaVersion 0.1 (field-mapping diff + placeholder flags); bare `migrate` runs the flat→projects/<id>/<slug>/ layout cut-over (deterministic copy-verify-delete behind a tar snapshot) |
| `re-bootstrap <slug>` | After migrate: batch re-articulate every parked/emerged item still holding a placeholder into real ratified context |

*Context & drift*

| Command | Description |
|---------|-------------|
| `why <id>` | Read-only deep view of one item: status, ratified solves/trigger/assumptions, provenance, staleness |
| `re-ratify <id>` | Refresh a stale item: re-confirm the premises (bump review date) or rewrite solves/trigger/assumptions |
| `scope-creep` | Read-only drift report: phase growth %, scope expansion %, parked zombies, and stale-context items |
| `detect-scope` | Suggest a scope.paths value from recent git activity on the branch, as a checklist you accept |

*Review*

| Command | Description |
|---------|-------------|
| `review [<slug>] [--with-code] [--mode=local\|both]` | Mutation-gated adversarial audit of a plan/initiative — delegates to review-plan (and review-code with --with-code); reports findings only, NEVER closes tasks or advances phases |
| `review-due` | Run a cross-model codex review on the diff since the last review and record the result for the default view |

*Dependencies*

| Command | Description |
|---------|-------------|
| `depend list [<plan>] \| add <dependent> <prerequisite> \| remove <dependent> <prerequisite> \| resolve <dependent> <prerequisite> --archived` | Manage cross-plan execution dependencies (dependsOnPlans[]): list edges, add/remove a prerequisite, or resolve one against an archived plan; drives the dashboard Caminho de execucao lanes (Liberado/Em andamento/Bloqueado/Concluido) |

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `--browser` | flag | optional | Open the aiDeck dashboard in the browser (status view) |
| `--terminal` | flag | optional | Full terminal-only view, no browser (status view) |
| `--list` | flag | optional | List all plans + standalone initiatives (status view) |
| `--plan` | option | optional | Filter view to a specific plan slug (status view) |
| `--phase` | option | optional | Filter view to a specific phase id (status view) |
| `--scan` | option | optional | Extra source paths for discover (comma-separated). E.g. --scan=NOTES/,~/team-plans/ |
| `--scope` | option | optional | Discover: comma-separated source kinds (git,github,docs,roadmap,memory-local,memory-claude,claude-mem) |

**Examples:**
- `/atomic-skills:project` — Compact 5-line summary of the active plan/initiative
- `/atomic-skills:project status --browser` — Open the aiDeck dashboard
- `/atomic-skills:project new plan v3-redesign` — Bootstrap a new multi-phase Plan (7-stage flow)
- `/atomic-skills:project done T-005` — Close a task (triggers phase-completion check if last)
- `/atomic-skills:project verify` — Reconcile .atomic-skills/ state against the code

## Metadata

**Output artifacts:** `.atomic-skills/PROJECT-STATUS.md`, `.atomic-skills/plans/<slug>.md`, `.atomic-skills/initiatives/<slug>.md`, `.atomic-skills/status/config.json`, `.atomic-skills/bootstrap-drafts/ (discover output)`

**Dependencies:** `git`

**Related:** `fix`, `save-and-push`, `review-plan`

**Tags:** `tracking`, `anchoring`, `planning`, `bootstrap`, `create`, `migrate`, `core`

**Version added:** `1.5.0`
