---
schemaVersion: "0.1"
slug: plan-dependencies-f2-projecao-aideck-e-api-de-dependencias
title: Projecao aiDeck e API de dependencias
goal: expor dependencia e origem de planos como dados denormalizados para o
  consumer, mantendo compatibilidade com dependencias de fase e task.
status: done
branch: plan/plan-dependencies
started: 2026-06-25T13:43:40.847Z
lastUpdated: 2026-06-26T00:49:43Z
nextAction: F3 is active; start T3.1 in assets/aideck-consumer/manifest.yaml and tests/aideck-consumer-manifest.test.js
parentPlan: plan-dependencies
phaseId: F2
tasksDone: 3
tasksTotal: 3
gatesMet: 1
gatesTotal: 1
weightDone: 7
weightTotal: 7
exitGates:
  - id: F2-G1
    description: aiDeck state emits and validates plan dependency and origin edges,
      and get-dependencies supports scope plan.
    status: met
    metAt: 2026-06-26T00:14:56Z
    verifier:
      kind: shell
      command: rtk node --test tests/emit-consumer-state.test.js
        tests/aideck-state-schema.test.js tests/aideck-consumer-handlers.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-26T00:14:56Z
      passed: true
      exitCode: 0
      outputSummary: "rtk node --test tests/emit-consumer-state.test.js
        tests/aideck-state-schema.test.js
        tests/aideck-consumer-handlers.test.js: tests 55, pass 55, fail 0,
        duration_ms 914.824958"
    verifierLabel: "shell: rtk node --test tests/emit-consumer-state.test.js tests/aid…"
    evidenceSummary: passed · 2026-06-26
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
    status: done
    closedAt: 2026-06-26T00:07:20Z
    lastUpdated: 2026-06-26T00:07:20Z
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
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-26T00:07:20Z
      passed: true
      exitCode: 0
      outputSummary: "rtk node --test tests/emit-consumer-state.test.js: tests 18,
        pass 18, fail 0, duration_ms 306.716542"
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
    status: done
    closedAt: 2026-06-26T00:10:41Z
    lastUpdated: 2026-06-26T00:10:41Z
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
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-26T00:10:41Z
      passed: true
      exitCode: 0
      outputSummary: "rtk node --test tests/aideck-state-schema.test.js && rtk node
        scripts/build-aideck-consumer-schema.mjs --check: tests 4, pass 4, fail
        0, duration_ms 778.689958; schema.json up to date"
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
    status: done
    closedAt: 2026-06-26T00:13:39Z
    lastUpdated: 2026-06-26T00:13:39Z
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
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-26T00:13:39Z
      passed: true
      exitCode: 0
      outputSummary: "rtk node --test tests/aideck-consumer-handlers.test.js: tests
        33, pass 33, fail 0, duration_ms 150.333666"
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
current: false
---

# Narrative / notes

Initiative for phase **F2 — Projecao aiDeck e API de dependencias**.

## Decisions

- 2026-06-26T00:07:20Z: Mode 2 nao foi usado porque o contrato obrigatorio
  `/Users/henry/.agents/skills/atomic-skills/shared/mode2-codex-lane.md` nao
  existe neste ambiente; T2.1 rodou em Mode 1 no worktree
  `/Volumes/External/code/atomic-skills/.worktrees/plan-dependencies`.
- 2026-06-26T00:07:20Z: T2.1 manteve a atualizacao de schema para T2.2; o teste
  `tests/emit-consumer-state.test.js` valida a emissao de `planEdges.json` sem
  exigir que `meta/schemas/aideck-state.schema.json` aceite os novos campos
  nesta task.
- 2026-06-26T00:10:41Z: T2.2 adicionou `planEdges` e os novos campos de
  `plans` em `meta/schemas/aideck-state.schema.json`; o bundle
  `assets/aideck-consumer/schema.json` foi regenerado com
  `rtk node scripts/build-aideck-consumer-schema.mjs`.
