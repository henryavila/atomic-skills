---
schemaVersion: "0.1"
slug: automate-skill-discipline
title: Automate skill discipline remediation
version: "1.0"
status: active
started: 2026-07-21T19:25:48.389Z
branch: plan/automate-skill-discipline
executionMode: automate
currentPhase: F1
parallelismAllowed: false
principles:
  - id: P1
    title: Keep pure-maestro law
    body: Session never edits product source under automate; code-only writer; never silent Mode-1; never self-certify. This plan hardens enforcement; it does not relax P2/P3 from implementation-automate-mode.
  - id: P2
    title: Opt-in stamp only
    body: "Non-automate Mode 1 / Mode 2 defaults stay byte-identical. All hard gates key off durable `executionMode: automate` (or explicit automate session where design says so)."
  - id: P3
    title: Fail closed over looks-done
    body: Missing assert, missing claim, forged evaluation, or wrong maestro step blocks advance; never soft-continue.
  - id: P4
    title: No second skill
    body: No top-level `skills/core/automate.md`. Extend implement + transitions + scripts + schema.
  - id: P5
    title: No Layer 4 daemon
    body: No multi-host spawn supervisor. Thin status cursor only. Host-local runner (realism Layer 3) is out of scope unless a later plan.
  - id: P6
    title: Operator authority
    body: Materialize spine, phase advance after phase-done, and finalize userValidation stay human; automate must not invent businessIntent or auto-archive.
glossary:
  - term: assert-automate-gate
    definition: CLI that reads disk state, runs pure gate predicates, prints ok/blocked, exit 1 on block.
  - term: evaluation authenticity
    definition: evaluationGate accepted only with real evaluationReport pointer (passed) or operatorSkip+reason (skipped).
  - term: claim-bound done
    definition: under durable automate, task close requires validated claim report + reachability (+ complex both when required).
  - term: maestro cursor
    definition: durable step pointer for pure-maestro A–I / pause state per plan slug.
  - term: awaiting-operator-advance
    definition: post phase-done pause until operator re-enters implement/continue.
