# Automate skill discipline remediation

Close the audit gaps so `implement --mode=automate` **fails closed** when the host would skip pure-maestro steps, forge evaluation, silent-Mode-1 code, or auto-run phases — without building a Layer 4 multi-host daemon. Order: assert CLI (R1) → evaluation authenticity (R3) → claim-bound done (R4) → thin step cursor (R2) → phase pause + framing (R5).

## Inviolable principles

- **P1 Keep pure-maestro law** — Session never edits product source under automate; code-only writer; never silent Mode-1; never self-certify. This plan hardens enforcement; it does not relax P2/P3 from implementation-automate-mode.
- **P2 Opt-in stamp only** — Non-automate Mode 1 / Mode 2 defaults stay byte-identical. All hard gates key off durable `executionMode: automate` (or explicit automate session where design says so).
- **P3 Fail closed over looks-done** — Missing assert, missing claim, forged evaluation, or wrong maestro step blocks advance; never soft-continue.
- **P4 No second skill** — No top-level `skills/core/automate.md`. Extend implement + transitions + scripts + schema.
- **P5 No Layer 4 daemon** — No multi-host spawn supervisor. Thin status cursor only. Host-local runner (realism Layer 3) is out of scope unless a later plan.
- **P6 Operator authority** — Materialize spine, phase advance after phase-done, and finalize userValidation stay human; automate must not invent businessIntent or auto-archive.

## Glossary

- **assert-automate-gate** — CLI that reads disk state, runs pure gate predicates, prints ok/blocked, exit 1 on block.
- **evaluation authenticity** — evaluationGate accepted only with real evaluationReport pointer (passed) or operatorSkip+reason (skipped).
- **claim-bound done** — under durable automate, task close requires validated claim report + reachability (+ complex both when required).
- **maestro cursor** — durable step pointer for pure-maestro A–I / pause state per plan slug.
- **awaiting-operator-advance** — post phase-done pause until operator re-enters implement/continue.

## F0 — Assert CLI and skill call sites (R1)

Goal: Land `scripts/assert-automate-gate.js` reusing Layer-1 helpers, unit/integration tests, and skill prose that hard-requires assert before spawn, done-batch, phase-done, and finalize under automate.

### T-001 assert-automate-gate CLI pure gates

- Files: scripts/assert-automate-gate.js, tests/assert-automate-gate.test.js, package.json
- scopeBoundary: Do not spawn writers or run git merge. Do not change Mode 1 done path. Do not add a top-level automate skill. If the published package lists scripts via package.json files, include the new script path.
- acceptance: it - CLI accepts --plan and --gate with values spawn claims done phase-done finalize (aliases allowed if documented).; it - spawn gate returns exit 1 when lease status is blocking via canSpawnPhaseWriter semantics.; it - claims/done gate returns exit 1 when claim report missing or validateClaimReport fails when report path provided or required.; it - phase-done gate returns exit 1 under durable automate without evaluationGate that phaseEvaluationAllowsClose accepts.; it - finalize gate returns exit 1 when automatePlanEndGatesOk is false.; it - prints ok or blocked with reason on stdout/stderr and exit 0 only when ok.; it - unit tests cover matrix without network.
- verifier: { kind: shell, command: "node --test tests/assert-automate-gate.test.js", expectExitCode: 0 }
- RED→GREEN: Failing tests for gate matrix; implement CLI wrapping automate-orchestrator-gates / plan-end-review / writer-lease / claim-report until green.

### T-002 Skill prose requires assert before transitions

- Files: skills/core/implement.md, skills/shared/implement-automate-maestro.md, skills/shared/implement-antipatterns.md, skills/shared/project-assets/project-transitions.md, skills/shared/project-assets/project-finalize.md, docs/kb/automate-orchestrator-realism.md
- scopeBoundary: Do not implement evaluation authenticity schema yet (F1). Do not implement step cursor file yet (F3). Do not change non-automate review ladder defaults.
- acceptance: it - pure-maestro Steps C E G I (or table) require running assert-automate-gate (or documented equivalent node invocation) before spawn done-batch phase-done finalize.; it - HARD-GATE text forbids advancing when assert exits non-zero.; it - antipatterns include skipping assert and silent Mode-1 under stamp.; it - realism KB Layer 2 marked landed or in-progress with script path.; it - no skills/core/automate.md created.
- verifier: { kind: shell, command: "test ! -e skills/core/automate.md && rg -n 'assert-automate-gate' skills/core/implement.md skills/shared/implement-automate-maestro.md skills/shared/project-assets/project-transitions.md skills/shared/project-assets/project-finalize.md && rg -n 'assert-automate-gate|Layer 2' docs/kb/automate-orchestrator-realism.md", expectExitCode: 0 }
- RED→GREEN: Grep fails before prose; passes after links and HARD-GATE land.

