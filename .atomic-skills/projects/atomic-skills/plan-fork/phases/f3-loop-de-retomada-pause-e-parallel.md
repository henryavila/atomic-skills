---
schemaVersion: "0.1"
slug: plan-fork-f3-loop-de-retomada-pause-e-parallel
title: Loop de retomada (pause e parallel)
goal: Na conclusão/archive do filho, oferecer retomar o pai na fase-âncora em
  ambos os modos, com semântica determinística para aceitar, recusar, sem TTY e
  writeback falho.
status: active
branch: plan/plan-fork
started: 2026-06-20T01:33:14Z
lastUpdated: 2026-06-20T01:33:14Z
nextAction: "Phase-start gate F3: rodar `node scripts/list-lessons.js --phase F3`
  e dispor cada lesson reusable+open (Apply/Keep/Stale/Reject) — inclui L-001..L-005
  da F2 (writebackOrDefer, pendingWriteback, stale-lock, --mode=both) — ANTES de codar.
  Depois T-001: detecção de spawnedFrom no archive-propagation."
parentPlan: plan-fork
phaseId: F3
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: F3-G1
    description: Aceitar, recusar, sem-TTY e writeback-falho têm semântica
      determinística em pause E parallel; nenhum caso deixa o filho arquivado
      com o pai num estado inconsistente. Ordem de transação — o writeback do
      pai precede a finalização do archive; em writeback falho o archive
      persiste um pending-resume durável e o filho não finaliza até a
      recuperação.
    status: pending
    verifier:
      kind: shell
      command: npm test
    verifierLabel: "shell: npm test"
stack:
  - id: 1
    title: Loop de retomada (pause e parallel)
    type: task
    openedAt: 2026-06-19T15:32:29.603Z
tasks:
  - id: T-001
    title: Detecção de spawnedFrom no archive-propagation
    status: pending
    lastUpdated: 2026-06-19T15:32:29.603Z
    scopeBoundary:
      - estender o passo de archive; não mexer no fluxo de pausa (o switch já
        cobre).
    acceptance:
      - o passo de archive lê o elo do sidecar do filho e imprime a oferta de
        retomada do pai na âncora; opt-in, nunca automática.
    verifier:
      kind: shell
      command: grep -q spawnedFrom skills/shared/project-assets/project-transitions.md
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
    summary: Lê o elo no archive e oferece retomar o pai.
  - id: T-002
    title: Retomada determinística nos dois modos e nos casos de borda
    status: pending
    lastUpdated: 2026-06-19T15:32:29.603Z
    scopeBoundary:
      - a aplicação da retomada; em parallel reusa o writeback da F2; em pause
        reusa refresh-state.
    acceptance:
      - aceitar retoma o pai (status active, fase-âncora active, currentPhase
        igual ao id da âncora); recusar deixa um pending-resume durável; sem TTY
        registra o pending-resume sem prompt; writeback falho em parallel aborta
        com sinal de recuperação e não arquiva o filho silenciosamente; testes
        cobrem os quatro casos em pause e parallel.
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
      - kind: file
        path: src/parallel-state.test.js
    summary: "Retomada determinística: aceitar/recusar/sem-TTY/writeback falho, nos
      dois modos."
    verifier:
      kind: shell
      command: npm test
parked: []
emerged: []
summary: Retomada determinística do pai (aceitar/recusar/sem-TTY/writeback falho).
planTitle: plan-fork — fases que viram planos-filho, com pausa/paralelo e retomada
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F3 — Loop de retomada (pause e parallel)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
