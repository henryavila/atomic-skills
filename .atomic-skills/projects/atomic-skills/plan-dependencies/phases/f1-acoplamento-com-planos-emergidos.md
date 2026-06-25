---
schemaVersion: "0.1"
slug: plan-dependencies-f1-acoplamento-com-planos-emergidos
title: Acoplamento com planos emergidos
goal: quando um plano nasce de uma fase ou task por `fork-plan`, registrar a
  origem e a dependencia operacional correta sem duplicar fonte de verdade.
status: pending
branch: plan/plan-dependencies
started: 2026-06-25T13:43:40.847Z
lastUpdated: 2026-06-25T13:45:23.449Z
nextAction: "Start T1.1: Add a dependency write primitive for plan frontmatter"
parentPlan: plan-dependencies
phaseId: F1
tasksDone: 0
tasksTotal: 4
gatesMet: 0
gatesTotal: 1
weightDone: 0
weightTotal: 6
exitGates:
  - id: F1-G1
    description: Fork-plan records origin and default operational dependency for an
      extracted child plan, explicit dependency commands cover manual edges, and
      transitions surface the blocked-plan path.
    status: pending
    verifier:
      kind: shell
      command: rtk node --test tests/links-sidecar.test.js
        tests/validate-skills.test.js tests/transition-emits.test.js
      expectExitCode: 0
    verifierLabel: "shell: rtk node --test tests/links-sidecar.test.js tests/validate-…"
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
    status: pending
    lastUpdated: 2026-06-25T13:43:40.847Z
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
    status: pending
    lastUpdated: 2026-06-25T13:43:40.847Z
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
    status: pending
    lastUpdated: 2026-06-25T13:43:40.847Z
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
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
      - kind: file
        path: tests/transition-emits.test.js
    summary: Mostra bloqueio por plano nas transicoes e proximas acoes.
    weight: 1
  - id: T1.4
    title: Add explicit plan dependency command
    description: Expor um caminho validado para listar, adicionar, remover e resolver dependencias entre planos existentes, incluindo direcao explicita e resolucao de prerequisito arquivado.
    status: pending
    lastUpdated: 2026-06-25T13:43:40.847Z
    scopeBoundary:
      - nao permitir dependencia cross-project e nao editar `spawnedFrom` ou `phases[].spawnedPlans`
    acceptance:
      - a skill `project` documenta `project depend` para add, remove, list e resolve; comandos usam a primitiva idempotente; archived libera somente com resolucao explicita registrada no edge
    verifier:
      kind: shell
      command: rtk node --test tests/validate-skills.test.js && rtk rg -n "project depend|release.archived|dependsOnPlans" skills/core/project.md skills/shared/project-assets/project-dependencies.md
      expectExitCode: 0
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
summary: Acopla planos emergidos e edges manuais ao grafo sem confundir origem com bloqueio operacional.
planTitle: plan-dependencies - dependencias executaveis entre planos
planActive: true
---

# Narrative / notes

Initiative for phase **F1 — Acoplamento com planos emergidos**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
