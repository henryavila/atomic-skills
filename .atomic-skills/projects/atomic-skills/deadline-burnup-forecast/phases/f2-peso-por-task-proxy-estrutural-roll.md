---
schemaVersion: "0.1"
slug: deadline-burnup-forecast-f2-peso-por-task-proxy-estrutural-roll
title: "Peso por task: proxy estrutural + rollups"
goal: introduzir tasks[].weight (number, opcional, default=1) AUTORADO pelo modelo no
  Stage 6 da decomposição (prosa, como os summaries; NUNCA por src/decompose.js
  congelado) de sinais estruturais e auditor-enforced, com rollups
  weightDone/weightTotal espelhando tasksDone/tasksTotal.
status: active
branch: plan/deadline-burnup-forecast
started: 2026-06-19T11:20:50Z
lastUpdated: 2026-06-19T11:20:50Z
nextAction: "Start T-001: — Campo weight no schema da task + rebuild do bundle"
parentPlan: deadline-burnup-forecast
phaseId: F2
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: G-1
    description: weight existe no schema (task) e weightDone/weightTotal são
      admitidos (source + projeção), somados em rollups e emitidos sem drift,
      com auditor de backfill.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/schema-drift.test.js && node --test
        tests/compute-rollups.test.js && node --test
        tests/emit-consumer-state.test.js
    verifierLabel: "shell: node --test tests/schema-drift.test.js && node --test tests…"
stack:
  - id: 1
    title: "Peso por task: proxy estrutural + rollups"
    type: task
    openedAt: 2026-06-17T12:06:57.781Z
tasks:
  - id: T-001
    title: — Campo weight no schema da task + rebuild do bundle
    status: pending
    lastUpdated: 2026-06-17T12:06:57.781Z
  - id: T-002
    title: — Rollups weightDone/weightTotal
    status: pending
    lastUpdated: 2026-06-17T12:06:57.781Z
  - id: T-003
    title: — Auditor de tasks sem weight (backfill replicável)
    status: pending
    lastUpdated: 2026-06-17T12:06:57.781Z
parked: []
emerged: []
summary: Dá peso de complexidade a cada task (proxy automático) e soma em
  rollups weightDone/Total.
planTitle: Deadline Burn-up Forecast (Earned Value / SPI)
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F2 — Peso por task: proxy estrutural + rollups**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
