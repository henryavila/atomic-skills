---
schemaVersion: "0.1"
slug: worktree-lifecycle-finalization-f0-always-fork-na-criacao-decis
title: Always-fork na criação (Decisão 1)
goal: tornar o fork de `plan/<slug>` + worktree INCONDICIONAL na criação do
  plano (Stage 6), revertendo o default lazy anterior — reusando o mecanismo de
  stamp/worktree e invertendo só o gatilho, sem tocar `emit-focus` nem o Step
  0.5 do implement.
status: active
branch: plan/worktree-lifecycle-finalization
started: 2026-06-16T22:50:35.627Z
lastUpdated: 2026-06-16T22:50:35.627Z
nextAction: "Start T-001: Fork incondicional na criação"
parentPlan: worktree-lifecycle-finalization
phaseId: F0
tasksDone: 0
tasksTotal: 1
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: G-1
    description: "Fork incondicional na criação: solo agora forka plan/<slug>;
      planBranchName intacto; Stage 6 declara fork incondicional; suite verde."
    status: pending
    verifier:
      kind: test
      runner: node
      pattern: tests/plan-branch-policy.test.js
    verifierLabel: "test: node tests/plan-branch-policy.test.js"
  - id: G-2
    description: emit-focus permanece intacto (Decisão 1 não o toca) e skills válidos.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/focus-digest.test.js && npm run validate-skills
    verifierLabel: "shell: node --test tests/focus-digest.test.js && npm run validate-…"
stack:
  - id: 1
    title: Always-fork na criação (Decisão 1)
    type: task
    openedAt: 2026-06-16T22:50:35.627Z
tasks:
  - id: T-001
    title: Fork incondicional na criação
    status: pending
    lastUpdated: 2026-06-16T22:50:35.627Z
    summary: Torna o fork de branch+worktree incondicional na criação do plano.
    outputs:
      - kind: file
        path: scripts/plan-branch-policy.js
      - kind: test
        path: tests/plan-branch-policy.test.js
      - kind: file
        path: skills/shared/project-assets/project-create-plan.md
    scopeBoundary:
      - NÃO tocar `scripts/emit-focus.js` (Decisão 1 não depende dele) nem
        `skills/core/implement.md` Step 0.5
      - NÃO alterar a assinatura de `materializeDecomposition`
      - preservar `planBranchName` e `retroactiveWorktreeAdd` (só o gatilho de
        decisão muda).
    acceptance:
      - "`shouldForkPlanBranch` retorna `true` para um plano solo (fork
        incondicional na criação, revertendo o default lazy)"
      - "`planBranchName('foo')` segue retornando `'plan/foo'`"
      - o Stage 6 de `project-create-plan.md` declara o fork+stamp+worktree como
        ação incondicional na criação (não mais gated por concorrência)
      - a suíte `tests/plan-branch-policy.test.js` cobre o caso solo→fork e
        segue verde.
    verifier:
      kind: test
      runner: node
      pattern: tests/plan-branch-policy.test.js
parked: []
emerged: []
summary: Toda criação de plano forka branch+worktree (always-fork), revertendo o
  default lazy.
planTitle: Finalização do ciclo de vida da worktree-do-plano
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F0 — Always-fork na criação (Decisão 1)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
