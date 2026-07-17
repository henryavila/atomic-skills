# Implementation Automate Mode

Add an opt-in `implement --mode=automate` path where the host session is a pure maestro (dispatch, re-verify, review, close state), one code-only phase writer agent implements each phase serially under the single-writer iron law, CROSS-MODEL REVIEW runs on every phase and on complex tasks, and plan-end finalize requires `external-both` with a machine-checkable `planEndReviewOk` predicate. Mode 1 and Mode 2 stay unchanged when automate is not selected.

## Inviolable principles

- **P1 Opt-in only** — Automate never becomes the default implement path. Absent `--mode=automate` (or an explicit plan stamp), Mode 1/Mode 2 behavior is byte-identical for review policy and who writes code.
- **P2 Pure maestro** — In automate mode the host session never edits product source. It re-dispatches fix agents when verifiers or blocker/critical reviews fail; it does not silently become Mode 1.
- **P3 Code-only phase writer** — The phase agent may orient, code, pre-close self-check, and make explicit-path implementation microcommits. It must not invoke `done`, `phase-done`, handoff mutation, or any durable `.atomic-skills/` write. The orchestrator is the sole closer (never self-certify).
- **P4 One writer per tree per window** — At most one writer process on a given worktree at a time. Orchestrator sync-waits for the phase writer. Phase isolation uses a **sibling** worktree from the git common-dir (never nested under the plan worktree).
- **P5 Review cadence is mode-scoped** — Under automate: phase-done defaults to `--mode=both`; complex tasks use `--mode=both` before `done`; plan-end uses `external-both` + `planEndReviewOk`. Non-automate keeps the DESTRUCTIVE-only ladder in phase-done.
- **P6 Evaluate then user-validate** — Each phase gets a fresh evaluation agent after the writer; decisions are logged for the user; finalize and archive only after explicit user validation of implementation and decisions.


## Glossary

- **automate mode** — Opt-in implement execution mode: session orchestrates; one code-only writer agent per phase; forced cross-model review policy.
- **phase writer** — Foreign executor for one phase: code-only subset of the implement loop; returns claim reports; never closes tasks in project state.
- **claim report** — Per-task payload from the phase writer: task id, commit SHAs, paths touched, verifier command + exit transcript.
- **complex task** — Task with weight greater than or equal to threshold (default 3), or tags intersecting destructive/decommission/drop/complex, or DESTRUCTIVE signal true on its implementation range.
- **planEndReviewOk** — Machine predicate: plan-end review receipt exists AND (at least one succeeded family-different external leg OR recorded `--skip-plan-end-review` with non-empty reason).

## F0 — Foundation: mode parse and pure predicates

Goal: Land pure, unit-tested helpers for automate mode detection, complex-task classification, and planEndReviewOk so skill prose and transitions share one definition.

### T-001 Parse implement mode flag and isAutomateActive

- Files: src/implement-mode.js, tests/implement-mode.test.js, skills/core/implement.md
- scopeBoundary: Do not change Mode 2 routing.json or codex lane dispatch. Do not edit phase-done or finalize yet.
- acceptance: it - parseImplementMode accepts --mode=automate and mode:automate tokens and returns mode automate.; it - absent mode or --mode=1 returns mode default or mode1 without treating automate as on.; it - isAutomateActive implements CLI vs stamp vs clear precedence and unit tests cover the matrix including stamp-alone re-entry and clear path.; it - unknown mode is rejected with a clear error (not ignored).
- verifier: { kind: shell, command: "node --test tests/implement-mode.test.js", expectExitCode: 0 }
- RED→GREEN: Write failing tests for parseImplementMode and isAutomateActive matrix; implement pure helpers until green.

### T-002 Complex-task predicate helper

- Files: src/complex-task.js, tests/complex-task.test.js
- scopeBoundary: Do not call review-code or mutate initiative files. Do not change weight rollup semantics outside the predicate.
- acceptance: it - isComplexTask returns true when weight is greater than or equal to threshold default 3.; it - returns true when tags include destructive or decommission or drop or complex.; it - returns true when destructiveDiff flag is true.; it - weightless task with no tags and destructiveDiff false returns false.; it - threshold is overridable via options.
- verifier: { kind: shell, command: "node --test tests/complex-task.test.js", expectExitCode: 0 }
- RED→GREEN: Table-driven RED cases first; implement isComplexTask until all pass.

