---
lastUpdated: REPLACE_ISO_TIMESTAMP
schemaVersion: '0.1'
activePlans: 0
activeInitiatives: 0
archivedCount: 0
---

# Project Status Index

Canonical entry point. Auto-updated by `atomic-skills:project`. Read first every session.

This repo follows a 3-level model under `projects/<project-id>/`:

- **Plan** — multi-phase project with narrative, principles, phases, exit gates (`<plan-slug>/plan.md`)
- **Initiative** — one phase of a plan (`<plan-slug>/phases/f<N>-<slug>.md`). A standalone unit of work is a degenerate 1-phase plan (same nested shape).
- **Task** — atomic action inside a phase initiative (lives in its frontmatter `tasks[]`)

(Legacy/un-migrated trees may still carry flat `plans/<slug>.md` + `initiatives/<slug>.md`; `atomic-skills:project migrate` cuts them over.)

## Active Plans

_(none yet — run `atomic-skills:project new plan <slug>` to bootstrap interactively,
`atomic-skills:project adopt <plan-file.md>` to capture an existing plan,
or `atomic-skills:project discover` to scan repo for in-flight work)_

| Slug | Status | Current Phase | Branch | Started |
|------|--------|---------------|--------|---------|
| _(empty)_ | | | | |

## Active Initiatives (standalone)

_(initiatives not anchored to a plan — run `atomic-skills:project new initiative <slug>` to start one)_

| Slug | Status | Branch | Started | Next Action |
|------|--------|--------|---------|-------------|
| _(empty)_ | | | | |

## Recently Archived (last 10)

_(empty — closed phase initiatives move to `<plan-slug>/phases/archive/`; legacy flat `plans/archive/` + `initiatives/archive/`)_

## Ad-Hoc Sessions Log (last 5)

_(empty — explicit "no anchor" sessions are appended here for traceability)_