- 2026-06-26T00:13:39Z: T2.3 adicionou `scope: plan` em
  `assets/aideck-consumer/handlers/get-dependencies.js`, lendo `planEdges` e
  preservando os escopos `phase` e `task` cobertos por
  `tests/aideck-consumer-handlers.test.js`.

## Links

_(plan doc, external refs)_

## Self-review against code-quality gates

- G1 read-before-claim: aplicado - cada task fechada carrega evidencia `passed: true` com o comando do verifier em `tasks[].evidence`; o review cita linhas de fonte em `.atomic-skills/reviews/2026-06-26-0015-plan-dependencies-f2.md`.
- G2 soft-language: aplicado - claims de conclusao usam `passed: true` e `status: passed`; o handoff foi revisado contra a lista G2.
- G6 reference-or-strike: aplicado - o handoff lista paths, comandos, outputs e `git status --porcelain` literais.
- Codex review: nao invocado como revisao cross-model nesta transicao; o review gate de F2 ja estava registrado como `reviewGate: { status: passed, at: "working-tree@436330a", mode: local, reviewFile: .atomic-skills/reviews/2026-06-26-0015-plan-dependencies-f2.md, verifiedAt: 2026-06-26T00:15:00Z }`.
- Review gate (G2): registrado no phase descriptor de `.atomic-skills/projects/atomic-skills/plan-dependencies/plan.md` antes de F2 mudar para `status: done`.
- Lessons (G1): no lessons distilled (clean phase); `.atomic-skills/reviews/2026-06-26-0015-plan-dependencies-f2.md` lista `No blocker, critical, major, or minor findings.`

## Session handoff
- **Narrative:** F2 esta fechada como `status: done` e arquivada em `.atomic-skills/projects/atomic-skills/plan-dependencies/phases/archive/2026-06-f2-projecao-aideck-e-api-de-dependencias.md`. T2.1, T2.2 e T2.3 carregam `evidence.passed: true`, F2-G1 esta `met`, e o review gate aponta para `.atomic-skills/reviews/2026-06-26-0015-plan-dependencies-f2.md`. F3 esta ativa em `.atomic-skills/projects/atomic-skills/plan-dependencies/phases/f3-dashboard-caminho-de-execucao.md`.
- **Decision log:** Mode 2 ficou indisponivel porque `rtk find /Users/henry/.agents -path '*mode2-codex-lane.md' -print` retornou `0 for '/Users/henry/.agents'`; T2.1, T2.2 e T2.3 rodaram em Mode 1. T2.2 regenerou `assets/aideck-consumer/schema.json` com `rtk node scripts/build-aideck-consumer-schema.mjs`, incluindo tambem defs ja presentes em `meta/schemas/plan.schema.json`. Review-code rodou em fallback local inline porque os assets `diff-capture.md`, `briefing-template.txt` e `anti-framing-directive.txt` nao existem sob `/Users/henry/.agents`, e subagente nao foi usado sem pedido explicito do usuario.
- **Single nextAction:** Continue from the active F3 handoff in `.atomic-skills/projects/atomic-skills/plan-dependencies/phases/f3-dashboard-caminho-de-execucao.md`.
- **Verbatim state:** `rtk node --test tests/emit-consumer-state.test.js tests/aideck-state-schema.test.js tests/aideck-consumer-handlers.test.js` => `tests 55`, `pass 55`, `fail 0`, `duration_ms 914.824958`. `rtk node scripts/append-completion.js --event phase-done --project atomic-skills --plan plan-dependencies --phase F2 --actuals-since 2026-06-25T13:43:40.847Z` => `append-completion: phase-done atomic-skills/plan-dependencies/F2 weight=1(count) ✓`. `rtk node scripts/refresh-state.js` => `refresh-state: rollups 0 changed, focus 1 changed, digest → plan-dependencies · F3`.
- **Uncommitted changes:** see active F3 handoff in `.atomic-skills/projects/atomic-skills/plan-dependencies/phases/f3-dashboard-caminho-de-execucao.md`.
