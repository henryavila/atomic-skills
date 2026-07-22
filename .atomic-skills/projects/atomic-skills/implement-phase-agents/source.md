# Implement phase agents (host-thin automate)

Redesign `implement --mode=automate` so the host session stays a thin dispatcher: one fresh agent per phase, intentional stop at phase-start for materialize and businessIntent, durable decision log, and a mandatory manual hardgate that only the operator can PASS after reviewing those decisions. Builds on archived `implementation-automate-mode` and `automate-skill-discipline` machine gates without replacing Mode 1 or Mode 2.

## Principles

### P1 Host-thin under automate
The host never edits product source and never runs product diagnostics outside verbatim task or exit-gate verifiers. Phase work runs in spawned agents.

### P2 Fresh agent per phase
Each phase gets a new agent context with a constructed brief only. Host chat history is not passed. After phase-done the next phase agent is a new spawn following materialize when required.

### P3 Phase-start materialize stop
Descriptor-only phases HARD-refuse implement. The skill stops with a single nextAction pointing at `project materialize` and businessIntent ratification. Automate does not invent spine.

### P4 Durable decisions
Load-bearing decisions are appended to a durable per-phase decision log. Chat-only decisions do not count as recorded.

### P5 Decision-review is a manual hardgate
Under automate, phase advance requires operator PASS on the decision log. Agents never write that PASS. Distinct from product exit gates and from review-code.

### P6 Keep machine foundation
evaluationGate, review both, lessons, writer lease, claim reachability, plan-end external-both and userValidationOk stay. This plan adds host-thin UX and decision-review.

### P7 No new top-level skill
Extend implement and shared assets plus pure helpers and tests. No skills/core/automate.md.

## Glossary

| Term | Definition |
|------|------------|
| host-thin | Automate host role limited to dispatch, merge, verbatim re-verify, state close helpers, and hardgate surfaces |
| phase agent | Spawned executor for one phase under a constructed work-order brief |
| decision log | Durable per-phase record of load-bearing routing, tradeoffs, and dispositions |
| decision-review | Manual hardgate: operator PASS/FAIL on the decision log before phase-done completes under automate |
| phase-start stop | Intentional halt when the active phase is descriptor-only pending materialize and businessIntent |

## F0 — Contract freeze and antipatterns

Goal: Freeze the operator-facing automate contract in durable skill prose and antipatterns so later code phases implement one agreed shape.

### T-001 Operator contract in implement and maestro

- Files: skills/core/implement.md, skills/shared/implement-automate-maestro.md
- scopeBoundary: Do not change Mode 1 Step 2 session-writer coding path. Do not remove evaluation agent or plan-end external-both. Do not add skills/core/automate.md.
- acceptance: it - Automate iron laws state host-thin role: no product source edits and no product diagnostic entrypoints except verbatim verifiers.; it - Maestro Step H states intentional phase-start stop for descriptor-only materialize and businessIntent with a single operator-facing nextAction.; it - Maestro states one fresh phase agent per phase and that decision-review is a mandatory manual hardgate before phase-done under automate.; it - Text names that agents never write decision-review PASS.
- verifier: { kind: shell, command: "rg -n 'host-thin|phase-start|decision-review|descriptor-only|verbatim verifier' skills/core/implement.md skills/shared/implement-automate-maestro.md && rg -n 'never.*PASS|agent never|operator PASS' skills/core/implement.md skills/shared/implement-automate-maestro.md", expectExitCode: 0 }

### T-002 Antipatterns for host product debug and mega-session close

- Files: skills/shared/implement-antipatterns.md
- scopeBoundary: Do not delete existing Mode-1 silent fallback antipatterns. Do not document Layer 4 daemon as in-scope for this plan.
- acceptance: it - Red flag exists for host running compose or build_edl diagnostics under automate.; it - Red flag exists for closing an entire phase A through I as host mega-session without phase agent spawn.; it - Red flag exists for auto-writing decision-review PASS or skipping materialize stop.; it - Each red flag has a Temptation to Reality refutation entry.
- verifier: { kind: shell, command: "rg -n 'compose|build_edl|mega-session|decision-review|materialize' skills/shared/implement-antipatterns.md", expectExitCode: 0 }

