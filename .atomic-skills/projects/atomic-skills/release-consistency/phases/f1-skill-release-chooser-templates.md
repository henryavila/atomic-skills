---
schemaVersion: "0.1"
slug: release-consistency-f1-skill-release-chooser-templates
title: Skill release + chooser + templates
goal: Skill core `release` orquestra plan/apply/ship; scripts determinísticos no
  pacote; templates stage e GH-only versionados sob release-assets; adopt/init
  com MUST check+diff+consent; dual-mode D4 enforced. Sem migrar publish.yml do
  AS ainda.
status: active
branch: plan/release-consistency
started: 2026-09-24T23:15:00.315Z
lastUpdated: 2026-09-24T23:25:59.930Z
nextAction: Run phase-done gates for F1 (evaluation → lessons → review → audit)
parentPlan: release-consistency
phaseId: F1
tasksDone: 3
tasksTotal: 3
gatesMet: 0
gatesTotal: 2
weightDone: 3
weightTotal: 3
exitGates:
  - id: G-F1-1
    description: FAILS when chooser allows inventing patch for feat or when release
      skill is missing from catalog
    status: pending
    verifier:
      kind: shell
      command: node --test tests/semver-bump.test.js tests/release-cli.test.js && rg
        -q '^  release:' meta/catalog.yaml && npm run validate-skills
    verifierLabel: "shell: node --test tests/semver-bump.test.js tests/release-cli.tes…"
  - id: G-F1-2
    description: FAILS when stage template still uses direct npm publish as happy
      path or adopt skips check/diff/consent
    status: pending
    verifier:
      kind: shell
      command: node --test tests/release-adopt.test.js
    verifierLabel: "shell: node --test tests/release-adopt.test.js"
stack:
  - id: 1
    title: Skill release + chooser + templates
    type: task
    openedAt: 2026-09-24T23:15:00.315Z
tasks:
  - id: T-003
    title: Chooser scripts plan/apply/ship
    status: done
    lastUpdated: 2026-09-24T23:25:59.930Z
    scopeBoundary:
      - do not edit skills/core/save-and-push.md; do not migrate
        .github/workflows/publish.yml; do not write into consumer repos from
        installer; do not auto bump to 1.0.0 on 0.x breaking
    acceptance:
      - classifyBump maps feat/Added/Changed to minor, fix/Fixed-only to patch,
        0.x breaking to minor; plan prints next version; apply rewrites
        package.json version and CHANGELOG Unreleased when present; ship refuses
        when kind is none or when npm version already published; tests cover
        feature-forbids-patch gate
    verifier:
      kind: shell
      command: node --test tests/semver-bump.test.js tests/release-cli.test.js
    outputs:
      - kind: file
        path: scripts/release/semver-bump.js
      - kind: file
        path: scripts/release/release.js
      - kind: file
        path: tests/semver-bump.test.js
      - kind: file
        path: tests/release-cli.test.js
    closedAt: 2026-09-24T23:25:59.930Z
    evidence:
      verifierKind: shell
      exitCode: 0
      passed: true
      verifiedAt: 2026-09-24T23:25:59.930Z
      verifiedCommit: 2e6d7afc7fb5355c4faf27235161219d0681e845
      outputSummary: node --test tests/semver-bump.test.js tests/release-cli.test.js
        exit 0 on merged plan tree
  - id: T-004
    title: Release skill body + catalog entry
    status: done
    lastUpdated: 2026-09-24T23:25:59.930Z
    scopeBoundary:
      - do not migrate AS publish.yml; do not weaken save-and-push PR-only; do
        not add installer scaffolding of consumer .github
    acceptance:
      - release.md Iron Law forbids inventing bump; documents plan/apply/ship
        via scripts/release; documents dual-mode npm scope and stage-only
        Action; catalog lists release under core with iron_law; validate-skills
        exits 0; docs/skills/release.md generated or authored in sync
    verifier:
      kind: shell
      command: rg -q 'NO.*BUMP|não invent|never invent|chooser|semver-bump'
        skills/core/release.md && rg -q '^  release:' meta/catalog.yaml && npm
        run validate-skills
    outputs:
      - kind: file
        path: skills/core/release.md
      - kind: file
        path: meta/catalog.yaml
      - kind: file
        path: docs/skills/release.md
      - kind: file
        path: scripts/validate-skills.js
    closedAt: 2026-09-24T23:25:59.930Z
    evidence:
      verifierKind: shell
      exitCode: 0
      passed: true
      verifiedAt: 2026-09-24T23:25:59.930Z
      verifiedCommit: 2e6d7afc7fb5355c4faf27235161219d0681e845
      outputSummary: rg release.md + catalog + npm run validate-skills exit 0 on
        merged plan tree
  - id: T-005
    title: Templates stage + GH-only and adopt/init flow
    status: done
    lastUpdated: 2026-09-24T23:25:59.930Z
    scopeBoundary:
      - do not have installer reconcileFileSet write consumer workflows; do not
        remove uninstall parity tests; do not migrate live AS publish.yml in
        this task
    acceptance:
      - publish-stage.yml uses release published trigger, id-token write, and
        npm stage publish (not bare npm publish); adopt.md requires
        dry-run/--check with template pin, show diff, write only after consent;
        release.md points at adopt; test asserts stage template has stage
        publish and lacks unprotected npm publish as happy path
    verifier:
      kind: shell
      command: node --test tests/release-adopt.test.js
    outputs:
      - kind: file
        path: skills/shared/release-assets/templates/publish-stage.yml
      - kind: file
        path: skills/shared/release-assets/templates/publish-gh-only.yml
      - kind: file
        path: skills/shared/release-assets/adopt.md
      - kind: file
        path: skills/core/release.md
      - kind: file
        path: tests/release-adopt.test.js
    closedAt: 2026-09-24T23:25:59.930Z
    evidence:
      verifierKind: shell
      exitCode: 0
      passed: true
      verifiedAt: 2026-09-24T23:25:59.930Z
      verifiedCommit: 2e6d7afc7fb5355c4faf27235161219d0681e845
      outputSummary: node --test tests/release-adopt.test.js exit 0 on merged plan tree
