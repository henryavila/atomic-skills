---
schemaVersion: "0.1"
slug: aideck-multi-project-f2-rotas-project-scoped-no-aideck
title: Rotas project-scoped no aiDeck
goal: Adicionar rotas prefixadas por projectId para acessar state, entities e
  inbox de projetos especificos.
status: archived
branch: null
started: 2026-05-25T17:06:39.511Z
lastUpdated: 2026-06-08T01:43:39Z
nextAction: null
parentPlan: aideck-multi-project
phaseId: F2
tasksDone: 4
tasksTotal: 4
gatesMet: 2
gatesTotal: 2
exitGates:
  - id: F2-G1
    description: GET /api/projects/:id/state/project-status retorna state do projeto correto
    status: met
    metAt: 2026-05-25T23:41:26Z
    verifier:
      kind: test
      runner: cd /Volumes/External/code/aideck && npx vitest run
      pattern: -t 'project-scoped state'
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-01T18:34:18Z
      passed: true
      testsCollected: 3
      outputSummary: 3 test(s) passed (exit 0) via `cd /Volumes/External/code/aideck
        && npx vitest run -t 'project-scoped state'` on
        aideck@feat/aideck-v2-generic-runtime
    verifierLabel: "test: cd /Volumes/External/code/aideck && npx vitest run -t 'proj…"
    evidenceSummary: passed · 3 tests · 2026-06-01
  - id: F2-G2
    description: Rotas existentes sem prefixo continuam retornando state do projeto default
    status: met
    metAt: 2026-05-25T23:41:26Z
    verifier:
      kind: test
      runner: cd /Volumes/External/code/aideck && npx vitest run
      pattern: -t 'backward-compat'
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-01T18:34:18Z
      passed: true
      testsCollected: 7
      outputSummary: 7 test(s) passed (exit 0) via `cd /Volumes/External/code/aideck
        && npx vitest run -t 'backward-compat'` on
        aideck@feat/aideck-v2-generic-runtime
    verifierLabel: "test: cd /Volumes/External/code/aideck && npx vitest run -t 'back…"
    evidenceSummary: passed · 7 tests · 2026-06-01
stack:
  - id: 1
    title: Rotas project-scoped no aiDeck
    type: task
    openedAt: 2026-05-25T17:06:39.511Z
tasks:
  - id: T-001
    title: Rotas /api/projects/:projectId/state/:consumer
    description: "Busca rootDir no registry pelo projectId, chama
      buildAllForConsumer com esse rootDir. 404 se projectId nao registrado.
      Arquivo: `aideck/src/server/routes/api.ts`."
    status: done
    lastUpdated: 2026-05-25T23:41:26Z
    closedAt: 2026-05-25T23:41:26Z
  - id: T-002
    title: Rotas /api/projects/:projectId/state/:consumer/:slug
    description: "Mesmo pattern para entity lookup. Arquivo:
      `aideck/src/server/routes/api.ts`."
    status: done
    lastUpdated: 2026-05-25T23:41:26Z
    closedAt: 2026-05-25T23:41:26Z
  - id: T-003
    title: Backward-compat nas rotas existentes
    description: "`/api/state/:consumer` continua funcionando: usa o projeto default
      do registry. Nenhuma rota existente muda de comportamento. Arquivo:
      `aideck/src/server/routes/api.ts`."
    status: done
    lastUpdated: 2026-05-25T23:41:26Z
    closedAt: 2026-05-25T23:41:26Z
  - id: T-004
    title: Rotas de inbox/annotate/highlight project-scoped
    description: "`/api/projects/:projectId/inbox`,
      `/api/projects/:projectId/annotate`, etc. As rotas sem prefixo continuam
      usando o default. Arquivo: `aideck/src/server/routes/api.ts`."
    status: done
    lastUpdated: 2026-05-25T23:41:26Z
    closedAt: 2026-05-25T23:41:26Z
parked: []
emerged: []
summary: Rotas prefixadas por projectId (state/entities/inbox de cada projeto).
planTitle: Suporte Multi-Projeto no aiDeck
---


# Narrative / notes

Initiative for phase **F2 — Rotas project-scoped no aiDeck**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
