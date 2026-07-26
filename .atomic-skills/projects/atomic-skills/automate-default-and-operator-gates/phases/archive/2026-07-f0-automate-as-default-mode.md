---
schemaVersion: "0.1"
slug: automate-default-and-operator-gates-f0-automate-as-default-mode
title: Automate as default mode
goal: Flip default so bare implement enters pure-maestro; Mode 1 is explicit;
  docs/tests match.
status: archived
branch: plan/automate-default-and-operator-gates
started: 2026-07-25T22:39:25.331Z
lastUpdated: 2026-07-26T22:25:13.696Z
nextAction: present phase-start package for F1 validate-only
parentPlan: automate-default-and-operator-gates
phaseId: F0
businessIntent:
  value: Automate is the default implement path so multi-phase plans run
    pure-maestro without a mode flag, with Mode 1 only via explicit escape.
  workflow: TDD isAutomateActive and parse matrix first, then update
    implement/maestro prose and antipatterns so docs match machine default.
  rules: Mode 1 remains via --mode=1; host-thin Iron Law unchanged; no auto-merge;
    durable stamp and clear path stay; session default must activate machine
    gates even before stamp.
  outOfScope: Decision package UX (F1); intent-vs-delivered plan-end (F2); dogfood
    checklist (F3); review stub authenticity and post-merge e2e from dump
    follow-ups.
  doneWhen: implement-mode tests green for no-CLI no-stamp true; prose states
    automate default and Mode-1 escape; F0-G1 and F0-G2 met.
tasksDone: 2
tasksTotal: 2
gatesMet: 2
gatesTotal: 2
weightDone: 5
weightTotal: 5
exitGates:
  - id: F0-G1
    description: implement-mode unit tests green with automate-default matrix.
    status: met
    verifier:
      kind: shell
      command: node --test tests/implement-mode.test.js
      expectExitCode: 0
    metAt: 2026-07-26T22:24:32.445Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-26T22:24:32.445Z
      verifiedCommit: 95872f9fe798d25a6e9f4a8b56261c0952d55023
      passed: true
      exitCode: 0
      outputSummary: F0-G1 re-verified at phase-done
    verifierLabel: "shell: node --test tests/implement-mode.test.js"
    evidenceSummary: passed · 2026-07-26
  - id: F0-G2
    description: Skill prose states automate default and Mode-1 escape hatch.
    status: met
    verifier:
      kind: shell
      command: rg -n 'default|Mode 1|--mode=1' skills/core/implement.md
        skills/shared/implement-automate-maestro.md
      expectExitCode: 0
    metAt: 2026-07-26T22:24:32.445Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-26T22:24:32.445Z
      verifiedCommit: 95872f9fe798d25a6e9f4a8b56261c0952d55023
      passed: true
      exitCode: 0
      outputSummary: F0-G2 re-verified at phase-done
    verifierLabel: "shell: rg -n 'default|Mode 1|--mode=1' skills/core/implement.md sk…"
    evidenceSummary: passed · 2026-07-26
stack:
  - id: 1
    title: Automate as default mode
    type: task
    openedAt: 2026-07-25T22:39:25.331Z
