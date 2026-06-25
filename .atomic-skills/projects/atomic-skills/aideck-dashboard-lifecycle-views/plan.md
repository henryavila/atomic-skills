---
schemaVersion: "0.1"
slug: aideck-dashboard-lifecycle-views
title: Reorganizar ciclo de vida das telas do dashboard
version: "1.0"
status: active
started: 2026-06-25T12:55:57Z
lastUpdated: 2026-06-25T12:55:57Z
branch: develop
currentPhase: F0
parallelismAllowed: false
phases:
  - id: F0
    slug: aideck-dashboard-lifecycle-views
    title: Reorganizar ciclo de vida das telas do dashboard
    goal: Separar trabalho aberto, concluido recente e arquivado no dashboard aiDeck.
    dependsOn: []
    subPhaseCount: 1
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: "Panorama, Foco agora, Visao geral e Arquivados exibem estados sem
            duplicar listas operacionais: ativos/pausados/travados ficam no
            fluxo aberto; done aparece em Visao geral; archived aparece apenas
            em Arquivados."
          status: pending
          verifier:
            kind: manual
            description: Validar no dashboard aiDeck com o projeto atomic-skills.
    status: active
    summary: Reorganiza Panorama, Foco, Visao geral e Arquivados por estado operacional.
planActive: true
planTitle: Reorganizar ciclo de vida das telas do dashboard
---

# Narrative / notes

Standalone initiative for reorganizing the aiDeck dashboard around lifecycle states.

## Decisions

- `done` is recent completion and belongs in Visao geral below the open work.
- `archived` is cold history and belongs in Arquivados only.

## Links

_(dashboard references and validation notes)_
