---
schemaVersion: "0.1"
slug: fix-superpowers-integration
title: Consertar integração project-plan ↔ superpowers
version: "1.0"
status: archived
started: 2026-05-25T17:30:00.000Z
lastUpdated: 2026-06-08T01:47:16Z
currentPhase: null
parallelismAllowed: false
phases:
  - id: F0
    slug: fix-superpowers-integration
    title: Consertar integração project-plan ↔ superpowers
    goal: Fazer project-plan detectar e usar superpowers:brainstorming +
      writing-plans para gerar planos mais robustos
    dependsOn: []
    subPhaseCount: 5
    exitGate:
      summary: 3 criteria to meet
      criteria:
        - id: G-1
          description: project-plan detecta superpowers v5.1.0 como available
          status: pending
          verifier:
            kind: shell
            command: grep -q superpowers ~/.claude/plugins/installed_plugins.json && echo
              pass
            expectExitCode: 0
        - id: G-2
          description: Stage 3 Branch A invoca superpowers:brainstorming (nome correto) e
            recebe design doc
          status: pending
          verifier:
            kind: manual
            description: Rodar project-plan com superpowers available, escolher Branch A,
              verificar brainstorming executa
        - id: G-3
          description: Output do brainstorming alimenta decomposePlan com sucesso
          status: pending
          verifier:
            kind: manual
            description: Verificar que o plan source gerado apos brainstorming e parseavel
              por decomposePlan
    status: pending
    summary: Faz o project-plan detectar e usar superpowers:brainstorming +
      writing-plans para planos mais robustos.
references: []
planTitle: Consertar integração project-plan ↔ superpowers
---


# Consertar integração project-plan ↔ superpowers

> Migrated standalone initiative — degenerate 1-phase plan (single phase `F0`).
> The phase initiative under `phases/` holds the real work; this plan is the layout wrapper.

**Goal:** Fazer project-plan detectar e usar superpowers:brainstorming + writing-plans para gerar planos mais robustos

## Cancelled (2026-06-08)

Archived as **CANCELLED — obsolete, not completed**. The superpowers integration was decoupled and is no longer used, so fixing its detection/skill-name wiring (the premise of this plan, which also referenced the now-consolidated `project-plan.md` + pre-rename skill names) is moot. 0/5 tasks were ever started; no work was done.
