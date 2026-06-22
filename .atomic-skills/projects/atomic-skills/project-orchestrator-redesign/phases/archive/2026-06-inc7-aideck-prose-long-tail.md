---
schemaVersion: "0.1"
slug: inc7-aideck-prose-long-tail
title: Inc7 — aiDeck consumer-side (Model-B) + prose/schema long tail
goal: Reconnect the project skill to the rebuilt generic aiDeck via a Model-B
  consumer (manifest + schema.json + 7 script handlers, read-in-place), plus the
  prose/schema long tail. R-MIG-09..18/22/23. Materialized 2026-06-03 to make
  the real A/B/C/D progress trackable (the parent plan had carried F5 as a
  single prose criterion only).
status: done
branch: main
started: 2026-06-02T00:00:00Z
lastUpdated: 2026-06-07T18:58:34Z
nextAction: null
parentPlan: project-orchestrator-redesign
phaseId: F5
tasksDone: 10
tasksTotal: 10
gatesMet: 1
gatesTotal: 1
weightDone: 10
weightTotal: 10
exitGates:
  - id: F5-G1
    description: "The project-status skill reads + mutates the live nested tree
      (DONE: skill-body 11173a8, hook c1410db) AND the aiDeck consumer side is
      reconnected via a Model-B consumer. Model-B consumer Phase A/B/C are DONE
      and live-validated (5 dataSources + 7 MCP tools, handoff session 4). The
      ONLY remaining sub-item is Phase D (npm publish + repoint), gated on
      explicit go-ahead."
    status: met
    metAt: 2026-06-07T08:56:55Z
    evidence:
      verifierKind: manual
      verifiedAt: 2026-06-07T08:56:55Z
      passed: true
      outputSummary: "VERIFIED end-to-end against the PUBLISHED @henryavila/aideck
        0.1.0. HTTP: project-scoped
        /api/consumers/atomic-skills/projects/atomic-skills/data/plans = 8
        records (initiatives=18, phases=24); /api/consumers lists the v2
        registry (atomic-skills, dispatch-test). MCP: aideck mcp stdio
        initialize + tools/list = 24 tools. Run through the REAL user flow: the
        installRuntimeArtifacts shim (~/.atomic-skills/bin/aideck.mjs, 363B,
        argv[1]-rewrite → published cli.js) spawns the published CLI and serves
        the route. NOTE: an earlier 'v2 routes 404' reading was a FALSE ALARM —
        the live server had run the STALE vendored bin from a pre-cutover
        install; re-running install restages the shim and fixes it. No aiDeck
        bug. (Minor aiDeck cosmetic: /api/health reports version 0.0.1 because
        cli serve doesn't pass opts.version to startServer — non-blocking.)"
    verifier:
      kind: manual
      description: "Publish lands a non-0.0.1 @henryavila/aideck; resolveAideckBin
        resolves the published bin; smoke test: project-scoped
        /api/consumers/atomic-skills/ projects/:id/data/plans returns records,
        and one MCP tool responds over `aideck mcp` stdio."
      fallbackKind: cli
    verifierLabel: manual
    evidenceSummary: passed · 2026-06-07
stack: []
tasks:
  - id: T-001
    title: aiDeck read-in-place capability (aiDeck side)
    summary: Implementa no aiDeck a leitura read-in-place do estado (dataSource
      root:project + captures + rotas project-scoped).
    description: manifest-schema dataSource root:'consumer'|'project' + captures[];
      data-source-reader multi-* / ** glob with per-file capture injection;
      project-scoped endpoints
      /api/consumers/:id/projects(/:projectId/data/:ds). Committed in the aideck
      repo as 7c88b1b. Validated against current aideck HEAD (ca12075) — landed,
      no further code changes needed.
    status: done
    lastUpdated: 2026-06-02T00:00:00Z
    closedAt: 2026-06-02T00:00:00Z
  - id: T-002
    title: atomic-skills Model-B consumer + client (consumer side)
    summary: Cria o consumer Model-B (manifest + schema + 7 handlers) e o install
      que copia para ~/.aideck; client renderiza por projeto.
    description: "assets/aideck-consumer/{manifest.yaml (5 root:project dataSources,
      3 pages), schema.json (built by scripts/build-aideck-consumer-schema.mjs),
      7 script handlers}; install.js cpSync into
      ~/.aideck/consumers/atomic-skills/; client project-aware rendering.
      Commits: aideck b7a95d3 + ca12075 (model-A handler runtime, writeBaseDir);
      atomic-skills 7221ee9 (handlers) + ff3c341 (schema) + 67817cf (prompt
      migration). Suites: aideck 590/590, skills 705/705."
    status: done
    lastUpdated: 2026-06-02T00:00:00Z
    closedAt: 2026-06-02T00:00:00Z
  - id: T-003
    title: live end-to-end validation
    summary: "Valida a integração ponta-a-ponta no repo real: 5 dataSources
      project-scoped + 7 ferramentas MCP via stdio, árvores limpas."
    description: "Registered the live repo, exercised every layer: all 5 dataSources
      resolve project-scoped (plans=7, initiatives=16, archive=0, discover=1,
      inbox=0; captures projectId/planSlug/_body/_file injected); all 7 MCP
      tools exercised via real `aideck mcp` stdio (model A, cwd=repo) — reads
      correct, mutations wrote intents to the repo inbox, promote_parked error
      path OK. Trees clean; throwaway scripts deleted (handoff session 4)."
    status: done
    lastUpdated: 2026-06-02T00:00:00Z
    closedAt: 2026-06-02T00:00:00Z
  - id: T-004
    title: npm publish @henryavila/aideck + repoint resolveAideckBin
    summary: Publica @henryavila/aideck no npm e repointa o resolveAideckBin para o
      bin publicado (GATED; sem mudança de código no aiDeck).
    description: The ONLY remaining sub-item. aideck is still version 0.0.1,
      unpublished. Bump off 0.0.1 + `npm publish --access public` from ../aideck
      (never bundle the two pre-existing .atomic-skills/ working-tree edits),
      then repoint atomic-skills src/serve.js:resolveAideckBin at the published
      bin and refresh/drop vendor/aideck-runtime + re-run install. GATED on
      explicit go-ahead. No aiDeck CODE changes are required for the integration
      itself.
    status: done
    closedAt: 2026-06-07T08:56:55Z
    lastUpdated: 2026-06-07T08:56:55Z
    outputs:
      - kind: file
        path: package.json
      - kind: file
        path: src/serve.js
      - kind: file
        path: src/install.js
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-07T08:56:55Z
      exitCode: 0
      testsCollected: 789
      passed: true
      outputSummary: "DONE + verified e2e against PUBLISHED @henryavila/aideck 0.1.0.
        package.json: + dep ^0.1.0, drops dist/aideck.mjs +
        vendor/aideck-runtime from files[], removes build:aideck +
        prepublishOnly tail. serve.js + install.js resolveAideckPackageDir use a
        node_modules FS WALK (NOT require.resolve — the pkg is ESM-only, exports
        exposes neither ./package.json nor ./dist/cli.js, so CJS resolve throws
        ERR_PACKAGE_PATH_NOT_EXPORTED; caught at npm-install time). install
        restages an argv[1]-rewrite launcher shim (bin/aideck.mjs → published
        cli.js) + dist/client → dashboard/. Deleted vendor/aideck-runtime +
        dist/aideck.mjs + scripts/vendor-aideck.js + vendor-aideck-core.js + its
        test; .gitignore drops the !dist/aideck.mjs force-track. Full suite
        GREEN 789/789. SMOKE GREEN: published 0.1.0 serves project-scoped
        plans=8, initiatives=18, phases=24; MCP 24 tools; verified through the
        real shim flow. The transient 'v2 404' reading was a FALSE ALARM (live
        server had run the stale pre-cutover vendored bin; re-running install
        fixes it) — no aiDeck bug."
  - id: T-005
    title: Dashboard port — fix broken plans table (config.columns)
    summary: Conserta a tabela de planos do dashboard declarando config.columns
      (mata as colunas JSON-blob _body/phases).
    description: "No-aiDeck-dep. In assets/aideck-consumer/manifest.yaml, add
      config.columns:[title,status,currentPhase,branch,projectId] + emptyNote to
      the plans table widget. TableWidget already honors columns + drops
      _body/_file + renders status chips, so this kills the phases/_body
      JSON-blob columns. Spec: docs/design/project-orchestrator/16 §2 (T-005);
      component-spec §3."
    status: done
    blockedBy: []
    lastUpdated: 2026-06-03T00:00:00Z
    closedAt: 2026-06-03T00:00:00Z
  - id: T-006
    title: Dashboard port — real Plans view + stat tiles + scalar audit
    summary: Reconstrói a página Plans (tabela escalar + card-grid por projeto +
      stat tiles) e audita widgets para renderizar só campos escalares.
    description: "No-aiDeck-dep. Plans page = scalar table + card-grid grouped
      repeat:projectId; add lane-meaningful stat tiles (count(status=paused)
      etc.); audit kanban/list so only scalar fields render (no tasks[]/stack[]
      leakage). Spec: 16 §2 (T-006)."
    status: done
    blockedBy:
      - T-005
    lastUpdated: 2026-06-03T00:00:00Z
    closedAt: 2026-06-03T00:00:00Z
  - id: T-007
    title: Dashboard port — reinstall + live-verify improved dashboard
    summary: Reinstala o consumer e sobe o novo aiDeck para verificar ao vivo
      Overview + Plans com dados reais.
    description: "No-aiDeck-dep. Reinstall consumer fresh, bring up the NEW aideck
      (AIDECK_BIN + serve --static-dir dist/client), register project, confirm
      Overview + Plans render cleanly with real data. Bring-up commands: 16 §4."
    status: done
    blockedBy:
      - T-006
    lastUpdated: 2026-06-03T00:00:00Z
    closedAt: 2026-06-03T00:00:00Z
    outputs:
      - kind: test
        description: "Live-verified on aideck feat/aideck-v2-generic-runtime (port
          7799): consumer loaded clean (manifest parsed under server schema),
          plans endpoint = 7 records with whitelist fields populated and blob
          fields (principles/glossary/phases/references/_body) hidden by
          config.columns; initiatives = 17 records, all phaseId present.
          Overview + Plans render scalar-only."
  - id: T-008
    title: Dashboard port — exploded dataSources + skill rollups (BLOCKED on aiDeck
      §2a)
    summary: Declara as dataSources explodidas (phases/tasks/gates/…) e precomputa
      os rollups (tasksDone/Total, gatesMet/Total) no frontmatter.
    description: "Blocked on aiDeck array-explode (§2a). Declare derived sources
      (phases, tasks, exit_gates, stack_frames, parked_items, emerged_items) via
      explode/derivesFrom/carry; skill precomputes rollup fields
      (tasksDone/Total, gatesMet/Total, staleDays) into the phase frontmatter
      (new skill-side writer + handlers). Spec: 16 §2 (T-008)."
    status: done
    blockedBy: []
    lastUpdated: 2026-06-03T00:00:00Z
    closedAt: 2026-06-03T00:00:00Z
    outputs:
      - kind: test
        description: "aiDeck §2a array-explode built (derivesFrom/explode/carry in
          manifest-schema + data-source-reader resolver + api-v2 wiring; 87
          server tests). Consumer: 6 exploded sources declared
          (phases/tasks/exit_gates/ stack_frames/parked_items/emerged_items);
          self-contained initiative rollups (tasksDone/Total, gatesMet/Total)
          declared in meta/schemas + seeded in decompose.js + backfilled via
          scripts/compute-rollups.js (17 initiatives) + prose recompute rule in
          project.md/transitions.md. Live-verified: /data/phases=23, tasks=68,
          exit_gates=33, stack_frames=16, emerged=2 exploded rows; initiatives
          carry rollups. staleDays NOT persisted (now-relative; computed at read
          time per health.js)."
  - id: T-009
    title: Dashboard port — detail pages + composed widgets + new-widget bindings
      (BLOCKED on aiDeck §2b/2c/§4)
    summary: Adiciona páginas de detalhe (plano/iniciativa) com drill-down, cards
      compostos e os novos widgets (timeline, gates, stack, dag).
    description: "Blocked on aiDeck composition (§2b), drill-down (§2c), new widgets
      (§4). Per-plan + per-initiative detail pages (scoped param + row-scoped
      linkTo), composed cards (progress-bar in kanban, callout, sparkline), bind
      phase-timeline/exit-gate-list/ stack-view/dag-graph per component-spec §5.
      Spec: 16 §2 (T-009)."
    status: done
    blockedBy: []
    lastUpdated: 2026-06-03T00:00:00Z
    closedAt: 2026-06-03T00:00:00Z
    outputs:
      - kind: test
        description: "aiDeck §2b composition (WidgetSlot + parentRecord/$parent +
          depth-guard, slots wired into card/table/kanban/list/stat) + §2c
          drill-down (composite source.param incl {field,param} mapping,
          row-scoped linkTo, /:consumerId/:pageSlug/:projectId/:slug route +
          ConsumerPage scope) + §4 widgets (callout, sparkline, phase-timeline).
          Consumer manifest: Plan + Initiative detail pages (phase-timeline,
          exit-gate table, task table, stack/parked/emerged lists, key-value,
          markdown body), kanban card slot with progress-bar, drill-down linkTo
          from plans table/cards + phases card-grid. Live-verified: consumer
          loads, 5 pages incl plan/phase, all exploded endpoints serve.
          exit-gate-list/stack-view/task-list use table+composition
          (insight-parity); dag-graph = mermaid interim."
  - id: T-010
    title: "aiDeck consumer 'Agora': make multi-plan-aware (N≥1 active plans)"
    summary: Make the consumer manifest's Foco/Agora widgets group and label by plan
      so each active plan's phase, progress and timeline are unambiguous —
      correct for both 1 and N active plans.
    description: "Home 'Agora' rendered duplicated, unlabeled widgets when ≥2 plans
      were active: panel 'Fase atual' + phase-timeline used repeatLabel: never
      (no plan label). Fix in the consumer template
      assets/aideck-consumer/manifest.yaml — switch those widgets to
      repeatLabelField: planTitle with the default repeatLabel: auto (aiDeck
      hides the group header for 1 group, shows the plan name for ≥2).
      progress-bar + table were already correct; the callout self-labels via
      bodyField. No aiDeck core change (no section-repeat in schema v0.1)."
    status: done
    blockedBy: []
    lastUpdated: 2026-06-07T10:01:44Z
    closedAt: 2026-06-07T10:01:44Z
    tags:
      - dashboard
      - aideck-consumer
    scopeBoundary:
      - do NOT add aiDeck section-level repeat (not in schema v0.1 — upstream
        aiDeck concern)
      - do NOT touch the legacy React dashboard in src/dashboard/
    acceptance:
      - every plan-repeated widget in home 'Agora' surfaces a plan label
        (repeatLabelField, or the self-labeling callout)
      - with 1 active plan the per-plan group headers are hidden (repeatLabel
        auto)
      - with ≥2 active plans each duplicated widget shows its plan name
      - consumer manifest still validates — consumer registers and all
        dataSources load
    outputs:
      - kind: file
        path: assets/aideck-consumer/manifest.yaml
        description: "Agora widgets panel + phase-timeline → repeatLabelField: planTitle
          (auto); design comment rewritten for N≥1."
      - kind: test
        path: tests/aideck-consumer-manifest.test.js
        description: "Regression guard: no plan-repeated Agora widget may be unlabeled;
          proven to catch the original bug."
      - kind: file
        path: skills/shared/project-assets/project-view.md
        description: WSL-aware open_url helper (xdg-open hangs on WSL2) +
          status-opens-dashboard-directly note.
    verifier:
      kind: test
      runner: node --test
      pattern: tests/aideck-consumer-manifest.test.js
    evidence:
      verifierKind: test
      verifiedAt: 2026-06-07T10:01:44Z
      exitCode: 0
      testsCollected: 3
      passed: true
      outputSummary: node --test tests/aideck-consumer-manifest.test.js → 3 tests, 3
        pass, 0 fail (exit 0)
    provenance:
      surfacedAt: 2026-06-07T10:01:44Z
      surfacedDuring: inc7-aideck-prose-long-tail
      surfacedBy: human
    context:
      solves: Home 'Agora' rendered duplicated, unlabeled widgets (two 'Fase atual'
        panels, two timelines) with ≥2 active plans, so plans could not be told
        apart and one looked absent.
      trigger: Dogfooding `status` with two active plans showed 2 of everything with
        no plan labels; project-orchestrator-redesign appeared nowhere
        recognizable.
      assumesStillValid:
        - aiDeck has no section-level repeat in manifest schema v0.1 (only
          widget repeat + repeatLabel auto/always/never), so per-widget labels
          are the fix.
        - The project legitimately runs multiple active plans at once.
        - planTitle stays precomputed onto plan/initiative/phase records by
          reconcile-focus.js.
      ratifiedAt: 2026-06-07T10:01:44Z
      ratifiedBy: human
      lastReviewedAt: 2026-06-07T10:01:44Z
