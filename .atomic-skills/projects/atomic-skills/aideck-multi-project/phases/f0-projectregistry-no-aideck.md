---
schemaVersion: "0.1"
slug: aideck-multi-project-f0-projectregistry-no-aideck
title: ProjectRegistry no aiDeck
goal: Criar a estrutura ProjectRegistry in-memory e a API de
  registro/desregistro/listagem de projetos no aiDeck server.
status: done
branch: null
started: 2026-05-25T17:06:39.511Z
lastUpdated: 2026-05-25T23:41:26Z
nextAction: null
parentPlan: aideck-multi-project
phaseId: F0
tasksDone: 5
tasksTotal: 5
gatesMet: 4
gatesTotal: 5
exitGates:
  - id: F0-G1
    description: POST /api/projects/register aceita rootDir, cria entrada no
      registry, retorna 201
    status: met
    metAt: 2026-05-25T23:41:26Z
    verifier:
      kind: test
      runner: cd /Volumes/External/code/aideck && npx vitest run
      pattern: -t 'register'
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-01T18:34:18Z
      passed: true
      testsCollected: 44
      outputSummary: 44 test(s) passed (exit 0) via `cd /Volumes/External/code/aideck
        && npx vitest run -t 'register'` on
        aideck@feat/aideck-v2-generic-runtime
    verifierLabel: "test: cd /Volumes/External/code/aideck && npx vitest run -t 'regi…"
    evidenceSummary: passed · 44 tests · 2026-06-01
  - id: F0-G2
    description: GET /api/projects lista projetos registrados
    status: met
    metAt: 2026-05-25T23:41:26Z
    verifier:
      kind: test
      runner: cd /Volumes/External/code/aideck && npx vitest run
      pattern: -t 'projects'
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-01T18:34:18Z
      passed: true
      testsCollected: 11
      outputSummary: 11 test(s) passed (exit 0) via `cd /Volumes/External/code/aideck
        && npx vitest run -t 'projects'` on
        aideck@feat/aideck-v2-generic-runtime
    verifierLabel: "test: cd /Volumes/External/code/aideck && npx vitest run -t 'proj…"
    evidenceSummary: passed · 11 tests · 2026-06-01
  - id: F0-G3
    description: /api/health retorna campo projects[] com ao menos o projeto default
    status: pending
    verifier:
      kind: test
      runner: cd /Volumes/External/code/aideck && npx vitest run
      pattern: -t 'health includes projects'
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-01T18:34:18Z
      passed: false
      testsCollected: 0
      outputSummary: 0 tests matched `-t 'health includes projects'` — gate cannot be
        confirmed; behavior may be tested under a different name
    verifierLabel: "test: cd /Volumes/External/code/aideck && npx vitest run -t 'heal…"
  - id: F0-G4
    description: Register rejeita rootDir inexistente, rootDir sem .atomic-skills/,
      e rootDir duplicado com id diferente
    status: met
    metAt: 2026-05-25T23:41:26Z
    verifier:
      kind: test
      runner: cd /Volumes/External/code/aideck && npx vitest run
      pattern: -t 'register validation'
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-01T18:34:18Z
      passed: true
      testsCollected: 4
      outputSummary: 4 test(s) passed (exit 0) via `cd /Volumes/External/code/aideck
        && npx vitest run -t 'register validation'` on
        aideck@feat/aideck-v2-generic-runtime
    verifierLabel: "test: cd /Volumes/External/code/aideck && npx vitest run -t 'regi…"
    evidenceSummary: passed · 4 tests · 2026-06-01
  - id: F0-G5
    description: Register com mesmo rootDir retorna 200 idempotente (nao duplica entrada)
    status: met
    metAt: 2026-05-25T23:41:26Z
    verifier:
      kind: test
      runner: cd /Volumes/External/code/aideck && npx vitest run
      pattern: -t 'register idempotent'
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-01T18:34:18Z
      passed: true
      testsCollected: 2
      outputSummary: 2 test(s) passed (exit 0) via `cd /Volumes/External/code/aideck
        && npx vitest run -t 'register idempotent'` on
        aideck@feat/aideck-v2-generic-runtime
    verifierLabel: "test: cd /Volumes/External/code/aideck && npx vitest run -t 'regi…"
    evidenceSummary: passed · 2 tests · 2026-06-01
stack:
  - id: 1
    title: ProjectRegistry no aiDeck
    type: task
    openedAt: 2026-05-25T17:06:39.511Z
tasks:
  - id: T-001
    title: Criar ProjectRegistry class
    description: "Classe com Map<projectId, {rootDir, name, watcher, registeredAt}>.
      Métodos: register(id, rootDir, name?), unregister(id), get(id), list(),
      getDefault(). O primeiro projeto registrado é marcado como default.
      Arquivo: `aideck/src/server/project-registry.ts`."
    status: done
    lastUpdated: 2026-05-25T23:41:26Z
    closedAt: 2026-05-25T23:41:26Z
  - id: T-002
    title: Integrar ProjectRegistry no startServer
    description: "ServerOptions.rootDir vira o primeiro registro automático
      (projectId derivado de basename(rootDir)). ApiDeps ganha referência ao
      registry em vez de rootDir scalar. Arquivo: `aideck/src/server/index.ts`."
    status: done
    lastUpdated: 2026-05-25T23:41:26Z
    closedAt: 2026-05-25T23:41:26Z
  - id: T-003
    title: Rota POST /api/projects/register
    description: "Body: `{ id?, rootDir, name? }`. Se id omitido, deriva de
      basename(rootDir). Retorna 201 com o projeto registrado. Se rootDir já
      registrado, retorna 200 idempotente. Validação: rootDir deve existir e
      conter `.atomic-skills/`. Arquivo: `aideck/src/server/routes/api.ts`."
    status: done
    lastUpdated: 2026-05-25T23:41:26Z
    closedAt: 2026-05-25T23:41:26Z
  - id: T-004
    title: Rotas GET /api/projects e DELETE /api/projects/:id
    description: "GET lista todos os projetos registrados com rootDir, name,
      registeredAt, health. DELETE para e remove watcher + entrada do registry.
      Arquivo: `aideck/src/server/routes/api.ts`."
    status: done
    lastUpdated: 2026-05-25T23:41:26Z
    closedAt: 2026-05-25T23:41:26Z
  - id: T-005
    title: Atualizar /api/health para multi-projeto
    description: "Retornar `projects: [{id, rootDir, name}]` em vez de `rootDir:
      string`. Manter `rootDir` no response por backward-compat (aponta para o
      default). Arquivo: `aideck/src/server/routes/api.ts`."
    status: done
    lastUpdated: 2026-05-25T23:41:26Z
    closedAt: 2026-05-25T23:41:26Z
parked: []
emerged: []
summary: ProjectRegistry in-memory + API de registro/desregistro/listagem de
  projetos no aiDeck server.
planTitle: Suporte Multi-Projeto no aiDeck
---

# Narrative / notes

Initiative for phase **F0 — ProjectRegistry no aiDeck**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
