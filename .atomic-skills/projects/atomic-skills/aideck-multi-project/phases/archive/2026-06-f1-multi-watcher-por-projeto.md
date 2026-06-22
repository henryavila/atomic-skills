---
schemaVersion: "0.1"
slug: aideck-multi-project-f1-multi-watcher-por-projeto
title: Multi-watcher por projeto
goal: Cada projeto registrado no ProjectRegistry ganha seu proprio watcher
  chokidar, com ciclo de vida gerenciado pelo registry.
status: archived
branch: null
started: 2026-05-25T17:06:39.511Z
lastUpdated: 2026-06-08T01:43:39Z
nextAction: null
parentPlan: aideck-multi-project
phaseId: F1
tasksDone: 4
tasksTotal: 4
gatesMet: 4
gatesTotal: 4
weightDone: 4
weightTotal: 4
exitGates:
  - id: F1-G1
    description: Registrar 2 projetos cria 2 watchers independentes; file change em
      um emite evento apenas para aquele projectId
    status: met
    metAt: 2026-05-25T23:41:26Z
    verifier:
      kind: test
      runner: cd /Volumes/External/code/aideck && npx vitest run
      pattern: -t 'multi-watcher'
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-01T18:34:18Z
      passed: true
      testsCollected: 1
      outputSummary: 1 test(s) passed (exit 0) via `cd /Volumes/External/code/aideck
        && npx vitest run -t 'multi-watcher'` on
        aideck@feat/aideck-v2-generic-runtime
    verifierLabel: "test: cd /Volumes/External/code/aideck && npx vitest run -t 'mult…"
    evidenceSummary: passed · 1 tests · 2026-06-01
  - id: F1-G2
    description: Desregistrar um projeto para o watcher sem afetar o outro
    status: met
    metAt: 2026-05-25T23:41:26Z
    verifier:
      kind: test
      runner: cd /Volumes/External/code/aideck && npx vitest run
      pattern: -t 'unregister watcher'
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-01T18:34:18Z
      passed: true
      testsCollected: 1
      outputSummary: 1 test(s) passed (exit 0) via `cd /Volumes/External/code/aideck
        && npx vitest run -t 'unregister watcher'` on
        aideck@feat/aideck-v2-generic-runtime
    verifierLabel: "test: cd /Volumes/External/code/aideck && npx vitest run -t 'unre…"
    evidenceSummary: passed · 1 tests · 2026-06-01
  - id: F1-G3
    description: Legacy /sse (sem prefixo) emite apenas eventos do projeto default;
      /sse?project=X filtra por projeto
    status: met
    metAt: 2026-05-25T23:41:26Z
    verifier:
      kind: test
      runner: cd /Volumes/External/code/aideck && npx vitest run
      pattern: -t 'sse default project'
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-01T18:34:18Z
      passed: true
      testsCollected: 2
      outputSummary: 2 test(s) passed (exit 0) via `cd /Volumes/External/code/aideck
        && npx vitest run -t 'sse default project'` on
        aideck@feat/aideck-v2-generic-runtime
    verifierLabel: "test: cd /Volumes/External/code/aideck && npx vitest run -t 'sse …"
    evidenceSummary: passed · 2 tests · 2026-06-01
  - id: F1-G4
    description: Watcher error em um projeto nao bloqueia event delivery dos outros projetos
    status: met
    metAt: 2026-05-25T23:41:26Z
    verifier:
      kind: test
      runner: cd /Volumes/External/code/aideck && npx vitest run
      pattern: -t 'watcher isolation'
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-01T18:34:18Z
      passed: true
      testsCollected: 1
      outputSummary: 1 test(s) passed (exit 0) via `cd /Volumes/External/code/aideck
        && npx vitest run -t 'watcher isolation'` on
        aideck@feat/aideck-v2-generic-runtime
    verifierLabel: "test: cd /Volumes/External/code/aideck && npx vitest run -t 'watc…"
    evidenceSummary: passed · 1 tests · 2026-06-01
stack:
  - id: 1
    title: Multi-watcher por projeto
    type: task
    openedAt: 2026-05-25T17:06:39.511Z
tasks:
  - id: T-001
    title: Watcher lifecycle no ProjectRegistry.register()
    description: "Ao registrar um projeto, criar e iniciar um watcher apontando para
      `atomicSkillsRoot(rootDir)`. Ao desregistrar, parar o watcher. Usar a
      mesma factory `createWatcher()` existente. Arquivo:
      `aideck/src/server/project-registry.ts`."
    status: done
    lastUpdated: 2026-05-25T23:41:26Z
    closedAt: 2026-05-25T23:41:26Z
  - id: T-002
    title: Enriquecer eventos com projectId
    description: "EventBus events ganham campo `projectId: string`. O watcher de
      cada projeto emite eventos com o projectId correspondente. Tipos afetados:
      `state-change`, `error`, `annotation-added`, `highlight-added`. Arquivo:
      `aideck/src/server/event-bus.ts`, `aideck/src/server/watcher.ts`."
    status: done
    lastUpdated: 2026-05-25T23:41:26Z
    closedAt: 2026-05-25T23:41:26Z
  - id: T-003
    title: SSE stream inclui projectId
    description: "Eventos SSE enviados ao browser incluem `projectId` no payload
      JSON. Clientes existentes que ignoram o campo continuam funcionando.
      Arquivo: `aideck/src/server/routes/sse.ts`."
    status: done
    lastUpdated: 2026-05-25T23:41:26Z
    closedAt: 2026-05-25T23:41:26Z
  - id: T-004
    title: Remover watcher singleton de startServer
    description: "O watcher que hoje é criado em `buildApp()` passa a ser criado
      pelo ProjectRegistry durante o registro do projeto inicial. Remover
      `opts.skipWatcher` — o registry gerencia isso. Arquivo:
      `aideck/src/server/index.ts`."
    status: done
    lastUpdated: 2026-05-25T23:41:26Z
    closedAt: 2026-05-25T23:41:26Z
parked: []
emerged: []
summary: Watcher chokidar por projeto registrado, com ciclo de vida gerido pelo
  registry.
planTitle: Suporte Multi-Projeto no aiDeck
---


# Narrative / notes

Initiative for phase **F1 — Multi-watcher por projeto**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
