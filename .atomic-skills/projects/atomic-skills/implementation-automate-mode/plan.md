---
schemaVersion: "0.1"
slug: implementation-automate-mode
title: Implementation Automate Mode
version: "1.0"
status: active
started: 2026-07-17T19:06:43.463Z
lastUpdated: 2026-07-17T19:33:38.837Z
branch: plan/implementation-automate-mode
currentPhase: F4
parallelismAllowed: false
principles:
  - id: P1
    title: Opt-in only
    body: Automate never becomes the default implement path. Absent `--mode=automate` (or an explicit plan stamp), Mode 1/Mode 2 behavior is byte-identical for review policy and who writes code.
  - id: P2
    title: Pure maestro
    body: In automate mode the host session never edits product source. It re-dispatches fix agents when verifiers or blocker/critical reviews fail; it does not silently become Mode 1.
  - id: P3
    title: Code-only phase writer
    body: The phase agent may orient, code, pre-close self-check, and make explicit-path implementation microcommits. It must not invoke `done`, `phase-done`, handoff mutation, or any durable `.atomic-skills/` write. The orchestrator is the sole closer (never self-certify).
  - id: P4
    title: One writer per tree per window
    body: At most one writer process on a given worktree at a time. Orchestrator sync-waits for the phase writer. Phase isolation uses a sibling worktree from the git common-dir (never nested under the plan worktree).
  - id: P5
    title: Review cadence is mode-scoped
    body: "Under automate: phase-done defaults to `--mode=both`; complex tasks use `--mode=both` before `done`; plan-end uses `external-both` + `planEndReviewOk`. Non-automate keeps the DESTRUCTIVE-only ladder in phase-done."
  - id: P6
    title: Evaluate then user-validate
    body: Each phase gets a fresh evaluation agent after the writer; decisions are logged for the user; finalize and archive only after explicit user validation of implementation and decisions.
glossary:
  - term: automate mode
    definition: "Opt-in implement execution mode: session orchestrates; one code-only writer agent per phase; forced cross-model review policy."
  - term: phase writer
    definition: "Foreign executor for one phase: code-only subset of the implement loop; returns claim reports; never closes tasks in project state."
  - term: claim report
    definition: "Per-task payload from the phase writer: task id, commit SHAs, paths touched, verifier command + exit transcript."
  - term: complex task
    definition: Task with weight greater than or equal to threshold (default 3), or tags intersecting destructive/decommission/drop/complex, or DESTRUCTIVE signal true on its implementation range.
  - term: planEndReviewOk
    definition: "Machine predicate: plan-end review receipt exists AND (at least one succeeded family-different external leg OR recorded `--skip-plan-end-review` with non-empty reason)."
