# Product docs site from catalog SSOT

Ship a generated product documentation site at atomic-skills.henryavila.com driven by an expanded meta/catalog.yaml, slim the GitHub/npm README to an envelope that points at that site, and keep agent contracts and engineering archive as Markdown in the repo. HTML is a build view over catalog plus config-derived host tiers, not a second editorial source.

## Inviolable principles

- **P1 Catalog is product SSOT for skills** — Skill and module product copy for public docs lives in meta/catalog.yaml (or files the catalog validator graph loads). Site and README generators only read validated data; they do not invent skill text.
- **P2 HTML is a view** — Product HTML is emitted by a build step. Hand-authored monólitos are not the source of skill or landing copy.
- **P3 Three surfaces stay separate** — Site (humans), README (npm/GitHub envelope), repo MD (agents + engineering archive). Do not convert docs/design, plans, or audits into the product site.
- **P4 Hosts come from config** — Tested vs Theoretical labels are derived from src/config.js TESTED_IDE_IDS and IDE_CONFIG at build time, never re-listed as a parallel list in catalog.yaml.
- **P5 Agent bodies stay private to install** — skills/** prompt bodies are not published on the public site; iron_law may be catalog metadata only.

## Glossary

- **product SSOT** — Validated catalog (and optional meta/product datasets) that generators treat as the only source of product-facing skill/module/landing facts.
- **site build** — Pipeline that turns catalog + config (+ project-guide data) into static HTML under a dist directory.
- **slim README** — Envelope README: what is / is not, install, host tier line, docs URL, optional one-line skills table; no multi-section skill blurbs.
- **iron_law field** — Catalog string for the skill Iron Law shown on site/README; CI-linked to the skill body or injected from catalog.
- **project-guide dataset** — Structured data for the deep project mental-model page, separate from core.project catalog entry.

## F0 — Catalog v0.3 and product block

Goal: Extend the catalog schema and validators so iron_law and product positioning are first-class, validated data before any HTML build exists.

### T-001 Schema and validator for iron_law and product

- Files: meta/catalog.yaml, scripts/lib/validate-skills-core.js, docs/kb/skill-frontmatter-spec.md, tests/validate-skills.test.js
- scopeBoundary: Do not implement site HTML templates or change skill body prompt prose except where needed for iron_law consistency checks. Do not edit host-qualification.json.
- acceptance: it - Every core and module skill entry in meta/catalog.yaml declares iron_law as a non-empty string.; it Catalog accepts a top-level product block (or loads meta/product/site.yaml through the same validation entrypoint) with what_is, what_is_not, docs_url, and install.primary.; it validate-skills fails when iron_law is missing or empty on a skill entry.
- verifier: { kind: shell, command: "node scripts/validate-skills.js", expectExitCode: 0 }
- RED→GREEN: Add a fixture skill without iron_law and assert validator errors; fill iron_law on all live skills and product block so validate-skills exits 0.

### T-002 iron_law body cross-check or single-write path

- Files: scripts/lib/validate-skills-core.js, scripts/lib/extract-iron-law.js, tests/generate-readme.test.js, src/render.js
- scopeBoundary: Do not redesign skill body Iron Law culture or rename Iron Law sections in skill markdown beyond the consistency rule chosen in design D2.
- acceptance: it - CI/validator either asserts catalog iron_law matches the skill body Iron Law line, or documents catalog-as-authority and install/render uses catalog iron_law without silent dual-write drift.; it At least one automated test covers the chosen path (match failure or inject path).
- verifier: { kind: shell, command: "node --test tests/generate-readme.test.js tests/config.test.js", expectExitCode: 0 }
- RED→GREEN: Break iron_law intentionally in a unit fixture and see the gate fail; restore and pass.

### T-003 Catalog docs and generate-docs still green

- Files: package.json, scripts/generate-readme.js, scripts/lib/render-readme.js, meta/catalog.json
- scopeBoundary: Do not slim the README layout yet (that is F2). Do not add site/ package layout yet.
- acceptance: it - npm run validate-skills exits 0.; it npm run check-docs exits 0 after catalog field additions (generators tolerate or emit iron_law).
- verifier: { kind: shell, command: "npm run validate-skills && npm run check-docs", expectExitCode: 0 }

```yaml
exit_gate:
  - id: F0-G1
    description: validate-skills accepts v0.3 catalog with iron_law on every skill and product positioning data present.
    verifier: { kind: shell, command: "node scripts/validate-skills.js", expectExitCode: 0 }
  - id: F0-G2
    description: check-docs still passes with the expanded catalog.
    verifier: { kind: shell, command: "npm run check-docs", expectExitCode: 0 }
```

## F1 — Site build from catalog

Goal: Add a static site generator that emits multi-page HTML from catalog and config, reusing the onboarding design-system tokens without cloning monólito pages by hand.

### T-004 Extract shared DS assets from onboarding HTML

- Files: site/assets/ds.css, docs/design/project-onboarding/index.html
- scopeBoundary: Do not rewrite project onboarding content or skill pages in this task beyond extracting shared tokens/chrome. Do not deploy.
- acceptance: it - Shared CSS (or equivalent) tokens exist as a standalone file used by the site build.; it Tokens cover the dark-first surfaces/type scale used by the onboarding page (bg-canvas, fg-default, status-*, font stacks).
- verifier: { kind: shell, command: "test -s site/assets/ds.css || test -s docs/site/assets/ds.css", expectExitCode: 0 }

### T-005 generate-site script and page set

- Files: scripts/generate-site.js, scripts/lib/render-site.js, package.json, site/templates/
- scopeBoundary: Do not implement Cloudflare/GitHub Pages DNS. Do not delete docs/skills/*.md in this task.
- acceptance: it - Build emits at least landing, skills index, one skill detail page per catalog skill, modules page, and hosts page into a dist directory.; it Skill detail pages show name, one_liner, iron_law, value_pitch or purpose, when_to_use, examples from catalog.; it Hosts page marks Tested vs Theoretical using TESTED_IDE_IDS from src/config.js.; it npm run check-site (or generate-site --check) fails when dist is stale vs catalog.
- verifier: { kind: shell, command: "npm run generate-site && npm run check-site", expectExitCode: 0 }
- RED→GREEN: check-site fails before first generate; passes after generate.

### T-006 Wire generate-docs and CI contract

- Files: package.json
- scopeBoundary: Do not change install.js skill install behavior.
- acceptance: it - generate-docs or an equivalent npm script runs site generation alongside existing generators, or check-docs includes check-site.; it Documented command in package.json scripts section for maintainers.
- verifier: { kind: shell, command: "node -e \"const p=require('./package.json'); if(!p.scripts['generate-site']&&!String(p.scripts['generate-docs']||'').includes('site')) process.exit(1)\"", expectExitCode: 0 }

```yaml
exit_gate:
  - id: F1-G1
    description: generate-site produces dist HTML for landing, skills, modules, hosts.
    verifier: { kind: shell, command: "npm run generate-site && test -d site/dist -o -d docs/site/dist", expectExitCode: 0 }
  - id: F1-G2
    description: check-site catches stale dist.
    verifier: { kind: shell, command: "npm run check-site", expectExitCode: 0 }
```

## F2 — Slim README and envelope

Goal: Shrink README to the product envelope and keep it generated from the same SSOT.

### T-007 Slim README template regions

- Files: README.md, scripts/lib/render-readme.js
- scopeBoundary: Do not remove validate-catalog or skill validation. Do not change catalog skill fields except what F0 already added.
- acceptance: it - README is approximately 120 lines or fewer of hand+generated content in the intended envelope shape (what is / is not, install, hosts, docs link, optional compact skills table).; it Long per-skill value_pitch blurbs are no longer rendered as multi-section README details (or are clearly deferred to the site only).; it IDES table still shows Support Tested/Theoretical.; it npm run check-docs exits 0.
- verifier: { kind: shell, command: "npm run check-docs && test $(wc -l < README.md) -le 200", expectExitCode: 0 }

### T-008 package homepage and docs URL

- Files: package.json, meta/catalog.yaml, meta/product/site.yaml
- scopeBoundary: Do not register DNS or change npm publish secrets.
- acceptance: it - package.json homepage is https://atomic-skills.henryavila.com (or the ratified docs_url).; it README contains that URL as the documentation pointer.
- verifier: { kind: shell, command: "node -e \"const p=require('./package.json'); if(p.homepage!=='https://atomic-skills.henryavila.com') process.exit(1)\" && grep -q 'atomic-skills.henryavila.com' README.md", expectExitCode: 0 }

```yaml
exit_gate:
  - id: F2-G1
    description: README is the slim envelope and check-docs passes.
    verifier: { kind: shell, command: "npm run check-docs && test $(wc -l < README.md) -le 200", expectExitCode: 0 }
  - id: F2-G2
    description: package homepage points at the docs site.
    verifier: { kind: shell, command: "node -e \"const p=require('./package.json'); if(!String(p.homepage||'').includes('atomic-skills.henryavila.com')) process.exit(1)\"", expectExitCode: 0 }
```

## F3 — Project deep guide on the site

Goal: Move the project mental-model documentation onto the site as a data-driven page, without stuffing domain model into core.project catalog fields.

### T-009 Project-guide dataset and route

- Files: meta/product/project-guide.yaml, scripts/lib/render-site.js, scripts/generate-site.js
- scopeBoundary: Do not change project skill runtime behavior or .atomic-skills state schemas. Do not delete docs/design/project-onboarding/index.html until the site page is verified equivalent in content coverage for model, flow, can/cannot, and commands index.
- acceptance: it - Dataset encodes entities, lifecycle spine stages, can-do and cannot-do rules, and command groups sufficient to render a guide page.; it Site build emits a project guide page that lists those structures.; it core.project in catalog.yaml is not expanded with full state-machine graphs.
- verifier: { kind: shell, command: "npm run generate-site && (test -f site/dist/project/index.html || test -f docs/site/dist/project/index.html || test -f site/dist/project.html || test -f docs/site/dist/project.html)", expectExitCode: 0 }

### T-010 Onboarding HTML deprecation path

- Files: docs/design/project-onboarding/index.html, docs/design/project-onboarding/README.md, package.json
- scopeBoundary: Do not break package.json files list consumers without a replacement path for offline guide if still shipped.
- acceptance: it - Either the package ships the new site project page as the offline guide, or docs/design/project-onboarding clearly points to the site route as canonical with a dated deprecation note.; it package.json files array remains consistent with what is shipped.
- verifier: { kind: shell, command: "npm run check-site", expectExitCode: 0 }

```yaml
exit_gate:
  - id: F3-G1
    description: Site includes a project guide page built from a dedicated dataset.
    verifier: { kind: shell, command: "npm run generate-site && (test -f site/dist/project/index.html || test -f docs/site/dist/project/index.html || test -f site/dist/project.html || test -f docs/site/dist/project.html)", expectExitCode: 0 }
```

## F4 — Deploy, offline access, and release cutover

Goal: Publish the site to the canonical domain and ensure maintainers can open docs without relying only on memory of the README.

### T-011 CI deploy workflow for the static site

- Files: .github/workflows/deploy-docs.yml, site/DEPLOY.md
- scopeBoundary: Do not store production secrets in the repo. Do not change skill install paths.
- acceptance: it - A workflow or documented deploy command publishes the static dist to the host behind atomic-skills.henryavila.com.; it Deploy is driven from git (main or release tag), not hand-edited remote HTML.
- verifier: { kind: shell, command: "test -f .github/workflows/deploy-docs.yml -o -f .github/workflows/pages.yml -o -f docs/deploy.md -o -f site/DEPLOY.md", expectExitCode: 0 }

### T-012 Offline or package-local docs path

- Files: package.json, README.md, bin/cli.js
- scopeBoundary: Do not require network for the offline path once artifacts are present.
- acceptance: it - Maintainers have a documented way to open the generated product docs from a checkout or installed package without editing remote DNS.; it Path is referenced from README or package description.
- verifier: { kind: shell, command: "grep -Eiq 'generate-site|site/dist|docs site|atomic-skills.henryavila.com' README.md package.json", expectExitCode: 0 }

### T-013 Release checklist for docs cutover

- Files: CHANGELOG.md
- scopeBoundary: Do not bump package version without maintainer request; document the cutover steps even if version bump is separate.
- acceptance: it - CHANGELOG or release note describes site URL, slim README, and catalog v0.3 product fields.; it Explicit note that engineering archive MD is not on the product site.
- verifier: { kind: shell, command: "grep -Eiq 'atomic-skills.henryavila.com|product docs|catalog' CHANGELOG.md", expectExitCode: 0 }

```yaml
exit_gate:
  - id: F4-G1
    description: Deploy path for the static site exists in-repo.
    verifier: { kind: shell, command: "test -f .github/workflows/deploy-docs.yml -o -f .github/workflows/pages.yml -o -f docs/deploy.md -o -f site/DEPLOY.md", expectExitCode: 0 }
  - id: F4-G2
    description: CHANGELOG records the docs site cutover.
    verifier: { kind: shell, command: "grep -Eiq 'atomic-skills.henryavila.com|docs site|product docs' CHANGELOG.md", expectExitCode: 0 }
```

## F5 — Generated MD cleanup (optional follow-through)

Goal: Decide and execute the fate of generated docs/skills/*.md now that the site is the human reference.

### T-014 Retire or keep docs/skills with explicit decision

- Files: docs/skills/, scripts/generate-skill-docs.js, package.json, README.md
- scopeBoundary: Do not delete docs/kb or docs/design. Do not delete skill bodies under skills/.
- acceptance: it - Either generate-skill-docs remains in check-docs with a documented dual-view reason, or it is removed from the default docs pipeline and README no longer links to docs/skills for product reference.; it npm run check-docs exits 0 after the decision is implemented.
- verifier: { kind: shell, command: "npm run check-docs", expectExitCode: 0 }

```yaml
exit_gate:
  - id: F5-G1
    description: check-docs reflects the post-site decision on docs/skills generation.
    verifier: { kind: shell, command: "npm run check-docs", expectExitCode: 0 }
```
