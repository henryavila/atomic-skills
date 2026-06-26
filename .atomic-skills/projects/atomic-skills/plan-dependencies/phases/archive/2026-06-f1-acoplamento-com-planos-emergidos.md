---
schemaVersion: "0.1"
slug: plan-dependencies-f1-acoplamento-com-planos-emergidos
title: Acoplamento com planos emergidos
goal: quando um plano nasce de uma fase ou task por `fork-plan`, registrar a
  origem e a dependencia operacional correta sem duplicar fonte de verdade.
status: done
branch: plan/plan-dependencies
started: 2026-06-25T13:43:40.847Z
lastUpdated: 2026-06-25T21:51:42Z
nextAction: F2 is active; start T2.1 in scripts/emit-consumer-state.js and tests/emit-consumer-state.test.js
parentPlan: plan-dependencies
phaseId: F1
tasksDone: 4
tasksTotal: 4
gatesMet: 1
gatesTotal: 1
weightDone: 6
weightTotal: 6
exitGates:
  - id: F1-G1
    description: Fork-plan records origin and default operational dependency for an
      extracted child plan, explicit dependency commands cover manual edges, and
      transitions surface the blocked-plan path.
    status: met
    metAt: 2026-06-25T20:05:38Z
    verifier:
      kind: shell
      command: rtk node --test tests/links-sidecar.test.js
        tests/validate-skills.test.js tests/transition-emits.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-25T20:05:38Z
      passed: true
      exitCode: 0
      outputSummary: "rtk node --test tests/links-sidecar.test.js
        tests/validate-skills.test.js tests/transition-emits.test.js: tests 99,
        pass 99, fail 0, duration_ms 910.85375"
    verifierLabel: "shell: rtk node --test tests/links-sidecar.test.js tests/validate-…"
    evidenceSummary: passed · 2026-06-25
stack:
  - id: 1
    title: Acoplamento com planos emergidos
    type: task
    openedAt: 2026-06-25T13:43:40.847Z
