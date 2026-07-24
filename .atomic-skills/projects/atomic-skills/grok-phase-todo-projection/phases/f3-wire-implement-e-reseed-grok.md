---
schemaVersion: "0.1"
slug: grok-phase-todo-projection-f3-wire-implement-e-reseed-grok
title: Wire implement e reseed Grok
goal: implement Atomic Skills e cues de sessão reseedam o scaffold de fases;
  anti-proc; pós-compaction.
status: active
branch: plan/grok-phase-todo-projection
started: 2026-07-24T20:42:37.052Z
lastUpdated: 2026-07-24T20:42:37.052Z
nextAction: "Start T-001: implement skill wire-up"
parentPlan: grok-phase-todo-projection
phaseId: F3
businessIntent:
  value: Sessões Grok reseedam trilho de fases no start/implement/compaction sem
    SoT duplo nem proc:* competindo.
  workflow: Wire implement/maestro → SessionStart hint + project help → F3-G1 +
    dogfood manual F3-G2.
  rules: merge:false no start; anti-proc com plan ancorado; SessionStart só hint
    fail-open; host-thin pode todo_write sem product edits.
  outOfScope: GATE-R2/claim exclusivity changes; T-00N todos; SessionStart chama
    todo_write.
  doneWhen: implement assets greppable helper/reseed/anti-proc; Henry dogfood PASS F3-G2.
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
weightDone: 0
weightTotal: 2
exitGates:
  - id: F3-G1
    description: implement assets mention helper reseed and anti-proc
    status: pending
    verifier:
      kind: shell
      command: rg -n 'project-session-todos' skills/core/implement.md && rg -n
        'compaction|reseed|proc' skills/core/implement.md
      expectExitCode: 0
  - id: F3-G2
    description: Manual HARD operator dogfoods one implement start sees phase
      scaffold labels with titles
    status: pending
    verifier:
      kind: manual
      description: Henry runs implement or helper plus todo_write once and acks labels
        show F0 n/N with title or summary
stack:
  - id: 1
    title: Wire implement e reseed Grok
    type: task
    openedAt: 2026-07-24T20:42:37.052Z
tasks:
  - id: T-001
    title: implement skill wire-up
    description: implement skill wire-up
    status: pending
    lastUpdated: 2026-07-24T20:42:37.052Z
    scopeBoundary:
      - do not change GATE-R2 or pure-maestro claim exclusivity; do not project
        T-00N as todos; host-thin may update todos as orchestration without
        product edits
    acceptance:
      - implement start runs refresh-state and applies phase scaffold merge
        false; after done Mode 1 references transitions projection step; forbids
        proc scaffold while plan-anchored; reseed after compaction documented
    verifier:
      kind: shell
      command: rg -n 'project-session-todos|phase scaffold|todo_write|compaction'
        skills/core/implement.md skills/shared/implement-automate-maestro.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: skills/shared/implement-automate-maestro.md
    summary: implement skill wire-up
    weight: 1
  - id: T-002
    title: Reseed cues SessionStart e help
    description: Reseed cues SessionStart e help
    status: pending
    lastUpdated: 2026-07-24T20:42:37.052Z
    scopeBoundary:
      - do not break Soft fail-open; SessionStart cannot call todo_write only
        optional hint
    acceptance:
      - session-start still runs refresh-state and may print Grok reseed hint;
        project help mentions projection on Grok without inventing non-Grok
        tools
    verifier:
      kind: shell
      command: rg -n 'refresh-state|reseed|project-session-todos|Grok'
        skills/shared/project-assets/hooks/session-start.sh
        skills/shared/project-assets/project-help.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/project-assets/hooks/session-start.sh
      - kind: file
        path: skills/shared/project-assets/project-help.md
    summary: Reseed cues SessionStart e help
    weight: 1
parked: []
emerged: []
summary: Implement reseeds scaffold; SessionStart só hint; anti-proc
planTitle: Projeção de fases do project no TODO do Grok
planActive: true
current: true
---
# F3

## Session handoff
- **Narrative:** F3 package ratified Mode B materialize.
- **Decision log:** operator ratify F3 + T-002 verifier.
- **Single nextAction:** spawn fresh writer after ratify
- **Verbatim state:** .atomic-skills/projects/atomic-skills/grok-phase-todo-projection/phases/f3-wire-implement-e-reseed-grok.md
- **Uncommitted changes:** (pending)
