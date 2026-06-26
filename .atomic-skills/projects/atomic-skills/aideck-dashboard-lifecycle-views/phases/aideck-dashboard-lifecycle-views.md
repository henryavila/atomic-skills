---
schemaVersion: "0.1"
slug: aideck-dashboard-lifecycle-views
title: Reorganizar ciclo de vida das telas do dashboard
goal: Separar trabalho aberto, concluido recente e arquivado no dashboard aiDeck.
status: active
branch: develop
started: 2026-06-25T12:55:57Z
lastUpdated: 2026-06-25T12:55:57Z
nextAction: "Executar T-001: realinhar labels, filtros e secoes do manifest aiDeck."
parentPlan: aideck-dashboard-lifecycle-views
phaseId: F0
tasksDone: 0
tasksTotal: 1
gatesMet: 0
gatesTotal: 1
weightDone: 0
weightTotal: 1
exitGates:
  - id: G-1
    description: "Panorama, Foco agora, Visao geral e Arquivados exibem estados sem
      duplicar listas operacionais: ativos/pausados/travados ficam no fluxo
      aberto; done aparece em Visao geral; archived aparece apenas em
      Arquivados."
    status: pending
    verifier:
      kind: manual
      description: Validar no dashboard aiDeck com o projeto atomic-skills.
    verifierLabel: manual
stack:
  - id: 1
    title: Reorganizar ciclo de vida das telas do dashboard
    type: task
    openedAt: 2026-06-25T12:55:57Z
tasks:
  - id: T-001
    title: Realinhar labels, filtros e secoes do manifest aiDeck
    status: pending
    lastUpdated: 2026-06-25T12:55:57Z
    summary: Realinha labels, filtros e secoes do manifest aiDeck para o ciclo de vida do dashboard.
parked: []
emerged: []
summary: Reorganiza Panorama, Foco, Visao geral e Arquivados por estado operacional.
planTitle: Reorganizar ciclo de vida das telas do dashboard
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F0 — Reorganizar ciclo de vida das telas do dashboard**.

## Decisions

- `done` remains visible in Visao geral as recent/completed work.
- `archived` moves to Arquivados as cold history.

## Links

_(dashboard references and validation notes)_
