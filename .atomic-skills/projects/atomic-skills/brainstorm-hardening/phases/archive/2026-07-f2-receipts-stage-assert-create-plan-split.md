---
schemaVersion: "0.1"
slug: brainstorm-hardening-f2-receipts-stage-assert-create-plan-split
title: Receipts, stage assert, create-plan split, Stage 4 wire
goal: design-gates + find-missing/weak-design + assert-creation-stage monotonic;
  split create-plan into thin router plus new-plan/stage-N.md; HARD-BLOCK Stage
  4 and brainstorm B5; exempt adopt ad-hoc single-task.
status: done
branch: plan/brainstorm-hardening
started: 2026-07-30T17:08:29.746Z
lastUpdated: 2026-07-30T17:32:34.025Z
nextAction: Operator clearContinue then F3 package
parentPlan: brainstorm-hardening
phaseId: F2
businessIntent:
  value: design-gates + detectors + assert-creation-stage enforce DESIGN fidelity;
    create-plan is thin router + stage-N; Stage 4 and brainstorm B5 HARD-BLOCK
    without receipts; adopt/ad-hoc/single-task exempt
  workflow: T-006 design/creation-gates helpers; T-007 detectors; T-008 wire Stage
    4 + B5; T-009 split create-plan into stage-N + assert stage advance
  rules: Exempt R-ORCH-03 adopt/ad-hoc/single-task; monotonic stage advance only
    via assert-creation-stage; no Stage 8 rewrite; detectors must fail on
    missing process
  outOfScope: F3 dogfood/pressure; F0/F1 product already done; web research;
    rewrite review-plan Stage 8 content beyond wire
  doneWhen: "G-F2-1..3 green: detector unit tests pass; Stage 4/B5 wire + stage-6
    + assert-creation-stage present; exempt lanes not false-positive"
tasksDone: 4
tasksTotal: 4
gatesMet: 3
gatesTotal: 3
weightDone: 4
weightTotal: 4
exitGates:
  - id: G-F2-1
    description: design-gates creation-gates detector and assert-creation-stage unit
      tests pass
    status: met
    verifier:
      kind: shell
      command: node --test tests/design-gates.test.js tests/creation-gates.test.js
        tests/find-missing-design-process.test.js tests/find-weak-design.test.js
        tests/assert-creation-stage.test.js
    metAt: 2026-07-30T17:32:34.025Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-30T17:32:34.025Z
      verifiedCommit: c5c3329d56adc250dd8650cbe2ac5d4a8842ecd1
      exitCode: 0
      passed: true
      outputSummary: G-F2-1 met
    verifierLabel: "shell: node --test tests/design-gates.test.js tests/creation-gates…"
    evidenceSummary: passed · 2026-07-30
  - id: G-F2-2
    description: Stage 4 and brainstorm HARD-BLOCK detectors; stage router and stage-6 exist
    status: met
    verifier:
      kind: shell
      command: rg -q 'find-missing-design-process'
        skills/shared/project-assets/project-create-plan.md && rg -q
        'find-weak-design' skills/shared/project-assets/project-create-plan.md
        && test -f skills/shared/project-assets/new-plan/stage-6.md && rg -q
        'assert-creation-stage'
        skills/shared/project-assets/project-create-plan.md
        skills/shared/project-assets/new-plan/stage-6.md && node --test
        tests/design-gates.test.js tests/find-missing-design-process.test.js
        tests/find-weak-design.test.js tests/assert-creation-stage.test.js
    metAt: 2026-07-30T17:32:34.025Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-30T17:32:34.025Z
      verifiedCommit: c5c3329d56adc250dd8650cbe2ac5d4a8842ecd1
      exitCode: 0
      passed: true
      outputSummary: G-F2-2 met
    verifierLabel: "shell: rg -q 'find-missing-design-process' skills/shared/project-a…"
    evidenceSummary: passed · 2026-07-30
  - id: G-F2-3
    description: detectors do not false-positive adopt/ad-hoc/single-task exempt lanes
    status: met
    verifier:
      kind: shell
      command: rg -q 'adopt|ad-hoc|adhoc|single-task|R-ORCH-03|exempt'
        tests/find-missing-design-process.test.js && node --test
        tests/find-missing-design-process.test.js
    metAt: 2026-07-30T17:32:34.025Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-30T17:32:34.025Z
      verifiedCommit: c5c3329d56adc250dd8650cbe2ac5d4a8842ecd1
      exitCode: 0
      passed: true
      outputSummary: G-F2-3 met
    verifierLabel: "shell: rg -q 'adopt|ad-hoc|adhoc|single-task|R-ORCH-03|exempt' tes…"
    evidenceSummary: passed · 2026-07-30
stack:
  - id: 1
    title: Receipts, stage assert, create-plan split, Stage 4 wire
    type: task
    openedAt: 2026-07-30T17:08:29.746Z
