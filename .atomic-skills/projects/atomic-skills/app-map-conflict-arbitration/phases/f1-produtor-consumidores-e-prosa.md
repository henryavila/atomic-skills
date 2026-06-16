---
schemaVersion: "0.1"
slug: app-map-conflict-arbitration-f1-produtor-consumidores-e-prosa
title: Produtor, consumidores e prosa
goal: O produtor emite witnesses[] com kind derivado-na-origem e resolution por
  valor+source; o mirror .md lista as N testemunhas; a prosa do §2 do
  design-brief deixa de prometer um --persist que persiste arbitragem; cobertura
  inclui o caso N≥3.
status: pending
branch: plan/design-brief
started: 2026-06-16T18:38:32.145Z
lastUpdated: 2026-06-16T18:38:32.145Z
nextAction: "Start T-001: Produtor — conflictForField emite witnesses[] e catálogo 0.3"
parentPlan: app-map-conflict-arbitration
phaseId: F1
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: F1-G1
    description: A reconstrução end-to-end emite witnesses 0.3 com N≥3 preservado e
      validável; o mirror lista as testemunhas; a prosa do §2 reflete a
      arbitragem programático-only.
    status: pending
    verifier:
      kind: shell
      command: node --test test/app-map/reconstruct.test.js test/app-map/persist.test.js
      expectExitCode: 0
stack:
  - id: 1
    title: Produtor, consumidores e prosa
    type: task
    openedAt: 2026-06-16T18:38:32.145Z
tasks:
  - id: T-001
    title: Produtor — conflictForField emite witnesses[] e catálogo 0.3
    status: pending
    lastUpdated: 2026-06-16T18:38:32.145Z
  - id: T-002
    title: Consumidores — mirror .md das N testemunhas + prosa §2
    status: pending
    lastUpdated: 2026-06-16T18:38:32.145Z
parked: []
emerged: []
planTitle: "app-map: descritor de conflito rico + canal de arbitragem"
planActive: true
---

# Narrative / notes

Initiative for phase **F1 — Produtor, consumidores e prosa**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
