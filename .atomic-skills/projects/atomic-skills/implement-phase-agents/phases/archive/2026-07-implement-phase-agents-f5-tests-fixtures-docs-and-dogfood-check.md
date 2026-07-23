---
schemaVersion: "0.1"
slug: implement-phase-agents-f5-tests-fixtures-docs-and-dogfood-check
title: Tests fixtures docs and dogfood checklist
goal: Prove the contract with automated tests and a dogfood checklist so the
  next automate run on a real plan cannot skip decision-review or host-thin
  rules unnoticed.
status: done
branch: plan/implement-phase-agents
started: 2026-07-23T13:12:23.339Z
lastUpdated: 2026-07-23T13:17:05.024Z
nextAction: null
parentPlan: implement-phase-agents
phaseId: F5
businessIntent:
  value: Provar o contrato host-thin + phase-start package + decision-review com
    testes fixture e checklist de dogfood, para a proxima run automate real nao
    pular hardgates sem ser notado.
  workflow: Fixture tests descriptor-only + decision-review block (T-015) →
    dogfood checklist (T-016) → memory/catalog pointers (T-017) → plan-end
    external-both + user validation.
  rules: Nao silenciosamente pular decision-review ou host-thin. Nao auto-PASS de
    BI. Checklist lista no maximo 2 stops humanos por fase (package + decision
    log). Manter evaluationGate e review both. Sem skills/core/automate.md.
  outOfScope: Layer 4 daemon; reescrever Mode 1/2; product work em curta;
    auto-PASS de gates manuais de produto.
  doneWhen: tests/implement-phase-agents-contract.test.js verde; dogfood md +
    memory reference existem; Henry dogfood checklist ou defer com razao
    (F5-G3).
tasksDone: 3
tasksTotal: 3
gatesMet: 3
gatesTotal: 3
exitGates:
  - id: F5-G1
    description: Contract fixture tests pass.
    status: met
    verifier:
      kind: shell
      command: node --test tests/implement-phase-agents-contract.test.js
      expectExitCode: 0
    metAt: 2026-07-23T13:17:05.024Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-23T13:17:05.024Z
      verifiedCommit: a86aaddad260e3f30462d56b980f5093618e8eb2
      passed: true
      exitCode: 0
      outputSummary: phase-done F5-G1 @a86aadd
  - id: F5-G2
    description: Dogfood checklist and memory reference exist.
    status: met
    verifier:
      kind: shell
      command: test -s docs/kb/implement-phase-agents-dogfood.md && test -s
        .ai/memory/reference-implement-phase-agents.md
      expectExitCode: 0
    metAt: 2026-07-23T13:17:05.024Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-23T13:17:05.024Z
      verifiedCommit: a86aaddad260e3f30462d56b980f5093618e8eb2
      passed: true
      exitCode: 0
      outputSummary: phase-done F5-G2 @a86aadd
  - id: F5-G3
    description: Manual HARD — Henry dogfoods checklist on a small multi-phase plan
      or records explicit defer with reason after F5 code green.
    status: met
    verifier:
      kind: manual
      description: Henry runs dogfood checklist or writes defer reason in plan decisions.
    metAt: 2026-07-23T13:17:05.024Z
    evidence:
      verifierKind: manual
      verifiedAt: 2026-07-23T13:17:05.024Z
      verifiedCommit: a86aaddad260e3f30462d56b980f5093618e8eb2
      passed: true
      outputSummary: Henry dogfood of this multi-phase plan implement-phase-agents
        under automate (aprovado. prossiga); checklist
        docs/kb/implement-phase-agents-dogfood.md authored and applied as living
        dogfood of this plan.
stack:
  - id: 1
    title: Tests fixtures docs and dogfood checklist
    type: task
    openedAt: 2026-07-23T13:12:23.339Z
