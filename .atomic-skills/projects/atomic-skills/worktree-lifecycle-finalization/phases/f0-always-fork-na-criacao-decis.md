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

## Session handoff
- **Narrative:** RE-DECOMPOSE COMPLETA (2026-06-16). O plano `worktree-lifecycle-finalization` foi re-decomposto do `design.md` aprovado (D1–D8, critic Approved 2 rounds) sob o pivô Git Flow. Plano velho (premissa base=main) movido para `_superseded-pre-pivot/`; novo **F0–F7** materializado, **F0 ativa**. 13 tasks SPEC-admitidas (Files/scopeBoundary/acceptance/verifier). `validate-state` 58 arquivos verde; `focus.json`→F0. **PENDENTE: Stage 8 (review-plan interno obrigatório + codex opcional) antes de implementar.**
- **Decision log:** rota de slug = (c) mover+recriar mesmo slug (operador). Árvore F0–F7 = 1 decisão/fase. `review-due` reusado no finalize (F3). D8 em 2 camadas: A (ledger `last-review.json` ponteiro→conjunto + dedup em review-code/review-due, DIRETO nesta branch) + B (run-record do composer `project review` via work-order ao autor — skill vive na branch F4-skills, fora desta e da main). `decompose.js` (frozen) só emite id+title → o interior SPEC + resumos foram ANOTADOS pós-materialize (não auto-carregados). F2/T-001 acceptance consolidada 6→5 (limite do schema).
- **Single nextAction:** Rodar `atomic-skills:review-plan --mode=internal` no `plan.md` (Stage 8a, obrigatório; aplicar findings major+ e re-rodar até zero), depois PERGUNTAR ao operador sobre o codex (Stage 8b, ~$0.50–1.50). Só então `atomic-skills:implement` da F0 (T-001: fork incondicional em `scripts/plan-branch-policy.js`).
- **Verbatim state:** HEAD `plan/worktree-lifecycle-finalization` = `27f4786` (árvore limpa após este handoff). Plano: `.atomic-skills/projects/atomic-skills/worktree-lifecycle-finalization/plan.md` (currentPhase F0). F0 verifier T-001: `node --test tests/plan-branch-policy.test.js`. Design aprovado + commitado (`63e53b1`). Materialização commitada (`27f4786`, 16 arquivos). Velho em `_superseded-pre-pivot/` (recuperável via git). `develop` NÃO existe ainda (criado no finalize, F3); `gh` 2.45.0; `main`=`b26d989`; `project-review.md` ausente desta branch (commits `9406177`/`ecaae5b`).
- **Uncommitted changes:** este handoff (a commitar agora); após o commit, árvore LIMPA.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