tasks:
  - id: T-001
    title: Flip isAutomateActive and parse default
    status: done
    closedAt: 2026-07-26T03:06:43.000Z
    lastUpdated: 2026-07-26T03:06:43.000Z
    scopeBoundary:
      - Do not remove Mode 1 path. Do not make finalize auto-merge. Durable
        stamp and clear-execution-mode lease HARD-GATE stay.
    acceptance:
      - it - Absent CLI mode and no stamp yields isAutomateActive true.; it -
        Explicit mode 1 or mode:1 yields isAutomateActive false.; it -
        mode=automate and stamp-alone still true; clearExecutionMode still
        false.; it - Unit matrix covers no-CLI no-stamp for automate-default.
    verifier:
      kind: shell
      command: node --test tests/implement-mode.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-26T03:06:43.000Z
      verifiedCommit: 96b8e898a889a7fb4a3d48f6b62a2bc40623a3d8
      passed: true
      exitCode: 0
      outputSummary: node --test tests/implement-mode.test.js → ℹ tests 30 ℹ pass 30 ℹ fail 0
    outputs:
      - kind: file
        path: src/implement-mode.js
      - kind: file
        path: tests/implement-mode.test.js
    summary: Inverter isAutomateActive para default true e cobrir com testes.
    weight: 3
  - id: T-002
    title: Skill prose and antipatterns for automate default
    status: done
    closedAt: 2026-07-26T03:09:20.000Z
    lastUpdated: 2026-07-26T03:09:20.000Z
    scopeBoundary:
      - Do not delete host-thin or never self-certify laws. Do not document
        silent Mode-1 fallback as allowed.
    acceptance:
      - it - Prose states automate is default and Mode 1 requires explicit
        flag.; it - Original opt-in only principle is marked superseded by this
        plan.; it - Antipattern exists for assuming bare implement is
        session-writer Mode 1.; it - Maestro notes gate activation rule for
        session default plus stamp.
    verifier:
      kind: shell
      command: rg -n 'default|Mode 1|--mode=1' skills/core/implement.md
        skills/shared/implement-automate-maestro.md
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-26T03:09:20.000Z
      verifiedCommit: a588996a17eeb36820c2f522b1ef8e34bec77c88
      passed: true
      exitCode: 0
      outputSummary: rg -n 'default|Mode 1|--mode=1' skills/core/implement.md
        skills/shared/implement-automate-maestro.md → exit 0 (matches include
        automate default + --mode=1)
    outputs:
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: skills/shared/implement-automate-maestro.md
      - kind: file
        path: skills/shared/implement-antipatterns.md
      - kind: file
        path: docs/kb/project-lazy-materialization.md
    summary: Atualizar prosa/antipatterns para automate default.
    weight: 2
parked: []
emerged: []
summary: Tornar automate o default do implement com escape Mode 1.
planTitle: Automate default + operator gates (decision-review + plan-end intent)
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F0 — Automate as default mode**.

## Decisions

- F0 implemented in **Mode 1** (`--mode=1`) to avoid pure-maestro circularity
  while the default flip was mid-flight (handoff recommendation).
- Unstamp alone does **not** opt into Mode 1 under F0: bare session is
  automate-default; session leave needs `--clear-execution-mode` or explicit
  `--mode=1`.

## Session handoff

- **Narrative:** F0 closed via pure-maestro. decision-review PASS with package in same AskUserQuestion turn. evaluation/lessons/review/assert green. currentPhase advanced to F1 (descriptor-only). Automate pause: awaiting-operator-advance before next spawn/materialize.
- **Decision log:** stamp y; skip writer; eval pass; lessons none; review both; schema lessonsState; dogfood ask-without-body captured for F1; decision-review PASS (package+options same turn).
- **Single nextAction:** present phase-start package for F1 validate-only
- **Verbatim state:** plan currentPhase F1; F0 status done; assert-automate-gate --gate phase-done exit 0; decisions/F0.jsonl; HEAD 95872f9fe798d25a6e9f4a8b56261c0952d55023.
- **Uncommitted changes:** phase-done state pending checkpoint.


## Links

- plan: `../plan.md`
- design: `../design.md`
- SESSION-HANDOFF: `../SESSION-HANDOFF.md`

## Self-review against code-quality gates

- G1: applied — T-001/T-002 + eval report
- G2: applied — PASS via AskUserQuestion only
- G6: applied — package path + evidence paths verbatim
- Lessons: none (clean)
- Review gate: both @ 95872f9fe798d25a6e9f4a8b56261c0952d55023
- decision-review PASS @ 2026-07-26T22:25:13.410Z
