---
schemaVersion: "0.1"
slug: brainstorm-hardening-f3-dogfood-pressure-tests-announce
title: Dogfood, pressure tests, announce
goal: Pressure-test skip escapes and more-text-worse; dogfood checklist includes
  stage router and draft-and-ratify; onboarding Stage 2 text updated.
status: active
branch: plan/brainstorm-hardening
started: 2026-07-30T17:33:08.095Z
lastUpdated: 2026-07-30T17:36:07.000Z
nextAction: Run phase-done after evaluation/review/decision-review
parentPlan: brainstorm-hardening
phaseId: F3
businessIntent:
  value: Pressure-tests and dogfood checklist lock fidelity gates; onboarding
    mentions always interview/debate and stage process
  workflow: T-010 pressure-tests.md scenarios; T-011 dogfood-checklist + onboarding note
  rules: Additive scenarios only; no full Inc3 re-run; no Stage 8 behavior
    rewrite; no full onboarding HTML rewrite
  outOfScope: Implementing new product detectors beyond F2; rewriting review-plan
  doneWhen: "G-F3-1: pressure-tests and dogfood checklist exist and reference new
    gates including assert-creation-stage"
tasksDone: 2
tasksTotal: 2
gatesMet: 0
gatesTotal: 1
weightDone: 2
weightTotal: 2
exitGates:
  - id: G-F3-1
    description: pressure-tests and dogfood checklist exist and reference new gates
      including assert-creation-stage
    status: pending
    verifier:
      kind: shell
      command: test -f
        projects/atomic-skills/brainstorm-hardening/dogfood-checklist.md && test
        -f projects/atomic-skills/brainstorm-hardening/pressure-tests.md && rg
        -q
        'find-missing-design-process|design-gates|assert-creation-stage|Interview|debate'
        projects/atomic-skills/brainstorm-hardening/dogfood-checklist.md && rg
        -q 'skip interview|skip debate|assert-creation-stage|digest'
        projects/atomic-skills/brainstorm-hardening/pressure-tests.md
    verifierLabel: "shell: test -f projects/atomic-skills/brainstorm-hardening/dogfood…"
stack:
  - id: 1
    title: Dogfood, pressure tests, announce
    type: task
    openedAt: 2026-07-30T17:33:08.095Z
tasks:
  - id: T-010
    title: — Pressure-test red-flags for skip paths and fidelity escapes
    status: done
    lastUpdated: 2026-07-30T17:36:07.000Z
    scopeBoundary:
      - do not re-run full Inc3 suite; additive scenarios only for this plan
    acceptance:
      - documents at least 5 scenarios including skip interview under time
        pressure, skip debate because obvious, empty research digest theater,
        skip creation stage without assert, more text in monólito increases
        ignore; each maps to a Red-Flag or detector or assert-creation-stage
        fail
    verifier:
      kind: shell
      command: test -f projects/atomic-skills/brainstorm-hardening/pressure-tests.md
        && rg -q 'skip interview|skip debate|empty
        digest|assert-creation-stage|monolito|ignore'
        projects/atomic-skills/brainstorm-hardening/pressure-tests.md
    outputs:
      - kind: file
        path: projects/atomic-skills/brainstorm-hardening/pressure-tests.md
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-30T17:36:07.000Z
      verifiedCommit: 69ad613760e2e2358f8d001b620342999c95e65b
      exitCode: 0
      passed: true
      outputSummary: exit 0
  - id: T-011
    title: — Dogfood checklist and onboarding note
    status: done
    lastUpdated: 2026-07-30T17:36:07.000Z
    scopeBoundary:
      - do not rewrite entire onboarding HTML; only new plan / brainstorm stage
        description; no Stage 8 behavior changes
    acceptance:
      - dogfood-checklist lists interview research-digest debate critic lint
        design-gates assert-creation-stage stage-N router draft-and-ratify Stage
        4; onboarding brief mentions interview always debate and thin stage
        process
    verifier:
      kind: shell
      command: test -f
        projects/atomic-skills/brainstorm-hardening/dogfood-checklist.md && rg
        -q 'assert-creation-stage|draft-and-ratify|stage-'
        projects/atomic-skills/brainstorm-hardening/dogfood-checklist.md && rg
        -q 'entrevista|debate|Interview|always|estágio|stage'
        docs/design/project-onboarding/html-design-brief.md
    outputs:
      - kind: file
        path: docs/design/project-onboarding/html-design-brief.md
      - kind: file
        path: projects/atomic-skills/brainstorm-hardening/dogfood-checklist.md
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-30T17:36:07.000Z
      verifiedCommit: 69ad613760e2e2358f8d001b620342999c95e65b
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

Initiative for phase **F3 — Dogfood, pressure tests, announce**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