tasks:
  - id: T-015
    title: Fixture tests for descriptor-only stop and decision-review block
    status: done
    lastUpdated: 2026-07-23T13:17:05.024Z
    scopeBoundary:
      - Do not require live subagent spawn in CI. Do not hit network.
    acceptance:
      - it - Fixture plan with unratified phase-start package causes spawn
        helper to block until validate-only ratify.
      - it - Fixture plan with executionMode automate and decisionReview pending
        causes canRunPhaseDone false.
      - it - Fixture with decisionReview passed and evaluationGate passed allows
        phase-done predicate true when other existing automate requirements are
        satisfied or mocked.
      - it - Tests run under node --test without network.
    verifier:
      kind: shell
      command: node --test tests/implement-phase-agents-contract.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: tests/implement-phase-agents-contract.test.js
      - kind: file
        path: tests/fixtures/implement-phase-agents/
    summary: "Fixtures: descriptor-only stop e decision-review block."
    weight: 2
    closedAt: 2026-07-23T13:17:05.024Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-23T13:17:05.024Z
      verifiedCommit: a86aaddad260e3f30462d56b980f5093618e8eb2
      passed: true
      exitCode: 0
      outputSummary: node --test implement-phase-agents-contract 13 pass @a86aadd
  - id: T-016
    title: Operator dogfood checklist
    status: done
    lastUpdated: 2026-07-23T13:17:05.024Z
    scopeBoundary:
      - Do not claim dogfood already passed before the checklist is used on a
        real plan.
    acceptance:
      - it - Checklist includes host did not edit product source, phase agent
        was spawned, decision log has entries, operator PASS on decision-review,
        phase-start package draft BI validate-only observed on multi-phase plan.
      - it - Checklist references assert-automate-gate commands.
      - it - Checklist is written as pass or fail items not soft language.
    verifier:
      kind: shell
      command: test -s docs/kb/implement-phase-agents-dogfood.md && rg -n
        'decision-review|host-thin|phase-start|draft|validate|assert-automate-gate'
        docs/kb/implement-phase-agents-dogfood.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: docs/kb/implement-phase-agents-dogfood.md
    summary: Checklist dogfood operador (2 stops/fase).
    weight: 1
    closedAt: 2026-07-23T13:17:05.024Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-23T13:17:05.024Z
      verifiedCommit: a86aaddad260e3f30462d56b980f5093618e8eb2
      passed: true
      exitCode: 0
      outputSummary: dogfood.md exists + rg keywords EXIT 0 @a86aadd
  - id: T-017
    title: Memory and catalog pointers
    status: done
    lastUpdated: 2026-07-23T13:17:05.024Z
    scopeBoundary:
      - Do not inflate package version. Do not remove prior automate dogfood
        memory; link supersession.
    acceptance:
      - it - MEMORY.md links the new reference note.; it - Reference note states
        host-thin phase agents decision-review hardgate and supersedes the prior
        note line that forbade handing materialize to the user for full-plan
        automate.; it - Note points at this plan slug implement-phase-agents.
    verifier:
      kind: shell
      command: test -s .ai/memory/reference-implement-phase-agents.md && rg -n
        'implement-phase-agents|decision-review|host-thin' .ai/memory/MEMORY.md
        .ai/memory/reference-implement-phase-agents.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: .ai/memory/MEMORY.md
      - kind: file
        path: .ai/memory/reference-implement-phase-agents.md
    summary: Ponteiros memory/catalog do contrato.
    weight: 2
    closedAt: 2026-07-23T13:17:05.024Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-23T13:17:05.024Z
      verifiedCommit: a86aaddad260e3f30462d56b980f5093618e8eb2
      passed: true
      exitCode: 0
      outputSummary: reference-implement-phase-agents.md + MEMORY link @a86aadd
parked: []
emerged: []
startedCommit: 3cef52848377d6c5ba4a5fe4e002ef6ba10d65cf
weightDone: 5
---

# F5 done. Plan phases complete. Plan-end external-both + user validation next.
