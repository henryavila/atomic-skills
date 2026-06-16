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
nextAction: "Start T-002: Worktree retroativa para o plano pré-existente"
parentPlan: worktree-lifecycle-finalization
phaseId: F0
tasksDone: 1
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
    status: done
    closedAt: 2026-06-16T16:34:00.000Z
    lastUpdated: 2026-06-16T16:34:00.000Z
    summary: "Helper que decide o fork: solo → sem branch, concorrência → plan/<slug>."
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-16T16:34:00.000Z
      passed: true
      exitCode: 0
      testsCollected: 5
      outputSummary: node --test tests/plan-branch-policy.test.js → tests 5 / pass 5 /
        fail 0 (exit 0); re-run on MERGED primary tree (HEAD d66fbe2) após
        ff-merge de impl/wlf-t001.
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

## Session handoff
- **Narrative:** Fase F0, 1/2 tasks fechadas. **T-001 DONE**: executada por Codex (Mode 2) no worktree `impl/wlf-t001`, merge-back ff aprovado pelo operador, mergeada na primária (`d7d62d4 → d66fbe2`), verifier `node --test tests/plan-branch-policy.test.js` **re-rodado na primária merged: exit 0, 5/5 testes** (entry token a done); evidence GATE-R2 escrita; rollups `tasksDone:1/2`; `validate-state` verde; worktree+branch `impl/wlf-t001` removidos (`git branch -d` ok = integrada); telemetria em `dispatch-log.json`. Próximo: T-002 (couplada, mesmos 3 arquivos), dispatch serial a partir de `d66fbe2`.
- **Decision log:** (1) Mode 2/Codex honrado por config file-backed; coupling força serial. (2) Worktree Codex sob checkout PRIMÁRIO. (3) Merge-back operator-prompted (v1). (4) Codex nunca toca `.atomic-skills/`; Opus dono de toda transição/commit. (5) Auto-report do Codex ("tests 1") descartado — só o re-run na primária merged conta. (6) Source veio no commit d66fbe2 (co-authored); o fechamento de estado é commit `chore(project):` separado (convenção do repo).
- **Single nextAction:** Dispatchar T-002: criar worktree `/home/henry/atomic-skills/.worktrees/wlf-t002` (`git worktree add -b impl/wlf-t002 <path> d66fbe2`), briefing em `/tmp/wlf-t002-briefing.md` (a escrever) via bridge workspace-write; T-002 adiciona `retroactiveWorktreeAdd(...)` ao mesmo `scripts/plan-branch-policy.js` + testes + captura de source-ref no Stage 6.
- **Verbatim state:** verifier T-002 = `node --test tests/plan-branch-policy.test.js`; verifier G-2 = `node --test tests/focus-digest.test.js`. HEAD `plan/worktree-lifecycle-finalization` = `d66fbe2` (após ff-merge T-001). Arquivos T-002 (acceptance): `retroactiveWorktreeAdd({slug,baseRef})` devolve comando `git worktree add -b plan/<slug> .worktrees/<slug> <baseRef>` SEM `--force`, BLOQUEIA (lança) se `baseRef` ausente/irresolúvel; Stage 6 captura source-ref do pré-existente ANTES de escrever o plano entrante.
- **Uncommitted changes:** a commitar agora (chore): `.atomic-skills/.../f0-*.md` (T-001 done + evidence + rollups + nextAction + este snapshot) e `.atomic-skills/status/dispatch-log.json`. Source de T-001 já em `d66fbe2`.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
