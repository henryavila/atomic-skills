---
schemaVersion: "0.1"
slug: deadline-burnup-forecast-f3-serie-earned-vs-planned-deadline-wi
title: Série earned-vs-planned + deadline + wiring de recompute
goal: adicionar plan.deadline, computar a série burn-up (earned acumulado vs
  linha planejada linear) e o SPI no emit, e ligar o recompute ao refresh-state
  (fechando o gap em que ele só chama emitFocus).
status: pending
branch: plan/deadline-burnup-forecast
started: 2026-06-17T12:06:57.781Z
lastUpdated: 2026-06-17T12:06:57.781Z
nextAction: "Start T-001: — Campo deadline no plano + rebuild do bundle"
parentPlan: deadline-burnup-forecast
phaseId: F3
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: G-1
    description: a série earned-vs-planned + SPI é emitida e recomputada
      automaticamente pelo refresh-state, com deadline no schema.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/emit-series.test.js && node --test
        tests/refresh-state.test.js
stack:
  - id: 1
    title: Série earned-vs-planned + deadline + wiring de recompute
    type: task
    openedAt: 2026-06-17T12:06:57.781Z
tasks:
  - id: T-001
    title: — Campo deadline no plano + rebuild do bundle
    status: pending
    lastUpdated: 2026-06-17T12:06:57.781Z
  - id: T-002
    title: "— buildSeries: burnup.json + spi.json"
    status: pending
    lastUpdated: 2026-06-17T12:06:57.781Z
  - id: T-003
    title: — Ligar emit ao refresh-state sem regredir emitFocus
    status: pending
    lastUpdated: 2026-06-17T12:06:57.781Z
parked: []
emerged: []
summary: Computa a série earned-vs-planejada e o SPI contra o deadline,
  recomputada no refresh-state.
---

# Narrative / notes

Initiative for phase **F3 — Série earned-vs-planned + deadline + wiring de recompute**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
