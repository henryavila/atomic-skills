---
schemaVersion: "0.1"
slug: worktree-lifecycle-finalization-f0-nascimento-da-branch-sob-con
title: Nascimento da branch sob concorrência (Decisões 1+2)
goal: "tornar `branch: null` na árvore atual o DEFAULT para um plano solo no
  Stage 6, forkando `plan/<slug>` só sob concorrência; e materializar
  retroativamente a worktree do plano pré-existente quando um 2º plano o torna
  concorrente."
status: active
branch: plan/worktree-lifecycle-finalization
started: 2026-06-16T15:05:46.324Z
lastUpdated: 2026-06-16T15:38:51.971Z
nextAction: "Start T-001: Política determinística de fork de branch"
parentPlan: worktree-lifecycle-finalization
phaseId: F0
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: G-1
    description: "Fork determinístico: solo retorna branch:null, concorrência
      retorna plan/<slug>; worktree retroativa do pré-existente composta sem
      --force; suite verde."
    status: pending
    verifier:
      kind: test
      runner: node
      pattern: tests/plan-branch-policy.test.js
    verifierLabel: "test: node tests/plan-branch-policy.test.js"
  - id: G-2
    description: emit-focus permanece intacto — Decisão 1 não depende dele (testes
      de focus verdes).
    status: pending
    verifier:
      kind: shell
      command: node --test tests/focus-digest.test.js
    verifierLabel: "shell: node --test tests/focus-digest.test.js"
stack:
  - id: 1
    title: Nascimento da branch sob concorrência (Decisões 1+2)
    type: task
    openedAt: 2026-06-16T15:05:46.324Z
tasks:
  - id: T-001
    title: Política determinística de fork de branch
    status: pending
    lastUpdated: 2026-06-16T15:38:51.971Z
    summary: "Helper que decide o fork: solo → sem branch, concorrência → plan/<slug>."
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
      - NÃO alterar a assinatura de `materializeDecomposition`.
    acceptance:
      - "`shouldForkPlanBranch([])` retorna `false` (solo → sem fork)"
      - "`shouldForkPlanBranch([umPlanoAtivo])` retorna `true` (concorrência →
        fork)"
      - "`planBranchName('foo')` retorna `'plan/foo'`"
      - "o Stage 6 de `project-create-plan.md` declara `branch: null` como
        default explícito para plano solo."
    verifier:
      kind: test
      runner: node
      pattern: tests/plan-branch-policy.test.js
  - id: T-002
    title: Worktree retroativa para o plano pré-existente
    status: pending
    lastUpdated: 2026-06-16T15:38:51.971Z
    summary: Materializa a worktree do plano pré-existente quando um 2º chega.
    outputs:
      - kind: file
        path: scripts/plan-branch-policy.js
      - kind: test
        path: tests/plan-branch-policy.test.js
      - kind: file
        path: skills/shared/project-assets/project-create-plan.md
    scopeBoundary:
      - NÃO executar git real no teste (só compor o comando)
      - NÃO mergear
      - "NÃO re-tratar o plano entrante (o stamp do pré-existente já existe via
        `bindPlanBranch`, `verified_by: scripts/bind-plan-branch.js`)"
      - o source-ref do pré-existente é capturado ANTES de qualquer escrita do
        plano entrante.
    acceptance:
      - "`retroactiveWorktreeAdd({slug:'old', baseRef})` exige um `baseRef`
        capturado antes de qualquer escrita do plano entrante e devolve um
        comando que materializa `.worktrees/old` com branch `plan/old` semeada
        NESSE `baseRef` (nunca o HEAD pós-mutação, para a worktree retroativa
        não vazar artefatos do entrante)"
      - "`retroactiveWorktreeAdd` BLOQUEIA (lança) quando `baseRef` é
        ausente/irresolúvel — falha segura, nunca semeia de um ref indefinido"
      - o comando NUNCA inclui `--force`
      - o Stage 6 de `project-create-plan.md` captura o source-ref do
        pré-existente antes de escrever o plano entrante e liga a worktree
        retroativa a esse ref.
    verifier:
      kind: test
      runner: node
      pattern: tests/plan-branch-policy.test.js
parked: []
emerged: []
summary: Branch da worktree nasce só sob concorrência; plano solo fica sem branch.
planTitle: Finalização do ciclo de vida da worktree-do-plano
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F0 — Nascimento da branch sob concorrência (Decisões 1+2)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
