---
schemaVersion: "0.1"
slug: product-docs-site-f2-slim-readme-and-envelope
title: Slim README and envelope
goal: Shrink README to the product envelope and keep it generated from the same SSOT.
status: active
branch: plan/product-docs-site
started: 2026-07-17T16:06:59.752Z
lastUpdated: 2026-07-17T16:10:01.000Z
nextAction: review-code F2
parentPlan: product-docs-site
phaseId: F2
businessIntent:
  value: npm/GitHub README becomes a thin product envelope pointing at the site so
    install surface stays scannable and SSOT stays catalog+site.
  workflow: Slim generate-readme regions to envelope shape; set package homepage
    to docs_url; keep check-docs green.
  rules: No multi-section skill blurbs; hosts still Tested/Theoretical from
    config; catalog SSOT unchanged except homepage wiring.
  outOfScope: Deploy, project guide, retiring docs/skills.
  doneWhen: README ≤200 lines, check-docs green, homepage includes
    atomic-skills.henryavila.com.
tasksDone: 2
tasksTotal: 2
gatesMet: 2
gatesTotal: 2
exitGates:
  - id: F2-G1
    description: README is the slim envelope and check-docs passes.
    verifier:
      kind: shell
      command: npm run check-docs && test $(wc -l < README.md) -le 200
      expectExitCode: 0
    status: met
    metAt: 2026-07-17T16:10:01.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T16:10:01.000Z
      verifiedCommit: 8aa1ee6c855985f412e4777e88c240ff5b1289c6
      passed: true
      exitCode: 0
      outputSummary: F2-G1
  - id: F2-G2
    description: package homepage points at the docs site.
    verifier:
      kind: shell
      command: node -e "const p=require('./package.json');
        if(!String(p.homepage||'').includes('atomic-skills.henryavila.com'))
        process.exit(1)"
      expectExitCode: 0
    status: met
    metAt: 2026-07-17T16:10:01.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T16:10:01.000Z
      verifiedCommit: 8aa1ee6c855985f412e4777e88c240ff5b1289c6
      passed: true
      exitCode: 0
      outputSummary: F2-G2
stack:
  - id: 1
    title: Slim README and envelope
    type: task
    openedAt: 2026-07-17T16:06:59.752Z
tasks:
  - id: T-007
    title: Slim README template regions
    scopeBoundary:
      - Do not remove validate-catalog or skill validation. Do not change
        catalog skill fields except what F0 already added.
    acceptance:
      - it - README is approximately 120 lines or fewer of hand+generated
        content in the intended envelope shape (what is / is not, install,
        hosts, docs link, optional compact skills table).; it Long per-skill
        value_pitch blurbs are no longer rendered as multi-section README
        details (or are clearly deferred to the site only).; it IDES table still
        shows Support Tested/Theoretical.; it npm run check-docs exits 0.
    verifier:
      kind: shell
      command: npm run check-docs && test $(wc -l < README.md) -le 200
      expectExitCode: 0
    outputs:
      - kind: file
        path: README.md
      - kind: file
        path: scripts/lib/render-readme.js
    summary: Enxugar README gerado para envelope ≤~120–200 linhas.
    weight: 2
    status: done
    lastUpdated: 2026-07-17T16:10:01.000Z
    closedAt: 2026-07-17T16:10:01.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T16:10:01.000Z
      verifiedCommit: 8aa1ee6c855985f412e4777e88c240ff5b1289c6
      passed: true
      exitCode: 0
      outputSummary: T-007 check-docs/homepage
  - id: T-008
    title: package homepage and docs URL
    scopeBoundary:
      - Do not register DNS or change npm publish secrets.
    acceptance:
      - it - package.json homepage is https://atomic-skills.henryavila.com (or
        the ratified docs_url).; it README contains that URL as the
        documentation pointer.
    verifier:
      kind: shell
      command: node -e "const p=require('./package.json');
        if(!String(p.homepage||'').includes('atomic-skills.henryavila.com'))
        process.exit(1)"
      expectExitCode: 0
    outputs:
      - kind: file
        path: package.json
      - kind: file
        path: meta/catalog.yaml
      - kind: file
        path: meta/product/site.yaml
    summary: package homepage + URL canônica no README/product.
    weight: 1
    status: done
    lastUpdated: 2026-07-17T16:10:01.000Z
    closedAt: 2026-07-17T16:10:01.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T16:10:01.000Z
      verifiedCommit: 8aa1ee6c855985f412e4777e88c240ff5b1289c6
      passed: true
      exitCode: 0
      outputSummary: T-008 check-docs/homepage
parked: []
emerged: []
summary: README envelope magro + homepage apontando para atomic-skills.henryavila.com.
---

# F2 — Slim README envelope

## Lessons disposition (F1)
- L-F1-001/002/003 Apply: path safety, PUBLIC_IDE_IDS, safe URLs if README links docs_url.
