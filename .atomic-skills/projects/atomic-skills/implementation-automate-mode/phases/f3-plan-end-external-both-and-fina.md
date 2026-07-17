---
schemaVersion: "0.1"
slug: implementation-automate-mode-f3-plan-end-external-both-and-fina
title: Plan-end external-both and finalize hard gate
goal: Finalize and archive under automate require external-both receipt satisfying planEndReviewOk; missing success without skip hard-blocks.
status: done
branch: plan/implementation-automate-mode
started: 2026-07-17T19:29:38.832Z
lastUpdated: 2026-07-17T19:33:38.000Z
nextAction: Start T-010
parentPlan: implementation-automate-mode
phaseId: F3
businessIntent:
  value: Finalize/archive sob automate exigem planEndReviewOk e userValidationOk.
  workflow: Wire finalize hard-block + skip-plan-end-review reason; unit tests plan-end-review.
  rules: HARD-BLOCK without receipt success or skip reason; archive same gate.
  outOfScope: F4 contract tests/docs only after F3.
  doneWhen: planEndReviewOk tests + finalize docs hard-block + skip reason.
tasksDone: 2
tasksTotal: 2
gatesMet: 2
gatesTotal: 2
exitGates:
  - id: F3-G1
    description: planEndReviewOk unit tests pass and finalize documents the hard-block.
    status: met
    verifier:
      kind: shell
      command: node --test tests/plan-end-review.test.js && rg -n 'planEndReviewOk' skills/shared/project-assets/project-finalize.md
      expectExitCode: 0
    metAt: 2026-07-17T19:33:38.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T19:33:38.000Z
      verifiedCommit: ec0d8de06ae2c098ca748a9e86267b318892ec06
      passed: true
      exitCode: 0
      outputSummary: "orch: node --test tests/plan-end-review.test.js && rg -n 'planEndReviewOk' skills/shared/project-assets/project-finalize.md"
  - id: F3-G2
    description: skip-plan-end-review requires non-empty reason in documented contract.
    status: met
    verifier:
      kind: shell
      command: rg -n 'skip-plan-end-review' skills/shared/project-assets/project-finalize.md
      expectExitCode: 0
    metAt: 2026-07-17T19:33:38.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T19:33:38.000Z
      verifiedCommit: ec0d8de06ae2c098ca748a9e86267b318892ec06
      passed: true
      exitCode: 0
      outputSummary: "orch: rg -n 'skip-plan-end-review' skills/shared/project-assets/project-finalize.md"
stack:
  - id: 1
    title: Plan-end external-both and finalize hard gate
    type: task
    openedAt: 2026-07-17T19:29:38.832Z
tasks:
  - id: T-010
    title: Finalize plan-end review gate under automate
    status: done
    lastUpdated: 2026-07-17T19:33:38.000Z
    scopeBoundary:
      - Do not change finalize for non-automate plans beyond detection of executionMode. Do not auto-merge PRs. Do not skip the user-validation step after plan-end review.
    acceptance:
      - it - Under automate, finalize runs review-code external-both on the plan integration range before PR create or records skip with reason.; it - planEndReviewOk false hard-blocks finalize and archive.; it - receipt is linked from plan Reviews section with per-leg succeeded failed skipped.; it - plan schema admits durable userValidatedAt (or plan-end receipt fields) used by userValidationOk.; it - finalize hard-blocks unless userValidationOk is true after last phase and plan-end review.; it - zero family-different provider path offers guided skip with non-empty reason taxonomy rather than stranding the plan.
    verifier:
      kind: shell
      command: node --test tests/plan-end-review.test.js && rg -n 'planEndReviewOk|userValidationOk|userValidatedAt' skills/shared/project-assets/project-finalize.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-finalize.md
      - kind: file
        path: src/plan-end-review.js
      - kind: file
        path: tests/plan-end-review.test.js
      - kind: file
        path: meta/schemas/plan.schema.json
    summary: Finalize plan-end review gate under automate
    weight: 2
    closedAt: 2026-07-17T19:33:38.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T19:33:38.000Z
      verifiedCommit: ec0d8de06ae2c098ca748a9e86267b318892ec06
      passed: true
      exitCode: 0
      outputSummary: "orch: node --test tests/plan-end-review.test.js && rg -n 'planEndReviewOk|userValidationOk|userValidatedAt' skills/shared/project-assets/project-finalize.md"
  - id: T-011
    title: Archive hard-block and status visibility of plan-end receipt
    status: done
    lastUpdated: 2026-07-17T19:33:38.000Z
    scopeBoundary:
      - Do not invent a third external provider. Do not change CROSS-MODEL REVIEW cadence for non-automate. Soft pointer to finalize is not an archive success path.
    acceptance:
      - it - Archive under automate HARD-FAILS unless planEndReviewOk is true and userValidationOk is true.; it - status and drift may surface missing plan-end receipt on read-only paths without mutating state.; it - unit tests cover missing receipt, all failed or skipped legs, skip without reason, valid skip, valid successful leg, and missing userValidatedAt.
    verifier:
      kind: shell
      command: rg -n 'skip-plan-end-review' skills/shared/project-assets/project-finalize.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
      - kind: file
        path: skills/shared/project-assets/project-drift.md
      - kind: file
        path: src/plan-end-review.js
      - kind: file
        path: tests/plan-end-review.test.js
    summary: Archive hard-block and status visibility of plan-end receipt
    weight: 2
    closedAt: 2026-07-17T19:33:38.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T19:33:38.000Z
      verifiedCommit: ec0d8de06ae2c098ca748a9e86267b318892ec06
      passed: true
      exitCode: 0
      outputSummary: "orch: rg -n 'skip-plan-end-review' skills/shared/project-assets/project-finalize.md"
parked: []
emerged: []
summary: Finalize/archive hard-block planEndReviewOk + userValidationOk.
---
# F3

## Session handoff
- **Narrative:** F3 materialized.
- **Decision log:** prior phases closed.
- **Single nextAction:** Spawn F3 writer.
- **Verbatim state:** active.
- **Uncommitted changes:** materialize.
