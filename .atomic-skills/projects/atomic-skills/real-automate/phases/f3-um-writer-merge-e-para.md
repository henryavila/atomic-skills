---
schemaVersion: "0.1"
slug: real-automate-f3-um-writer-merge-e-para
title: Um writer, merge, e para
goal: |
  com caneta, flow, revisão, ground truth, cartão e protótipo válidos, o
  programa cria o worktree, grava o pen.lock com dono e pid, dispara um
  writer do CLI do host, integra no branch do plano, mata o writer se ainda
  viver e solta o lock. O teste deste marco para depois do merge. Não roda
  review nem audit e não abre a fase seguinte, porque isso é a F4.
status: active
branch: plan/real-automate
started: 2026-10-02T12:30:00.000Z
lastUpdated: 2026-10-02T12:30:00.000Z
nextAction: Start T-001 Lock na partida real
parentPlan: real-automate
phaseId: F3
businessIntent:
  value: |
    Com caneta, flow, revisão, ground truth, cartão e protótipo válidos, o
    programa cria o worktree, grava pen.lock com dono, pid e writerWorktree,
    dispara um writer do CLI do host, integra no branch do plano, mata o
    writer se ainda viver e solta o lock.
  workflow: |
    scripts/automate-run.js, depois dos seis gates, cria o worktree do writer,
    escreve .atomic-skills/status/automate/pen.lock, spawna claude ou codex ou
    grok nesse worktree com lease, espera, faz merge no branch do plano, mata
    o writer se o pid ainda viver, apaga o lock inclusive em falha. Não chama
    scripts/automate-phase-run.js. O teste do marco para depois do merge.
  rules: |
    A sessão do chat não é o writer. O shell da sessão fica negado. Quem roda
    verifier é o programa. Lock de pid morto não bloqueia a sessão. Esta fase
    não roda phase-done, review both, nem audit. A sessão não grava lastAssert.
  outOfScope: |
    Fechamento de fase, claim e src/automate-product-fence.js (F4). Página
    final (F5). Não materializa a fase seguinte. Não chama
    scripts/automate-phase-run.js.
  doneWhen: |
    Um teste de integração com host falso sai 0, o arquivo que o writer gravou
    está no branch do plano, e uma segunda fase não foi materializada.
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
weightDone: 0
weightTotal: 3
exitGates:
  - id: G-1
    description: um teste de integração com host falso sai 0, o arquivo do writer
      está no branch do plano, e uma segunda fase não foi materializada.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/automate-run-writer.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/automate-run-writer.test.js"
stack:
  - id: 1
    title: Um writer, merge, e para
    type: task
    openedAt: 2026-10-02T12:30:00.000Z
tasks:
  - id: T-001
    title: Lock na partida real
    description: Quando os seis gates passam, o programa escreve pen.lock com dono,
      pid e writerWorktree. Mata o writer se ainda viver antes de soltar o lock.
      Pid morto não bloqueia a sessão. Quem roda verifier é o programa. Apaga o
      lock ao sair, inclusive em falha.
    status: pending
    lastUpdated: 2026-10-02T12:30:00.000Z
    outputs:
      - kind: file
        path: scripts/automate-run.js
      - kind: file
        path: tests/automate-run-writer.test.js
    scopeBoundary:
      - Do not call scripts/automate-phase-run.js.
      - Do not run phase-done, review both, or audit-delivery (F4).
      - Do not materialize the next phase.
    acceptance:
      - it - pen.lock exists during spawn with owner, pid, writerWorktree.
      - it - lock is gone after exit, including failure.
      - it - dead pid does not block a later session.
    verifier:
      kind: shell
      command: node --test tests/automate-run-writer.test.js
      expectExitCode: 0
  - id: T-002
    title: Spawn do host
    description: Um subprocesso claude, codex ou grok no worktree, com lease. A
      sessão do chat não é o writer. O worktree nasce em
      scripts/automate-run.js, não em scripts/automate-phase-run.js.
    status: pending
    lastUpdated: 2026-10-02T12:30:00.000Z
    outputs:
      - kind: file
        path: scripts/automate-run.js
      - kind: file
        path: tests/automate-run-writer.test.js
    scopeBoundary:
      - Do not use the chat session as the writer.
      - Do not create the worktree in scripts/automate-phase-run.js.
    acceptance:
      - it - fake host CLI writes a file inside the writer worktree.
      - it - worktree is created from scripts/automate-run.js.
    verifier:
      kind: shell
      command: node --test tests/automate-run-writer.test.js
      expectExitCode: 0
  - id: T-003
    title: Merge e pare
    description: O teste deste marco integra no branch do plano e sai sem
      phase-done. O fechamento real, o claim e src/automate-product-fence.js são
      a F4.
    status: pending
    lastUpdated: 2026-10-02T12:30:00.000Z
    outputs:
      - kind: file
        path: scripts/automate-run.js
      - kind: file
        path: tests/automate-run-writer.test.js
    scopeBoundary:
      - Do not call phase-done.
      - Do not write lastAssert from the chat session.
      - Do not materialize a second phase.
    acceptance:
      - it - plan branch contains the writer commit.
      - it - process exits 0 once after merge.
      - it - a second phase was not materialized.
    verifier:
      kind: shell
      command: node --test tests/automate-run-writer.test.js
      expectExitCode: 0
parked: []
emerged: []
planTitle: real-automate
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F3 — Um writer, merge, e para**.

Lessons applied at start: L-F2-1 (cited path/lock must fail closed), L-F2-2 (do not inflate automate-run.js).
