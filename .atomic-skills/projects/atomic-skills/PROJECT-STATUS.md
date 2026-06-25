---
lastUpdated: 2026-06-25T21:51:42Z
schemaVersion: "0.1"
activePlans: 2
activeInitiatives: 2
archivedCount: 14
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
| multiplan-focus-resolution | archived | — | plan/multiplan-focus | 2026-06-15 |
| design-brief-source-of-truth | archived | F2 | plan/design-brief | 2026-06-15 |
| fix-aideck-dashboard | active | F1 | plan/fix-aideck-dashboard | 2026-06-16 |
| app-map-conflict-arbitration | archived | F1 | plan/design-brief | 2026-06-16 |
| design-brief-briefing-rework | archived | F1 | plan/design-brief | 2026-06-19 |
| worktree-lifecycle-finalization | active | F8 | plan/worktree-lifecycle-finalization | 2026-06-17 |
| deadline-burnup-forecast | active | F4 | plan/deadline-burnup-forecast | 2026-06-19 |
| aideck-dashboard-lifecycle-views | active | F0 | develop | 2026-06-25 |
| aideck-multi-project | archived | — | — | 2026-05-25 |
| bmad-af-learnings | archived | — | — | 2026-05-27 |
| bmad-porting-research | archived | F0 | — | 2026-05-27 |
| fix-superpowers-integration | archived | — | — | 2026-05-25 |
| mode2-anthropic-subagent-tier | archived | F0 | — | 2026-06-01 |
| mode2-codex-default-enablement | archived | — | main | 2026-06-06 |
| project-orchestrator-redesign | archived | — | main | 2026-06-01 |
| refactor-doc-architect | paused | F0 | main | 2026-05-31 |
| plan-dependencies | active | F2 | plan/plan-dependencies | 2026-06-25 |

## Active Initiatives (standalone)

_(none)_

## Recently Archived (last 10)

| Slug | Archived | Phases | Notes |
|------|----------|--------|-------|
| design-brief-source-of-truth | 2026-06-16 | F0·F1·F2 (3/3 done) | Catálogo app-map: schema 0.2, reconstrução justapor+confirmação, integração no design-brief (Step 2 reconstrução-primeiro + R2 por regime). Follow-up: idea #3 (descritor de conflito rico + canal CLI). |
| app-map-conflict-arbitration | 2026-06-16 | F0·F1 (2/2 done) | Descritor de conflito rico + canal de arbitragem (idea #3 do design-brief-source-of-truth). plan-done F1 com reviewGate(both); lição L-001 ratificada. |
| design-brief-briefing-rework | 2026-06-19 | F0·F1 (2/2 done) | Modelo de autoridade do briefing (anti-contaminação): camada-é-autoridade — D3 filtro / D5 band-pin / D8 textura. F1 gate de não-reincidência: regen cego v2 = NAO-REINCIDENTE após o fix do band-pin de contagens. reviewGate F0(local)+F1(local); 3 lições. |
| multiplan-focus-resolution | 2026-06-16 | F0 (6/6 done) | Foco determinístico multi-plano + enforcer worktree-por-plano. Gate met, reviewGate passed. |

## Ad-Hoc Sessions Log (last 5)

_(empty)_
