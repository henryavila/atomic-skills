---
schemaVersion: "0.1"
slug: brainstorm-hardening-f0-skill-rewrite-bi-contract-lazy-assets
title: Skill rewrite, BI contract, lazy assets
goal: Multi-phase brainstorm always runs interview then repo research digest
  then debate --gate then user ratify then write then critic; kill skip ladder;
  thin brainstorm body plus brainstorm-assets; create-plan Stage 2 matches;
  businessIntent is draft-and-ratify not blank prompt.
status: active
branch: plan/brainstorm-hardening
started: 2026-07-30T14:14:45.028Z
lastUpdated: 2026-07-30T15:55:50.000Z
nextAction: Run phase-done (after evaluation + lessons + review + decision-review)
parentPlan: brainstorm-hardening
phaseId: F0
businessIntent:
  value: Operador e agente nao pulam entrevista/debate; new plan vira stage files
    + exit codes; BI draft-and-ratify
  workflow: T-001 assets; T-002 brainstorm rewrite; T-003 Stage2 + BI draft-and-ratify
  rules: Sem always-debate em adopt/ad-hoc; skill thin; detectors e stage split em
    F2; sem engordar Red Flags
  outOfScope: "Fora desta fase: lint-design expand, design-gates scripts,
    assert-creation-stage, stage-N split completo, Stage 8, web research"
  doneWhen: "G-F0-1 e G-F0-2 verdes: brainstorm always interview/research/debate;
    create-plan sem must not pre-fill; draft-and-ratify presente"
tasksDone: 3
tasksTotal: 3
gatesMet: 0
gatesTotal: 2
weightDone: 3
weightTotal: 3
exitGates:
  - id: G-F0-1
    description: brainstorm.md has no skip-ladder; interview research debate always;
      brainstorm-assets exist
    status: pending
    verifier:
      kind: shell
      command: "! rg -q 'Run a panel ONLY when|skip the panel|skip straight to B2|skip
        straight to B3' skills/core/brainstorm.md && rg -q 'debate --gate'
        skills/core/brainstorm.md && rg -q 'Interview|entrevista'
        skills/core/brainstorm.md && rg -q 'research-digest|B0b'
        skills/core/brainstorm.md && test -d skills/shared/brainstorm-assets &&
        test -f skills/shared/brainstorm-assets/interview.md"
    verifierLabel: "shell: ! rg -q 'Run a panel ONLY when|skip the panel|skip straight…"
  - id: G-F0-2
    description: create-plan Stage 2 always-debate; BI draft-and-ratify; project tests green
    status: pending
    verifier:
      kind: shell
      command: "! rg -q 'only when ≥2 viable approaches AND|must not pre-fill the five
        fields' skills/shared/project-assets/project-create-plan.md && rg -q
        'debate --gate|Interview|interview'
        skills/shared/project-assets/project-create-plan.md && rg -q
        'draft-and-ratify|Drafted|drafts the'
        skills/shared/project-assets/project-create-plan.md && node --test
        tests/project.test.js"
    verifierLabel: "shell: ! rg -q 'only when ≥2 viable approaches AND|must not pre-fi…"
stack:
  - id: 1
    title: Skill rewrite, BI contract, lazy assets
    type: task
    openedAt: 2026-07-30T14:14:45.028Z
