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
nextAction: "Start F0/T-003: — Emitir o evento nas transições done/phase-done/reconcile (+ detector estrutural)"
parentPlan: deadline-burnup-forecast
phaseId: F0
tasksDone: 2
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
- **Narrative:** F0 (RED do forecast), **Mode 2 (Codex lane)** ativo e confirmado pelo operador. **T-001 fechada** (Mode 1) e **T-002 fechada** (Mode 2/Codex): schema do evento de conclusão + `validateCompletionEvent`. tasksDone 2/4. T-003 (emitir nas transições + detector estrutural) e T-004 (contrato da API) pending. Worktree `dbf-t-002` mergeado e removido.
- **Decision log:** (1) `event` é enum fechado 'task-done'|'phase-done'|'reconcile'; (2) `weight` default 1 + `weightBasis` 'count'|'proxy' congelado na captura (imutável, P2/D6); (3) `taskId` nullable+required no schema (phase-done não tem task); (4) validação ANTES de tocar o filesystem; (5) helper só escreve em `.atomic-skills/analytics/`; (6) **Mode 2:** Codex escreve só source no worktree, Opus dona toda transição de state, merge-back serial + re-verify no primary; (7) **completion-event.schema.json usa draft-07** (`ajv/dist/2020` NÃO instalado — Ajv default só carrega draft-07); (8) `validateCompletionEvent` é ADITIVO em validate-aideck-state.js — `validateAideckState` intocado.
- **Single nextAction:** Start F0/T-003 — editar `skills/shared/project-assets/project-transitions.md` (instruir emit nos 3 blocos done/phase-done/reconcile) + criar detector `scripts/lint-transition-emits.js` + `tests/transition-emits.test.js`. Roteamento: spec-ready + verifier determinístico ⇒ Mode 2/Codex (default). NOTA: T-003 toca prosa de skill (project-transitions.md) — avaliar F1 spec-readiness antes de dispachar.
- **Verbatim state:** primary HEAD após merge+done = a commitar (merge de Codex foi `657de01`). verifier T-002 `node --test tests/completion-event-schema.test.js` → 8 pass, 0 fail (re-run no MERGED primary 657de01; evidence.passed:true, testsCollected:8). Files T-002: `meta/schemas/completion-event.schema.json`, `scripts/validate-aideck-state.js`, `tests/completion-event-schema.test.js`. validate-state GATE-R2 ✓ no phase file.
- **Uncommitted changes:** state transition T-002 (este phase file + `.atomic-skills/status/dispatch-log.json`) — a commitar agora junto com o merge do Codex (657de01 já na branch).

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
