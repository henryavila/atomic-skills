---
schemaVersion: "0.1"
slug: grok-phase-todo-projection-f2-harden-do-emit-lint-estrutural
title: Harden do emit lint estrutural
goal: Garantir na prosa de transitions que refresh-state e o helper de projeção
  estão nos blocos de mutação de status via detector estrutural.
status: active
branch: plan/grok-phase-todo-projection
started: 2026-07-24T20:07:57.617Z
lastUpdated: 2026-07-24T20:07:57.617Z
nextAction: "Start T-001: Estender lint-transition-emits"
parentPlan: grok-phase-todo-projection
phaseId: F2
businessIntent:
  value: Mutações de status (done/reconcile/phase-done/focus) não perdem
    refresh-state nem projeção Grok — lint estrutural falha se faltar.
  workflow: Estender lint-transition-emits + testes → prosa project-transitions →
    F2-G1/G2.
  rules: Exigir refresh-state + menção project-session-todos nos closes; não
    reescrever GATE-R2; não todo_write em shell; não completed sem phase done.
  outOfScope: Reescrever ordem verifier-before-status; multi-IDE; implementar
    todo_write no host.
  doneWhen: lint-transition-emits exit 0 no project-transitions.md e node --test
    tests/transition-emits.test.js exit 0.
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
weightDone: 0
weightTotal: 2
exitGates:
  - id: F2-G1
    description: lint-transition-emits passes on project-transitions.md
    status: pending
    verifier:
      kind: shell
      command: node scripts/lint-transition-emits.js
        skills/shared/project-assets/project-transitions.md
      expectExitCode: 0
  - id: F2-G2
    description: transition-emits unit tests pass
    status: pending
    verifier:
      kind: shell
      command: node --test tests/transition-emits.test.js
      expectExitCode: 0
stack:
  - id: 1
    title: Harden do emit lint estrutural
    type: task
    openedAt: 2026-07-24T20:07:57.617Z
tasks:
  - id: T-001
    title: Estender lint-transition-emits
    description: Estender lint-transition-emits
    status: pending
    lastUpdated: 2026-07-24T20:07:57.617Z
    scopeBoundary:
      - do not rewrite verifier or GATE-R2 semantics; do not require todo_write
        inside shell scripts
    acceptance:
      - done reconcile and phase-done fail lint if refresh-state missing; done
        and phase-done fail if project-session-todos not mentioned;
        completion-emit requirements still pass after prose updates
    verifier:
      kind: shell
      command: node --test tests/transition-emits.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: scripts/lint-transition-emits.js
      - kind: file
        path: tests/transition-emits.test.js
    summary: Estender lint-transition-emits
    weight: 1
  - id: T-002
    title: Prosa transitions com projeção
    description: Prosa transitions com projeção
    status: pending
    lastUpdated: 2026-07-24T20:07:57.617Z
    scopeBoundary:
      - do not change done verifier-before-status order; do not make todo_write
        close tasks
    acceptance:
      - done flow runs refresh-state then documents applying
        project-session-todos via todo_write on Grok; phase-done and reconcile
        document same step; never mark phase todo completed without phase status
        done or archived
    verifier:
      kind: shell
      command: node scripts/lint-transition-emits.js
        skills/shared/project-assets/project-transitions.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
    summary: Prosa transitions com projeção
    weight: 1
parked: []
emerged: []
summary: "Lint transitions: closes + phase-reopen/switch/unblock/archive"
planTitle: Projeção de fases do project no TODO do Grok
planActive: true
current: true
---
# Narrative / notes

Initiative F2.

## Session handoff
- **Narrative:** F2 package ratified Mode B materialize.
- **Decision log:** operator ratify F2 + T-002 verifier re-spec.
- **Single nextAction:** spawn fresh writer after ratify (work-order + lease)
- **Verbatim state:** .atomic-skills/projects/atomic-skills/grok-phase-todo-projection/phases/f2-harden-do-emit-lint-estrutural.md
- **Uncommitted changes:** (pending)
