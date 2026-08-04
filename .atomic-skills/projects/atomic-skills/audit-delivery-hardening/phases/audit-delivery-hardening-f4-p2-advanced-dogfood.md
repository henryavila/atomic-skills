---
schemaVersion: "0.1"
slug: audit-delivery-hardening-f4-p2-advanced-dogfood
title: P2 advanced + dogfood close
goal: Optional power-user topology and fix composition without making every run heavy; dogfood checklist locks false-CLOSED modes and the non-skippable phase-done hard-gate (already shipped in F2).
summary: Prosecution, critic, dual reaudit, fix recipe, optional cross, BI import
status: active
branch: develop
started: 2026-08-04T15:21:55.387Z
lastUpdated: 2026-08-04T15:21:55.387Z
nextAction: implement F4
parentPlan: audit-delivery-hardening
phaseId: F4
businessIntent:
  value: Large rewrites get prosecution + dual reaudit + optional cross residual; fix path is a documented recipe; dogfood proves false-CLOSED and skip-audit stay closed.
  workflow: prosecution axis; full-depth critic; dual reaudit; fix-composition recipe; optional --cross; BI import + dogfood-checklist.md (includes deliveryAuditGate never-skip).
  rules: Advanced features default off or full-depth only; never replace residual protocol; never reintroduce skip on phase delivery audit.
  outOfScope: Dashboard UI for reports; machine Accept Record schema validator beyond markdown; auto leg in project review composer.
  doneWhen: Recipe + dogfood checklist (with hard-gate row) exist; advanced flags documented; validate-skills + asset test still green.
tasksDone: 0
tasksTotal: 6
gatesMet: 0
gatesTotal: 1
stack: []
parked: []
emerged: []
exitGates:
  - id: G-F4-1
    description: P2 docs/assets + dogfood hard-gate + tests green
    status: pending
    verifier:
      kind: shell
      command: npm run validate-skills && node --test tests/audit-delivery-assets.test.js && test -f .atomic-skills/projects/atomic-skills/audit-delivery-hardening/dogfood-checklist.md && rg -q 'deliveryAuditGate|never skip|hard-gate' .atomic-skills/projects/atomic-skills/audit-delivery-hardening/dogfood-checklist.md && test -f skills/shared/audit-delivery-assets/fix-composition-recipe.md
      expectExitCode: 0
tasks:
  - id: T-022
    title: Prosecution axis NO-only
    status: pending
    lastUpdated: 2026-08-04T15:21:55.387Z
    scopeBoundary: []
    acceptance:
      - Optional prosecution axis cannot emit RESOLVED; auto-recommend on empty first merge for large rewrites.
    verifier:
      kind: shell
      command: rg -n 'prosecution|NO-only|disprove' skills/core/audit-delivery.md skills/shared/audit-delivery-assets/
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/audit-delivery-assets/checklists/prosecution.md
  - id: T-023
    title: Fresh critic merge full depth
    status: pending
    lastUpdated: 2026-08-04T15:21:55.387Z
    scopeBoundary:
      - Light depth may keep parent merge.
    acceptance:
      - Full depth documents gap list then product downgrade-only then fresh critic preferred.
    verifier:
      kind: shell
      command: rg -n 'critic|fresh|Gap List|downgrade' skills/core/audit-delivery.md skills/shared/audit-delivery-assets/
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/audit-delivery-assets/critic-merge.md
  - id: T-024
    title: Dual reaudit ledger + residual-blind
    status: pending
    lastUpdated: 2026-08-04T15:21:55.387Z
    scopeBoundary: []
    acceptance:
      - Per-finding retest plus residual-blind without claimed-fix narratives; plateau on open C+H.
    verifier:
      kind: shell
      command: rg -n 'residual-blind|ledger|claimed fix' skills/shared/audit-delivery-assets/reaudit-entry.md skills/core/audit-delivery.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/audit-delivery-assets/reaudit-entry.md
  - id: T-025
    title: Fix composition recipe
    status: pending
    lastUpdated: 2026-08-04T15:21:55.387Z
    scopeBoundary:
      - Do not re-implement parallel-dispatch.
    acceptance:
      - fix-composition-recipe.md partitions findings then fix then re-run audit-delivery.
    verifier:
      kind: shell
      command: test -f skills/shared/audit-delivery-assets/fix-composition-recipe.md && rg -n 'parallel-dispatch|re-run|plateau' skills/shared/audit-delivery-assets/fix-composition-recipe.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/audit-delivery-assets/fix-composition-recipe.md
  - id: T-026
    title: Optional cross-model residual critic flag
    status: pending
    lastUpdated: 2026-08-04T15:21:55.387Z
    scopeBoundary:
      - Do not seal intent out of Spec Package.
    acceptance:
      - --cross=off|residual|critic|reaudit default off; external brief Spec/ledger only.
    verifier:
      kind: shell
      command: rg -n 'cross=|cross-model|Spec Package' skills/core/audit-delivery.md meta/catalog.yaml
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/audit-delivery.md
      - kind: file
        path: meta/catalog.yaml
  - id: T-027
    title: businessIntent import + dogfood checklist
    status: pending
    lastUpdated: 2026-08-04T15:21:55.387Z
    scopeBoundary: []
    acceptance:
      - BI import drafts package from value/workflow/rules/outOfScope/doneWhen.
      - Dogfood checklist encodes four SM failure modes AND implement hard-gate (deliveryAuditGate never skip).
    verifier:
      kind: shell
      command: rg -n 'businessIntent|doneWhen|outOfScope' skills/shared/audit-delivery-assets/intent-package.md && test -f .atomic-skills/projects/atomic-skills/audit-delivery-hardening/dogfood-checklist.md && rg -q 'deliveryAuditGate|never skip|hard-gate' .atomic-skills/projects/atomic-skills/audit-delivery-hardening/dogfood-checklist.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/audit-delivery-assets/intent-package.md
      - kind: file
        path: .atomic-skills/projects/atomic-skills/audit-delivery-hardening/dogfood-checklist.md
startedCommit: abbedeb1c0388b7bea339e7182358ca8af047a25
---

# F4 — P2 advanced + dogfood close
