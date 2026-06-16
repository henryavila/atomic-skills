---
schemaVersion: "0.1"
slug: app-map-conflict-arbitration-f0-contrato-schema-0-3-descritor-w
title: "Contrato: schema 0.3 + descritor witnesses"
goal: Estabelecer o contrato 0.3 do conflito — o descritor `witnesses[]` no
  schema + a regra de integridade no validador — validável emit-time, antes de
  qualquer produtor ou consumidor emitir a forma nova.
status: active
branch: plan/design-brief
started: 2026-06-16T18:38:32.145Z
lastUpdated: 2026-06-16T18:38:32.145Z
nextAction: "Start T-001: Schema 0.3 — conflict vira witnesses[]"
parentPlan: app-map-conflict-arbitration
phaseId: F0
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: F0-G1
    description: O schema 0.3 valida o descritor witnesses, rejeita slots proibidos
      e kind inválido, e mantém 0.1/0.2 válidos; o validador reforça a
      integridade resolution.choice em witnesses.
    status: pending
    verifier:
      kind: shell
      command: node --test test/app-map/schema.test.js test/app-map/validate.test.js
      expectExitCode: 0
stack:
  - id: 1
    title: "Contrato: schema 0.3 + descritor witnesses"
    type: task
    openedAt: 2026-06-16T18:38:32.145Z
tasks:
  - id: T-001
    title: Schema 0.3 — conflict vira witnesses[]
    status: pending
    lastUpdated: 2026-06-16T18:38:32.145Z
  - id: T-002
    title: Validador — integridade de witnesses + resolution.choice
    status: pending
    lastUpdated: 2026-06-16T18:38:32.145Z
parked: []
emerged: []
planTitle: "app-map: descritor de conflito rico + canal de arbitragem"
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F0 — Contrato: schema 0.3 + descritor witnesses**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
