---
schemaVersion: "0.1"
slug: audit-delivery-hardening-f1-p0-delivery-teeth
title: P0 delivery teeth
goal: Close false-CLOSED paths — hard Intent Package admission, domain-agnostic
  residual protocol, product+residual defaults, severity closing rules with
  Accept Records; demote audit-and-fix from primary identity.
summary: Intent Package hard, residual protocol, axes, verdict Accept Record
status: done
branch: develop
started: 2026-08-04T14:47:56.119Z
lastUpdated: 2026-08-04T14:55:35.303Z
nextAction: null
parentPlan: audit-delivery-hardening
phaseId: F1
businessIntent:
  value: A green suite cannot close delivery; half-migration residual and missing
    acceptance/vocabulary cannot reach CLOSED.
  workflow: Intent package asset+gate; residual-hunt-protocol; default axes;
    verdict-gate+Accept Record; composition note over in-skill fix PM loop.
  rules: CRITICAL never accepted to CLOSED; residual opt-out caps PARTIAL; Lekto
    greps are examples only.
  outOfScope: Multi-hop stage columns, Matrix C, Spec Package, --depth, critic
    topology, static asset graph test.
  doneWhen: intent-package, residual-hunt-protocol, verdict-gate assets exist and
    body encodes product+residual default and Accept Record rules.
stack: []
parked: []
emerged: []
tasksDone: 5
tasksTotal: 5
gatesMet: 1
gatesTotal: 1
weightDone: 5
weightTotal: 5
exitGates:
  - id: G-F1-1
    description: Intent + residual protocol + verdict assets; default axes
    status: met
    verifier:
      kind: shell
      command: test -f skills/shared/audit-delivery-assets/intent-package.md && test
        -f skills/shared/audit-delivery-assets/residual-hunt-protocol.md && test
        -f skills/shared/audit-delivery-assets/verdict-gate.md && rg -q
        'product,residual|product \+ residual' skills/core/audit-delivery.md
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-08-04T14:55:35.303Z
      passed: true
      exitCode: 0
      verifiedCommit: 5f3191de3dcafb8d502bb6d75fd8ad4bdef23405
      outputSummary: G-F1-1 green
    verifierLabel: "shell: test -f skills/shared/audit-delivery-assets/intent-package.…"
    evidenceSummary: passed · 2026-08-04
