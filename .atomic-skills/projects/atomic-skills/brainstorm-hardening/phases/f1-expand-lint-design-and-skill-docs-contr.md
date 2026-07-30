---
schemaVersion: "0.1"
slug: brainstorm-hardening-f1-expand-lint-design-and-skill-docs-contr
title: Expand lint-design and skill docs contract
goal: lint-design always requires Context, Non-goals, and Interview sections
  with real content; tests lock the contract.
status: active
branch: plan/brainstorm-hardening
started: 2026-07-30T16:45:56.444Z
lastUpdated: 2026-07-30T16:50:40.000Z
nextAction: Run phase-done (after evaluation + lessons + review + decision-review)
parentPlan: brainstorm-hardening
phaseId: F1
businessIntent:
  value: lint-design always rejects designs missing Context, Non-goals, or
    Interview with real content; tests lock the contract
  workflow: T-004 expand REQUIRED in lint-design.js + tests; T-005 fixture
    coverage and docs/skills/brainstorm.md for new sections
  rules: No design-gates or creation-stage logic; no lint-source SPEC change; no
    mass-edit of historical projects/*/design.md; Decisions and Chosen approach
    remain; Blast radius stays migration-only
  outOfScope: F2 design-gates scripts, assert-creation-stage, stage-N split, Stage
    8 review-plan rewrite
  doneWhen: "G-F1-1 green: lint-design rejects a design missing Interview or
    Non-goals or Context; tests cover missing sections"
tasksDone: 2
tasksTotal: 2
gatesMet: 0
gatesTotal: 1
weightDone: 2
weightTotal: 2
exitGates:
  - id: G-F1-1
    description: lint-design rejects a design missing Interview or Non-goals or Context
    status: pending
    verifier:
      kind: test
      runner: node
      pattern: tests/lint-design.test.js
    verifierLabel: "test: node tests/lint-design.test.js"
stack:
  - id: 1
    title: Expand lint-design and skill docs contract
    type: task
    openedAt: 2026-07-30T16:45:56.444Z
tasks:
  - id: T-004
    title: — Expand lint-design REQUIRED sections
    status: done
    lastUpdated: 2026-07-30T16:50:40.000Z
    scopeBoundary:
      - do not add design-gates or creation-stage logic here; do not change
        lint-source.js SPEC gate
    acceptance:
      - REQUIRED always includes Context Non-goals Interview; Decisions and
        Chosen approach remain; Blast radius stays migration-only; empty bodies
        fail; tests cover missing Interview Non-goals Context
    verifier:
      kind: shell
      command: node --test tests/lint-design.test.js
    outputs:
      - kind: file
        path: scripts/lint-design.js
      - kind: file
        path: tests/lint-design.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-30T16:50:40.000Z
      verifiedCommit: d1b21407b4bb29cf77dc6014c8b8bf52ff8070d6
      exitCode: 0
      passed: true
      outputSummary: |2
         lintDesignMd — heading detection edge cases (0.976333ms)
        ▶ lintDesignMd — guards
          ✔ empty string → violations (not a crash) (0.054583ms)
          ✔ non-string input → single violation (0.147792ms)
          ✔ parseSections is exported and returns normalized titles (0.039459ms)
        ✔ lintDesignMd — guards (0.337ms)
        ℹ tests 26
        ℹ suites 5
        ℹ pass 26
        ℹ fail 0
        ℹ cancelled 0
        ℹ skipped 0
        ℹ todo 0
        ℹ duration_ms 121.754917
  - id: T-005
    title: — Fixture coverage and docs for new lint sections
    status: done
    lastUpdated: 2026-07-30T16:50:40.000Z
    scopeBoundary:
      - do not mass-edit historical projects/*/design.md files
    acceptance:
      - tests mention Interview Non-goals Context; docs/skills/brainstorm.md
        documents new lint-required sections
    verifier:
      kind: shell
      command: rg -q 'Interview|Non-goals|Context' tests/lint-design.test.js && rg -q
        'lint-design|Non-goals|Interview' docs/skills/brainstorm.md
    outputs:
      - kind: file
        path: tests/lint-design.test.js
      - kind: file
        path: docs/skills/brainstorm.md
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-30T16:50:40.000Z
      verifiedCommit: d1b21407b4bb29cf77dc6014c8b8bf52ff8070d6
      exitCode: 0
      passed: true
      outputSummary: exit 0
parked: []
emerged: []
planTitle: Brainstorm hardening — process package for DESIGN front-half
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F1 — Expand lint-design and skill docs contract**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
