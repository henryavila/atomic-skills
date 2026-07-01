---
schemaVersion: "0.1"
slug: phase-materialization-f5-testes-end-to-end-docs-auto-dogfood-re
title: Testes end-to-end + docs + auto-dogfood/review
goal: Fechar com testes de integração do fluxo completo (new plan → lazy →
  materialize → gate → tasks → phase-done advance), atualização de docs e o
  auto-dogfood do próprio mecanismo. D9 (gate-como-hipótese) é postura declarada
  no design, não código — fica documentada, não implementada como instrumento
  (não-entregável). D10 (constituição de anti-patterns) é non-goal explícito
  (iniciativa separada).
status: active
branch: plan/phase-materialization
started: 2026-06-29T13:19:41.314Z
lastUpdated: 2026-07-01T18:27:56.000Z
nextAction: "Start T-012: Teste de integração do fluxo completo (new plan → lazy
  → materialize → advance)"
parentPlan: phase-materialization
phaseId: F5
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
weightDone: 0
weightTotal: 3
exitGates:
  - id: F5-G1
    description: Suíte completa verde (npm test) e fluxo e2e new plan → materialize
      → advance coberto por teste
    status: pending
    verifier:
      kind: shell
      command: npm test
      expectExitCode: 0
    verifierLabel: "shell: npm test"
  - id: F5-G2
    description: Docs refletem o comportamento lazy e declaram D9 (hipótese) + D10
      (non-goal); auto-dogfood do mecanismo no próprio plano
    status: pending
    verifier:
      kind: manual
      description: Revisar CLAUDE.md + docs/kb; confirmar que o verbo materialize e a
        distinção descriptor-only estão documentados e D9/D10 registrados como
        postura/non-goal
    verifierLabel: manual
stack:
  - id: 1
    title: Testes end-to-end + docs + auto-dogfood/review
    type: task
    openedAt: 2026-06-29T13:19:41.314Z
tasks:
  - id: T-012
    title: Teste de integração do fluxo completo (new plan → lazy → materialize →
      advance)
    description: "Adiciona um teste end-to-end em
      `tests/phase-materialization/e2e-lifecycle.test.js` que exercita o fluxo
      inteiro: `new plan` (via `decomposePlan`+`materializeDecomposition`) sobre
      um source com F0+F1+F2 produz só o initiative de F0 + descritores F1/F2;
      simula `materialize F1` (gate de businessIntent + decomposeOnePhase +
      write + detector exit 0); valida que `phases/f1-*.md` é escrito com tasks
      + businessIntent e F1 vira `active`. Cobre o caminho feliz; não testa
      eficácia anti-rubber-stamp (D9 = hipótese não-provada, contrafactual
      inobservável)."
    status: pending
    lastUpdated: 2026-06-29T13:19:41.314Z
    scopeBoundary:
      - novo arquivo de teste e2e + fixtures sob
        `tests/phase-materialization/fixtures/`; NÃO alterar código prod (este
        teste consome a API estável)
    acceptance:
      - o teste e2e passa verde sobre o fluxo new plan → lazy descriptors →
        materialize F1 → initiative escrita → F1 active; falha (regression
        guard) se `materializeDecomposition` voltar a materializar todas as
        fases
      - "F4/L-001 applied: the e2e lifecycle test must validate the mutated plan
        state and guard that phase descriptors do not receive schema-invalid
        timestamp fields; timestamps belong at plan root or initiative level."
    verifier:
      kind: test
      runner: node --test
      pattern: tests/phase-materialization/e2e-lifecycle.test.js
    outputs:
      - kind: file
        path: tests/phase-materialization/e2e-lifecycle.test.js
    summary: "Teste e2e: new plan → descritores lazy → materialize F1 → initiative
      com tasks → F1 active."
    weight: 2
  - id: T-013
    title: "Docs: CLAUDE.md + kb + declaration da postura D9/D10 non-goals"
    description: "Atualiza a documentação para refletir o novo comportamento: (a)
      `skills/core/project.md` (router) já menciona o verbo `materialize`
      (F3/T-008); (b) um nota curta em `CLAUDE.md` (seção `## Rastreamento de
      iniciativas`) ou `docs/kb/` descrevendo que `new plan` agora materializa
      lazy (F0 ativa, F1..N descriptor-only até `materialize`); (c) registra a
      **postura D9** (gate-como-hipótese, instrumento Open, não-entregável) e o
      **non-goal D10** (constituição de anti-patterns = iniciativa separada) no
      plano/ docs para que não sejam esquecidos como pendências implícitas."
    status: pending
    lastUpdated: 2026-06-29T13:19:41.314Z
    scopeBoundary:
      - a seção de rastreamento em CLAUDE.md + novo doc kb; NÃO alterar
        schemas/scripts/skill-assets de fluxo (apenas docs)
    acceptance:
      - CLAUDE.md descreve o comportamento lazy; o doc kb explica
        descriptor-only vs materializada + o verbo materialize + a postura D9 e
        non-goal D10; `npm run validate-skills` verde
    verifier:
      kind: shell
      command: npm run validate-skills
      expectExitCode: 0
    outputs:
      - kind: file
        path: CLAUDE.md
      - kind: file
        path: docs/kb/project-lazy-materialization.md
    summary: Docs (CLAUDE.md + kb) descrevem o lazy e registram D9 (hipótese) e D10
      (non-goal).
    weight: 1
parked: []
emerged: []
summary: Teste e2e do fluxo completo + docs que declaram a postura D9 (hipótese)
  e o non-goal D10 (constituição separada).
planTitle: Materialização lazy de fases + gate de validação de negócio
planActive: true
current: true
---


# Narrative / notes

Initiative for phase **F5 — Testes end-to-end + docs + auto-dogfood/review**.

## Decisions

- **Phase-start lessons gate executado para F5.** F4/L-001 Apply em T-012: o e2e lifecycle deve validar o estado mutado e guardar contra `lastUpdated` schema-invalid dentro de `phases[]`.

## Links

_(plan doc, external refs)_

