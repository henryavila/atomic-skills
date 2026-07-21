---
schemaVersion: "0.1"
slug: automate-skill-discipline-f0-assert-cli-and-skill-call-sites-r1
title: Assert CLI and skill call sites (R1)
goal: Land `scripts/assert-automate-gate.js` reusing Layer-1 helpers,
  unit/integration tests, and skill prose that hard-requires assert before
  spawn, done-batch, phase-done, and finalize under automate.
status: active
branch: plan/automate-skill-discipline
started: 2026-07-21T19:25:48.389Z
lastUpdated: 2026-07-21T19:25:48.389Z
nextAction: "Start T-001: assert-automate-gate CLI pure gates"
parentPlan: automate-skill-discipline
phaseId: F0
businessIntent:
  value: "Automate pure-maestro deixa de depender so de disciplina do modelo no
    miolo A-E e na autenticidade de F: assert CLI, evaluation autentica,
    claim-bound done, cursor fino e pause entre fases falham fechado."
  workflow: "TDD: assert CLI e helpers primeiro (F0), schema authenticity
    evaluation (F1), claim-bound done (F2), cursor (F3), pause+framing (F4);
    cada fase com exit gate shell."
  rules: Nao criar skills/core/automate.md; nao Layer 4 daemon; nao
    auto-materialize; non-automate byte-identical; fail closed over looks-done.
  outOfScope: Spawn supervisor multi-host; runner Layer 3 wait-loop; mudanca de
    Mode 2 codex lane; auto-finalize.
  doneWhen: assert-automate-gate testes verdes e prosa exige assert antes de
    spawn/done/phase-done/finalize; F0-G1 e F0-G2 met.
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 2
weightDone: 0
weightTotal: 2
exitGates:
  - id: F0-G1
    description: assert-automate-gate tests pass and script is executable via node.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/assert-automate-gate.test.js && node
        scripts/assert-automate-gate.js --help >/dev/null 2>&1 || node
        scripts/assert-automate-gate.js 2>&1 | head -5
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/assert-automate-gate.test.js && node scri…"
  - id: F0-G2
    description: Skill assets require assert-automate-gate under automate; no
      top-level automate skill.
    status: pending
    verifier:
      kind: shell
      command: test ! -e skills/core/automate.md && rg -n 'assert-automate-gate'
        skills/core/implement.md skills/shared/implement-automate-maestro.md
      expectExitCode: 0
    verifierLabel: "shell: test ! -e skills/core/automate.md && rg -n 'assert-automate…"
stack:
  - id: 1
    title: Assert CLI and skill call sites (R1)
    type: task
    openedAt: 2026-07-21T19:25:48.389Z
tasks:
  - id: T-001
    title: assert-automate-gate CLI pure gates
    status: pending
    lastUpdated: 2026-07-21T19:25:48.389Z
    scopeBoundary:
      - Do not spawn writers or run git merge. Do not change Mode 1 done path.
        Do not add a top-level automate skill. If the published package lists
        scripts via package.json files, include the new script path.
    acceptance:
      - it - CLI accepts --plan and --gate with values spawn claims done
        phase-done finalize (aliases allowed if documented).; it - spawn gate
        returns exit 1 when lease status is blocking via canSpawnPhaseWriter
        semantics.; it - claims/done gate returns exit 1 when claim report
        missing or validateClaimReport fails when report path provided or
        required.; it - phase-done gate returns exit 1 under durable automate
        without evaluationGate that phaseEvaluationAllowsClose accepts.; it -
        finalize gate returns exit 1 when automatePlanEndGatesOk is false.; it -
        prints ok or blocked with reason on stdout/stderr and exit 0 only when
        ok.; it - unit tests cover matrix without network.
    verifier:
      kind: shell
      command: node --test tests/assert-automate-gate.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: scripts/assert-automate-gate.js
      - kind: file
        path: tests/assert-automate-gate.test.js
      - kind: file
        path: package.json
  - id: T-002
    title: Skill prose requires assert before transitions
    status: pending
    lastUpdated: 2026-07-21T19:25:48.389Z
    scopeBoundary:
      - Do not implement evaluation authenticity schema yet (F1). Do not
        implement step cursor file yet (F3). Do not change non-automate review
        ladder defaults.
    acceptance:
      - it - pure-maestro Steps C E G I (or table) require running
        assert-automate-gate (or documented equivalent node invocation) before
        spawn done-batch phase-done finalize.; it - HARD-GATE text forbids
        advancing when assert exits non-zero.; it - antipatterns include
        skipping assert and silent Mode-1 under stamp.; it - realism KB Layer 2
        marked landed or in-progress with script path.; it - no
        skills/core/automate.md created.
    verifier:
      kind: shell
      command: test ! -e skills/core/automate.md && rg -n 'assert-automate-gate'
        skills/core/implement.md skills/shared/implement-automate-maestro.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: skills/shared/implement-automate-maestro.md
      - kind: file
        path: skills/shared/implement-antipatterns.md
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
      - kind: file
        path: skills/shared/project-assets/project-finalize.md
      - kind: file
        path: docs/kb/automate-orchestrator-realism.md
parked: []
emerged: []
planTitle: Automate skill discipline remediation
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F0 — Assert CLI and skill call sites (R1)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
