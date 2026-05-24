---
lastUpdated: REPLACE_ISO_TIMESTAMP
schemaVersion: '0.1'
activePlans: 0
activeInitiatives: 0
archivedCount: 0
---

# Project Status Index

Canonical entry point. Auto-updated by `atomic-skills:project-status`. Read first every session.

This repo follows a 3-level model:

- **Plan** — multi-phase project with narrative, principles, phases, exit gates (`plans/<slug>.md`)
- **Initiative** — one phase of a plan, OR a standalone unit of work (`initiatives/<slug>.md`)
- **Task** — atomic action inside an initiative (lives in initiative frontmatter `tasks[]`)

Standalone initiatives (no `parentPlan`) coexist with plan-anchored initiatives.

## Active Plans

_(none yet — run `atomic-skills:project-plan <slug>` to bootstrap interactively,
`atomic-skills:project-plan adopt <plan-file.md>` to capture an existing plan,
or `atomic-skills:project-plan discover` to scan repo for in-flight work)_

| Slug | Status | Current Phase | Branch | Started |
|------|--------|---------------|--------|---------|
| _(empty)_ | | | | |

## Active Initiatives (standalone)

_(initiatives not anchored to a plan — run `atomic-skills:project-plan new <slug>` to start one)_

| Slug | Status | Branch | Started | Next Action |
|------|--------|--------|---------|-------------|
| _(empty)_ | | | | |

## Recently Archived (last 10)

_(empty — closed plans and initiatives move to `plans/archive/` and `initiatives/archive/`)_

## Ad-Hoc Sessions Log (last 5)

_(empty — explicit "no anchor" sessions are appended here for traceability)_
