---
schemaVersion: "0.1"
slug: product-docs-site
title: Product docs site from catalog SSOT
version: "1.0"
status: done
started: 2026-07-17T14:28:20.714Z
lastUpdated: 2026-07-17T16:27:23.205Z
branch: plan/product-docs-site
currentPhase: F5
parallelismAllowed: false
principles:
  - id: P1
    title: Catalog is product SSOT for skills
    body: Skill and module product copy for public docs lives in meta/catalog.yaml
      (or files the catalog validator graph loads). Site and README generators
      only read validated data; they do not invent skill text.
  - id: P2
    title: HTML is a view
    body: Product HTML is emitted by a build step. Hand-authored monólitos are not
      the source of skill or landing copy.
  - id: P3
    title: Three surfaces stay separate
    body: Site (humans), README (npm/GitHub envelope), repo MD (agents + engineering
      archive). Do not convert docs/design, plans, or audits into the product
      site.
  - id: P4
    title: Hosts come from config
    body: Tested vs Theoretical labels are derived from src/config.js TESTED_IDE_IDS
      and IDE_CONFIG at build time, never re-listed as a parallel list in
      catalog.yaml.
  - id: P5
    title: Agent bodies stay private to install
    body: skills/ prompt bodies are not published on the public site; iron_law may
      be catalog metadata only.
glossary:
  - term: product SSOT
    definition: Validated catalog (and optional meta/product datasets) that
      generators treat as the only source of product-facing skill/module/landing
      facts.
  - term: site build
    definition: Pipeline that turns catalog + config (+ project-guide data) into
      static HTML under a dist directory.
  - term: slim README
    definition: "Envelope README: what is / is not, install, host tier line, docs
      URL, optional one-line skills table; no multi-section skill blurbs."
  - term: iron_law field
    definition: Catalog string for the skill Iron Law shown on site/README;
      CI-linked to the skill body or injected from catalog.
  - term: project-guide dataset
    definition: Structured data for the deep project mental-model page, separate
      from core.project catalog entry.
