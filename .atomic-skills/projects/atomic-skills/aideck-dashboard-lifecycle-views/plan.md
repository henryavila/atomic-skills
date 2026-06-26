---
schemaVersion: "0.1"
slug: aideck-dashboard-lifecycle-views
title: Reorganizar ciclo de vida das telas do dashboard
version: "1.0"
status: done
started: 2026-06-25T12:55:57Z
lastUpdated: 2026-06-26T16:55:14Z
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
          metAt: 2026-06-26T16:55:14Z
          verifier:
            kind: manual
            description: Validar no dashboard aiDeck com o projeto atomic-skills.
    status: done
    reviewGate:
      status: skipped
      reason: "Realinhamento somente de manifest (YAML + 4 testes unitarios, sem logica de producao JS); alteracao TDD-travada (gate G-1) e validada ao vivo headless; review-code cross-model nao executado para esta iniciativa de rastreio."
      verifiedAt: 2026-06-26T16:55:14Z
    summary: Reorganiza Panorama, Foco, Visao geral e Arquivados por estado operacional.
planActive: false
planTitle: Reorganizar ciclo de vida das telas do dashboard
---

# Narrative / notes

Standalone initiative for reorganizing the aiDeck dashboard around lifecycle states.

## Decisions

- `done` is recent completion and belongs in Visao geral below the open work.
- `archived` is cold history and belongs in Arquivados only.

## Links

_(dashboard references and validation notes)_
