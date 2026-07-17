---
schemaVersion: "0.1"
slug: product-docs-site-f1-site-build-from-catalog
title: Site build from catalog
goal: Add a static site generator that emits multi-page HTML from catalog and
  config, reusing the onboarding design-system tokens without cloning monólito
  pages by hand.
status: active
branch: plan/product-docs-site
started: 2026-07-17T15:57:30.122Z
lastUpdated: 2026-07-17T16:02:15.000Z
nextAction: review-code F1 then phase-done
parentPlan: product-docs-site
phaseId: F1
businessIntent:
  value: Ship a multi-page static product docs site generated from catalog +
    config so humans get polished product education without dual editorial
    sources.
  workflow: Extract DS tokens from onboarding HTML; implement
    generate-site/check-site for landing, skills index/detail, modules, hosts;
    wire npm scripts into docs pipeline.
  rules: Catalog is SSOT for skill copy; hosts from src/config.js TESTED_IDE_IDS;
    HTML is generated view only; no skill body prompts on public pages.
  outOfScope: Deploy/DNS, slim README layout, project deep guide page, retiring
    docs/skills.
  doneWhen: npm run generate-site produces dist with required pages; npm run
    check-site exits 0 and detects stale dist.
tasksDone: 3
tasksTotal: 3
gatesMet: 2
gatesTotal: 2
exitGates:
  - id: F1-G1
    description: generate-site produces dist HTML for landing, skills, modules, hosts.
    verifier:
      kind: shell
      command: npm run generate-site && test -d site/dist -o -d docs/site/dist
      expectExitCode: 0
    status: met
    metAt: 2026-07-17T16:02:15.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T16:02:15.000Z
      verifiedCommit: 1c442ff95ca9153592ee1be60e184ed807cb31b8
      passed: true
      exitCode: 0
      outputSummary: F1-G1 pass at 1c442ff95ca9153592ee1be60e184ed807cb31b8
  - id: F1-G2
    description: check-site catches stale dist.
    verifier:
      kind: shell
      command: npm run check-site
      expectExitCode: 0
    status: met
    metAt: 2026-07-17T16:02:15.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T16:02:15.000Z
      verifiedCommit: 1c442ff95ca9153592ee1be60e184ed807cb31b8
      passed: true
      exitCode: 0
      outputSummary: F1-G2 pass at 1c442ff95ca9153592ee1be60e184ed807cb31b8
stack: []
tasks:
  - id: T-004
    title: Extract shared DS assets from onboarding HTML
    scopeBoundary:
      - Do not rewrite project onboarding content or skill pages in this task
        beyond extracting shared tokens/chrome. Do not deploy.
    acceptance:
      - it - Shared CSS (or equivalent) tokens exist as a standalone file used
        by the site build.; it Tokens cover the dark-first surfaces/type scale
        used by the onboarding page (bg-canvas, fg-default, status-*, font
        stacks).
    verifier:
      kind: shell
      command: test -s site/assets/ds.css || test -s docs/site/assets/ds.css
      expectExitCode: 0
    outputs:
      - kind: file
        path: site/assets/ds.css
      - kind: file
        path: docs/design/project-onboarding/index.html
    summary: Extrair tokens DS do onboarding para site/assets/ds.css.
    weight: 2
    status: done
    lastUpdated: 2026-07-17T16:02:15.000Z
    closedAt: 2026-07-17T16:02:15.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T16:02:15.000Z
      verifiedCommit: 1c442ff95ca9153592ee1be60e184ed807cb31b8
      passed: true
      exitCode: 0
      outputSummary: test -s site/assets/ds.css OK
  - id: T-005
    title: generate-site script and page set
    scopeBoundary:
      - Do not implement Cloudflare/GitHub Pages DNS. Do not delete
        docs/skills/*.md in this task.
    acceptance:
      - it - Build emits at least landing, skills index, one skill detail page
        per catalog skill, modules page, and hosts page into a dist directory.;
        it Skill detail pages show name, one_liner, iron_law, value_pitch or
        purpose, when_to_use, examples from catalog.; it Hosts page marks Tested
        vs Theoretical using TESTED_IDE_IDS from src/config.js.; it npm run
        check-site (or generate-site --check) fails when dist is stale vs
        catalog.
    verifier:
      kind: shell
      command: npm run generate-site && npm run check-site
      expectExitCode: 0
    outputs:
      - kind: file
        path: scripts/generate-site.js
      - kind: file
        path: scripts/lib/render-site.js
      - kind: file
        path: package.json
      - kind: file
        path: site/templates/
    summary: Implementar generate-site/check-site com landing, skills, modules, hosts.
    weight: 5
    status: done
    lastUpdated: 2026-07-17T16:02:15.000Z
    closedAt: 2026-07-17T16:02:15.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T16:02:15.000Z
      verifiedCommit: 1c442ff95ca9153592ee1be60e184ed807cb31b8
      passed: true
      exitCode: 0
      outputSummary: generate-site + check-site exit 0; 19 HTML pages
  - id: T-006
    title: Wire generate-docs and CI contract
    scopeBoundary:
      - Do not change install.js skill install behavior.
    acceptance:
      - it - generate-docs or an equivalent npm script runs site generation
        alongside existing generators, or check-docs includes check-site.; it
        Documented command in package.json scripts section for maintainers.
    verifier:
      kind: shell
      command: npm run check-site
      expectExitCode: 0
    outputs:
      - kind: file
        path: package.json
    summary: Ligar generate-site ao pipeline generate-docs/check-docs.
    weight: 1
    status: done
    lastUpdated: 2026-07-17T16:02:15.000Z
    closedAt: 2026-07-17T16:02:15.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T16:02:15.000Z
      verifiedCommit: 1c442ff95ca9153592ee1be60e184ed807cb31b8
      passed: true
      exitCode: 0
      outputSummary: check-site via check-docs chain exit 0
parked: []
emerged: []
summary: Build estático multi-página a partir do catalog + hosts do config; DS
  compartilhado e check-site.
---

# Narrative / notes

Initiative for phase **F1 — Site build from catalog**.


## Lessons disposition (from F0)

- L-F0-001 Apply: object-guard before field access in any new validators
- L-F0-002 Apply: if site generators add required catalog fields, update scaffold same change
- L-F0-003 Apply: prefer index/slice parsers over /m + $ for section extractors


## Decisions

_(record decisions here as they are made)_

## Links

- design.md D4 — HTML is generated; DS shared; multi-page
