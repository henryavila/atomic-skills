---
schemaVersion: "0.1"
slug: phase-materialization-f1-refactor-mecanico-do-decompose-js-beha
title: Refactor mecânico do decompose.js (behavior-preserving)
goal: "Extrair `decomposeOnePhase(phaseSource, ctx)` e
  `writeInitiativeFile(initiative, planSlug, ctx)` de
  `decomposePlan`/`materializeDecomposition` em `src/decompose.js` como refactor
  estritamente mecânico (R-ORCH-10: heurísticas e formato-fonte congelados).
  Nenhuma mudança de comportamento — o output de `materializeDecomposition`
  sobre qualquer input deve ser byte-idêntico ao atual. Habilita F2 (lazy) e F3
  (verbo `materialize`) sem ainda mudar o que `new plan` produz."
status: active
branch: plan/phase-materialization
started: 2026-06-29T13:19:41.314Z
lastUpdated: 2026-06-30T18:05:12.000Z
nextAction: "Start T-004: Extrair `decomposeOnePhase(phaseSource, ctx)` de `decomposePlan`"
parentPlan: phase-materialization
phaseId: F1
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
weightDone: 0
weightTotal: 4
exitGates:
  - id: F1-G1
    description: "Refactor é behavior-preserving: golden/snapshot de
      materializeDecomposition inalterado sobre os fixtures canonicos"
    status: pending
    verifier:
      kind: shell
      command: npm test
      expectExitCode: 0
    verifierLabel: "shell: npm test"
  - id: F1-G2
    description: decomposeOnePhase e writeInitiativeFile exportadas e reutilizaveis
      (F2/F3 dependerão delas)
    status: pending
    verifier:
      kind: shell
      command: node -e "import(\"./src/decompose.js\").then(m => { if (typeof
        m.decomposeOnePhase !== \"function\" || typeof m.writeInitiativeFile !==
        \"function\") process.exit(1) })"
      expectExitCode: 0
    verifierLabel: 'shell: node -e "import(\"./src/decompose.js\").then(m => { if (typ…'
stack:
  - id: 1
    title: Refactor mecânico do decompose.js (behavior-preserving)
    type: task
    openedAt: 2026-06-29T13:19:41.314Z
tasks:
  - id: T-004
    title: Extrair `decomposeOnePhase(phaseSource, ctx)` de `decomposePlan`
    description: Extrai de `decomposePlan` (`src/decompose.js:605`, loop de fases
      `:646-698`) uma função `decomposeOnePhase(phaseSource, ctx)` que encapsula
      a extração de tasks (`extractTasks` chamado em `:676`) + goal
      (`extractGoal` em `:675`) + exit gates (`:677-682`) + montagem do objeto
      iniciativa para UMA fase. `decomposePlan` passa a chamar
      `decomposeOnePhase` por fase em vez de inlinar a lógica. A heurística é a
      mesma — só muda a estrutura (a função agora é invocável isoladamente por
      fase, o que F3 precisa).
    status: pending
    lastUpdated: 2026-06-29T13:19:41.314Z
    scopeBoundary:
      - corpo de `decomposePlan` (`:605-715`) e a nova função extraída em
        `src/decompose.js`; NÃO alterar regexes/constantes do topo (`:93-120`),
        NÃO alterar `extractTasks`/`extractGoal`/`extractFirstYamlBlock`, NÃO
        mudar o formato-fonte markdown aceito
    acceptance:
      - "`materializeDecomposition(decomposePlan(md), opts)` produz output
        byte-idêntico ao atual sobre todos os fixtures de decompose existentes
        (snapshot/golden); a suíte `tests/decompose.test.js` existente segue
        verde; `decomposeOnePhase` é exportada e invocável isoladamente sobre o
        `bodyLines` de uma fase"
    verifier:
      kind: test
      runner: node --test
      pattern: tests/decompose.test.js
    outputs:
      - kind: file
        path: src/decompose.js
      - kind: file
        path: tests/decompose.test.js
    summary: Extrai decomposeOnePhase(phaseSource,ctx) do loop de decomposePlan, sem
      mudar heurística nem output.
    weight: 2
  - id: T-005
    title: Extrair `writeInitiativeFile(initiative, planSlug, ctx)` do loop de
      materialize
    description: Extrai do corpo do loop em `materializeDecomposition`
      (`src/decompose.js:866-946`) uma função `writeInitiativeFile(initiative,
      planSlug, ctx)` que monta o frontmatter da iniciativa (`initFm`
      `:890-919`) + body (`renderInitiativeBody` `:920`) + `relativePath`
      (`:924-927`) + collision guard (`:931-939`) e retorna o
      `{kind:'initiative', slug, relativePath, content}`.
      `materializeDecomposition` passa a chamar `writeInitiativeFile` por fase
      (mantendo o guard de colisão `seenSlugs`/`seenPaths`). Comportamento
      idêntico; a função fica reutilizável por F2 (que a chamará só para F0) e
      F3 (que a chamará no `materialize`).
    status: pending
    lastUpdated: 2026-06-29T13:19:41.314Z
    scopeBoundary:
      - o loop `for` em `materializeDecomposition` (`:866-946`) e a nova função
        extraída; NÃO alterar `renderInitiativeBody`, o cálculo de
        `phaseFileName` (`:924`), nem a construção de `phases[]` (`:796-822`)
    acceptance:
      - output de `materializeDecomposition` byte-idêntico ao atual sobre todos
        os fixtures (snapshot); suíte `tests/decompose.test.js` verde;
        `writeInitiativeFile` exportada e produz o mesmo `{relativePath,
        content}` que o loop inlinado produzia
    verifier:
      kind: test
      runner: node --test
      pattern: tests/decompose.test.js
    outputs:
      - kind: file
        path: src/decompose.js
      - kind: file
        path: tests/decompose.test.js
    summary: Extrai writeInitiativeFile do loop de materializeDecomposition,
      mantendo guard de colisão e output idêntico.
    weight: 2
parked: []
emerged: []
summary: Extrai decomposeOnePhase e writeInitiativeFile do decompose.js num
  refactor mecânico que preserva o output byte a byte (R-ORCH-10).
planTitle: Materialização lazy de fases + gate de validação de negócio
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F1 — Refactor mecânico do decompose.js (behavior-preserving)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

