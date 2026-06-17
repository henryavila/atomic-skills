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
lastUpdated: 2026-06-17T18:07:35Z
nextAction: "Start T-001: — Helper append-completion + log JSONL"
parentPlan: deadline-burnup-forecast
phaseId: F0
tasksDone: 1
tasksTotal: 4
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: G-1
    description: o completions.jsonl recebe um evento imutável por conclusão,
      validado por schema (event enum), emitido pelas três transições — wiring
      estrutural (T-003 lint-transition-emits) E contrato da API (T-004
      emit-on-transition) verificados no gate.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/append-completion.test.js && node --test
        tests/completion-event-schema.test.js && node --test
        tests/emit-on-transition.test.js && node --test
        tests/transition-emits.test.js
    verifierLabel: "shell: node --test tests/append-completion.test.js && node --test …"
stack:
  - id: 1
    title: "Fonte de fluxo: evento done emitido na transição"
    type: task
    openedAt: 2026-06-17T12:06:57.781Z
tasks:
  - id: T-001
    title: — Helper append-completion + log JSONL
    status: done
    closedAt: 2026-06-17T18:28:40Z
    lastUpdated: 2026-06-17T18:28:40Z
    verifier:
      kind: shell
      command: node --test tests/append-completion.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-17T18:28:40Z
      passed: true
      exitCode: 0
      testsCollected: 9
      outputSummary: "node --test tests/append-completion.test.js — 9 pass, 0 fail"
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

## Session handoff
- **Narrative:** F0 (RED do forecast) em implementação, Mode 1 (sem routing.json). O plano foi re-specado 3× via cross-model review antes de começar (commits cede1c3/926a044/02fcf55). **T-001 fechada** (helper `appendCompletion` + log JSONL); T-002/T-003/T-004 pending.
- **Decision log:** (1) `event` é enum fechado 'task-done'|'phase-done'|'reconcile'; (2) `weight` default 1 + `weightBasis` 'count'|'proxy' congelado na captura (imutável, P2/D6); (3) `taskId` default null (phase-done não tem task); (4) validação ANTES de tocar o filesystem (rejeição não escreve nada); (5) o helper só escreve em `.atomic-skills/analytics/`, nunca `.md`.
- **Single nextAction:** Start F0/T-002 — `meta/schemas/completion-event.schema.json` (event enum + weightBasis enum + sub-objeto `actuals` opcional pré-declarado, additionalProperties:false) + ligar ao `validate-aideck-state.js`; TDD via `tests/completion-event-schema.test.js`.
- **Verbatim state:** verifier T-001 `node --test tests/append-completion.test.js` → 9 pass, 0 fail (evidence.passed:true, testsCollected:9). Arquivos: `scripts/append-completion.js`, `tests/append-completion.test.js`. `validate-state` 7/7, `validate-aideck-state` ok.
- **Uncommitted changes:** committed (ver commit de T-001); tree clean após o commit.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
