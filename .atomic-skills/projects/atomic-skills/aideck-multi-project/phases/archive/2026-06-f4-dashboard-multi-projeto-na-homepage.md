---
schemaVersion: "0.1"
slug: aideck-multi-project-f4-dashboard-multi-projeto-na-homepage
title: Dashboard multi-projeto na HomePage
goal: Dashboard exibe projetos registrados como bands separadas na HomePage,
  cada um com seus planos e iniciativas.
status: archived
branch: main
started: 2026-05-25T17:06:39.511Z
lastUpdated: 2026-06-08T01:43:39Z
nextAction: null
parentPlan: aideck-multi-project
phaseId: F4
tasksDone: 4
tasksTotal: 4
gatesMet: 0
gatesTotal: 2
weightDone: 4
weightTotal: 4
exitGates:
  - id: F4-G1
    description: HomePage renderiza 2 ConsumerBands quando 2 projetos registrados
    status: pending
    verifier:
      kind: manual
      description: Registrar 2 projetos via API, abrir dashboard, verificar 2 bands
        visualmente
    verifierLabel: manual
  - id: F4-G2
    description: Dashboard funciona com aiDeck antigo (sem /api/projects) via
      fallback single-project
    status: pending
    verifier:
      kind: manual
      description: Apontar dashboard para aiDeck sem rotas /api/projects, verificar
        que homepage carrega normalmente
    verifierLabel: manual
stack:
  - id: 1
    title: Dashboard multi-projeto na HomePage
    type: task
    openedAt: 2026-05-25T17:06:39.511Z
tasks:
  - id: T-001
    title: "API client: getProjects() e getProjectState(projectId)"
    description: "`getProjects()` chama `GET /api/projects`.
      `getProjectState(projectId)` chama `GET
      /api/projects/:id/state/project-status`. Arquivo:
      `atomic-skills/src/dashboard/lib/api.ts`."
    status: done
    lastUpdated: 2026-05-27T07:05:19Z
    closedAt: 2026-05-27T07:05:19Z
  - id: T-002
    title: "Adapter: adaptMultiProjectForHome()"
    description: "Recebe array de `{project, state}`, retorna `UIConsumer[]` com um
      consumer por projeto. Cada consumer tem `id: projectId`, `name:
      projectName`, `path: rootDir`. Arquivo:
      `atomic-skills/src/dashboard/lib/adapters.ts`."
    status: done
    lastUpdated: 2026-05-27T07:05:19Z
    closedAt: 2026-05-27T07:05:19Z
  - id: T-003
    title: HomePage busca todos os projetos
    description: "Novo hook `useMultiProjectState()` que faz getProjects() seguido
      de getProjectState() para cada. Renderiza N ConsumerBands. Fallback: se
      /api/projects retorna 404 (aiDeck antigo), cai no fluxo single-project
      existente. Arquivo: `atomic-skills/src/dashboard/pages/HomePage.tsx`,
      `atomic-skills/src/dashboard/lib/hooks.ts`."
    status: done
    lastUpdated: 2026-05-27T07:05:19Z
    closedAt: 2026-05-27T07:05:19Z
  - id: T-004
    title: SSE invalidation project-aware
    description: "useStateChangeSubscription() usa projectId do evento para
      invalidar apenas as queries daquele projeto. Arquivo:
      `atomic-skills/src/dashboard/lib/hooks.ts`."
    status: done
    lastUpdated: 2026-05-27T07:05:19Z
    closedAt: 2026-05-27T07:05:19Z
parked: []
emerged: []
summary: Nova Home = grid de ProjectCards (rollups + item ativo) no lugar das
  ConsumerBands.
planTitle: Suporte Multi-Projeto no aiDeck
---


# Narrative / notes

Initiative for phase **F4 — Dashboard multi-projeto na HomePage**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
