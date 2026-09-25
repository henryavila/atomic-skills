---
schemaVersion: "0.1"
slug: release-consistency-f2-fixture-dogfood-as-stage-migration-catal
title: Fixture dogfood + AS stage migration + catalog reframe
goal: Fixture de consumer prova PR-only, chooser, dual-mode e template stage;
  depois migrar `.github/workflows/publish.yml` do Atomic Skills para stage;
  reframe `product.what_is_not`; documentar runbook de approve.
status: done
branch: plan/release-consistency
started: 2026-09-24T23:43:05.426Z
lastUpdated: 2026-09-25T00:09:00.917Z
nextAction: null
parentPlan: release-consistency
phaseId: F2
tasksDone: 3
tasksTotal: 3
gatesMet: 2
gatesTotal: 2
weightDone: 3
weightTotal: 3
exitGates:
  - id: G-F2-1
    description: FAILS when fixture tests are red or when AS publish.yml still uses
      direct npm publish as happy path
    status: met
    verifier:
      kind: shell
      command: "node --test tests/release-fixture.test.js && rg -q 'stage publish'
        .github/workflows/publish.yml && ! rg -q '^\\s+- run: npm publish'
        .github/workflows/publish.yml"
    metAt: 2026-09-25T00:09:00.917Z
    evidence:
      verifierKind: shell
      exitCode: 0
      passed: true
      verifiedAt: 2026-09-25T00:09:00.917Z
      verifiedCommit: 71e46ace84bbfb19b3b6d5f803719cbdeee66cd1
      outputSummary: exit gate verifier exit 0
    verifierLabel: "shell: node --test tests/release-fixture.test.js && rg -q 'stage p…"
    evidenceSummary: passed · 2026-09-25
  - id: G-F2-2
    description: FAILS when catalog reframe drops the not-a-git-workflow boundary or
      omits agent-gate clarification
    status: met
    verifier:
      kind: shell
      command: node --test tests/catalog-product-boundary.test.js
    metAt: 2026-09-25T00:09:00.917Z
    evidence:
      verifierKind: shell
      exitCode: 0
      passed: true
      verifiedAt: 2026-09-25T00:09:00.917Z
      verifiedCommit: 71e46ace84bbfb19b3b6d5f803719cbdeee66cd1
      outputSummary: exit gate verifier exit 0
    verifierLabel: "shell: node --test tests/catalog-product-boundary.test.js"
    evidenceSummary: passed · 2026-09-25
stack:
  - id: 1
    title: Fixture dogfood + AS stage migration + catalog reframe
    type: task
    openedAt: 2026-09-24T23:43:05.426Z
