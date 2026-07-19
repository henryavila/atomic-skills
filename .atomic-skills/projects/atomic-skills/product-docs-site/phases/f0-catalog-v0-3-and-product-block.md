---
schemaVersion: "0.1"
slug: product-docs-site-f0-catalog-v0-3-and-product-block
title: Catalog v0.3 and product block
goal: Extend the catalog schema and validators so iron_law and product
  positioning are first-class, validated data before any HTML build exists.
status: done
branch: plan/product-docs-site
started: 2026-07-17T14:28:20.714Z
nextAction: null
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
tasksDone: 3
tasksTotal: 3
gatesMet: 2
gatesTotal: 2
weightDone: 6
weightTotal: 6
exitGates:
  - id: F0-G1
    description: validate-skills accepts v0.3 catalog with iron_law on every skill
      and product positioning data present.
    status: met
    verifier:
      kind: shell
      command: node scripts/validate-skills.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T15:57:11.000Z
      verifiedCommit: 1b26276c3bde2b5efa19987a0fc9a05b19dc1361
      passed: true
      exitCode: 0
      outputSummary: validate-skills exit 0 after review fixes
    verifierLabel: "shell: node scripts/validate-skills.js"
    evidenceSummary: passed · 2026-07-17
    metAt: 2026-07-17T15:57:11.000Z
  - id: F0-G2
    description: check-docs still passes with the expanded catalog.
    status: met
    verifier:
      kind: shell
      command: npm run check-docs
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-17T15:57:11.000Z
      verifiedCommit: 1b26276c3bde2b5efa19987a0fc9a05b19dc1361
      passed: true
      exitCode: 0
      outputSummary: check-docs exit 0 after review fixes
    verifierLabel: "shell: npm run check-docs"
    evidenceSummary: passed · 2026-07-17
    metAt: 2026-07-17T15:57:11.000Z
stack: []
tasks:
  - id: T-001
    title: Schema and validator for iron_law and product
    status: done
    lastUpdated: 2026-07-17T15:50:45.556Z
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
    closedAt: 2026-07-17T15:50:45.556Z
    evidence:
      verifierKind: shell
      passed: true
      exitCode: 0
      outputSummary: ✓ All 15 skills valid (schema_version 0.2)
      verifiedCommit: 1b26276c3bde2b5efa19987a0fc9a05b19dc1361
      verifiedAt: 2026-07-17T15:57:11.000Z
  - id: T-002
    title: iron_law body cross-check or single-write path
    status: done
    lastUpdated: 2026-07-17T15:50:45.556Z
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
    closedAt: 2026-07-17T15:50:45.556Z
    evidence:
      verifierKind: shell
      passed: true
      exitCode: 0
      outputSummary: >
        ds (0.654917ms)
          ✔ renders a flat command/description table when subcommands have no group (0.507625ms)
          ✔ renders one table per group, in first-appearance order, with escaped pipes (0.477542ms)
          ✔ returns one entry per skill (0.564834ms)
        ✔ buildSkillDocs (per-skill reference pages) (2.263709ms)

        ℹ tests 31

        ℹ suites 4

        ℹ pass 31

        ℹ fail 0

        ℹ cancelled 0

        ℹ skipped 0

        ℹ todo 0

        ℹ duration_ms 58.432583
      verifiedCommit: 1b26276c3bde2b5efa19987a0fc9a05b19dc1361
      verifiedAt: 2026-07-17T15:57:11.000Z
  - id: T-003
    title: Catalog docs and generate-docs still green
    status: done
    lastUpdated: 2026-07-17T15:50:45.556Z
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
    closedAt: 2026-07-17T15:50:45.556Z
    evidence:
      verifierKind: shell
      passed: true
      exitCode: 0
      outputSummary: check-docs exit 0 (generate-readme/skill-docs/catalog-json --check)
      verifiedCommit: 1b26276c3bde2b5efa19987a0fc9a05b19dc1361
      verifiedAt: 2026-07-17T15:57:11.000Z
parked: []
emerged: []
summary: "Schema v0.3: iron_law em toda skill + bloco product validado;
  check-docs verde sem site ainda."
planTitle: Product docs site from catalog SSOT
planActive: true
current: true
lastUpdated: 2026-07-17T15:57:11.533Z
reviewGate:
  at: 1b26276c3bde2b5efa19987a0fc9a05b19dc1361
  mode: codex
  provider: gpt-5.5
  verdict: needs_changes_then_fixed
  counts:
    blocker: 0
    critical: 0
    major: 3
    minor: 0
    nit: 0
  reviewFile: .atomic-skills/reviews/product-docs-site-f0-codex-pass1.md
  note: F-001/F-002/F-003 fixed in follow-up commit; user requested gpt-5.6-sol
    unavailable (ChatGPT account) — used gpt-5.5
closedAt: 2026-07-17T15:57:11.533Z
---

# Narrative / notes

Initiative for phase **F0 — Catalog v0.3 and product block**.

## Decisions

- **T-002:** catalog-as-authority + CI cross-check via normalizeIronLaw; generators prefer entry.iron_law.
- **Schema split:** root catalog version 0.3; per-skill schema_version remains 0.2.

## Links

_(plan doc, external refs)_


## Session handoff
- **Narrative:** F0 implementation landed: catalog root v0.3 with product block and iron_law on all 15 skills; validator requires iron_law + product and cross-checks catalog↔body; generators prefer catalog iron_law; check-docs green. Tasks T-001..T-003 closed with verifier evidence at HEAD 753a8f2c6d5b31264dc365ad2eee9fa8ab3ce388.
- **Decision log:** T-002 chose catalog-as-authority + CI cross-check (normalizeIronLaw); generators prefer entry.iron_law with body fallback for legacy fixtures; per-skill schema_version stays 0.2; catalog.json does not project iron_law/product.
- **Single nextAction:** Run phase-done for F0 (review-code on phase range) then materialize F1.
- **Verbatim state:** HEAD=753a8f2c6d5b31264dc365ad2eee9fa8ab3ce388; `node scripts/validate-skills.js` → exit 0; `npm run check-docs` → exit 0; path=.atomic-skills/projects/atomic-skills/product-docs-site/phases/f0-catalog-v0-3-and-product-block.md
- **Uncommitted changes:** state file dirty until checkpoint commit.


## Self-review against code-quality gates

- G1 read-before-claim: applied — verifiers re-run at close HEAD
- G2 soft-language: applied — completion claims cite exit 0 evidence
- G6 reference-or-strike: applied — HEAD and review file paths verbatim
- CROSS-MODEL REVIEW: ran via codex provider gpt-5.5 at HEAD (user requested gpt-5.6-sol unavailable with ChatGPT account), verdict needs_changes then fixed (3 major), file .atomic-skills/reviews/product-docs-site-f0-codex-pass1.md
