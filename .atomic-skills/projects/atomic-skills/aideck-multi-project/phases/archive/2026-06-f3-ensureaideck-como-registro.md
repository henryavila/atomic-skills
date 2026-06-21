---
schemaVersion: "0.1"
slug: aideck-multi-project-f3-ensureaideck-como-registro
title: ensureAideck como registro
goal: Modificar ensureAideck() no atomic-skills para registrar o projeto no
  aiDeck existente em vez de matar e reiniciar.
status: archived
branch: null
started: 2026-05-25T17:06:39.511Z
lastUpdated: 2026-06-08T01:43:39Z
nextAction: null
parentPlan: aideck-multi-project
phaseId: F3
tasksDone: 3
tasksTotal: 3
gatesMet: 2
gatesTotal: 2
weightDone: 3
weightTotal: 3
exitGates:
  - id: F3-G1
    description: ensureAideck de projeto B com aiDeck rodando para projeto A
      registra B sem matar A
    status: met
    metAt: 2026-05-25T23:41:26Z
    verifier:
      kind: test
      runner: node --test
      pattern: tests/serve.test.js
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-01T18:34:18Z
      passed: true
      testsCollected: 16
      outputSummary: 16 test(s) passed (exit 0) via `node --test tests/serve.test.js`
        on aideck@feat/aideck-v2-generic-runtime
    verifierLabel: "test: node --test tests/serve.test.js"
    evidenceSummary: passed · 16 tests · 2026-06-01
  - id: F3-G2
    description: projectId derivado do CWD e validado como slug
    status: met
    metAt: 2026-05-25T23:41:26Z
    verifier:
      kind: test
      runner: node --test
      pattern: tests/serve.test.js
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-01T18:34:18Z
      passed: true
      testsCollected: 16
      outputSummary: 16 test(s) passed (exit 0) via `node --test tests/serve.test.js`
        on aideck@feat/aideck-v2-generic-runtime
    verifierLabel: "test: node --test tests/serve.test.js"
    evidenceSummary: passed · 16 tests · 2026-06-01
stack:
  - id: 1
    title: ensureAideck como registro
    type: task
    openedAt: 2026-05-25T17:06:39.511Z
tasks:
  - id: T-001
    title: Substituir kill+restart por POST /api/projects/register
    description: "Quando rootDir difere do aiDeck rodando, chamar `POST
      /api/projects/register` com `{ rootDir: cwd, id: derivedId }`. Se register
      retorna 200/201, retornar a URL com `?project=derivedId`. Arquivo:
      `atomic-skills/src/serve.js` linhas 200-224."
    status: done
    lastUpdated: 2026-05-25T23:41:26Z
    closedAt: 2026-05-25T23:41:26Z
  - id: T-002
    title: Derivar projectId do CWD
    description: "`basename(cwd)` kebab-cased, truncado a 63 chars. Se colisao com
      id existente mas rootDir diferente, append numerico (`-2`, `-3`). Arquivo:
      `atomic-skills/src/serve.js`."
    status: done
    lastUpdated: 2026-05-25T23:41:26Z
    closedAt: 2026-05-25T23:41:26Z
  - id: T-003
    title: Atualizar contract test aideck-contract.test.js
    description: "O teste que valida o fluxo ensureAideck precisa cobrir o cenario
      multi-projeto: aiDeck rodando com projeto A, ensureAideck chamado de
      projeto B registra B sem matar A. Arquivo:
      `atomic-skills/tests/aideck-contract.test.js`."
    status: done
    lastUpdated: 2026-05-25T23:41:26Z
    closedAt: 2026-05-25T23:41:26Z
parked: []
emerged: []
summary: ensureAideck passa a registrar o projeto no aiDeck existente em vez de
  matar e reiniciar.
planTitle: Suporte Multi-Projeto no aiDeck
---


# Narrative / notes

Initiative for phase **F3 — ensureAideck como registro**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
