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
tasksDone: 1
tasksTotal: 4
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: F0-G1
    description: O elo vive no sidecar; plan.md e frontmatters de fase ficam sem
      spawnedFrom/spawnedPlans sob aiDeck 0.1.0; ciclo é rejeitado; os testes
      passam. O caminho canônico do sidecar (links.json no diretório do plano),
      o schema e o reader/writer (src/links-sidecar.js) ficam definidos aqui na
      F0, antes de qualquer escrita da F1; a concorrência cross-worktree é
      deferida à F2 (pause-only não escreve concorrente).
    status: pending
    verifier:
      kind: shell
      command: npm run validate-state tests/fixtures/plan-fork/parent.plan.md
        tests/fixtures/plan-fork/child.plan.md && node --test
        tests/links-sidecar.test.js tests/spawn-graph.test.js
    verifierLabel: "shell: npm run validate-state tests/fixtures/plan-fork/parent.plan…"
stack:
  - id: 1
    title: Sidecar do elo, schema e validação
    type: task
    openedAt: 2026-06-19T15:32:29.603Z
tasks:
  - id: T-001
    title: "Sidecar links.json: reader e writer do elo"
    status: done
    closedAt: 2026-06-19T17:06:40.000Z
    lastUpdated: 2026-06-19T17:06:40.000Z
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
      command: node --test tests/links-sidecar.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T17:06:40.000Z
      exitCode: 0
      passed: true
      outputSummary: node --test tests/links-sidecar.test.js → tests 10, pass 10, fail
        0 (exit 0)
    outputs:
      - kind: file
        path: src/links-sidecar.js
      - kind: file
        path: tests/links-sidecar.test.js
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
      command: node --test tests/links-sidecar.test.js
    outputs:
      - kind: file
        path: meta/schemas/links.schema.json
      - kind: file
        path: tests/links-sidecar.test.js
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
      command: node --test tests/spawn-graph.test.js
    outputs:
      - kind: file
        path: src/spawn-graph.js
      - kind: file
        path: tests/spawn-graph.test.js
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
      command: node --test tests/links-sidecar.test.js
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

## Session handoff

- **Narrative:** F0 em andamento — T-001 (reader/writer do sidecar `links.json`) FECHADA via verifier verde (`node --test tests/links-sidecar.test.js` → tests 10 / pass 10 / fail 0, exit 0), evidence GATE-R2 gravada, `validate-state` ✓. F0 está 1/4 tasks. Baseline do plano + 3 reviews em `6e5a4f2`; o trabalho da T-001 está por cima (a commitar como checkpoint).
- **Decision log:** (1) round-3 codex-only ANTES de implementar (3C→2C→0C; 5 majors aplicados doc-only, sem round-4); (2) **verifier `npm test` está RED no baseline** — 10 falhas ambientais (dashboard não-buildado + install), provadas por stash. O dashboard está sendo refeito em OUTRA worktree por outro agente → NÃO buildo aqui (evitaria atropelar o `~/.atomic-skills/dashboard` compartilhado). 7º achado (round-3 não pegou: verifier `npm test` amplo/acoplado ao ambiente). Fix: verifiers da F0 escopados a `node --test tests/links-sidecar.test.js`/`tests/spawn-graph.test.js`; (3) testes vão em `tests/` — `src/*.test.js` NÃO é coletado pelo glob do `npm test` (false-green); T-003 test path corrigido p/ `tests/spawn-graph.test.js`.
- **Single nextAction:** Implementar F0/T-002 (TDD) — `meta/schemas/links.schema.json` validando spawnedFrom {plan, phaseId, taskId?, mode ∈ pause|parallel} + spawnedPlans (array de slugs por fase), rejeitando mode fora do enum; adicionar casos ao `tests/links-sidecar.test.js`. Verifier: `node --test tests/links-sidecar.test.js`.
- **Verbatim state:** worktree `/home/henry/atomic-skills/.worktrees/plan-fork`; branch `plan/plan-fork`; HEAD `6e5a4f2` (+ T-001 a commitar). F0-G1 gate (escopado): `npm run validate-state tests/fixtures/plan-fork/parent.plan.md tests/fixtures/plan-fork/child.plan.md && node --test tests/links-sidecar.test.js tests/spawn-graph.test.js`. T-001 evidence: verifierKind shell, exitCode 0, passed true, "tests 10, pass 10, fail 0". Review round-3: `.atomic-skills/reviews/2026-06-19-1324-plan-fork-r3.md`.
- **Uncommitted changes:** novos `src/links-sidecar.js`, `tests/links-sidecar.test.js`; `M` em plan.md + phases f0/f1/f5 (T-001 done + verifier-scoping + verifierLabel backfill) + `.atomic-skills/focus.json` (digest).
