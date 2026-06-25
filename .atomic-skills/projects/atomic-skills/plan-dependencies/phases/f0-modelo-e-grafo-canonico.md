---
schemaVersion: "0.1"
slug: plan-dependencies-f0-modelo-e-grafo-canonico
title: Modelo e grafo canonico
goal: adicionar o contrato exato de `dependsOnPlans[]` e o helper puro que
  calcula edges, bloqueios e ordem topologica entre planos.
status: active
branch: plan/plan-dependencies
started: 2026-06-25T13:43:40.847Z
lastUpdated: 2026-06-25T19:08:11Z
nextAction: Await operator opt-in to advance F0 to F1 via phase-done
parentPlan: plan-dependencies
phaseId: F0
tasksDone: 3
tasksTotal: 3
gatesMet: 1
gatesTotal: 1
weightDone: 8
weightTotal: 8
exitGates:
  - id: F0-G1
    description: Plan schema, graph helper and validate-state cover the exact
      dependsOnPlans contract, release semantics, legacy omission and invalid
      plan-dependency graphs.
    status: met
    metAt: 2026-06-25T19:09:48Z
    verifier:
      kind: shell
      command: rtk node --test tests/plan-dependencies.test.js
        tests/validate-state.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-25T19:09:48Z
      passed: true
      exitCode: 0
      outputSummary: "rtk node --test tests/plan-dependencies.test.js
        tests/validate-state.test.js: tests 88, pass 88, fail 0, duration_ms
        3492.4795"
    verifierLabel: "shell: rtk node --test tests/plan-dependencies.test.js tests/valid…"
    evidenceSummary: passed · 2026-06-25
stack:
  - id: 1
    title: Modelo e grafo canonico
    type: task
    openedAt: 2026-06-25T13:43:40.847Z
tasks:
  - id: T0.1
    title: Add the plan schema field
    description: Adicionar `dependsOnPlans[]` como campo opcional e estrito no
      schema de plano, com shape exato, dedupe e semantica de liberacao.
    status: done
    lastUpdated: 2026-06-25T19:00:24Z
    closedAt: 2026-06-25T19:00:24Z
    scopeBoundary:
      - nao alterar `phases[].dependsOn`, `spawnedFrom`, `phases[].spawnedPlans`
        ou `meta/schemas/initiative.schema.json`
    acceptance:
      - o schema aceita somente entries com `plan`, `createdBy`, `origin`
        coerente e `release.archived` valido; plano legado sem o campo continua
        valido; entradas malformadas falham com erro nomeado
    verifier:
      kind: shell
      command: rtk node --test tests/validate-state.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: meta/schemas/plan.schema.json
      - kind: file
        path: tests/validate-state.test.js
    summary: Adiciona `dependsOnPlans[]` ao schema com shape, dedupe e release.
    weight: 2
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-25T19:00:24Z
      passed: true
      exitCode: 0
      outputSummary: "rtk node --test tests/validate-state.test.js: tests 78, pass 78,
        fail 0, duration_ms 4168.13425"
  - id: T0.2
    title: Implement the plan dependency graph helper
    description: Criar helper puro para montar edges de dependencia e origem,
      calcular planos bloqueados, calcular inversos derivados e detectar ciclos
      antes de qualquer renderizacao.
    status: done
    lastUpdated: 2026-06-25T19:04:38Z
    closedAt: 2026-06-25T19:04:38Z
    scopeBoundary:
      - nao reutilizar `spawnedFrom` como bloqueio implicito e nao modificar
        `src/spawn-graph.js` alem de importacao documentada por teste
    acceptance:
      - testes cobrem edge pai depende do filho, inverse unblocks derivado,
        self-edge rejeitado, referencia orfa rejeitada, ciclo transitivo
        rejeitado, archived bloqueado por default e plano legado sem edges
        aceito
    verifier:
      kind: shell
      command: rtk node --test tests/plan-dependencies.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/plan-dependencies.js
      - kind: file
        path: tests/plan-dependencies.test.js
    summary: Cria o helper puro que calcula bloqueios, inversos e ciclos do grafo.
    weight: 3
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-25T19:04:38Z
      passed: true
      exitCode: 0
      outputSummary: "rtk node --test tests/plan-dependencies.test.js: tests 6, pass
        6, fail 0, duration_ms 116.055375"
  - id: T0.3
    title: Wire dependency validation into state validation
    description: Conectar o helper ao validador de estado para impedir que um grafo
      invalido avance para transicoes, emissores ou dashboard.
    status: done
    lastUpdated: 2026-06-25T19:08:11Z
    closedAt: 2026-06-25T19:08:11Z
    scopeBoundary:
      - nao mudar a regra GATE-R2 de evidencia e nao endurecer tasks antigas que
        nao participam do grafo de planos
    acceptance:
      - validate-state rejeita referencia orfa, self-edge, ciclo direto, ciclo
        transitivo e dependencia cross-project sem suporte; planos legados
        continuam passando
    verifier:
      kind: shell
      command: rtk node --test tests/validate-state.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: scripts/validate-state.js
      - kind: file
        path: tests/validate-state.test.js
    summary: Conecta o grafo ao validate-state para barrar dependencias invalidas.
    weight: 3
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-25T19:08:11Z
      passed: true
      exitCode: 0
      outputSummary: "rtk node --test tests/validate-state.test.js: tests 82, pass 82,
        fail 0, duration_ms 4266.5085"
