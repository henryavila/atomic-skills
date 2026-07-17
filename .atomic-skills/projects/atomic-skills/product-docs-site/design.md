# Design — Product docs site from catalog SSOT

**Project:** `atomic-skills`  
**Plan slug:** `product-docs-site`  
**Date:** 2026-07-17  
**Status:** approved (user 2026-07-17; critic approve 0 blocker/critical)

## Context

Atomic Skills grew a large Markdown surface that mixes **product education** (what skills are, install, hosts) with **engineering archive** (plans, audits, design notes) and **agent contracts** (skill bodies, CLAUDE.md/AGENTS.md). The public README is ~600 lines with generated skill blurbs; `docs/` holds ~90+ markdown files; the only polished human-facing visual doc is the self-contained `docs/design/project-onboarding/index.html` (~125KB, aiDeck tokens, interactive state machines).

The maintainer wants:

1. A **product documentation site** at `https://atomic-skills.henryavila.com` in the visual language of that onboarding HTML.
2. A **lean README** that states what Atomic Skills is / is not, install, and points to the site.
3. **`meta/catalog.yaml` expanded** so skill/module product data is the SSOT; HTML is a **build view**, not hand-authored prose.

Evidence (G1):

- Catalog is already the SSOT for skill metadata consumed by install + docs generators: `meta/catalog.yaml` (`version: '0.2'`, `core` + `modules` + `module_meta` + `release_highlight`).
- Generators: `package.json` scripts `generate-readme`, `generate-skill-docs`, `generate-docs`, `check-docs` → `scripts/lib/render-readme.js`.
- Iron Law is **not** in the catalog today; README extracts it from skill bodies via `extractIronLaw` in `scripts/lib/render-readme.js` / `extract-iron-law.js`.
- Product-tested hosts live in code, not catalog: `TESTED_IDE_IDS` + `getIdeSupportLabel` in `src/config.js` (claude-code, cursor, codex, grok = Tested; others Theoretical).
- Host operational probe tiers are separate: `meta/host-qualification.json` (`operational` | `layout-only`) — not the same claim as day-to-day tested.
- Onboarding HTML pattern: `docs/design/project-onboarding/index.html` (inlined DS tokens, single-file, offline).

## Decisions

### D1 — Three surfaces, one product truth

| Surface | Role | Source of truth |
|---------|------|-----------------|
| **Site** (`atomic-skills.henryavila.com`) | Human product docs | Built from catalog + config + optional product datasets |
| **README** | npm/GitHub envelope (~≤120 lines) | Same catalog/config; thin templates |
| **Repo MD** | Agent contracts + engineering archive | `skills/**`, `docs/kb/**`, `docs/design/**`, plans — **not** the site |

**verified_by:** conversation design analysis 2026-07-17; existing generator architecture in `package.json` + `scripts/lib/render-readme.js`.

### D2 — Catalog-centric product data (schema v0.3)

Expand `meta/catalog.yaml` (or equivalent validated schema version) so **skill and module product fields** needed by the site are explicit and validated:

**Per skill (minimum additions):**

- `iron_law` — required string; single non-negotiable rule shown on cards/pages.
- Cross-check: either (preferred) catalog is authoritative and render/install may inject it, **or** CI asserts catalog `iron_law` matches the first Iron Law line in the skill body. Do not leave two silent sources forever.

**Top-level `product:` block (or `meta/product/site.yaml` loaded by the same validator graph):**

- `what_is` — short positioning paragraph
- `what_is_not` — bullet list
- `docs_url` — `https://atomic-skills.henryavila.com`
- `install.primary` — `npx @henryavila/atomic-skills install` (and optional flags already documented)

**Do not put in catalog:**

- Skill **bodies** / HARD-GATE prose / rationalization tables
- Engineering archive (`docs/design`, plans, audits)
- Host tested list (see D3)
- Page layout, CSS, diagrams as freeform HTML blobs

Optional structured fields only when ≥2 consumers need them: e.g. `docs.steps[]`, `docs.anti_patterns[]` — reject open-ended long-form CMS prose in YAML.

**verified_by:** `docs/kb/skill-frontmatter-spec.md` v0.2 field model; catalog already carries `value_pitch`, `one_liner`, `subcommands`, `module_meta`.

### D3 — Hosts come from config, not duplicated YAML

Site Hosts page and README support column:

- **Tested** = `TESTED_IDE_IDS` from `src/config.js`
- Directory/format = `IDE_CONFIG`
- Do **not** re-list tested hosts inside catalog (drift risk with the recent README work)

`host-qualification.json` remains the CLI probe contract; the site may footnote that “operational probe” ≠ “tested in daily use”, but must not conflate the two labels.

**verified_by:** `src/config.js` `TESTED_IDE_IDS` / `getIdeSupportLabel`; `meta/host-qualification.json`.

### D4 — HTML is generated; DS shared; multi-page

