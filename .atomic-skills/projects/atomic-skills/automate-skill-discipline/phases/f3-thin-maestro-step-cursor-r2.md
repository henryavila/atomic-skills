---
schemaVersion: "0.1"
slug: automate-skill-discipline-f3-thin-maestro-step-cursor-r2
title: Thin maestro step cursor (R2)
goal: Durable per-plan maestro cursor records step/phase/redispatch; assert and skill refuse actions that skip steps; no multi-host spawn supervisor.
status: done
branch: plan/automate-skill-discipline
started: 2026-07-21T20:07:28.991Z
lastUpdated: 2026-07-21T20:16:16.000Z
nextAction: Materialize F4 pause+framing
parentPlan: automate-skill-discipline
phaseId: F3
businessIntent:
  value: Cursor duravel de step do pure-maestro impede pular A-I sem o assert gritar — anti-pulo barato sem daemon Layer 4.
  workflow: TDD src/maestro-cursor.js (T-007) depois wire assert+prosa (T-008); status file sob .atomic-skills/status/automate/.
  rules: Nao spawn adapters multi-host; nao forcar cursor em non-automate; path so status/automate.
  outOfScope: Layer 3 host-local wait-loop; Layer 4 daemon; product file contents no cursor.
  doneWhen: maestro-cursor tests verdes; assert+skill referenciam cursor; F3-G1/G2 met.
tasksDone: 2
tasksTotal: 2
gatesMet: 2
gatesTotal: 2
exitGates:
  - id: F3-G1
    description: Maestro cursor unit tests pass.
    status: met
    verifier:
      kind: shell
      command: node --test tests/maestro-cursor.test.js
      expectExitCode: 0
    metAt: 2026-07-21T20:16:16.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-21T20:16:16.000Z
      verifiedCommit: 4e102d07e3313ac4ef9f085c58a5921774ea69f2
      passed: true
      exitCode: 0
      outputSummary: ok
  - id: F3-G2
    description: Assert + skill reference cursor anti-skip.
    status: met
    verifier:
      kind: shell
      command: rg -n 'maestro-cursor|cursor' scripts/assert-automate-gate.js skills/shared/implement-automate-maestro.md
      expectExitCode: 0
    metAt: 2026-07-21T20:16:16.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-21T20:16:16.000Z
      verifiedCommit: 4e102d07e3313ac4ef9f085c58a5921774ea69f2
      passed: true
      exitCode: 0
      outputSummary: ok
stack:
  - id: 1
    title: Thin maestro step cursor (R2)
    type: task
    openedAt: 2026-07-21T20:07:28.991Z
tasks:
  - id: T-007
    title: Maestro cursor module and status file
    status: done
    lastUpdated: 2026-07-21T20:16:16.000Z
    scopeBoundary:
      - Do not implement provider spawn adapters. Do not store product file contents in cursor. Path under .atomic-skills/status/automate/ only (or documented equivalent). No nested worktree changes.
    acceptance:
      - it - pure helpers read/write cursor shape step phaseId redispatchCount optional claimReportPath leasePath updatedAt.; it - legal transition table rejects e.g. jump C to G or done when step is B.; it - unit tests cover advance reject and pause state awaiting-operator-advance.; it - missing cursor on first automate entry initializes at A or B without throw.
    verifier:
      kind: shell
      command: node --test tests/maestro-cursor.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/maestro-cursor.js
      - kind: file
        path: tests/maestro-cursor.test.js
      - kind: file
        path: skills/shared/implement-automate-maestro.md
    closedAt: 2026-07-21T20:16:16.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-21T20:16:16.000Z
      verifiedCommit: 4e102d07e3313ac4ef9f085c58a5921774ea69f2
      passed: true
      exitCode: 0
      outputSummary: T-007 pass
  - id: T-008
    title: Assert and skill integrate cursor
    status: done
    lastUpdated: 2026-07-21T20:16:16.000Z
    scopeBoundary:
      - Do not force cursor on non-automate plans. Do not build Layer 3 host-local runner wait-loop.
    acceptance:
      - it - assert gates optionally or always under automate read cursor and block illegal step for spawn done phase-done.; it - maestro prose requires updating cursor on each A–I boundary event.; it - antipattern forbids deleting cursor or lease to force progress.; it - realism KB notes thin cursor as partial Layer 2.5 not Layer 4.
    verifier:
      kind: shell
      command: rg -n 'maestro-cursor|cursor' scripts/assert-automate-gate.js skills/shared/implement-automate-maestro.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: scripts/assert-automate-gate.js
      - kind: file
        path: tests/assert-automate-gate.test.js
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: skills/shared/implement-automate-maestro.md
      - kind: file
        path: skills/shared/implement-antipatterns.md
      - kind: file
        path: docs/kb/automate-orchestrator-realism.md
    closedAt: 2026-07-21T20:16:16.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-21T20:16:16.000Z
      verifiedCommit: 4e102d07e3313ac4ef9f085c58a5921774ea69f2
      passed: true
      exitCode: 0
      outputSummary: T-008 pass
parked: []
emerged: []
---

## Session handoff
- **Narrative:** F3 pure-maestro materialize; spawn writer T-007 T-008.
- **Decision log:** Automate continues.
- **Single nextAction:** Phase writer cursor module + assert integrate.
- **Verbatim state:** F3 active.
- **Uncommitted changes:** clean after commit.

# Narrative / notes

Initiative for phase **F3 — Thin maestro step cursor (R2)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
