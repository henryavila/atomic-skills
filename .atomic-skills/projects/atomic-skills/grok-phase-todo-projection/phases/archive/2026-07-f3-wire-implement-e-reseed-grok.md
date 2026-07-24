---
schemaVersion: "0.1"
slug: grok-phase-todo-projection-f3-wire-implement-e-reseed-grok
title: Wire implement e reseed Grok
goal: implement Atomic Skills e cues de sessão reseedam o scaffold de fases;
  anti-proc; pós-compaction.
status: done
branch: plan/grok-phase-todo-projection
started: 2026-07-24T20:42:37.052Z
lastUpdated: 2026-07-24T20:51:50.963Z
nextAction: present phase-start package for F4 validate-only
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
tasksDone: 2
tasksTotal: 2
gatesMet: 2
gatesTotal: 2
weightDone: 2
weightTotal: 2
exitGates:
  - id: F3-G1
    description: implement assets mention helper reseed and anti-proc
    status: met
    verifier:
      kind: shell
      command: rg -n 'project-session-todos' skills/core/implement.md && rg -n
        'compaction|reseed|proc' skills/core/implement.md
      expectExitCode: 0
    metAt: 2026-07-24T20:51:50.963Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-24T20:51:50.963Z
      verifiedCommit: d70b11b2f5541d2687ebf97235660ca6d7cd1a80
      passed: true
      exitCode: 0
      outputSummary: >-
        85:2. Run `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null
        || echo .)/scripts/project-session-todos.js" --json`.

        140:7. **Close it.** After the implementation commit and the loads
        above, run `done <task-id>` via the project skill. The `done` flow
        executes the per-task verifier before setting `status: done`, writes
        evidence + `nextAction` + **`## Session handoff` in the same durable sav
    verifierLabel: "shell: rg -n 'project-session-todos' skills/core/implement.md && r…"
    evidenceSummary: passed · 2026-07-24
  - id: F3-G2
    description: Manual HARD operator dogfoods one implement start sees phase
      scaffold labels with titles
    status: met
    verifier:
      kind: manual
      description: Henry runs implement or helper plus todo_write once and acks labels
        show F0 n/N with title or summary
    metAt: 2026-07-24T20:51:50.963Z
    evidence:
      verifierKind: manual
      verifiedAt: 2026-07-24T20:51:50.963Z
      verifiedCommit: d70b11b2f5541d2687ebf97235660ca6d7cd1a80
      passed: true
      outputSummary: Operator F3-G2 dogfood PASS
    verifierLabel: manual
    evidenceSummary: passed · 2026-07-24
stack:
  - id: 1
    title: Wire implement e reseed Grok
    type: task
    openedAt: 2026-07-24T20:42:37.052Z
tasks:
  - id: T-001
    title: implement skill wire-up
    description: implement skill wire-up
    status: done
    lastUpdated: 2026-07-24T20:47:22.112Z
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
    closedAt: 2026-07-24T20:47:22.112Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-24T20:51:50.963Z
      verifiedCommit: d70b11b2f5541d2687ebf97235660ca6d7cd1a80
      passed: true
      exitCode: 0
      outputSummary: >
        te events or terminal rewrites). **Mode 1 post-done Grok projection** is
        owned by `project-transitions.md` (`done` step 5b: after `refresh-state`
        → `project-session-todos` → apply via `todo_write` on Grok) — do not
        invent a second close path or mark session todos completed to *cause*
        durable close.
  - id: T-002
    title: Reseed cues SessionStart e help
    description: Reseed cues SessionStart e help
    status: done
    lastUpdated: 2026-07-24T20:47:23.748Z
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
    closedAt: 2026-07-24T20:47:23.748Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-24T20:51:50.963Z
      verifiedCommit: d70b11b2f5541d2687ebf97235660ca6d7cd1a80
      passed: true
      exitCode: 0
      outputSummary: >
        lement/project start and post-compaction. Session

        skills/shared/project-assets/project-help.md:67:reseed but does not call
        `todo_write`. Claude / Codex / Cursor do **not** get

        skills/shared/project-assets/project-help.md:68:a mirrored phase-todo
        board from this package — do not invent non-Grok host
parked: []
emerged: []
summary: Implement reseeds scaffold; SessionStart só hint; anti-proc
planTitle: Projeção de fases do project no TODO do Grok
planActive: true
---

# F3

## Session handoff
- **Narrative:** F3 closed; advance F4 descriptor-only.
- **Decision log:** decision-review PASS; F3-G2 dogfood PASS.
- **Single nextAction:** present phase-start package for F4 validate-only
- **Verbatim state:** currentPhase=F4; HEAD=d70b11b2f5541d2687ebf97235660ca6d7cd1a80
- **Uncommitted changes:** (pending)


## Self-review
- F3 wire-up + dogfood PASS; review both receipt.
- Lessons: none.
