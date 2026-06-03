# Reference — aiDeck consumer dashboard (rollups, generated schema, capability dependency)

Non-obvious facts for anyone editing `assets/aideck-consumer/` or the dashboard port (R-MIG-14, T-005..T-009). Companion: `docs/design/project-orchestrator/15`/`16`/`17`; aiDeck contract = `../aideck/docs/component-spec-atomic-skills-dashboard.md`.

## `schema.json` is GENERATED — never hand-edit it
`assets/aideck-consumer/schema.json` is built by `npm run build:aideck-schema`
(`scripts/build-aideck-consumer-schema.mjs`) from `meta/schemas/{common,plan,initiative}.schema.json`
(bundles `$defs`, rewrites refs to `#/definitions/`, drops top-level `additionalProperties:false`).
Edit the **meta schemas** then rebuild — a hand-edit to `schema.json` is overwritten.
`meta/schemas/*.schema.json` are `additionalProperties:false`, so ANY new frontmatter field
MUST be declared there first or both `scripts/validate-state.js` and the consumer schema reject it.

## Dashboard meters read skill-precomputed rollups (aiDeck has no compute engine)
Initiative frontmatter carries `tasksDone`/`tasksTotal`/`gatesMet`/`gatesTotal`. The generic
aiDeck reads state in place and cannot compute, so the **skill** writes these:
- Recompute on every task/gate **status** mutation (rule in `skills/core/project.md`, mirrored in
  `project-transitions.md` done/phase-done), OR run `node scripts/compute-rollups.js` (idempotent
  batch/backfill + drift fixer).
- Rollups are **self-contained per initiative** (count its own `tasks[]`/`exitGates[]`). The
  `phase-timeline` widget binds to the `initiatives` source (NOT exploded `plan.phases[]`) precisely
  to avoid a plan↔initiative join — the plan `phaseDescriptor` has no `tasks[]`.
- `staleDays` is deliberately NOT persisted (it's now-relative; compute at read time like `handlers/health.js`).

## The consumer manifest is ahead of the published aiDeck
`manifest.yaml` now uses aiDeck **§2a array-explode** (`derivesFrom`/`explode`/`carry` derived
dataSources), **§2b slots** (composition), **§2c drill-down** (`source.param` as
`string | {match:[ string | {field,param} ]}` + row-scoped `linkTo`), and the
`callout`/`sparkline`/`phase-timeline` widgets. These exist only on aiDeck
`feat/aideck-v2-generic-runtime` (NOT yet on npm). Until T-004 (publish + repoint
`src/serve.js:resolveAideckBin`), bring the dashboard up against the sibling build:
`AIDECK_BIN=/Volumes/External/code/aideck/dist/cli.js node …/aideck/dist/cli.js serve --port 7799 --static-dir …/aideck/dist/client` (resolveAideckBin otherwise prefers the stale vendored bin). Detail pages route `/:consumerId/<plan|phase>/:projectId/:slug`.