### T-003 KB note: operator mental model update

- Files: docs/kb/automate-orchestrator-realism.md
- scopeBoundary: Do not claim a full maestro daemon is implemented. Do not document auto-materialize of businessIntent.
- acceptance: it - Document states host-thin phase agents and intentional phase-start materialize stop as the operator mental model under automate.; it - Document states decision-review manual hardgate as required for phase close under automate.; it - Document still marks Layer 4 full daemon as non-goal for this plan.
- verifier: { kind: shell, command: "rg -n 'host-thin|decision-review|phase-start|Layer 4' docs/kb/automate-orchestrator-realism.md", expectExitCode: 0 }

<!-- decompose: keep a non-task separator before exit_gate -->

### Exit gates

```yaml
exit_gate:
  - id: F0-G1
    description: Contract strings for host-thin, phase-start stop, and decision-review appear in implement and maestro assets.
    verifier: { kind: shell, command: "rg -n 'host-thin|decision-review|phase-start' skills/core/implement.md skills/shared/implement-automate-maestro.md", expectExitCode: 0 }
  - id: F0-G2
    description: Antipatterns file covers host product diagnostics and auto PASS on decision-review.
    verifier: { kind: shell, command: "rg -n 'decision-review|compose|build_edl' skills/shared/implement-antipatterns.md", expectExitCode: 0 }
  - id: F0-G3
    description: Manual HARD — Henry confirms F0 contract text matches the ratified design (host-thin, materialize pause OK, decision-review hardgate).
    verifier: { kind: manual, description: "Henry acks F0 contract in gate-signoff or chat with explicit PASS on design alignment." }
```

## F1 — Decision log schema and append path

Goal: Make load-bearing automate decisions durable and machine-addressable so decision-review can hard-block without relying on chat history.

### T-004 Decision log path and entry shape

- Files: skills/shared/implement-decision-log.md, docs/kb/implement-decision-log.md
- scopeBoundary: Do not store secrets or writer-lease secrets in the decision log. Do not make the evaluator auto-PASS decision-review.
- acceptance: it - Asset documents per-phase durable path under the plan tree and required fields id category decision why evidencePath impact at ISO timestamp.; it - Categories include routing tradeoff review-disposition scope-exit manual-gate-delegation env at minimum.; it - Asset states only the operator writes decision-review PASS and the agent only appends decision entries.
- verifier: { kind: shell, command: "test -s skills/shared/implement-decision-log.md && rg -n 'decision-review|category|evidencePath|operator' skills/shared/implement-decision-log.md", expectExitCode: 0 }

### T-005 Pure helper append and read decision log

- Files: src/decision-log.js, tests/decision-log.test.js
- scopeBoundary: Do not perform network I/O. Do not write decision-review PASS from append APIs.
- acceptance: it - Pure or fs-scoped helpers can append a validated entry and list entries for a phase.; it - Append rejects empty decision or missing category.; it - Unit tests cover append list and reject paths.; it - No API stamps decisionReview status PASS.
- verifier: { kind: shell, command: "node --test tests/decision-log.test.js", expectExitCode: 0 }

### T-006 Wire decision log into maestro and phase-writer briefs

- Files: skills/shared/implement-automate-maestro.md, skills/shared/implement-phase-writer.md, skills/core/implement.md
- scopeBoundary: Do not allow phase writer to mutate plan.md phase status fields. Do not remove claim report requirements.
- acceptance: it - Maestro requires every re-dispatch skip disposition and scope exit to append a decision log entry before continuing.; it - Phase-writer brief requires recording product tradeoffs that change behavior outside pure task text into the decision log path provided by the work-order.; it - implement.md points at the decision log asset for automate.
- verifier: { kind: shell, command: "rg -n 'decision log|decision-log|implement-decision-log' skills/core/implement.md skills/shared/implement-automate-maestro.md skills/shared/implement-phase-writer.md", expectExitCode: 0 }

<!-- decompose: keep a non-task separator before exit_gate -->

### Exit gates