parked: []
emerged:
  - title: MVP dashboard insufficient → full component port (composition +
      array-explode + new widgets)
    surfacedAt: 2026-06-03T00:00:00Z
    promoted: true
    context:
      solves: The shipped consumer manifest was an MVP (one table dumping phases/_body
        JSON-blob columns), not a port of the old React dashboard's insight
        (phase timeline, dependency DAG, stack, exit-gates, task list,
        discover). Brought up live it was unusable.
      trigger: Live browser bring-up 2026-06-03 surfaced the broken table; user
        required insight-parity with the old dashboard. Plan (doc 15) + aiDeck
        component spec
        (../aideck/docs/component-spec-atomic-skills-dashboard.md) authored +
        APPROVED.
      assumesStillValid:
        - aiDeck adds generic capabilities (composition/slots §2b, array-explode
          §2a) + new widgets §4
        - rollups precomputed by the skill into frontmatter (aiDeck stays
          read-in-place)
        - target = insight-parity (bespoke widgets only where table+composition
          loses fidelity)
      ratifiedAt: 2026-06-03T00:00:00Z
      ratifiedBy: human
      lastReviewedAt: 2026-06-03T00:00:00Z
  - title: aiDeck rebuilt generic → integration re-shaped from in-place patch to a
      Model-B consumer
    surfacedAt: 2026-06-02T00:00:00Z
    promoted: true
    context:
      solves: The original Inc7 plan assumed lightly patching aiDeck's existing reader
        in place (R-MIG-09..15 cited concrete aiDeck source lines); that
        approach was invalidated when aiDeck was rebuilt, so the integration
        needed a new shape.
      trigger: During the dogfood window aiDeck was rewritten as a generic, manifest-
        driven runtime, reversing doc 12's 'extend Model A' recommendation in
        favour of authoring a Model-B consumer (doc 13 supersedes doc 12).
      assumesStillValid:
        - aiDeck stays domain-agnostic (generic v2 runtime, not
          project-status-specific)
        - atomic-skills ships its own consumer (manifest + schema.json +
          handlers) rather than editing aiDeck internals
      ratifiedAt: 2026-06-03T00:00:00Z
      ratifiedBy: human
      lastReviewedAt: 2026-06-03T00:00:00Z
