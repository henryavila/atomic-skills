---
schemaVersion: "0.1"
slug: product-docs-site-f0-catalog-v0-3-and-product-block
title: Catalog v0.3 and product block
goal: Extend the catalog schema and validators so iron_law and product
  positioning are first-class, validated data before any HTML build exists.
status: active
branch: plan/product-docs-site
started: 2026-07-17T14:28:20.714Z
lastUpdated: 2026-07-17T14:28:52.715Z
nextAction: "Start T-001: Schema and validator for iron_law and product"
parentPlan: product-docs-site
phaseId: F0
businessIntent:
  value: Public product facts (skill cards, positioning, host tiers) must not
    drift between README, site, and catalog — F0 makes iron_law and product
    positioning validated catalog data before any HTML build.
  workflow: Extend catalog schema and validators; fill iron_law on every skill;
    add product block (what_is, what_is_not, docs_url, install.primary); keep
    validate-skills and check-docs green without site generation yet.
  rules: Catalog is SSOT for product skill copy; no silent dual iron_law without
    CI cross-check or single-write path; hosts stay in src/config.js; no site
    HTML or README slim in F0.
  outOfScope: generate-site, deploy, slim README layout, project-guide page,
    retiring docs/skills.
  doneWhen: Every skill has non-empty iron_law; product positioning data
    validates; node scripts/validate-skills.js and npm run check-docs both exit
    0.
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: F0-G1
    description: validate-skills accepts v0.3 catalog with iron_law on every skill
      and product positioning data present.
    status: pending
    verifier:
      kind: shell
      command: node scripts/validate-skills.js
      expectExitCode: 0
  - id: F0-G2
    description: check-docs still passes with the expanded catalog.
    status: pending
    verifier:
      kind: shell
      command: npm run check-docs
      expectExitCode: 0
stack:
  - id: 1
    title: Catalog v0.3 and product block
    type: task
    openedAt: 2026-07-17T14:28:20.714Z
tasks:
  - id: T-001
    title: Schema and validator for iron_law and product
    status: pending
    lastUpdated: 2026-07-17T14:28:20.714Z
    scopeBoundary:
      - Do not implement site HTML templates or change skill body prompt prose
        except where needed for iron_law consistency checks. Do not edit
        host-qualification.json.
    acceptance:
      - it - Every core and module skill entry in meta/catalog.yaml declares
        iron_law as a non-empty string.; it Catalog accepts a top-level product
        block (or loads meta/product/site.yaml through the same validation
        entrypoint) with what_is, what_is_not, docs_url, and install.primary.;
        it validate-skills fails when iron_law is missing or empty on a skill
        entry.
    verifier:
      kind: shell
      command: node scripts/validate-skills.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: meta/catalog.yaml
      - kind: file
        path: scripts/lib/validate-skills-core.js
      - kind: file
        path: docs/kb/skill-frontmatter-spec.md
      - kind: file
        path: tests/validate-skills.test.js
    summary: Adicionar iron_law + product ao schema/validator e preencher o catalog.
    weight: 3
  - id: T-002
    title: iron_law body cross-check or single-write path
    status: pending
    lastUpdated: 2026-07-17T14:28:20.714Z
    scopeBoundary:
      - Do not redesign skill body Iron Law culture or rename Iron Law sections
        in skill markdown beyond the consistency rule chosen in design D2.
    acceptance:
      - it - CI/validator either asserts catalog iron_law matches the skill body
        Iron Law line, or documents catalog-as-authority and install/render uses
        catalog iron_law without silent dual-write drift.; it At least one
        automated test covers the chosen path (match failure or inject path).
    verifier:
      kind: shell
      command: node --test tests/generate-readme.test.js tests/config.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: scripts/lib/validate-skills-core.js
      - kind: file
        path: scripts/lib/extract-iron-law.js
      - kind: file
        path: tests/generate-readme.test.js
      - kind: file
        path: src/render.js
    summary: Eliminar drift iron_law catalog vs body (cross-check CI ou single-write).
    weight: 2
  - id: T-003
    title: Catalog docs and generate-docs still green
    status: pending
    lastUpdated: 2026-07-17T14:28:20.714Z
    scopeBoundary:
      - Do not slim the README layout yet (that is F2). Do not add site/ package
        layout yet.
    acceptance:
      - it - npm run validate-skills exits 0.; it npm run check-docs exits 0
        after catalog field additions (generators tolerate or emit iron_law).
    verifier:
      kind: shell
      command: npm run check-docs
      expectExitCode: 0
    outputs:
      - kind: file
        path: package.json
      - kind: file
        path: scripts/generate-readme.js
      - kind: file
        path: scripts/lib/render-readme.js
      - kind: file
        path: meta/catalog.json
    summary: Garantir validate-skills e check-docs verdes após expansão do catalog.
    weight: 1
parked: []
emerged: []
summary: "Schema v0.3: iron_law em toda skill + bloco product validado;
  check-docs verde sem site ainda."
---

# Narrative / notes

Initiative for phase **F0 — Catalog v0.3 and product block**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_