phases:
  - id: F0
    slug: automate-skill-discipline-f0-assert-cli-and-skill-call-sites-r1
    title: Assert CLI and skill call sites (R1)
    goal: Land `scripts/assert-automate-gate.js` reusing Layer-1 helpers, unit/integration tests, and skill prose that hard-requires assert before spawn, done-batch, phase-done, and finalize under automate.
    dependsOn: []
    subPhaseCount: 2
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F0-G1
          description: assert-automate-gate tests pass and script is executable via node.
          status: met
          verifier:
            kind: shell
            command: node --test tests/assert-automate-gate.test.js && node scripts/assert-automate-gate.js --help >/dev/null 2>&1 || node scripts/assert-automate-gate.js 2>&1 | head -5
            expectExitCode: 0
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-21T19:41:19.000Z
            verifiedCommit: 42ed863f4cccf2e0e92d0362bcc3bbfbc9d03817
            passed: true
            exitCode: 0
            outputSummary: |2-
                  ✔ exit 0 when non-automate (64.030208ms)
                ✔ finalize (192.175875ms)
                ✔ resolves nested project/slug and --project filter (127.086958ms)
              ✔ assert-automate-gate CLI (1335.547875ms)
              ℹ tests 16
              ℹ suites 5
              ℹ pass 16
              ℹ fail 0
              ℹ cancelled 0
              ℹ skipped 0
              ℹ todo 0
              ℹ duration_ms 1369.239
          metAt: 2026-07-21T19:41:19.000Z
        - id: F0-G2
          description: Skill assets require assert-automate-gate under automate; no top-level automate skill.
          status: met
          verifier:
            kind: shell
            command: test ! -e skills/core/automate.md && rg -n 'assert-automate-gate' skills/core/implement.md skills/shared/implement-automate-maestro.md
            expectExitCode: 0
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-21T19:41:19.000Z
            verifiedCommit: 42ed863f4cccf2e0e92d0362bcc3bbfbc9d03817
            passed: true
            exitCode: 0
            outputSummary: assert-automate-gate greps ok; no automate.md
          metAt: 2026-07-21T19:41:19.000Z
    status: done
    businessIntent:
      value: "Automate pure-maestro deixa de depender so de disciplina do modelo no miolo A-E e na autenticidade de F: assert CLI, evaluation autentica, claim-bound done, cursor fino e pause entre fases falham fechado."
      workflow: "TDD: assert CLI e helpers primeiro (F0), schema authenticity evaluation (F1), claim-bound done (F2), cursor (F3), pause+framing (F4); cada fase com exit gate shell."
      rules: Nao criar skills/core/automate.md; nao Layer 4 daemon; nao auto-materialize; non-automate byte-identical; fail closed over looks-done.
      outOfScope: Spawn supervisor multi-host; runner Layer 3 wait-loop; mudanca de Mode 2 codex lane; auto-finalize.
      doneWhen: assert-automate-gate testes verdes e prosa exige assert antes de spawn/done/phase-done/finalize; F0-G1 e F0-G2 met.
    evaluationGate:
      status: passed
      verdict: pass
      at: 42ed863f4cccf2e0e92d0362bcc3bbfbc9d03817
      verifiedAt: 2026-07-21T19:41:19.159Z
    reviewGate:
      status: passed
      mode: local
      at: 42ed863f4cccf2e0e92d0362bcc3bbfbc9d03817
      reviewFile: .atomic-skills/reviews/2026-07-21-automate-skill-discipline-f0-local.md
      verifiedAt: 2026-07-21T19:42:17.011Z
      reason: explicit local override for F0 dogfood (automate default both); nits only; external at plan-end
  - id: F1
    slug: automate-skill-discipline-f1-evaluationgate-authenticity-r3
    title: evaluationGate authenticity (R3)
    goal: "Make evaluationGate forge-resistant: passed requires evaluationReport path on disk; skipped requires operatorSkip + non-empty reason; GATE-R4 and phaseEvaluationAllowsClose share one honesty definition; buildEvaluationGate and skill evaluator asset updated."
    dependsOn:
      - F0
    subPhaseCount: 2
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F1-G1
          description: Authenticity unit tests and GATE-R4 path pass.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/phase-evaluation-gate.test.js tests/validate-state-evaluation-gate.test.js
            expectExitCode: 0
        - id: F1-G2
          description: Prose forbids forge and documents reportPath/operatorSkip.
          status: pending
          verifier:
            kind: shell
            command: rg -n 'reportPath|operatorSkip' skills/shared/implement-phase-evaluator.md skills/shared/implement-automate-maestro.md && rg -n 'forging evaluationGate|operatorSkip' skills/shared/implement-antipatterns.md
            expectExitCode: 0
    status: active
    businessIntent:
      value: "evaluationGate deixa de aceitar forge: passed exige evaluationReport no disco; skipped so com operatorSkip+reason; GATE-R4 e phaseEvaluationAllowsClose usam a mesma honesty — pure-maestro Step F vira fail-closed de verdade."
      workflow: TDD schema+helpers (T-003) depois prosa/buildEvaluationGate (T-004); validate-state e phase-evaluation-gate compartilham predicado; sem auto-run do evaluation agent.
      rules: Nao exigir evaluationGate em planos non-automate; nao mudar planEndReview; nao Layer 4; campos additive reportPath/operatorSkip; skipped so com operatorSkip true + reason nao-vazio.
      outOfScope: claim-bound done (F2); maestro cursor (F3); pause entre fases (F4); auto-finalize; evaluation agent que escreve state.
      doneWhen: Testes phase-evaluation-gate + validate-state-evaluation-gate verdes; prosa reportPath/operatorSkip e antipattern forge; F1-G1/F1-G2 met.
  - id: F2
    slug: automate-skill-discipline-f2-claim-bound-done-and-complex-both
    title: Claim-bound done and complex both under automate (R4 + P0-3)
    goal: Under durable automate stamp, task close refuses missing/invalid claims, failed reachability, and complex tasks without both-mode review clear; assert --gate done shares the predicate; Mode 1 unstamped unchanged.
    dependsOn:
      - F1
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F2-G1
          description: Claim-bound and complex gate unit tests pass.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/automate-orchestrator-gates.test.js tests/claim-report.test.js tests/complex-task.test.js tests/assert-automate-gate.test.js
            expectExitCode: 0
        - id: F2-G2
          description: Maestro and transitions document claim-bound done under automate stamp.
          status: pending
          verifier:
            kind: shell
            command: rg -n 'claim-bound|canCloseTasksFromClaims|reachability' skills/shared/implement-automate-maestro.md skills/shared/project-assets/project-transitions.md
            expectExitCode: 0
    status: pending
  - id: F3
    slug: automate-skill-discipline-f3-thin-maestro-step-cursor-r2
    title: Thin maestro step cursor (R2)
    goal: Durable per-plan maestro cursor records step/phase/redispatch; assert and skill refuse actions that skip steps; no multi-host spawn supervisor.
    dependsOn:
      - F2
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F3-G1
          description: Maestro cursor unit tests pass.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/maestro-cursor.test.js
            expectExitCode: 0
        - id: F3-G2
          description: Assert + skill reference cursor anti-skip.
          status: pending
          verifier:
            kind: shell
            command: rg -n 'maestro-cursor|cursor' scripts/assert-automate-gate.js skills/shared/implement-automate-maestro.md
            expectExitCode: 0
    status: pending
  - id: F4
    slug: automate-skill-discipline-f4-phase-pause-framing-and-residual-d
    title: Phase pause, framing, and residual discipline (R5 + P1)
    goal: After phase-done under automate, block next-phase spawn until operator continue; branch Mindset Mode-1 vs Automate; close residual antipatterns; view surfaces pause/plan-end if cheap.
    dependsOn:
      - F3
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F4-G1
          description: Pause and framing greps plus cursor/assert tests pass.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/maestro-cursor.test.js tests/assert-automate-gate.test.js && rg -n 'awaiting-operator-advance' skills/core/implement.md skills/shared/implement-automate-maestro.md && rg -n 'pure maestro|execution driver' skills/core/implement.md
            expectExitCode: 0
        - id: F4-G2
          description: No top-level automate skill; validate-state still green on fixture plans used in tests.
          status: pending
          verifier:
            kind: shell
            command: test ! -e skills/core/automate.md && node --test tests/phase-evaluation-gate.test.js tests/assert-automate-gate.test.js
            expectExitCode: 0
    status: pending
