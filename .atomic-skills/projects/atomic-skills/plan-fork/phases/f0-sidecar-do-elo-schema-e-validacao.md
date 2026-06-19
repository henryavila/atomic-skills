---
schemaVersion: "0.1"
slug: plan-fork-f0-sidecar-do-elo-schema-e-validacao
title: Sidecar do elo, schema e validação
goal: Gravar o elo num sidecar não-aiDeck-facing compatível com aiDeck 0.1.0,
  validar o sidecar, e cobrir detecção de ciclo com testes; a adição dos campos
  inline ao plan.schema.json fica deferida para a migração na F5.
status: active
branch: plan/plan-fork
started: 2026-06-19T15:32:29.603Z
lastUpdated: 2026-06-19T15:32:29.603Z
nextAction: "Start T-001: Sidecar links.json: reader e writer do elo"
parentPlan: plan-fork
phaseId: F0
tasksDone: 0
tasksTotal: 4
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: F0-G1
    description: O elo vive no sidecar; plan.md e frontmatters de fase ficam sem
      spawnedFrom/spawnedPlans sob aiDeck 0.1.0; ciclo é rejeitado; os testes
      passam. O caminho canônico do sidecar (links.json no diretório do plano), o
      schema e o reader/writer (src/links-sidecar.js) ficam definidos aqui na F0,
      antes de qualquer escrita da F1; a concorrência cross-worktree é deferida à
      F2 (pause-only não escreve concorrente).
    status: pending
    verifier:
      kind: shell
      command: npm run validate-state tests/fixtures/plan-fork/parent.plan.md
        tests/fixtures/plan-fork/child.plan.md && npm test
    verifierLabel: "shell: npm run validate-state tests/fixtures/plan-fork/parent.plan…"
stack:
  - id: 1
    title: Sidecar do elo, schema e validação
    type: task
    openedAt: 2026-06-19T15:32:29.603Z
tasks:
  - id: T-001
    title: "Sidecar links.json: reader e writer do elo"
    status: pending
    lastUpdated: 2026-06-19T15:32:29.603Z
    scopeBoundary:
      - não gravar spawnedFrom/spawnedPlans inline no plan.md nem nos
        frontmatters de fase enquanto o pin do aiDeck for 0.1.0; não editar
        código do aiDeck.
    acceptance:
      - o elo (spawnedFrom no filho, spawnedPlans por fase no pai) é gravado e
        lido de links.json no dir do plano; plan.md e os frontmatters de fase
        ficam sem os dois campos sob aiDeck 0.1.0; um teste prova que o estado
        aiDeck-facing (frontmatter) não muda ao forkar.
    verifier:
      kind: shell
      command: npm test
    outputs:
      - kind: file
        path: src/links-sidecar.js
      - kind: file
        path: src/links-sidecar.test.js
    summary: Reader/writer do elo no sidecar links.json (frontmatter fica limpo).
  - id: T-002
    title: Schema de validação do sidecar links.json
    status: pending
    lastUpdated: 2026-06-19T15:32:29.603Z
    scopeBoundary:
      - apenas o schema do sidecar; a adição de spawnedFrom/spawnedPlans ao
        plan.schema.json fica para a F5 (migração), não aqui.
    acceptance:
      - o schema valida spawnedFrom com plan, phaseId, taskId opcional e mode em
        pause ou parallel, e spawnedPlans como array de slugs por fase; rejeita
        mode fora do enum.
    verifier:
      kind: shell
      command: npm test
    outputs:
      - kind: file
        path: meta/schemas/links.schema.json
      - kind: file
        path: src/links-sidecar.test.js
    summary: Schema de validação do sidecar links.json.
  - id: T-003
    title: Helper puro de detecção de ciclo no grafo pai/filho
    status: pending
    lastUpdated: 2026-06-19T15:32:29.603Z
    scopeBoundary:
      - apenas a função pura de detecção sobre o grafo de elos (do sidecar); sem
        I/O, sem mutação; não conectar ao verbo aqui.
    acceptance:
      - dada uma cadeia de elos, a função rejeita um fork que aponte para um
        ancestral (ciclo) e aceita uma cadeia acíclica.
    verifier:
      kind: shell
      command: npm test
    outputs:
      - kind: file
        path: src/spawn-graph.js
      - kind: file
        path: src/spawn-graph.test.js
    summary: Função pura que rejeita fork apontando para ancestral (ciclo).
  - id: T-004
    title: Fixtures de par pai/filho e validação RED para GREEN
    status: pending
    lastUpdated: 2026-06-19T15:32:29.603Z
    scopeBoundary:
      - fixtures de teste apenas; não criar planos reais em .atomic-skills/.
    acceptance:
      - validate-state aprova o par pai/filho com os frontmatters limpos (elo no
        sidecar); o teste fica vermelho antes da T-001 e verde depois.
    outputs:
      - kind: file
        path: tests/fixtures/plan-fork/parent.plan.md
      - kind: file
        path: tests/fixtures/plan-fork/child.plan.md
      - kind: file
        path: tests/links-sidecar.test.js
    summary: Fixtures de par pai/filho (elo no sidecar) + validação RED→GREEN.
    verifier:
      kind: shell
      command: npm test
parked: []
emerged: []
summary: Sidecar (links.json) do elo + schema do sidecar + detecção de ciclo;
  inline deferido.
planTitle: plan-fork — fases que viram planos-filho, com pausa/paralelo e retomada
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F0 — Sidecar do elo, schema e validação**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
