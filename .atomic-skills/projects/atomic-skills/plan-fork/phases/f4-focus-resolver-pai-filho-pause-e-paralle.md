---
schemaVersion: "0.1"
slug: plan-fork-f4-focus-resolver-pai-filho-pause-e-paralle
title: Focus-resolver pai/filho (pause e parallel)
goal: Fazer o resolver de foco tratar pai(paused)+filho(active) e
  pai(active)+filho(active) parallel como hierarquia, com precedência por
  worktree e aresta pai/filho.
status: active
branch: plan/plan-fork
started: 2026-06-20T09:51:26Z
lastUpdated: 2026-06-20T09:51:26Z
nextAction: "Phase-start gate F4: rodar `node scripts/list-lessons.js --phase
  F4` e dispor cada lesson reusable+open (Apply/Keep/Stale/Reject) — inclui
  L-001..L-003 da F3 (hard-gate cross-model, doc-contract tests,
  marker-before-mutation) — ANTES de codar. Depois T-001: Consciência pai/filho
  no emit-focus e reconcile-focus."
parentPlan: plan-fork
phaseId: F4
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: F4-G1
    description: Os casos pause(paused+active) e parallel(active+active) resolvem
      para o filho sem ambiguidade; os casos de foco existentes não regridem.
    status: pending
    verifier:
      kind: shell
      command: npm test
    verifierLabel: "shell: npm test"
stack:
  - id: 1
    title: Focus-resolver pai/filho (pause e parallel)
    type: task
    openedAt: 2026-06-19T15:32:29.603Z
tasks:
  - id: T-001
    title: Consciência pai/filho no emit-focus e reconcile-focus
    status: pending
    lastUpdated: 2026-06-19T15:32:29.603Z
    scopeBoundary:
      - apenas a regra de hierarquia pai/filho lida do sidecar; não alterar
        branch-match nem recência existentes.
    acceptance:
      - no caso pause (pai paused + filho active) e no caso parallel (pai active
        + filho active) o resolver escolhe o filho sem marcar ambiguidade
        multi-active; sem par forkado o comportamento fica inalterado.
    verifier:
      kind: shell
      command: npm test
    outputs:
      - kind: file
        path: scripts/emit-focus.js
      - kind: file
        path: scripts/reconcile-focus.js
    summary: Hierarquia pai/filho no emit/reconcile-focus (pause e parallel).
  - id: T-002
    title: Testes do resolver nos dois casos
    status: pending
    lastUpdated: 2026-06-19T15:32:29.603Z
    scopeBoundary:
      - apenas casos de teste; a lógica de produção é a T-001.
    acceptance:
      - teste vermelho antes da T-001 e verde depois, cobrindo emit-focus E
        reconcile-focus em pause(paused+active) e parallel(active+active), e
        confirmando que os casos de foco existentes não regridem.
    outputs:
      - kind: file
        path: tests/emit-focus.test.js
      - kind: file
        path: tests/reconcile-focus.test.js
    summary: "Testes do resolver (emit + reconcile): pause e parallel resolvem para
      o filho."
    verifier:
      kind: shell
      command: npm test
parked: []
emerged: []
summary: Resolver de foco trata pai/filho como hierarquia em pause e parallel.
planTitle: plan-fork — fases que viram planos-filho, com pausa/paralelo e retomada
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F4 — Focus-resolver pai/filho (pause e parallel)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
