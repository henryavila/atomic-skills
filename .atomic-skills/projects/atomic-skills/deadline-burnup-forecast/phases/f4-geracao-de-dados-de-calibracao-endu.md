---
schemaVersion: "0.1"
slug: deadline-burnup-forecast-f4-geracao-de-dados-de-calibracao-endu
title: Geração de dados de calibração + endurecer closedAt
goal: "gravar os actuals crus por conclusão (calibração: só geração, tratamento
  depois) e promover closedAt de soft para hard no GATE-R2 quando a lacuna de
  instrumentação chegar perto de zero."
status: pending
branch: plan/deadline-burnup-forecast
started: 2026-06-17T12:06:57.781Z
lastUpdated: 2026-06-17T16:06:30Z
nextAction: "Start T-001: — Actuals de fase no evento phase-done"
parentPlan: deadline-burnup-forecast
phaseId: F4
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: G-1
    description: actuals crus são gravados por conclusão (no sub-objeto já admitido)
      e closedAt é hard-gated forward-only via corte persistido
      (grandfatheredTaskIds), sem rejeitar legado.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/append-completion-actuals.test.js && node --test
        tests/validate-state.test.js && node --test tests/schema-drift.test.js
    verifierLabel: "shell: node --test tests/append-completion-actuals.test.js && node…"
stack:
  - id: 1
    title: Geração de dados de calibração + endurecer closedAt
    type: task
    openedAt: 2026-06-17T12:06:57.781Z
tasks:
  - id: T-001
    title: — Actuals de fase no evento phase-done
    status: pending
    lastUpdated: 2026-06-17T12:06:57.781Z
  - id: T-002
    title: — Actuals de task via dispatch-log quando presente
    status: pending
    lastUpdated: 2026-06-17T12:06:57.781Z
  - id: T-003
    title: — Promover closedAt para hard-gate no GATE-R2
    status: pending
    lastUpdated: 2026-06-17T12:06:57.781Z
parked: []
emerged: []
summary: Grava os actuals crus por conclusão (calibração futura) e endurece
  closedAt forward-only.
planTitle: Deadline Burn-up Forecast (Earned Value / SPI)
planActive: true
---

# Narrative / notes

Initiative for phase **F4 — Geração de dados de calibração + endurecer closedAt**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
