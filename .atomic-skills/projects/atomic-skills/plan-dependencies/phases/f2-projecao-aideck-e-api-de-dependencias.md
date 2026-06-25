---
schemaVersion: "0.1"
slug: plan-dependencies-f2-projecao-aideck-e-api-de-dependencias
title: Projecao aiDeck e API de dependencias
goal: expor dependencia e origem de planos como dados denormalizados para o
  consumer, mantendo compatibilidade com dependencias de fase e task.
status: pending
branch: plan/plan-dependencies
started: 2026-06-25T13:43:40.847Z
lastUpdated: 2026-06-25T13:45:23.449Z
nextAction: "Start T2.1: Emit planEdges and derived plan fields"
parentPlan: plan-dependencies
phaseId: F2
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
weightDone: 0
weightTotal: 7
exitGates:
  - id: F2-G1
    description: aiDeck state emits and validates plan dependency and origin edges,
      and get-dependencies supports scope plan.
    status: pending
    verifier:
      kind: shell
      command: rtk node --test tests/emit-consumer-state.test.js
        tests/aideck-state-schema.test.js tests/aideck-consumer-handlers.test.js
      expectExitCode: 0
    verifierLabel: "shell: rtk node --test tests/emit-consumer-state.test.js tests/aid…"
stack:
  - id: 1
    title: Projecao aiDeck e API de dependencias
    type: task
    openedAt: 2026-06-25T13:43:40.847Z
tasks:
  - id: T2.1
    title: Emit planEdges and derived plan fields
    description: Estender o emissor de estado para produzir `planEdges.json` e
      campos derivados em `plans.json` que o dashboard consegue ordenar e
      explicar.
    status: pending
    lastUpdated: 2026-06-25T13:43:40.847Z
    scopeBoundary:
      - nao mudar o formato de `tasks.json`, `gates.json` ou `phases.json` alem
        de joins de leitura ja existentes
    acceptance:
      - "`emit-consumer-state` gera edges `dependency` e `origin`,
        `blockedByPlansText`, `unblocksPlansText`, `originText` e
        `executionLane` para fixtures com pai, filho e plano bloqueado; fixture
        com grafo invalido falha antes de gravar `planEdges`"
    verifier:
      kind: shell
      command: rtk node --test tests/emit-consumer-state.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: scripts/emit-consumer-state.js
      - kind: file
        path: tests/emit-consumer-state.test.js
    summary: Emite planEdges e campos derivados para ordenar e explicar planos.
    weight: 3
  - id: T2.2
    title: Extend aiDeck state schemas for plan edges
    description: Adicionar a nova fonte aos schemas estritos do aiDeck e manter o
      bundle gerado em sincronia com o schema fonte.
    status: pending
    lastUpdated: 2026-06-25T13:43:40.847Z
    scopeBoundary:
      - nao relaxar `additionalProperties` dos records existentes e nao remover
        campos publicados de fontes atuais
    acceptance:
      - o schema aceita `planEdges` com edges `dependency` e `origin`, rejeita
        edge sem `projectId`, e o bundle em `assets/aideck-consumer/schema.json`
        fica igual ao gerado pelo build
    verifier:
      kind: shell
      command: rtk node --test tests/aideck-state-schema.test.js && rtk node
        scripts/build-aideck-consumer-schema.mjs --check
      expectExitCode: 0
    outputs:
      - kind: file
        path: meta/schemas/aideck-state.schema.json
      - kind: file
        path: assets/aideck-consumer/schema.json
      - kind: file
        path: scripts/build-aideck-consumer-schema.mjs
      - kind: file
        path: tests/aideck-state-schema.test.js
    summary: Estende os schemas aiDeck para validar edges de plano.
    weight: 2
  - id: T2.3
    title: Add get-dependencies scope plan
    description: Estender o handler `get-dependencies` para consultar dependencias
      plano -> plano sem quebrar os escopos atuais de fase e task.
    status: pending
    lastUpdated: 2026-06-25T13:43:40.847Z
    scopeBoundary:
      - nao mudar a resposta dos escopos `phase` e `task` para fixtures
        existentes
    acceptance:
      - "`scope: plan` retorna `blockedBy`, `blocking`, `resolved` e `origin`
        para o plano pedido; escopo invalido e plano ausente continuam falhando
        com erro nomeado"
    verifier:
      kind: shell
      command: rtk node --test tests/aideck-consumer-handlers.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: assets/aideck-consumer/handlers/get-dependencies.js
      - kind: file
        path: tests/aideck-consumer-handlers.test.js
    summary: "Adiciona `scope: plan` ao handler get-dependencies."
    weight: 2
parked: []
emerged: []
summary: Publica planEdges e dependencias de plano para o consumer aiDeck.
planTitle: plan-dependencies - dependencias executaveis entre planos
planActive: true
---

# Narrative / notes

Initiative for phase **F2 — Projecao aiDeck e API de dependencias**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