tasks:
  - id: T-006
    title: — design-gates and creation-gates helpers
    status: done
    lastUpdated: 2026-07-30T17:23:28.000Z
    scopeBoundary:
      - do not change find-weak-business-intent rules; do not write plan.md
        product state beyond helpers under status/
    acceptance:
      - design-gates create/update/read with schemaVersion 0.1 fields
        interviewAccepted debateGate researchDigest criticVerdict userApproved
        status; creation-gates supports monotonic stage field and ordered stages
        list; unit tests cover happy path missing fields and illegal stage skip
    verifier:
      kind: shell
      command: node --test tests/design-gates.test.js tests/creation-gates.test.js
    outputs:
      - kind: file
        path: scripts/design-gates.js
      - kind: file
        path: scripts/creation-gates.js
      - kind: file
        path: skills/shared/brainstorm-assets/process-receipt.md
      - kind: file
        path: tests/design-gates.test.js
      - kind: file
        path: tests/creation-gates.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-30T17:23:28.000Z
      verifiedCommit: e84fa3a0827dc4f7afee608b89d4708d6ab200f0
      exitCode: 0
      passed: true
      outputSummary: exit 0
  - id: T-007
    title: — Detectors find-missing-design-process find-weak-design
      assert-creation-stage
    status: done
    lastUpdated: 2026-07-30T17:23:28.000Z
    scopeBoundary:
      - do not false-fail adopt/ad-hoc paths; CLI takes explicit plan design or
        creation-gate path
    acceptance:
      - find-missing exits 1 when design process receipt missing or not ready;
        find-weak fails soft-language non-goals echo short interview weak
        digest; assert-creation-stage exits 1 on skip or declare ready early;
        negative tests for exempt lanes; all three test files green
    verifier:
      kind: shell
      command: node --test tests/find-missing-design-process.test.js
        tests/find-weak-design.test.js tests/assert-creation-stage.test.js
    outputs:
      - kind: file
        path: scripts/find-missing-design-process.js
      - kind: file
        path: scripts/find-weak-design.js
      - kind: file
        path: scripts/assert-creation-stage.js
      - kind: file
        path: tests/find-missing-design-process.test.js
      - kind: file
        path: tests/find-weak-design.test.js
      - kind: file
        path: tests/assert-creation-stage.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-30T17:23:28.000Z
      verifiedCommit: e84fa3a0827dc4f7afee608b89d4708d6ab200f0
      exitCode: 0
      passed: true
      outputSummary: exit 0
  - id: T-008
    title: — Wire Stage 4 and brainstorm B5 to detectors
    status: done
    lastUpdated: 2026-07-30T17:23:28.000Z
    scopeBoundary:
      - do not change Stage 8 receipt scripts; stage-N split may still be
        incomplete until T-009 but detector names must appear in the create-plan
        surface the router keeps
    acceptance:
      - Stage 4 runs lint-design then find-missing-design-process then
        find-weak-design before decompose; brainstorm B5 refuses handoff unless
        design-gates ready; HARD-BLOCK language present; tests assert script
        names
    verifier:
      kind: shell
      command: rg -q 'find-missing-design-process'
        skills/shared/project-assets/project-create-plan.md && rg -q
        'find-weak-design' skills/shared/project-assets/project-create-plan.md
        && rg -q 'HARD-BLOCK|find-missing-design-process'
        skills/shared/project-assets/project-create-plan.md && rg -q
        'design-gates|find-missing-design-process' skills/core/brainstorm.md &&
        node --test tests/project.test.js
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-create-plan.md
      - kind: file
        path: skills/core/brainstorm.md
      - kind: file
        path: tests/project.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-30T17:23:28.000Z
      verifiedCommit: e84fa3a0827dc4f7afee608b89d4708d6ab200f0
      exitCode: 0
      passed: true
      outputSummary: exit 0
  - id: T-009
    title: — Split create-plan into thin router plus stage-N.md and assert stage
      advance
    status: done
    lastUpdated: 2026-07-30T17:23:28.000Z
    scopeBoundary:
      - do not rewrite Stage 8 review-plan skill body; keep adopt path either as
        stage file or thin pointer without expanding adopt into novel behavior;
        do not add walls of Red Flags
    acceptance:
      - project-create-plan.md is a thin router that tells agent to read only
        new-plan/stage-N.md for current creation stage; each stage-1 through
        stage-9 file exists with a Contract section; stage-6 states BI
        draft-and-ratify; router or stage-6/9 invokes assert-creation-stage;
        create-plan file line count is materially smaller than pre-split
        monólito or router explicitly defers body to stage files; tests pin
        router loads stage path and assert-creation-stage name
    verifier:
      kind: shell
      command: test -f skills/shared/project-assets/new-plan/stage-1.md && test -f
        skills/shared/project-assets/new-plan/stage-6.md && test -f
        skills/shared/project-assets/new-plan/stage-9.md && rg -q
        'stage-6|new-plan/stage'
        skills/shared/project-assets/project-create-plan.md && rg -q
        'draft-and-ratify|Drafted|drafts the'
        skills/shared/project-assets/new-plan/stage-6.md && rg -q
        'assert-creation-stage'
        skills/shared/project-assets/project-create-plan.md
        skills/shared/project-assets/new-plan/stage-6.md
        skills/shared/project-assets/new-plan/stage-9.md && node --test
        tests/project.test.js tests/assert-creation-stage.test.js
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-create-plan.md
      - kind: file
        path: skills/shared/project-assets/new-plan/stage-1.md
      - kind: file
        path: skills/shared/project-assets/new-plan/stage-2.md
      - kind: file
        path: skills/shared/project-assets/new-plan/stage-3.md
      - kind: file
        path: skills/shared/project-assets/new-plan/stage-4.md
      - kind: file
        path: skills/shared/project-assets/new-plan/stage-5.md
      - kind: file
        path: skills/shared/project-assets/new-plan/stage-6.md
      - kind: file
        path: skills/shared/project-assets/new-plan/stage-7.md
      - kind: file
        path: skills/shared/project-assets/new-plan/stage-8.md
      - kind: file
        path: skills/shared/project-assets/new-plan/stage-9.md
      - kind: file
        path: tests/project.test.js
      - kind: file
        path: tests/assert-creation-stage.test.js
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-30T17:23:28.000Z
      verifiedCommit: e84fa3a0827dc4f7afee608b89d4708d6ab200f0
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

Initiative for phase **F2 — Receipts, stage assert, create-plan split, Stage 4 wire**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_


## phase-done CROSS-MODEL REVIEW both @ c5c3329d56ad