```yaml
exit_gate:
  - id: F0-G1
    description: assert-automate-gate tests pass and script is executable via node.
    verifier: { kind: shell, command: "node --test tests/assert-automate-gate.test.js && node scripts/assert-automate-gate.js --help >/dev/null 2>&1 || node scripts/assert-automate-gate.js 2>&1 | head -5", expectExitCode: 0 }
  - id: F0-G2
    description: Skill assets require assert-automate-gate under automate; no top-level automate skill.
    verifier: { kind: shell, command: "test ! -e skills/core/automate.md && rg -n 'assert-automate-gate' skills/core/implement.md skills/shared/implement-automate-maestro.md", expectExitCode: 0 }
```

## F1 — evaluationGate authenticity (R3)

Goal: Make evaluationGate forge-resistant: passed requires evaluationReport path on disk; skipped requires operatorSkip + non-empty reason; GATE-R4 and phaseEvaluationAllowsClose share one honesty definition; buildEvaluationGate and skill evaluator asset updated.

### T-003 Schema and pure honesty for evaluation report pointer

- Files: meta/schemas/plan.schema.json, src/phase-evaluation-gate.js, tests/phase-evaluation-gate.test.js, scripts/validate-state.js, tests/validate-state-evaluation-gate.test.js
- scopeBoundary: Do not require evaluationGate on non-automate plans. Do not change planEndReview shape. Do not invent Layer 4. Prefer additive schema fields (reportPath, operatorSkip) with additionalProperties false updated carefully.
- acceptance: it - evaluationGate schema allows reportPath string and operatorSkip boolean with documented required-when rules.; it - phaseEvaluationAllowsClose rejects status passed without non-empty reportPath when authenticity flag or durable automate honesty mode is on (default on for automate).; it - rejects status skipped without operatorSkip true and non-empty reason.; it - accepts passed with reportPath and verdict pass and accepts skipped only with operatorSkip+reason.; it - GATE-R4 / checkEvaluationGate uses the same honesty helper (no divergent prose rules).; it - legacy retroactive skips remain expressible only via operatorSkip+reason (document migration note in test or comment).; it - unit tests cover forge cases.
- verifier: { kind: shell, command: "node --test tests/phase-evaluation-gate.test.js tests/validate-state-evaluation-gate.test.js", expectExitCode: 0 }
- RED→GREEN: RED tests for passed-without-reportPath and skipped-without-operatorSkip; implement until green; keep non-automate absent-gate OK.

### T-004 Evaluator asset and buildEvaluationGate write reportPath

- Files: src/phase-evaluation-gate.js, skills/shared/implement-phase-evaluator.md, skills/shared/implement-automate-maestro.md, skills/core/implement.md, skills/shared/implement-antipatterns.md
- scopeBoundary: Do not auto-run evaluation agent. Do not write product source from evaluator. Do not finalize on evaluation pass.
- acceptance: it - buildEvaluationGate for passed requires or records reportPath.; it - evaluator asset mandates writing evaluationReport under .atomic-skills/reviews/ (or documented path) before orchestrator stamps gate.; it - antipatterns ban forging evaluationGate passed without report and inventing skip without operator.; it - maestro Step F/G references authenticity rules.
- verifier: { kind: shell, command: "rg -n 'reportPath|operatorSkip|evaluationReport' src/phase-evaluation-gate.js skills/shared/implement-phase-evaluator.md skills/shared/implement-automate-maestro.md skills/shared/implement-antipatterns.md", expectExitCode: 0 }
- RED→GREEN: Grep fails until fields and antipatterns land.

```yaml
exit_gate:
  - id: F1-G1
    description: Authenticity unit tests and GATE-R4 path pass.
    verifier: { kind: shell, command: "node --test tests/phase-evaluation-gate.test.js tests/validate-state-evaluation-gate.test.js", expectExitCode: 0 }
  - id: F1-G2
    description: Prose forbids forge and documents reportPath/operatorSkip.
    verifier: { kind: shell, command: "rg -n 'reportPath|operatorSkip' skills/shared/implement-phase-evaluator.md skills/shared/implement-automate-maestro.md && rg -n 'forging evaluationGate|operatorSkip' skills/shared/implement-antipatterns.md", expectExitCode: 0 }
```

