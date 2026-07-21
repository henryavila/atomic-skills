---
schemaVersion: "0.1"
slug: automate-skill-discipline-f2-claim-bound-done-and-complex-both
title: Claim-bound done and complex both under automate (R4 + P0-3)
goal: Under durable automate stamp, task close refuses missing/invalid claims, failed reachability, and complex tasks without both-mode review clear; assert --gate done shares the predicate; Mode 1 unstamped unchanged.
status: done
branch: plan/automate-skill-discipline
started: 2026-07-21T20:00:52.547Z
lastUpdated: 2026-07-21T20:07:10.000Z
nextAction: Materialize F3 maestro cursor
parentPlan: automate-skill-discipline
phaseId: F2
businessIntent:
  value: Sob stamp automate, done recusa claim invalido, reachability falha e complex sem both-clear — fail-closed no miolo A-E que a auditoria marcou como soft.
  workflow: TDD predicates claim-bound/complex (T-005) depois wire assert done + prosa transitions (T-006); Mode 1 unstamped permanece igual.
  rules: Nao mudar GATE-R2 verifier execution; nao forcar complex both em non-automate; nao deixar phase writer chamar done; claim obrigatorio so com executionMode automate.
  outOfScope: maestro cursor (F3); pause F4; Layer 4; auto-merge no assert script.
  doneWhen: Unit tests claim/complex/assert verdes; prosa claim-bound greppable; F2-G1/F2-G2 met.
tasksDone: 2
tasksTotal: 2
gatesMet: 2
gatesTotal: 2
exitGates:
  - id: F2-G1
    description: Claim-bound and complex gate unit tests pass.
    status: met
    verifier:
      kind: shell
      command: node --test tests/automate-orchestrator-gates.test.js tests/claim-report.test.js tests/complex-task.test.js tests/assert-automate-gate.test.js
      expectExitCode: 0
    metAt: 2026-07-21T20:07:10.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-21T20:07:10.000Z
      verifiedCommit: 9b936b2ffde00d176e68f5cd02e2792fbe55e4b1
      passed: true
      exitCode: 0
      outputSummary: F2 exit gate
  - id: F2-G2
    description: Maestro and transitions document claim-bound done under automate stamp.
    status: met
    verifier:
      kind: shell
      command: rg -n 'claim-bound|canCloseTasksFromClaims|reachability' skills/shared/implement-automate-maestro.md skills/shared/project-assets/project-transitions.md
      expectExitCode: 0
    metAt: 2026-07-21T20:07:10.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-21T20:07:10.000Z
      verifiedCommit: 9b936b2ffde00d176e68f5cd02e2792fbe55e4b1
      passed: true
      exitCode: 0
      outputSummary: F2 exit gate
stack:
  - id: 1
    title: Claim-bound done and complex both under automate (R4 + P0-3)
    type: task
    openedAt: 2026-07-21T20:00:52.547Z
tasks:
  - id: T-005
    title: Pure claim-bound and complex-before-done predicates
    status: done
    lastUpdated: 2026-07-21T20:07:10.000Z
    scopeBoundary:
      - Do not change GATE-R2 verifier execution itself. Do not force complex both on non-automate. Do not spawn review-code.
    acceptance:
      - it - canCloseTasksFromClaims (or new canDoneFromAutomateClaims) documents required claim report + optional reachability true by default for automate done.; it - helper for complex path requires isComplexTask result and a durable review receipt mode both (or skip with recorded operator disposition) before allow done.; it - non-complex allows verifier-only path.; it - unit tests cover missing claim, overlapping SHAs, non-reachable SHA, complex without receipt.
    verifier:
      kind: shell
      command: node --test tests/automate-orchestrator-gates.test.js tests/claim-report.test.js tests/complex-task.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/automate-orchestrator-gates.js
      - kind: file
        path: src/claim-report.js
      - kind: file
        path: src/complex-task.js
      - kind: file
        path: tests/automate-orchestrator-gates.test.js
      - kind: file
        path: tests/claim-report.test.js
    closedAt: 2026-07-21T20:07:10.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-21T20:07:10.000Z
      verifiedCommit: 9b936b2ffde00d176e68f5cd02e2792fbe55e4b1
      passed: true
      exitCode: 0
      outputSummary: 62 pass claim-bound complex predicates
  - id: T-006
    title: Wire done path and assert done gate under stamp
    status: done
    lastUpdated: 2026-07-21T20:07:10.000Z
    scopeBoundary:
      - Do not require claim reports when plan has no executionMode automate. Do not let phase writer call done. Do not auto-merge worktrees in the assert script.
    acceptance:
      - it - assert --gate done fails without valid claim when plan stamp is automate.; it - implement/maestro Step E requires assert done (or predicate) after reachability before each orchestrator done.; it - transitions done flow documents automate claim-bound HARD-GATE when stamp present.; it - tests cover stamp on vs off.
    verifier:
      kind: shell
      command: rg -n 'claim-bound|canCloseTasksFromClaims|reachability' skills/shared/implement-automate-maestro.md skills/shared/project-assets/project-transitions.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: scripts/assert-automate-gate.js
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
      - kind: file
        path: skills/shared/implement-automate-maestro.md
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: skills/shared/implement-phase-writer.md
      - kind: file
        path: tests/assert-automate-gate.test.js
    closedAt: 2026-07-21T20:07:10.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-21T20:07:10.000Z
      verifiedCommit: 9b936b2ffde00d176e68f5cd02e2792fbe55e4b1
      passed: true
      exitCode: 0
      outputSummary: 17 pass assert done + rg claim-bound
parked: []
emerged: []
---

# Narrative / notes

Initiative for phase **F2 — Claim-bound done and complex both under automate (R4 + P0-3)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

## Session handoff
- **Narrative:** F2 claim-bound done closed under pure-maestro. Continuing F3 thin cursor.
- **Decision log:** Automate multi-phase without operator handoffs for materialize.
- **Single nextAction:** Materialize F3; phase writer T-007 T-008.
- **Verbatim state:** HEAD=9b936b2ffde00d176e68f5cd02e2792fbe55e4b1; reportPath=.atomic-skills/reviews/2026-07-21-automate-skill-discipline-f2-evaluation.md
- **Uncommitted changes:** clean after commit.
