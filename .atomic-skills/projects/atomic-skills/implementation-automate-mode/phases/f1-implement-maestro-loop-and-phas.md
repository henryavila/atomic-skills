---
schemaVersion: "0.1"
slug: implementation-automate-mode-f1-implement-maestro-loop-and-phas
title: Implement maestro loop and phase-writer contract
goal: "Extend implement so --mode=automate runs the pure-maestro loop: one code-only phase writer per phase, sync wait, claim handling, orchestrator-owned done, no silent Mode-1 fallback."
status: done
branch: plan/implementation-automate-mode
started: 2026-07-17T19:20:54.697Z
lastUpdated: 2026-07-17T19:24:50.000Z
nextAction: phase-done F1; materialize F2
parentPlan: implementation-automate-mode
phaseId: F1
businessIntent:
  value: "Maestro puro sob --mode=automate: session nao edita product source; um phase-writer code-only por fase; orchestrator fecha done."
  workflow: Documentar implement maestro + phase-writer asset + lease/isolation + evaluator; TDD writer-lease helper.
  rules: P2 pure maestro; P3 code-only writer; P4 one writer; sem Mode-1 silent fallback; sem nest worktree.
  outOfScope: phase-done review policy (F2); plan-end finalize (F3); full contract tests (F4).
  doneWhen: F1-G1/G2/G3 met; implement + phase-writer + evaluator assets exist.
tasksDone: 4
tasksTotal: 4
gatesMet: 3
gatesTotal: 3
exitGates:
  - id: F1-G1
    description: implement.md and phase-writer asset describe maestro + code-only writer + isolation without Mode-1 silent fallback.
    status: met
    verifier:
      kind: shell
      command: rg -n 'mode=automate' skills/core/implement.md && rg -n 'code-only|never.*done' skills/shared/implement-phase-writer.md skills/core/implement.md && rg -n 'Mode-1|silent' skills/shared/implement-antipatterns.md
      expectExitCode: 0
    metAt: 2026-07-17T19:24:50.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T19:24:50.000Z
      verifiedCommit: b5a9db307eb9cd2150bfe46cbc20327eea054575
      passed: true
      exitCode: 0
      outputSummary: "orchestrator re-run exit 0 after merge F1: rg -n 'mode=automate' skills/core/implement.md && rg -n 'code-only|never.*done' skills/shared/implement-phase-writer.md skills/core/implement.md && rg -n 'Mode-1|silent' skills/shared/implement-antipatterns.md"
  - id: F1-G2
    description: No new top-level skill named automate was added under skills/core.
    status: met
    verifier:
      kind: shell
      command: test ! -e skills/core/automate.md
      expectExitCode: 0
    metAt: 2026-07-17T19:24:50.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T19:24:50.000Z
      verifiedCommit: b5a9db307eb9cd2150bfe46cbc20327eea054575
      passed: true
      exitCode: 0
      outputSummary: "orchestrator re-run exit 0 after merge F1: test ! -e skills/core/automate.md"
  - id: F1-G3
    description: Phase evaluation agent contract exists and forbids auto-finalize without user validation.
    status: met
    verifier:
      kind: shell
      command: test -s skills/shared/implement-phase-evaluator.md && rg -n 'evaluation agent|user validates' skills/shared/implement-phase-evaluator.md skills/core/implement.md
      expectExitCode: 0
    metAt: 2026-07-17T19:24:50.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T19:24:50.000Z
      verifiedCommit: b5a9db307eb9cd2150bfe46cbc20327eea054575
      passed: true
      exitCode: 0
      outputSummary: "orchestrator re-run exit 0 after merge F1: test -s skills/shared/implement-phase-evaluator.md && rg -n 'evaluation agent|user validates' skills/shared/implement-phase-evaluator.md skills/core/implement.md"
stack:
  - id: 1
    title: Implement maestro loop and phase-writer contract
    type: task
    openedAt: 2026-07-17T19:20:54.697Z
