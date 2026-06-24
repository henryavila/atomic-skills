# Reference — aiDeck dashboard ↔ claude.ai/design alignment (the "misturado" fix)

Non-obvious facts for editing `assets/aideck-consumer/manifest.yaml` or the aiDeck
client to match the "Atomic Skills" design. Companion: `reference-aideck-consumer-dashboard.md`.

## Which aiDeck client actually runs (don't be fooled by the sibling checkout)
- The **published `@henryavila/aideck@0.2.0` IS the DS v2.1 client** — it has
  `nav.style:'projects'`, `showInNav`, and all DS widgets (collection-grid,
  headline-banner, record-switcher, status-list, stepper, catalog). `aiDeck main`
  (HEAD where PR #2 `feat/ds-v2.1-widgets` merged) == 0.2.0.
- `resolveAideckBin()` (src/serve.js) uses the published pkg via
  `~/.atomic-skills/bin/aideck.mjs` — **not** the sibling `/Volumes/External/code/aideck`
  checkout, which may sit on a stale branch (`feat/aideck-v2-generic-runtime` had
  only 4 widgets + no projects nav). The canonical v2.1 work was authored on the
  Linux box `/home/henry/aideck` and published; the macOS sibling lagged.
- To iterate on aiDeck client edits LOCALLY: build (`npm run build`) then serve with
  `AIDECK_BIN=<repo>/dist/cli.js node <repo>/dist/cli.js serve --port 7777 --static-dir <repo>/dist/client`.
  `npm run build` needs `@mdi/font` — after a branch switch run `npm install`
  (stale node_modules); that prune can also remove `playwright` (use a throwaway
  `playwright-core` + the puppeteer `chrome-headless-shell` for screenshots).

## The "layout misturado" was dev-plumbing leaking into the projects shell
Not a broken shell — the manifest+data were fine. Culprits (all fixed, aiDeck client):
- **Sidebar `DATA SOURCES` file-tree** (Sidebar.vue) rendered in ALL nav modes →
  hide when `navStyle==='projects'`. It also leaked sibling consumers (dispatch-test).
- **`<layout> layout` debug label** in the page header (ConsumerPage.vue) → removed.
- **Raw field-name table/key-value headers** (CURRENTPHASETEXT) → TableWidget/
  KeyValueWidget now humanize (camelCase→words) + honor `config.columnLabels` /
  `config.labels` overrides (the manifest supplies PT labels).
- Stray `dispatch-test` consumer in `~/.aideck/consumers/` → `rm -rf` + restart.

## The design reference lives in the aiDeck repo
- `aideck/docs/handoffs/atomic-skills-v2-manifest.sample.yaml` = the design's
  structural manifest (schemaVersion "2.0" pseudo-grammar — TRANSLATE to the real
  0.1 manifest, don't copy verbatim). `aideck/docs/design-system/` = DS css/components.
- **Plan detail (the most important screen)** = master-detail: `record-switcher`
  (title) → 2-col `[ vertical selectable stepper (colSpan 5) | selected-phase
  record-detail card (colSpan 7) ]`. The card = TASKS/GATES/STACK metric strip +
  PRÓXIMA AÇÃO callout + grouped task `status-list` + exit-gate `status-list`
  (variant: checklist).

## Composing the record-detail in real 0.2.0 grammar
- `container`/`grid-columns` have NO child-widget slot preset (only Card,
  CollectionGrid, Table cell, Kanban, Stepper render `slots`). Express the
  right-column record-detail as ONE `collection-grid` card (1 record via the
  selectedPhase bus) with **both** a `fields`/`fieldLabels` metric strip AND
  `slots.body` (callout + status-lists). Body children bind to the card record via
  `$parent.*` filters (same pattern as the Foco agora card).
- A flat 12-col section can't keep a stack of colSpan-7 widgets in one column next
  to a tall stepper (grid auto-flow breaks) — hence the single-card host.

## Param/route gotchas for a detail page reachable from the sidebar
- A page whose widgets use `param.match: [..., {field, param: slug}]` lands EMPTY
  when opened from the sidebar (`/plan?project=x`, no `:slug`). Fix: the
  `record-switcher` self-selects the first record (`router.replace` to its linkTo)
  when the route carries no selection — generic aiDeck behavior, so the nav entry
  populates instead of `showInNav:false`-hiding the page.
- Scope the selected phase by route (projectId + planSlug) AND the page-state bus
  (`phaseId == selectedPhase`) — phaseId alone collides across plans.

## Done-phase callout (no stale "próxima ação")
- Emitter (`scripts/emit-consumer-state.js`) clears `nextText` for `done`/`archived`
  initiatives — a concluded phase has no next action.
- A `callout` defaults `titleField:'title'`, so it re-shows the initiative `title`
  (redundant with the card head) AND keeps a done-phase callout from collapsing.
  Set `titleField: ''` (eyebrow+body only); CalloutWidget now collapses to nothing
  when it's eyebrow-only (no title/body).

## Live-apply loop (manifest cached at boot, state watched)
`re-emit (node scripts/emit-consumer-state.js <repo>) → re-provision (node
src/provision-consumer.js, reads assets/aideck-consumer/, fresh copy) → restart
server → re-register project (POST /api/projects/register {rootDir, projectId})`.
Manifest change ⇒ restart; state change ⇒ live via SSE. Verify the DOM with a
headless browser; `tests/aideck-consumer-manifest.test.js` locks the plan-page
structure by widget type via `allWidgets` (recurses slots), not section titles.