parked: []
emerged: []
businessIntent:
  value: Agentes/operadores cortam release com bump determinístico (chooser) e
    templates stage/GH-only — sem inventar semver nem npm publish direto.
  workflow: 1) Scripts chooser plan/apply/ship + testes. 2) Skill release +
    entrada no catalog + docs. 3) Templates stage e GH-only + adopt/init com
    check+diff+consent; dual-mode D4 enforced.
  rules: "Chooser nao inventa bump (feat/Added/Changed→minor, fix→patch, 0.x
    breaking→minor). Dual-mode: sem npm→GH-only; npm sem Action stage→recusar
    ship npm e oferecer adopt. Adopt MUST --check+diff+consent. Installer nao
    escreve .github no consumer. Sem migrar publish.yml do AS nesta fase."
  outOfScope: Migrar .github/workflows/publish.yml do Atomic Skills; fixture
    dogfood F2; reframe product.what_is_not; auto-merge; Bypass 2FA tokens;
    enfraquecer PR-only do save-and-push.
  doneWhen: tests/semver-bump.test.js e tests/release-cli.test.js verdes; catalog
    lista release; validate-skills 0; tests/release-adopt.test.js verde; stage
    template usa npm stage publish (nao bare npm publish); adopt exige
    check/diff/consent.
planTitle: Release consistency — PR-only default branch + GH Release + npm stage
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F1 — Skill release + chooser + templates**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

## Session handoff
- **Narrative:** F1 materialized and ratified; Layer-3 prepare OK; code-only phase writer spawned on impl/release-consistency-F1-writer for T-003/T-004/T-005.
- **Decision log:** operator-continue after F0; F1 package ratified; BI spine on plan+initiative.
- **Single nextAction:** Sync-wait F1 writer; then validate claim report and merge.
- **Verbatim state:** sealedBrief=.atomic-skills/status/automate/release-consistency-F1-sealed-brief.md; writerWT=/Volumes/External/code/atomic-skills/.worktrees/release-consistency-F1-writer; baseRef=a065041e5914290f9e81019a3509cd292ef1af33.
- **Uncommitted changes:** prepare/lease/handoff checkpoint pending.
