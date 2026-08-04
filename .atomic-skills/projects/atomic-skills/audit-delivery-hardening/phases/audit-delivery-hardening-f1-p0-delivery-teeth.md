---
schemaVersion: "0.1"
slug: audit-delivery-hardening-f1-p0-delivery-teeth
title: P0 delivery teeth
goal: Close false-CLOSED paths — hard Intent Package admission, domain-agnostic residual protocol, product+residual defaults, severity closing rules with Accept Records; demote audit-and-fix from primary identity.
summary: Intent Package hard, residual protocol, axes, verdict Accept Record
status: active
branch: develop
started: 2026-08-04T14:47:56.119Z
lastUpdated: 2026-08-04T14:47:56.119Z
nextAction: implement F1 tasks T-006 through T-010
parentPlan: audit-delivery-hardening
phaseId: F1
businessIntent:
  value: A green suite cannot close delivery; half-migration residual and missing acceptance/vocabulary cannot reach CLOSED.
  workflow: Intent package asset+gate; residual-hunt-protocol; default axes; verdict-gate+Accept Record; composition note over in-skill fix PM loop.
  rules: CRITICAL never accepted to CLOSED; residual opt-out caps PARTIAL; Lekto greps are examples only.
  outOfScope: Multi-hop stage columns, Matrix C, Spec Package, --depth, critic topology, static asset graph test.
  doneWhen: intent-package, residual-hunt-protocol, verdict-gate assets exist and body encodes product+residual default and Accept Record rules.
tasksDone: 0
tasksTotal: 5
gatesMet: 0
gatesTotal: 1
stack: []
parked: []
emerged: []
exitGates:
  - id: G-F1-1
    description: Intent + residual protocol + verdict assets; default axes
    status: pending
    verifier:
      kind: shell
      command: test -f skills/shared/audit-delivery-assets/intent-package.md && test -f skills/shared/audit-delivery-assets/residual-hunt-protocol.md && test -f skills/shared/audit-delivery-assets/verdict-gate.md && rg -q 'product,residual|product \+ residual' skills/core/audit-delivery.md
      expectExitCode: 0
tasks:
  - id: T-006
    title: Intent Package template + admission gate
    status: pending
    lastUpdated: 2026-08-04T14:47:56.119Z
    scopeBoundary:
      - Do not implement full businessIntent importer (F4).
    acceptance:
      - HARD-GATE requires decisions/problems plus acceptance (or doneWhen) and vocabulary delta for migrations; surface inventory or single-surface flag; abort points at template.
    verifier:
      kind: shell
      command: test -f skills/shared/audit-delivery-assets/intent-package.md && rg -n 'Intent Package|vocabulary|surface inventory|acceptance' skills/core/audit-delivery.md skills/shared/audit-delivery-assets/intent-package.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/audit-delivery-assets/intent-package.md
      - kind: file
        path: skills/core/audit-delivery.md
  - id: T-007
    title: Residual hunt protocol domain-agnostic
    status: pending
    lastUpdated: 2026-08-04T14:47:56.119Z
    scopeBoundary:
      - Lekto examples only as e.g., not universal steps.
    acceptance:
      - Protocol OLD_TERMS/NEW_TERMS x surfaces with classification; invalid residual blocks CLOSED.
    verifier:
      kind: shell
      command: test -f skills/shared/audit-delivery-assets/residual-hunt-protocol.md && rg -n 'OLD_TERMS|surface inventory|invalid residual' skills/shared/audit-delivery-assets/residual-hunt-protocol.md skills/core/audit-delivery.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/audit-delivery-assets/residual-hunt-protocol.md
  - id: T-008
    title: Default axes product+residual; opt-out caps PARTIAL
    status: pending
    lastUpdated: 2026-08-04T14:47:56.119Z
    scopeBoundary:
      - backend/frontend remain valid --axes values.
    acceptance:
      - Default axes product,residual; excluding residual logs and caps verdict PARTIAL.
    verifier:
      kind: shell
      command: rg -n 'product,residual|product \+ residual|cap.*PARTIAL|exclude.residual' skills/core/audit-delivery.md meta/catalog.yaml
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/audit-delivery.md
      - kind: file
        path: meta/catalog.yaml
  - id: T-009
    title: Verdict gate + Accept Record schema
    status: pending
    lastUpdated: 2026-08-04T14:47:56.119Z
    scopeBoundary:
      - Multi-hop stages are F2.
    acceptance:
      - CLOSED needs zero CRITICAL; CRITICAL never accepted; HIGH needs Accept Record or PARTIAL; suite alone never upgrades.
    verifier:
      kind: shell
      command: test -f skills/shared/audit-delivery-assets/verdict-gate.md && rg -n 'Accept Record|CRITICAL|CLOSED|green suite' skills/shared/audit-delivery-assets/verdict-gate.md skills/core/audit-delivery.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/audit-delivery-assets/verdict-gate.md
  - id: T-010
    title: Demote audit-and-fix from primary path
    status: pending
    lastUpdated: 2026-08-04T14:47:56.119Z
    scopeBoundary:
      - Keep composition recipe path; full fix WP optional F4.
    acceptance:
      - Default audit RO; composition audit then fix then re-run; catalog examples prefer re-run.
    verifier:
      kind: shell
      command: rg -n 'read-only|re-run|composition|parallel-dispatch' skills/core/audit-delivery.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/audit-delivery.md
      - kind: file
        path: meta/catalog.yaml
startedCommit: ed413703ad1540885c48f355a00c4c128f54867f
---

# F1 — P0 delivery teeth

Canonical detail: `docs/plans/audit-delivery-hardening.md` § F1.

## Session handoff
- **Narrative:** F1 materialized from sidecar with ratified BI; ready for work-order + phase writer.
- **Decision log:** Operator-delegated F1 package ratify (BI from plan descriptor as-is).
- **Single nextAction:** assert spawn + automate-phase-run prepare + spawn F1 writer for T-006..T-010.
- **Verbatim state:** initiative=.atomic-skills/projects/atomic-skills/audit-delivery-hardening/phases/audit-delivery-hardening-f1-p0-delivery-teeth.md; phaseId=F1; branch=develop.
- **Uncommitted changes:** materialize pending commit.