phases:
  - id: F0
    slug: product-docs-site-f0-catalog-v0-3-and-product-block
    title: Catalog v0.3 and product block
    goal: Extend the catalog schema and validators so iron_law and product
      positioning are first-class, validated data before any HTML build exists.
    dependsOn: []
    subPhaseCount: 3
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F0-G1
          description: validate-skills accepts v0.3 catalog with iron_law on every skill
            and product positioning data present.
          status: met
          verifier:
            kind: shell
            command: node scripts/validate-skills.js
            expectExitCode: 0
          metAt: 2026-07-17T15:57:11.533Z
        - id: F0-G2
          description: check-docs still passes with the expanded catalog.
          status: met
          verifier:
            kind: shell
            command: npm run check-docs
            expectExitCode: 0
          metAt: 2026-07-17T15:57:11.533Z
    status: done
    businessIntent:
      value: Public product facts (skill cards, positioning, host tiers) must not
        drift between README, site, and catalog — F0 makes iron_law and product
        positioning validated catalog data before any HTML build.
      workflow: Extend catalog schema and validators; fill iron_law on every skill;
        add product block (what_is, what_is_not, docs_url, install.primary);
        keep validate-skills and check-docs green without site generation yet.
      rules: Catalog is SSOT for product skill copy; no silent dual iron_law without
        CI cross-check or single-write path; hosts stay in src/config.js; no
        site HTML or README slim in F0.
      outOfScope: generate-site, deploy, slim README layout, project-guide page,
        retiring docs/skills.
      doneWhen: Every skill has non-empty iron_law; product positioning data
        validates; node scripts/validate-skills.js and npm run check-docs both
        exit 0.
    summary: "Schema v0.3: iron_law em toda skill + bloco product validado;
      check-docs verde sem site ainda."
  - id: F1
    slug: product-docs-site-f1-site-build-from-catalog
    title: Site build from catalog
    goal: Add a static site generator that emits multi-page HTML from catalog and
      config, reusing the onboarding design-system tokens without cloning
      monólito pages by hand.
    dependsOn:
      - F0
    subPhaseCount: 3
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F1-G1
          description: generate-site produces dist HTML for landing, skills, modules, hosts.
          status: met
          verifier:
            kind: shell
            command: npm run generate-site && test -d site/dist -o -d docs/site/dist
            expectExitCode: 0
          metAt: 2026-07-17T16:06:41.000Z
        - id: F1-G2
          description: check-site catches stale dist.
          status: met
          verifier:
            kind: shell
            command: npm run check-site
            expectExitCode: 0
          metAt: 2026-07-17T16:06:41.000Z
    status: done
    summary: Build estático multi-página a partir do catalog + hosts do config; DS
      compartilhado e check-site.
    businessIntent:
      value: Ship a multi-page static product docs site generated from catalog +
        config so humans get polished product education without dual editorial
        sources.
      workflow: Extract DS tokens from onboarding HTML; implement
        generate-site/check-site for landing, skills index/detail, modules,
        hosts; wire npm scripts into docs pipeline.
      rules: Catalog is SSOT for skill copy; hosts from src/config.js TESTED_IDE_IDS;
        HTML is generated view only; no skill body prompts on public pages.
      outOfScope: Deploy/DNS, slim README layout, project deep guide page, retiring
        docs/skills.
      doneWhen: npm run generate-site produces dist with required pages; npm run
        check-site exits 0 and detects stale dist.
  - id: F2
    slug: product-docs-site-f2-slim-readme-and-envelope
    title: Slim README and envelope
    goal: Shrink README to the product envelope and keep it generated from the same
      SSOT.
    dependsOn:
      - F1
    subPhaseCount: 2
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F2-G1
          description: README is the slim envelope and check-docs passes.
          status: met
          verifier:
            kind: shell
            command: npm run check-docs && test $(wc -l < README.md) -le 200
            expectExitCode: 0
          metAt: 2026-07-17T16:13:16.000Z
        - id: F2-G2
          description: package homepage points at the docs site.
          status: met
          verifier:
            kind: shell
            command: node -e "const p=require('./package.json');
              if(!String(p.homepage||'').includes('atomic-skills.henryavila.com'))
              process.exit(1)"
            expectExitCode: 0
          metAt: 2026-07-17T16:13:16.000Z
    status: done
    summary: README envelope magro + homepage apontando para
      atomic-skills.henryavila.com.
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
  - id: F3
    slug: product-docs-site-f3-project-deep-guide-on-the-site
    title: Project deep guide on the site
    goal: Move the project mental-model documentation onto the site as a data-driven
      page, without stuffing domain model into core.project catalog fields.
    dependsOn:
      - F2
    subPhaseCount: 2
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: F3-G1
          description: Site includes a project guide page built from a dedicated dataset.
          status: met
          verifier:
            kind: shell
            command: npm run generate-site && (test -f site/dist/project/index.html || test
              -f docs/site/dist/project/index.html || test -f
              site/dist/project.html || test -f docs/site/dist/project.html)
            expectExitCode: 0
          metAt: 2026-07-17T16:22:27.652Z
    status: done
    summary: Guia profundo do project no site via dataset dedicado (não expandir
      core.project).
    businessIntent:
      value: Project mental model lives on the product site via a dedicated dataset,
        not core.project catalog bloat.
      workflow: Author meta/product/project-guide.yaml; render
        site/dist/project/index.html; deprecation note on onboarding monólito.
      rules: Do not expand core.project with state machines; keep skill runtime
        unchanged.
      outOfScope: Deploy, README further, retiring all docs/skills.
      doneWhen: generate-site emits project guide page; onboarding path deprecation
        documented.
  - id: F4
    slug: product-docs-site-f4-deploy-offline-access-and-release-cutove
    title: Deploy, offline access, and release cutover
    goal: Publish the site to the canonical domain and ensure maintainers can open
      docs without relying only on memory of the README.
    dependsOn:
      - F3
    subPhaseCount: 3
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F4-G1
          description: Deploy path for the static site exists in-repo.
          status: met
          verifier:
            kind: shell
            command: test -f .github/workflows/deploy-docs.yml -o -f
              .github/workflows/pages.yml -o -f docs/deploy.md -o -f
              site/DEPLOY.md
            expectExitCode: 0
          metAt: 2026-07-17T16:27:23.205Z
        - id: F4-G2
          description: CHANGELOG records the docs site cutover.
          status: met
          verifier:
            kind: shell
            command: grep -Eiq 'atomic-skills.henryavila.com|docs site|product docs'
              CHANGELOG.md
            expectExitCode: 0
          metAt: 2026-07-17T16:27:23.205Z
    status: done
    summary: Deploy CI, acesso offline/local e nota de release/CHANGELOG.
    businessIntent:
      value: Publish static product docs and give maintainers offline access + release
        notes for the cutover.
      workflow: Add CI/docs deploy path; document offline site/dist; CHANGELOG cutover
        note.
      rules: No secrets in repo; deploy git-driven; offline works without DNS.
      outOfScope: Actual production DNS flip if credentials missing; version bump
        without request.
      doneWhen: deploy path exists in-repo; CHANGELOG mentions docs site; offline path
        documented.
  - id: F5
    slug: product-docs-site-f5-generated-md-cleanup-optional-follow-thr
    title: Generated MD cleanup (optional follow-through)
    goal: Decide and execute the fate of generated docs/skills/*.md now that the
      site is the human reference.
    dependsOn:
      - F4
    subPhaseCount: 0
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: F5-G1
          description: check-docs reflects the post-site decision on docs/skills generation.
          status: met
          verifier:
            kind: shell
            command: npm run check-docs
            expectExitCode: 0
          metAt: 2026-07-17T16:27:23.205Z
    status: done
    summary: "Decisão explícita: manter ou aposentar docs/skills gerados."
references: []
planActive: true
planTitle: Product docs site from catalog SSOT
closedAt: 2026-07-17T16:27:23.205Z
---

# Product docs site from catalog SSOT

## 1. Context

Ship a generated product documentation site at atomic-skills.henryavila.com driven by an expanded meta/catalog.yaml, slim the GitHub/npm README to an envelope that points at that site, and keep agent contracts and engineering archive as Markdown in the repo. HTML is a build view over catalog plus config-derived host tiers, not a second editorial source.

## 2. Inviolable principles

- **P1 Catalog is product SSOT for skills** — Skill and module product copy for public docs lives in meta/catalog.yaml (or files the catalog validator graph loads). Site and README generators only read validated data; they do not invent skill text.
- **P2 HTML is a view** — Product HTML is emitted by a build step. Hand-authored monólitos are not the source of skill or landing copy.
- **P3 Three surfaces stay separate** — Site (humans), README (npm/GitHub envelope), repo MD (agents + engineering archive). Do not convert docs/design, plans, or audits into the product site.
- **P4 Hosts come from config** — Tested vs Theoretical labels are derived from src/config.js TESTED_IDE_IDS and IDE_CONFIG at build time, never re-listed as a parallel list in catalog.yaml.
- **P5 Agent bodies stay private to install** — skills/ prompt bodies are not published on the public site; iron_law may be catalog metadata only.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_

## Self-review against code-quality gates

- G1 read-before-claim: applied — plan sourced from approved design.md + catalog/config evidence
- G2 soft-language: applied — verifiers are deterministic shell/test commands
- G6 reference-or-strike: applied — host/tested labels deferred to src/config.js (P4)

## Reviews

- internal: 2026-07-17 — Stage 8a pass (structure/SPEC/gates consistent with design D1–D8; zero blocker/critical; F1–F5 remain descriptor-only until materialize). Mode: internal.
- cross-model: SKIPPED — not provided at creation (offer deferred to first implement session)

