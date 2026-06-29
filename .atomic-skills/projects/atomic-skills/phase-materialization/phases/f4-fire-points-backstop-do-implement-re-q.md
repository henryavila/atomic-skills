---
schemaVersion: "0.1"
slug: phase-materialization-f4-fire-points-backstop-do-implement-re-q
title: Fire points + backstop do implement + re-question events + lessons
goal: "Conectar o gate nos fire points (D6):
  `phase-done`/`switch`/`phase-reopen` chamam `materialize` internamente (D7);
  `implement.md` Step 1 ganha verificação real (recusa fase descritor-only ou
  sem businessIntent, em vez de degradar — D6). Re-question do businessIntent em
  2 eventos concretos (D6.1): crítico aponta drift; `implement` Step 2.1 reporta
  saída de `scopeBoundary`. Lições consolidadas fase-a-fase já integram via gate
  de lessons (phase-start). Depende de F2 (descriptor-only) e F3 (materialize
  verbo)."
status: pending
branch: plan/phase-materialization
started: 2026-06-29T13:19:41.314Z
lastUpdated: 2026-06-29T14:50:13.796Z
nextAction: "Start T-010: Fire points chamam `materialize` internamente (D6 + D7)"
parentPlan: phase-materialization
phaseId: F4
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: F4-G1
    description: phase-done/switch/phase-reopen chamam materialize internamente (sem
      a instrução new initiative quebrada) e implement recusa fase
      descriptor-only/sem businessIntent
    status: pending
    verifier:
      kind: shell
      command: npm test -- tests/phase-materialization/
      expectExitCode: 0
  - id: F4-G2
    description: Os 2 eventos D6.1 (critico drift + implement Step 2.1 runtime
      scope) sao os unicos re-question points, sem maquinaria nova
    status: pending
    verifier:
      kind: manual
      description: Confirmar em implement.md/project-drift.md que só os 2 eventos D6.1
        re-questionam o businessIntent
stack:
  - id: 1
    title: Fire points + backstop do implement + re-question events + lessons
    type: task
    openedAt: 2026-06-29T13:19:41.314Z
tasks:
  - id: T-010
    title: Fire points chamam `materialize` internamente (D6 + D7)
    description: 'Em `skills/shared/project-assets/project-transitions.md`:
      `phase-done` (que hoje manda `new initiative` quebradamente — `:170`),
      `switch`, e `phase-reopen` passam a chamar o verbo `materialize` (F3)
      internamente quando avançam para uma fase descriptor-only — corrigindo a
      contradição do gap (2): se F1..N não têm initiative file após `new plan`
      (F2), a instrução "materialize the next" do `phase-done` ganha alvo real,
      sem colidir com `new initiative` (`:17`). Nenhuma duplicação de lógica —
      chamam o mesmo caminho.'
    status: pending
    lastUpdated: 2026-06-29T13:19:41.314Z
    scopeBoundary:
      - as seções `phase-done`/`switch`/`phase-reopen` em project-transitions.md
        + novo teste; NÃO reimplementar decompose/gate (reusa F3), NÃO alterar
        project-create-initiative.md
    acceptance:
      - a instrução vestigial `new initiative` em `project-transitions.md:170` é
        substituída por chamada interna a `materialize`; `phase-done` sobre
        F0→F1 (F1 descriptor-only) dispara materialize sem colisão; fases
        `done`/`archived` seguem intocadas (non-goal)
    verifier:
      kind: test
      runner: node --test
      pattern: tests/phase-materialization/fire-points.test.js
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
      - kind: file
        path: tests/phase-materialization/fire-points.test.js
    summary: phase-done/switch/phase-reopen chamam materialize internamente,
      corrigindo a instrução new initiative quebrada.
    weight: 2
  - id: T-011
    title: "`implement.md` Step 1 vira backstop duro (D6) + D6.1 re-question events"
    description: 'Em `skills/core/implement.md`: o Step 1 ganha verificação **real**
      — recusa (em vez de degradar para "loop solto sem inventar spec",
      `:51`/`:114-116`) uma fase descritor-only ou sem `businessIntent`
      preenchido, apontando para `materialize`. Adicionalmente (D6.1), o
      `businessIntent` é re-questionado em **2 eventos explícitos**: (a) o
      crítico/critic aponta que a fase driftou do `businessIntent` original; (b)
      o `implement` Step 2.1 ("stop-and-report") reporta que uma task saiu do
      seu `scopeBoundary` em **runtime** (NÃO é `lint-source.js`, que valida
      scopeBoundary no admit-time pré-implementação — precisão do achado de
      crítico). Non-goal: re-questionar a cada scope-creep percebido (fricção
      excessiva; congelamento pós-materialização D1 permanece dentro da fase).'
    status: pending
    lastUpdated: 2026-06-29T13:19:41.314Z
    scopeBoundary:
      - Step 1 (pre-check) e Step 2.1 (stop-and-report) em `implement.md` + novo
        teste; NÃO alterar `lint-source.js` (valida scopeBoundary no admit-time,
        não é trigger D6.1b), NÃO adicionar detector estático novo
    acceptance:
      - "`implement.md` Step 1 recusa fase descritor-only/sem businessIntent
        apontando para `materialize` (não degrada); os 2 eventos D6.1 (drift do
        crítico; saída de scopeBoundary em runtime pelo Step 2.1) estão
        documentados como gatilhos de re-questionamento; nenhum depende de
        maquinária por criar"
    verifier:
      kind: test
      runner: node --test
      pattern: tests/phase-materialization/implement-backstop.test.js
    outputs:
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: tests/phase-materialization/implement-backstop.test.js
    summary: implement Step 1 recusa fase descritor-only/sem businessIntent; 2
      eventos D6.1 re-questionam o gate.
    weight: 2
parked: []
emerged: []
summary: Conecta o gate nos fire points (phase-done/switch/phase-reopen) e
  endurece o implement como backstop, com re-question em 2 eventos.
---

# Narrative / notes

Initiative for phase **F4 — Fire points + backstop do implement + re-question events + lessons**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

