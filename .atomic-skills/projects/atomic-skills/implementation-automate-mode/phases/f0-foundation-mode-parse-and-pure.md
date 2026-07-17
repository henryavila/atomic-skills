---
schemaVersion: "0.1"
slug: implementation-automate-mode-f0-foundation-mode-parse-and-pure
title: "Foundation: mode parse and pure predicates"
goal: Land pure, unit-tested helpers for automate mode detection, complex-task classification, and planEndReviewOk so skill prose and transitions share one definition.
status: archived
branch: plan/implementation-automate-mode
started: 2026-07-17T19:06:43.463Z
lastUpdated: 2026-07-17T22:03:10.000Z
nextAction: phase-done F0 complete; materialize and implement F1
parentPlan: implementation-automate-mode
phaseId: F0
businessIntent:
  value: "Helpers puros sao a unica fonte da verdade do modo: mode parse, isComplexTask, planEndReviewOk e userValidationOk compartilhados por implement/transitions/finalize."
  workflow: "TDD helpers: testes RED, implementar src/implement-mode.js, complex-task.js, plan-end-review.js; F1+ consome os helpers."
  rules: Helpers puros sem I/O de rede; automate off por default; nao tocar Mode 2 lane.
  outOfScope: Prosa completa phase-done/finalize e spawn real (F1+); Mode 2 changes; auto-finalize.
  doneWhen: Suites implement-mode, complex-task e plan-end-review verdes; F0-G1/F0-G2 met.
tasksDone: 3
tasksTotal: 3
gatesMet: 2
gatesTotal: 2
exitGates:
  - id: F0-G1
    description: Unit tests for implement-mode, complex-task, and plan-end-review all pass.
    status: met
    verifier:
      kind: shell
      command: node --test tests/implement-mode.test.js tests/complex-task.test.js tests/plan-end-review.test.js
      expectExitCode: 0
    metAt: 2026-07-17T19:20:13.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T19:20:13.000Z
      verifiedCommit: 384fd74a2c41c6368d8e653918dd8ebe2bc98882
      passed: true
      exitCode: 0
      outputSummary: "  ✔ false for non-ISO / invalid timestamps under automate (0.104334ms)   ✔ true only with non-empty ISO timestamp under automate (0.046375ms)   ✔ optional validatorId does not alone satisfy the gate (0.027ms) ✔ userValidationOk (0.423917ms) ℹ tests 45 ℹ suites 5 ℹ pass 45 ℹ fail 0 ℹ cancelled 0 ℹ skipped 0 ℹ todo 0 ℹ duration_ms 38.741042"
  - id: F0-G2
    description: Helpers are pure modules importable without side effects on import.
    status: met
    verifier:
      kind: shell
      command: node -e "import('./src/implement-mode.js'); import('./src/complex-task.js'); import('./src/plan-end-review.js');"
      expectExitCode: 0
    metAt: 2026-07-17T19:20:13.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T19:20:13.000Z
      verifiedCommit: 384fd74a2c41c6368d8e653918dd8ebe2bc98882
      passed: true
      exitCode: 0
      outputSummary: import ok
stack:
  - id: 1
    title: "Foundation: mode parse and pure predicates"
    type: task
    openedAt: 2026-07-17T19:06:43.463Z
