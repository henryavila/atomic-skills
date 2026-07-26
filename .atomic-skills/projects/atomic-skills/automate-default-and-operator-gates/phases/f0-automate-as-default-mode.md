---
schemaVersion: "0.1"
slug: automate-default-and-operator-gates-f0-automate-as-default-mode
title: Automate as default mode
goal: Flip default so bare implement enters pure-maestro; Mode 1 is explicit;
  docs/tests match.
status: active
branch: plan/automate-default-and-operator-gates
started: 2026-07-25T22:39:25.331Z
lastUpdated: 2026-07-26T03:06:43.000Z
nextAction: "Start T-002: update implement/maestro/antipatterns + kb for automate default"
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
tasksDone: 1
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
weightDone: 3
weightTotal: 5
exitGates:
  - id: F0-G1
    description: implement-mode unit tests green with automate-default matrix.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/implement-mode.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/implement-mode.test.js"
  - id: F0-G2
    description: Skill prose states automate default and Mode-1 escape hatch.
    status: pending
    verifier:
      kind: shell
      command: rg -n 'default|Mode 1|--mode=1' skills/core/implement.md
        skills/shared/implement-automate-maestro.md
      expectExitCode: 0
    verifierLabel: "shell: rg -n 'default|Mode 1|--mode=1' skills/core/implement.md sk…"
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
    status: pending
    lastUpdated: 2026-07-25T22:39:25.331Z
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

- **Narrative:** F0 T-001 closed. `isAutomateActive` is ON by default (no CLI,
  no non-automate stamp, no clear). Mode 1 escape via `--mode=1` / `mode:1`.
  Collateral: `tests/implement-automate-contract.test.js` updated for default-ON.
  T-002 (prose/antipatterns/kb) is next.
- **Decision log:** Mode 1 for this plan's F0 coding (circular pure-maestro until
  default lands). F4 scope not reopened. No Lekto product work.
- **Single nextAction:** Start T-002: update implement/maestro/antipatterns + kb for automate default
- **Verbatim state:** `node --test tests/implement-mode.test.js` → pass 30/30;
  HEAD at close `96b8e898a889a7fb4a3d48f6b62a2bc40623a3d8`; paths
  `src/implement-mode.js`, `tests/implement-mode.test.js`,
  `tests/implement-automate-contract.test.js`.
- **Uncommitted changes:** clean tree after checkpoint (or only this state close).

## Links

- plan: `../plan.md`
- design: `../design.md`
- SESSION-HANDOFF: `../SESSION-HANDOFF.md`