```yaml
exit_gate:
  - id: F1-G1
    description: decision-log unit tests pass.
    verifier: { kind: shell, command: "node --test tests/decision-log.test.js", expectExitCode: 0 }
  - id: F1-G2
    description: Decision log asset and maestro wiring strings exist.
    verifier: { kind: shell, command: "test -s skills/shared/implement-decision-log.md && rg -n 'decision log|decision-log' skills/shared/implement-automate-maestro.md", expectExitCode: 0 }
```

## F2 — Host-thin maestro and product execution ban

Goal: Enforce host-thin behavior in skill prose and STOP helpers so automate cannot honestly run as a host mega-implementer.

### T-007 Product execution ban in maestro and antipatterns

- Files: skills/shared/implement-automate-maestro.md, skills/shared/implement-antipatterns.md, skills/core/implement.md
- scopeBoundary: Do not ban verbatim task verifier shell commands. Do not ban git-ops merge on the plan branch.
- acceptance: it - Hard rule lists product entrypoint classes forbidden on the host under automate outside verifiers.; it - Allowed host shell actions include git merge status log, assert-automate-gate, validate-state, and task verifier commands copied from task.verifier.; it - Antipattern Temptation for I will just run compose myself is refuted with re-dispatch fix agent.
- verifier: { kind: shell, command: "rg -n 'product entrypoint|verbatim|forbidden|fix agent' skills/shared/implement-automate-maestro.md skills/shared/implement-antipatterns.md skills/core/implement.md", expectExitCode: 0 }

### T-008 Role banner and single nextAction on stops

- Files: skills/shared/implement-automate-maestro.md, skills/core/implement.md
- scopeBoundary: Do not force a new chat session via host APIs that do not exist. Do not auto-spawn without operator materialize when descriptor-only.
- acceptance: it - At Step A C D.5 E F G H the skill requires a one-line role banner stating host-thin maestro.; it - Descriptor-only stop message is a single nextAction containing project materialize and phase id.; it - After phase-done when successor is descriptor-only host must not spawn a writer for the successor.
- verifier: { kind: shell, command: "rg -n 'role banner|nextAction|materialize' skills/shared/implement-automate-maestro.md skills/core/implement.md", expectExitCode: 0 }

### T-009 Assert gate for host-thin preflight optional hook

- Files: scripts/assert-automate-gate.js, src/automate-orchestrator-gates.js, tests/automate-orchestrator-gates.test.js
- scopeBoundary: Do not implement a full process supervisor. Do not require network for assert.
- acceptance: it - canSpawnPhaseWriter or a sibling helper documents host-thin preconditions already required lease clean and phase materialized.; it - assert-automate-gate exposes or documents a gate that fails when active phase initiative file is missing descriptor-only.; it - Unit tests cover descriptor-only refuse path for spawn or phase load.
- verifier: { kind: shell, command: "node --test tests/automate-orchestrator-gates.test.js && rg -n 'descriptor|materialize|initiative' scripts/assert-automate-gate.js src/automate-orchestrator-gates.js", expectExitCode: 0 }

<!-- decompose: keep a non-task separator before exit_gate -->

### Exit gates

```yaml
exit_gate:
  - id: F2-G1
    description: Host-thin and product entrypoint ban strings exist in maestro and implement.
    verifier: { kind: shell, command: "rg -n 'host-thin|verbatim|product' skills/shared/implement-automate-maestro.md skills/core/implement.md", expectExitCode: 0 }
  - id: F2-G2
    description: Orchestrator gate tests pass including descriptor-only coverage.
    verifier: { kind: shell, command: "node --test tests/automate-orchestrator-gates.test.js", expectExitCode: 0 }
```

## F3 — Decision-review hardgate on phase-done

Goal: Machine-enforce that automate phase-done cannot complete without operator PASS on the phase decision log.

### T-010 Schema field decisionReview on phase

- Files: meta/schemas/plan.schema.json, src/decision-review-gate.js, tests/decision-review-gate.test.js, tests/validate-state.test.js
- scopeBoundary: Do not require decisionReview on non-automate plans. Do not allow agent-written PASS without operator field provenance.
- acceptance: it - plan schema accepts optional phases decisionReview object with status pending or passed or failed and verifiedAt and optional evidencePath under automate phases.; it - decisionReviewAllowsPhaseDone pure helper returns false when executionMode automate and status is not passed.; it - Unit tests cover allow block and non-automate skip.; it - plans without the field still validate when not automate.
- verifier: { kind: shell, command: "node --test tests/decision-review-gate.test.js tests/validate-state.test.js", expectExitCode: 0 }

