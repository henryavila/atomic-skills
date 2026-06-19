---
schemaVersion: "0.1"
slug: plan-fork-f2-protocolo-de-estado-parallel-cross-workt
title: Protocolo de estado parallel cross-worktree
goal: "Definir e implementar o protocolo de estado do modo parallel com
  semântica de concorrência explícita: caminho canônico, escrita atômica com
  token de revisão, predicado de conflito, abort e recuperação, e verificação a
  partir do pai e do filho."
status: pending
branch: plan/plan-fork
started: 2026-06-19T15:32:29.603Z
lastUpdated: 2026-06-19T15:32:29.603Z
nextAction: "Start T-001: Especificar o protocolo de estado parallel
  (concorrência otimista)"
parentPlan: plan-fork
phaseId: F2
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: F2-G1
    description: "O protocolo de concorrência otimista está definido e testado: a
      escrita atinge o estado canônico do pai e edições concorrentes pai/filho
      são detectadas e abortadas sem lost update."
    status: pending
    verifier:
      kind: shell
      command: npm test
    verifierLabel: "shell: npm test"
stack:
  - id: 1
    title: Protocolo de estado parallel cross-worktree
    type: task
    openedAt: 2026-06-19T15:32:29.603Z
tasks:
  - id: T-001
    title: Especificar o protocolo de estado parallel (concorrência otimista)
    status: pending
    lastUpdated: 2026-06-19T15:32:29.603Z
    scopeBoundary:
      - apenas o modo parallel; o pause-mode não muda.
    acceptance:
      - o doc define qual worktree detém o estado canônico do pai, a leitura por
        revisão ou hash, a escrita atômica, o predicado de conflito exato, a
        condição de abort, o caminho de recuperação para o usuário, e a
        verificação a partir das duas worktrees.
    verifier:
      kind: shell
      command: test -f docs/design/plan-fork-parallel-state.md
    outputs:
      - kind: file
        path: docs/design/plan-fork-parallel-state.md
      - kind: file
        path: skills/shared/project-assets/project-emergence.md
    summary: "Spec do protocolo parallel: canônico, revisão, conflito, abort,
      recuperação."
  - id: T-002
    title: Implementar resolução canônica e writeback com concorrência otimista
    status: pending
    lastUpdated: 2026-06-19T15:32:29.603Z
    scopeBoundary:
      - apenas a resolução e o writeback do estado parallel; não tocar o
        pause-mode.
    acceptance:
      - dada uma worktree-filho, a função resolve o pai canônico mesmo em outra
        worktree e a escrita atinge o estado canônico via escrita atômica com
        token de revisão; edições simultâneas de pai e filho disparam o conflito
        (sem lost update) e abortam com caminho de recuperação; um teste simula
        a concorrência.
    outputs:
      - kind: file
        path: src/parallel-state.js
      - kind: file
        path: src/parallel-state.test.js
    summary: Resolução canônica + writeback atômico com concorrência otimista.
    verifier:
      kind: shell
      command: npm test
parked: []
emerged: []
summary: Protocolo de estado parallel com concorrência otimista (revisão,
  conflito, abort).
planTitle: plan-fork — fases que viram planos-filho, com pausa/paralelo e retomada
planActive: true
---

# Narrative / notes

Initiative for phase **F2 — Protocolo de estado parallel cross-worktree**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
