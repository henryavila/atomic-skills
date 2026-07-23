---
schemaVersion: "0.1"
slug: implement-phase-agents
title: Implement phase agents (host-thin automate)
version: "1.0"
status: active
started: 2026-07-22T20:36:08.845Z
lastUpdated: 2026-07-23T00:58:11.685Z
branch: plan/implement-phase-agents
currentPhase: F2
executionMode: automate
parallelismAllowed: false
principles:
  - id: P1
    title: Host-thin under automate
    body: The host never edits product source and never runs product diagnostics outside verbatim task or exit-gate verifiers. Phase work runs in spawned agents.
  - id: P2
    title: Fresh agent per phase
    body: Each phase gets a new agent context with a constructed brief only. Host chat history is not passed. After phase-done the next phase agent is a new spawn following materialize when required.
  - id: P3
    title: Phase-start draft then validate
    body: At phase start under automate the skill presents phase objective, task list (ids and titles), and a drafted businessIntent. Operator work is validate or edit task titles and the BI then ratify — never blank-fill BI from scratch. Draft is not PASS; silent auto-PASS is forbidden.
  - id: P4
    title: Durable decisions
    body: Load-bearing decisions are appended to a durable per-phase decision log. Chat-only decisions do not count as recorded.
  - id: P5
    title: Decision-review is a manual hardgate
    body: Under automate, phase advance requires operator PASS on the decision log. Agents never write that PASS. Distinct from product exit gates and from review-code.
  - id: P6
    title: Keep machine foundation
    body: evaluationGate, review both, lessons, writer lease, claim reachability, plan-end external-both and userValidationOk stay. This plan adds host-thin UX and decision-review.
  - id: P7
    title: No new top-level skill
    body: Extend implement and shared assets plus pure helpers and tests. No skills/core/automate.md.
glossary:
  - term: host-thin
    definition: Automate host role limited to dispatch, merge, verbatim re-verify, state close helpers, and hardgate surfaces
  - term: phase agent
    definition: Spawned executor for one phase under a constructed work-order brief
  - term: decision log
    definition: Durable per-phase record of load-bearing routing, tradeoffs, and dispositions
  - term: decision-review
    definition: "Manual hardgate: operator PASS/FAIL on the decision log before phase-done completes under automate"
  - term: phase-start package
    definition: "Before spawning the phase agent: show phase objective, task list, and drafted businessIntent; operator validates task titles and BI then ratifies"
  - term: validate-only
    definition: "Operator role at phase start: accept or edit task titles and businessIntent; does not invent the spine or task list from a blank form"
