---
schemaVersion: "0.1"
slug: plan-dependencies
title: plan-dependencies - dependencias executaveis entre planos
version: "1.0"
status: done
started: 2026-06-25T13:43:40.847Z
lastUpdated: 2026-06-26T01:17:15Z
branch: plan/plan-dependencies
currentPhase: F3
parallelismAllowed: false
principles:
  - id: P1
    title: Fonte unica de bloqueio
    body: "`dependsOnPlans[]` e o grafo canonico de execucao; edges inversos sao
      derivados."
  - id: P2
    title: Origem nao bloqueia sozinha
    body: "`spawnedFrom` e `spawnedPlans` explicam onde o plano nasceu, mas nunca
      fecham ou abrem caminho por conta propria."
  - id: P3
    title: Compatibilidade aditiva
    body: planos antigos sem `dependsOnPlans` seguem validos e renderizaveis.
  - id: P4
    title: Dashboard operacional
    body: a primeira pergunta da UI e qual plano executa agora, qual esta bloqueado
      e qual plano libera o bloqueio.
  - id: P5
    title: Validacao antes de exibicao
    body: referencias orfas, self-edge, ciclo e cross-project sem suporte sao
      barrados antes de dashboard ou transicao.
glossary:
  - term: Dependencia de plano
    definition: edge operacional persistido em `dependsOnPlans[]`, do plano
      bloqueado para o plano prerequisito.
  - term: Origem de plano
    definition: edge historico persistido em `spawnedFrom` e `spawnedPlans`,
      apontando onde o plano surgiu.
  - term: Caminho de execucao
    definition: timeline topologica que separa Liberado agora, Em andamento,
      Bloqueado e Concluido.
  - term: Plano liberador
    definition: prerequisito em `done`; `archived` libera somente com resolucao
      explicita registrada no edge.
phases:
  - id: F0
    slug: plan-dependencies-f0-modelo-e-grafo-canonico
    title: Modelo e grafo canonico
    goal: adicionar o contrato exato de `dependsOnPlans[]` e o helper puro que
      calcula edges, bloqueios e ordem topologica entre planos.
    dependsOn: []
    subPhaseCount: 3
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: F0-G1
          description: Plan schema, graph helper and validate-state cover the exact
            dependsOnPlans contract, release semantics, legacy omission and
            invalid plan-dependency graphs.
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
              tests/validate-state.test.js: tests 88, pass 88, fail 0,
              duration_ms 3492.4795"
    status: done
    reviewGate:
      status: passed
      mode: local
      at: working-tree@7b16b5f
      reviewFile: .atomic-skills/reviews/2026-06-25-1910-plan-dependencies-f0.md
      verifiedAt: 2026-06-25T19:12:17Z
    summary: Define o contrato, o schema e o helper que validam dependencias
      executaveis entre planos.
  - id: F1
    slug: plan-dependencies-f1-acoplamento-com-planos-emergidos
    title: Acoplamento com planos emergidos
    goal: quando um plano nasce de uma fase ou task por `fork-plan`, registrar a
      origem e a dependencia operacional correta sem duplicar fonte de verdade.
    dependsOn:
      - F0
    subPhaseCount: 4
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: F1-G1
          description: Fork-plan records origin and default operational dependency for an
            extracted child plan, explicit dependency commands cover manual
            edges, and transitions surface the blocked-plan path.
          status: met
          metAt: 2026-06-25T20:05:38Z
          verifier:
            kind: shell
            command: rtk node --test tests/links-sidecar.test.js
              tests/validate-skills.test.js tests/transition-emits.test.js
            expectExitCode: 0
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-25T20:05:38Z
            passed: true
            exitCode: 0
            outputSummary: "rtk node --test tests/links-sidecar.test.js
              tests/validate-skills.test.js tests/transition-emits.test.js:
              tests 99, pass 99, fail 0, duration_ms 910.85375"
    status: done
    reviewGate:
      status: passed
      mode: local
      at: working-tree@7f374bb
      reviewFile: .atomic-skills/reviews/2026-06-25-2151-plan-dependencies-f1.md
      verifiedAt: 2026-06-25T21:51:42Z
    summary: Acopla planos emergidos e edges manuais ao grafo sem confundir origem
      com bloqueio operacional.
  - id: F2
    slug: plan-dependencies-f2-projecao-aideck-e-api-de-dependencias
    title: Projecao aiDeck e API de dependencias
    goal: expor dependencia e origem de planos como dados denormalizados para o
      consumer, mantendo compatibilidade com dependencias de fase e task.
    dependsOn:
      - F1
    subPhaseCount: 3
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: F2-G1
          description: aiDeck state emits and validates plan dependency and origin edges,
            and get-dependencies supports scope plan.
          status: met
          metAt: 2026-06-26T00:14:56Z
          verifier:
            kind: shell
            command: rtk node --test tests/emit-consumer-state.test.js
              tests/aideck-state-schema.test.js
              tests/aideck-consumer-handlers.test.js
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
    status: done
    reviewGate:
      status: passed
      mode: local
      at: working-tree@436330a
      reviewFile: .atomic-skills/reviews/2026-06-26-0015-plan-dependencies-f2.md
      verifiedAt: 2026-06-26T00:15:00Z
    summary: Publica planEdges e dependencias de plano para o consumer aiDeck.
  - id: F3
    slug: plan-dependencies-f3-dashboard-caminho-de-execucao
    title: Dashboard caminho de execucao
    goal: representar no dashboard a timeline de execucao entre planos e a relacao
      separada de planos surgidos dentro de fases ou tasks.
    dependsOn:
      - F2
    subPhaseCount: 3
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: F3-G1
          description: Dashboard manifest and consumer checks expose execution path and
            origin relation as separate UI concepts.
          status: met
          metAt: 2026-06-26T01:17:15Z
          verifier:
            kind: shell
            command: rtk node --test tests/aideck-consumer-manifest.test.js
              tests/aideck-consumer-manifest-compat.test.js
              tests/aideck-contract.test.js
              tests/verify-aideck-routes-smoke.test.js
            expectExitCode: 0
          evidence:
            verifierKind: shell
            verifiedAt: 2026-06-26T01:17:15Z
            passed: true
            exitCode: 0
            outputSummary: "rtk node --test tests/aideck-consumer-manifest.test.js
              tests/aideck-consumer-manifest-compat.test.js
              tests/aideck-contract.test.js
              tests/verify-aideck-routes-smoke.test.js: tests 45, pass 39, fail
              0, skipped 6, duration_ms 336.262792"
    status: done
    reviewGate:
      status: passed
      mode: local
      at: working-tree@106d8b5
      reviewFile: .atomic-skills/reviews/2026-06-26-0116-plan-dependencies-f3.md
      verifiedAt: 2026-06-26T01:17:15Z
    summary: Mostra no dashboard o caminho de execucao e a linhagem Surgiu de
      separadamente.
