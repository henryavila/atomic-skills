---
schemaVersion: "0.1"
slug: implementation-automate-mode-f2-review-policy-phase-done-and-co
title: "Review policy: phase-done and complex tasks under automate"
goal: Wire automate-aware review policy so phase-done defaults to both, and complex tasks run review-code --mode=both before orchestrator done.
status: done
branch: plan/implementation-automate-mode
started: 2026-07-17T19:25:02.478Z
lastUpdated: 2026-07-17T19:29:38.000Z
nextAction: F2 done; materialize F3
parentPlan: implementation-automate-mode
phaseId: F2
businessIntent:
  value: "Review policy sob automate: phase-done defaults to both; complex tasks review-code both before done; executionMode stamp obrigatorio."
  workflow: Wire project-transitions automate matrix + unit tests; document complex-task both in implement.md.
  rules: P5 mode-scoped review cadence; non-automate keeps DESTRUCTIVE-only ladder; stamp executionMode after first automate entry.
  outOfScope: plan-end external-both (F3); full contract suite (F4).
  doneWhen: project-transitions-automate tests green; implement documents complex both review.
tasksDone: 3
tasksTotal: 3
gatesMet: 2
gatesTotal: 2
exitGates:
  - id: F2-G1
    description: Automate phase review mode matrix is unit-tested.
    status: met
    verifier:
      kind: shell
      command: node --test tests/project-transitions-automate.test.js
      expectExitCode: 0
    metAt: 2026-07-17T19:29:38.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T19:29:38.000Z
      verifiedCommit: 18d5b03d5fdd20cdf32f7ff8cc030a91d98f0b6e
      passed: true
      exitCode: 0
      outputSummary: "orch re-run: node --test tests/project-transitions-automate.test.js"
  - id: F2-G2
    description: implement documents complex-task both review before done.
    status: met
    verifier:
      kind: shell
      command: rg -n 'complex' skills/core/implement.md | rg -n 'both|review-code'
      expectExitCode: 0
    metAt: 2026-07-17T19:29:38.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T19:29:38.000Z
      verifiedCommit: 18d5b03d5fdd20cdf32f7ff8cc030a91d98f0b6e
      passed: true
      exitCode: 0
      outputSummary: "orch re-run: rg -n 'complex' skills/core/implement.md | rg -n 'both|review-code'"
stack:
  - id: 1
    title: "Review policy: phase-done and complex tasks under automate"
    type: task
    openedAt: 2026-07-17T19:25:02.478Z
tasks:
  - id: T-007
    title: phase-done review mode override for automate
    status: done
    lastUpdated: 2026-07-17T19:29:38.000Z
    scopeBoundary:
      - Do not change non-automate DESTRUCTIVE ladder defaults. Do not change lessons distill flow beyond noting review mode in self-review.
    acceptance:
      - it - When isAutomateActive is true, phase-done default review mode is both regardless of DESTRUCTIVE signal.; it - Non-automate path still uses both only when DESTRUCTIVE else local.; it - Explicit local override remains recordable; skip-review remains the only full skip.; it - phaseReviewMode pure helper is unit-tested and is the single definition used by transitions prose.
    verifier:
      kind: shell
      command: node --test tests/project-transitions-automate.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/phase-review-mode.js
      - kind: file
        path: tests/project-transitions-automate.test.js
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
    summary: phase-done review mode override for automate
    weight: 2
    closedAt: 2026-07-17T19:29:38.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T19:29:38.000Z
      verifiedCommit: 18d5b03d5fdd20cdf32f7ff8cc030a91d98f0b6e
      passed: true
      exitCode: 0
      outputSummary: "orch re-run: node --test tests/project-transitions-automate.test.js"
  - id: T-008
    title: Complex-task cross-model before done in implement automate
    status: done
    lastUpdated: 2026-07-17T19:29:38.000Z
    scopeBoundary:
      - Do not force cross-model on non-complex tasks. Do not change GATE-R2 verifier-first close authority.
    acceptance:
      - it - Claim report validates base and head or explicit disjoint commit range per task and rejects ambiguous overlapping multi-task SHAs.; it - Under automate, before done on a complex task, orchestrator runs review-code --mode=both on the validated task commit range.; it - destructiveDiff is computed from that validated range when classifying complex.; it - blocker and critical block done until re-dispatch or operator disposition with recorded major disposition accept defer or fix.; it - non-complex tasks close with verifier only under GATE-R2.; it - complex review leaves durable receipt or evidence before done.
    verifier:
      kind: shell
      command: node --test tests/complex-task.test.js tests/claim-report.test.js && rg -n 'isComplexTask|review-code --mode=both|claim report' skills/core/implement.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: skills/shared/implement-phase-writer.md
      - kind: file
        path: src/complex-task.js
      - kind: file
        path: src/claim-report.js
      - kind: file
        path: tests/claim-report.test.js
    summary: Complex-task cross-model before done in implement automate
    weight: 2
    closedAt: 2026-07-17T19:29:38.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T19:29:38.000Z
      verifiedCommit: 18d5b03d5fdd20cdf32f7ff8cc030a91d98f0b6e
      passed: true
      exitCode: 0
      outputSummary: "orch re-run: node --test tests/complex-task.test.js tests/claim-report.test.js && rg -n 'isComplexTask|review-code --mode=both|claim report' skills/core/implement.md"
  - id: T-009
    title: Mandatory executionMode stamp and clear path
    status: done
    lastUpdated: 2026-07-17T19:29:38.000Z
    scopeBoundary:
      - Do not require executionMode on plans that never entered automate. Do not break validate-state for plans without the field.
    acceptance:
      - it - plan schema accepts optional executionMode enum including automate for pre-stamp plans.; it - first confirmed implement --mode=automate entry MUST stamp executionMode automate after interactive operator confirm.; it - stamp alone makes isAutomateActive true for later implement phase-done finalize until clear.; it - clear path (implement --clear-execution-mode or recorded mutation) removes stamp and is unit-tested.; it - plans without the field still validate.
    verifier:
      kind: shell
      command: rg -n 'complex' skills/core/implement.md | rg -n 'both|review-code'
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: meta/schemas/plan.schema.json
      - kind: file
        path: tests/validate-state.test.js
      - kind: file
        path: src/implement-mode.js
    summary: Mandatory executionMode stamp and clear path
    weight: 2
    closedAt: 2026-07-17T19:29:38.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T19:29:38.000Z
      verifiedCommit: 18d5b03d5fdd20cdf32f7ff8cc030a91d98f0b6e
      passed: true
      exitCode: 0
      outputSummary: "orch re-run: rg -n 'complex' skills/core/implement.md | rg -n 'both|review-code'"
parked: []
emerged: []
summary: "Review policy: phase/complex both; executionMode stamp obrigatório."
---
# F2 initiative

## Session handoff
- **Narrative:** F2 materialized.
- **Decision log:** F1 closed.
- **Single nextAction:** Spawn F2 phase writer.
- **Verbatim state:** phase F2 active.
- **Uncommitted changes:** materialize.
