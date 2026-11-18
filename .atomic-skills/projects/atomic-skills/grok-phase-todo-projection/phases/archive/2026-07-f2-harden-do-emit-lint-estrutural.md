---
schemaVersion: "0.1"
slug: grok-phase-todo-projection-f2-harden-do-emit-lint-estrutural
title: Harden do emit lint estrutural
goal: Garantir na prosa de transitions que refresh-state e o helper de projeção
  estão nos blocos de mutação de status via detector estrutural.
status: done
branch: plan/grok-phase-todo-projection
started: 2026-07-24T20:07:57.617Z
lastUpdated: 2026-07-24T20:38:43.203Z
nextAction: present phase-start package for F3 validate-only
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
tasksDone: 2
tasksTotal: 2
gatesMet: 2
gatesTotal: 2
weightDone: 2
weightTotal: 2
exitGates:
  - id: F2-G1
    description: lint-transition-emits passes on project-transitions.md
    status: met
    verifier:
      kind: shell
      command: node scripts/lint-transition-emits.js
        skills/shared/project-assets/project-transitions.md
      expectExitCode: 0
    metAt: 2026-07-24T20:38:43.203Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-24T20:38:43.203Z
      verifiedCommit: 794205171257913c57fc723a553b1caaf5712211
      passed: true
      exitCode: 0
      outputSummary: >
        lint-transition-emits: all transition blocks carry completion emit
        instructions
    verifierLabel: "shell: node scripts/lint-transition-emits.js skills/shared/project…"
    evidenceSummary: passed · 2026-07-24
  - id: F2-G2
    description: transition-emits unit tests pass
    status: met
    verifier:
      kind: shell
      command: node --test tests/transition-emits.test.js
      expectExitCode: 0
    metAt: 2026-07-24T20:38:43.203Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-24T20:38:43.203Z
      verifiedCommit: 794205171257913c57fc723a553b1caaf5712211
      passed: true
      exitCode: 0
      outputSummary: >-
        ✔ project-transitions emits are structurally present in all transition
        blocks (7.901209ms)

        ✔ phase-done prose emits one aggregate phase event and forbids bulk
        task-done close (2.011417ms)

        ✔ done prose requires verifier handling before status mutation
        (0.930958ms)

        ✔ phase-done prose forbids defer/skip terminal and bulk-met coercion
        (0.724708ms)

        ✔ old done ordering is reported as verifier-before-don
    verifierLabel: "shell: node --test tests/transition-emits.test.js"
    evidenceSummary: passed · 2026-07-24
stack:
  - id: 1
    title: Harden do emit lint estrutural
    type: task
    openedAt: 2026-07-24T20:07:57.617Z
tasks:
  - id: T-001
    title: Estender lint-transition-emits
    description: Estender lint-transition-emits
    status: done
    lastUpdated: 2026-07-24T20:13:40.736Z
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
    closedAt: 2026-07-24T20:13:40.736Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-24T20:38:43.203Z
      verifiedCommit: 794205171257913c57fc723a553b1caaf5712211
      passed: true
      exitCode: 0
      outputSummary: re-anchor
  - id: T-002
    title: Prosa transitions com projeção
    description: Prosa transitions com projeção
    status: done
    lastUpdated: 2026-07-24T20:13:43.323Z
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
    closedAt: 2026-07-24T20:13:43.323Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-24T20:38:43.203Z
      verifiedCommit: 794205171257913c57fc723a553b1caaf5712211
      passed: true
      exitCode: 0
      outputSummary: re-anchor
parked: []
emerged: []
summary: "Lint transitions: closes + phase-reopen/switch/unblock/archive"
planTitle: Projeção de fases do project no TODO do Grok
planActive: true
---

# Narrative / notes

Initiative F2.

## Session handoff
- **Narrative:** F2 closed after both-review fix1. Advance to F3 descriptor-only.
- **Decision log:** decision-review PASS; fix1 post-done projection both forks.
- **Single nextAction:** present phase-start package for F3 validate-only
- **Verbatim state:** currentPhase=F3; F2 done; HEAD=794205171257913c57fc723a553b1caaf5712211
- **Uncommitted changes:** (pending)
