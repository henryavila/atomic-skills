# 14 — aiDeck v2 Model-B Integration: Session Handoff (R-MIG-14)

**Read this first to resume cold.** Companion docs: `12-*` (gap analysis), `13-*` (full plan).
Memory breadcrumb: `project-aideck-v2-modelb-integration.md` (+ MEMORY.md line).

## Where things stand (2026-06-02)

aiDeck was rebuilt into a generic v2 runtime. We are reconnecting the project skill via a **Model-B
consumer** (manifest + schema + handlers), reading the repo's git-tracked nested `.atomic-skills/`
**in place**. Locked decisions: Model B · flatten+optional `projectId` · read-in-place · full 7
handlers · then npm-publish aiDeck. Validate with the `/Volumes/External/code/aideck` checkout
(branch `feat/aideck-v2-generic-runtime`).

### DONE
- **Phase A — aiDeck read-in-place capability** — COMMITTED in aideck repo as `7c88b1b`.
  - `src/server/manifest-schema.ts`: dataSource gained `root?:'consumer'|'project'` + `captures?:string[]`.
  - `src/server/data-source-reader.ts`: `expandGlob` rewritten → multi-`*` + `**` segment walk
    returning per-file captures; captures injected onto records (never clobbers an existing field;
    no-glob path still yields `io_error`; `isWithinDir` containment preserved).
  - `src/server/routes/api-v2.ts` + `src/server/index.ts`: `GET /api/consumers/:id/projects` and
    `GET /api/consumers/:id/projects/:projectId/data/:ds(/:slug)`; baseDir = `project.rootDir` when
    `root:'project'` else `consumer.dir`; `ProjectRegistry` threaded into `ApiV2Deps`.
  - Tests: `tests/unit/server/data-source-reader-nested.test.ts` (6) + fixture
    `tests/fixtures/projects/sample-repo/`. Typecheck clean; suite 587/588 (1 pre-existing chokidar
    `file-count-cap` flake — passes in isolation).
- **Phase B-read** — consumer `manifest.yaml` authored at
  `atomic-skills/assets/aideck-consumer/manifest.yaml` (root:project dataSources + captures for
  plans/initiatives/archive/discover/inbox; overview+plans+phases pages). Installed copy at
  `~/.aideck/consumers/atomic-skills/manifest.yaml`. **Live smoke PASSED** against the current repo:
  register → `/projects/atomic-skills/data/plans` count=7, `…/initiatives` count=16, captures
  injected, plan-by-slug found. (Smoke script was throwaway, already deleted.)

### NOT STARTED
Three independent workstreams + validate + publish.

## NEXT STEPS (pick up here)

**Recommended order: #1 client (makes it visible) → #2 B-write → #3 prompts → C → D.**

### 1. Client project-aware rendering  (task #5; aideck/Vue) — RECOMMENDED FIRST
The Vue client still calls consumer-root endpoints, so the browser won't show project data yet.
- `src/client/api.ts`: add `fetchProjects(consumerId)` → `GET /api/consumers/:id/projects`; make
  `fetchDataSource` accept a `projectId` and call `/api/consumers/:id/projects/:projectId/data/:ds`
  when the consumer has any `root:'project'` dataSource (else keep the consumer-root call).
- `src/client/router.ts` + `ConsumerPage.vue`: carry a selected `projectId` (query param or a
  selector); default to the first project. Add a project switcher in the chrome/nav.
- Verify in browser: `cd aideck && npm run dev` (or `aideck up` from the atomic-skills repo so it
  registers), open the dashboard → Overview should show 7 plans / phases kanban. Use the `verify`
  skill / a Vite build test.

