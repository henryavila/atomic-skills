---
schemaVersion: "0.1"
slug: deadline-burnup-forecast-f1-closedat-forward-only-auditor-soft
title: "closedAt forward-only: auditor soft + emissão"
goal: tornar closedAt auditável (soft, mede a lacuna de instrumentação) e
  emiti-lo na projeção de task do dashboard, sem backfill cosmético e sem
  hard-gate ainda.
status: active
branch: plan/deadline-burnup-forecast
started: 2026-06-17T19:14:53Z
lastUpdated: 2026-06-17T19:14:53Z
nextAction: "Start F1/T-001: — Auditor da lacuna de instrumentação (find-unclosed-done.js)"
parentPlan: deadline-burnup-forecast
phaseId: F1
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: G-1
    description: closedAt é auditável (soft) e closedAt+lastUpdated são emitidos na
      projeção e admitidos no schema (sem drift, schema-drift no gate); nenhum
      closedAt retroativo é inventado.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/find-unclosed-done.test.js && node --test
        tests/emit-consumer-state.test.js && node --test
        tests/schema-drift.test.js
    verifierLabel: "shell: node --test tests/find-unclosed-done.test.js && node --test…"
stack:
  - id: 1
    title: "closedAt forward-only: auditor soft + emissão"
    type: task
    openedAt: 2026-06-17T12:06:57.781Z
tasks:
  - id: T-001
    title: — Auditor da lacuna de instrumentação
    status: pending
    lastUpdated: 2026-06-17T12:06:57.781Z
  - id: T-002
    title: — Emitir closedAt e lastUpdated na projeção de task
    status: pending
    lastUpdated: 2026-06-17T12:06:57.781Z
  - id: T-003
    title: — Admitir closedAt na projeção do schema emitido + rebuild do bundle
    status: pending
    lastUpdated: 2026-06-17T12:06:57.781Z
parked: []
emerged: []
summary: Torna closedAt auditável (soft) e o emite na projeção, sem backfill cosmético.
planTitle: Deadline Burn-up Forecast (Earned Value / SPI)
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F1 — closedAt forward-only: auditor soft + emissão**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
