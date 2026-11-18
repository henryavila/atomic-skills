---
schemaVersion: "0.1"
slug: automate-writer-runtime-f2-plan-tree-product-source-fence-b
title: Plan-tree product-source fence (B)
goal: Under durable automate, block orchestrator done when plan-branch product
  paths changed outside claim-backed SHAs.
summary: Cerca de product-source no plan tree no assert done sob automate.
status: done
branch: plan/automate-writer-runtime
started: 2026-07-29T15:50:31.824Z
lastUpdated: 2026-07-29T16:26:58.973Z
nextAction: null
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
tasksDone: 3
tasksTotal: 3
gatesMet: 1
gatesTotal: 1
weightDone: 7
weightTotal: 7
exitGates:
  - id: G-F2-1
    description: Fence unit tests and assert done integration pass.
    status: met
    verifier:
      kind: shell
      command: node --test tests/automate-product-fence.test.js
        tests/assert-automate-gate.test.js
      expectExitCode: 0
    metAt: 2026-07-29T16:26:58.973Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-29T16:26:58.973Z
      passed: true
      exitCode: 0
      verifiedCommit: 06d0918db4c118155e3a2fe7c7e49a69d35f9ac7
    verifierLabel: "shell: node --test tests/automate-product-fence.test.js tests/asse…"
    evidenceSummary: passed · 2026-07-29
stack: []
tasks:
  - id: T-006
    title: Pure product-path classifier and fence predicate
    status: done
    lastUpdated: 2026-07-29T16:26:58.973Z
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
    closedAt: 2026-07-29T16:26:58.973Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-29T16:26:58.973Z
      passed: true
      exitCode: 0
      verifiedCommit: 06d0918db4c118155e3a2fe7c7e49a69d35f9ac7
  - id: T-007
    title: Wire fence into assert done and orchestrator gates
    status: done
    lastUpdated: 2026-07-29T16:26:58.973Z
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
    closedAt: 2026-07-29T16:26:58.973Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-29T16:26:58.973Z
      passed: true
      exitCode: 0
      verifiedCommit: 06d0918db4c118155e3a2fe7c7e49a69d35f9ac7
  - id: T-008
    title: Skill and antipattern for fence
    status: done
    lastUpdated: 2026-07-29T16:26:58.973Z
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
    closedAt: 2026-07-29T16:26:58.973Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-29T16:26:58.973Z
      passed: true
      exitCode: 0
      verifiedCommit: 06d0918db4c118155e3a2fe7c7e49a69d35f9ac7
parked: []
emerged: []
planTitle: Automate writer runtime (1 + A + B)
---

# Narrative / notes

Initiative for phase **F2 — Plan-tree product-source fence (B)**.

Materialized from sidecar with ratified BI (operator: implement via subagent).

## Session handoff
- **Narrative:** Phase F2 implemented by isolated phase writer and merged FF onto plan/automate-writer-runtime (HEAD 06d0918d). Orchestrator re-ran plan-scoped verifiers (132 pass).
- **Decision log:** Host-orchestrated single writer for F0–F3; residual full npm test failures treated as orthogonal (documented on T-009 evidence).
- **Single nextAction:** phase-done already reflected in initiative status; advance plan currentPhase or finalize after operator review.
- **Verbatim state:** node --test plan-scoped suite exit 0; claim report .atomic-skills/status/automate/automate-writer-runtime-claims.json
- **Uncommitted changes:** clean tree expected after state checkpoint commit.
