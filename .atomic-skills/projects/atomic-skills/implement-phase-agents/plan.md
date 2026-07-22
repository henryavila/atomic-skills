---
schemaVersion: "0.1"
slug: implement-phase-agents
title: Implement phase agents (host-thin automate)
version: "1.0"
status: active
started: 2026-07-22T20:36:08.845Z
lastUpdated: 2026-07-22T20:36:08.845Z
branch: plan/implement-phase-agents
currentPhase: F0
parallelismAllowed: false
principles:
  - id: P1
    title: Host-thin under automate
    body: The host never edits product source and never runs product diagnostics
      outside verbatim task or exit-gate verifiers. Phase work runs in spawned
      agents.
  - id: P2
    title: Fresh agent per phase
    body: Each phase gets a new agent context with a constructed brief only. Host
      chat history is not passed. After phase-done the next phase agent is a new
      spawn following materialize when required.
  - id: P3
    title: Phase-start materialize stop
    body: Descriptor-only phases HARD-refuse implement. The skill stops with a
      single nextAction pointing at `project materialize` and businessIntent
      ratification. Automate does not invent spine.
  - id: P4
    title: Durable decisions
    body: Load-bearing decisions are appended to a durable per-phase decision log.
      Chat-only decisions do not count as recorded.
  - id: P5
    title: Decision-review is a manual hardgate
    body: Under automate, phase advance requires operator PASS on the decision log.
      Agents never write that PASS. Distinct from product exit gates and from
      review-code.
  - id: P6
    title: Keep machine foundation
    body: evaluationGate, review both, lessons, writer lease, claim reachability,
      plan-end external-both and userValidationOk stay. This plan adds host-thin
      UX and decision-review.
  - id: P7
    title: No new top-level skill
    body: Extend implement and shared assets plus pure helpers and tests. No
      skills/core/automate.md.
glossary:
  - term: host-thin
    definition: Automate host role limited to dispatch, merge, verbatim re-verify,
      state close helpers, and hardgate surfaces
  - term: phase agent
    definition: Spawned executor for one phase under a constructed work-order brief
  - term: decision log
    definition: Durable per-phase record of load-bearing routing, tradeoffs, and
      dispositions
  - term: decision-review
    definition: "Manual hardgate: operator PASS/FAIL on the decision log before
      phase-done completes under automate"
  - term: phase-start stop
    definition: Intentional halt when the active phase is descriptor-only pending
      materialize and businessIntent