tasks:
  - id: T-004
    title: Document automate iron laws and step spine in implement.md
    status: done
    lastUpdated: 2026-07-17T19:24:50.000Z
    scopeBoundary:
      - Do not implement Mode 2 changes. Do not rewrite project-transitions phase-done yet. Do not add a new top-level skill file.
    acceptance:
      - it - implement.md defines --mode=automate entry and pure-maestro decision that the session never edits product source under automate.; it - phase-writer contract is code-only and forbids done phase-done handoff and .atomic-skills state writes.; it - step spine includes sync wait, claim re-verify, complex review hook point, and re-dispatch on verifier fail without done.; it - antipatterns file covers silent Mode-1 fallback and phase writer self-certify.
    verifier:
      kind: shell
      command: rg -n 'mode=automate|phase writer|planEndReviewOk|pure maestro|never self-certif' skills/core/implement.md skills/shared/implement-antipatterns.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: skills/shared/implement-antipatterns.md
    summary: Document automate iron laws and step spine in implement.md
    weight: 2
    closedAt: 2026-07-17T19:24:50.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T19:24:50.000Z
      verifiedCommit: b5a9db307eb9cd2150bfe46cbc20327eea054575
      passed: true
      exitCode: 0
      outputSummary: "orchestrator re-run exit 0 after merge F1: rg -n 'mode=automate|phase writer|planEndReviewOk|pure maestro|never self-certif' skills/core/implement.md skills/shared/implement-antipatterns.md"
  - id: T-005
    title: Phase work-order and claim-report contract
    status: done
    lastUpdated: 2026-07-17T19:24:50.000Z
    scopeBoundary:
      - Do not add host-only Workflow tools outside ide conditionals. Do not change SPEC admission in lint-source.js.
    acceptance:
      - it - A lazy asset documents the phase work-order fields task ids paths scopeBoundary acceptance verifier and the claim report shape taskId commitShas paths verifierCommand exitCode transcript.; it - implement.md points phase dispatch at that asset and requires constructed brief without orchestrator chat history.; it - resume refuse when dirty tree or phase-writer still running is stated as HARD-GATE.
    verifier:
      kind: shell
      command: test -s skills/shared/implement-phase-writer.md && rg -n 'claim report|work-order|HARD-GATE' skills/shared/implement-phase-writer.md skills/core/implement.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/implement-phase-writer.md
      - kind: file
        path: skills/core/implement.md
    summary: Phase work-order and claim-report contract
    weight: 2
    closedAt: 2026-07-17T19:24:50.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T19:24:50.000Z
      verifiedCommit: b5a9db307eb9cd2150bfe46cbc20327eea054575
      passed: true
      exitCode: 0
      outputSummary: "orchestrator re-run exit 0 after merge F1: test -s skills/shared/implement-phase-writer.md && rg -n 'claim report|work-order|HARD-GATE' skills/shared/implement-phase-writer.md skills/core/implement.md"
  - id: T-006
    title: Sibling phase worktree isolation, writer lease, and merge-before-done
    status: done
    lastUpdated: 2026-07-17T19:24:50.000Z
    scopeBoundary:
      - Do not nest a phase worktree under the plan worktree path. Do not change Mode 2 merge-back defaults for non-automate. Do not force sibling worktrees for Mode 1.
    acceptance:
      - it - Automate phase isolation cuts a sibling worktree from the git common-dir or primary root, never a nest under .worktrees/plan-slug.; it - writer lease file is written before spawn and cleared only after sync wait claim collect and merge settle; resume refuses when lease present.; it - orchestrator merges sibling into plan branch with git-ops only before any task re-verify or done; content conflicts re-dispatch a code-only fix agent; post-merge re-verify is mandatory before done.; it - concurrent phase writers remain forbidden in v1 even if plan parallelismAllowed is true.
    verifier:
      kind: shell
      command: node --test tests/writer-lease.test.js && rg -n 'sibling|writer lease|common-dir|never nest|merge.*before|post-merge' skills/core/implement.md skills/shared/worktree-isolation.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: skills/shared/worktree-isolation.md
      - kind: file
        path: src/writer-lease.js
      - kind: file
        path: tests/writer-lease.test.js
    summary: Sibling phase worktree isolation, writer lease, and merge-before-done
    weight: 3
    closedAt: 2026-07-17T19:24:50.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T19:24:50.000Z
      verifiedCommit: b5a9db307eb9cd2150bfe46cbc20327eea054575
      passed: true
      exitCode: 0
      outputSummary: "orchestrator re-run exit 0 after merge F1: node --test tests/writer-lease.test.js && rg -n 'sibling|writer lease|common-dir|never nest|merge.*before|post-merge' skills/core/implement.md skills/shared/worktree-isolation.md"
  - id: T-015
    title: Phase evaluation agent, reopen protocol, and decision-log visibility
    status: done
    lastUpdated: 2026-07-17T19:24:50.000Z
    scopeBoundary:
      - Do not merge evaluation into the phase writer agent. Do not auto-finalize after evaluation pass. Evaluator never writes project state.
    acceptance:
      - "it - Fixed order: all phase tasks done, then evaluation agent, then phase-done review-code both.; it - Evaluator does not edit product source or project state and returns structured pass or fail against phase goal gates and businessIntent.; it - On evaluation blocker or critical, orchestrator reopens affected tasks or creates blocking follow-up tasks, re-dispatches code-only fix agent max 2, re-runs verifiers and complex-task reviews on the fix range, and only then allows phase-done.; it - Orchestrator writes routing skip re-dispatch scope-exit and review severity dispositions to a durable decisions log.; it - Finalize and archive require userValidationOk after the last phase."
    verifier:
      kind: shell
      command: test -s skills/shared/implement-phase-evaluator.md && rg -n 'evaluation agent|user validates' skills/shared/implement-phase-evaluator.md skills/core/implement.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: skills/shared/implement-phase-writer.md
      - kind: file
        path: skills/shared/implement-phase-evaluator.md
    summary: Phase evaluation agent, reopen protocol, and decision-log visibility
    weight: 3
    closedAt: 2026-07-17T19:24:50.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T19:24:50.000Z
      verifiedCommit: b5a9db307eb9cd2150bfe46cbc20327eea054575
      passed: true
      exitCode: 0
      outputSummary: "orchestrator re-run exit 0 after merge F1: test -s skills/shared/implement-phase-evaluator.md && rg -n 'evaluation agent|user validates' skills/shared/implement-phase-evaluator.md skills/core/implement.md"
parked: []
emerged: []
summary: "Implement maestro: writer code-only, evaluator, sibling isolation, lease, merge-before-done."
startedCommit: unknown
---
# Narrative / notes

Initiative for phase **F1 — Implement maestro loop and phase-writer contract**.

## Decisions

_(record decisions here as they are made)_

## Session handoff
- **Narrative:** F1 pure-maestro spine + phase-writer + writer-lease + evaluator landed and re-verified on merge.
- **Decision log:** Sibling isolation + lease pure helper; evaluation before phase-done both; no top-level automate skill.
- **Single nextAction:** F1 phase cross-model review then materialize F2.
- **Verbatim state:** HEAD=b5a9db307eb9cd2150bfe46cbc20327eea054575; writer-lease 16 tests; F1 gates met.
- **Uncommitted changes:** F1 close state.