tasks:
  - id: T-006
    title: Intent Package template + admission gate
    status: done
    lastUpdated: 2026-08-04T14:55:35.303Z
    scopeBoundary:
      - Do not implement full businessIntent importer (F4).
    acceptance:
      - HARD-GATE requires decisions/problems plus acceptance (or doneWhen) and
        vocabulary delta for migrations; surface inventory or single-surface
        flag; abort points at template.
    verifier:
      kind: shell
      command: test -f skills/shared/audit-delivery-assets/intent-package.md && rg -n
        'Intent Package|vocabulary|surface inventory|acceptance'
        skills/core/audit-delivery.md
        skills/shared/audit-delivery-assets/intent-package.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/audit-delivery-assets/intent-package.md
      - kind: file
        path: skills/core/audit-delivery.md
    closedAt: 2026-08-04T14:55:35.303Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-08-04T14:55:35.303Z
      passed: true
      exitCode: 0
      verifiedCommit: 5f3191de3dcafb8d502bb6d75fd8ad4bdef23405
      outputSummary: intent-package.md created with micro skeleton, admission (spine +
        acceptance + vocabulary + surface inventory), abort table. Phase 0
        HARD-GATE wired. Verifier exit 0.
  - id: T-007
    title: Residual hunt protocol domain-agnostic
    status: done
    lastUpdated: 2026-08-04T14:55:35.303Z
    scopeBoundary:
      - Lekto examples only as e.g., not universal steps.
    acceptance:
      - Protocol OLD_TERMS/NEW_TERMS x surfaces with classification; invalid
        residual blocks CLOSED.
    verifier:
      kind: shell
      command: test -f skills/shared/audit-delivery-assets/residual-hunt-protocol.md
        && rg -n 'OLD_TERMS|surface inventory|invalid residual'
        skills/shared/audit-delivery-assets/residual-hunt-protocol.md
        skills/core/audit-delivery.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/audit-delivery-assets/residual-hunt-protocol.md
    closedAt: 2026-08-04T14:55:35.303Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-08-04T14:55:35.303Z
      passed: true
      exitCode: 0
      verifiedCommit: 5f3191de3dcafb8d502bb6d75fd8ad4bdef23405
      outputSummary: "residual-hunt-protocol.md: OLD_TERMS/NEW_TERMS x surfaces,
        classify storage|alias|teaching|dead, invalid residual blocks CLOSED.
        Body residual section wired. Verifier exit 0."
  - id: T-008
    title: Default axes product+residual; opt-out caps PARTIAL
    status: done
    lastUpdated: 2026-08-04T14:55:35.303Z
    scopeBoundary:
      - backend/frontend remain valid --axes values.
    acceptance:
      - Default axes product,residual; excluding residual logs and caps verdict
        PARTIAL.
    verifier:
      kind: shell
      command: rg -n 'product,residual|product \+
        residual|cap.*PARTIAL|exclude.residual' skills/core/audit-delivery.md
        meta/catalog.yaml
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/audit-delivery.md
      - kind: file
        path: meta/catalog.yaml
    closedAt: 2026-08-04T14:55:35.303Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-08-04T14:55:35.303Z
      passed: true
      exitCode: 0
      verifiedCommit: 5f3191de3dcafb8d502bb6d75fd8ad4bdef23405
      outputSummary: Default --axes product,residual; backend/frontend opt-in; exclude
        residual logs and caps PARTIAL. Catalog arg default updated. Verifier
        exit 0.
  - id: T-009
    title: Verdict gate + Accept Record schema
    status: done
    lastUpdated: 2026-08-04T14:55:35.303Z
    scopeBoundary:
      - Multi-hop stages are F2.
    acceptance:
      - CLOSED needs zero CRITICAL; CRITICAL never accepted; HIGH needs Accept
        Record or PARTIAL; suite alone never upgrades.
    verifier:
      kind: shell
      command: test -f skills/shared/audit-delivery-assets/verdict-gate.md && rg -n
        'Accept Record|CRITICAL|CLOSED|green suite'
        skills/shared/audit-delivery-assets/verdict-gate.md
        skills/core/audit-delivery.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/audit-delivery-assets/verdict-gate.md
    closedAt: 2026-08-04T14:55:35.303Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-08-04T14:55:35.303Z
      passed: true
      exitCode: 0
      verifiedCommit: 5f3191de3dcafb8d502bb6d75fd8ad4bdef23405
      outputSummary: verdict-gate.md Accept Record schema; CRITICAL never to CLOSED;
        HIGH needs Accept Record or PARTIAL; green suite never upgrades. Phase 3
        + report section. Verifier exit 0.
  - id: T-010
    title: Demote audit-and-fix from primary path
    status: done
    lastUpdated: 2026-08-04T14:55:35.303Z
    scopeBoundary:
      - Keep composition recipe path; full fix WP optional F4.
    acceptance:
      - Default audit RO; composition audit then fix then re-run; catalog
        examples prefer re-run.
    verifier:
      kind: shell
      command: rg -n 'read-only|re-run|composition|parallel-dispatch'
        skills/core/audit-delivery.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/audit-delivery.md
      - kind: file
        path: meta/catalog.yaml
    closedAt: 2026-08-04T14:55:35.303Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-08-04T14:55:35.303Z
      passed: true
      exitCode: 0
      verifiedCommit: 5f3191de3dcafb8d502bb6d75fd8ad4bdef23405
      outputSummary: Primary composition audit→fix/parallel-dispatch→re-run;
        audit-and-fix optional advanced. Catalog examples prefer re-run.
        Verifier exit 0.
startedCommit: ed413703ad1540885c48f355a00c4c128f54867f
planTitle: audit-delivery hardening — P0 craft + teeth, P1 evidence, P2 advanced
---

# F1 — P0 delivery teeth

Canonical detail: `docs/plans/audit-delivery-hardening.md` § F1.


## Session handoff
- **Narrative:** F1 delivery teeth closed (T-006..T-010). Intent package, residual protocol, verdict gate, product+residual defaults, composition path.
- **Decision log:** F1 package ratify; dual-leg CLEAN; decision-review PASS; lessons none.
- **Single nextAction:** operator-continue then materialize F2 phase-start package.
- **Verbatim state:** HEAD=5f3191de3dcafb8d502bb6d75fd8ad4bdef23405; F1 done; currentPhase F2 descriptor-only.
- **Uncommitted changes:** phase-done checkpoint pending.