references:
  - kind: repo-path
    path: .atomic-skills/projects/atomic-skills/plan-dependencies/design.md
    label: DESIGN - origem historica, dependencia operacional e dashboard de execucao
planTitle: plan-dependencies - dependencias executaveis entre planos
---

# plan-dependencies - dependencias executaveis entre planos

## 1. Context

Este plano entrega dependencia executavel entre planos no atomic-skills. O
objetivo e permitir que trabalhos grandes sejam quebrados em varios planos
orquestrados por uma timeline de execucao, sem confundir essa ordem operacional
com a origem historica de um plano surgido dentro de outro.

A feature parte do design aprovado em
`.atomic-skills/projects/atomic-skills/plan-dependencies/design.md`. A relacao
de origem permanece em `spawnedFrom` e `spawnedPlans`; a relacao que bloqueia
execucao passa a viver em `dependsOnPlans[]`.

## 2. Inviolable principles

- **P1 Fonte unica de bloqueio** — `dependsOnPlans[]` e o grafo canonico de execucao; edges inversos sao derivados.
- **P2 Origem nao bloqueia sozinha** — `spawnedFrom` e `spawnedPlans` explicam onde o plano nasceu, mas nunca fecham ou abrem caminho por conta propria.
- **P3 Compatibilidade aditiva** — planos antigos sem `dependsOnPlans` seguem validos e renderizaveis.
- **P4 Dashboard operacional** — a primeira pergunta da UI e qual plano executa agora, qual esta bloqueado e qual plano libera o bloqueio.
- **P5 Validacao antes de exibicao** — referencias orfas, self-edge, ciclo e cross-project sem suporte sao barrados antes de dashboard ou transicao.

## 3. Phase tree

O plano executa em quatro fases sequenciais. Cada fase fecha com um gate
deterministico e a proxima fase depende da anterior.

- **F0 — Modelo e grafo canonico.** Define o contrato exato de
  `dependsOnPlans[]`, cria o helper de grafo e conecta a validacao de refs,
  ciclos, semantica de liberacao e compatibilidade legada.
- **F1 — Acoplamento com planos emergidos.** Acrescenta a escrita idempotente da
  dependencia operacional e documenta o `fork-plan` criando origem e bloqueio
  default quando o filho extrai trabalho do caminho do pai. Tambem adiciona um
  caminho validado para dependencias explicitas entre planos existentes.
- **F2 — Projecao aiDeck e API de dependencias.** Emite `planEdges`, atualiza os
  schemas do consumer e adiciona `scope: plan` ao handler `get-dependencies`.
- **F3 — Dashboard caminho de execucao.** Adiciona widgets e verificacoes para
  mostrar Caminho de execucao e Surgiu de como relacoes separadas no dashboard.

## 4. What stays valid

`spawnedFrom`, `phases[].spawnedPlans`, dependencias fase -> fase e os escopos
atuais de `get-dependencies` continuam validos. A entrega e aditiva: planos
legados sem `dependsOnPlans[]` continuam passando validacao.

## 5. dependsOnPlans contract

Cada entrada de `dependsOnPlans[]` fica no plano bloqueado e aponta para um
plano prerequisito no mesmo `projectId`.

```yaml
dependsOnPlans:
  - plan: child-plan-slug
    createdBy: fork-plan
    origin:
      phaseId: F2
      taskId: T-004
      mode: pause
    release:
      archived: blocked
```

Campos:

- `plan`: slug do plano prerequisito. Obrigatorio, same-project.
- `createdBy`: `fork-plan` ou `manual`. Obrigatorio.
- `origin`: opcional; obrigatorio para edge criado por `fork-plan`. Contem
  `phaseId`, `taskId` opcional e `mode`.
- `release.archived`: `blocked` por default, ou `resolved` somente quando uma
  decisao explicita registra que arquivar o prerequisito resolveu a dependencia.

Regras:

- Dedupe por `plan + origin.phaseId + origin.taskId + createdBy`.
- `done` libera automaticamente.
- `archived` nao libera automaticamente. O edge libera com `archived` somente
  quando `release.archived: resolved` existe junto de uma razao registrada pelo
  comando de dependencia.
- `active`, `paused` e `pending` bloqueiam.

## Reviews

- internal: 1 finding applied @ 7b16b5f (2026-06-25T13:56:41Z)
- codex: needs_changes resolved @ .atomic-skills/reviews/2026-06-25-1115-plan-dependencies.md (4 major applied)