## F2 — Claim-bound done and complex both under automate (R4 + P0-3)

Goal: Under durable automate stamp, task close refuses missing/invalid claims, failed reachability, and complex tasks without both-mode review clear; assert --gate done shares the predicate; Mode 1 unstamped unchanged.

### T-005 Pure claim-bound and complex-before-done predicates

- Files: src/automate-orchestrator-gates.js, src/claim-report.js, src/complex-task.js, tests/automate-orchestrator-gates.test.js, tests/claim-report.test.js
- scopeBoundary: Do not change GATE-R2 verifier execution itself. Do not force complex both on non-automate. Do not spawn review-code.
- acceptance: it - canCloseTasksFromClaims (or new canDoneFromAutomateClaims) documents required claim report + optional reachability true by default for automate done.; it - helper for complex path requires isComplexTask result and a durable review receipt mode both (or skip with recorded operator disposition) before allow done.; it - non-complex allows verifier-only path.; it - unit tests cover missing claim, overlapping SHAs, non-reachable SHA, complex without receipt.
- verifier: { kind: shell, command: "node --test tests/automate-orchestrator-gates.test.js tests/claim-report.test.js tests/complex-task.test.js", expectExitCode: 0 }
- RED→GREEN: Extend gate tests RED then implement predicates.

### T-006 Wire done path and assert done gate under stamp

- Files: scripts/assert-automate-gate.js, skills/shared/project-assets/project-transitions.md, skills/shared/implement-automate-maestro.md, skills/core/implement.md, skills/shared/implement-phase-writer.md, tests/assert-automate-gate.test.js
- scopeBoundary: Do not require claim reports when plan has no executionMode automate. Do not let phase writer call done. Do not auto-merge worktrees in the assert script.
- acceptance: it - assert --gate done fails without valid claim when plan stamp is automate.; it - implement/maestro Step E requires assert done (or predicate) after reachability before each orchestrator done.; it - transitions done flow documents automate claim-bound HARD-GATE when stamp present.; it - tests cover stamp on vs off.
- verifier: { kind: shell, command: "node --test tests/assert-automate-gate.test.js && rg -n 'claim-bound|canCloseTasksFromClaims|assert-automate-gate.*done' skills/shared/implement-automate-maestro.md skills/core/implement.md skills/shared/project-assets/project-transitions.md", expectExitCode: 0 }
- RED→GREEN: Assert done tests fail until wired; prose greppable.

```yaml
exit_gate:
  - id: F2-G1
    description: Claim-bound and complex gate unit tests pass.
    verifier: { kind: shell, command: "node --test tests/automate-orchestrator-gates.test.js tests/claim-report.test.js tests/complex-task.test.js tests/assert-automate-gate.test.js", expectExitCode: 0 }
  - id: F2-G2
    description: Maestro and transitions document claim-bound done under automate stamp.
    verifier: { kind: shell, command: "rg -n 'claim-bound|canCloseTasksFromClaims|reachability' skills/shared/implement-automate-maestro.md skills/shared/project-assets/project-transitions.md", expectExitCode: 0 }
```

## F3 — Thin maestro step cursor (R2)

Goal: Durable per-plan maestro cursor records step/phase/redispatch; assert and skill refuse actions that skip steps; no multi-host spawn supervisor.

### T-007 Maestro cursor module and status file

- Files: src/maestro-cursor.js, tests/maestro-cursor.test.js, skills/shared/implement-automate-maestro.md
- scopeBoundary: Do not implement provider spawn adapters. Do not store product file contents in cursor. Path under .atomic-skills/status/automate/ only (or documented equivalent). No nested worktree changes.
- acceptance: it - pure helpers read/write cursor shape step phaseId redispatchCount optional claimReportPath leasePath updatedAt.; it - legal transition table rejects e.g. jump C to G or done when step is B.; it - unit tests cover advance reject and pause state awaiting-operator-advance.; it - missing cursor on first automate entry initializes at A or B without throw.
- verifier: { kind: shell, command: "node --test tests/maestro-cursor.test.js", expectExitCode: 0 }
- RED→GREEN: RED transition table tests; implement pure module.

### T-008 Assert and skill integrate cursor