### T-003 planEndReviewOk and userValidationOk predicates

- Files: src/plan-end-review.js, tests/plan-end-review.test.js
- scopeBoundary: Do not invoke external CLIs. Do not change external-both merge algorithm.
- acceptance: it - planEndReviewOk is false when receipt is missing.; it - true when at least one family-different external leg has status succeeded.; it - true when skipPlanEndReview is true with non-empty reason even if all legs failed.; it - false when all legs skipped or failed and no skip reason.; it - single remaining leg after host filter counts when succeeded.; it - userValidationOk is false when userValidatedAt is missing or empty under automate and true only when a non-empty ISO timestamp (or equivalent receipt) is present with optional validator id.
- verifier: { kind: shell, command: "node --test tests/plan-end-review.test.js", expectExitCode: 0 }
- RED→GREEN: RED for all-skipped without skip and missing userValidatedAt; implement both predicates until green.

```yaml
exit_gate:
  - id: F0-G1
    description: Unit tests for implement-mode, complex-task, and plan-end-review all pass.
    verifier: { kind: shell, command: "node --test tests/implement-mode.test.js tests/complex-task.test.js tests/plan-end-review.test.js", expectExitCode: 0 }
  - id: F0-G2
    description: Helpers are pure modules importable without side effects on import.
    verifier: { kind: shell, command: "node -e \"import('./src/implement-mode.js'); import('./src/complex-task.js'); import('./src/plan-end-review.js');\"", expectExitCode: 0 }
```

## F1 — Implement maestro loop and phase-writer contract

Goal: Extend implement so --mode=automate runs the pure-maestro loop: one code-only phase writer per phase, sync wait, claim handling, orchestrator-owned done, no silent Mode-1 fallback.

### T-004 Document automate iron laws and step spine in implement.md

- Files: skills/core/implement.md, skills/shared/implement-antipatterns.md
- scopeBoundary: Do not implement Mode 2 changes. Do not rewrite project-transitions phase-done yet. Do not add a new top-level skill file.
- acceptance: it - implement.md defines --mode=automate entry and pure-maestro decision that the session never edits product source under automate.; it - phase-writer contract is code-only and forbids done phase-done handoff and .atomic-skills state writes.; it - step spine includes sync wait, claim re-verify, complex review hook point, and re-dispatch on verifier fail without done.; it - antipatterns file covers silent Mode-1 fallback and phase writer self-certify.
- verifier: { kind: shell, command: "rg -n 'mode=automate|phase writer|planEndReviewOk|pure maestro|never self-certif' skills/core/implement.md skills/shared/implement-antipatterns.md", expectExitCode: 0 }
- RED→GREEN: Grep for automate contract strings fails before edit; passes after prose lands.

### T-005 Phase work-order and claim-report contract

- Files: skills/shared/implement-phase-writer.md, skills/core/implement.md
- scopeBoundary: Do not add host-only Workflow tools outside ide conditionals. Do not change SPEC admission in lint-source.js.
- acceptance: it - A lazy asset documents the phase work-order fields task ids paths scopeBoundary acceptance verifier and the claim report shape taskId commitShas paths verifierCommand exitCode transcript.; it - implement.md points phase dispatch at that asset and requires constructed brief without orchestrator chat history.; it - resume refuse when dirty tree or phase-writer still running is stated as HARD-GATE.
- verifier: { kind: shell, command: "test -s skills/shared/implement-phase-writer.md && rg -n 'claim report|work-order|HARD-GATE' skills/shared/implement-phase-writer.md skills/core/implement.md", expectExitCode: 0 }
- RED→GREEN: Asset missing causes test -s fail; write asset and link from implement.

### T-006 Sibling phase worktree isolation, writer lease, and merge-before-done

