---
lastUpdated: 2026-06-19T13:00:00Z
schemaVersion: '0.1'
activePlans: 3
activeInitiatives: 3
archivedCount: 2
---

# Project Status Index

Canonical entry point. Auto-updated by `atomic-skills:project`. Read first every session.

This repo follows a 3-level model under `projects/<project-id>/`:

- **Plan** — multi-phase project with narrative, principles, phases, exit gates (`<plan-slug>/plan.md`)
- **Initiative** — one phase of a plan (`<plan-slug>/phases/f<N>-<slug>.md`). A standalone unit of work is a degenerate 1-phase plan.
- **Task** — atomic action inside a phase initiative (lives in its frontmatter `tasks[]`)

## Active Plans

| Slug | Status | Current Phase | Branch | Started |
|------|--------|---------------|--------|---------|
| quick-idea-capture | archived | F1 | — | 2026-06-09 |
| skills-restructuring | active | F0 | plan/skills-restructuring | 2026-06-15 |
| multiplan-focus-resolution | active | F0 | plan/multiplan-focus | 2026-06-15 |
| design-brief-source-of-truth | archived | F2 | plan/design-brief | 2026-06-15 |
| fix-aideck-dashboard | active | F1 | plan/fix-aideck-dashboard | 2026-06-16 |
| app-map-conflict-arbitration | archived | F1 | plan/design-brief | 2026-06-16 |
| design-brief-briefing-rework | paused | F0 | plan/design-brief | 2026-06-19 | (pausado pelo operador) |
| aideck-multi-project | archived | — | — | 2026-05-25 |
| bmad-af-learnings | archived | — | — | 2026-05-27 |
| bmad-porting-research | archived | F0 | — | 2026-05-27 |
| fix-superpowers-integration | archived | — | — | 2026-05-25 |
| mode2-anthropic-subagent-tier | archived | F0 | — | 2026-06-01 |
| mode2-codex-default-enablement | archived | — | main | 2026-06-06 |
| project-orchestrator-redesign | archived | — | main | 2026-06-01 |
| refactor-doc-architect | paused | F0 | main | 2026-05-31 |

## Active Initiatives (standalone)

_(none)_

## Recently Archived (last 10)

| Slug | Archived | Phases | Notes |
|------|----------|--------|-------|
| design-brief-source-of-truth | 2026-06-16 | F0·F1·F2 (3/3 done) | Catálogo app-map: schema 0.2, reconstrução justapor+confirmação, integração no design-brief (Step 2 reconstrução-primeiro + R2 por regime). Follow-up: idea #3 (descritor de conflito rico + canal CLI). |
| app-map-conflict-arbitration | 2026-06-16 | F0·F1 (2/2 done) | Descritor de conflito rico + canal de arbitragem (idea #3 do design-brief-source-of-truth). plan-done F1 com reviewGate(both); lição L-001 ratificada. |

## Ad-Hoc Sessions Log (last 5)

_(empty)_
