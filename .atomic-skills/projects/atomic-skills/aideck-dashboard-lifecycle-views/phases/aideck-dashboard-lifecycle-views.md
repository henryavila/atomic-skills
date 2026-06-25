---
schemaVersion: "0.1"
slug: aideck-dashboard-lifecycle-views
title: Reorganizar ciclo de vida das telas do dashboard
goal: Separar trabalho aberto, concluido recente e arquivado no dashboard aiDeck.
status: done
branch: develop
started: 2026-06-25T12:55:57Z
lastUpdated: 2026-06-25T15:18:49Z
nextAction: "Plano concluido: revisar diff final e decidir commit/archive."
parentPlan: aideck-dashboard-lifecycle-views
phaseId: F0
tasksDone: 1
tasksTotal: 1
gatesMet: 1
gatesTotal: 1
weightDone: 1
weightTotal: 1
exitGates:
  - id: G-1
    description: "Panorama, Foco agora, Visao geral e Arquivados exibem estados sem
      duplicar listas operacionais: ativos/pausados/travados ficam no fluxo
      aberto; done aparece em Visao geral; archived aparece apenas em
      Arquivados."
    status: met
    metAt: 2026-06-25T15:14:56Z
    verifier:
      kind: manual
      description: Validar no dashboard aiDeck com o projeto atomic-skills.
    evidence:
      verifierKind: manual
      verifiedAt: 2026-06-25T15:14:56Z
      passed: true
      outputSummary: "Live aiDeck http://127.0.0.1:7777 exposes pages:
        panorama:Panorama,foco-agora:Foco agora,visao-geral:Visão
        geral,plan:Detalhe do plano,arquivados:Arquivados,help:Ajuda; npm run
        verify:aideck:smoke passed 6 data routes, 0 failed."
    verifierLabel: manual
    evidenceSummary: passed · 2026-06-25
stack:
  - id: 1
    title: Reorganizar ciclo de vida das telas do dashboard
    type: task
    openedAt: 2026-06-25T12:55:57Z
tasks:
  - id: T-001
    title: Realinhar views do dashboard por ciclo de vida
    status: done
    lastUpdated: 2026-06-25T15:11:19Z
    closedAt: 2026-06-25T15:11:19Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-25T15:11:19Z
      passed: true
      exitCode: 0
      outputSummary: node --test tests/aideck-consumer-manifest.test.js exit 0; tests
        31, suites 7, pass 31, fail 0, duration_ms 190.707125.
    summary: Realinha Panorama, Foco agora, Visao geral e Arquivados aos estados do
      ciclo de vida.
    description: "Arquivos exatos: assets/aideck-consumer/manifest.yaml e
      tests/aideck-consumer-manifest.test.js. Realinhar os filtros e labels das
      views do dashboard aiDeck para separar trabalho aberto, conclusao recente
      e historico arquivado."
    weight: 1
    tags:
      - aideck
      - dashboard
      - manifest
    scopeBoundary:
      - Editar apenas assets/aideck-consumer/manifest.yaml e
        tests/aideck-consumer-manifest.test.js.
      - Nao alterar emitter, schema aiDeck, handlers MCP, runtime layer ou
        codigo do pacote @henryavila/aideck.
    acceptance:
      - "Panorama e Foco agora listam somente trabalho operacional aberto:
        active, paused e blocked; done e archived nao entram nesses fluxos."
      - Visao geral exibe frentes done como conclusao recente, sem archived.
      - Arquivados existe como view separada e exibe somente status archived.
      - Nenhuma view operacional duplica archived; nenhuma view de arquivados
        duplica active, paused, blocked ou done.
    verifier:
      kind: shell
      command: node --test tests/aideck-consumer-manifest.test.js
      expectExitCode: 0
    provenance:
      surfacedAt: 2026-06-25T15:08:57Z
      surfacedDuring: aideck-dashboard-lifecycle-views
      surfacedBy: human
    context:
      solves: O dashboard mistura conclusao recente com historico frio, fazendo done e
        archived aparecerem no mesmo fluxo operacional.
      trigger: A fase aideck-dashboard-lifecycle-views foi criada com nextAction para
        realinhar labels, filtros e secoes do manifest aiDeck, mas ainda nao
        tinha T-001 materializada.
      assumesStillValid:
        - O dashboard continua sendo governado por
          assets/aideck-consumer/manifest.yaml.
        - tests/aideck-consumer-manifest.test.js continua sendo o contrato
          deterministico da topologia do manifest.
        - done significa conclusao recente e archived significa historico frio.
      ratifiedAt: 2026-06-25T15:08:57Z
      ratifiedBy: human
      lastReviewedAt: 2026-06-25T15:08:57Z