tasks:
  - id: T1.1
    title: Add a dependency write primitive for plan frontmatter
    description: Adicionar uma primitiva idempotente para escrever
      `dependsOnPlans[]` no frontmatter do plano dependente, junto dos helpers
      de origem que ja manipulam `plan.md`.
    status: done
    closedAt: 2026-06-25T19:49:24Z
    lastUpdated: 2026-06-25T19:49:24Z
    scopeBoundary:
      - nao reativar `links.json` como fonte duravel de origem e nao duplicar
        `spawnedPlans` como bloqueio
    acceptance:
      - a primitiva adiciona uma dependencia uma vez, preserva o body do
        plan.md, valida shape antes de escrever e rejeita anchor de origem sem
        `phaseId`
    verifier:
      kind: shell
      command: rtk node --test tests/links-sidecar.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-25T19:49:24Z
      passed: true
      exitCode: 0
      outputSummary: "rtk node --test tests/links-sidecar.test.js: tests 42, pass 42,
        fail 0, duration_ms 874.710291"
    outputs:
      - kind: file
        path: src/links-sidecar.js
      - kind: file
        path: tests/links-sidecar.test.js
    summary: Adiciona escrita idempotente de dependencia no frontmatter do plano.
    weight: 2
  - id: T1.2
    title: Update fork-plan emergence instructions
    description: Atualizar o fluxo de `fork-plan` para criar automaticamente a
      dependencia pai -> filho quando `--mode pause` extrai trabalho do caminho
      atual, mantendo direcao explicita para filhos que representam continuacao
      posterior ou trabalho paralelo opcional.
    status: done
    closedAt: 2026-06-25T19:55:15Z
    lastUpdated: 2026-06-25T19:55:15Z
    scopeBoundary:
      - nao remover `spawnedFrom`, nao remover `spawnedPlans` e nao mudar a
        semantica de `--mode resume`
    acceptance:
      - a documentacao do `fork-plan` diz que P1/F2/T-004 surgindo P2 grava
        `spawnedFrom` no filho, `spawnedPlans` no pai e `dependsOnPlans` no pai
        apontando para P2 quando o filho bloqueia a retomada
    verifier:
      kind: shell
      command: rtk node --test tests/validate-skills.test.js && rtk rg -n
        "dependsOnPlans|spawnedFrom|spawnedPlans"
        skills/shared/project-assets/project-emergence.md
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-25T19:55:15Z
      passed: true
      exitCode: 0
      outputSummary: 'rtk node --test tests/validate-skills.test.js && rtk rg -n
        "dependsOnPlans|spawnedFrom|spawnedPlans"
        skills/shared/project-assets/project-emergence.md: tests 51, pass 51,
        fail 0; rg matched lines 180,189,199,208,210,218,226'
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-emergence.md
      - kind: file
        path: tests/validate-skills.test.js
    summary: Documenta o fork-plan criando origem e dependencia operacional default.
    weight: 1
  - id: T1.3
    title: Surface blocked-plan guidance in transitions
    description: Atualizar as transicoes de projeto para mostrar bloqueio por plano
      antes de orientar execucao, troca de fase ou arquivamento.
    status: done
    closedAt: 2026-06-25T19:57:37Z
    lastUpdated: 2026-06-25T19:57:37Z
    scopeBoundary:
      - nao mudar a regra de phase dependencies e nao alterar o emissor de
        eventos nesta task
    acceptance:
      - "`switch`, `phase-done`, `archive` ou `get-next-action` documentam que
        um plano bloqueado por `dependsOnPlans[]` aponta o prerequisito e o
        caminho de retomada"
    verifier:
      kind: shell
      command: rtk node --test tests/transition-emits.test.js && rtk rg -n
        "dependsOnPlans|blocked|bloque"
        skills/shared/project-assets/project-transitions.md
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-25T19:57:37Z
      passed: true
      exitCode: 0
      outputSummary: 'rtk node --test tests/transition-emits.test.js && rtk rg -n
        "dependsOnPlans|blocked|bloque"
        skills/shared/project-assets/project-transitions.md: tests 5, pass 5,
        fail 0; rg matched dependsOnPlans lines 55,57,59,141,271'
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
      - kind: file
        path: tests/transition-emits.test.js
    summary: Mostra bloqueio por plano nas transicoes e proximas acoes.
    weight: 1
  - id: T1.4
    title: Add explicit plan dependency command
    description: Expor um caminho validado para listar, adicionar, remover e
      resolver dependencias entre planos existentes, incluindo direcao explicita
      e resolucao de prerequisito arquivado.
    status: done
    closedAt: 2026-06-25T20:03:59Z
    lastUpdated: 2026-06-25T20:03:59Z
    scopeBoundary:
      - nao permitir dependencia cross-project e nao editar `spawnedFrom` ou
        `phases[].spawnedPlans`
    acceptance:
      - a skill `project` documenta `project depend` para add, remove, list e
        resolve; comandos usam a primitiva idempotente; archived libera somente
        com resolucao explicita registrada no edge
    verifier:
      kind: shell
      command: rtk node --test tests/validate-skills.test.js && rtk rg -n "project
        depend|release.archived|dependsOnPlans" skills/core/project.md
        skills/shared/project-assets/project-dependencies.md
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-25T20:03:59Z
      passed: true
      exitCode: 0
      outputSummary: 'rtk node --test tests/validate-skills.test.js && rtk rg -n
        "project depend|release.archived|dependsOnPlans" skills/core/project.md
        skills/shared/project-assets/project-dependencies.md: tests 52, pass 52,
        fail 0; rg matched project depend lines 28,12,13,14,15 and
        release.archived/dependsOnPlans lines
        5,20,24,73,78,83,85,96,101,102,103,104,106'
    outputs:
      - kind: file
        path: skills/core/project.md
      - kind: file
        path: skills/shared/project-assets/project-dependencies.md
      - kind: file
        path: tests/validate-skills.test.js
    summary: Adiciona comando validado para dependencias manuais entre planos.
    weight: 2
parked: []
emerged: []
summary: Acopla planos emergidos e edges manuais ao grafo sem confundir origem
  com bloqueio operacional.