phases:
  - id: F0
    slug: implement-phase-agents-f0-contract-freeze-and-antipatterns
    title: Contract freeze and antipatterns
    goal: Freeze the operator-facing automate contract in durable skill prose and
      antipatterns so later code phases implement one agreed shape.
    dependsOn: []
    subPhaseCount: 3
    exitGate:
      summary: 3 criteria to meet
      criteria:
        - id: F0-G1
          description: Contract strings for host-thin, phase-start stop, and
            decision-review appear in implement and maestro assets.
          status: pending
          verifier:
            kind: shell
            command: rg -n 'host-thin|decision-review|phase-start' skills/core/implement.md
              skills/shared/implement-automate-maestro.md
            expectExitCode: 0
        - id: F0-G2
          description: Antipatterns file covers host product diagnostics and auto PASS on
            decision-review.
          status: pending
          verifier:
            kind: shell
            command: rg -n 'decision-review|compose|build_edl'
              skills/shared/implement-antipatterns.md
            expectExitCode: 0
        - id: F0-G3
          description: Manual HARD — Henry confirms F0 contract text matches the ratified
            design (host-thin, materialize pause OK, decision-review hardgate).
          status: pending
          verifier:
            kind: manual
            description: Henry acks F0 contract in gate-signoff or chat with explicit PASS
              on design alignment.
    status: active
    businessIntent:
      value: "Sob automate o host fica magro: cada fase roda em agente fresco; no
        inicio da fase o operador materializa e valida businessIntent; decisoes
        do agente ficam no decision log; phase-done exige hardgate manual de
        decision-review (so o operador escreve PASS)."
      workflow: Congelar contrato em prosa e antipatterns (F0) → decision log duravel
        (F1) → ban de execucao de produto no host e banners (F2) → schema e
        preflight decisionReview (F3) → ritual Step H materialize/proximo agente
        (F4) → testes fixture + dogfood checklist (F5).
      rules: Nunca auto-materializar BI. Nunca agente escrever decision-review PASS.
        Nunca editar product source no host sob automate. Nao remover
        evaluationGate review both lessons lease claim. Sem
        skills/core/automate.md. Mode 1 e Mode 2 intocados.
      outOfScope: Daemon Layer 4 multi-host; default automate global; trabalho de
        produto em curta; reescrever Mode 1 ou Mode 2; auto-PASS de gates
        manuais de produto.
      doneWhen: Contrato host-thin + phase-start stop + decision-review hardgate
        greppable em implement/maestro/antipatterns; Henry PASS no gate manual
        F0-G3.
    summary: Congela contrato host-thin, phase-start stop e decision-review em prosa.
  - id: F1
    slug: implement-phase-agents-f1-decision-log-schema-and-append-path
    title: Decision log schema and append path
    goal: Make load-bearing automate decisions durable and machine-addressable so
      decision-review can hard-block without relying on chat history.
    dependsOn:
      - F0
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F1-G1
          description: decision-log unit tests pass.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/decision-log.test.js
            expectExitCode: 0
        - id: F1-G2
          description: Decision log asset and maestro wiring strings exist.
          status: pending
          verifier:
            kind: shell
            command: test -s skills/shared/implement-decision-log.md && rg -n 'decision
              log|decision-log' skills/shared/implement-automate-maestro.md
            expectExitCode: 0
    status: pending
    summary: Decision log duravel com helper de append e wiring no maestro.
  - id: F2
    slug: implement-phase-agents-f2-host-thin-maestro-and-product-executi
    title: Host-thin maestro and product execution ban
    goal: Enforce host-thin behavior in skill prose and STOP helpers so automate
      cannot honestly run as a host mega-implementer.
    dependsOn:
      - F1
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F2-G1
          description: Host-thin and product entrypoint ban strings exist in maestro and
            implement.
          status: pending
          verifier:
            kind: shell
            command: rg -n 'host-thin|verbatim|product'
              skills/shared/implement-automate-maestro.md
              skills/core/implement.md
            expectExitCode: 0
        - id: F2-G2
          description: Orchestrator gate tests pass including descriptor-only coverage.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/automate-orchestrator-gates.test.js
            expectExitCode: 0
    status: pending
    summary: Ban de entrypoints de produto no host e preflight descriptor-only.
  - id: F3
    slug: implement-phase-agents-f3-decision-review-hardgate-on-phase-don
    title: Decision-review hardgate on phase-done
    goal: Machine-enforce that automate phase-done cannot complete without operator
      PASS on the phase decision log.
    dependsOn:
      - F2
    subPhaseCount: 0
    exitGate:
      summary: 3 criteria to meet
      criteria:
        - id: F3-G1
          description: decision-review gate unit tests pass.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/decision-review-gate.test.js
            expectExitCode: 0
        - id: F3-G2
          description: canRunPhaseDone and assert wiring mention decisionReview.
          status: pending
          verifier:
            kind: shell
            command: rg -n 'decisionReview|decision-review'
              src/automate-orchestrator-gates.js scripts/assert-automate-gate.js
            expectExitCode: 0
        - id: F3-G3
          description: Manual HARD — Henry confirms agent cannot stamp decision-review
            PASS in the documented procedure.
          status: pending
          verifier:
            kind: manual
            description: Henry PASS on F3 manual gate after reading PASS procedure.
    status: pending
    summary: Hardgate decisionReview no phase-done sob automate.
  - id: F4
    slug: implement-phase-agents-f4-phase-boundary-ritual-and-next-agent
    title: Phase boundary ritual and next agent
    goal: After phase-done, automate always ends with a clear
      materialize-or-spawn-next-agent ritual instead of a silent host stop or
      host mega-continuation.
    dependsOn:
      - F3
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F4-G1
          description: Step H ritual strings present in maestro.
          status: pending
          verifier:
            kind: shell
            command: rg -n 'automate paused|Step H|fresh'
              skills/shared/implement-automate-maestro.md
            expectExitCode: 0
        - id: F4-G2
          description: Lazy materialization KB updated for host-thin automate.
          status: pending
          verifier:
            kind: shell
            command: rg -n 'host-thin|decision-review|phase agent'
              docs/kb/project-lazy-materialization.md
            expectExitCode: 0
    status: pending
    summary: "Ritual Step H: materialize ou spawn do proximo agente fresco."
  - id: F5
    slug: implement-phase-agents-f5-tests-fixtures-docs-and-dogfood-check
    title: Tests fixtures docs and dogfood checklist
    goal: Prove the contract with automated tests and a dogfood checklist so the
      next automate run on a real plan cannot skip decision-review or host-thin
      rules unnoticed.
    dependsOn:
      - F4
    subPhaseCount: 0
    exitGate:
      summary: 3 criteria to meet
      criteria:
        - id: F5-G1
          description: Contract fixture tests pass.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/implement-phase-agents-contract.test.js
            expectExitCode: 0
        - id: F5-G2
          description: Dogfood checklist and memory reference exist.
          status: pending
          verifier:
            kind: shell
            command: test -s docs/kb/implement-phase-agents-dogfood.md && test -s
              .ai/memory/reference-implement-phase-agents.md
            expectExitCode: 0
        - id: F5-G3
          description: Manual HARD — Henry dogfoods checklist on a small multi-phase plan
            or records explicit defer with reason after F5 code green.
          status: pending
          verifier:
            kind: manual
            description: Henry runs dogfood checklist or writes defer reason in plan
              decisions.
    status: pending
    summary: Fixtures, dogfood checklist e ponteiros de memoria.
