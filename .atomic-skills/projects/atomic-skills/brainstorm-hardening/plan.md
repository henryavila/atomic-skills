---
schemaVersion: "0.1"
slug: brainstorm-hardening
title: Brainstorm hardening — process package for DESIGN front-half
version: "1.0"
status: active
started: 2026-07-30T13:42:45.458Z
lastUpdated: 2026-07-30T17:32:34.025Z
branch: plan/brainstorm-hardening
currentPhase: F3
executionMode: automate
parallelismAllowed: false
principles:
  - id: P1
    title: Process over soft prose
    body: gate sem script/exit code não é gate.
  - id: P2
    title: One canonical design surface
    body: interview content lives in `design.md`; templates are lazy assets only.
  - id: P3
    title: Debate is actor, never judge
    body: critic + user decide; anti-theater requires dissent or rejected
      alternatives.
  - id: P4
    title: Exempt lanes stay exempt
    body: ad-hoc / single-task / `adopt` skip DESIGN (R-ORCH-03); enforcers must not
      false-positive them.
  - id: P5
    title: No Stage 8 rewrite
    body: plan review remains `review-plan`; this plan only hardens DESIGN.
  - id: P6
    title: Fidelity via stage files + exit codes
    body: less hot-path text, more assert scripts; more skill prose increases ignore
      rate.
glossary:
  - term: multi-phase DESIGN
    definition: Full brainstorm path used by `project new plan` (not ad-hoc / adopt)
  - term: design-gates receipt
    definition: JSON under `.atomic-skills/status/design-gates/<projectId>-<slug>.json`
  - term: research-digest
    definition: "`projects/<id>/<slug>/research-digest.md` with enough
      non-placeholder bullets and at least one repo path"
  - term: anti-theater
    definition: Contrarian + dissent or rejected alternatives when two or more approaches
  - term: draft-and-ratify
    definition: Agent drafts businessIntent spine; user approves or edits via
      AskUserQuestion
  - term: creation stage
    definition: Monotonic `stage` field on creation-gates JSON; advanced only by
      assert-creation-stage
  - term: stage file
    definition: "`skills/shared/project-assets/new-plan/stage-N.md` loaded only for
      the current stage"
