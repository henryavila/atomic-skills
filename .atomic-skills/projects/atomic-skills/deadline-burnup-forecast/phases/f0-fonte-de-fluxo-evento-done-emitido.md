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
nextAction: "All F0 tasks done — run phase-done (exit-gate G-1 + review-code gate) to advance the plan to F1"
parentPlan: deadline-burnup-forecast
phaseId: F0
tasksDone: 4
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
    status: done
    closedAt: 2026-06-17T19:14:53Z
    lastUpdated: 2026-06-17T19:14:53Z
    verifier:
      kind: shell
      command: node --test tests/emit-on-transition.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-17T19:14:53Z
      passed: true
      exitCode: 0
      testsCollected: 3
      outputSummary: "node --test tests/emit-on-transition.test.js — 3 pass, 0 fail (re-run on MERGED primary 8741d48); real appendCompletion+validateCompletionEvent, cardinality N task-done+1 phase-done asserted"
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
- **Narrative:** F0 (RED do forecast) — **TODAS as 4 tasks fechadas** (T-001 Mode 1; T-002/T-003/T-004 Mode 2/Codex), cada uma com verifier re-run no primary merged. tasksDone 4/4. **Exit-gate G-1 verde** (25 testes nos 4 files, exit 0). **No phase boundary**: aguardando opt-in do operador para `phase-done` (que dispara o review-code gate obrigatório + lessons + advance para F1). primary HEAD = 8741d48 (+ commit de state pendente).
- **Decision log:** (1) `event` é enum fechado 'task-done'|'phase-done'|'reconcile'; (2) `weight` default 1 + `weightBasis` 'count'|'proxy' congelado na captura (imutável, P2/D6); (3) `taskId` nullable+required no schema (phase-done não tem task); (4) validação ANTES de tocar o filesystem; (5) helper só escreve em `.atomic-skills/analytics/`; (6) **Mode 2:** Codex escreve só source no worktree, Opus dona toda transição de state, merge-back serial + re-verify no primary; (7) **completion-event.schema.json usa draft-07** (`ajv/dist/2020` NÃO instalado — Ajv default só carrega draft-07); (8) `validateCompletionEvent` é ADITIVO em validate-aideck-state.js — `validateAideckState` intocado.
- **Single nextAction:** Aguardar decisão do operador sobre `phase-done` de F0. Se sim: rodar phase-done (exit gate G-1 já verde; review-code no range `started→HEAD`; distill lessons; advance currentPhase→F1; materializar a initiative de F1). Se não: parar com F0 100% pronta para o gate.
- **Verbatim state:** primary HEAD = 8741d48 (T-004 mergeada). Exit-gate G-1 verifier = `node --test tests/append-completion.test.js && node --test tests/completion-event-schema.test.js && node --test tests/emit-on-transition.test.js && node --test tests/transition-emits.test.js` → 25 pass (9+8+3+5), exit 0. F0 diff range para review-code: closest commit before phase.started (2026-06-17T12:06:57Z) .. HEAD.
- **Uncommitted changes:** state transition T-004 (este phase file + dispatch-log.json) — a commitar agora.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