- Files: skills/core/implement.md, skills/shared/worktree-isolation.md, src/writer-lease.js, tests/writer-lease.test.js
- scopeBoundary: Do not nest a phase worktree under the plan worktree path. Do not change Mode 2 merge-back defaults for non-automate. Do not force sibling worktrees for Mode 1.
- acceptance: it - Automate phase isolation cuts a sibling worktree from the git common-dir or primary root, never a nest under .worktrees/plan-slug.; it - writer lease file is written before spawn and cleared only after sync wait claim collect and merge settle; resume refuses when lease present.; it - orchestrator merges sibling into plan branch with git-ops only before any task re-verify or done; content conflicts re-dispatch a code-only fix agent; post-merge re-verify is mandatory before done.; it - concurrent phase writers remain forbidden in v1 even if plan parallelismAllowed is true.
- verifier: { kind: shell, command: "node --test tests/writer-lease.test.js && rg -n 'sibling|writer lease|common-dir|never nest|merge.*before|post-merge' skills/core/implement.md skills/shared/worktree-isolation.md", expectExitCode: 0 }
- RED→GREEN: Writer lease unit tests fail until lease helper lands; merge-before-done order is greppable.

### T-015 Phase evaluation agent, reopen protocol, and decision-log visibility

- Files: skills/core/implement.md, skills/shared/implement-phase-writer.md, skills/shared/implement-phase-evaluator.md
- scopeBoundary: Do not merge evaluation into the phase writer agent. Do not auto-finalize after evaluation pass. Evaluator never writes project state.
- acceptance: it - Fixed order: all phase tasks done, then evaluation agent, then phase-done review-code both.; it - Evaluator does not edit product source or project state and returns structured pass or fail against phase goal gates and businessIntent.; it - On evaluation blocker or critical, orchestrator reopens affected tasks or creates blocking follow-up tasks, re-dispatches code-only fix agent max 2, re-runs verifiers and complex-task reviews on the fix range, and only then allows phase-done.; it - Orchestrator writes routing skip re-dispatch scope-exit and review severity dispositions to a durable decisions log.; it - Finalize and archive require userValidationOk after the last phase.
- verifier: { kind: shell, command: "test -s skills/shared/implement-phase-evaluator.md && rg -n 'evaluation agent|reopen|follow-up|userValidationOk' skills/core/implement.md skills/shared/implement-phase-evaluator.md", expectExitCode: 0 }
- RED→GREEN: Evaluator asset missing fails test -s; reopen protocol must appear in prose.

```yaml
exit_gate:
  - id: F1-G1
    description: implement.md and phase-writer asset describe maestro + code-only writer + isolation without Mode-1 silent fallback.
    verifier: { kind: shell, command: "rg -n 'mode=automate' skills/core/implement.md && rg -n 'code-only|never.*done' skills/shared/implement-phase-writer.md skills/core/implement.md && rg -n 'Mode-1|silent' skills/shared/implement-antipatterns.md", expectExitCode: 0 }
  - id: F1-G2
    description: No new top-level skill named automate was added under skills/core.
    verifier: { kind: shell, command: "test ! -e skills/core/automate.md", expectExitCode: 0 }
  - id: F1-G3
    description: Phase evaluation agent contract exists and forbids auto-finalize without user validation.
    verifier: { kind: shell, command: "test -s skills/shared/implement-phase-evaluator.md && rg -n 'evaluation agent|user validates' skills/shared/implement-phase-evaluator.md skills/core/implement.md", expectExitCode: 0 }
```

## F2 — Review policy: phase-done and complex tasks under automate

Goal: Wire automate-aware review policy so phase-done defaults to both, and complex tasks run review-code --mode=both before orchestrator done.

### T-007 phase-done review mode override for automate

- Files: src/phase-review-mode.js, tests/project-transitions-automate.test.js, skills/shared/project-assets/project-transitions.md
- scopeBoundary: Do not change non-automate DESTRUCTIVE ladder defaults. Do not change lessons distill flow beyond noting review mode in self-review.
- acceptance: it - When isAutomateActive is true, phase-done default review mode is both regardless of DESTRUCTIVE signal.; it - Non-automate path still uses both only when DESTRUCTIVE else local.; it - Explicit local override remains recordable; skip-review remains the only full skip.; it - phaseReviewMode pure helper is unit-tested and is the single definition used by transitions prose.
- verifier: { kind: shell, command: "node --test tests/project-transitions-automate.test.js", expectExitCode: 0 }
- RED→GREEN: Matrix tests fail until phaseReviewMode helper lands and prose points at it.