### T-011 Wire canRunPhaseDone and assert gate

- Files: src/automate-orchestrator-gates.js, scripts/assert-automate-gate.js, tests/automate-orchestrator-gates.test.js, skills/shared/project-assets/project-transitions.md
- scopeBoundary: Do not remove evaluationGate requirement under automate. Do not auto-stamp decisionReview from evaluation agent.
- acceptance: it - canRunPhaseDone requires decisionReviewAllowsPhaseDone when plan executionMode is automate.; it - assert-automate-gate phase-done fails closed without decisionReview passed under automate.; it - project-transitions phase-done prose states operator PASS on decision log before advance under automate.; it - Unit tests cover blocked and allowed matrix.
- verifier: { kind: shell, command: "node --test tests/automate-orchestrator-gates.test.js tests/decision-review-gate.test.js && rg -n 'decisionReview|decision-review' src/automate-orchestrator-gates.js scripts/assert-automate-gate.js skills/shared/project-assets/project-transitions.md", expectExitCode: 0 }

### T-012 Operator PASS procedure in maestro

- Files: skills/shared/implement-automate-maestro.md, skills/core/implement.md, skills/shared/implement-decision-log.md
- scopeBoundary: Do not let evaluation agent or review-code receipt substitute for decision-review PASS.
- acceptance: it - Fixed order under automate includes decision-review operator PASS after evaluation and before or as part of phase-done preflight.; it - Procedure forbids host writing PASS without explicit operator token in the same turn.; it - FAIL path records failed status and does not advance currentPhase.
- verifier: { kind: shell, command: "rg -n 'decision-review|decisionReview|operator' skills/shared/implement-automate-maestro.md skills/core/implement.md skills/shared/implement-decision-log.md", expectExitCode: 0 }

<!-- decompose: keep a non-task separator before exit_gate -->

### Exit gates

```yaml
exit_gate:
  - id: F3-G1
    description: decision-review gate unit tests pass.
    verifier: { kind: shell, command: "node --test tests/decision-review-gate.test.js", expectExitCode: 0 }
  - id: F3-G2
    description: canRunPhaseDone and assert wiring mention decisionReview.
    verifier: { kind: shell, command: "rg -n 'decisionReview|decision-review' src/automate-orchestrator-gates.js scripts/assert-automate-gate.js", expectExitCode: 0 }
  - id: F3-G3
    description: Manual HARD — Henry confirms agent cannot stamp decision-review PASS in the documented procedure.
    verifier: { kind: manual, description: "Henry PASS on F3 manual gate after reading PASS procedure." }
```

## F4 — Phase boundary ritual and next agent

Goal: After phase-done, automate always ends with a clear materialize-or-spawn-next-agent ritual instead of a silent host stop or host mega-continuation.

### T-013 Step H ritual message and handoff fields

- Files: skills/shared/implement-automate-maestro.md, skills/core/implement.md
- scopeBoundary: Do not auto-run materialize. Do not spawn phase writer when initiative file is absent.
- acceptance: it - Step H defines exact post phase-done branches materialized successor versus descriptor-only successor.; it - Descriptor-only branch prints automate paused not coding and nextAction materialize.; it - Materialized successor branch instructs spawn new phase agent with fresh context and forbids reusing the previous writer context.; it - Session handoff single nextAction is mandatory at the boundary.
- verifier: { kind: shell, command: "rg -n 'Step H|automate paused|fresh|materialize|nextAction' skills/shared/implement-automate-maestro.md skills/core/implement.md", expectExitCode: 0 }

### T-014 Re-entry after materialize

- Files: skills/core/implement.md, skills/shared/implement-automate-maestro.md, docs/kb/project-lazy-materialization.md
- scopeBoundary: Do not change find-missing-business-intent quality HARD rules. Do not pre-fill businessIntent by LLM as PASS.
- acceptance: it - implement documents that after materialize with ratified businessIntent the next implement invocation under stamp re-enters Step A and spawns a new phase agent.; it - project-lazy-materialization after-materialize section mentions host-thin automate phase agents and decision-review.; it - No path documents silent host coding of the new phase.
- verifier: { kind: shell, command: "rg -n 'materialize|phase agent|decision-review|host-thin' skills/core/implement.md docs/kb/project-lazy-materialization.md", expectExitCode: 0 }

