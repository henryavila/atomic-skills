# `atomic-skills:project-plan` — Create, Discover, Migrate

> **Iron Law:** `NO PLAN WITHOUT NARRATIVE.`

**Create + restructure + discover Plans and Initiatives**

Every repo has in-flight work scattered across docs, branches, and memory. `project-plan` discovers it, clusters it into structured Plans, or adopts existing markdown plans — turning scattered intent into trackable state.

## Purpose

All paths that CREATE or RESTRUCTURE state in `.atomic-skills/`: bootstrap fresh Plans (interactive 7-stage), discover in-flight work from memory + docs + git, adopt existing markdown plans, add initiatives/tasks/phases, split phases, migrate legacy.

## Usage

**When to use:**
- Want to organize what the repo already has → `discover`
- Multi-phase project described in conversation → default bootstrap
- Existing markdown plan to capture → `adopt`
- Standalone initiative for single-phase work → `new`
- Add task/phase to active plan → `new-task` / `new-phase` / `split-phase`
- Legacy initiative needs schema 0.1 → `migrate`
- Post-migration batch context re-articulation → `re-bootstrap`

**When NOT to use:**
- .atomic-skills/ does not exist yet (run atomic-skills:project-status setup first)
- Daily tracking (view, push/pop, done, phase-done, etc.) — use project-status
- Just viewing existing plans (use project-status --plan <slug>)

## Reference

**Subcommands:**

| Example | Description |
|---------|-------------|
| `/atomic-skills:project-plan discover` | Multi-source scan + cluster + synthesize → propose Plans + Initiatives |
| `/atomic-skills:project-plan adopt docs/plans/v3-redesign/00-master.md` | Capture an existing markdown plan into structured Plan + Initiatives + Tasks |
| `/atomic-skills:project-plan new my-feature` | Create a new Initiative (standalone or under active plan) |
| `/atomic-skills:project-plan new-task --target F2 "Add canary smoke test"` | Add a task to current OR specified initiative (records provenance + requires ratified context) |
| `/atomic-skills:project-plan new-phase F0.5 "Validation" --after F0` | Insert a new phase into the active plan + materialize its initiative (requires ratified context) |
| `/atomic-skills:project-plan split-phase F2` | Split an over-sized phase into two sub-phases (archives the original; ratify each new phase) |
| `/atomic-skills:project-plan migrate sample-legacy` | Migrate a legacy initiative file to schemaVersion 0.1 |
| `/atomic-skills:project-plan re-bootstrap sample-legacy` | Batch re-articulate placeholder context after migrate |

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `slug` | positional | optional | Plan slug for the default (bootstrap) flow. Omit and the skill prompts interactively. |
| `--scan` | option | optional | Extra source paths for discover (comma-separated). E.g. --scan=NOTES/,~/team-plans/ |
| `--scope` | option | optional | Discover: comma-separated source kinds (git,github,docs,roadmap,memory-local,memory-claude,claude-mem) |

**Examples:**
- `/atomic-skills:project-plan discover` — Multi-source scan: propose Plans + Initiatives from .ai/memory, docs, git
- `/atomic-skills:project-plan v3-redesign` — Bootstrap a new Plan interactively (7-stage flow)
- `/atomic-skills:project-plan adopt docs/plans/v3-redesign/00-master.md` — Capture an existing markdown plan into structured state
- `/atomic-skills:project-plan migrate mesh-restructure` — Convert a legacy initiative file to schema 0.1

## Metadata

**Output artifacts:** `.atomic-skills/plans/<slug>.md`, `.atomic-skills/initiatives/<slug>.md`, `.atomic-skills/bootstrap-drafts/ (discover output)`

**Dependencies:** `git`

**Related:** `project-status`, `review-plan`

**Tags:** `planning`, `bootstrap`, `create`, `migrate`, `core`

**Version added:** `2.0.0`
