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
lastUpdated: 2026-06-17T19:14:53Z
nextAction: "Start F0/T-004: — Harness de integração: a transição emite o evento (contrato da API appendCompletion)"
parentPlan: deadline-burnup-forecast
phaseId: F0
tasksDone: 3
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
    status: done
    closedAt: 2026-06-17T19:14:53Z
    lastUpdated: 2026-06-17T19:14:53Z
    verifier:
      kind: shell
      command: node --test tests/completion-event-schema.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-17T19:14:53Z
      passed: true
      exitCode: 0
      testsCollected: 8
      outputSummary: "node --test tests/completion-event-schema.test.js — 8 pass, 0 fail (re-run on MERGED primary 657de01)"
  - id: T-003
    title: — Emitir o evento nas transições done/phase-done/reconcile
    status: done
    closedAt: 2026-06-17T19:14:53Z
    lastUpdated: 2026-06-17T19:14:53Z
    verifier:
      kind: shell
      command: node --test tests/transition-emits.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-17T19:14:53Z
      passed: true
      exitCode: 0
      testsCollected: 5
      outputSummary: "node --test tests/transition-emits.test.js — 5 pass, 0 fail (re-run on MERGED primary 238f677); prose+detector reviewed by Opus (event model correct, per-block negatives)"
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
- **Narrative:** F0 (RED do forecast), **Mode 2 (Codex lane)** ativo e confirmado. **T-001** (Mode 1), **T-002** e **T-003** (Mode 2/Codex) fechadas com verifier no primary merged. tasksDone 3/4. Só falta **T-004** (contrato da API appendCompletion) — depois exit-gate G-1 + phase-done. Worktrees `dbf-t-002`/`dbf-t-003` mergeados e removidos. primary HEAD = 238f677.
- **Decision log:** (1) `event` é enum fechado 'task-done'|'phase-done'|'reconcile'; (2) `weight` default 1 + `weightBasis` 'count'|'proxy' congelado na captura (imutável, P2/D6); (3) `taskId` nullable+required no schema (phase-done não tem task); (4) validação ANTES de tocar o filesystem; (5) helper só escreve em `.atomic-skills/analytics/`; (6) **Mode 2:** Codex escreve só source no worktree, Opus dona toda transição de state, merge-back serial + re-verify no primary; (7) **completion-event.schema.json usa draft-07** (`ajv/dist/2020` NÃO instalado — Ajv default só carrega draft-07); (8) `validateCompletionEvent` é ADITIVO em validate-aideck-state.js — `validateAideckState` intocado.
- **Single nextAction:** Start F0/T-004 — criar `tests/emit-on-transition.test.js` (contrato da API `appendCompletion`: 1 done→1 task-done; phase-done de N→N task-done + 1 phase-done; reconcile→1 task-done; cada linha valida no completion-event.schema via `validateCompletionEvent`). Roteamento: spec-ready + verifier determinístico ⇒ Mode 2/Codex. É teste de contrato da API (NÃO da prosa), escreve só em jsonl de tmp.
- **Verbatim state:** primary HEAD = 238f677 (T-003 fechada). verifier T-004 = `node --test tests/emit-on-transition.test.js`. Files T-004: `tests/emit-on-transition.test.js` (create only). API: `appendCompletion(root, {event, projectId, planSlug, phaseId, taskId, weight?, weightBasis?})` em `scripts/append-completion.js`; schema em `validateCompletionEvent` de `scripts/validate-aideck-state.js`. Exit-gate G-1 verifier roda os 4 test files.
- **Uncommitted changes:** state transition T-003 (este phase file + dispatch-log.json) — a commitar agora.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
