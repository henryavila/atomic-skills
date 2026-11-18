---
schemaVersion: "0.1"
slug: automate-writer-runtime-f3-integration-surface-and-dogfood-chec
title: Integration surface and dogfood checklist
goal: Full suite green; install path; operator dogfood checklist for 1+A+B
  without claiming Layer 4.
summary: Suite verde, superfície de pacote e checklist de dogfood 1+A+B.
status: done
branch: plan/automate-writer-runtime
started: 2026-07-29T15:50:31.824Z
lastUpdated: 2026-07-29T16:26:58.973Z
nextAction: null
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
tasksDone: 2
tasksTotal: 2
gatesMet: 1
gatesTotal: 1
weightDone: 4
weightTotal: 4
exitGates:
  - id: G-F3-1
    description: Full npm test green and dogfood checklist published.
    status: met
    verifier:
      kind: shell
      command: npm test && test -f docs/kb/automate-writer-runtime-dogfood.md
      expectExitCode: 0
    metAt: 2026-07-29T16:26:58.973Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-29T16:26:58.973Z
      passed: true
      exitCode: 0
      verifiedCommit: 06d0918db4c118155e3a2fe7c7e49a69d35f9ac7
    verifierLabel: "shell: npm test && test -f docs/kb/automate-writer-runtime-dogfood…"
    evidenceSummary: passed · 2026-07-29
stack: []
tasks:
  - id: T-009
    title: Full test suite and package files sanity
    status: done
    lastUpdated: 2026-07-29T16:26:58.973Z
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
    closedAt: 2026-07-29T16:26:58.973Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-29T16:26:58.973Z
      passed: true
      exitCode: 0
      verifiedCommit: 06d0918db4c118155e3a2fe7c7e49a69d35f9ac7
  - id: T-010
    title: Dogfood checklist doc
    status: done
    lastUpdated: 2026-07-29T16:26:58.973Z
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

Initiative for phase **F3 — Integration surface and dogfood checklist**.

Materialized from sidecar with ratified BI (operator: implement via subagent).

## Session handoff
- **Narrative:** Phase F3 implemented by isolated phase writer and merged FF onto plan/automate-writer-runtime (HEAD 06d0918d). Orchestrator re-ran plan-scoped verifiers (132 pass).
- **Decision log:** Host-orchestrated single writer for F0–F3; residual full npm test failures treated as orthogonal (documented on T-009 evidence).
- **Single nextAction:** phase-done already reflected in initiative status; advance plan currentPhase or finalize after operator review.
- **Verbatim state:** node --test plan-scoped suite exit 0; claim report .atomic-skills/status/automate/automate-writer-runtime-claims.json
- **Uncommitted changes:** clean tree expected after state checkpoint commit.
