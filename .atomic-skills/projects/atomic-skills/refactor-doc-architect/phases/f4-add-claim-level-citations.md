---
schemaVersion: "0.1"
slug: refactor-doc-architect-f4-add-claim-level-citations
title: Add claim-level citations
goal: Close the one trust guardrail the source pipeline lacks — per-claim
  provenance captured at generation and confirmed at review.
status: pending
branch: main
started: 2026-05-31T20:37:21.595Z
lastUpdated: 2026-05-31T20:37:21.595Z
nextAction: "Start T-001: Add citation discipline to extraction steps"
parentPlan: refactor-doc-architect
phaseId: F4
tasksDone: 0
tasksTotal: 2
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: G-1
    description: a generated module doc carries a `file:line` citation on every
      load-bearing claim, and the verification pass fails when a citation does
      not resolve.
    status: pending
    verifier:
      kind: manual
      description: Verify exit-gate prose with the user during phase-done.
    verifierLabel: manual
stack:
  - id: 1
    title: Add claim-level citations
    type: task
    openedAt: 2026-05-31T20:37:21.595Z
tasks:
  - id: T-001
    title: Add citation discipline to extraction steps
    description: "Define ONE citation grammar and align task with the F4 exit gate
      (codex F-004). Every FINAL load-bearing claim (business rule, flow edge,
      permission, validation) carries a resolvable `file:line` token —
      `path:line` or `path:line-range`, NOT a bare symbol, because the gate
      verifies citations resolve to a line. Statements the pipeline cannot cite
      are marked confidence flags AND excluded from the final generated doc
      (they may live in a separate 'unverified inferences' section, never as
      asserted fact). `verified_by: citation grammar documented in the F4 step
      prose; gate parser resolves every file:line in a generated doc`."
    status: pending
    lastUpdated: 2026-05-31T20:37:21.595Z
  - id: T-002
    title: Extend the verification pass to check provenance and diagram edges
    description: 'The existing verification step re-reads cited sources to confirm
      each claim, and treats every Mermaid diagram edge as a verifiable claim
      that must trace to real code. `verified_by: source has
      references/verification-checklist.md and step-05/step-06b emit Mermaid
      stateDiagram-v2/flowchart/sequence with a "diagrams must match code
      exactly" rule`.'
    status: pending
    lastUpdated: 2026-05-31T20:37:21.595Z
parked: []
emerged: []
summary: "Citações por claim: proveniência capturada na geração e confirmada no
  review — o guardrail de confiança que faltava."
planTitle: Refactor doc-architect into an atomic-skill
---

# Narrative / notes

Initiative for phase **F4 — Add claim-level citations**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