### T-008 Complex-task cross-model before done in implement automate

- Files: skills/core/implement.md, skills/shared/implement-phase-writer.md, src/complex-task.js, src/claim-report.js, tests/claim-report.test.js
- scopeBoundary: Do not force cross-model on non-complex tasks. Do not change GATE-R2 verifier-first close authority.
- acceptance: it - Claim report validates base and head or explicit disjoint commit range per task and rejects ambiguous overlapping multi-task SHAs.; it - Under automate, before done on a complex task, orchestrator runs review-code --mode=both on the validated task commit range.; it - destructiveDiff is computed from that validated range when classifying complex.; it - blocker and critical block done until re-dispatch or operator disposition with recorded major disposition accept defer or fix.; it - non-complex tasks close with verifier only under GATE-R2.; it - complex review leaves durable receipt or evidence before done.
- verifier: { kind: shell, command: "node --test tests/complex-task.test.js tests/claim-report.test.js && rg -n 'isComplexTask|review-code --mode=both|claim report' skills/core/implement.md", expectExitCode: 0 }
- RED→GREEN: Claim-range validation tests fail until claim-report helper lands; complex both prose points at validated range.

### T-009 Mandatory executionMode stamp and clear path

- Files: skills/core/implement.md, meta/schemas/plan.schema.json, tests/validate-state.test.js, src/implement-mode.js
- scopeBoundary: Do not require executionMode on plans that never entered automate. Do not break validate-state for plans without the field.
- acceptance: it - plan schema accepts optional executionMode enum including automate for pre-stamp plans.; it - first confirmed implement --mode=automate entry MUST stamp executionMode automate after interactive operator confirm.; it - stamp alone makes isAutomateActive true for later implement phase-done finalize until clear.; it - clear path (implement --clear-execution-mode or recorded mutation) removes stamp and is unit-tested.; it - plans without the field still validate.
- verifier: { kind: shell, command: "node --test tests/validate-state.test.js tests/implement-mode.test.js", expectExitCode: 0 }
- RED→GREEN: Fixture with stamp validates; clear path tests fail until clear helper lands.

```yaml
exit_gate:
  - id: F2-G1
    description: Automate phase review mode matrix is unit-tested.
    verifier: { kind: shell, command: "node --test tests/project-transitions-automate.test.js", expectExitCode: 0 }
  - id: F2-G2
    description: implement documents complex-task both review before done.
    verifier: { kind: shell, command: "rg -n 'complex' skills/core/implement.md | rg -n 'both|review-code'", expectExitCode: 0 }
```

## F3 — Plan-end external-both and finalize hard gate

Goal: Finalize and archive under automate require external-both receipt satisfying planEndReviewOk; missing success without skip hard-blocks.

### T-010 Finalize plan-end review gate under automate

- Files: skills/shared/project-assets/project-finalize.md, src/plan-end-review.js, tests/plan-end-review.test.js, meta/schemas/plan.schema.json
- scopeBoundary: Do not change finalize for non-automate plans beyond detection of executionMode. Do not auto-merge PRs. Do not skip the user-validation step after plan-end review.
- acceptance: it - Under automate, finalize runs review-code external-both on the plan integration range before PR create or records skip with reason.; it - planEndReviewOk false hard-blocks finalize and archive.; it - receipt is linked from plan Reviews section with per-leg succeeded failed skipped.; it - plan schema admits durable userValidatedAt (or plan-end receipt fields) used by userValidationOk.; it - finalize hard-blocks unless userValidationOk is true after last phase and plan-end review.; it - zero family-different provider path offers guided skip with non-empty reason taxonomy rather than stranding the plan.
- verifier: { kind: shell, command: "node --test tests/plan-end-review.test.js && rg -n 'planEndReviewOk|userValidationOk|userValidatedAt' skills/shared/project-assets/project-finalize.md", expectExitCode: 0 }
- RED→GREEN: Grep and unit predicate fail until finalize prose and helper align.

