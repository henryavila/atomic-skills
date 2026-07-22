---
schemaVersion: "0.1"
slug: materialize-spec-quality-guards-f1-sidecar-fingerprint-material
title: Sidecar fingerprint + materialize-state refuse (P1)
goal: Hash live do tasks core do sidecar vs initiative; allowlist; refuse no
  publish; skill red-flag R3.
summary: Fingerprint do tasks core e refuse no materialize-state se divergir do sidecar
status: done
branch: plan/materialize-spec-quality-guards
started: 2026-07-22T10:50:57.793Z
lastUpdated: 2026-07-22T10:53:24.446Z
nextAction: Materialize F2 (SPEC smoke/overlap/age)
parentPlan: materialize-spec-quality-guards
phaseId: F1
businessIntent:
  value: Impedir materialize de publicar initiative cujo core SPEC divergiu do
    sidecar live, com refuse deterministico no materialize-state.
  workflow: Sidecar captura tasks core, materializePair hasheia sidecar vs
    initiative, recusa se divergir, permite so allowlist (summary weight
    businessIntent status).
  rules: Hash live do sidecar e autoridade; ausencia de campo tasksFingerprint nao
    recusa sozinha; title normalizado faz parte do core; fail closed no publish.
  outOfScope: Lint de qualidade da spine (F0), smoke de verifier no SPEC (F2) e
    analytics D9 (F3) nao sao entregues nesta fase F1.
  doneWhen: node --test tests/tasks-fingerprint.test.js e
    tests/materialize-state-fingerprint.test.js passam; publish com tasks
    reescritas exit nao-zero; docs citam fingerprint e re-spec.
tasksDone: 3
tasksTotal: 3
gatesMet: 2
gatesTotal: 2
exitGates:
  - id: F1-G1
    description: fingerprint unit tests and materialize-state fingerprint tests pass
    status: met
    verifier:
      kind: shell
      command: node --test tests/tasks-fingerprint.test.js
        tests/materialize-state-fingerprint.test.js
    metAt: 2026-07-22T10:53:24.446Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-22T10:53:24.446Z
      passed: true
      outputSummary: F1-G* verifiers
  - id: F1-G2
    description: skill and kb document refuse and re-spec path
    status: met
    verifier:
      kind: shell
      command: rg -n 'fingerprint|re-spec|tasks core'
        skills/shared/project-assets/project-materialize.md
        docs/kb/project-lazy-materialization.md
    metAt: 2026-07-22T10:53:24.446Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-22T10:53:24.446Z
      passed: true
      outputSummary: F1-G* verifiers
stack: []
tasks:
  - id: T-001
    title: Pure hash tasks core and allowlist
    status: done
    description: Pure hash tasks core and allowlist
    summary: Pure hash tasks core and allowlist
    weight: 2
    acceptance:
      - it - same core yields same hash; changing acceptance verifier files id
        or title changes hash.; it - allowlist-only field changes do not change
        hash.; it - legacy sidecar without tasksFingerprint field still compares
        via live hash.
    scopeBoundary:
      - Do not write project state outside tests. Do not include summary or
        weight in core. Title normalize is trim plus collapse whitespace.
    outputs:
      - kind: file
        path: src/tasks-fingerprint.js
      - kind: file
        path: tests/tasks-fingerprint.test.js
    verifier:
      kind: shell
      command: node --test tests/tasks-fingerprint.test.js
    lastUpdated: 2026-07-22T10:53:24.446Z
    closedAt: 2026-07-22T10:53:24.446Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-22T10:53:24.446Z
      passed: true
      outputSummary: F1 fingerprint tests pass + dogfood refuse
  - id: T-002
    title: Wire refuse in materialize-state
    status: done
    description: Wire refuse in materialize-state
    summary: Wire refuse in materialize-state
    weight: 2
    acceptance:
      - it - publish with rewritten tasks exits non-zero and does not rename
        live targets.; it - publish with only summary weight businessIntent
        changes exits 0.; it - integration test covers both cases.
    scopeBoundary:
      - Do not remove atomic rename or marker recovery. Do not refuse solely
        because tasksFingerprint field is absent on sidecar. Do not allow silent
        core rewrite.
    outputs:
      - kind: file
        path: scripts/materialize-state.js
      - kind: file
        path: tests/materialize-state-fingerprint.test.js
    verifier:
      kind: shell
      command: node --test tests/materialize-state-fingerprint.test.js
    lastUpdated: 2026-07-22T10:53:24.446Z
    closedAt: 2026-07-22T10:53:24.446Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-22T10:53:24.446Z
      passed: true
      outputSummary: F1 fingerprint tests pass + dogfood refuse
  - id: T-003
    title: Skill red-flag R3 and re-spec path docs
    status: done
    description: Skill red-flag R3 and re-spec path docs
    summary: Skill red-flag R3 and re-spec path docs
    weight: 2
    acceptance:
      - it - red flag stops rewrite-of-sidecar-tasks thought.; it - docs
        describe live hash adjudicator vs initiative core.; it - path to change
        SPEC is explicit without materialize side-effect.
    scopeBoundary:
      - Do not implement full re-spec CLI if decision is
        edit-source-plus-re-capture — document minimum path only. Do not
        auto-fix fingerprint mismatch.
    outputs:
      - kind: file
        path: skills/shared/project-assets/project-materialize.md
      - kind: file
        path: docs/kb/project-lazy-materialization.md
    verifier:
      kind: shell
      command: rg -n 'fingerprint|re-spec|tasks core'
        skills/shared/project-assets/project-materialize.md
        docs/kb/project-lazy-materialization.md
      expectExitCode: 0
    lastUpdated: 2026-07-22T10:53:24.446Z
    closedAt: 2026-07-22T10:53:24.446Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-22T10:53:24.446Z
      passed: true
      outputSummary: F1 fingerprint tests pass + dogfood refuse
parked: []
emerged: []
---
# Sidecar fingerprint + materialize-state refuse (P1)

Hash live do tasks core do sidecar vs initiative; allowlist; refuse no publish; skill red-flag R3.

## Session handoff
- **Narrative:** F1 done — fingerprint refuse in materialize-state dogfooded.
- **Decision log:** Live sidecar hash vs initiative core; allowlist excludes summary/weight.
- **Single nextAction:** Implement F2 verifier smoke + overlap + sidecar-age.
- **Verbatim state:** `node --test tests/tasks-fingerprint.test.js tests/materialize-state-fingerprint.test.js` 11/11.
- **Uncommitted changes:** clean after checkpoint.

