# `atomic-skills:project-plan` — Create, Discover, Migrate

> **Iron Law:** `NO PLAN WITHOUT NARRATIVE.`

**Create + restructure + discover Plans and Initiatives**

Plans rot into bare frontmatter or live as scattered intent across docs, branches, and memory. `project-plan` is the single create-and-restructure entry point: bootstrap a multi-phase Plan interactively, adopt an existing markdown plan, or `discover` in-flight work and cluster it — and it refuses to emit a plan without a real narrative (Context, Principles, Phase tree). Daily tracking then flows through `project-status`.

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

**Subcommands**

*Discover & adopt*

| Command | Description |
|---------|-------------|
| `discover [--dry-run\|--commit] [--scope=<list>] [--scan=<path>]` | Scan the whole repo (git, PRs, docs, roadmaps, memory), cluster signals, and propose Plans + Initiatives for approve/reject |
| `adopt <file.md>` | Capture an existing free-form markdown plan into structured Plan + Initiatives + Tasks; previews before materializing |

*Create units*

| Command | Description |
|---------|-------------|
| `new <slug>` | Create one Initiative from the template, standalone or anchored to an active plan's phase; offers scope auto-detect |
| `new-task "<title>" [--target <phaseId>] [--blocked-by <id>] [--tags ...]` | Add a task to the active (or --target) initiative; records provenance and requires a ratified context block |
| `new-phase <id> "<title>" --after <other-id>` | Insert a new phase into the active plan and materialize its initiative; sets dependsOn via --after, requires ratified context |

*Restructure*

| Command | Description |
|---------|-------------|
| `split-phase <id>` | Split an over-sized phase into sub-phases, moving tasks (preserving provenance); archives the original as archived, not done |

*Migrate legacy*

| Command | Description |
|---------|-------------|
| `migrate <slug>` | Convert a legacy (pre-0.1) initiative file to schemaVersion 0.1; reports the field-mapping diff and flags placeholder context |
| `re-bootstrap <slug>` | After migrate: batch re-articulate every parked/emerged item still holding a placeholder into real ratified context |

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
