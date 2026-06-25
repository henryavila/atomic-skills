---
schemaVersion: "0.1"
slug: plan-dependencies-f0-modelo-e-grafo-canonico
title: Modelo e grafo canonico
goal: adicionar o contrato exato de `dependsOnPlans[]` e o helper puro que
  calcula edges, bloqueios e ordem topologica entre planos.
status: done
branch: plan/plan-dependencies
started: 2026-06-25T13:43:40.847Z
lastUpdated: 2026-06-25T19:32:16Z
nextAction: F1 is active; start T1.1 in src/links-sidecar.js and tests/links-sidecar.test.js
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
current: false
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
- **Narrative:** F0 `plan-dependencies-f0-modelo-e-grafo-canonico` esta `done` em `plan/plan-dependencies`; T0.1, T0.2 e T0.3 estao fechadas com `evidence.passed: true`. F0-G1 esta `met`, o review-code local degradado esta `approved`, e `plan-dependencies` avancou `currentPhase: F1`. F1 `plan-dependencies-f1-acoplamento-com-planos-emergidos` esta ativa.
- **Decision log:** Mode 1 foi usado em F0 porque `rtk find /Users/henry/.agents -name mode2-codex-lane.md` e `rtk find /Users/henry/.codex -name mode2-codex-lane.md` retornaram `0 for 'mode2-codex-lane.md'`; sem esse contrato, nao houve dispatch Mode 2. Review-code local rodou em modo degradado porque `diff-capture.md` e `briefing-template.txt` nao existem nesta instalacao, e a ferramenta multi-agent carregada diz `Do not spawn sub-agents unless the user explicitly asks for sub-agents, delegation, or parallel agent work.` O `reviewGate` de F0 em `.atomic-skills/projects/atomic-skills/plan-dependencies/plan.md` registra `at: "working-tree@7b16b5f"` porque a revisao local ocorreu antes do commit `ba3e122`.
- **Single nextAction:** Start T1.1 in `src/links-sidecar.js` and `tests/links-sidecar.test.js`, then run `rtk node --test tests/links-sidecar.test.js`.
- **Verbatim state:** Active files: `.atomic-skills/projects/atomic-skills/plan-dependencies/plan.md`, `.atomic-skills/projects/atomic-skills/plan-dependencies/phases/archive/2026-06-f0-modelo-e-grafo-canonico.md`, `.atomic-skills/projects/atomic-skills/plan-dependencies/phases/f1-acoplamento-com-planos-emergidos.md`, `.atomic-skills/analytics/completions.jsonl`. F0-G1 PASS command: `rtk node --test tests/plan-dependencies.test.js tests/validate-state.test.js` exited `0` with `tests 88`, `pass 88`, `fail 0`, `duration_ms 3812.112791` on the post-commit check. Phase event command: `rtk node scripts/append-completion.js --event phase-done --project atomic-skills --plan plan-dependencies --phase F0 --actuals-since 2026-06-25T13:43:40.847Z` exited `0` with `append-completion: phase-done atomic-skills/plan-dependencies/F0 weight=1(count) ✓`. Event line: `{"ts":"2026-06-25T19:33:52.391Z","event":"phase-done","projectId":"atomic-skills","planSlug":"plan-dependencies","phaseId":"F0","taskId":null,"weight":1,"weightBasis":"count","actuals":{"filesChanged":18,"locAdded":1890,"locRemoved":14,"commits":1}}`. Refresh command: `rtk node scripts/refresh-state.js .` exited `0` with `refresh-state: rollups 0 changed, focus 0 changed, digest → plan-dependencies · F1`. Full state command after phase transition: `rtk node scripts/validate-state.js .atomic-skills` exited `0` with `All 129 file(s) valid, 21 plan(s) cross-validated, 1 routing config(s) valid (schemaVersion 0.1/0.2)`. Phase transition timestamp: `2026-06-25T19:32:16Z`; HEAD before transition: `ba3e1228e90e6deabe0aa4e999dab813afc2f7d7`.
- **Uncommitted changes:** ` M .atomic-skills/analytics/completions.jsonl`; ` M .atomic-skills/projects/atomic-skills/PROJECT-STATUS.md`; ` D .atomic-skills/projects/atomic-skills/plan-dependencies/phases/f0-modelo-e-grafo-canonico.md`; ` M .atomic-skills/projects/atomic-skills/plan-dependencies/phases/f1-acoplamento-com-planos-emergidos.md`; ` M .atomic-skills/projects/atomic-skills/plan-dependencies/plan.md`; `?? .atomic-skills/projects/atomic-skills/plan-dependencies/phases/archive/2026-06-f0-modelo-e-grafo-canonico.md`
