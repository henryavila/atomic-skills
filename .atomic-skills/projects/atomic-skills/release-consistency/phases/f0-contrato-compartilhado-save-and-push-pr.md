---
schemaVersion: "0.1"
slug: release-consistency-f0-contrato-compartilhado-save-and-push-pr
title: Contrato compartilhado + save-and-push PR-only
goal: Extrair detecção de default branch e helpers de conventional commit para
  assets compartilhados; endurecer `save-and-push` para recusar push na default
  e abrir/instruir PR. Sem skill `release` ainda.
status: active
branch: plan/release-consistency
started: 2026-09-13T16:27:44.146Z
lastUpdated: 2026-09-24T22:55:37Z
nextAction: "Run automate Step F evaluation then phase-done gates for F0"
parentPlan: release-consistency
phaseId: F0
businessIntent:
  value: Agentes param de fazer push na default branch sem PR; a base
    compartilhada (default branch + conventional commits) e o save-and-push
    endurecido fecham o atalho.
  workflow: "1) Extrair assets shared de default-branch e conventional-commits com
    testes. 2) Endurecer save-and-push: recusar push na default, abrir ou
    instruir PR. 3) Validar com testes de contrato até G-F0-1."
  rules: Default branch via origin/HEAD com fallback main|master. Sem perguntar
    push direto. Sem auto-merge. Sem implementar skill release/chooser/templates
    nesta fase.
  outOfScope: Skill release, scripts chooser, templates Action, migrar publish.yml
    do AS, reframe catalog what_is_not.
  doneWhen: tests/release-assets-contract.test.js e
    tests/save-and-push-pr-only.test.js verdes; G-F0-1 passa; save-and-push nao
    oferece a opcao push directly to main.
tasksDone: 2
tasksTotal: 2
gatesMet: 0
gatesTotal: 1
weightDone: 5
weightTotal: 5
exitGates:
  - id: G-F0-1
    description: FAILS when save-and-push still offers push directly to main/master
      or lacks default-branch detection via origin/HEAD
    status: pending
    verifier:
      kind: shell
      command: node --test tests/save-and-push-pr-only.test.js
        tests/release-assets-contract.test.js
    verifierLabel: "shell: node --test tests/save-and-push-pr-only.test.js tests/relea…"
stack:
  - id: 1
    title: Contrato compartilhado + save-and-push PR-only
    type: task
    openedAt: 2026-09-13T16:27:44.146Z
tasks:
  - id: T-001
    title: Shared default-branch + conventional-commit helpers
    status: done
    closedAt: 2026-09-24T22:55:37Z
    evidence:
      verifierKind: shell
      exitCode: 0
      passed: true
      verifiedAt: 2026-09-24T22:55:37Z
      verifiedCommit: 73ac0e101121c70ade4276e1c94e4e58fddeb49d
      outputSummary: "node --test exit 0 on merged plan tree"
    lastUpdated: 2026-09-13T16:27:44.146Z
    scopeBoundary:
      - do not edit skills/core/save-and-push.md in this task; do not add
        release skill or chooser scripts; do not write consumer .github
        workflows
    acceptance:
      - "default-branch.md documents origin/HEAD resolution plus main|master
        fallback; conventional-commits.md documents feat/fix/perf/breaking
        mapping used by both save-and-push and release; test file asserts both
        asset files exist and contain origin/HEAD and feat:"
    verifier:
      kind: shell
      command: node --test tests/release-assets-contract.test.js
    outputs:
      - kind: file
        path: skills/shared/release-assets/default-branch.md
      - kind: file
        path: skills/shared/release-assets/conventional-commits.md
      - kind: file
        path: tests/release-assets-contract.test.js
    summary: Assets de default-branch e conventional commits com teste de contrato.
    weight: 2
  - id: T-002
    title: Harden save-and-push to PR-only on default branch
    status: done
    closedAt: 2026-09-24T22:55:37Z
    evidence:
      verifierKind: shell
      exitCode: 0
      passed: true
      verifiedAt: 2026-09-24T22:55:37Z
      verifiedCommit: 73ac0e101121c70ade4276e1c94e4e58fddeb49d
      outputSummary: "node --test exit 0 on merged plan tree"
    lastUpdated: 2026-09-13T16:27:44.146Z
    scopeBoundary:
      - do not implement release skill; do not add auto-merge; do not mutate
        installer reconcileFileSet; do not change catalog product.what_is_not
        yet
    acceptance:
      - HARD-GATE refuses push on default branch (no ask to push directly to
        main/master); documents branch + gh pr create when gh authenticated,
        else stop with explicit PR instructions; references shared
        default-branch asset; meta/catalog.yaml save-and-push
        value_pitch/purpose updated then docs/skills regenerated via
        generate-skill-docs (no hand-edit SoT); test asserts refuse language and
        absence of push-directly ask
    verifier:
      kind: shell
      command: node --test tests/save-and-push-pr-only.test.js
    outputs:
      - kind: file
        path: skills/core/save-and-push.md
      - kind: file
        path: meta/catalog.yaml
      - kind: file
        path: docs/skills/save-and-push.md
      - kind: file
        path: tests/save-and-push-pr-only.test.js
    summary: HARD-GATE PR-only no save-and-push + catalog pitches + docs regen + teste.
    weight: 3
parked: []
emerged: []
summary: Base compartilhada e save-and-push recusando push na default.
planTitle: Release consistency — PR-only default branch + GH Release + npm stage
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F0 — Contrato compartilhado + save-and-push PR-only**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

## Session handoff
- **Narrative:** F0 writer merged; T-001 and T-002 closed via orchestrator done after claim-bound assert + complex disposition accept on T-002. Exit gate G-F0-1 and automate Step F–G remain.
- **Decision log:** automate stamp; F0 ratify; T-002 complex disposition accept; claim paths include meta/catalog.json for product fence.
- **Single nextAction:** Run automate Step F evaluation agent, then lessons/review/audit/phase-done for F0.
- **Verbatim state:** HEAD=73ac0e101121c70ade4276e1c94e4e58fddeb49d; claimReport=.atomic-skills/status/automate/release-consistency-claims.json; complexReceipt=.atomic-skills/reviews/release-consistency-F0-T-002-complex-local.md; assert done ok at cursor E.
- **Uncommitted changes:** initiative close + claim/receipt paths pending checkpoint commit.