- Files: scripts/assert-automate-gate.js, tests/assert-automate-gate.test.js, skills/core/implement.md, skills/shared/implement-automate-maestro.md, skills/shared/implement-antipatterns.md, docs/kb/automate-orchestrator-realism.md
- scopeBoundary: Do not force cursor on non-automate plans. Do not build Layer 3 host-local runner wait-loop.
- acceptance: it - assert gates optionally or always under automate read cursor and block illegal step for spawn done phase-done.; it - maestro prose requires updating cursor on each A–I boundary event.; it - antipattern forbids deleting cursor or lease to force progress.; it - realism KB notes thin cursor as partial Layer 2.5 not Layer 4.
- verifier: { kind: shell, command: "node --test tests/maestro-cursor.test.js tests/assert-automate-gate.test.js && rg -n 'maestro-cursor|maestro cursor|awaiting-operator-advance' skills/shared/implement-automate-maestro.md skills/core/implement.md", expectExitCode: 0 }
- RED→GREEN: Integration tests and prose.

```yaml
exit_gate:
  - id: F3-G1
    description: Maestro cursor unit tests pass.
    verifier: { kind: shell, command: "node --test tests/maestro-cursor.test.js", expectExitCode: 0 }
  - id: F3-G2
    description: Assert + skill reference cursor anti-skip.
    verifier: { kind: shell, command: "rg -n 'maestro-cursor|cursor' scripts/assert-automate-gate.js skills/shared/implement-automate-maestro.md", expectExitCode: 0 }
```

## F4 — Phase pause, framing, and residual discipline (R5 + P1)

Goal: After phase-done under automate, block next-phase spawn until operator continue; branch Mindset Mode-1 vs Automate; close residual antipatterns; view surfaces pause/plan-end if cheap.

### T-009 Awaiting-operator-advance pause after phase-done

- Files: src/maestro-cursor.js, scripts/assert-automate-gate.js, skills/shared/project-assets/project-transitions.md, skills/shared/implement-automate-maestro.md, skills/core/implement.md, tests/maestro-cursor.test.js, tests/assert-automate-gate.test.js
- scopeBoundary: Do not auto-materialize next phase. Do not auto-finalize. Operator must explicitly continue; generic ok is not enough if project ratify rules apply — document continue token.
- acceptance: it - successful phase-done under automate sets cursor step or flag awaiting-operator-advance.; it - assert spawn / implement Step A under automate refuses while awaiting-operator-advance until clear-continue helper runs.; it - continue path is documented (implement re-entry or explicit flag) and unit-tested.; it - non-automate phase-done unchanged.
- verifier: { kind: shell, command: "node --test tests/maestro-cursor.test.js tests/assert-automate-gate.test.js && rg -n 'awaiting-operator-advance' skills/shared/implement-automate-maestro.md skills/shared/project-assets/project-transitions.md skills/core/implement.md", expectExitCode: 0 }
- RED→GREEN: Pause tests RED then wire phase-done + assert.

### T-010 Framing Mindset and antipatterns residual pack

- Files: skills/core/implement.md, skills/shared/implement-antipatterns.md, skills/shared/project-assets/project-view.md, docs/kb/automate-orchestrator-realism.md
- scopeBoundary: Do not rewrite Mode 2 codex lane. Do not change install surface beyond docs. View changes read-only.
- acceptance: it - implement Mindset explicitly branches Mode 1 execution driver vs Automate pure maestro orchestrator-only.; it - antipatterns include forge evaluationGate, silent Mode-1 under stamp, rm lease file, auto-materialize businessIntent, multi-phase auto-run, finalize without userValidatedAt.; it - project-view or drift surfaces awaiting-operator-advance or points at assert when stamp automate (read-only).; it - realism KB operator model mentions assert + cursor + pause.
- verifier: { kind: shell, command: "rg -n 'pure maestro|execution driver' skills/core/implement.md && rg -n 'forging evaluationGate|silent Mode-1|lease file|awaiting-operator-advance' skills/shared/implement-antipatterns.md && rg -n 'assert-automate-gate|awaiting-operator-advance' docs/kb/automate-orchestrator-realism.md", expectExitCode: 0 }
- RED→GREEN: Grep matrix after prose.

```yaml
exit_gate:
  - id: F4-G1
    description: Pause and framing greps plus cursor/assert tests pass.
    verifier: { kind: shell, command: "node --test tests/maestro-cursor.test.js tests/assert-automate-gate.test.js && rg -n 'awaiting-operator-advance' skills/core/implement.md skills/shared/implement-automate-maestro.md && rg -n 'pure maestro|execution driver' skills/core/implement.md", expectExitCode: 0 }
  - id: F4-G2
    description: No top-level automate skill; validate-state still green on fixture plans used in tests.
    verifier: { kind: shell, command: "test ! -e skills/core/automate.md && node --test tests/phase-evaluation-gate.test.js tests/assert-automate-gate.test.js", expectExitCode: 0 }
```
