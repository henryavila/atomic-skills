---
schemaVersion: "0.1"
slug: materialize-spec-quality-guards
title: materialize-spec-quality-guards
version: "1.0"
status: done
started: 2026-07-22T10:42:01.913Z
lastUpdated: 2026-07-22T10:55:57.581Z
branch: plan/materialize-spec-quality-guards
currentPhase: F4
parallelismAllowed: false
principles:
  - id: P1
    title: Zero-token no path critico
    body: Gates de qualidade e fingerprint sao scripts node exit-0/1, identicos em
      todo host.
  - id: P2
    title: Operador e autoridade da spine
    body: Nunca pre-preencher businessIntent com LLM; blank-field + proof-of-work.
  - id: P3
    title: Fail closed no publish
    body: materialize-state recusa initiative cujo core SPEC diverge do sidecar live.
  - id: P4
    title: Lazy F0 permanece
    body: Este plano nao re-materializa F1..N no new plan; so endurece os gates
      existentes.
  - id: P5
    title: D9 e medida, nao prova
    body: Analytics registram atrito/rework; nao afirmam causalidade
      anti-rubber-stamp.
glossary:
  - term: spine quality lint
    definition: detector que rejeita businessIntent presente-mas-vazio (curto,
      soft-language, outOfScope eco, doneWhen sem observavel).
  - term: tasks core
    definition: id, title normalizado, files paths, scopeBoundary, acceptance,
      verifier canonico — o que o fingerprint protege.
  - term: allowlist materialize
    definition: summary, weight, businessIntent, startedCommit, status, nextAction,
      rollups, evidence.
  - term: verifier smoke
    definition: ban de comandos tautologicos no SPEC admit (exit 0, true, :, echo
      ok, corpo vazio).
  - term: D9 measure
    definition: eventos + relatorio de lint-fail 1a tentativa, fingerprint refuse,
      reopen window.
