# `atomic-skills:project-status` — Initiative Tracking

> **Iron Law:** `NO IMPLEMENTATION WITHOUT ANCHORED INITIATIVE.`

**View + daily mutations on the .atomic-skills/ tree**

Multi-session projects lose context between conversations. `project-status` tracks Plans, Initiatives, and Tasks in `.atomic-skills/` — with stack frames for lateral work, scope-creep detection, and phase gates that keep the agent anchored.

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

**Subcommands:**

| Example | Description |
|---------|-------------|
| `/atomic-skills:project-status push "investigating slow query"` | Push a new stack frame (lateral expansion) |
| `/atomic-skills:project-status pop --park` | Pop top frame with destination |
| `/atomic-skills:project-status park "consider caching layer"` | Add a parked item (note for later, no decision yet) |
| `/atomic-skills:project-status emerge "auth refactor needed"` | Add an emerged finding (real follow-up worth promoting) |
| `/atomic-skills:project-status promote 2` | Promote a parked item to a real task |
| `/atomic-skills:project-status done T-005` | Mark task done; triggers phase-completion check if last |
| `/atomic-skills:project-status phase-done` | Verify exit gates, advance to next phase (prompts codex review) |
| `/atomic-skills:project-status phase-reopen F2` | Reverse of phase-done — clears metAt on exit criteria |
| `/atomic-skills:project-status archive v3-redesign` | Move plan/initiative to archive/ (cascades from plan to children) |
| `/atomic-skills:project-status switch my-feature` | Pause current active plan/initiative, set target as active |
| `/atomic-skills:project-status re-ratify P-3` | Re-articulate context of an existing item (stale lastReviewedAt) |
| `/atomic-skills:project-status why T-005` | Show full context for a task / phase / parked / emerged entry |
| `/atomic-skills:project-status scope-creep` | On-demand drift report (read-only, surfaces stale items) |
| `/atomic-skills:project-status detect-scope` | Suggest scope.paths value based on recent git activity |
| `/atomic-skills:project-status review-due` | Cross-model codex review against the diff since last review |

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