phases:
  - id: F0
    slug: implementation-automate-mode-f0-foundation-mode-parse-and-pure
    title: "Foundation: mode parse and pure predicates"
    goal: Land pure, unit-tested helpers for automate mode detection, complex-task classification, and planEndReviewOk so skill prose and transitions share one definition.
    dependsOn: []
    subPhaseCount: 3
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F0-G1
          description: Unit tests for implement-mode, complex-task, and plan-end-review all pass.
          status: met
          verifier:
            kind: shell
            command: node --test tests/implement-mode.test.js tests/complex-task.test.js tests/plan-end-review.test.js
            expectExitCode: 0
          metAt: 2026-07-17T19:20:22.000Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-17T19:20:22.000Z
            verifiedCommit: 8d27f374d8dc02ca75ed600f418bf215e2a06672
            passed: true
            exitCode: 0
            outputSummary: "  ✔ false for non-ISO / invalid timestamps under automate (0.102666ms)   ✔ true only with non-empty ISO timestamp under automate (0.059375ms)   ✔ optional validatorId does not alone satisfy the gate (0.034875ms) ✔ userValidationOk (0.454792ms) ℹ tests 45 ℹ suites 5 ℹ pass 45 ℹ fail 0 ℹ cancelled 0 ℹ skipped 0 ℹ todo 0 ℹ duration_ms 40.515708"
        - id: F0-G2
          description: Helpers are pure modules importable without side effects on import.
          status: met
          verifier:
            kind: shell
            command: node -e "import('./src/implement-mode.js'); import('./src/complex-task.js'); import('./src/plan-end-review.js');"
            expectExitCode: 0
          metAt: 2026-07-17T19:20:22.000Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-17T19:20:22.000Z
            verifiedCommit: 8d27f374d8dc02ca75ed600f418bf215e2a06672
            passed: true
            exitCode: 0
            outputSummary: import ok
    status: done
    businessIntent:
      value: "Helpers puros sao a unica fonte da verdade do modo: mode parse, isComplexTask, planEndReviewOk e userValidationOk compartilhados por implement/transitions/finalize."
      workflow: "TDD helpers: testes RED, implementar src/implement-mode.js, complex-task.js, plan-end-review.js; F1+ consome os helpers."
      rules: Helpers puros sem I/O de rede; automate off por default; nao tocar Mode 2 lane.
      outOfScope: Prosa completa phase-done/finalize e spawn real (F1+); Mode 2 changes; auto-finalize.
      doneWhen: Suites implement-mode, complex-task e plan-end-review verdes; F0-G1/F0-G2 met.
    summary: "Helpers puros: mode parse, isComplexTask, planEndReviewOk e userValidationOk."
  - id: F1
    slug: implementation-automate-mode-f1-implement-maestro-loop-and-phas
    title: Implement maestro loop and phase-writer contract
    goal: "Extend implement so --mode=automate runs the pure-maestro loop: one code-only phase writer per phase, sync wait, claim handling, orchestrator-owned done, no silent Mode-1 fallback."
    dependsOn:
      - F0
    subPhaseCount: 4
    exitGate:
      summary: 3 criteria to meet
      criteria:
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
            outputSummary: "orchestrator re-run exit 0 after merge F1: F1-G1"
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
            outputSummary: "orchestrator re-run exit 0 after merge F1: F1-G2"
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
            outputSummary: "orchestrator re-run exit 0 after merge F1: F1-G3"
    status: done
    summary: "Implement maestro: writer code-only, evaluator, sibling isolation, lease, merge-before-done."
    businessIntent:
      value: "Maestro puro sob --mode=automate: session nao edita product source; um phase-writer code-only por fase; orchestrator fecha done."
      workflow: Documentar implement maestro + phase-writer asset + lease/isolation + evaluator; TDD writer-lease helper.
      rules: P2 pure maestro; P3 code-only writer; P4 one writer; sem Mode-1 silent fallback; sem nest worktree.
      outOfScope: phase-done review policy (F2); plan-end finalize (F3); full contract tests (F4).
      doneWhen: F1-G1/G2/G3 met; implement + phase-writer + evaluator assets exist.
  - id: F2
    slug: implementation-automate-mode-f2-review-policy-phase-done-and-co
    title: "Review policy: phase-done and complex tasks under automate"
    goal: Wire automate-aware review policy so phase-done defaults to both, and complex tasks run review-code --mode=both before orchestrator done.
    dependsOn:
      - F1
    subPhaseCount: 3
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F2-G1
          description: Automate phase review mode matrix is unit-tested.
          status: met
          verifier:
            kind: shell
            command: node --test tests/project-transitions-automate.test.js
            expectExitCode: 0
          metAt: 2026-07-17T19:29:38.000Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-17T19:29:38.000Z
            verifiedCommit: 18d5b03d5fdd20cdf32f7ff8cc030a91d98f0b6e
            passed: true
            exitCode: 0
            outputSummary: "orch re-run: F2-G1"
        - id: F2-G2
          description: implement documents complex-task both review before done.
          status: met
          verifier:
            kind: shell
            command: rg -n 'complex' skills/core/implement.md | rg -n 'both|review-code'
            expectExitCode: 0
          metAt: 2026-07-17T19:29:38.000Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-17T19:29:38.000Z
            verifiedCommit: 18d5b03d5fdd20cdf32f7ff8cc030a91d98f0b6e
            passed: true
            exitCode: 0
            outputSummary: "orch re-run: F2-G2"
    status: done
    summary: "Review policy: phase/complex both; executionMode stamp obrigatório."
    businessIntent:
      value: "Review policy sob automate: phase-done defaults to both; complex tasks review-code both before done; executionMode stamp obrigatorio."
      workflow: Wire project-transitions automate matrix + unit tests; document complex-task both in implement.md.
      rules: P5 mode-scoped review cadence; non-automate keeps DESTRUCTIVE-only ladder; stamp executionMode after first automate entry.
      outOfScope: plan-end external-both (F3); full contract suite (F4).
      doneWhen: project-transitions-automate tests green; implement documents complex both review.
  - id: F3
    slug: implementation-automate-mode-f3-plan-end-external-both-and-fina
    title: Plan-end external-both and finalize hard gate
    goal: Finalize and archive under automate require external-both receipt satisfying planEndReviewOk; missing success without skip hard-blocks.
    dependsOn:
      - F2
    subPhaseCount: 2
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F3-G1
          description: planEndReviewOk unit tests pass and finalize documents the hard-block.
          status: met
          verifier:
            kind: shell
            command: node --test tests/plan-end-review.test.js && rg -n 'planEndReviewOk' skills/shared/project-assets/project-finalize.md
            expectExitCode: 0
          metAt: 2026-07-17T19:33:38.000Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-17T19:33:38.000Z
            verifiedCommit: ec0d8de06ae2c098ca748a9e86267b318892ec06
            passed: true
            exitCode: 0
            outputSummary: "orch: F3-G1"
        - id: F3-G2
          description: skip-plan-end-review requires non-empty reason in documented contract.
          status: met
          verifier:
            kind: shell
            command: rg -n 'skip-plan-end-review' skills/shared/project-assets/project-finalize.md
            expectExitCode: 0
          metAt: 2026-07-17T19:33:38.000Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-17T19:33:38.000Z
            verifiedCommit: ec0d8de06ae2c098ca748a9e86267b318892ec06
            passed: true
            exitCode: 0
            outputSummary: "orch: F3-G2"
    status: done
    summary: Finalize/archive hard-block planEndReviewOk + userValidationOk.
    businessIntent:
      value: Finalize/archive sob automate exigem planEndReviewOk e userValidationOk.
      workflow: Wire finalize hard-block + skip-plan-end-review reason; unit tests plan-end-review.
      rules: HARD-BLOCK without receipt success or skip reason; archive same gate.
      outOfScope: F4 contract tests/docs only after F3.
      doneWhen: planEndReviewOk tests + finalize docs hard-block + skip reason.
  - id: F4
    slug: implementation-automate-mode-f4-integration-tests-install-surfa
    title: Integration tests, install surface, and dogfood
    goal: Lock the mode with tests that exercise prose contracts and helper wiring; document the mode for operators; keep install/catalog consistent.
    dependsOn:
      - F3
    subPhaseCount: 3
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F4-G1
          description: implement-automate contract tests and full npm test pass.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/implement-automate-contract.test.js && npm test
            expectExitCode: 0
        - id: F4-G2
          description: validate-skills exits 0 after catalog or docs touch.
          status: pending
          verifier:
            kind: shell
            command: node scripts/validate-skills.js
            expectExitCode: 0
    status: active
    summary: Contract tests, docs/catálogo e suite completa verde.
    businessIntent:
      value: Contract tests, docs/catalog e suite completa verde para automate mode.
      workflow: implement-automate-contract tests + docs + validate-skills + npm test.
      rules: No new top-level automate skill; catalog consistent; dogfood notes ok.
      outOfScope: New product features beyond automate surface.
      doneWhen: contract tests + npm test + validate-skills green.
