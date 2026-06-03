# 16 — aiDeck dashboard port: session handoff (consumer side)

**Status:** SPEC APPROVED 2026-06-03. Ready to implement. **Branch:** `dogfood/self-host-migration`.
**Anchored to:** `project-orchestrator-redesign` → phase **F5** (`inc7-aideck-prose-long-tail`),
tasks **T-005…T-009** (this port). The hard-gate is satisfied — do NOT implement unanchored.

---

## START HERE (next session)

The MVP dashboard (one `table` dumping JSON-blob columns) is being replaced by a real port of
the old React dashboard's insight, rendered through the generic aiDeck via the Model-B consumer.
The plan + component spec are **approved**. Two lanes run in parallel: **aiDeck builds generic
capabilities/widgets**; **I (consumer) build the manifest/pages**. Begin with **my no-dependency
slice — task T-005** below. No aiDeck change is needed for T-005…T-007.

**First action:** open `assets/aideck-consumer/manifest.yaml`, fix the `plans` table
(`config.columns` whitelist), then bring the dashboard up (commands in §4) and confirm the JSON
blobs are gone.

---

## 1. The two approved design docs (read both first)
- **`docs/design/project-orchestrator/15-aideck-dashboard-port-plan.md`** — the gap analysis +
  5-phase plan (P1…P5), aiDeck-side vs consumer-side split, the forks (§7).
- **`/Volumes/External/code/aideck/docs/component-spec-atomic-skills-dashboard.md`** — the
  component contract for the aiDeck side: the real data shapes (§1), the 3 cross-cutting
  capabilities (array-explode §2a, **widget composition/slots §2b**, drill-down §2c, SSE §2d),
  existing-widget extensions (§3), the new widgets (§4: `phase-timeline`, `dag-graph`, `callout`,
  `sparkline`, `stack-view`, `exit-gate-list`, `task-list`), page composition (§5), and the
  division of labor + sequencing (§6).

Approved decisions (spec §7 / plan §7): rollups precomputed **by the skill** into frontmatter
(aiDeck stays read-in-place); target **insight-parity** (bespoke widgets only where
table+composition loses essential fidelity); `dag-graph` mermaid interim → interactive later;
multi-project composite-param deferred (single-project-per-repo OK for now).

## 2. My lane (consumer) — implement in this order

**No aiDeck dependency — start now:**
- **T-005 — Fix the broken plans table.** In `assets/aideck-consumer/manifest.yaml`, add
  `config.columns: [title, status, currentPhase, branch, projectId]` + an `emptyNote` to the
  `plans` table widget. `TableWidget.vue:104-112` already honors `columns` and drops
  `_body`/`_file` + renders status chips — this alone kills the `phases`/`_body` JSON blobs.
- **T-006 — Real Plans view + stat tiles + scalar audit.** Plans page = scalar `table` + a
  `card-grid` grouped `repeat: projectId` (native, `WidgetRenderer.vue:136-148`). Add
  lane-meaningful `stat` tiles (e.g. `count(status=paused)`). Audit the `kanban-board`/`list`
  configs so only scalar fields render (no `tasks[]`/`stack[]` leakage).
- **T-007 — Reinstall + live-verify.** Reinstall the consumer fresh (§4), bring the dashboard up
  against the NEW aideck, confirm Overview + Plans render cleanly with real data.

**Blocked on aiDeck (do NOT start until the matching capability lands):**
- **T-008 — Exploded dataSources + skill rollups.** *(blocked on aiDeck §2a array-explode.)*
  Declare derived sources (`phases`, `tasks`, `exit_gates`, `stack_frames`, `parked_items`,
  `emerged_items`) via `explode`/`derivesFrom`/`carry`. Skill precomputes rollup fields
  (`tasksDone/tasksTotal`, `gatesMet/gatesTotal`, `staleDays`) into the phase frontmatter
  (new skill-side writer in `src/` + the project-status handlers).
- **T-009 — Detail pages + composed widgets + new-widget bindings.** *(blocked on aiDeck §2b
  composition, §2c drill-down, §4 widgets.)* Per-plan + per-initiative detail pages (scoped
  param + row-scoped `linkTo`), composed cards (progress-bar in kanban, `callout`, `sparkline`),
  and bind `phase-timeline` / `exit-gate-list` / `stack-view` / `dag-graph` per spec §5.

## 3. aiDeck's lane (parallel, the other repo) — what unblocks me
Build order (spec §6.1): **composition/slots (§2b)** → **array-explode (§2a)** → drill-down (§2c)
→ new widgets (§4: `phase-timeline`/`callout`/`sparkline` first, then the rest, `dag-graph` last)
→ SSE fix (§2d). T-008 unblocks after §2a; T-009 after §2b+§2c (+ the relevant §4 widget).

## 4. Bring-up commands (test against the NEW aideck, not the stale vendored one)
```bash
# 1. reinstall the consumer fresh (the installed copy goes stale across edits)
rm -rf ~/.aideck/consumers/atomic-skills
cp -R /Volumes/External/code/atomic-skills/assets/aideck-consumer ~/.aideck/consumers/atomic-skills

# 2. start the NEW aideck (sibling) with its v2 client SPA, from the repo cwd
cd /Volumes/External/code/atomic-skills
AIDECK_BIN=/Volumes/External/code/aideck/dist/cli.js \
  node /Volumes/External/code/aideck/dist/cli.js serve \
  --port 7799 --static-dir /Volumes/External/code/aideck/dist/client &

# 3. register this repo as a project, then open the dashboard
curl -fsS -X POST http://127.0.0.1:7799/api/projects/register \
  -H 'Content-Type: application/json' \
  -d '{"rootDir":"/Volumes/External/code/atomic-skills","projectId":"atomic-skills"}'
open http://127.0.0.1:7799/atomic-skills    # ConsumerPage auto-selects the project
```
Why forced: `resolveAideckBin` (`src/serve.js:59-70`) prefers the **stale vendored**
`dist/aideck.mjs` over the sibling, so `AIDECK_BIN` is mandatory until Phase D (T-004) publishes
+ repoints. The aideck client SPA is `dist/client` (it is NOT auto-served without `--static-dir`).
Inspect data: `GET /api/consumers/atomic-skills/projects/atomic-skills/data/<plans|initiatives>`.

## 5. Current state (as of this handoff)
- Consumer **reinstalled fresh** earlier this session (byte-identical to `assets/aideck-consumer/`,
  manifest now carries the F-001 `projectId` fields). The running test server was shut down at
  end of session — restart via §4.
- The integration itself (read + MCP mutation) is **proven** against aideck HEAD on
  `feat/aideck-v2-generic-runtime`; no aiDeck code change is needed for the *integration* (only
  Phase D publish, T-004, gated). The dashboard *port* is the new work (T-005…T-009).
- `.atomic-skills/` is gitignored local state; the two design docs (15, 16) + the aideck spec ARE
  committed artifacts.

## 6. Tracker anchor
`project-status` (terminal/browser) will show F5 with T-005 as the next unblocked action.
The dashboard-port emergence is recorded in the F5 phase file's `emerged[]`. Resume by reading
this doc's **START HERE**, then `get_next_action` (or the skill) → T-005.