phases:
  - id: F0
    slug: implement-phase-agents-f0-contract-freeze-and-antipatterns
    title: Contract freeze and antipatterns
    goal: Freeze the operator-facing automate contract in durable skill prose and antipatterns so later code phases implement one agreed shape.
    dependsOn: []
    subPhaseCount: 3
    exitGate:
      summary: 3 criteria to meet
      criteria:
        - id: F0-G1
          description: Contract strings for host-thin, phase-start package (draft businessIntent / validate-only), and decision-review appear in implement and maestro assets.
          status: met
          verifier:
            kind: shell
            command: rg -n 'host-thin|decision-review|phase-start|validate-only|draft' skills/core/implement.md skills/shared/implement-automate-maestro.md
            expectExitCode: 0
          metAt: 2026-07-22T22:37:27.000Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-22T22:37:27.000Z
            verifiedCommit: 253e79362931d352944083ccc308cc77e1184128
            passed: true
            exitCode: 0
            outputSummary: rg host-thin|decision-review|phase-start|validate-only|draft implement+maestro EXIT 0
        - id: F0-G2
          description: Antipatterns file covers host product diagnostics and auto PASS on decision-review.
          status: met
          verifier:
            kind: shell
            command: rg -n 'decision-review|compose|build_edl' skills/shared/implement-antipatterns.md
            expectExitCode: 0
          metAt: 2026-07-22T22:37:27.000Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-22T22:37:27.000Z
            verifiedCommit: 253e79362931d352944083ccc308cc77e1184128
            passed: true
            exitCode: 0
            outputSummary: rg decision-review|compose|build_edl antipatterns EXIT 0
        - id: F0-G3
          description: "Manual HARD — Henry confirms F0 contract: host-thin; phase-start presents objective+tasks+draft BI; operator only validates titles and BI; decision-review hardgate."
          status: met
          verifier:
            kind: manual
            description: Henry acks F0 contract in gate-signoff or chat with explicit PASS on design alignment.
          metAt: 2026-07-22T22:37:27.000Z
          evidence:
            verifierKind: manual
            verifiedAt: 2026-07-22T22:37:27.000Z
            verifiedCommit: 253e79362931d352944083ccc308cc77e1184128
            passed: true
            outputSummary: Henry PASS F0 contract 2026-07-22 (host-thin; phase-start draft BI validate-only; decision-review hardgate)
    status: done
    businessIntent:
      value: "Sob automate o host fica magro: cada fase roda em agente fresco; no inicio da fase o skill apresenta objetivo + lista de tasks + businessIntent rascunhado para o operador so validar (titulos e BI); decisoes do agente ficam no decision log; phase-done exige hardgate manual de decision-review (so o operador escreve PASS)."
      workflow: Congelar contrato em prosa e antipatterns (F0) → decision log duravel (F1) → ban de execucao de produto no host e banners (F2) → schema e preflight decisionReview (F3) → ritual phase-start package + Step H (F4) → testes fixture + dogfood checklist (F5).
      rules: Nunca pedir BI em branco. Skill rascunha objetivo, tasks e BI; operador so valida ou edita e ratifica. Nunca auto-PASS de BI ou decision-review. Nunca editar product source no host sob automate. Nao remover evaluationGate review both lessons lease claim. Sem skills/core/automate.md. Mode 1 e Mode 2 intocados.
      outOfScope: Daemon Layer 4 multi-host; default automate global; trabalho de produto em curta; reescrever Mode 1 ou Mode 2; auto-PASS de gates manuais de produto.
      doneWhen: Contrato host-thin + phase-start package (draft BI + validate-only) + decision-review hardgate greppable em implement/maestro/antipatterns; Henry PASS no gate manual F0-G3.
    summary: Congela contrato host-thin, phase-start package (draft→validate) e decision-review.
    evaluationGate:
      status: passed
      verdict: pass
      verifiedAt: 2026-07-22T22:37:27.000Z
      at: 253e79362931d352944083ccc308cc77e1184128
    reviewGate:
      status: passed
      at: 253e79362931d352944083ccc308cc77e1184128
      mode: both
      reviewFile: .atomic-skills/reviews/implement-phase-agents-F0-both-253e793.md
      verifiedAt: 2026-07-22T22:37:27.000Z
  - id: F1
    slug: implement-phase-agents-f1-decision-log-schema-and-append-path
    title: Decision log schema and append path
    goal: Make load-bearing automate decisions durable and machine-addressable so decision-review can hard-block without relying on chat history.
    dependsOn:
      - F0
    subPhaseCount: 1
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F1-G1
          description: decision-log unit tests pass.
          status: met
          verifier:
            kind: shell
            command: node --test tests/decision-log.test.js
            expectExitCode: 0
          metAt: 2026-07-22T23:56:41.000Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-22T23:56:41.000Z
            verifiedCommit: 4b08a89aefc3419ed5d4c9e8369ffce26d8265af
            passed: true
            exitCode: 0
            outputSummary: node --test tests/decision-log.test.js 38 pass
        - id: F1-G2
          description: Decision log asset and maestro wiring strings exist.
          status: met
          verifier:
            kind: shell
            command: test -s skills/shared/implement-decision-log.md && rg -n 'decision log|decision-log' skills/shared/implement-automate-maestro.md
            expectExitCode: 0
          metAt: 2026-07-22T23:56:41.000Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-22T23:56:41.000Z
            verifiedCommit: 4b08a89aefc3419ed5d4c9e8369ffce26d8265af
            passed: true
            exitCode: 0
            outputSummary: asset + maestro decision log|decision-log EXIT 0
    status: done
    summary: Decision log duravel com helper de append e wiring no maestro.
    businessIntent:
      value: Sob automate, decisoes de routing, tradeoff, disposition e hardgates manuais ficam em decision log duravel por fase, para decision-review e auditoria sem depender de chat.
      workflow: Asset de path/shape (T-004) → helper pure/fs append+list + testes (T-005) → wiring maestro/phase-writer/implement (T-006) → F2+ usa o log e F3 machine-hardgate decisionReview.
      rules: "So o operador escreve decision-review PASS. Agente so append de entradas. Sem secrets/lease secrets no log. Append rejeita decision vazio ou category ausente. Categories minimas: routing, tradeoff, review-disposition, scope-exit, manual-gate-delegation, env. Nao auto-PASS de decision-review no evaluator."
      outOfScope: Layer 4 daemon; reescrever Mode 1/2; auto-PASS de gates manuais de produto; network I/O no helper; writer mutando plan.md status.
      doneWhen: Asset implement-decision-log + helper com testes verdes + maestro greppable para decision log/decision-log; F1-G1 e F1-G2 metiveis.
    evaluationGate:
      status: passed
      verdict: pass
      verifiedAt: 2026-07-22T23:56:41.000Z
      at: 4b08a89aefc3419ed5d4c9e8369ffce26d8265af
    reviewGate:
      status: passed
      at: 4b08a89aefc3419ed5d4c9e8369ffce26d8265af
      mode: both
      reviewFile: .atomic-skills/reviews/implement-phase-agents-F1-both-4b08a89.md
      verifiedAt: 2026-07-22T23:56:41.000Z
  - id: F2
    slug: implement-phase-agents-f2-host-thin-maestro-and-product-executi
    title: Host-thin maestro and product execution ban
    goal: Enforce host-thin behavior in skill prose and STOP helpers so automate cannot honestly run as a host mega-implementer.
    dependsOn:
      - F1
    subPhaseCount: 1
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F2-G1
          description: Host-thin and product entrypoint ban strings exist in maestro and implement.
          status: pending
          verifier:
            kind: shell
            command: rg -n 'host-thin|verbatim|product' skills/shared/implement-automate-maestro.md skills/core/implement.md
            expectExitCode: 0
        - id: F2-G2
          description: Orchestrator gate tests pass including descriptor-only coverage.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/automate-orchestrator-gates.test.js
            expectExitCode: 0
    status: active
    summary: Ban de entrypoints de produto no host e preflight descriptor-only.
    businessIntent:
      value: "Sob automate o host permanece host-thin: nao executa entrypoints de produto (compose, build_edl, app servers) fora de verifiers verbatim; ban e preflight ficam greppable e testaveis para impedir mega-sessao do host."
      workflow: Ban de product entrypoints + antipatterns (T-007) → role banner e phase-start validate-only nos stops (T-008) → assert/preflight descriptor-only e lease (T-009) → F3+ hardgate decisionReview e ritual.
      rules: Nao banir comando shell do task.verifier ou exit-gate. Nao banir git-ops merge/status/log. Permitir assert-automate-gate, validate-state e verifiers copiados verbatim. Nao auto-spawn sem ratify do phase-start package. Nao implementar process supervisor. Nao exigir network no assert.
      outOfScope: Layer 4 daemon; reescrever Mode 1/2; auto-PASS de gates manuais de produto; banir verifiers legitimos; network no assert.
      doneWhen: Strings host-thin/product/verbatim greppable em maestro+implement; role banner/phase-start/validate-only greppable; testes automate-orchestrator-gates cobrem descriptor-only refuse; F2-G1 e F2-G2 metiveis.
  - id: F3
    slug: implement-phase-agents-f3-decision-review-hardgate-on-phase-don
    title: Decision-review hardgate on phase-done
    goal: Machine-enforce that automate phase-done cannot complete without operator PASS on the phase decision log.
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
            command: rg -n 'decisionReview|decision-review' src/automate-orchestrator-gates.js scripts/assert-automate-gate.js
            expectExitCode: 0
        - id: F3-G3
          description: Manual HARD — Henry confirms agent cannot stamp decision-review PASS in the documented procedure.
          status: pending
          verifier:
            kind: manual
            description: Henry PASS on F3 manual gate after reading PASS procedure.
    status: pending
    summary: Hardgate decisionReview no phase-done sob automate.
  - id: F4
    slug: implement-phase-agents-f4-phase-boundary-ritual-and-next-agent
    title: Phase boundary ritual and next agent
    goal: After phase-done and at every phase start, automate presents objective + tasks + drafted BI for operator validation, then spawns a fresh phase agent — never a blank BI form.
    dependsOn:
      - F3
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F4-G1
          description: Phase-start package and draft BI strings present in maestro.
          status: pending
          verifier:
            kind: shell
            command: rg -n 'phase-start|draft|validate-only|businessIntent' skills/shared/implement-automate-maestro.md
            expectExitCode: 0
        - id: F4-G2
          description: Lazy materialization KB updated for host-thin automate phase-start package.
          status: pending
          verifier:
            kind: shell
            command: rg -n 'host-thin|decision-review|phase-start|draft' docs/kb/project-lazy-materialization.md
            expectExitCode: 0
    status: pending
    summary: "Ritual phase-start: draft package, validate-only, then fresh phase agent."
  - id: F5
    slug: implement-phase-agents-f5-tests-fixtures-docs-and-dogfood-check
    title: Tests fixtures docs and dogfood checklist
    goal: Prove the contract with automated tests and a dogfood checklist so the next automate run on a real plan cannot skip decision-review or host-thin rules unnoticed.
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
            command: test -s docs/kb/implement-phase-agents-dogfood.md && test -s .ai/memory/reference-implement-phase-agents.md
            expectExitCode: 0
        - id: F5-G3
          description: Manual HARD — Henry dogfoods checklist on a small multi-phase plan or records explicit defer with reason after F5 code green.
          status: pending
          verifier:
            kind: manual
            description: Henry runs dogfood checklist or writes defer reason in plan decisions.
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
planActive: true
planTitle: Implement phase agents (host-thin automate)
---