references: []
supersedes:
  path: .atomic-skills/projects/atomic-skills/implementation-automate-mode/plan.md
  supersedeScope: partial
  partialAreas:
    - operator-facing pure-maestro host role
    - phase boundary materialize handoff
    - mandatory decision-review hardgate
  remainsValid:
    - mode parse and executionMode stamp
    - code-only phase writer and claim report
    - writer lease and sibling worktree
    - evaluationGate and phase review both
    - plan-end external-both and userValidationOk
    - assert-automate-gate machine layers from automate-skill-discipline
---
# Implement phase agents (host-thin automate)

## 1. Context



## 2. Principles

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

## 3. Phase tree

| Phase | Title | Summary |
|-------|-------|---------|
| F0 | Contract freeze and antipatterns | Congela contrato host-thin, phase-start stop e decision-review em prosa. |
| F1 | Decision log schema and append path | Decision log duravel com helper de append e wiring no maestro. |
| F2 | Host-thin maestro and product execution ban | Ban de entrypoints de produto no host e preflight descriptor-only. |
| F3 | Decision-review hardgate on phase-done | Hardgate decisionReview no phase-done sob automate. |
| F4 | Phase boundary ritual and next agent | Ritual Step H: materialize ou spawn do proximo agente fresco. |
| F5 | Tests fixtures docs and dogfood checklist | Fixtures, dogfood checklist e ponteiros de memoria. |

## Reviews

- internal: 2026-07-22 20:38 — bootstrap review: structure 6 phases / 17 tasks SPEC-clean; T-003/T-017 verifier bleed from exit_gate YAML fixed post-materialize; supersedes partial vs implementation-automate-mode; F1–F5 descriptor-only by design. Major: none blocking bootstrap. Nit: re-materialize source needs blank separator before exit_gate fences to avoid decompose last-task verifier clobber.
