---
schemaVersion: "0.1"
slug: worktree-lifecycle-finalization-f2-teardown-seguro-squash-safe
title: Teardown seguro squash-safe contra integrationRef (Decisão 4)
goal: revisar o invariante de não-perda em `scripts/worktree-teardown.js` para
  verificar contra o `integrationRef` configurável (não mais `main`), compondo
  liveness via `gh pr view` (state==MERGED, baseRefName correto, captura
  `headRefOid`) com um veto local ancorado no `headRefOid` que é seguro sob
  squash-merge; em indeterminação, BLOQUEIA.
status: pending
branch: plan/worktree-lifecycle-finalization
started: 2026-06-16T22:50:35.627Z
lastUpdated: 2026-06-16T22:50:35.627Z
nextAction: "Start T-001: Liveness gh + veto ancorado no headRefOid, com 2
  testes-oráculo de squash"
parentPlan: worktree-lifecycle-finalization
phaseId: F2
tasksDone: 0
tasksTotal: 1
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: G-1
    description: Teardown verifica contra integrationRef; liveness+veto headRefOid;
      oráculos A (resíduo pós-squash bloqueia) e B (squash limpo permite);
      indeterminação bloqueia; sem -D/--force/rm -rf; suite verde.
    status: pending
    verifier:
      kind: test
      runner: node
      pattern: tests/worktree-teardown.test.js
    verifierLabel: "test: node tests/worktree-teardown.test.js"
  - id: G-2
    description: Skills válidos após a revisão do invariante.
    status: pending
    verifier:
      kind: shell
      command: npm run validate-skills
    verifierLabel: "shell: npm run validate-skills"
stack:
  - id: 1
    title: Teardown seguro squash-safe contra integrationRef (Decisão 4)
    type: task
    openedAt: 2026-06-16T22:50:35.627Z
tasks:
  - id: T-001
    title: Liveness gh + veto ancorado no headRefOid, com 2 testes-oráculo de squash
    status: pending
    lastUpdated: 2026-06-16T22:50:35.627Z
    summary: Liveness gh + veto headRefOid contra o integrationRef, com 2 oráculos
      de squash.
    outputs:
      - kind: file
        path: scripts/worktree-teardown.js
      - kind: test
        path: tests/worktree-teardown.test.js
    scopeBoundary:
      - NÃO executar git/gh destrutivo no teste (injetar os resultados de
        `gh`/`merge-base`)
      - NÃO usar `git rev-list --not <ref>` (sob squash bloquearia o
        caminho-feliz para sempre)
      - a falha segura é BLOQUEAR, nunca over-deletar
      - o módulo nunca contém `-D`, `--force` nem `rm -rf`.
    acceptance:
      - "`resolveBaseRef` passa a resolver o `integrationRef` configurável em
        vez de `origin/main→main`"
      - a liveness exige `state==MERGED`, `mergedAt` não-nulo E `baseRefName ==
        integrationRef`, e captura o `headRefOid`
      - o veto libera só quando `git merge-base --is-ancestor` é verdadeiro OU
        `HEAD == headRefOid` (squash), e BLOQUEIA qualquer commit além do
        `headRefOid`
      - ORÁCULO de squash — com um commit adicionado DEPOIS do head ⟹ teardown
        BLOQUEIA, e squash-merged LIMPO (`HEAD == headRefOid`) ⟹ teardown
        PERMITE
      - indeterminação (`gh` ausente, `headRefOid`/ref ausente, PR ambíguo)
        BLOQUEIA.
    verifier:
      kind: test
      runner: node
      pattern: tests/worktree-teardown.test.js
parked: []
emerged: []
summary: Teardown só remove com integração provada vs integrationRef, seguro sob squash.
planTitle: Finalização do ciclo de vida da worktree-do-plano
planActive: true
---

# Narrative / notes

Initiative for phase **F2 — Teardown seguro squash-safe contra integrationRef (Decisão 4)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