parked: []
emerged: []
summary: Define o contrato, o schema e o helper que validam dependencias
  executaveis entre planos.
planTitle: plan-dependencies - dependencias executaveis entre planos
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F0 — Modelo e grafo canonico**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

## Self-review against code-quality gates
- G1 read-before-claim: applied — T0.1, T0.2, T0.3, F0-G1, review-code, and validate-state each carry captured command output in `evidence.outputSummary`, `reviewFile`, or `Session handoff`.
- G2 soft-language: applied — completion claims use `evidence.passed: true`, verifier exit codes, test counts, and review verdict `approved`.
- G6 reference-or-strike: applied — handoff literals include exact paths, commands, error text, and `git status --porcelain`; no placeholder markers remain.
- Phase lessons: zero lessons distilled — review-code recorded `0B/0C/0M/0m/0n` in `.atomic-skills/reviews/2026-06-25-1910-plan-dependencies-f0.md`.

## Session handoff
- **Narrative:** F0 `plan-dependencies-f0-modelo-e-grafo-canonico` esta ativa em `plan/plan-dependencies`. T0.1, T0.2 e T0.3 foram fechadas com `evidence.passed: true`; F0-G1 esta `met`; review-code local degradado esta `approved`. A fase aguarda opt-in do operador para avançar F0 -> F1.
- **Decision log:** Mode 1 foi usado porque `rtk find /Users/henry/.agents -name mode2-codex-lane.md` e `rtk find /Users/henry/.codex -name mode2-codex-lane.md` retornaram `0 for 'mode2-codex-lane.md'`; sem esse contrato, nao houve dispatch Mode 2. Review-code local rodou em modo degradado porque `diff-capture.md` e `briefing-template.txt` nao existem nesta instalacao, e a ferramenta multi-agent carregada diz `Do not spawn sub-agents unless the user explicitly asks for sub-agents, delegation, or parallel agent work.` O `reviewGate` de F0 em `.atomic-skills/projects/atomic-skills/plan-dependencies/plan.md` registra `at: "working-tree@7b16b5f"` para nao fingir commit inexistente.
- **Single nextAction:** Ask the operator to approve advancing `plan-dependencies` from F0 to F1; on approval, set F0 `status: done`, set F1 `status: active`, set `currentPhase: F1`, append one `phase-done` completion event, and refresh state.
- **Verbatim state:** Active files: `.atomic-skills/projects/atomic-skills/plan-dependencies/plan.md`, `.atomic-skills/projects/atomic-skills/plan-dependencies/phases/f0-modelo-e-grafo-canonico.md`, `meta/schemas/plan.schema.json`, `tests/validate-state.test.js`, `src/plan-dependencies.js`, `tests/plan-dependencies.test.js`, `scripts/validate-state.js`, `.atomic-skills/analytics/completions.jsonl`, `.atomic-skills/reviews/2026-06-25-1910-plan-dependencies-f0.md`. F0-G1 PASS command: `rtk node --test tests/plan-dependencies.test.js tests/validate-state.test.js` exited `0` with `tests 88`, `pass 88`, `fail 0`, `duration_ms 3492.4795`. Full state command: `rtk node scripts/validate-state.js .atomic-skills` exited `0` with `All 129 file(s) valid, 21 plan(s) cross-validated, 1 routing config(s) valid (schemaVersion 0.1/0.2)`. Local review file: `.atomic-skills/reviews/2026-06-25-1910-plan-dependencies-f0.md` verdict `approved`, counts `0B/0C/0M/0m/0n`.
- **Uncommitted changes:** ` M .atomic-skills/analytics/completions.jsonl`; ` M .atomic-skills/projects/atomic-skills/PROJECT-STATUS.md`; ` M .atomic-skills/projects/atomic-skills/aideck-dashboard-lifecycle-views/phases/aideck-dashboard-lifecycle-views.md`; ` M .atomic-skills/projects/atomic-skills/aideck-dashboard-lifecycle-views/plan.md`; ` M .atomic-skills/reviews/INDEX.md`; ` M meta/schemas/plan.schema.json`; ` M scripts/validate-state.js`; ` M tests/validate-state.test.js`; `?? .atomic-skills/projects/atomic-skills/plan-dependencies/`; `?? .atomic-skills/reviews/2026-06-25-1115-plan-dependencies.md`; `?? .atomic-skills/reviews/2026-06-25-1910-plan-dependencies-f0.md`; `?? src/plan-dependencies.js`; `?? tests/plan-dependencies.test.js`