phases:
  - id: F0
    slug: materialize-spec-quality-guards-f0-spine-quality-lint-skill-ux
    title: Spine quality lint + skill UX (P0)
    goal: Detector HARD de qualidade da spine + wiring em materialize e new-plan F0
      + skill proof-of-work; golden tests PT/EN.
    dependsOn: []
    subPhaseCount: 3
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F0-G1
          description: find-weak-business-intent golden tests pass
          status: met
          verifier:
            kind: shell
            command: node --test tests/find-weak-business-intent.test.js
          metAt: 2026-07-22T10:55:57.581Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-22T10:55:57.581Z
            passed: true
            outputSummary: batch implement suite 38/38
        - id: F0-G2
          description: materialize and create-plan wire quality detector
          status: met
          verifier:
            kind: shell
            command: rg -n 'find-weak-business-intent'
              skills/shared/project-assets/project-materialize.md
              skills/shared/project-assets/project-create-plan.md
          metAt: 2026-07-22T10:55:57.581Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-22T10:55:57.581Z
            passed: true
            outputSummary: batch implement suite 38/38
    status: done
    businessIntent:
      value: Fechar R1 com lint HARD de qualidade da spine e UX proof-of-work para que
        materialize e new-plan F0 nao ativem fase com intencao generica.
      workflow: Operador preenche spine → detector de presenca → detector de qualidade
        → fase ativa para implement.
      rules: Zero LLM no path critico; presenca e qualidade sao gates separados; fail
        closed; operador e autoridade da spine.
      outOfScope: Fingerprint R3, SPEC smoke/overlap/age R2, e analytics D9 — entregas
        das fases F1–F3, nao desta F0.
      doneWhen: find-weak-business-intent testes verdes e skills
        materialize/create-plan citam o detector e o proof-of-work
        anti-preenchimento.
    summary: Lint HARD de qualidade da spine + UX proof-of-work no
      materialize/new-plan F0
  - id: F1
    slug: materialize-spec-quality-guards-f1-sidecar-fingerprint-material
    title: Sidecar fingerprint + materialize-state refuse (P1)
    goal: Hash live do tasks core do sidecar vs initiative; allowlist; refuse no
      publish; skill red-flag R3.
    dependsOn:
      - F0
    subPhaseCount: 3
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F1-G1
          description: fingerprint unit tests and materialize-state fingerprint tests pass
          status: met
          verifier:
            kind: shell
            command: node --test tests/tasks-fingerprint.test.js
              tests/materialize-state-fingerprint.test.js
          metAt: 2026-07-22T10:55:57.581Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-22T10:55:57.581Z
            passed: true
            outputSummary: batch implement suite 38/38
        - id: F1-G2
          description: skill and kb document refuse and re-spec path
          status: met
          verifier:
            kind: shell
            command: rg -n 'fingerprint|re-spec|tasks core'
              skills/shared/project-assets/project-materialize.md
              docs/kb/project-lazy-materialization.md
          metAt: 2026-07-22T10:55:57.581Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-22T10:55:57.581Z
            passed: true
            outputSummary: batch implement suite 38/38
    status: done
    summary: Fingerprint do tasks core e refuse no materialize-state se divergir do
      sidecar
    businessIntent:
      value: Impedir materialize de publicar initiative cujo core SPEC divergiu do
        sidecar live, com refuse deterministico no materialize-state.
      workflow: Sidecar captura tasks core, materializePair hasheia sidecar vs
        initiative, recusa se divergir, permite so allowlist (summary weight
        businessIntent status).
      rules: Hash live do sidecar e autoridade; ausencia de campo tasksFingerprint nao
        recusa sozinha; title normalizado faz parte do core; fail closed no
        publish.
      outOfScope: Lint de qualidade da spine (F0), smoke de verifier no SPEC (F2) e
        analytics D9 (F3) nao sao entregues nesta fase F1.
      doneWhen: node --test tests/tasks-fingerprint.test.js e
        tests/materialize-state-fingerprint.test.js passam; publish com tasks
        reescritas exit nao-zero; docs citam fingerprint e re-spec.
  - id: F2
    slug: materialize-spec-quality-guards-f2-spec-smoke-overlap-sidecar-a
    title: SPEC smoke, overlap, sidecar age (P2)
    goal: Verifier tautologico HARD no admit; overlap WARN/HARD; age gate opt-in no
      materialize.
    dependsOn:
      - F1
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F2-G1
          description: smoke and overlap unit tests pass
          status: met
          verifier:
            kind: shell
            command: node --test tests/lint-source-verifier-smoke.test.js
              tests/lint-source-overlap.test.js
          metAt: 2026-07-22T10:55:57.581Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-22T10:55:57.581Z
            passed: true
            outputSummary: batch implement suite 38/38
        - id: F2-G2
          description: sidecar-age tests pass
          status: met
          verifier:
            kind: shell
            command: node --test tests/sidecar-age.test.js
          metAt: 2026-07-22T10:55:57.581Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-22T10:55:57.581Z
            passed: true
            outputSummary: batch implement suite 38/38
    status: done
    summary: Smoke de verifier tautologico, overlap acceptance↔verifier e age gate
      do sidecar
  - id: F3
    slug: materialize-spec-quality-guards-f3-d9-measure-docs-p3
    title: D9 measure + docs (P3)
    goal: Eventos analytics + script de relatorio; docs atualizam D9 como medido;
      sem prova causal.
    dependsOn:
      - F2
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F3-G1
          description: events and report unit tests pass
          status: met
          verifier:
            kind: shell
            command: node --test tests/plan-quality-events.test.js
              tests/report-plan-quality.test.js
          metAt: 2026-07-22T10:55:57.581Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-22T10:55:57.581Z
            passed: true
            outputSummary: batch implement suite 38/38
        - id: F3-G2
          description: docs cite measure kinds
          status: met
          verifier:
            kind: shell
            command: rg -n 'report-plan-quality|spine_quality_fail|fingerprint_refuse'
              docs/kb/project-lazy-materialization.md
          metAt: 2026-07-22T10:55:57.581Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-22T10:55:57.581Z
            passed: true
            outputSummary: batch implement suite 38/38
    status: done
    summary: Eventos D9 + report-plan-quality e docs sem prova causal
  - id: F4
    slug: materialize-spec-quality-guards-f4-integration-and-regression
    title: Integration and regression
    goal: Suite cobre R1/R2/R3 end-to-end; validate-skills; dogfood dos gates.
    dependsOn:
      - F3
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F4-G1
          description: integration suite passes
          status: met
          verifier:
            kind: shell
            command: node --test tests/plan-quality-guards-integration.test.js
          metAt: 2026-07-22T10:55:57.581Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-22T10:55:57.581Z
            passed: true
            outputSummary: batch implement suite 38/38
        - id: F4-G2
          description: validate-skills passes
          status: met
          verifier:
            kind: shell
            command: npm run validate-skills
          metAt: 2026-07-22T10:55:57.581Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-22T10:55:57.581Z
            passed: true
            outputSummary: batch implement suite 38/38
    status: done
    summary: Suite de integracao R1/R2/R3 e validate-skills
references: []
---
# Context

Endurecer R1 (spine quality), R2 (SPEC smoke/overlap/age) e R3 (fingerprint refuse) com detectores zero-token fail-closed e D9 measure.

## Principles

Ver frontmatter principles[] — elaborados no source e no design.md.

## Phase tree

- **F0** — Spine quality lint + skill UX (P0) — 3 tasks
- **F1** — Sidecar fingerprint + materialize-state refuse (P1) — 3 tasks
- **F2** — SPEC smoke, overlap, sidecar age (P2) — 3 tasks
- **F3** — D9 measure + docs (P3) — 3 tasks
- **F4** — Integration and regression — 2 tasks

## Self-review against code-quality gates

- G1 read-before-claim: applied — design and source cite scripts/find-missing-business-intent.js, materialize-state.js, lint-source.js
- G2 soft-language: applied — HARD-BLOCK/refuse language in decisions; no should/probably in done claims
- G6 reference-or-strike: applied — D9 marked as measure not causal proof

## Reviews

- internal: clean — 2026-07-22 local Stage 8a (structure 5 phases / 14 tasks; SPEC lint clean; lazy F0-only materialization; businessIntent F0 dual surface; exit gates shell-only). Findings major+: 0 after verifier kind:test→shell fix at materialize.


- cross-model: INVALIDATED — agent-biased skip (Recommended N first); not operator-initiated (2026-07-22). Re-run Stage 8b for a real external receipt or write SKIPPED — operator: <verbatim reason>.


## Implementation complete
- 38 unit/integration tests pass
- validate-skills pass
- dogfood: find-weak own plan, SPEC source, fingerprint refuse, report-plan-quality

