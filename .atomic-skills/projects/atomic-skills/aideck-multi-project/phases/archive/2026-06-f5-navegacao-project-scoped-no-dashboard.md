---
schemaVersion: "0.1"
slug: aideck-multi-project-f5-navegacao-project-scoped-no-dashboard
title: Navegacao project-scoped no Dashboard
goal: Rotas, links e navigation do dashboard incluem contexto de projeto para
  que planos/iniciativas de projetos diferentes nao colidam.
status: archived
branch: null
started: 2026-05-25T17:06:39.511Z
lastUpdated: 2026-06-08T01:43:39Z
nextAction: "Start T-001: Rotas com prefixo /:projectId"
parentPlan: aideck-multi-project
phaseId: F5
tasksDone: 0
tasksTotal: 4
gatesMet: 0
gatesTotal: 2
weightDone: 0
weightTotal: 4
exitGates:
  - id: F5-G1
    description: Clicar num plano do projeto B navega para /project-b/plans/slug
      (nao /plans/slug)
    status: pending
    verifier:
      kind: manual
      description: Registrar 2 projetos, clicar num plano do segundo, verificar URL
        inclui projectId
    verifierLabel: manual
  - id: F5-G2
    description: Rotas sem prefixo continuam funcionando para backward-compat
    status: pending
    verifier:
      kind: manual
      description: Abrir /plans/existing-slug sem projectId, verificar que carrega o
        plano do projeto default
    verifierLabel: manual
stack:
  - id: 1
    title: Navegacao project-scoped no Dashboard
    type: task
    openedAt: 2026-05-25T17:06:39.511Z
tasks:
  - id: T-001
    title: Rotas com prefixo /:projectId
    description: "`/:projectId/plans/:slug`, `/:projectId/initiatives/:slug`,
      `/:projectId/discover`. Rotas sem prefixo continuam funcionando (usam
      projeto default). Arquivo: `atomic-skills/src/dashboard/App.tsx`."
    status: pending
    lastUpdated: 2026-05-25T17:06:39.511Z
  - id: T-002
    title: ConsumerBand links usam projectId
    description: "Cada PlanRow e InitiativeRow navega para `/:projectId/plans/:slug`
      em vez de `/plans/:slug`. Arquivo:
      `atomic-skills/src/dashboard/components/home/HomeComponents.tsx`."
    status: pending
    lastUpdated: 2026-05-25T17:06:39.511Z
  - id: T-003
    title: PlanPage e InitiativePage extraem projectId do URL
    description: "`useParams()` extrai projectId, passa para as chamadas de API
      project-scoped. Arquivo: `atomic-skills/src/dashboard/pages/PlanPage.tsx`,
      `atomic-skills/src/dashboard/pages/InitiativePage.tsx`."
    status: pending
    lastUpdated: 2026-05-25T17:06:39.511Z
  - id: T-004
    title: Project selector no TopChrome
    description: "Dropdown ou breadcrumb no header mostrando o projeto ativo, com
      link para home. Arquivo:
      `atomic-skills/src/dashboard/components/layout/LayoutShell.tsx`."
    status: pending
    lastUpdated: 2026-05-25T17:06:39.511Z
parked: []
emerged: []
summary: Project Detail = drill-in com Roadmap por lanes (in flight / blocked /
  up next / parked / shipped).
planTitle: Suporte Multi-Projeto no aiDeck
---


# Narrative / notes

Initiative for phase **F5 — Navegacao project-scoped no Dashboard**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