tasks:
  - id: T-006
    title: Consumer fixture proves release contract
    status: done
    lastUpdated: 2026-09-24T23:49:09.509Z
    scopeBoundary:
      - do not migrate .github/workflows/publish.yml yet; do not publish real
        packages to npm registry; do not weaken PR-only gate
    acceptance:
      - fixture at tests/fixtures/release-hygiene-consumer/ includes sample
        package.json changelog and adopted stage workflow; tests assert chooser
        plan on fixture, refuse ship when Action missing without explicit
        GH-only opt-out, and save-and-push contract still refuses default push
        language; no network publish required
    verifier:
      kind: shell
      command: node --test tests/release-fixture.test.js
    outputs:
      - kind: file
        path: tests/fixtures/release-hygiene-consumer/
      - kind: file
        path: tests/release-fixture.test.js
    closedAt: 2026-09-24T23:49:09.509Z
    evidence:
      verifierKind: shell
      exitCode: 0
      passed: true
      verifiedAt: 2026-09-24T23:49:09.509Z
      verifiedCommit: f58f49c29700b16962d1f45a205842521af33b12
      outputSummary: node --test tests/release-fixture.test.js exit 0
  - id: T-007
    title: Migrate Atomic Skills publish.yml to npm stage
    status: done
    lastUpdated: 2026-09-24T23:49:09.509Z
    scopeBoundary:
      - do not reintroduce Bypass 2FA tokens; do not change installer journal
        effects; do not skip fixture gate — this task assumes T-006 green
    acceptance:
      - publish.yml stages with npm stage publish under OIDC (no NODE_AUTH_TOKEN
        publish happy path); docs/kb/release-npm-stage.md documents Trusted
        Publisher stage-only and human stage approve; CHANGELOG notes the
        process change under Unreleased or the release section being cut
    verifier:
      kind: shell
      command: "rg -q 'stage publish' .github/workflows/publish.yml && ! rg -q
        '^\\\\s+- run: npm publish' .github/workflows/publish.yml && test -f
        docs/kb/release-npm-stage.md && rg -q 'stage approve|Trusted Publisher'
        docs/kb/release-npm-stage.md"
    outputs:
      - kind: file
        path: .github/workflows/publish.yml
      - kind: file
        path: docs/kb/release-npm-stage.md
      - kind: file
        path: CHANGELOG.md
    closedAt: 2026-09-24T23:49:09.509Z
    evidence:
      verifierKind: shell
      exitCode: 0
      passed: true
      verifiedAt: 2026-09-24T23:49:09.509Z
      verifiedCommit: f58f49c29700b16962d1f45a205842521af33b12
      outputSummary: rg stage publish + docs/kb/release-npm-stage.md exit 0
  - id: T-008
    title: Catalog what_is_not reframe + skill docs sync
    status: done
    lastUpdated: 2026-09-24T23:49:09.509Z
    scopeBoundary:
      - do not claim AS replaces git workflow; do not remove host-tier honesty
        lines; do not change install primary command
    acceptance:
      - product.what_is_not still says AS is not a git workflow replacement AND
        clarifies persistence/release skills impose agent gates (PR-only,
        stage+2FA, chooser); release and save-and-push docs mention the shared
        contract; catalog-product-boundary test asserts both clauses;
        generate/check docs path stays green if required by repo scripts
    verifier:
      kind: shell
      command: node --test tests/catalog-product-boundary.test.js && npm run
        validate-skills
    outputs:
      - kind: file
        path: meta/catalog.yaml
      - kind: file
        path: README.md
      - kind: file
        path: docs/skills/save-and-push.md
      - kind: file
        path: docs/skills/release.md
      - kind: file
        path: tests/catalog-product-boundary.test.js
    closedAt: 2026-09-24T23:49:09.509Z
    evidence:
      verifierKind: shell
      exitCode: 0
      passed: true
      verifiedAt: 2026-09-24T23:49:09.509Z
      verifiedCommit: f58f49c29700b16962d1f45a205842521af33b12
      outputSummary: node --test tests/catalog-product-boundary.test.js && npm run
        validate-skills exit 0
parked: []
emerged: []
businessIntent:
  value: Fixture prova o contrato de release no consumer; AS dogfood migra
    publish.yml para stage; catalog what_is_not esclarece gates de agente sem
    reivindicar git workflow.
  workflow: 1) Fixture hygiene-consumer + release-fixture tests. 2) Migrar
    publish.yml AS para npm stage publish + docs/kb runbook. 3) Reframe
    what_is_not + sync docs; catalog-product-boundary test.
  rules: Fixture em tests/fixtures/release-hygiene-consumer/ (nao
    release-consumer/blackbox). Nao publicar pacotes reais. PR-only permanece.
    Stage+2FA; sem Bypass 2FA. what_is_not mantem nao-e-git-workflow E
    acrescenta agent gates.
  outOfScope: Enfraquecer PR-only; reinstalar NODE_AUTH_TOKEN publish feliz; mudar
    install primary; claim AS substitui git workflow.
  doneWhen: tests/release-fixture.test.js verde; publish.yml tem stage publish e
    nao bare npm publish feliz; docs/kb/release-npm-stage.md;
    catalog-product-boundary verde; validate-skills 0.
planTitle: Release consistency — PR-only default branch + GH Release + npm stage
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F2 — Fixture dogfood + AS stage migration + catalog reframe**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

## Session handoff
- **Narrative:** F2 phase-done under automate. All plan phases F0–F2 done. Awaiting plan-end intent-vs-delivered / user validation.
- **Decision log:** F2 package same pattern as F0/F1; hygiene fixture path avoided blackbox collision.
- **Single nextAction:** Run plan-end review-code --mode=external-both (intent vs delivered) then operator userValidatedAt.
- **Verbatim state:** HEAD=71e46ace84bbfb19b3b6d5f803719cbdeee66cd1; all phases status done.
- **Uncommitted changes:** phase-done checkpoint pending.