summary: Reconecta a skill ao aiDeck genérico reescrito via consumer Model-B
  (read-in-place); só falta o publish no npm (gated).
planTitle: Redesign project skill into a lifecycle orchestrator (dogfood)
planActive: true
current: true
---


# Inc7 — aiDeck consumer-side (Model-B) + prose/schema long tail

Phase **F5** of the `project-orchestrator-redesign` plan, materialized 2026-06-03
so the real A/B/C/D progress is visible in the tracker (previously F5 lived only
as a single prose criterion in `plan.md`, per the plan's "docs are the source of
truth" design note).

## Where the canonical detail lives

- `docs/design/project-orchestrator/12-aideck-v2-integration-gap-analysis.md` — the
  architecture surprise (aiDeck rebuilt generic; Model A vs Model B).
- `docs/design/project-orchestrator/13-aideck-modelb-integration-plan.md` — the
  pivot (supersedes "extend Model A"); Phases A–D.
- `docs/design/project-orchestrator/14-aideck-modelb-handoff.md` — current
  DONE/PENDING; sessions 1–4; START HERE = Phase D.

## Status (2026-06-03)

Phases **A + B + C DONE** and live-validated (aideck 590/590, skills 705/705; 5
dataSources + 7 MCP tools exercised over real `aideck mcp` stdio, session 4).
**Only Phase D (T-004, npm publish) remains**, gated on explicit go-ahead. The
core integration needs **no aiDeck code changes** — it works against aideck HEAD
`ca12075`; D is publish + repoint only.

## Deferred aiDeck-side enhancements (REAL gaps, NON-blocking — not yet ratified as parked tasks)

These were verified against current aideck source; none block the validated
happy path. Park/promote them via the skill's ratify flow if/when wanted:

1. `aideck src/cli/validate.ts:pathMatchesDataSource` — single-`*` only; cannot
   match `.atomic-skills/projects/*/*/plan.md`. Gates only the optional
   `aideck validate` CLI loop (read path + MCP don't load schema.json). ~10-line
   reuse of `data-source-reader.ts` segmentMatcher/walkSegments.
2. `aideck src/server/writers/paths.ts:classifyFile` — no `projects/<id>/<slug>/`
   nested branch (ENTITY_DIRS lacks `projects`), so nested `phases/*.md` edits
   classify as `kind:'other'` and emit no SSE `state-change`. Degrades only live
   auto-refresh; initial render uses the watcher-independent read path. Larger
   change (classify + dispatch wiring).
3. Discover review flow — the `discover` dataSource resolves but there is no
   discover PAGE in the manifest and no v2-consumer decision-write route (only
   legacy v0.1 `/api/decision`). Blocks only the separately-deferred
   `project-discover.md` migration.

## Links

- Reviews: `.atomic-skills/reviews/2026-06-02-1515-rmig14-aideck-modelb-consumer.md`,
  `.atomic-skills/reviews/2026-06-02-1657-rmig14-fix-commits-revalidation.md`.
- Consumer assets: `assets/aideck-consumer/`.
- Plan: `../plan.md` (phase descriptor F5 / criterion F5-G1).

## Session handoff (dashboard port — START HERE next session)

The dashboard MVP is being replaced by a full component port (SPEC APPROVED 2026-06-03). Two
parallel lanes: aiDeck builds generic capabilities/widgets; I build the consumer manifest/pages.
- **Resume contract:** `docs/design/project-orchestrator/16-aideck-dashboard-port-handoff.md`
  (§START HERE + bring-up commands). Plan: doc `15`. aiDeck contract:
  `../aideck/docs/component-spec-atomic-skills-dashboard.md`.
- **Next unblocked action:** **T-005** — fix the broken plans table via `config.columns` in
  `assets/aideck-consumer/manifest.yaml` (no aiDeck dep). Then T-006 → T-007. T-008/T-009 stay
  blocked until aiDeck ships array-explode (§2a) / composition (§2b) + drill-down (§2c).
- **Note:** the Phase D publish (T-004) is a separate, still-gated workstream — not part of the
  dashboard port.
