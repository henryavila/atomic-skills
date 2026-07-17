---
schemaVersion: "0.1"
slug: implementation-automate-mode-f4-integration-tests-install-surfa
title: Integration tests, install surface, and dogfood
goal: Lock the mode with tests that exercise prose contracts and helper wiring; document the mode for operators; keep install/catalog consistent.
status: active
branch: plan/implementation-automate-mode
started: 2026-07-17T19:33:38.837Z
lastUpdated: 2026-07-17T19:33:38.837Z
nextAction: Start T-012
parentPlan: implementation-automate-mode
phaseId: F4
businessIntent:
  value: Contract tests, docs/catalog e suite completa verde para automate mode.
  workflow: implement-automate-contract tests + docs + validate-skills + npm test.
  rules: No new top-level automate skill; catalog consistent; dogfood notes ok.
  outOfScope: New product features beyond automate surface.
  doneWhen: contract tests + npm test + validate-skills green.
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: F4-G1
    description: implement-automate contract tests and full npm test pass.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/implement-automate-contract.test.js && npm test
      expectExitCode: 0
  - id: F4-G2
    description: validate-skills exits 0 after catalog or docs touch.
    status: pending
    verifier:
      kind: shell
      command: node scripts/validate-skills.js
      expectExitCode: 0
stack:
  - id: 1
    title: Integration tests, install surface, and dogfood
    type: task
    openedAt: 2026-07-17T19:33:38.837Z
tasks:
  - id: T-012
    title: Contract tests for automate skill surface
    status: pending
    lastUpdated: 2026-07-17T19:33:38.837Z
    scopeBoundary:
      - Do not require live Codex or Grok network in unit CI. Do not enable Mode 2 by default.
    acceptance:
      - it - Contract tests assert implement.md contains automate maestro markers phase-writer code-only and complex both and plan-end external-both pointers.; it - contract tests assert project-transitions automate phase review and finalize planEndReviewOk strings.; it - npm test includes the new contract file.
    verifier:
      kind: shell
      command: node --test tests/implement-automate-contract.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: tests/implement-automate-contract.test.js
      - kind: file
        path: package.json
    summary: Contract tests for automate skill surface
    weight: 2
  - id: T-013
    title: Operator docs and catalog one-liner touch if needed
    status: pending
    lastUpdated: 2026-07-17T19:33:38.837Z
    scopeBoundary:
      - Do not rewrite the full orchestrator CANON. Do not change skill namespace layout.
    acceptance:
      - it - Operator-facing doc mentions implement automate mode and points at implement.md contract.; it - core.implement catalog entry description or argument_hint mentions mode automate if argument_hint is updated without breaking compact format.; it - validate-skills still exits 0.
    verifier:
      kind: shell
      command: node scripts/validate-skills.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: docs/kb/project-lazy-materialization.md
      - kind: file
        path: docs/concepts/project-tracking.md
      - kind: file
        path: meta/catalog.yaml
    summary: Operator docs and catalog one-liner touch if needed
    weight: 2
  - id: T-014
    title: Full suite green after automate landing
    status: pending
    lastUpdated: 2026-07-17T19:33:38.837Z
    scopeBoundary:
      - Do not skip failing unrelated suites by disabling them. Do not expand dogfood into a live multi-phase plan execution in this task.
    acceptance:
      - it - npm test exits 0 on the package after all automate files land.; it - no skills/core/automate.md exists.
    verifier:
      kind: shell
      command: node scripts/validate-skills.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: package.json
    summary: Full suite green after automate landing
    weight: 2
parked: []
emerged: []
summary: Contract tests, docs/catálogo e suite completa verde.
---
# F4

## Session handoff
- **Narrative:** F4 materialized.
- **Decision log:** F0-F3 done.
- **Single nextAction:** F4 writer.
- **Verbatim state:** active.
- **Uncommitted changes:** materialize.
