---
schemaVersion: "0.1"
slug: plan-dependencies-f3-dashboard-caminho-de-execucao
title: Dashboard caminho de execucao
goal: representar no dashboard a timeline de execucao entre planos e a relacao
  separada de planos surgidos dentro de fases ou tasks.
status: pending
branch: plan/plan-dependencies
started: 2026-06-25T13:43:40.847Z
lastUpdated: 2026-06-25T13:45:23.449Z
nextAction: "Start T3.1: Add execution path and plan relation widgets"
parentPlan: plan-dependencies
phaseId: F3
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
weightDone: 0
weightTotal: 5
exitGates:
  - id: F3-G1
    description: Dashboard manifest and consumer checks expose execution path and
      origin relation as separate UI concepts.
    status: pending
    verifier:
      kind: shell
      command: rtk node --test tests/aideck-consumer-manifest.test.js
        tests/aideck-consumer-manifest-compat.test.js
        tests/aideck-contract.test.js tests/verify-aideck-routes-smoke.test.js
      expectExitCode: 0
    verifierLabel: "shell: rtk node --test tests/aideck-consumer-manifest.test.js test…"
stack:
  - id: 1
    title: Dashboard caminho de execucao
    type: task
    openedAt: 2026-06-25T13:43:40.847Z
tasks:
  - id: T3.1
    title: Add execution path and plan relation widgets
    description: Adicionar ao manifest as secoes **Caminho de execucao** e
      **Relacoes do plano**, com fontes e campos que separam dependencia
      operacional de origem.
    status: pending
    lastUpdated: 2026-06-25T13:43:40.847Z
    scopeBoundary:
      - nao remover widgets publicados e nao misturar labels de origem com
        labels de bloqueio
    acceptance:
      - o manifest registra uma leitura de Liberado agora, Em andamento,
        Bloqueado e Concluido por `executionLane`, e uma leitura separada para
        Origem, Dependencias e Impacto do plano
    verifier:
      kind: shell
      command: rtk node --test tests/aideck-consumer-manifest.test.js
        tests/aideck-consumer-manifest-compat.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: assets/aideck-consumer/manifest.yaml
      - kind: file
        path: tests/aideck-consumer-manifest.test.js
      - kind: file
        path: tests/aideck-consumer-manifest-compat.test.js
    summary: Registra widgets de Caminho de execucao e Relacoes do plano no manifest.
    weight: 2
  - id: T3.2
    title: Verify dashboard consumer renders the new plan relations
    description: Atualizar a verificacao do consumer para cobrir o novo data source
      e impedir regressao visual ou contratual no dashboard.
    status: pending
    lastUpdated: 2026-06-25T13:43:40.847Z
    scopeBoundary:
      - nao iniciar servidor de desenvolvimento dentro dos testes e nao acoplar
        verificacao a uma viewport especifica
    acceptance:
      - a verificacao encontra `planEdges`, os widgets novos ficam presentes no
        contrato do consumer, e o smoke de rotas segue passando
    verifier:
      kind: shell
      command: rtk node --test tests/aideck-contract.test.js
        tests/verify-aideck-routes-smoke.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: scripts/verify-aideck-consumer.mjs
      - kind: file
        path: tests/aideck-contract.test.js
      - kind: file
        path: tests/verify-aideck-routes-smoke.test.js
    summary: Cobre o novo data source nos checks do consumer/dashboard.
    weight: 2
  - id: T3.3
    title: Document the operator path in project skill
    description: Atualizar a skill `project` para que status/dashboard e proximas
      acoes expliquem o caminho de execucao quando ha planos dependentes ou
      planos surgidos de uma fase/task.
    status: pending
    lastUpdated: 2026-06-25T13:43:40.847Z
    scopeBoundary:
      - nao alterar o contrato de `project finalize`, `project archive` ou
        `project verify`
    acceptance:
      - a documentacao orienta o operador a ler Caminho de execucao para
        bloqueio e Surgiu de para linhagem, com exemplo P1/F2/T-004 gerando P2
    verifier:
      kind: shell
      command: rtk node --test tests/validate-skills.test.js && rtk rg -n "Caminho de
        execucao|Surgiu de|T-004" skills/core/project.md
        skills/shared/project-assets/project-transitions.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/project.md
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
      - kind: file
        path: tests/validate-skills.test.js
    summary: Documenta o caminho operacional na skill project.
    weight: 1
parked: []
emerged: []
summary: Mostra no dashboard o caminho de execucao e a linhagem Surgiu de separadamente.
planTitle: plan-dependencies - dependencias executaveis entre planos
planActive: true
---

# Narrative / notes

Initiative for phase **F3 — Dashboard caminho de execucao**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
