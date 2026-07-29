---
schemaVersion: "0.1"
slug: automate-writer-runtime-f1-layer-3-host-local-runner-a
title: Layer 3 host-local runner (A)
goal: Package CLI prepares one phase writer cycle and validates claims without
  hosting a daemon.
summary: CLI host-local prepare/validate + builders de work-order e brief selado.
status: pending
branch: plan/automate-writer-runtime
started: 2026-07-29T15:50:31.824Z
lastUpdated: 2026-07-29T15:50:31.824Z
nextAction: "Start T-003: Pure work-order and sealed-brief builders"
parentPlan: automate-writer-runtime
phaseId: F1
businessIntent:
  value: Operators get a host-local CLI that prepares work-order, lease, sealed
    brief and validates claim reports so pure-maestro does not invent the writer
    channel ad hoc.
  workflow: Implement pure builders + scripts/automate-phase-run.js
    prepare/validate with unit tests; wire Step C skill prose to the runner;
    update realism Layer 3.
  rules: No spawn from Node. No done/phase-done from runner. Sibling worktree
    never nested under plan worktree. Never commit lease secrets. Compose
    writer-lease and claim-report.
  outOfScope: Product-source fence (F2). Layer 4 daemon. Concurrent phase writers.
    Mode 2 Codex.
  doneWhen: node --test for work-order, sealed-brief, phase-run pass and maestro
    asset greps automate-phase-run.
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: G-F1-1
    description: Runner prepare validate covered by unit tests and skill wiring.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/automate-work-order.test.js
        tests/automate-sealed-brief.test.js tests/automate-phase-run.test.js
      expectExitCode: 0
stack: []
tasks:
  - id: T-003
    title: Pure work-order and sealed-brief builders
    status: pending
    lastUpdated: 2026-07-29T15:50:31.824Z
    summary: Pure work-order and sealed-brief builders
    weight: 2
    scopeBoundary:
      - Do not spawn subagents. Do not mutate plan.md task status. Do not
        perform git worktree add in pure builders.
    acceptance:
      - work-order includes only pending or active SPEC-admitted tasks of the
        phase.
      - sealed brief includes code-only fence and claim-report shape and
        excludes host chat history.
      - unit tests pass for missing SPEC fields fail closed.
    verifier:
      kind: shell
      command: node --test tests/automate-work-order.test.js
        tests/automate-sealed-brief.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/automate-work-order.js
      - kind: file
        path: src/automate-sealed-brief.js
      - kind: file
        path: tests/automate-work-order.test.js
      - kind: file
        path: tests/automate-sealed-brief.test.js
  - id: T-004
    title: CLI automate-phase-run prepare and validate
    status: pending
    lastUpdated: 2026-07-29T15:50:31.824Z
    summary: CLI automate-phase-run prepare and validate
    weight: 3
    scopeBoundary:
      - Do not call spawn_subagent from Node. Do not run orchestrator done or
        phase-done. Do not nest worktree under plan worktree path. Do not
        git-add lease secret files.
    acceptance:
      - prepare exits 0 only when lease acquired and brief path exists.
      - validate exits non-zero on invalid claim report with shared SHAs without
        base head.
      - prepare refuses when isLeaseBlocking.
      - tests use temp dirs with no network.
    verifier:
      kind: shell
      command: node --test tests/automate-phase-run.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: scripts/automate-phase-run.js
      - kind: file
        path: src/automate-phase-run-lib.js
      - kind: file
        path: tests/automate-phase-run.test.js
      - kind: file
        path: docs/kb/automate-orchestrator-realism.md
  - id: T-005
    title: Skill Step C points at runner
    status: pending
    lastUpdated: 2026-07-29T15:50:31.824Z
    summary: Skill Step C points at runner
    weight: 2
    scopeBoundary:
      - Do not implement fence logic. Do not hardcode absolute home paths; use
        package-root pattern.
    acceptance:
      - maestro Step C lists prepare then spawn then validate order.
      - package-root resolution pattern matches other scripts in implement.md.
      - grep finds automate-phase-run in maestro asset.
    verifier:
      kind: shell
      command: node --test tests/automate-work-order.test.js
        tests/automate-sealed-brief.test.js tests/automate-phase-run.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: skills/shared/implement-automate-maestro.md
      - kind: file
        path: skills/shared/implement-phase-writer.md
parked: []
emerged: []
---

# Narrative / notes

Initiative for phase **F1 — Layer 3 host-local runner (A)**.

Materialized from sidecar with ratified BI (operator: implement via subagent).