planTitle: plan-dependencies - dependencias executaveis entre planos
planActive: true
current: false
---

# Narrative / notes

Initiative for phase **F1 — Acoplamento com planos emergidos**.

## Decisions

_(record decisions here as they are made)_

- 2026-06-25T19:52:23Z: `T1.1` ran through Mode 2 because `.atomic-skills/status/routing.json` had `mode2Enabled: true` and `codexLane.enabled: true`, and the task carried exact output paths, `scopeBoundary`, `acceptance`, and verifier `rtk node --test tests/links-sidecar.test.js`.
- 2026-06-25T19:52:23Z: `addPlanDependency` validates against `meta/schemas/plan.schema.json#/$defs/planDependency` instead of duplicating a manual shape, so the writer follows the same `dependsOnPlans[]` contract as `validate-state`.
- 2026-06-25T19:55:15Z: `T1.2` ran in Mode 1 because the plan worktree carried uncommitted `T1.1` source and state changes; Mode 2's parent-clean preflight was not met.
- 2026-06-25T19:55:15Z: `fork-plan --mode pause` now documents three writes after child materialization: child `spawnedFrom`, parent `phases[].spawnedPlans`, and parent `dependsOnPlans[]` pointing at the child as the operational blocker.
- 2026-06-25T19:57:37Z: `T1.3` kept the change in transition guidance only; it did not alter phase-dependency rules or event emission.
- 2026-06-25T19:57:37Z: Plan-level blockers are surfaced from `dependsOnPlans[]` before transition guidance points the operator at the next executable plan or phase.
- 2026-06-25T20:03:59Z: `T1.4` ran in Mode 1 because the worktree carried the completed T1.1-T1.3 changes; the task added `project depend` as a lazy detail file instead of folding another procedure into the router.
- 2026-06-25T20:03:59Z: `depend add` documents the `addPlanDependency` path for manual edges, while `depend remove`, `depend list`, and `depend resolve` operate only on `dependsOnPlans[]`; origin fields stay historical.
- 2026-06-25T20:05:38Z: `F1-G1` passed with the combined phase verifier and is recorded as `met` in both the phase initiative and the parent plan descriptor.
- 2026-06-25T21:51:42Z: F1 review gate passed in local degraded inline mode, recorded at `working-tree@7f374bb`, with review file `.atomic-skills/reviews/2026-06-25-2151-plan-dependencies-f1.md`.
- 2026-06-25T21:51:42Z: No lessons were distilled because review-code produced zero findings and the phase had no reopened or blocked tasks.

## Links

_(plan doc, external refs)_

