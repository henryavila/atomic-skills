---
schemaVersion: "0.1"
slug: grok-phase-todo-projection-f4-integracao-e-regressao
title: Integração e regressão
goal: Suite de regressão verde; parity de install intacta; checklist dogfood.
status: active
branch: plan/grok-phase-todo-projection
started: 2026-07-24T21:01:28.301Z
lastUpdated: 2026-07-24T21:01:28.301Z
nextAction: "Start T-001: Regressão package"
parentPlan: grok-phase-todo-projection
phaseId: F4
businessIntent:
  value: A entrega fecha com regressão determinística verde e dogfood documentado
    (seed → after-done → phase-done → reseed pós-compact), sem segundo SoT e sem
    PASS inventado de gate manual.
  workflow: T-001 endurece/expõe regressão package (unit + path de install/render
    se no escopo) → T-002 documenta checklist dogfood no KB → F4-G1 shell +
    F4-G2 PASS manual do operador.
  rules: Não inventar PASS sem run do operador; checklist só no KB (sem segundo
    helper); não mutar journal de install salvo se arquivo instalado novo exigir
    reverse; preferir scripts em package-root sem superfície de install.
  outOfScope: Novo helper de projeção; multi-IDE mirror; write em plan.json da
    sessão; fechar task via TODO; painel nativo Grok; T-00N no scaffold.
  doneWhen: node --test nos testes de sessão/transitions (e parity install/render
    se no G1) exit 0; checklist dogfood no KB com labels de identidade; Henry
    PASS em F4-G2.
startedCommit: 243a7ffcaaf72d1716e9fc7cca494e43a5d2b374
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
weightDone: 0
weightTotal: 2
exitGates:
  - id: F4-G1
    description: New unit tests pass in isolation
    status: pending
    verifier:
      kind: shell
      command: node --test tests/project-session-todos.test.js
        tests/transition-emits.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/project-session-todos.test.js tests/trans…"
  - id: F4-G2
    description: Manual HARD Henry confirms dogfood checklist completed once on Grok
    status: pending
    verifier:
      kind: manual
      description: Operator PASS after one real session saw phase scaffold update
    verifierLabel: manual
stack:
  - id: 1
    title: Integração e regressão
    type: task
    openedAt: 2026-07-24T21:01:28.301Z
tasks:
  - id: T-001
    title: Regressão package
    description: Regressão package
    status: pending
    lastUpdated: 2026-07-24T21:01:28.301Z
    scopeBoundary:
      - do not change install journal effects unless new installed file requires
        reverse; prefer package-root scripts with no install surface change
    acceptance:
      - new tests run under node --test; install-uninstall-roundtrip green when
        no new install files; existing suite not broken by prose pointers
    verifier:
      kind: shell
      command: node --test tests/project-session-todos.test.js
        tests/transition-emits.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: package.json
      - kind: file
        path: tests/project-session-todos.test.js
      - kind: file
        path: tests/transition-emits.test.js
    summary: Regressão package
    weight: 1
  - id: T-002
    title: Dogfood checklist e close
    description: Dogfood checklist e close
    status: pending
    lastUpdated: 2026-07-24T21:01:28.301Z
    scopeBoundary:
      - do not invent PASS without operator run; checklist only no second helper
    acceptance:
      - checklist lists seed after-done counter bump phase-done advance and
        reseed after compact; documents expected label with identity text not
        only counts
    verifier:
      kind: shell
      command: rg -n 'seed|after-done|phase-done|reseed|compact'
        docs/kb/grok-phase-todo-projection.md && rg -n 'summary|title|F0 \('
        docs/kb/grok-phase-todo-projection.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: docs/kb/grok-phase-todo-projection.md
    summary: Dogfood checklist e close
    weight: 1
parked: []
emerged: []
summary: Regressão unit + install parity Grok + dogfood checklist
planTitle: Projeção de fases do project no TODO do Grok
planActive: true
current: true
---

# F4

## Session handoff
- **Narrative:** F4 package ratified Mode B materialize; T-002 verifier re-speced into sidecar.
- **Decision log:** operator ratify F4 (token: ratify); T-002 shell verifier for dogfood checklist greps.
- **Single nextAction:** spawn fresh writer after ratify
- **Verbatim state:** .atomic-skills/projects/atomic-skills/grok-phase-todo-projection/phases/f4-integracao-e-regressao.md; HEAD=243a7ffcaaf72d1716e9fc7cca494e43a5d2b374; executionMode automate
- **Uncommitted changes:** clean expected after materialize microcommit

