---
schemaVersion: "0.1"
slug: worktree-lifecycle-finalization-f6-backstop-read-only-no-projec
title: Backstop read-only no project verify (Decisão 6)
goal: adicionar um 9º check read-only ao `project verify` (após os 8 atuais) que
  deriva live de `git worktree list --porcelain` + `merge-base` + status do
  plano e sinaliza em WARN os órfãos do modelo PR→develop (worktree viva de
  feature já mergeada; branch de plano arquivado nunca PR-ada ou PR aberto e
  nunca mergeado); o classificador topology-aware auto-ordenador fica DEFERIDO.
status: pending
branch: plan/worktree-lifecycle-finalization
started: 2026-06-16T22:50:35.627Z
lastUpdated: 2026-06-16T22:50:35.627Z
nextAction: "Start T-001: Check #9 de backstop de órfãos PR→develop"
parentPlan: worktree-lifecycle-finalization
phaseId: F6
tasksDone: 0
tasksTotal: 1
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: G-1
    description: Backstop sinaliza WARN para worktree de feature mergeada e branch
      arquivada não-integrada; read-only, inputs não mutados; suite verde.
    status: pending
    verifier:
      kind: test
      runner: node
      pattern: tests/detect-orphan-worktrees.test.js
    verifierLabel: "test: node tests/detect-orphan-worktrees.test.js"
  - id: G-2
    description: "project-verify.md lista o check #9 (âncora
      detect-orphan-worktrees) e validate-skills passa."
    status: pending
    verifier:
      kind: shell
      command: grep -q 'detect-orphan-worktrees'
        skills/shared/project-assets/project-verify.md && npm run
        validate-skills
    verifierLabel: "shell: grep -q 'detect-orphan-worktrees' skills/shared/project-ass…"
stack:
  - id: 1
    title: Backstop read-only no project verify (Decisão 6)
    type: task
    openedAt: 2026-06-16T22:50:35.627Z
tasks:
  - id: T-001
    title: "Check #9 de backstop de órfãos PR→develop"
    status: pending
    lastUpdated: 2026-06-16T22:50:35.627Z
    summary: "Check #9: detecta worktree de feature mergeada e branch arquivada
      não-integrada (WARN)."
    outputs:
      - kind: file
        path: scripts/detect-orphan-worktrees.js
      - kind: test
        path: tests/detect-orphan-worktrees.test.js
      - kind: file
        path: skills/shared/project-assets/project-verify.md
    scopeBoundary:
      - read-only — NUNCA muta nem remove
      - SEM campo novo em `focus.json`
      - SEM hook
      - NÃO promover a FAIL (v1 é WARN)
      - não tocar os 8 checks existentes
      - NÃO implementar o classificador topology-aware auto-ordenador (deferido).
    acceptance:
      - "`findOrphanWorktrees` sinaliza em WARN uma worktree viva de uma feature
        já mergeada no `integrationRef` (teardown pendente)"
      - sinaliza em WARN uma branch de plano arquivado nunca PR-ada ou com PR
        aberto e nunca mergeado
      - retorna vazio para um estado limpo/ativo
      - nunca muta os inputs (função pura sobre worktrees parseadas + status de
        planos + predicado de ancestralidade injetado)
      - "`project-verify.md` lista o check #9 após os 8 atuais com a âncora
        `detect-orphan-worktrees`."
    verifier:
      kind: test
      runner: node
      pattern: tests/detect-orphan-worktrees.test.js
parked: []
emerged: []
summary: 9º check read-only no project verify avisa (WARN) órfãos do modelo PR→develop.
planTitle: Finalização do ciclo de vida da worktree-do-plano
planActive: true
---

# Narrative / notes

Initiative for phase **F6 — Backstop read-only no project verify (Decisão 6)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
