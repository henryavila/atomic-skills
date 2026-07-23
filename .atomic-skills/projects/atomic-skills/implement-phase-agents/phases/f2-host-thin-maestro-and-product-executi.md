---
schemaVersion: "0.1"
slug: implement-phase-agents-f2-host-thin-maestro-and-product-executi
title: Host-thin maestro and product execution ban
goal: Enforce host-thin behavior in skill prose and STOP helpers so automate cannot honestly run as a host mega-implementer.
status: active
branch: plan/implement-phase-agents
started: 2026-07-23T00:58:11.685Z
lastUpdated: 2026-07-23T01:39:22.758Z
nextAction: SYNC WAIT F2 phase writer claim report (T-007..T-009).
parentPlan: implement-phase-agents
phaseId: F2
businessIntent:
  value: "Sob automate o host permanece host-thin: nao executa entrypoints de produto (compose, build_edl, app servers) fora de verifiers verbatim; ban e preflight ficam greppable e testaveis para impedir mega-sessao do host."
  workflow: Ban de product entrypoints + antipatterns (T-007) → role banner e phase-start validate-only nos stops (T-008) → assert/preflight descriptor-only e lease (T-009) → F3+ hardgate decisionReview e ritual.
  rules: Nao banir comando shell do task.verifier ou exit-gate. Nao banir git-ops merge/status/log. Permitir assert-automate-gate, validate-state e verifiers copiados verbatim. Nao auto-spawn sem ratify do phase-start package. Nao implementar process supervisor. Nao exigir network no assert.
  outOfScope: Layer 4 daemon; reescrever Mode 1/2; auto-PASS de gates manuais de produto; banir verifiers legitimos; network no assert.
  doneWhen: Strings host-thin/product/verbatim greppable em maestro+implement; role banner/phase-start/validate-only greppable; testes automate-orchestrator-gates cobrem descriptor-only refuse; F2-G1 e F2-G2 metiveis.
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: F2-G1
    description: Host-thin and product entrypoint ban strings exist in maestro and implement.
    status: pending
    verifier:
      kind: shell
      command: rg -n 'host-thin|verbatim|product' skills/shared/implement-automate-maestro.md skills/core/implement.md
      expectExitCode: 0
  - id: F2-G2
    description: Orchestrator gate tests pass including descriptor-only coverage.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/automate-orchestrator-gates.test.js
      expectExitCode: 0
stack:
  - id: 1
    title: Host-thin maestro and product execution ban
    type: task
    openedAt: 2026-07-23T00:58:11.685Z
tasks:
  - id: T-007
    title: Product execution ban in maestro and antipatterns
    status: pending
    lastUpdated: 2026-07-23T00:58:11.685Z
    scopeBoundary:
      - Do not ban verbatim task verifier shell commands. Do not ban git-ops merge on the plan branch.
    acceptance:
      - it - Hard rule lists product entrypoint classes forbidden on the host under automate outside verifiers.; it - Allowed host shell actions include git merge status log, assert-automate-gate, validate-state, and task verifier commands copied from task.verifier.; it - Antipattern Temptation for I will just run compose myself is refuted with re-dispatch fix agent.
    verifier:
      kind: shell
      command: rg -n 'product entrypoint|verbatim|forbidden|fix agent' skills/shared/implement-automate-maestro.md skills/shared/implement-antipatterns.md skills/core/implement.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/implement-automate-maestro.md
      - kind: file
        path: skills/shared/implement-antipatterns.md
      - kind: file
        path: skills/core/implement.md
  - id: T-008
    title: Role banner and single nextAction on stops
    status: pending
    lastUpdated: 2026-07-23T00:58:11.685Z
    scopeBoundary:
      - Do not auto-spawn without operator ratify of the phase-start package.
    acceptance:
      - it - At Step A C D.5 E F G H the skill requires a one-line role banner stating host-thin maestro.
      - it - Phase-start package presents objective tasks and drafted BI for validate-only before spawn.
      - it - After phase-done when successor needs package host must not spawn a writer until ratify.
    verifier:
      kind: shell
      command: rg -n 'role banner|phase-start|draft|validate-only|nextAction' skills/shared/implement-automate-maestro.md skills/core/implement.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/implement-automate-maestro.md
      - kind: file
        path: skills/core/implement.md
  - id: T-009
    title: Assert gate for host-thin preflight optional hook
    status: pending
    lastUpdated: 2026-07-23T00:58:11.685Z
    scopeBoundary:
      - Do not implement a full process supervisor. Do not require network for assert.
    acceptance:
      - it - canSpawnPhaseWriter or a sibling helper documents host-thin preconditions already required lease clean and phase materialized.; it - assert-automate-gate exposes or documents a gate that fails when active phase initiative file is missing descriptor-only.; it - Unit tests cover descriptor-only refuse path for spawn or phase load.
    verifier:
      kind: shell
      command: node --test tests/automate-orchestrator-gates.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: scripts/assert-automate-gate.js
      - kind: file
        path: src/automate-orchestrator-gates.js
      - kind: file
        path: tests/automate-orchestrator-gates.test.js
parked: []
emerged: []
---

# Narrative / notes

Initiative for phase **F2 — Host-thin maestro and product execution ban**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

## Session handoff
- **Narrative:** Pure-maestro pre-dispatch F2 after operator aprovado. Spawning phase writer for T-007..T-009.
- **Decision log:** F2 BI approved (operator aprovado). executionMode automate. Lease acquire for F2 writer.
- **Single nextAction:** SYNC WAIT F2 phase writer claim report; then merge + post-merge done.
- **Verbatim state:** HEAD=48b5f69db2a5c8657c1f204bfcaeae41d5ae23af; writerBranch=impl/implement-phase-agents-F2-writer; worktreePath=/Volumes/External/code/atomic-skills/.worktrees/implement-phase-agents-F2-writer; baseRef=48b5f69db2a5c8657c1f204bfcaeae41d5ae23af.
- **Uncommitted changes:** handoff until pre-dispatch commit.
