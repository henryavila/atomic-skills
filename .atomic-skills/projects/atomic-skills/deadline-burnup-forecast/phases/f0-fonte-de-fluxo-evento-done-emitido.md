---
schemaVersion: "0.1"
slug: deadline-burnup-forecast-f0-fonte-de-fluxo-evento-done-emitido
title: "Fonte de fluxo: evento done emitido na transição"
goal: criar o log append-only de conclusões (completions.jsonl) e fazer os
  passos done/phase-done/reconcile emitirem um evento imutável por conclusão,
  com schema validado. Este é o RED da feature (sem isso não há curva earned).
status: active
branch: plan/deadline-burnup-forecast
started: 2026-06-17T12:06:57.781Z
lastUpdated: 2026-06-17T17:01:39Z
nextAction: "Start T-001: — Helper append-completion + log JSONL"
parentPlan: deadline-burnup-forecast
phaseId: F0
tasksDone: 0
tasksTotal: 4
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: G-1
    description: o completions.jsonl recebe um evento imutável por conclusão,
      validado por schema, emitido pelas três transições — wiring da prosa
      (T-003 grep) E emissão comportamental (T-004 emit-on-transition) ambos
      verificados no gate.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/append-completion.test.js && node --test
        tests/completion-event-schema.test.js && node --test
        tests/emit-on-transition.test.js && grep -c "append-completion"
        skills/shared/project-assets/project-transitions.md | grep -qE
        "^[3-9]|[0-9]{2,}"
    verifierLabel: "shell: node --test tests/append-completion.test.js && node --test …"
stack:
  - id: 1
    title: "Fonte de fluxo: evento done emitido na transição"
    type: task
    openedAt: 2026-06-17T12:06:57.781Z
tasks:
  - id: T-001
    title: — Helper append-completion + log JSONL
    status: pending
    lastUpdated: 2026-06-17T12:06:57.781Z
  - id: T-002
    title: — Schema do evento de conclusão + validação
    status: pending
    lastUpdated: 2026-06-17T12:06:57.781Z
  - id: T-003
    title: — Emitir o evento nas transições done/phase-done/reconcile
    status: pending
    lastUpdated: 2026-06-17T12:06:57.781Z
  - id: T-004
    title: "— Harness de integração: a transição emite o evento (prova do RED)"
    status: pending
    lastUpdated: 2026-06-17T12:06:57.781Z
parked: []
emerged: []
summary: Cria o log append-only de conclusões e faz a transição done emitir o
  evento — o RED do forecast.
planTitle: Deadline Burn-up Forecast (Earned Value / SPI)
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F0 — Fonte de fluxo: evento done emitido na transição**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
