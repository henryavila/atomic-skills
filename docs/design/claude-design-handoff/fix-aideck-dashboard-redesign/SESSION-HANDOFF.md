# Session handoff — dashboard v2 cutover (read first)

**Branch:** `plan/fix-aideck-dashboard` (worktree `.worktrees/fix-aideck-dashboard`).
**aiDeck source of truth:** `/home/henry/aideck` (branch `feat/ds-v2.1-widgets`).
**Last updated:** 2026-06-16.

## The load-bearing fact (don't re-litigate)

There is **NO aiDeck manifest v2.0.** "DS v2.1" = the new widget *components*, NOT a new
manifest schema. The runtime is still **`schemaVersion '0.1'`**: `dataSources[]` array,
**strict-equality `filter`** (no agg / no operators / **array-OR silently zeros rows**),
route-`param` matching (no reactive vars / no `emits`), per-widget `config.statuses` (no
top-level `statusMap`), layouts `sections|grid|single` (no `master-detail`), `slots` as
binding lists.

⇒ The design's `manifest.sample.yaml` is an **imagined DSL** — a layout/intent reference
only. Every binding must be translated to the v0.1 contract. **The emitter precomputes
everything.** Full Q&A: `/home/henry/aideck/docs/handoffs/atomic-skills-v2-answers.md`
(read it — Q1, Q4, Q5, Q9, Q10, Q11 are the load-bearing ones).

## Done & committed (this branch)

- `38cf2a9` — removed the dead React dashboard (`src/dashboard`), vite/tsconfig, the
  catalog→HelpView generator, obsolete e2e-smoke; `serve()` now points aideck at the staged
  Vue client; dropped React/vite/tailwind devDeps (lockfile synced).
- `07c12a1` — groundwork docs: `manifest.sample.yaml` (design target) + `aideck-v2-runtime-ask.md`.
- `dcac252` — **the emitter** `scripts/emit-consumer-state.js` (+ 11 tests): reads
  `.atomic-skills/projects/` → bare JSON arrays in `.atomic-skills/.aideck/state/`
  (`root: project`, gitignored, regenerable) with all derived fields + bucket booleans.
  `npm run emit-state`. Verified on the real tree (13 plans / 38 phases / 131 tasks / 55 gates).

Suite: 863 tests, **8 pre-existing failures** (5 `install.test.js` + 3 `detect.test.js`
count-drift + 2 `pre-commit.test.sh` yaml-resolution — all fail identically on clean HEAD,
NOT ours). My touched/added tests are green.

## Next actions (in order)

1. **Catalog** — `scripts/generate-catalog-json.js`: `meta/catalog.yaml` (via `collectSkills`
   in `scripts/lib/validate-skills-core.js`) → a **bare-array** `meta/catalog.json` in the
   `CatalogWidget`'s flat-key shape (Q11): `id` (bake `/atomic-skills:` prefix — `refs` match
   against it), `icon`←emoji, `oneLiner`, `facets`←tags, `summary`←purpose, `examples` (command
   strings), `pros`←when_to_use, `cons`←when_not_to_use, `subItems`←subcommands
   `{name,description,group}`, `fields`←args `{name,kind,required,description}`, `deps`←dependencies,
   `outputs`←output_artifacts, `refs`←related (prefixed). Wire into generate-docs/check-docs +
   husky (it replaces the deleted `skills.generated.ts` regen step) + a test.
2. **Evolve `assets/aideck-consumer/manifest.yaml`** (v0.1, stays live; adopt incrementally):
   - dataSources → the emitted `state/*.json` (`format: json`, `root: project`,
     `path: .atomic-skills/.aideck/state/<entity>.json`). Drop the in-place frontmatter/explode
     sources that the emitter now denormalizes.
   - New widgets per the v0.1 bindings in the answers doc Q9/Q11/Q12: `collection-grid`
     (`header/body/footer` slots), `stepper` (route-linked rows + `slots["cell:<col>"]` dense in
     a table), `record-switcher` (selection=navigation, `config.linkTo`), `status-list`,
     `headline-banner`, `catalog` (`layout: single`).
   - **Route-driven selection** (no reactive vars): selected phase = route param; container
     filters via `source.param.match`. `$record.x` → `$parent.x` in slot filters.
   - Per-widget `config.statuses` (tone set success|warning|error|info|neutral). Bucket
     booleans for the old array-OR filters.
   - Update `tests/aideck-consumer-manifest.test.js` (it asserts the OLD v0.1 structure).
3. **`schemas/*.json`** (Ajv draft-07) per emitted entity + run `aideck validate` as a CI gate.
   Do NOT put `schema:` in the manifest (not enforced at read time, path-string is invalid).
4. **Collapse `provision-consumer.js`** (Q10): ONE consumer (`id`+`mcpNamespace`+`title`, all
   required) + project registration — not one-consumer-per-projectId. Update its tests +
   install/uninstall parity.

## Open product calls (Henry to ratify — aiDeck offered to build)

Top-level `statusMap`; manifest-driven `chrome` (palette + `?`→catalog help); and the full
v2 manifest DSL epic (R1–R7 in `aideck-v2-runtime-ask.md`). Until ratified, ship on v0.1.

## Gotchas

- Unknown widget keys render a visible **"Unknown widget: <key>"** placeholder (not blank).
- Emitter output is gitignored (`.atomic-skills/.aideck/`) — regenerate with `npm run emit-state`;
  it must run on serve / on state mutation for the dashboard to have data.
- `node:test` pre-existing failures are count-drift in install/detect tests + a harness
  yaml-resolution issue — don't chase them; confirm "8 fail" is unchanged after your work.
