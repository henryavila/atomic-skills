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

## Next actions — ALL FOUR DONE (2026-06-16, this branch)

Two forks were ratified by Henry before the manifest rewrite: **1B** (no tech debt —
refactor the handlers to the flat sources, don't keep parallel frontmatter sources) and
**2A** (build the v2 design's page set, not a minimal rebind).

1. ✅ **Catalog** — `8cf7588`. `scripts/generate-catalog-json.js` (+ pure
   `scripts/lib/build-catalog-json.js`, +11 tests) → bare-array `meta/catalog.json` in the
   CatalogWidget flat-key shape. Wired into generate-docs/check-docs + husky (re-stage +
   F-001 guard cover `meta/catalog.json`).
2. ✅ **Manifest cutover + handler refactor (1B/2A)** — `1f5da9d`.
   - Emitter also emits `phaseGates/stack/parked/emerged.json` + `lastUpdated` on initiatives
     (the data the handlers need once off the nested frontmatter).
   - Handlers read the FLAT sources via new `_lib.js` accessors (tasksFor/gatesFor/stackFor/
     parkedFor/phasesFor/phaseGatesFor); frontmatter/explode sources dropped.
   - Manifest = v2 pages (Foco default / Panorama / Planos / plan + phase detail / Concluídos /
     Ajuda-catalog). Validated against the real aiDeck v0.1 zod schema (`loadManifest`).
   - **Router cap discovered:** client routes stop at `/:projectId/:slug` (2 params) and
     `source.param` reads only path params → in-page phase selection is impossible; selection
     is navigation to the `phase` page (stepper `linkTo`). The design's `manifest.sample.yaml`
     in-place `selectedPhase` container does NOT translate.
3. ✅ **Schemas + validate gate** — `da5e58d`. `meta/schemas/aideck-state.schema.json`
   (draft-07, strict, keyed by plural dataSource id so `#/definitions/<id>` resolves the flat
   shape, not the singular plan/initiative fallback) → bundled into `schema.json` by
   `build-aideck-consumer-schema.mjs` (schema-drift test keeps it synced).
   `scripts/validate-aideck-state.js` (`npm run validate-aideck-state`) runs the same Ajv
   validation aiDeck would, against the in-memory emitted projection. No `schema:` in the manifest.
4. ✅ **One shared consumer** — `ccf9ee8`. `provision-consumer.js` rewritten identity-free
   (fixed id `atomic-skills`); the AIDECK CONTRACT in `project-view.md` sets `AIDECK_CONSUMER`
   fixed, `$pid` scopes the project (POST /api/projects/register). Install/uninstall parity
   unchanged (same runtime footprint path; `~/.aideck/` is out of parity scope).

**Suite after all four: 878 tests, 8 pre-existing failures unchanged** (install 5 + detect 3
count-drift). Touched/added tests all green. `loadManifest` OK, `validate-aideck-state` clean
on the real tree (13 plans / 38 phases / 131 tasks / 55 gates / 65 phaseGates / 31 stack).

### Not yet verified (needs the running dashboard)
The manifest is schema-valid but RENDER correctness is untested here (no browser). Open the
dashboard (`/atomic-skills:project status --browser`) and eyeball: the Foco per-plan card's
`$parent`-scoped stepper, the collection-grid body slots, record-switcher selection, and the
external deep-link shape (`project-view.md` lines ~322 still use `?project=` + single slug;
the in-dashboard `linkTo` uses the 2-param path which is correct).

## Open product calls (Henry to ratify — aiDeck offered to build)

Top-level `statusMap`; manifest-driven `chrome` (palette + `?`→catalog help); and the full
v2 manifest DSL epic (R1–R7 in `aideck-v2-runtime-ask.md`). Until ratified, ship on v0.1.

## Gotchas

- Unknown widget keys render a visible **"Unknown widget: <key>"** placeholder (not blank).
- Emitter output is gitignored (`.atomic-skills/.aideck/`) — regenerate with `npm run emit-state`;
  it must run on serve / on state mutation for the dashboard to have data.
- `node:test` pre-existing failures are count-drift in install/detect tests + a harness
  yaml-resolution issue — don't chase them; confirm "8 fail" is unchanged after your work.
