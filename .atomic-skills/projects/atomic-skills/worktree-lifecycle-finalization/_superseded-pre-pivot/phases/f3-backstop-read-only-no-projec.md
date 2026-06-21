---
schemaVersion: "0.1"
slug: worktree-lifecycle-finalization-f3-backstop-read-only-no-projec
title: Backstop read-only no project verify (Decisão 5)
goal: "adicionar um check read-only de backstop ao `project verify` (slot #9,
  após os 8 atuais) que deriva live de `git worktree list --porcelain` +
  `merge-base` + status do plano e sinaliza em WARN os estados órfãos, sem flag
  no `focus.json`, sem hook e sem campo de schema novo."
status: pending
branch: plan/worktree-lifecycle-finalization
started: 2026-06-16T15:05:46.324Z
lastUpdated: 2026-06-16T15:38:51.971Z
nextAction: "Start T-001: Check de backstop de worktree órfã"
parentPlan: worktree-lifecycle-finalization
phaseId: F3
tasksDone: 0
tasksTotal: 1
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: G-1
    description: Backstop sinaliza WARN para worktree órfã e branch arquivada à
      frente; read-only, inputs não mutados; suite verde.
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
    title: Backstop read-only no project verify (Decisão 5)
    type: task
    openedAt: 2026-06-16T15:05:46.324Z
tasks:
  - id: T-001
    title: Check de backstop de worktree órfã
    status: pending
    lastUpdated: 2026-06-16T15:38:51.971Z
    summary: "Check #9: sinaliza worktree viva / branch à frente de plano arquivado."
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
      - não tocar os 8 checks existentes.
    acceptance:
      - "`findOrphanWorktrees` sinaliza em WARN um plano `archived` cuja branch
        está à frente da base"
      - sinaliza em WARN uma worktree viva de um plano `archived`
      - retorna vazio para um estado limpo/ativo
      - nunca muta os inputs (função pura sobre worktrees parseadas + status de
        planos + predicado de ancestralidade injetado)
      - "`project-verify.md` lista o check #9 após os 8 atuais."
    verifier:
      kind: test
      runner: node
      pattern: tests/detect-orphan-worktrees.test.js
parked: []
emerged: []
summary: project verify avisa (WARN) worktrees órfãs de planos arquivados.
planTitle: Finalização do ciclo de vida da worktree-do-plano
planActive: true
---

# Narrative / notes

Initiative for phase **F3 — Backstop read-only no project verify (Decisão 5)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