tasks:
  - id: T-001
    title: Parse implement mode flag and isAutomateActive
    status: done
    lastUpdated: 2026-07-17T19:20:13.000Z
    scopeBoundary:
      - Do not change Mode 2 routing.json or codex lane dispatch. Do not edit phase-done or finalize yet.
    acceptance:
      - it - parseImplementMode accepts --mode=automate and mode:automate tokens and returns mode automate.; it - absent mode or --mode=1 returns mode default or mode1 without treating automate as on.; it - isAutomateActive implements CLI vs stamp vs clear precedence and unit tests cover the matrix including stamp-alone re-entry and clear path.; it - unknown mode is rejected with a clear error (not ignored).
    verifier:
      kind: shell
      command: node --test tests/implement-mode.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/implement-mode.js
      - kind: file
        path: tests/implement-mode.test.js
      - kind: file
        path: skills/core/implement.md
    summary: parseImplementMode + isAutomateActive (CLI/stamp/clear).
    weight: 3
    closedAt: 2026-07-17T19:15:24.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T19:20:13.000Z
      verifiedCommit: 384fd74a2c41c6368d8e653918dd8ebe2bc98882
      passed: true
      exitCode: 0
      outputSummary: refreshed after F0 review fix; suite green
  - id: T-002
    title: Complex-task predicate helper
    status: done
    lastUpdated: 2026-07-17T19:20:13.000Z
    scopeBoundary:
      - Do not call review-code or mutate initiative files. Do not change weight rollup semantics outside the predicate.
    acceptance:
      - it - isComplexTask returns true when weight is greater than or equal to threshold default 3.; it - returns true when tags include destructive or decommission or drop or complex.; it - returns true when destructiveDiff flag is true.; it - weightless task with no tags and destructiveDiff false returns false.; it - threshold is overridable via options.
    verifier:
      kind: shell
      command: node --test tests/complex-task.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/complex-task.js
      - kind: file
        path: tests/complex-task.test.js
    summary: isComplexTask (weight, tags, destructiveDiff).
    weight: 2
    closedAt: 2026-07-17T19:15:24.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T19:20:13.000Z
      verifiedCommit: 384fd74a2c41c6368d8e653918dd8ebe2bc98882
      passed: true
      exitCode: 0
      outputSummary: refreshed after F0 review fix; suite green
  - id: T-003
    title: planEndReviewOk and userValidationOk predicates
    status: done
    lastUpdated: 2026-07-17T19:20:13.000Z
    scopeBoundary:
      - Do not invoke external CLIs. Do not change external-both merge algorithm.
    acceptance:
      - it - planEndReviewOk is false when receipt is missing.; it - true when at least one family-different external leg has status succeeded.; it - true when skipPlanEndReview is true with non-empty reason even if all legs failed.; it - false when all legs skipped or failed and no skip reason.; it - single remaining leg after host filter counts when succeeded.; it - userValidationOk is false when userValidatedAt is missing or empty under automate and true only when a non-empty ISO timestamp (or equivalent receipt) is present with optional validator id.
    verifier:
      kind: shell
      command: node --test tests/plan-end-review.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/plan-end-review.js
      - kind: file
        path: tests/plan-end-review.test.js
    summary: planEndReviewOk + userValidationOk com testes.
    weight: 3
    closedAt: 2026-07-17T19:15:24.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T19:20:13.000Z
      verifiedCommit: 384fd74a2c41c6368d8e653918dd8ebe2bc98882
      passed: true
      exitCode: 0
      outputSummary: "  ✔ false for non-ISO / invalid timestamps under automate (0.113875ms)   ✔ true only with non-empty ISO timestamp under automate (0.044125ms)   ✔ optional validatorId does not alone satisfy the gate (0.024667ms) ✔ userValidationOk (0.443125ms) ℹ tests 16 ℹ suites 2 ℹ pass 16 ℹ fail 0 ℹ cancelled 0 ℹ skipped 0 ℹ todo 0 ℹ duration_ms 36.785083"
parked: []
emerged: []
summary: "Helpers puros: mode parse, isComplexTask, planEndReviewOk e userValidationOk."
---

# Narrative / notes

Initiative for phase **F0 — Foundation: mode parse and pure predicates**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

## Session handoff
- **Narrative:** F0 complete. Helpers + review fixes merged. Gates met with evidence at HEAD 384fd74a2c41c6368d8e653918dd8ebe2bc98882. Cross-model review findings C1/C2/M* applied.
- **Decision log:** familyDifferent fail-closed; ISO userValidatedAt; CLI non-automate overrides stamp; Mode2 tokens accepted non-automate; residual argv strip deferred to F1.
- **Single nextAction:** Materialize F1 and spawn F1 phase writer.
- **Verbatim state:** HEAD=384fd74a2c41c6368d8e653918dd8ebe2bc98882; 45 tests pass; review 2026-07-17-1918-implementation-automate-mode-f0-both.md
- **Uncommitted changes:** F0 phase-done state close.
