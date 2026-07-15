---
schemaVersion: "0.1"
slug: worktree-lifecycle-finalization-f6-backstop-read-only-no-projec
title: Backstop read-only no project verify (Decisão 6)
goal: adicionar um 9º check read-only ao `project verify` (após os 8 atuais) que
  deriva live de `git worktree list --porcelain` + `merge-base` + status do
  plano e sinaliza em WARN os órfãos do modelo PR→develop (worktree viva de
  feature já mergeada; branch de plano arquivado nunca PR-ada ou PR aberto e
  nunca mergeado); o classificador topology-aware auto-ordenador fica DEFERIDO.
status: done
branch: plan/worktree-lifecycle-finalization
started: 2026-06-17T21:15:00Z
lastUpdated: 2026-06-17T21:45:00Z
nextAction: null
parentPlan: worktree-lifecycle-finalization
phaseId: F6
tasksDone: 1
tasksTotal: 1
gatesMet: 2
gatesTotal: 2
weightDone: 1
weightTotal: 1
exitGates:
  - id: G-1
    description: Backstop sinaliza WARN para worktree de feature mergeada e branch
      arquivada não-integrada; read-only, inputs não mutados; suite verde.
    status: met
    metAt: 2026-06-17T21:30:00Z
    verifier:
      kind: test
      runner: node
      pattern: tests/detect-orphan-worktrees.test.js
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-17T21:30:00Z
      exitCode: 0
      testsCollected: 11
      passed: true
      outputSummary: "node --test tests/detect-orphan-worktrees.test.js @ bb3183b
        (merged primary, post review-gate fixes): tests 11, pass 11, fail 0.
        Função pura findOrphanWorktrees (isBranchMerged simétrico A/B) — ambos
        sinais de merge, ambas formas archived, healthy→[], pureza+never-throws
        (frozen/null/throwing-isMerged/malformed), no-matching-plan, duplo-plano
        slug. read-only, inputs não mutados."
    verifierLabel: "test: node tests/detect-orphan-worktrees.test.js"
    evidenceSummary: passed · 11 tests · 2026-06-17
  - id: G-2
    description: "project-verify.md lista o check #9 (âncora
      detect-orphan-worktrees) e validate-skills passa."
    status: met
    metAt: 2026-06-17T21:30:00Z
    verifier:
      kind: shell
      command: grep -q 'detect-orphan-worktrees'
        skills/shared/project-assets/project-verify.md && npm run
        validate-skills
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-17T21:30:00Z
      exitCode: 0
      passed: true
      outputSummary: "grep -q 'detect-orphan-worktrees' project-verify.md (check #9
        documentado, kinds reais nomeados) && npm run validate-skills → All 15
        skills valid, exit 0 @ bb3183b."
    verifierLabel: "shell: grep -q 'detect-orphan-worktrees' skills/shared/project-ass…"
    evidenceSummary: passed · 2026-06-17
stack:
  - id: 1
    title: Backstop read-only no project verify (Decisão 6)
    type: task
    openedAt: 2026-06-16T22:50:35.627Z
tasks:
  - id: T-001
    title: "Check #9 de backstop de órfãos PR→develop"
    status: done
    closedAt: 2026-06-17T21:30:00Z
    lastUpdated: 2026-06-17T21:30:00Z
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
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-17T21:30:00Z
      exitCode: 0
      testsCollected: 6
      passed: true
      outputSummary: "node --test tests/detect-orphan-worktrees.test.js @ a04b628
        (merged primary): tests 6, pass 6, fail 0, exit 0 — ambos sinais de
        merge (pr MERGED + isMerged injetado), ambas formas archived (never-pr /
        pr-open), healthy-clean → [], pureza+never-throws (frozen/null). G-2:
        grep detect-orphan-worktrees + validate-skills 15/15 exit 0. Mode 2
        Codex (impl/wlf-f6-t-001, ff a04b628); auto-report -o 'tests 1'
        DESCARTADO per wlf-f0-nascimento L-001 (real 6); função pura sobre
        inputs injetados, fence respeitado (source-only)."
parked: []
emerged: []
summary: 9º check read-only no project verify avisa (WARN) órfãos do modelo PR→develop.
planTitle: Finalização do ciclo de vida da worktree-do-plano
planActive: true
current: false
---


# Narrative / notes

Initiative for phase **F6 — Backstop read-only no project verify (Decisão 6)**.

## Session handoff
- **Narrative:** **F6 — task 1/1 DONE** (gates 0/2 pending, resolvem no `phase-done`).
  PHASE BOUNDARY. T-001 em **Mode 2/Codex** (escolha do operador): SPEC re-aterrada no
  repo vivo antes do dispatch (per L-002) — confirmada settled, função pura sem risco de
  soundness. Codex criou `scripts/detect-orphan-worktrees.js` (`findOrphanWorktrees`,
  pura sobre worktrees/plans/predicado injetados) + teste (6 casos) + check #9 em
  `project-verify.md`, ff-merged `a04b628`. Re-verificado na primária MERGED: G-1 6/6,
  G-2 grep+validate-skills exit 0.
- **Decision log:** (1) SPEC dispatch-ready sem emenda (contraste com F5, que precisou
  re-escopo) — o grounding L-002 confirmou settled. (2) Auto-report `-o` do Codex "tests
  1" DESCARTADO — real 6 (wlf-f0 L-001 reconfirmada uma 3ª vez no plano). (3) Função pura
  sobre inputs injetados (não roda git) → testável + fence trivial (source-only, sem
  state-tree).
- **Single nextAction:** **(operator-prompted)** Rodar `phase-done F6`: exit-gates G-1
  (node --test detect-orphan-worktrees) + G-2 (grep detect-orphan-worktrees +
  validate-skills), `review-code --mode=both` no diff da fase, distila lessons, grava
  `reviewGate` no `plan.md` e avança `currentPhase` F6→F7.
- **Verbatim state:** Commits desta sessão (F6): `a04b628` (feat Codex source, ff),
  próximo: `chore(project): done F6/T-001` (estado + telemetria). Worktree
  `impl/wlf-f6-t-001` a remover pós-commit.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