references: []
---

# Implementation Automate Mode

## 1. Context

Add an opt-in `implement --mode=automate` path where the host session is a pure maestro (dispatch, re-verify, review, close state), one code-only phase writer agent implements each phase serially under the single-writer iron law, CROSS-MODEL REVIEW runs on every phase and on complex tasks, and plan-end finalize requires `external-both` with a machine-checkable `planEndReviewOk` predicate. Mode 1 and Mode 2 stay unchanged when automate is not selected.

## 2. Inviolable principles

- **P1 Opt-in only** — Automate never becomes the default implement path. Absent `--mode=automate` (or an explicit plan stamp), Mode 1/Mode 2 behavior is byte-identical for review policy and who writes code.
- **P2 Pure maestro** — In automate mode the host session never edits product source. It re-dispatches fix agents when verifiers or blocker/critical reviews fail; it does not silently become Mode 1.
- **P3 Code-only phase writer** — The phase agent may orient, code, pre-close self-check, and make explicit-path implementation microcommits. It must not invoke `done`, `phase-done`, handoff mutation, or any durable `.atomic-skills/` write. The orchestrator is the sole closer (never self-certify).
- **P4 One writer per tree per window** — At most one writer process on a given worktree at a time. Orchestrator sync-waits for the phase writer. Phase isolation uses a sibling worktree from the git common-dir (never nested under the plan worktree).
- **P5 Review cadence is mode-scoped** — Under automate: phase-done defaults to `--mode=both`; complex tasks use `--mode=both` before `done`; plan-end uses `external-both` + `planEndReviewOk`. Non-automate keeps the DESTRUCTIVE-only ladder in phase-done.
- **P6 Evaluate then user-validate** — Each phase gets a fresh evaluation agent after the writer; decisions are logged for the user; finalize and archive only after explicit user validation of implementation and decisions.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_

## Self-review against code-quality gates

- G1 read-before-claim: applied — design/source cite live implement iron law, phase-done ladder, external-both
- G2 soft-language: applied — must/HARD-FAIL language for gates; optional stamp language removed for durability path
- G6 reference-or-strike: applied — SPEC tasks carry Files/scopeBoundary/acceptance/verifier

## Reviews

- internal: 2026-07-17 — receipt retained after rematerialize
- cross-model (codex gpt-5-codex): 2026-07-17 — needs_changes; 2 critical + 3 major applied (stamp order, P4 nested vs sibling, post-eval reopen, archive hard-block, claim ranges)
- cross-model (grok-4.5): 2026-07-17 — needs_changes; 5 critical + 3 major applied (isolation, archive, stamp must, userValidationOk helper, rematerialize sync, merge-before-done)
- artifacts: .atomic-skills/reviews/2026-07-17-1902-iam-codex-pass1.md , .atomic-skills/reviews/2026-07-17-1902-iam-grok-pass1.md
