---
schemaVersion: "0.1"
slug: implement-phase-agents-f2-host-thin-maestro-and-product-executi
title: Host-thin maestro and product execution ban
goal: Enforce host-thin behavior in skill prose and STOP helpers so automate cannot honestly run as a host mega-implementer.
status: done
branch: plan/implement-phase-agents
started: 2026-07-23T00:58:11.685Z
lastUpdated: 2026-07-23T01:59:43.000Z
nextAction: null
parentPlan: implement-phase-agents
phaseId: F2
businessIntent:
  value: "Sob automate o host permanece host-thin: nao executa entrypoints de produto (compose, build_edl, app servers) fora de verifiers verbatim; ban e preflight ficam greppable e testaveis para impedir mega-sessao do host."
  workflow: Ban de product entrypoints + antipatterns (T-007) → role banner e phase-start validate-only nos stops (T-008) → assert/preflight descriptor-only e lease (T-009) → F3+ hardgate decisionReview e ritual.
  rules: Nao banir comando shell do task.verifier ou exit-gate. Nao banir git-ops merge/status/log. Permitir assert-automate-gate, validate-state e verifiers copiados verbatim. Nao auto-spawn sem ratify do phase-start package. Nao implementar process supervisor. Nao exigir network no assert.
  outOfScope: Layer 4 daemon; reescrever Mode 1/2; auto-PASS de gates manuais de produto; banir verifiers legitimos; network no assert.
  doneWhen: Strings host-thin/product/verbatim greppable em maestro+implement; role banner/phase-start/validate-only greppable; testes automate-orchestrator-gates cobrem descriptor-only refuse; F2-G1 e F2-G2 metiveis.
tasksDone: 3
tasksTotal: 3
gatesMet: 2
gatesTotal: 2
exitGates:
  - id: F2-G1
    description: Host-thin and product entrypoint ban strings exist in maestro and implement.
    status: met
    verifier:
      kind: shell
      command: rg -n 'host-thin|verbatim|product' skills/shared/implement-automate-maestro.md skills/core/implement.md
      expectExitCode: 0
    metAt: 2026-07-23T01:59:43.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-23T01:59:43.000Z
      verifiedCommit: 7d82db4398adcdb6b6c9bf7bcebc7d46f7f2267a
      passed: true
      exitCode: 0
      outputSummary: rg host-thin|verbatim|product EXIT 0
  - id: F2-G2
    description: Orchestrator gate tests pass including descriptor-only coverage.
    status: met
    verifier:
      kind: shell
      command: node --test tests/automate-orchestrator-gates.test.js
      expectExitCode: 0
    metAt: 2026-07-23T01:59:43.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-23T01:59:43.000Z
      verifiedCommit: 7d82db4398adcdb6b6c9bf7bcebc7d46f7f2267a
      passed: true
      exitCode: 0
      outputSummary: automate-orchestrator-gates 28 pass
stack:
  - id: 1
    title: Host-thin maestro and product execution ban
    type: task
    openedAt: 2026-07-23T00:58:11.685Z
tasks:
  - id: T-007
    title: Product execution ban in maestro and antipatterns
    status: done
    lastUpdated: 2026-07-23T01:46:25.113Z
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
    closedAt: 2026-07-23T01:46:25.113Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-23T01:46:25.113Z
      verifiedCommit: be9145df7d357285ce16ff02552c1247bf297267
      passed: true
      exitCode: 0
      outputSummary: "skills/shared/implement-antipatterns.md:11:- \"The handoff narrative reads cleaner if I summarize the error instead of pasting it.\" → Literals are verbatim. A paraphrased command/path/error is a different one and strands the next session. skills/shared/implement-antipatterns.md:25:- \"Automate is active but the phase writer died — I'll just code the remaining tasks myself (silent Mode-1 fallback).\" → Under `isAutomateActive` / pure maestro the session **never** edits product source. Spawn failure "
  - id: T-008
    title: Role banner and single nextAction on stops
    status: done
    lastUpdated: 2026-07-23T01:46:25.113Z
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
    closedAt: 2026-07-23T01:46:25.113Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-23T01:46:25.113Z
      verifiedCommit: be9145df7d357285ce16ff02552c1247bf297267
      passed: true
      exitCode: 0
      outputSummary: "skills/core/implement.md:27:4. **Never silent Mode-1 fallback.** Under automate, spawn failure or review/verifier fail means re-dispatch a code-only fix agent (max **2**) or stop for the operator — **not** the host session coding product source. Leaving automate requires explicit `--clear-execution-mode` / Mode-1 re-entry recorded in the decision log. **Silent auto-PASS** of drafted `businessIntent` or decision-review is forbidden. skills/core/implement.md:30:7. **phase-start package + operator "
  - id: T-009
    title: Assert gate for host-thin preflight optional hook
    status: done
    lastUpdated: 2026-07-23T01:46:25.113Z
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
    closedAt: 2026-07-23T01:46:25.113Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-23T01:46:25.113Z
      verifiedCommit: be9145df7d357285ce16ff02552c1247bf297267
      passed: true
      exitCode: 0
      outputSummary: ▶ shouldRunPureMaestro ✔ true for cli automate (1.788833ms) ✔ false by default (0.156916ms) ✔ stamp alone true; clear flag false (0.061375ms) ✔ shouldRunPureMaestro (2.999708ms) ▶ canSpawnPhaseWriter ✔ ok when missing (0.109083ms) ✔ blocks active/cleared/malformed (0.0455ms) ✔ descriptor-only refuse when initiativePresent false (0.328042ms) ✔ ok when lease clean and initiative present (0.169709ms) ✔ canSpawnPhaseWriter (0.944875ms) ▶ canSpawnHostThinPhaseWriter ✔ documents host-thin precondition
parked: []
emerged: []
current: false
---

# Narrative / notes

Initiative for phase **F2 — Host-thin maestro and product execution ban**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

## Session handoff
- **Narrative:** F2 closed. Host-thin product ban + open host class + assert path jail. evaluationGate pass, review both after fix. Archived; currentPhase F3 descriptor-only.
- **Decision log:** Review H1 closed allowlist rewritten to deny-product + open host class. Assert slug jail + flat layout. Operator aprovado.
- **Single nextAction:** materialize F3 then pure-maestro implement (executionMode automate stamped).
- **Verbatim state:** HEAD=7d82db4398adcdb6b6c9bf7bcebc7d46f7f2267a; F2=done; currentPhase=F3; executionMode=automate; lease=missing.
- **Uncommitted changes:** phase-done advance this write.


## Self-review against code-quality gates
- G1: T-007..T-009 + F2-G1/G2 re-run at 7d82db4
- CROSS-MODEL: both local+codex; receipt implement-phase-agents-F2-both-7d82db4.md
- reviewGate: passed mode=both at=7d82db4398adcdb6b6c9bf7bcebc7d46f7f2267a
- decision-review: operator PASS (aprovado)
