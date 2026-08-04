---
schemaVersion: "0.1"
slug: audit-delivery-hardening-f3-p1-thin-body-guards
title: P1 thin body + assets + guards
goal: Prevent skill rot — thin resident spine, complete lazy assets (checklists/report/ledger), INVESTIGATOR fallback, static test that every asset is reachable from the body.
summary: Medium-thin body, checklists, report template, static wire test
status: active
branch: develop
started: 2026-08-04T15:13:32.839Z
lastUpdated: 2026-08-04T15:13:32.839Z
nextAction: implement F3
parentPlan: audit-delivery-hardening
phaseId: F3
businessIntent:
  value: Maintainers cannot ship dead assets; operators get a readable skill body with full report/checklist SSOT in assets.
  workflow: Thin rewrite; checklist+report assets; audit-delivery-assets.test.js; INVESTIGATOR fallback prose.
  rules: Body keeps iron law and HARD-GATEs resident; detail is lazy.
  outOfScope: P2 prosecution/critic/cross; dogfood narrative file.
  doneWhen: validate-skills + asset wire test green; report and product/residual checklists exist.
tasksDone: 0
tasksTotal: 4
gatesMet: 0
gatesTotal: 1
stack: []
parked: []
emerged: []
exitGates:
  - id: G-F3-1
    description: validate-skills + asset wire test + report/checklists
    status: pending
    verifier:
      kind: shell
      command: npm run validate-skills && node --test tests/audit-delivery-assets.test.js && test -f skills/shared/audit-delivery-assets/report-template.md && test -f skills/shared/audit-delivery-assets/checklists/product.md && test -f skills/shared/audit-delivery-assets/checklists/residual.md && test -f skills/shared/audit-delivery-assets/findings-ledger.md && rg -q 'INVESTIGATOR|unavailable|degraded' skills/core/audit-delivery.md
      expectExitCode: 0
tasks:
  - id: T-018
    title: Thin body rewrite ~120-180 lines
    status: pending
    lastUpdated: 2026-08-04T15:13:32.839Z
    scopeBoundary:
      - Keep Iron Law, mode dispatch, HARD-GATEs, red flags compressed, composition note.
    acceptance:
      - Body <= ~220 lines soft; Assets lazy index lists all assets.
    verifier:
      kind: shell
      command: wc -l skills/core/audit-delivery.md | awk '{exit !($1<=220)}' && rg -n 'Assets \(lazy\)|ASSETS_PATH' skills/core/audit-delivery.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/audit-delivery.md
  - id: T-019
    title: Checklists + report + findings ledger assets
    status: pending
    lastUpdated: 2026-08-04T15:13:32.839Z
    scopeBoundary: []
    acceptance:
      - product and residual checklists; report-template SSOT including Accept Register.
    verifier:
      kind: shell
      command: test -f skills/shared/audit-delivery-assets/report-template.md && test -f skills/shared/audit-delivery-assets/checklists/product.md && test -f skills/shared/audit-delivery-assets/checklists/residual.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/audit-delivery-assets/report-template.md
      - kind: file
        path: skills/shared/audit-delivery-assets/checklists/product.md
      - kind: file
        path: skills/shared/audit-delivery-assets/checklists/residual.md
  - id: T-020
    title: Static guard assets referenced
    status: pending
    lastUpdated: 2026-08-04T15:13:32.839Z
    scopeBoundary:
      - Static file graph only; no skill runtime executor.
    acceptance:
      - tests/audit-delivery-assets.test.js fails on orphan assets; node --test exits 0.
    verifier:
      kind: shell
      command: node --test tests/audit-delivery-assets.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: tests/audit-delivery-assets.test.js
  - id: T-021
    title: INVESTIGATOR fallback
    status: pending
    lastUpdated: 2026-08-04T15:13:32.839Z
    scopeBoundary: []
    acceptance:
      - If spawn unavailable, sequential inline axes with degradation warning.
    verifier:
      kind: shell
      command: rg -n 'INVESTIGATOR|unavailable|degraded|inline' skills/core/audit-delivery.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/audit-delivery.md
startedCommit: 845776142dc6cc9d3ef44403af0b36ac0e73b86f
---

# F3 — P1 thin body + assets + guards