## Session handoff
- **Narrative:** Fase F1 (`.atomic-skills/projects/atomic-skills/plan-dependencies/phases/archive/2026-06-f1-acoplamento-com-planos-emergidos.md`) esta `done`; `T1.1` a `T1.4` estao `done`, `tasksDone: 4`, `weightDone: 6`, e `F1-G1` esta `met`. `T1.1` adicionou `addPlanDependency`; `T1.2` documentou `fork-plan --mode pause` criando o blocker operacional; `T1.3` adicionou bloqueio por plano nas transicoes; `T1.4` adicionou `project depend` para edges manuais. A F2 esta ativa.
- **Decision log:** `addPlanDependency` valida cada edge com `meta/schemas/plan.schema.json#/$defs/planDependency`, registrado em `src/links-sidecar.js:10-19` e `src/links-sidecar.js:132-150`. `fork-plan --mode pause` agora declara que o bloqueio operacional nasce em `dependsOnPlans[]`, enquanto `spawnedFrom` e `spawnedPlans` permanecem origem historica. As transicoes leem `dependsOnPlans[]` em `skills/shared/project-assets/project-transitions.md:55-59`, `skills/shared/project-assets/project-transitions.md:136-141` e `skills/shared/project-assets/project-transitions.md:269-271`. `project depend` esta roteado em `skills/core/project.md:28`, `skills/core/project.md:49` e `skills/core/project.md:99`; o detalhe vive em `skills/shared/project-assets/project-dependencies.md:3-24` e `skills/shared/project-assets/project-dependencies.md:58-106`. O contrato de teste esta em `tests/validate-skills.test.js:524-550`.
- **Single nextAction:** Iniciar T2.1 editando `scripts/emit-consumer-state.js` e `tests/emit-consumer-state.test.js`, depois rodar `rtk node --test tests/emit-consumer-state.test.js`.
- **Verbatim state:** `rtk sh -c 'rtk node --test tests/validate-skills.test.js && rtk rg -n "project depend|release.archived|dependsOnPlans" skills/core/project.md skills/shared/project-assets/project-dependencies.md'` -> `tests 52, pass 52, fail 0`; `rtk node --test tests/links-sidecar.test.js tests/validate-skills.test.js tests/transition-emits.test.js` -> `tests 99, pass 99, fail 0, duration_ms 910.85375`; local review file `.atomic-skills/reviews/2026-06-25-2151-plan-dependencies-f1.md` -> `Verdict: approved`, `Counts: 0B/0C/0M/0m/0n`; `rtk npm run validate-state` -> `All 129 file(s) valid, 21 plan(s) cross-validated, 1 routing config(s) valid (schemaVersion 0.1/0.2)`; latest task completion event: `{"ts":"2026-06-25T20:04:34.406Z","event":"task-done","projectId":"atomic-skills","planSlug":"plan-dependencies","phaseId":"F1","taskId":"T1.4","weight":2,"weightBasis":"proxy"}`.
- **Uncommitted changes:** ` M .atomic-skills/analytics/completions.jsonl
 M .atomic-skills/projects/atomic-skills/plan-dependencies/phases/archive/2026-06-f1-acoplamento-com-planos-emergidos.md
 M .atomic-skills/projects/atomic-skills/plan-dependencies/plan.md
 M .atomic-skills/status/dispatch-log.json
 M skills/core/project.md
 M skills/shared/project-assets/project-emergence.md
 M skills/shared/project-assets/project-transitions.md
 M src/links-sidecar.js
 M tests/links-sidecar.test.js
 M tests/validate-skills.test.js
?? .atomic-skills/reviews/2026-06-25-2151-plan-dependencies-f1.md
?? skills/shared/project-assets/project-dependencies.md`

## Self-review against code-quality gates
- G1 read-before-claim: aplicado - o handoff cita `src/links-sidecar.js:132-150`, `src/links-sidecar.js:274-286`, `tests/links-sidecar.test.js:198-273`, `skills/shared/project-assets/project-emergence.md:178-218`, `skills/shared/project-assets/project-transitions.md:55-59`, `skills/shared/project-assets/project-transitions.md:136-141`, `skills/shared/project-assets/project-transitions.md:269-271`, `skills/core/project.md:28`, `skills/core/project.md:49`, `skills/core/project.md:99`, `skills/shared/project-assets/project-dependencies.md:3-24`, `skills/shared/project-assets/project-dependencies.md:58-106`, `tests/validate-skills.test.js:524-550` e os outputs dos verifiers de `T1.1` a `T1.4`.
- G2 soft-language: aplicado - `T1.1` a `T1.4` e `F1-G1` foram fechados por `evidence.passed: true`, `exitCode: 0` e output capturado; o handoff foi revisado contra a lista G2.
- G6 reference-or-strike: aplicado - os comandos, paths, linhas e saidas em jogo estao literais no handoff.
- **Codex review**: SKIPPED at phase-done for the optional review-due prompt; the mandatory review gate ran as local degraded inline review at HEAD `7f374bb` plus working tree, verdict `approved`, counts `0B/0C/0M/0m/0n`, file `.atomic-skills/reviews/2026-06-25-2151-plan-dependencies-f1.md`.
- **Review gate (G2)**: recorded on the phase descriptor as `reviewGate: { status: passed, at: working-tree@7f374bb, mode: local, reviewFile: .atomic-skills/reviews/2026-06-25-2151-plan-dependencies-f1.md }`.
- **Lessons (G1)**: no lessons distilled (clean phase: review-code reported zero findings, no reopened tasks, no blocked tasks, no deferred gates).
