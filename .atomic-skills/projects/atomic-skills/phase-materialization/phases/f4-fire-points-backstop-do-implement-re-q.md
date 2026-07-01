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
status: active
branch: plan/phase-materialization
started: 2026-06-29T13:19:41.314Z
lastUpdated: 2026-07-01T13:03:19.000Z
nextAction: "Run phase-done for phase-materialization/F4: execute exit gates,
  review-code, lessons distillation, and plan advance."
parentPlan: phase-materialization
phaseId: F4
tasksDone: 2
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
weightDone: 4
weightTotal: 4
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
    verifierLabel: "shell: npm test -- tests/phase-materialization/"
  - id: F4-G2
    description: Os 2 eventos D6.1 (critico drift + implement Step 2.1 runtime
      scope) sao os unicos re-question points, sem maquinaria nova
    status: pending
    verifier:
      kind: manual
      description: Confirmar em implement.md/project-drift.md que só os 2 eventos D6.1
        re-questionam o businessIntent
    verifierLabel: manual
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
    status: done
    lastUpdated: 2026-07-01T12:55:44.000Z
    closedAt: 2026-07-01T12:55:44.000Z
    scopeBoundary:
      - as seções `phase-done`/`switch`/`phase-reopen` em project-transitions.md
        + novo teste; NÃO reimplementar decompose/gate (reusa F3), NÃO alterar
        project-create-initiative.md
    acceptance:
      - a instrução vestigial `new initiative` em `project-transitions.md:170` é
        substituída por chamada interna a `materialize`; `phase-done` sobre
        F0→F1 (F1 descriptor-only) dispara materialize sem colisão; fases
        `done`/`archived` seguem intocadas (non-goal)
      - "F3/L-001 applied: fire-points coverage must include direct invocation,
        internal caller invocation, existing initiative reuse, and
        parallel-choice activation paths in the focused test"
    verifier:
      kind: test
      runner: node --test
      pattern: tests/phase-materialization/fire-points.test.js
    evidence:
      verifierKind: test
      verifiedAt: 2026-07-01T12:55:44.000Z
      passed: true
      exitCode: 0
      testsCollected: 5
      outputSummary: rtk node --test tests/phase-materialization/fire-points.test.js
        -> exit 0; tests 5 / pass 5 / fail 0; duration_ms 171.896667.
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
    status: done
    lastUpdated: 2026-07-01T13:03:19.000Z
    closedAt: 2026-07-01T13:03:19.000Z
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
    evidence:
      verifierKind: test
      verifiedAt: 2026-07-01T13:03:19.000Z
      passed: true
      exitCode: 0
      testsCollected: 4
      outputSummary: rtk node --test
        tests/phase-materialization/implement-backstop.test.js -> exit 0; tests
        4 / pass 4 / fail 0; duration_ms 202.917667.
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
planTitle: Materialização lazy de fases + gate de validação de negócio
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F4 — Fire points + backstop do implement + re-question events + lessons**.

## Decisions

- **Phase-start lessons gate executado para F4.** Disposicoes: F0/L-001 Keep (sem artefato gerado nesta fase), F1/L-001 Keep (gate F4-G1 ja e escopado a tests/phase-materialization), F2/L-001 Keep (sem scanner flat/nested novo nesta fase), F3/L-001 Apply em T-010 cobrindo chamada direta, chamada interna, reuse de initiative existente e ativacao paralela.

## Links

_(plan doc, external refs)_

## Session handoff

- **Narrative:** Fase F4 esta ativa em `.atomic-skills/projects/atomic-skills/phase-materialization/phases/f4-fire-points-backstop-do-implement-re-q.md`. T-010 e T-011 estao `done` com `evidence.passed: true`; `tasksDone: 2`, `weightDone: 4`, `gatesMet: 0`. A implementacao de T-011 esta no commit `63241cd docs(T-011): harden implement business intent backstop`; o worktree isolado de T-011 foi removido depois da comparacao byte-a-byte.
- **Decision log:** T-011 roteou para Mode 2 porque `.atomic-skills/status/routing.json` contem `"mode2Enabled": true` e `"codexLane": {"enabled": true, "timeoutSeconds": 600, "sandbox": "workspace-write"}` e a task tinha `scopeBoundary[]`, `acceptance[]` e verifier deterministico. O self-report do executor nao certificou a task: o diff foi lido com `rtk git -C /Volumes/External/code/atomic-skills/.worktrees/phase-materialization-t011-codex diff`, integrado serialmente na arvore principal, verificado com `rtk node --test tests/phase-materialization/implement-backstop.test.js`, e entao commitado em `63241cd`.
- **Single nextAction:** Run `phase-done` for `phase-materialization/F4`.
- **Verbatim state:** `rtk node --test tests/phase-materialization/implement-backstop.test.js` -> `✔ T-011 Step 1 refuses descriptor-only phases before accepting pending tasks`; `✔ T-011 Step 1 requires a complete businessIntent spine on descriptor and initiative`; `✔ T-011 Step 2.1 documents exactly the two D6.1 re-question events`; `✔ T-011 Step 2.1 runtime scope exits stop and report path plus reason`; `ℹ tests 4`; `ℹ pass 4`; `ℹ fail 0`; source anchors: `skills/core/implement.md:51`, `skills/core/implement.md:54`, `skills/core/implement.md:56`, `skills/core/implement.md:65`, `skills/core/implement.md:67`, `skills/core/implement.md:72`, `tests/phase-materialization/implement-backstop.test.js:29`, `tests/phase-materialization/implement-backstop.test.js:46`, `tests/phase-materialization/implement-backstop.test.js:64`, `tests/phase-materialization/implement-backstop.test.js:79`; cleanup commands: `rtk git worktree remove --force /Volumes/External/code/atomic-skills/.worktrees/phase-materialization-t011-codex` -> `ok`; `rtk git branch -D impl/phase-materialization-t011` -> `ok`.
- **Uncommitted changes:** ` M .atomic-skills/analytics/completions.jsonl`; ` M .atomic-skills/projects/atomic-skills/phase-materialization/phases/f4-fire-points-backstop-do-implement-re-q.md`
