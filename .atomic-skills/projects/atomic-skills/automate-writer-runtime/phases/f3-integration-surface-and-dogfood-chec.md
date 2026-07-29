---
schemaVersion: "0.1"
slug: automate-writer-runtime-f3-integration-surface-and-dogfood-chec
title: Integration surface and dogfood checklist
goal: Full suite green; install path; operator dogfood checklist for 1+A+B
  without claiming Layer 4.
summary: Suite verde, superfície de pacote e checklist de dogfood 1+A+B.
status: pending
branch: plan/automate-writer-runtime
started: 2026-07-29T15:50:31.824Z
lastUpdated: 2026-07-29T15:50:31.824Z
nextAction: "Start T-009: Full test suite and package files sanity"
parentPlan: automate-writer-runtime
phaseId: F3
businessIntent:
  value: Full suite stays green and operators have a dogfood checklist for
    prepare→spawn→validate→merge→assert done without claiming Layer 4.
  workflow: Run full npm test, fix regressions, write dogfood checklist + memory
    reference, link from realism.
  rules: Do not bump major version. Do not claim dogfood already passed. Do not
    document Layer 4 as done.
  outOfScope: New features beyond 1+A+B. Installer rewrite.
  doneWhen: npm test exits 0 and docs/kb/automate-writer-runtime-dogfood.md exists.
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: G-F3-1
    description: Full npm test green and dogfood checklist published.
    status: pending
    verifier:
      kind: shell
      command: npm test && test -f docs/kb/automate-writer-runtime-dogfood.md
      expectExitCode: 0
stack: []
tasks:
  - id: T-009
    title: Full test suite and package files sanity
    status: pending
    lastUpdated: 2026-07-29T15:50:31.824Z
    summary: Full test suite and package files sanity
    weight: 2
    scopeBoundary:
      - Do not bump major version. Do not reintroduce gitignore mutation for
        .atomic-skills.
    acceptance:
      - npm test exits 0.
      - scripts/automate-phase-run.js exists under scripts/.
      - package.json files array still includes scripts/ and src/.
    verifier:
      kind: shell
      command: npm test
      expectExitCode: 0
    outputs:
      - kind: file
        path: package.json
      - kind: file
        path: scripts/automate-phase-run.js
      - kind: file
        path: src/automate-product-fence.js
      - kind: file
        path: skills/core/implement.md
  - id: T-010
    title: Dogfood checklist doc
    status: pending
    lastUpdated: 2026-07-29T15:50:31.824Z
    summary: Dogfood checklist doc
    weight: 2
    scopeBoundary:
      - Do not claim dogfood already passed. Do not document Layer 4 as done.
    acceptance:
      - checklist has ordered steps prepare spawn validate merge assert done.
      - checklist documents fail case for Mode-1 plan-tree product commit.
      - reference file exists for session recovery.
    verifier:
      kind: shell
      command: npm test && test -f docs/kb/automate-writer-runtime-dogfood.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: docs/kb/automate-writer-runtime-dogfood.md
      - kind: file
        path: docs/kb/automate-orchestrator-realism.md
      - kind: file
        path: .ai/memory/reference-automate-writer-runtime.md
parked: []
emerged: []
---

# Narrative / notes

Initiative for phase **F3 — Integration surface and dogfood checklist**.

Materialized from sidecar with ratified BI (operator: implement via subagent).
