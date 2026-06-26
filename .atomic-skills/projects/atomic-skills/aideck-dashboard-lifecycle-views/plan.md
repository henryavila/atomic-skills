---
schemaVersion: "0.1"
slug: aideck-dashboard-lifecycle-views
title: Reorganizar ciclo de vida das telas do dashboard
version: "1.0"
status: done
started: 2026-06-25T12:55:57Z
lastUpdated: 2026-06-25T15:14:56Z
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
          status: met
          metAt: 2026-06-25T15:14:56Z
          verifier:
            kind: manual
            description: Validar no dashboard aiDeck com o projeto atomic-skills.
          evidence:
            verifierKind: manual
            verifiedAt: 2026-06-25T15:14:56Z
            passed: true
            outputSummary: "Live aiDeck http://127.0.0.1:7777 exposes pages:
              panorama:Panorama,foco-agora:Foco agora,visao-geral:Visão
              geral,plan:Detalhe do plano,arquivados:Arquivados,help:Ajuda; npm
              run verify:aideck:smoke passed 6 data routes, 0 failed."
    status: done
    reviewGate:
      status: passed
      mode: local
      at: 962bce8a08e0f9ad9659b7c3c7586c6a8863ad10+working-tree
      reviewFile: .atomic-skills/reviews/2026-06-25-aideck-dashboard-lifecycle-views-f0.md
      verifiedAt: 2026-06-25T15:18:49Z
    summary: Reorganiza Panorama, Foco, Visao geral e Arquivados por estado operacional.
planTitle: Reorganizar ciclo de vida das telas do dashboard
---

# Narrative / notes

Standalone initiative for reorganizing the aiDeck dashboard around lifecycle states.

## Decisions

- `done` is recent completion and belongs in Visao geral below the open work.
- `archived` is cold history and belongs in Arquivados only.

## Links

_(dashboard references and validation notes)_