<!-- decompose: keep a non-task separator before exit_gate -->

### Exit gates

```yaml
exit_gate:
  - id: F4-G1
    description: Step H ritual strings present in maestro.
    verifier: { kind: shell, command: "rg -n 'automate paused|Step H|fresh' skills/shared/implement-automate-maestro.md", expectExitCode: 0 }
  - id: F4-G2
    description: Lazy materialization KB updated for host-thin automate.
    verifier: { kind: shell, command: "rg -n 'host-thin|decision-review|phase agent' docs/kb/project-lazy-materialization.md", expectExitCode: 0 }
```

## F5 — Tests fixtures docs and dogfood checklist

Goal: Prove the contract with automated tests and a dogfood checklist so the next automate run on a real plan cannot skip decision-review or host-thin rules unnoticed.

### T-015 Fixture tests for descriptor-only stop and decision-review block

- Files: tests/implement-phase-agents-contract.test.js, tests/fixtures/implement-phase-agents/
- scopeBoundary: Do not require live subagent spawn in CI. Do not hit network.
- acceptance: it - Fixture plan with descriptor-only active phase causes spawn or load helper to block with materialize reason.; it - Fixture plan with executionMode automate and decisionReview pending causes canRunPhaseDone false.; it - Fixture with decisionReview passed and evaluationGate passed allows phase-done predicate true when other existing automate requirements are satisfied or mocked.; it - Tests run under node --test without network.
- verifier: { kind: shell, command: "node --test tests/implement-phase-agents-contract.test.js", expectExitCode: 0 }

### T-016 Operator dogfood checklist

- Files: docs/kb/implement-phase-agents-dogfood.md
- scopeBoundary: Do not claim dogfood already passed before the checklist is used on a real plan.
- acceptance: it - Checklist includes host did not edit product source, phase agent was spawned, decision log has entries, operator PASS on decision-review, phase-start materialize stop observed on multi-phase plan.; it - Checklist references assert-automate-gate commands.; it - Checklist is written as pass or fail items not soft language.
- verifier: { kind: shell, command: "test -s docs/kb/implement-phase-agents-dogfood.md && rg -n 'decision-review|host-thin|materialize|assert-automate-gate' docs/kb/implement-phase-agents-dogfood.md", expectExitCode: 0 }

### T-017 Memory and catalog pointers

- Files: .ai/memory/MEMORY.md, .ai/memory/reference-implement-phase-agents.md
- scopeBoundary: Do not inflate package version. Do not remove prior automate dogfood memory; link supersession.
- acceptance: it - MEMORY.md links the new reference note.; it - Reference note states host-thin phase agents decision-review hardgate and supersedes the prior note line that forbade handing materialize to the user for full-plan automate.; it - Note points at this plan slug implement-phase-agents.
- verifier: { kind: shell, command: "test -s .ai/memory/reference-implement-phase-agents.md && rg -n 'implement-phase-agents|decision-review|host-thin' .ai/memory/MEMORY.md .ai/memory/reference-implement-phase-agents.md", expectExitCode: 0 }

<!-- decompose: keep a non-task separator before exit_gate -->

### Exit gates

```yaml
exit_gate:
  - id: F5-G1
    description: Contract fixture tests pass.
    verifier: { kind: shell, command: "node --test tests/implement-phase-agents-contract.test.js", expectExitCode: 0 }
  - id: F5-G2
    description: Dogfood checklist and memory reference exist.
    verifier: { kind: shell, command: "test -s docs/kb/implement-phase-agents-dogfood.md && test -s .ai/memory/reference-implement-phase-agents.md", expectExitCode: 0 }
  - id: F5-G3
    description: Manual HARD — Henry dogfoods checklist on a small multi-phase plan or records explicit defer with reason after F5 code green.
    verifier: { kind: manual, description: "Henry runs dogfood checklist or writes defer reason in plan decisions." }
```
