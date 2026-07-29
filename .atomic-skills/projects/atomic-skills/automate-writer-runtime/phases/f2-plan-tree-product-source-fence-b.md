---
schemaVersion: "0.1"
slug: automate-writer-runtime-f2-plan-tree-product-source-fence-b
title: Plan-tree product-source fence (B)
goal: Under durable automate, block orchestrator done when plan-branch product
  paths changed outside claim-backed SHAs.
summary: Cerca de product-source no plan tree no assert done sob automate.
status: pending
branch: plan/automate-writer-runtime
started: 2026-07-29T15:50:31.824Z
lastUpdated: 2026-07-29T15:50:31.824Z
nextAction: "Start T-006: Pure product-path classifier and fence predicate"
parentPlan: automate-writer-runtime
phaseId: F2
businessIntent:
  value: Under durable automate, orchestrator done fails closed when plan-branch
    product paths changed outside claim-backed coverage.
  workflow: Implement pure fence predicate, wire into canDoneFromAutomateClaims
    and assert-automate-gate --gate done, document Step E and antipatterns.
  rules: Pure predicate injects path lists (no git inside pure module). No chat
    waiver. Preserve lastAssert. State paths under .atomic-skills do not trip
    fence.
  outOfScope: Layer 4. Claim lease-secret signing. Changing phase-done
    evaluationGate beyond done path.
  doneWhen: Fence unit tests and assert done integration tests pass; maestro
    mentions fence.
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: G-F2-1
    description: Fence unit tests and assert done integration pass.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/automate-product-fence.test.js
        tests/assert-automate-gate.test.js
      expectExitCode: 0
stack: []
tasks:
  - id: T-006
    title: Pure product-path classifier and fence predicate
    status: pending
    lastUpdated: 2026-07-29T15:50:31.824Z
    summary: Pure product-path classifier and fence predicate
    weight: 2
    scopeBoundary:
      - Do not run git in the pure predicate; inject path lists. Do not change
        plan schema.
    acceptance:
      - state paths under .atomic-skills do not trip the fence.
      - product path without claim coverage returns ok false with reason.
      - product path covered by claim paths returns ok true.
      - empty plan-branch product diff returns ok true.
    verifier:
      kind: shell
      command: node --test tests/automate-product-fence.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/automate-product-fence.js
      - kind: file
        path: tests/automate-product-fence.test.js
  - id: T-007
    title: Wire fence into assert done and orchestrator gates
    status: pending
    lastUpdated: 2026-07-29T15:50:31.824Z
    summary: Wire fence into assert done and orchestrator gates
    weight: 3
    scopeBoundary:
      - Do not change phase-done evaluationGate semantics beyond done path. Do
        not delete lastAssert behavior.
    acceptance:
      - assert gate done fails closed when product fence fails under automate
        stamp.
      - assert still passes when claims valid and fence ok.
      - existing claim-bound done tests remain green or updated intentionally.
    verifier:
      kind: shell
      command: node --test tests/assert-automate-gate.test.js
        tests/automate-orchestrator-gates.test.js
        tests/automate-product-fence.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/automate-orchestrator-gates.js
      - kind: file
        path: scripts/assert-automate-gate.js
      - kind: file
        path: tests/assert-automate-gate.test.js
      - kind: file
        path: tests/automate-orchestrator-gates.test.js
  - id: T-008
    title: Skill and antipattern for fence
    status: pending
    lastUpdated: 2026-07-29T15:50:31.824Z
    summary: Skill and antipattern for fence
    weight: 2
    scopeBoundary:
      - Do not soften fence with chat waiver.
    acceptance:
      - maestro Step E mentions product fence or assert done failure for
        plan-tree product paths.
      - antipatterns include host product commit on plan branch under automate.
    verifier:
      kind: shell
      command: node --test tests/automate-product-fence.test.js
        tests/assert-automate-gate.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/implement-automate-maestro.md
      - kind: file
        path: skills/shared/implement-antipatterns.md
      - kind: file
        path: docs/kb/automate-orchestrator-realism.md
parked: []
emerged: []
---

# Narrative / notes

Initiative for phase **F2 — Plan-tree product-source fence (B)**.

Materialized from sidecar with ratified BI (operator: implement via subagent).