### T-011 Archive hard-block and status visibility of plan-end receipt

- Files: skills/shared/project-assets/project-transitions.md, skills/shared/project-assets/project-drift.md, src/plan-end-review.js, tests/plan-end-review.test.js
- scopeBoundary: Do not invent a third external provider. Do not change CROSS-MODEL REVIEW cadence for non-automate. Soft pointer to finalize is not an archive success path.
- acceptance: it - Archive under automate HARD-FAILS unless planEndReviewOk is true and userValidationOk is true.; it - status and drift may surface missing plan-end receipt on read-only paths without mutating state.; it - unit tests cover missing receipt, all failed or skipped legs, skip without reason, valid skip, valid successful leg, and missing userValidatedAt.
- verifier: { kind: shell, command: "node --test tests/plan-end-review.test.js && rg -n 'planEndReviewOk|HARD-FAIL|userValidationOk' skills/shared/project-assets/project-transitions.md skills/shared/project-assets/project-finalize.md", expectExitCode: 0 }
- RED→GREEN: Archive soft-pointer acceptance removed; tests fail until hard-block lands.

```yaml
exit_gate:
  - id: F3-G1
    description: planEndReviewOk unit tests pass and finalize documents the hard-block.
    verifier: { kind: shell, command: "node --test tests/plan-end-review.test.js && rg -n 'planEndReviewOk' skills/shared/project-assets/project-finalize.md", expectExitCode: 0 }
  - id: F3-G2
    description: skip-plan-end-review requires non-empty reason in documented contract.
    verifier: { kind: shell, command: "rg -n 'skip-plan-end-review' skills/shared/project-assets/project-finalize.md", expectExitCode: 0 }
```

## F4 — Integration tests, install surface, and dogfood

Goal: Lock the mode with tests that exercise prose contracts and helper wiring; document the mode for operators; keep install/catalog consistent.

### T-012 Contract tests for automate skill surface

- Files: tests/implement-automate-contract.test.js, package.json
- scopeBoundary: Do not require live Codex or Grok network in unit CI. Do not enable Mode 2 by default.
- acceptance: it - Contract tests assert implement.md contains automate maestro markers phase-writer code-only and complex both and plan-end external-both pointers.; it - contract tests assert project-transitions automate phase review and finalize planEndReviewOk strings.; it - npm test includes the new contract file.
- verifier: { kind: shell, command: "node --test tests/implement-automate-contract.test.js", expectExitCode: 0 }
- RED→GREEN: Contract file fails on missing markers; land markers and helpers until green.

### T-013 Operator docs and catalog one-liner touch if needed

- Files: docs/kb/project-lazy-materialization.md, docs/concepts/project-tracking.md, meta/catalog.yaml
- scopeBoundary: Do not rewrite the full orchestrator CANON. Do not change skill namespace layout.
- acceptance: it - Operator-facing doc mentions implement automate mode and points at implement.md contract.; it - core.implement catalog entry description or argument_hint mentions mode automate if argument_hint is updated without breaking compact format.; it - validate-skills still exits 0.
- verifier: { kind: shell, command: "node scripts/validate-skills.js", expectExitCode: 0 }
- RED→GREEN: Doc and catalog updates keep validate-skills green.

### T-014 Full suite green after automate landing

- Files: package.json
- scopeBoundary: Do not skip failing unrelated suites by disabling them. Do not expand dogfood into a live multi-phase plan execution in this task.
- acceptance: it - npm test exits 0 on the package after all automate files land.; it - no skills/core/automate.md exists.
- verifier: { kind: shell, command: "npm test", expectExitCode: 0 }
- RED→GREEN: Fix any regressions introduced by automate helpers until full suite passes.

```yaml
exit_gate:
  - id: F4-G1
    description: implement-automate contract tests and full npm test pass.
    verifier: { kind: shell, command: "node --test tests/implement-automate-contract.test.js && npm test", expectExitCode: 0 }
  - id: F4-G2
    description: validate-skills exits 0 after catalog or docs touch.
    verifier: { kind: shell, command: "node scripts/validate-skills.js", expectExitCode: 0 }
```