# Implement phase agents (host-thin automate)

## 1. Context



## 2. Principles

### P1 Host-thin under automate

The host never edits product source and never runs product diagnostics outside verbatim task or exit-gate verifiers. Phase work runs in spawned agents.

### P2 Fresh agent per phase

Each phase gets a new agent context with a constructed brief only. Host chat history is not passed. After phase-done the next phase agent is a new spawn following materialize when required.

### P3 Phase-start draft then validate

At phase start under automate the skill presents phase objective, task list (ids and titles), and a drafted businessIntent. Operator work is validate or edit task titles and the BI then ratify — never blank-fill BI from scratch. Draft is not PASS.

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
| F0 | Contract freeze and antipatterns | Congela contrato host-thin, phase-start package (draft→validate) e decision-review. |
| F1 | Decision log schema and append path | Decision log duravel com helper de append e wiring no maestro. |
| F2 | Host-thin maestro and product execution ban | Ban de entrypoints de produto no host e preflight descriptor-only. |
| F3 | Decision-review hardgate on phase-done | Hardgate decisionReview no phase-done sob automate. |
| F4 | Phase boundary ritual and next agent | Ritual phase-start: draft package, validate-only, then fresh phase agent. |
| F5 | Tests fixtures docs and dogfood checklist | Fixtures, dogfood checklist e ponteiros de memoria. |

## Reviews

- operator-ratify: 2026-07-22T20:54:16.650Z — contract + F0 businessIntent (phase-start draft→validate-only)

- internal: 2026-07-22 20:38 — bootstrap review: structure 6 phases / 17 tasks SPEC-clean; T-003/T-017 verifier bleed from exit_gate YAML fixed post-materialize; supersedes partial vs implementation-automate-mode; F1–F5 descriptor-only by design. Major: none blocking bootstrap. Nit: re-materialize source needs blank separator before exit_gate fences to avoid decompose last-task verifier clobber.


## Operator ratifications

- **2026-07-22T20:54:16.650Z** — Henry `ratify` on implement-phase-agents contract:
  - host-thin automate (agent per phase, fresh context)
  - phase-start **package**: objective + tasks (id/title) + **drafted** businessIntent
  - operator work = **validate-only** (edit titles/BI then ratify); no blank BI form
  - decision-review manual hardgate at phase end (agent never PASS)
  - F0 businessIntent spine accepted as drafted in plan state
