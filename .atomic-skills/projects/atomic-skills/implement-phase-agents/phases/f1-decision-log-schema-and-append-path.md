---
schemaVersion: "0.1"
slug: implement-phase-agents-f1-decision-log-schema-and-append-path
title: Decision log schema and append path
goal: Make load-bearing automate decisions durable and machine-addressable so decision-review can hard-block without relying on chat history.
status: active
branch: plan/implement-phase-agents
started: 2026-07-22T23:30:10.467Z
lastUpdated: 2026-07-22T23:31:10.325Z
nextAction: SYNC WAIT F1 phase writer claim report (T-004..T-006).
parentPlan: implement-phase-agents
phaseId: F1
businessIntent:
  value: Sob automate, decisoes de routing, tradeoff, disposition e hardgates manuais ficam em decision log duravel por fase, para decision-review e auditoria sem depender de chat.
  workflow: Asset de path/shape (T-004) → helper pure/fs append+list + testes (T-005) → wiring maestro/phase-writer/implement (T-006) → F2+ usa o log e F3 machine-hardgate decisionReview.
  rules: "So o operador escreve decision-review PASS. Agente so append de entradas. Sem secrets/lease secrets no log. Append rejeita decision vazio ou category ausente. Categories minimas: routing, tradeoff, review-disposition, scope-exit, manual-gate-delegation, env. Nao auto-PASS de decision-review no evaluator."
  outOfScope: Layer 4 daemon; reescrever Mode 1/2; auto-PASS de gates manuais de produto; network I/O no helper; writer mutando plan.md status.
  doneWhen: Asset implement-decision-log + helper com testes verdes + maestro greppable para decision log/decision-log; F1-G1 e F1-G2 metiveis.
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 2
exitGates:
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
      command: test -s skills/shared/implement-decision-log.md && rg -n 'decision log|decision-log' skills/shared/implement-automate-maestro.md
      expectExitCode: 0
stack:
  - id: 1
    title: Decision log schema and append path
    type: task
    openedAt: 2026-07-22T23:30:10.467Z
tasks:
  - id: T-004
    title: Decision log path and entry shape
    status: pending
    lastUpdated: 2026-07-22T23:30:10.467Z
    scopeBoundary:
      - Do not store secrets or writer-lease secrets in the decision log. Do not make the evaluator auto-PASS decision-review.
    acceptance:
      - it - Asset documents per-phase durable path under the plan tree and required fields id category decision why evidencePath impact at ISO timestamp.; it - Categories include routing tradeoff review-disposition scope-exit manual-gate-delegation env at minimum.; it - Asset states only the operator writes decision-review PASS and the agent only appends decision entries.
    verifier:
      kind: shell
      command: test -s skills/shared/implement-decision-log.md && rg -n 'decision-review|category|evidencePath|operator' skills/shared/implement-decision-log.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/implement-decision-log.md
      - kind: file
        path: docs/kb/implement-decision-log.md
  - id: T-005
    title: Pure helper append and read decision log
    status: pending
    lastUpdated: 2026-07-22T23:30:10.467Z
    scopeBoundary:
      - Do not perform network I/O. Do not write decision-review PASS from append APIs.
    acceptance:
      - it - Pure or fs-scoped helpers can append a validated entry and list entries for a phase.; it - Append rejects empty decision or missing category.; it - Unit tests cover append list and reject paths.; it - No API stamps decisionReview status PASS.
    verifier:
      kind: shell
      command: node --test tests/decision-log.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/decision-log.js
      - kind: file
        path: tests/decision-log.test.js
  - id: T-006
    title: Wire decision log into maestro and phase-writer briefs
    status: pending
    lastUpdated: 2026-07-22T23:30:10.467Z
    scopeBoundary:
      - Do not allow phase writer to mutate plan.md phase status fields. Do not remove claim report requirements.
    acceptance:
      - it - Maestro requires every re-dispatch skip disposition and scope exit to append a decision log entry before continuing.; it - Phase-writer brief requires recording product tradeoffs that change behavior outside pure task text into the decision log path provided by the work-order.; it - implement.md points at the decision log asset for automate.
    verifier:
      kind: shell
      command: test -s skills/shared/implement-decision-log.md && rg -n 'decision log|decision-log' skills/shared/implement-automate-maestro.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/implement-automate-maestro.md
      - kind: file
        path: skills/shared/implement-phase-writer.md
      - kind: file
        path: skills/core/implement.md
parked: []
emerged: []
---

# Narrative / notes

Initiative for phase **F1 — Decision log schema and append path**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

## Session handoff
- **Narrative:** Pure-maestro pre-dispatch F1. About to spawn sibling phase writer for T-004..T-006 (decision log asset, helper+tests, maestro wiring).
- **Decision log:** F1 materialized with draft BI validate-only. Lessons none. executionMode automate.
- **Single nextAction:** SYNC WAIT phase writer claim report for F1; then merge + post-merge done.
- **Verbatim state:** HEAD=undefined; writerBranch=impl/implement-phase-agents-F1-writer; worktreePath=/Volumes/External/code/atomic-skills/.worktrees/implement-phase-agents-F1-writer; baseRef=undefined.
- **Uncommitted changes:** handoff dirty until pre-dispatch commit.