phases:
  - id: F0
    slug: brainstorm-hardening-f0-skill-rewrite-bi-contract-lazy-assets
    title: Skill rewrite, BI contract, lazy assets
    summary: Brainstorm always + assets + BI draft-and-ratify no create-plan
    goal: Multi-phase brainstorm always runs interview then repo research digest
      then debate --gate then user ratify then write then critic; kill skip
      ladder; thin brainstorm body plus brainstorm-assets; create-plan Stage 2
      matches; businessIntent is draft-and-ratify not blank prompt.
    dependsOn: []
    subPhaseCount: 3
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-F0-1
          description: brainstorm.md has no skip-ladder; interview research debate always;
            brainstorm-assets exist
          status: met
          verifier:
            kind: shell
            command: "! rg -q 'Run a panel ONLY when|skip the panel|skip straight to B2|skip
              straight to B3' skills/core/brainstorm.md && rg -q 'debate --gate'
              skills/core/brainstorm.md && rg -q 'Interview|entrevista'
              skills/core/brainstorm.md && rg -q 'research-digest|B0b'
              skills/core/brainstorm.md && test -d
              skills/shared/brainstorm-assets && test -f
              skills/shared/brainstorm-assets/interview.md"
          metAt: 2026-07-30T16:42:40.000Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-30T16:42:40.000Z
            verifiedCommit: 0f996601001ef281d954f8552ba8e24bde1dea77
            exitCode: 0
            passed: true
            outputSummary: G-F0-1 exit 0 at phase-done
        - id: G-F0-2
          description: create-plan Stage 2 always-debate; BI draft-and-ratify; project
            tests green
          status: met
          verifier:
            kind: shell
            command: "! rg -q 'only when ≥2 viable approaches AND|must not pre-fill the five
              fields' skills/shared/project-assets/project-create-plan.md && rg
              -q 'debate --gate|Interview|interview'
              skills/shared/project-assets/project-create-plan.md && rg -q
              'draft-and-ratify|Drafted|drafts the'
              skills/shared/project-assets/project-create-plan.md && node --test
              tests/project.test.js"
          metAt: 2026-07-30T16:42:40.000Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-30T16:42:40.000Z
            verifiedCommit: 0f996601001ef281d954f8552ba8e24bde1dea77
            exitCode: 0
            passed: true
            outputSummary: G-F0-2 exit 0 at phase-done
    status: done
    businessIntent:
      value: Operador e agente nao pulam entrevista/debate; new plan vira stage files
        + exit codes; BI draft-and-ratify
      workflow: T-001 assets; T-002 brainstorm rewrite; T-003 Stage2 + BI
        draft-and-ratify
      rules: Sem always-debate em adopt/ad-hoc; skill thin; detectors e stage split em
        F2; sem engordar Red Flags
      outOfScope: "Fora desta fase: lint-design expand, design-gates scripts,
        assert-creation-stage, stage-N split completo, Stage 8, web research"
      doneWhen: "G-F0-1 e G-F0-2 verdes: brainstorm always interview/research/debate;
        create-plan sem must not pre-fill; draft-and-ratify presente"
    evaluationGate:
      status: passed
      verdict: pass
      reportPath: .atomic-skills/reviews/eval-brainstorm-hardening-F0.md
      verifiedAt: 2026-07-30T16:00:52.437Z
      at: e591f7595975652372c5a0347c91fa96f14d3315
    lessonsState: none
    reviewGate:
      status: passed
      mode: both
      at: ab41c2ec6e39bdc429572670a4a4e132590311cd
      verifiedAt: 2026-07-30T16:14:22.243Z
      reviewFile: .atomic-skills/reviews/2026-07-30-both-brainstorm-hardening-F0.md
      localReceiptPath: .atomic-skills/reviews/2026-07-30-local-brainstorm-hardening-F0.md
      codexReceiptPath: .atomic-skills/reviews/2026-07-30-codex-brainstorm-hardening-F0.md
    decisionReview:
      status: passed
      verifiedAt: 2026-07-30T16:40:44.000Z
      packagePresentedAt: 2026-07-30T16:40:44.000Z
      packagePath: .atomic-skills/reviews/decision-package-brainstorm-hardening-F0.md
  - id: F1
    slug: brainstorm-hardening-f1-expand-lint-design-and-skill-docs-contr
    title: Expand lint-design and skill docs contract
    summary: lint-design exige Interview, Context e Non-goals
    goal: lint-design always requires Context, Non-goals, and Interview sections
      with real content; tests lock the contract.
    dependsOn:
      - F0
    subPhaseCount: 2
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-F1-1
          description: lint-design rejects a design missing Interview or Non-goals or
            Context
          status: met
          verifier:
            kind: test
            runner: node
            pattern: tests/lint-design.test.js
          metAt: 2026-07-30T17:06:17.919Z
          evidence:
            verifierKind: test
            verifiedAt: 2026-07-30T17:06:17.919Z
            verifiedCommit: 89fd6384e4d2347fb36e54302eb0e24d5d99eb31
            exitCode: 0
            testsCollected: 26
            passed: true
            outputSummary: G-F1-1 26 pass
    status: done
    businessIntent:
      value: lint-design always rejects designs missing Context, Non-goals, or
        Interview with real content; tests lock the contract
      workflow: T-004 expand REQUIRED in lint-design.js + tests; T-005 fixture
        coverage and docs/skills/brainstorm.md for new sections
      rules: No design-gates or creation-stage logic; no lint-source SPEC change; no
        mass-edit of historical projects/*/design.md; Decisions and Chosen
        approach remain; Blast radius stays migration-only
      outOfScope: F2 design-gates scripts, assert-creation-stage, stage-N split, Stage
        8 review-plan rewrite
      doneWhen: "G-F1-1 green: lint-design rejects a design missing Interview or
        Non-goals or Context; tests cover missing sections"
    evaluationGate:
      status: passed
      verdict: pass
      reportPath: .atomic-skills/reviews/eval-brainstorm-hardening-F1.md
      verifiedAt: 2026-07-30T16:53:08.003Z
      at: 090b5d7fac54811950dda0f2eaee60ed5f12d008
    lessonsState: none
    reviewGate:
      status: passed
      mode: both
      at: 090b5d7fac54811950dda0f2eaee60ed5f12d008
      verifiedAt: 2026-07-30T16:59:34.872Z
      reviewFile: .atomic-skills/reviews/2026-07-30-both-brainstorm-hardening-F1.md
      localReceiptPath: .atomic-skills/reviews/2026-07-30-local-brainstorm-hardening-F1.md
      codexReceiptPath: .atomic-skills/reviews/2026-07-30-codex-brainstorm-hardening-F1.md
    decisionReview:
      status: passed
      verifiedAt: 2026-07-30T17:06:17.000Z
      packagePresentedAt: 2026-07-30T17:06:17.000Z
      packagePath: .atomic-skills/reviews/decision-package-brainstorm-hardening-F1.md
  - id: F2
    slug: brainstorm-hardening-f2-receipts-stage-assert-create-plan-split
    title: Receipts, stage assert, create-plan split, Stage 4 wire
    summary: Receipts, assert-creation-stage, stage-N split, wire Stage 4
    goal: design-gates + find-missing/weak-design + assert-creation-stage monotonic;
      split create-plan into thin router plus new-plan/stage-N.md; HARD-BLOCK
      Stage 4 and brainstorm B5; exempt adopt ad-hoc single-task.
    dependsOn:
      - F1
    subPhaseCount: 4
    exitGate:
      summary: 3 criteria to meet
      criteria:
        - id: G-F2-1
          description: design-gates creation-gates detector and assert-creation-stage unit
            tests pass
          status: met
          verifier:
            kind: shell
            command: node --test tests/design-gates.test.js tests/creation-gates.test.js
              tests/find-missing-design-process.test.js
              tests/find-weak-design.test.js tests/assert-creation-stage.test.js
          metAt: 2026-07-30T17:32:34.025Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-30T17:32:34.025Z
            verifiedCommit: c5c3329d56adc250dd8650cbe2ac5d4a8842ecd1
            exitCode: 0
            passed: true
            outputSummary: G-F2-1 met
        - id: G-F2-2
          description: Stage 4 and brainstorm HARD-BLOCK detectors; stage router and
            stage-6 exist
          status: met
          verifier:
            kind: shell
            command: rg -q 'find-missing-design-process'
              skills/shared/project-assets/project-create-plan.md && rg -q
              'find-weak-design'
              skills/shared/project-assets/project-create-plan.md && test -f
              skills/shared/project-assets/new-plan/stage-6.md && rg -q
              'assert-creation-stage'
              skills/shared/project-assets/project-create-plan.md
              skills/shared/project-assets/new-plan/stage-6.md && node --test
              tests/design-gates.test.js
              tests/find-missing-design-process.test.js
              tests/find-weak-design.test.js tests/assert-creation-stage.test.js
          metAt: 2026-07-30T17:32:34.025Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-30T17:32:34.025Z
            verifiedCommit: c5c3329d56adc250dd8650cbe2ac5d4a8842ecd1
            exitCode: 0
            passed: true
            outputSummary: G-F2-2 met
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
    status: done
    businessIntent:
      value: design-gates + detectors + assert-creation-stage enforce DESIGN fidelity;
        create-plan is thin router + stage-N; Stage 4 and brainstorm B5
        HARD-BLOCK without receipts; adopt/ad-hoc/single-task exempt
      workflow: T-006 design/creation-gates helpers; T-007 detectors; T-008 wire Stage
        4 + B5; T-009 split create-plan into stage-N + assert stage advance
      rules: Exempt R-ORCH-03 adopt/ad-hoc/single-task; monotonic stage advance only
        via assert-creation-stage; no Stage 8 rewrite; detectors must fail on
        missing process
      outOfScope: F3 dogfood/pressure; F0/F1 product already done; web research;
        rewrite review-plan Stage 8 content beyond wire
      doneWhen: "G-F2-1..3 green: detector unit tests pass; Stage 4/B5 wire + stage-6
        + assert-creation-stage present; exempt lanes not false-positive"
    evaluationGate:
      status: passed
      verdict: pass
      reportPath: .atomic-skills/reviews/eval-brainstorm-hardening-F2.md
      verifiedAt: 2026-07-30T17:30:24.078Z
      at: eec9c3cd631a3a87dc43677df18e2c5b939193d6
    lessonsState: none
    reviewGate:
      status: passed
      mode: both
      at: eec9c3cd631a3a87dc43677df18e2c5b939193d6
      verifiedAt: 2026-07-30T17:30:24.082Z
      reviewFile: .atomic-skills/reviews/2026-07-30-both-brainstorm-hardening-F2.md
      localReceiptPath: .atomic-skills/reviews/2026-07-30-local-brainstorm-hardening-F2.md
      codexReceiptPath: .atomic-skills/reviews/2026-07-30-codex-brainstorm-hardening-F2.md
    decisionReview:
      status: passed
      verifiedAt: 2026-07-30T17:32:33.000Z
      packagePresentedAt: 2026-07-30T17:32:33.000Z
      packagePath: .atomic-skills/reviews/decision-package-brainstorm-hardening-F2.md
  - id: F3
    slug: brainstorm-hardening-f3-dogfood-pressure-tests-announce
    title: Dogfood, pressure tests, announce
    summary: Pressure-tests de fidelidade + dogfood + onboarding
    goal: Pressure-test skip escapes and more-text-worse; dogfood checklist includes
      stage router and draft-and-ratify; onboarding Stage 2 text updated.
    dependsOn:
      - F2
    subPhaseCount: 0
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-F3-1
          description: pressure-tests and dogfood checklist exist and reference new gates
            including assert-creation-stage
          status: pending
          verifier:
            kind: shell
            command: test -f
              projects/atomic-skills/brainstorm-hardening/dogfood-checklist.md
              && test -f
              projects/atomic-skills/brainstorm-hardening/pressure-tests.md &&
              rg -q
              'find-missing-design-process|design-gates|assert-creation-stage|Interview|debate'
              projects/atomic-skills/brainstorm-hardening/dogfood-checklist.md
              && rg -q 'skip interview|skip debate|assert-creation-stage|digest'
              projects/atomic-skills/brainstorm-hardening/pressure-tests.md
    status: pending
references: []
planActive: true
planTitle: Brainstorm hardening — process package for DESIGN front-half
---

# Brainstorm hardening — process package for DESIGN front-half

## 1. Context

Endurece brainstorm + fidelidade de new plan: interview, research, debate always, enforcers, BI draft-and-ratify, router fino + stage-N, assert-creation-stage. Design: `projects/atomic-skills/brainstorm-hardening/design.md`.

## 2. Inviolable principles

See frontmatter `principles:`.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`.)_


## Amendment — fidelity package (2026-07-30)

Incorporated after plan materialization: **BI draft-and-ratify** (Decision 9); **thin router + stage-N.md** (Decision 10); **creation-gates.stage + assert-creation-stage** (Decision 11); **P6 fidelity via exit codes not more prose** (Decision 12). Source tasks T-003 expanded, T-006–T-009, T-010–T-011. Design.md Decisions 9–12.

## Self-review against code-quality gates

- **G1 read-before-claim**: N/A for claims about code-to-write — plan describes process changes not yet implemented; design.md cites existing brainstorm skip ladder and lint-design REQUIRED.
- **G2 soft-language**: scanned plan narrative/principles; 0 ban-list hedges in task titles/goals.
- **G6 reference-or-strike**: process claims point at design.md and named scripts to be created; unverified runtime behavior deferred to implementation verifiers.
- **G10 gate-must-be-able-to-fail**: exit gates use shell/test verifiers (rg absence, test files, path existence) — each has a concrete FAIL mode.

## Reviews
- cross-model (codex): needs_changes→applied | provider=codex | provider_version=codex-cli-0.146.0 | major=4 minor=1 | file=.atomic-skills/reviews/2026-07-30-codex-brainstorm-hardening.md @ uncommitted (2026-07-30T13:54:39Z)
- ground-truth: complete | mode=ground-truth | fp=8928a1927bbf | premises=5 | impacts=3 @ uncommitted (2026-07-30T17:10:00Z)
- internal: clean | mode=local | major=0 @ uncommitted (2026-07-30T13:44:22Z)


## Ground-truth review

**Status:** complete
**Codebase class:** populated
**Scanned:** skills/core/brainstorm.md, skills/shared/project-assets/project-create-plan.md, scripts/lint-design.js, tests/lint-design.test.js, tests/project.test.js, docs/skills/brainstorm.md; F0 delivered (assets+always-debate+draft-and-ratify); F1 materializing lint-design REQUIRED expand; F2 detectors still plan outputs not premises
**Commit:** cc60fd46 (plus uncommitted stamp/receipt refresh)
**At:** 2026-07-30T15:43:43Z

### A — Plan premises vs code
| Premise | Result | Evidence |
|---------|--------|----------|
| brainstorm.md exists as DESIGN skill | ok | skills/core/brainstorm.md present |
| lint-design.js REQUIRED is extendable | ok | scripts/lint-design.js + tests/lint-design.test.js present |
| project-create-plan Stage 2 owns DESIGN invoke | ok | skills/shared/project-assets/project-create-plan.md present |
| brainstorm-assets/ does not exist yet | ok | directory absent (to be created in T-001) |
| New detector scripts do not exist yet | ok | not premises — plan outputs |

### B — Code present, plan silent
| Area | Disposition |
|------|-------------|
| Stage 8 review-plan / find-unreviewed-plans | oos — explicit Non-goal |
| find-weak-business-intent pattern | accepted — mirrored by F2 detectors, not rewritten |
| debate gate-mode asset | oos — reused as-is; no contract change in this plan |

**Counts:** premises=5 ok; impacts disposed=3 (oos/accepted)