- Extract shared tokens/chrome from the onboarding HTML into a reusable DS asset used by the site build (not N monorepo clones of 125KB CSS).
- Build emits static multi-page site (landing, skills index, skill detail, modules, hosts; optional `/project` deep guide).
- **No hand-authored product HTML** as the SSOT for skill copy — templates + data only.
- Promote `project` onboarding into a site route; its **domain dataset** (entities, machines, can/cannot) lives in a dedicated data file (e.g. `meta/product/project-guide.yaml` or structured JSON), not as 200 flat keys under `core.project` in the catalog.

**verified_by:** structure of `docs/design/project-onboarding/index.html` (data in JS + template); generator pattern already used for README markers.

### D5 — README slim contract

README becomes:

1. What it is (1 short para)
2. What it is **not**
3. Install command(s)
4. Tested vs Theoretical hosts (one line + link)
5. Optional compact skills table (name + one_liner + iron_law) **or** link-only to site index
6. Canonical docs URL
7. License / links

Remove multi-section skill blurbs from the long-form README once the site ships. Keep generation + `check-docs` so the envelope cannot drift from catalog.

### D6 — What stays Markdown in the repo

| Keep as MD | Reason |
|------------|--------|
| `skills/**/*.md` | Agent prompts — install surface |
| `docs/kb/**` | Agent/maintainer contracts |
| `docs/design/**`, plans, audits | Engineering history — not product site |
| `CLAUDE.md` / `AGENTS.md` | Agent instruction hierarchy |

`docs/skills/*.md` (generated human refs): either keep as a secondary generated view in v1 or drop after site GA — plan may phase this; default **keep generating until site is live**, then decide delete vs redirect note.

### D7 — Hosting and package coupling

- Canonical URL: `https://atomic-skills.henryavila.com`
- Deploy: static export from CI on `main`/release (implementation host: Pages/Cloudflare/etc. is ops detail; must be git-driven)
- `package.json` `homepage` points at the site
- Offline/local: keep at least one path to open product docs without net (package-shipped export or `npx`/script) — exact mechanism is plan-phase detail, not optional for maintainers dogfooding

### D8 — Language

- **Site + `product:` copy: English** (npm audience, matches current README language).
- Existing pt-BR onboarding content may remain as a special page or be translated in a later phase; v1 does not require full bilingual.

## Chosen approach

**Catalog-centric product SSOT + static site build + slim README** (Approach A from the design conversation).

Weighed alternatives:

| Approach | Outcome |
|----------|---------|
| **A. Catalog-centric + generated multi-page site** | **Chosen** — extends existing generator architecture; single validation surface |
| **B. Dual source** (catalog for install, separate CMS/MDX for site) | **Rejected** — guaranteed drift with installer frontmatter and skill index |
| **C. Hand monólitos HTML** (clone onboarding per page) | **Rejected** — unmaintainable, no honest `check-docs`, PR noise |

## Blast radius

| Decision | Cost if wrong | Containment |
|----------|---------------|-------------|
| Catalog v0.3 field set | Touches every skill entry + validator + all generators | Additive schema; keep v0.2 readers during migration window if needed; CI `validate-skills` |
| Public docs URL | Users bookmark wrong place | README + homepage only after first successful deploy |
| Removing long README blurbs | npm page looks empty if site down | Ship site + README link in same release; keep compact table |
| Promoting `iron_law` to catalog | Drift vs body if dual-write | Hard CI cross-check or single write path |

Not a data-model one-way door for end-user data; reversible via git. Public URL + schema consumers are the main reverse-cost items.

## Non-goals

- Converting engineering archive (`docs/design`, `docs/superpowers`, audits) to HTML product pages
- Embedding skill prompt bodies on the public site
- Declaring Gemini / OpenCode / Copilot as “tested” without the Theoretical label
- Full i18n site in v1
- Replacing aiDeck live dashboards with static docs
- Changing skill runtime behavior beyond docs/install metadata needed for `iron_law` consistency

## Open questions

1. Exact deploy target (Cloudflare Pages vs GitHub Pages vs other) — ops, not product shape.
2. Whether v1 ships offline docs inside the npm tarball or only via URL + repo `site/dist`.
3. Whether `docs/skills/*.md` is deleted in the same release as site GA or one release later.
4. Whether catalog top-level is literally `product:` inside `catalog.yaml` vs `meta/product/site.yaml` imported by one validator — both satisfy D2; pick at plan decompose for file layout clarity.

## Rejected alternatives

- **Dual-write catalog + hand site copy** — rejected: same failure mode as pre-v0.2 scattered frontmatter.
- **Site reads skill bodies by regex** for iron laws and pitches — rejected: fragile; catalog already owns product copy.
- **Single infinite HTML scroll of all skills** without multi-page shell — rejected for navigation/search; onboarding monólito remains a pattern for *one* deep guide, not the whole product.
- **Portuguese-first public site** — rejected for v1 npm audience (user ratified EN).

## Self-review against code-quality gates

- G1 read-before-claim: applied — claims about catalog, generators, config, onboarding HTML cite paths above
- G2 soft-language: applied — decisions stated as will/must; 0 ban-list hedges intended
- G6 reference-or-strike: applied — code claims carry verified_by paths; ops deploy host left as open question