parked: []
emerged: []
summary: Reorganiza Panorama, Foco, Visao geral e Arquivados por estado operacional.
planTitle: Reorganizar ciclo de vida das telas do dashboard
---

# Narrative / notes

Initiative for phase **F0 — Reorganizar ciclo de vida das telas do dashboard**.

## Decisions

- `done` remains visible in Visao geral as recent/completed work.
- `archived` moves to Arquivados as cold history.

## Links

_(dashboard references and validation notes)_

## Self-review

- G1 read-before-claim: aplicado — T-001 carrega `evidence.outputSummary` do run `node --test tests/aideck-consumer-manifest.test.js` com `tests 31, suites 7, pass 31, fail 0, duration_ms 190.707125`; o diff lido antes do fechamento foi restrito a `assets/aideck-consumer/manifest.yaml` e `tests/aideck-consumer-manifest.test.js`.
- G2 soft-language: aplicado — a conclusão de T-001 está registrada como `passed: true` com `exitCode: 0`, sem claim solta.
- G6 reference-or-strike: aplicado — handoff/evidence citam paths e comandos literais.
- Phase review gate: local aplicado — `.atomic-skills/reviews/2026-06-25-aideck-dashboard-lifecycle-views-f0.md`; achado menor em `assets/aideck-consumer/manifest.yaml:323` corrigido; sem lição reutilizável registrada.

## Session handoff

- **Narrative:** F0 `aideck-dashboard-lifecycle-views` está `done` e o plano está `done`. T-001 fechou com evidência estruturada; `G-1` foi validado no aiDeck live em `http://127.0.0.1:7777`; o review gate local foi registrado em `.atomic-skills/reviews/2026-06-25-aideck-dashboard-lifecycle-views-f0.md`. A implementação separou o dashboard em fluxo aberto (`Panorama`/`Foco agora`/`Frentes vivas`), conclusão recente (`Visão geral` → `Concluídas recentes`) e histórico frio (`Arquivados`).
- **Decision log:** A task foi materializada como T-001 após ratificação humana em 2026-06-25, porque a fase tinha `tasks: []` e `nextAction: "Criar T-001: realinhar labels, filtros e secoes do manifest aiDeck."`. O escopo ficou restrito a `assets/aideck-consumer/manifest.yaml` e `tests/aideck-consumer-manifest.test.js`; `scripts/emit-consumer-state.js`, schemas, handlers MCP, runtime layer e `@henryavila/aideck` ficaram fora do `scopeBoundary[]`. `done` foi tratado como conclusão recente em `Visão geral`, enquanto `archived` ficou somente em `Arquivados`.
- **Single nextAction:** Revisar `git diff`, commit/revisão humana final, depois decidir `archive` do plano `aideck-dashboard-lifecycle-views`.
- **Verbatim state:** `node --test tests/aideck-consumer-manifest.test.js` primeiro falhou em `tests/aideck-consumer-manifest.test.js:236:12` com `actual: [ 'active', 'paused' ]` e `expected: [ 'active', 'paused', 'blocked' ]`; depois passou com `tests 31`, `suites 7`, `pass 31`, `fail 0`, `duration_ms 214.987416`. Live aiDeck: `GET /api/consumers/atomic-skills` → `200 panorama:Panorama,foco-agora:Foco agora,visao-geral:Visão geral,plan:Detalhe do plano,arquivados:Arquivados,help:Ajuda`. `npm run verify:aideck:smoke` → `RESULT: PASS`, `Summary: 6 passed, 0 failed`. Validação de estado executada: `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/validate-state.js" .atomic-skills/projects/atomic-skills/aideck-dashboard-lifecycle-views/plan.md .atomic-skills/projects/atomic-skills/aideck-dashboard-lifecycle-views/phases/aideck-dashboard-lifecycle-views.md` → `✓ All 2 file(s) valid, 1 plan(s) cross-validated (schemaVersion 0.1/0.2)`. Review gate: `.atomic-skills/reviews/2026-06-25-aideck-dashboard-lifecycle-views-f0.md`; `reviewGate.at: 962bce8a08e0f9ad9659b7c3c7586c6a8863ad10+working-tree`.
- **Uncommitted changes:** `M .atomic-skills/analytics/completions.jsonl`; `M .atomic-skills/projects/atomic-skills/aideck-dashboard-lifecycle-views/phases/aideck-dashboard-lifecycle-views.md`; `M .atomic-skills/projects/atomic-skills/aideck-dashboard-lifecycle-views/plan.md`; `A .atomic-skills/reviews/2026-06-25-aideck-dashboard-lifecycle-views-f0.md`; `M assets/aideck-consumer/manifest.yaml`; `M tests/aideck-consumer-manifest.test.js`.