### 2. B-write: schema.json + 7 script handlers  (task #2)
- **schema.json** → `assets/aideck-consumer/schema.json`, `$id: atomic-skills-schema`,
  `definitions: { plan, initiative, task, ... }`. Assemble from atomic-skills
  `meta/schemas/{plan,initiative,common}.schema.json` (already JSON Schema, **0.1∪0.2**) — inline the
  `common.schema.json#/$defs/*` refs into one self-contained file (rewrite `$ref`s to
  `#/definitions/...`). AJV loads it `strict:false`. NOTE: read endpoint does NOT validate; schema.json
  is for the `aideck validate` CLI loop + future inline validation. GAP 4 dissolves here (we ship our
  own schema, not aiDeck's 0.1-pinned zod).
- **7 handlers** → `assets/aideck-consumer/handlers/*.js`, ported per aiDeck
  `docs/handoff-atomic-skills-migration.md` §6/§8 from aideck `src/mcp/tools/*` + `src/server/projections/*`:
  mark-task-done, verify-exit-gate, get-next-action, get-dependencies, health, pop-frame,
  promote-parked. Handler signature `export default async ({args,data,files,log}) => {...}`; cwd =
  consumer dir; writes intents to inbox JSONL via `files.append`; the skill applies them (intent
  pattern preserved — aiDeck never writes entity files).
  - **OPEN DESIGN ITEM:** handlers need **projectId awareness** — `data` (the pre-loaded dataSource
    map) and intent targets are per-project, but the current script-handler runtime loads a single
    `data` map with no projectId. Check `aideck/src/server/handlers/script.ts` + the MCP tool path;
    likely need to extend the handler context/input to accept `projectId` and load project-scoped
    data (small Phase-A-style aideck addition). Resolve before porting handlers.
- **install.js** → `atomic-skills/src/install.js`: copy `assets/aideck-consumer/` (manifest + schema +
  handlers) into `~/.aideck/consumers/atomic-skills/`. Follow the existing aideck-bin/dashboard
  install convention (`resolveAideckBin` in `src/serve.js`).

### 3. Skill-prompt migration  (task #2 tail) — the one unavoidable skill-side change
- Rewrite the `AIDECK_*` contract block in `skills/shared/project-assets/project-view.md` for the new
  project-scoped endpoints (state now comes from
  `/api/consumers/atomic-skills/projects/<projectId>/data/<ds>`, not
  `/api/projects/:pid/state/project-status`). Keep it isolated to this one file per the existing
  convention.
- MCP tool renames across skill bodies: `aideck_get_plan`→`aideck_read`,
  `aideck_mark_task_done`→`aideck_atomic_skills_mark_task_done`, etc. Full mapping in aideck
  `docs/handoff-atomic-skills-migration.md` §6. Re-run the skill compatibility/strip tests after.

### Phase C — validate end-to-end
Register this repo, open the dashboard (client done), exercise discover review + the 7 MCP tools
against the live nested tree. Expect/fix `schema.json` ↔ live-frontmatter drift (reuse
`src/normalize.js` learnings; see `reference-aideck-card-failed-to-load`).

### Phase D — publish aiDeck to npm
Version bump `@henryavila/aideck` (currently 0.0.1) + `npm publish`; repoint
`atomic-skills/src/serve.js:resolveAideckBin` at the published binary; refresh/drop
`atomic-skills/vendor/aideck-runtime`.

## Quick re-validate of Phase A/B-read (sanity on resume)
```
cd /Volumes/External/code/aideck && npx vitest run tests/unit/server/data-source-reader*.test.ts
# manifest already at ~/.aideck/consumers/atomic-skills/manifest.yaml
# (re-run the curl smoke by starting the server + POST /api/projects/register if needed)
```

## Gotchas
- aideck working tree has **pre-existing unrelated** `.atomic-skills/` changes — do NOT bundle them
  into Model-B commits (stage files explicitly, as `7c88b1b` did).
- macOS FS is case-insensitive: `../aideck` and `../aiDeck` are the same dir.
- Commit only on explicit request. Branch: aideck `feat/aideck-v2-generic-runtime`, atomic-skills
  `dogfood/self-host-migration`.
