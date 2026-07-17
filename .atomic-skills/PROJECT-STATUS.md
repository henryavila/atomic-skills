---
lastUpdated: 2026-07-17T14:28:52.765Z
schemaVersion: "0.1"
activePlans: 1
activeInitiatives: 1
archivedCount: 14
---

# Project Status Index

Canonical project index for `atomic-skills`. Read first every session.

This repo follows a 3-level model under `projects/<project-id>/`:

- **Plan** - multi-phase project with narrative, principles, phases, exit gates (`<plan-slug>/plan.md`)
- **Initiative** - one phase of a plan (`<plan-slug>/phases/f<N>-<slug>.md`). A standalone unit of work is a degenerate 1-phase plan.
- **Task** - atomic action inside a phase initiative (lives in its frontmatter `tasks[]`)

## Active Plans

| Slug | Status | Current Phase | Branch | Started | Phases |
|------|--------|---------------|--------|---------|
| product-docs-site | done | F5 | plan/product-docs-site | 2026-07-17 | 6/6 |



## Done Plans (not archived)

| Slug | Status | Current Phase | Branch | Started | Phases |
|------|--------|---------------|--------|---------|--------|
| grok-build-integration | done | F5 | plan/grok-build-integration | 2026-07-16 | 6/6 |
| fix-aideck-dashboard | done | F3 | plan/fix-aideck-dashboard | 2026-06-16 | 4/4 |
| deadline-burnup-forecast | done | F5 | plan/deadline-burnup-forecast | 2026-06-17 | 6/6 |
| reversible-installer | done | F3 | plan/reversible-installer | 2026-06-17 | 4/4 |
| plan-fork | done | F5 | plan/plan-fork | 2026-06-19 | 6/6 |
| aideck-dashboard-lifecycle-views | done | F0 | develop | 2026-06-25 | 1/1 |

## Paused Plans

| Slug | Status | Current Phase | Branch | Started | Phases |
|------|--------|---------------|--------|---------|--------|
| refactor-doc-architect | paused | F0 | main | 2026-05-31 | 0/6 |

## Active Initiatives (plan-anchored)

| Path | Status | Phase | Branch | Tasks |
|------|--------|-------|--------|-------|
| product-docs-site / product-docs-site-f0-catalog-v0-3-and-product-block | active | F0 | plan/product-docs-site | 0/3 tasks |

## Active Initiatives (standalone)

_(none)_

## Recently Archived (last 10)

| Slug | Updated | Final Phase | Phases | Title |
|------|---------|-------------|--------|-------|
| design-brief-briefing-rework | 2026-06-19 | F1 | 2/2 | design-brief - repensar o modelo de autoridade do briefing (anti-congelamento de legado) |
| worktree-lifecycle-finalization | 2026-06-19 | F8 | 9/9 | Finalizacao do ciclo de vida da worktree-do-plano |
| app-map-conflict-arbitration | 2026-06-16 | F1 | 2/2 | app-map: descritor de conflito rico + canal de arbitragem |
| design-brief-source-of-truth | 2026-06-16 | F2 | 3/3 | design-brief: reconstrucao da fonte-de-verdade (catalogo app-map) |
| multiplan-focus-resolution | 2026-06-16 | - | 1/1 | Resolucao de foco em camadas + enforcer worktree-por-plano |
| skills-restructuring | 2026-06-16 | F4 | 7/7 | Reestruturacao das skills atomic-skills |
| quick-idea-capture | 2026-06-09 | F1 | 2/2 | Quick Idea Capture |
| mode2-anthropic-subagent-tier | 2026-06-09 | F0 | 0/1 | Mode 2 - Anthropic subagent executor tier (Sonnet/Haiku) |
| bmad-porting-research | 2026-06-09 | F0 | 0/1 | Pesquisa: Porting de Modulos BMAD para Atomic Skills |
| bmad-af-learnings | 2026-06-08 | - | 1/1 | BMad AF Learnings - State Sync + Quality Gates |

## Ad-Hoc Sessions Log (last 5)

_(empty)_
