---
lastUpdated: 2026-07-09T14:39:17Z
schemaVersion: "0.1"
activePlans: 1
activeInitiatives: 1
archivedCount: 21
---

# Project Status Index

Canonical project index for `atomic-skills`. Read first every session.

This repo follows a 3-level model under `projects/<project-id>/`:

- **Plan** - multi-phase project with narrative, principles, glossary, phases, exit gates (`<plan-slug>/plan.md`)
- **Initiative** - one phase of a plan (`<plan-slug>/phases/f<N>-<slug>.md`). A standalone unit of work is a degenerate 1-phase plan.
- **Task** - atomic action inside a phase initiative (lives in its frontmatter `tasks[]`)

## Active Plans

| Slug | Status | Current Phase | Branch | Started | Phases |
|------|--------|---------------|--------|---------|--------|
| installer-hooks-cross-ide | active | F2 | develop | 2026-07-08 | 2/4 |


## Done Plans (not archived)

| Slug | Status | Current Phase | Branch | Started | Phases |
|------|--------|---------------|--------|---------|--------|
| help-command | done | F3 | develop | 2026-07-05 | 4/4 |
| fix-aideck-dashboard | done | F3 | plan/fix-aideck-dashboard | 2026-06-16 | 4/4 |
| deadline-burnup-forecast | done | F5 | plan/deadline-burnup-forecast | 2026-06-17 | 6/6 |
| reversible-installer | done | F3 | plan/reversible-installer | 2026-06-17 | 4/4 |
| plan-fork | done | F5 | plan/plan-fork | 2026-06-19 | 6/6 |
| aideck-dashboard-lifecycle-views | done | F0 | develop | 2026-06-25 | 1/1 |

## Paused Plans

| Slug | Status | Current Phase | Branch | Started | Phases |
|------|--------|---------------|--------|---------|--------|
| refactor-doc-architect | paused | F0 | main | 2026-05-31 | 0/6 |

## Active Initiatives (standalone)

| Slug | Parent Plan | Phase | Branch | Started | Next |
|------|-------------|-------|--------|---------|------|
| installer-hooks-cross-ide-f2-testes-de-regressao | installer-hooks-cross-ide | F2 | develop | 2026-07-09 | Ratificar lesson F2 proposta. |

## Recently Archived (last 10)

| Slug | Updated | Final Phase | Phases | Title |
|------|---------|-------------|--------|-------|
| installer-hooks-cross-ide/installer-hooks-cross-ide-f1-setup-e-documentacao | 2026-07-09 | F1 | 2/4 | Setup e documentacao |
| installer-hooks-cross-ide/installer-hooks-cross-ide-f0-contrato-cross-ide-de-hooks | 2026-07-09 | F0 | 1/4 | Contrato cross-IDE de hooks |
| project-lifecycle-order-guards | 2026-07-08 | F0 | 1/1 | Guardas de ordem do lifecycle project |
| project-lifecycle-order-guards/project-lifecycle-order-guards | 2026-07-08 | F0 | 1/1 | Guardas de ordem do lifecycle project |
| help-command/f3-guarda-de-fidelidade-help-nunca-cita-um | 2026-07-08 | F3 | 4/4 | Comando `help` - F3 Guarda de fidelidade (help nunca cita um verbo que não existe) |
| help-command/f2-rendering-do-bloco-de-ensino | 2026-07-08 | F2 | 3/4 | Comando `help` — F2 Rendering do bloco de ensino |
| help-command/f0-contrato-esqueleto | 2026-07-05 | F0 | 1/4 | Comando `help` — F0 Contrato + esqueleto |
| phase-materialization | 2026-07-02 | F5 | 6/6 | Materialização lazy de fases + gate de validação de negócio |
| design-brief-briefing-rework | 2026-06-19 | F1 | 2/2 | design-brief - repensar o modelo de autoridade do briefing (anti-congelamento de legado) |
| worktree-lifecycle-finalization | 2026-06-19 | F8 | 9/9 | Finalizacao do ciclo de vida da worktree-do-plano |

## Ad-Hoc Sessions Log (last 5)

_(empty)_