tasks:
  - id: T-001
    title: — Author brainstorm-assets lazy pack
    status: done
    lastUpdated: 2026-07-30T15:55:50.000Z
    scopeBoundary:
      - do not rewrite skills/core/brainstorm.md process body in this task; do
        not touch review-plan or debate gate-mode beyond cross-links
    acceptance:
      - interview.md has HALT questions and bans bare ok/yes without spine;
        research.md names research-digest.md and weak-digest bars;
        process-receipt.md names interviewAccepted and design-gates path
    verifier:
      kind: shell
      command: test -f skills/shared/brainstorm-assets/interview.md && test -f
        skills/shared/brainstorm-assets/research.md && test -f
        skills/shared/brainstorm-assets/process-receipt.md && rg -q
        'proof-of-work|Interview|entrevista'
        skills/shared/brainstorm-assets/interview.md && rg -q 'research-digest'
        skills/shared/brainstorm-assets/research.md && rg -q 'interviewAccepted'
        skills/shared/brainstorm-assets/process-receipt.md
    outputs:
      - kind: file
        path: skills/shared/brainstorm-assets/interview.md
      - kind: file
        path: skills/shared/brainstorm-assets/research.md
      - kind: file
        path: skills/shared/brainstorm-assets/process-receipt.md
    closedAt: 2026-07-30T15:55:50.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-30T15:55:50.000Z
      verifiedCommit: 62c43f8e55044acb06f34bd935240c077f03f915
      exitCode: 0
      passed: true
      outputSummary: exit 0
  - id: T-002
    title: — Rewrite brainstorm.md process (always interview + research + debate)
    status: done
    lastUpdated: 2026-07-30T15:55:50.000Z
    scopeBoundary:
      - do not implement find-missing-design-process.js or
        assert-creation-stage.js here; do not change Stage 8 review-plan; do not
        force debate on adopt or ad-hoc
    acceptance:
      - B0 Interview HARD before research/debate; B0b research-digest required;
        B1 always debate --gate; skip-ladder phrases gone; red-flags cover
        skip-interview and empty digest; docs/skills/brainstorm.md summarizes
        new flow; body stays thin and points at brainstorm-assets
    verifier:
      kind: shell
      command: rg -q 'Interview|entrevista|B0' skills/core/brainstorm.md && rg -q
        'debate --gate|debate.*--gate' skills/core/brainstorm.md && ! rg -q 'Run
        a panel ONLY when' skills/core/brainstorm.md && rg -q
        'research-digest|B0b' skills/core/brainstorm.md && rg -q
        'brainstorm-assets' skills/core/brainstorm.md && rg -q
        'Interview|debate|lint-design' docs/skills/brainstorm.md
    outputs:
      - kind: file
        path: skills/core/brainstorm.md
      - kind: file
        path: docs/skills/brainstorm.md
    closedAt: 2026-07-30T15:55:50.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-30T15:55:50.000Z
      verifiedCommit: 62c43f8e55044acb06f34bd935240c077f03f915
      exitCode: 0
      passed: true
      outputSummary: exit 0
  - id: T-003
    title: — Stage 2 brainstorm contract + businessIntent draft-and-ratify
    status: done
    lastUpdated: 2026-07-30T15:55:50.000Z
    scopeBoundary:
      - do not split create-plan into stage-N files in this task (F2 T-009); do
        not implement assert-creation-stage.js here
    acceptance:
      - Stage 2 describes interview plus research plus always debate --gate and
        no old ladder phrase; Stage 6 businessIntent is draft-and-ratify (agent
        drafts spine, user ratifies via AskUserQuestion); phrase must not
        pre-fill or user-written blank spine for BI is removed; tests assert
        brainstorm wiring and draft-and-ratify or businessIntent draft language
    verifier:
      kind: shell
      command: "! rg -q 'only when ≥2 viable approaches AND'
        skills/shared/project-assets/project-create-plan.md && ! rg -q 'must not
        pre-fill the five fields'
        skills/shared/project-assets/project-create-plan.md && rg -q
        'draft-and-ratify|drafts the|Drafted|businessIntent'
        skills/shared/project-assets/project-create-plan.md && rg -q 'debate
        --gate|Interview|interview'
        skills/shared/project-assets/project-create-plan.md && node --test
        tests/project.test.js"
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-create-plan.md
      - kind: file
        path: tests/project.test.js
    closedAt: 2026-07-30T15:55:50.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-30T15:55:50.000Z
      verifiedCommit: 62c43f8e55044acb06f34bd935240c077f03f915
      exitCode: 0
      passed: true
      outputSummary: >
        re-ratify / CROSS-MODEL REVIEW tracking (612.051625ms)
          ✔ project assets ship the templates (minimal-source, plan, initiative, bootstrap-*) (629.600583ms)
          ✔ bootstrap-draft template ships with required markers (3-level camelCase) (656.184166ms)
          ✔ minimal-source template has REPLACE markers + a phase H2 + exit_gate (620.166ms)
        ✔ project skill (unified router + lazy assets) (42248.309042ms)

        ℹ tests 66

        ℹ suites 1

        ℹ pass 66

        ℹ fail 0

        ℹ cancelled 0

        ℹ skipped 0

        ℹ todo 0

        ℹ duration_ms 42788.540625
parked: []
emerged: []
planTitle: Brainstorm hardening — process package for DESIGN front-half
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F0 — Skill rewrite, BI contract, lazy assets**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

## Session handoff
- **Narrative:** F0 pure-maestro complete through Step E — T-001/T-002/T-003 closed claim-bound after merge of impl/brainstorm-hardening-F0-writer. Product: brainstorm-assets, always-interview brainstorm.md, Stage 2 debate + BI draft-and-ratify.
- **Decision log:** Claim report exclusivity rewritten to exclusive commitShas (chain base/head endpoints failed pure helper); executionMode: automate stamped; ground-truth fp refreshed.
- **Single nextAction:** Run evaluation agent for F0, stamp evaluationGate, distill lessons, review-code --mode=both, then decision-review PASS|FAIL, then phase-done.
- **Verbatim state:** claimReport=.atomic-skills/status/automate/brainstorm-hardening-claims.json; HEAD=$(git rev-parse --short HEAD); assert done exit 0 with base-ref cc60fd46.
- **Uncommitted changes:** state close paths pending microcommit after refresh-state.
