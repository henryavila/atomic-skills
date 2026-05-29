# `atomic-skills:project-status` — Initiative Tracking

> **Iron Law:** `NO IMPLEMENTATION WITHOUT ANCHORED INITIATIVE.`

**View + daily mutations on the .atomic-skills/ tree**

Resume a multi-day project and the agent has forgotten which phase you're in, what's parked, and why a task exists. `project-status` keeps Plan/Initiative/Task state in `.atomic-skills/` so every session reloads the exact frame — with stack frames for side-investigations, scope-creep detection, and phase exit-gates that block advancing until criteria are met. Compact terminal view or browser dashboard, no re-explaining required.

## Purpose

Track work via Plan/Initiative/Task hierarchy: view current state, manage stack/parked/emerged, transition tasks/phases, archive, report drift. Sibling skill `project-plan` handles all CREATE and structural operations.

## Usage

**When to use:**
- Resuming after a break — view current state
- Pushing or popping a stack frame (lateral expansion)
- Parking lateral findings or surfacing emerged work
- Marking tasks done, advancing phases
- Archiving completed plans/initiatives
- Viewing drift / scope-creep / un-reviewed code

**When NOT to use:**
- Starting a new plan — use atomic-skills:project-plan
- Creating a new initiative / task / phase — use atomic-skills:project-plan
- Migrating legacy files — use atomic-skills:project-plan migrate
- One-shot questions or work that fits in the current session

## Reference

**Subcommands**

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

*Tasks & phases*

| Command | Description |
|---------|-------------|
| `done <task-id>` | Mark a task done and stamp closedAt; if it was the last open task, surfaces phase-done or archive |
| `phase-done` | Verify every exit-gate criterion via its verifier, run a mandatory code review, then advance currentPhase |
| `phase-reopen [<phase-id>]` | Reverse a phase-done: restore the initiative to active, clear metAt on criteria, reset tasks to pending |

*Lifecycle*

| Command | Description |
|---------|-------------|
| `archive [<slug>]` | Move a finished plan or initiative to archive/ (archiving a plan cascades to its child initiatives) |
| `switch <slug>` | Pause the current plan/initiative and activate the target; offers to switch the plan too if it differs |

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
| `review-due` | Run a cross-model codex review on the diff since the last review and record the result for the default view |

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `--list` | flag | optional | List all initiatives across all plans |
| `--plan` | option | optional | Filter view to a specific plan slug |
| `--phase` | option | optional | Filter view to a specific phase id |
| `--stack` | flag | optional | Show only the active stack (compact view) |
| `--archived` | flag | optional | Show archived items |

**Examples:**
- `/atomic-skills:project-status` — View current state
- `/atomic-skills:project-status push "investigating slow query"` — Push a side-investigation frame
- `/atomic-skills:project-status done T-005` — Close a task (triggers phase-completion check if last)
- `/atomic-skills:project-status phase-done` — Verify exit gates and advance the plan

## Metadata

**Output artifacts:** `.atomic-skills/PROJECT-STATUS.md`, `.atomic-skills/plans/<slug>.md`, `.atomic-skills/initiatives/<slug>.md`, `.atomic-skills/status/config.json`, `.atomic-skills/dispatches/<slug>.md (when promote-to-dispatch)`

**Dependencies:** `git`

**Related:** `fix`, `save-and-push`, `project-plan`

**Tags:** `tracking`, `anchoring`, `planning`, `core`

**Version added:** `1.5.0`