references: []
planActive: true
planTitle: Automate skill discipline remediation
lastUpdated: 2026-07-21T19:52:11.625Z
---

# Automate skill discipline remediation

## 1. Context

Close the audit gaps so `implement --mode=automate` **fails closed** when the host would skip pure-maestro steps, forge evaluation, silent-Mode-1 code, or auto-run phases — without building a Layer 4 multi-host daemon. Order: assert CLI (R1) → evaluation authenticity (R3) → claim-bound done (R4) → thin step cursor (R2) → phase pause + framing (R5).

## 2. Inviolable principles

- **P1 Keep pure-maestro law** — Session never edits product source under automate; code-only writer; never silent Mode-1; never self-certify. This plan hardens enforcement; it does not relax P2/P3 from implementation-automate-mode.
- **P2 Opt-in stamp only** — Non-automate Mode 1 / Mode 2 defaults stay byte-identical. All hard gates key off durable `executionMode: automate` (or explicit automate session where design says so).
- **P3 Fail closed over looks-done** — Missing assert, missing claim, forged evaluation, or wrong maestro step blocks advance; never soft-continue.
- **P4 No second skill** — No top-level `skills/core/automate.md`. Extend implement + transitions + scripts + schema.
- **P5 No Layer 4 daemon** — No multi-host spawn supervisor. Thin status cursor only. Host-local runner (realism Layer 3) is out of scope unless a later plan.
- **P6 Operator authority** — Materialize spine, phase advance after phase-done, and finalize userValidation stay human; automate must not invent businessIntent or auto-archive.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_
