---
schemaVersion: '0.1'
slug: v3-redesign
title: 'SDA v2 — Plan v3 (Redesign)'
version: '1.0'
status: active
started: '2026-05-19T10:00:00Z'
lastUpdated: '2026-05-19T18:42:00Z'
branch: v2-rebuild
currentPhase: F0
parallelismAllowed: true

principles:
  - id: P1
    title: 'Truth source is 2 dumps'
    body: |
      `data/dumps/vsda_landlord.dump` and `vsda_tenant.dump` are the only authoritative
      source. Local PostgreSQL is a disposable result.
  - id: P2
    title: 'Total determinism — zero AI at runtime'
    body: |
      Every data operation is an idempotent script. No LLM call at runtime.
  - id: P3
    title: 'Human decisions → JSON'
    body: |
      Where the algorithm cannot decide, a human decides via HTML report and the
      decision is serialized as versioned JSON consumed by the script.
  - id: P4
    title: 'Local↔production equivalence'
    body: |
      Same scripts run against dumps locally and on the server. Same input, same output.
  - id: P5
    title: 'Exit gate per sub-phase'
    body: |
      Every sub-phase has a measurable closing criterion. Without verified gate, the
      next sub-phase does not start.
  - id: P6
    title: 'Sequential discipline'
    body: |
      One sub-phase complete before the next. Exception: F4//F5 may parallel if no
      interference. Sequential preferred.

glossary:
  - term: 'Tenant song'
    definition: 'Song registered by a specific church (`tenant_id NOT NULL`).'
  - term: 'Collection song'
    definition: 'Song from shared LouvorJA collection (`is_collection = true`).'
  - term: 'Keeper'
    definition: 'Tenant song with chordpro OR already used in event_song. Preserved during cleanup.'
  - term: 'Canonical song'
    definition: 'Official version of a composition that exists in multiple albums.'
  - term: 'Overlay'
    definition: 'Tenant personalization pattern via `tenant_song_preferences` without copying.'
  - term: 'Exit gate'
    definition: 'Verifiable criterion that closes a sub-phase.'
  - term: 'UI Gate'
    definition: 'Composite exit gate: 3 viewports + dark mode + smoke + i18n.'
  - term: 'Theme Graph'
    definition: 'Pre-computed `theme_connections` table with leads_to / contrasts_with / deepens edges.'

tracks:
  - { id: A, title: 'Data', domain: 'data' }
  - { id: B, title: 'UI Base', domain: 'ui' }
  - { id: C, title: 'Planning', domain: 'feature' }
  - { id: D, title: 'Oversight', domain: 'feature' }
  - { id: E, title: 'Curation', domain: 'feature' }
  - { id: F, title: 'Growth', domain: 'feature' }
  - { id: G, title: 'Content', domain: 'feature' }
  - { id: H, title: 'Launch', domain: 'ops' }

phases:
  - id: F0
    slug: v3-f0-foundation-repair
    title: 'Foundation Repair (Data)'
    goal: 'Resolve data fully before any UI work.'
    dependsOn: []
    track: A
    subPhaseCount: 8
    status: active
    audience: 'Developer'
    exitGateType: standard
    exitGate:
      summary: 'Tag git core-v2 + reproducible pipeline + 0 duplicates'
      criteria:
        - id: F0-G1
          description: 'Tag git `core-v2` created'
          verifier: { kind: shell, command: 'git tag | grep core-v2', expectExitCode: 0 }
          status: pending
        - id: F0-G2
          description: 'scripts/full-pipeline.sh exits 0 with no intervention'
          verifier: { kind: shell, command: 'bash scripts/full-pipeline.sh', expectExitCode: 0 }
          status: pending
        - id: F0-G3
          description: 'Audit query returns 0 duplicates'
          verifier:
            kind: query
            sql: 'SELECT COUNT(*) FROM v_song_duplicates'
            expectRowCount: 0
          status: pending

  - id: F1
    slug: v3-f1-filament-redesign
    title: 'Filament Backend Redesign'
    goal: 'Redesign 100% of Filament 5 admin importing /arch framework.'
    dependsOn: [F0]
    track: B
    subPhaseCount: 10
    status: pending
    audience: 'Admin user'
    exitGateType: ui-gate
    externalImports:
      - { kind: repo-path, path: '/Volumes/External/code/arch', label: 'Filament migration framework', inside_repo: false }
    exitGate:
      summary: 'All 35 Resources redesigned + 10 legacy features ported'
      criteria:
        - id: F1-G1
          description: 'Every Resource passes UI Gate (3 viewports + dark + smoke + i18n)'
          verifier: { kind: manual, description: 'Visual review per Resource' }
          status: pending

  - id: F2
    slug: v3-f2-nuxt-redesign
    title: 'Nuxt Frontend Redesign'
    goal: 'Redesign 100% of Nuxt 4 frontend, preserve 40 utilities.'
    dependsOn: [F0, F1]
    track: B
    subPhaseCount: 12
    status: pending
    audience: 'End user'
    exitGateType: ui-gate
    exitGate:
      summary: 'All 33 routes redesigned; Lighthouse > 90'
      criteria:
        - id: F2-G1
          description: 'Every page passes UI Gate'
          verifier: { kind: manual, description: 'Per-page visual review' }
          status: pending
        - id: F2-G2
          description: 'Lighthouse score > 90 on landing page'
          verifier: { kind: shell, command: 'npm run lighthouse', expectExitCode: 0 }
          status: pending

  - id: F3
    slug: v3-f3-planning-team-leader
    title: 'Planning Mode (team leader)'
    goal: 'Close Epic 6: planning features for team leader.'
    dependsOn: [F0, F1, F2]
    track: C
    subPhaseCount: 5
    status: pending
    audience: 'Team leader / member'
    exitGate:
      summary: 'Team leader plans event with usage intelligence'
      criteria: []

  - id: F4
    slug: v3-f4-ministry-oversight
    title: 'Ministry Oversight'
    goal: 'Epic 8: ministerial dashboard.'
    dependsOn: [F3]
    parallelWith: [F5]
    track: D
    subPhaseCount: 6
    status: pending
    audience: 'Ministry leader'
    exitGate:
      summary: '/ministerio full features; Repertoire Health page'
      criteria: []

  - id: F5
    slug: v3-f5-set-curation
    title: 'Set Curation + Theme Graph'
    goal: 'Epic 7: deterministic curation via Theme Graph.'
    dependsOn: [F3]
    parallelWith: [F4]
    track: E
    subPhaseCount: 5
    status: pending
    audience: 'Curator (team leader)'
    exitGate:
      summary: 'Leader starts curation from theme; structured feedback captured'
      criteria: []

  - id: F6
    slug: v3-f6-growth
    title: 'Growth Features'
    goal: 'Epic 9: polish + growth.'
    dependsOn: [F5]
    track: F
    subPhaseCount: 6
    status: pending
    exitGate:
      summary: 'Multi-event planning + localStorage + TF-IDF theme suggest'
      criteria: []

  - id: F7
    slug: v3-f7-content-newsletter
    title: 'Content + Newsletter Workflow'
    goal: 'Epic F: newsletter + PDF program.'
    dependsOn: [F6]
    track: G
    subPhaseCount: 4
    status: pending
    exitGate:
      summary: 'Newsletter composes and sends via Filament'
      criteria: []

  - id: F8
    slug: v3-f8-prelaunch-deploy
    title: 'Pre-launch + Deploy'
    goal: 'Provision production, deploy, run pipeline, verify.'
    dependsOn: [F7]
    track: H
    subPhaseCount: 5
    status: pending
    exitGate:
      summary: 'Tenant running in production; smoke approved; monitoring active'
      criteria: []

interPhaseGates:
  - from: F0
    to: F1
    criteria: ['core-v2 tag exists', 'No duplicates in v_song_duplicates']
  - from: F2
    to: F3
    criteria: ['All 33 routes pass UI Gate']
  - from: F3
    to: F4
    criteria: ['Planning Mode functional end-to-end']

supersedes:
  path: 'docs/superpowers/plans/2026-03-20-sda-v2-master-implementation.md'
  supersedeScope: partial
  partialAreas: ['UI', 'matcher']
  remainsValid: ['data pipeline', 'technical architecture']

references:
  - { kind: file, path: '_bmad-output/planning-artifacts/prd.md', label: 'Canonical PRD (9 epics)', inside_repo: true }
  - { kind: file, path: '_bmad-output/planning-artifacts/epics.md', label: 'EPD01-EPD09 with ACs', inside_repo: true }
  - { kind: file, path: '_bmad-output/planning-artifacts/architecture.md', label: 'Architecture reference', inside_repo: true }
  - { kind: file, path: 'docs/RUNBOOK.md', label: 'RUNBOOK (§2, §4-7 canonical)', inside_repo: true }
  - { kind: file, path: 'data/dumps/vsda_landlord.dump', label: 'Landlord dump', inside_repo: true, gitignored: true }
  - { kind: file, path: 'data/dumps/vsda_tenant.dump', label: 'Tenant dump', inside_repo: true, gitignored: true }
  - { kind: repo-path, path: '/Volumes/External/code/arch', label: 'Filament reference patterns', inside_repo: false }

whatStaysValid:
  - 'Schema do domínio collections (overlay tenant_id=NULL)'
  - 'trait HasTenantOverrides'
  - 'Pipeline de áudio S3 (3502 arquivos já enviados)'
  - 'Classificações de energia (1882 songs)'
  - 'Tema classifications (1988 songs)'
  - 'API V1 (32 controllers)'
  - '158 Pest tests of the core'
---

# SDA v2 — Master Roadmap v3 (Redesign)

> Canonical redesign roadmap. **State and execution live in `.atomic-skills/initiatives/v3-fX-*.md`.**
> This document is a read-only menu listing all phases, sub-phases, and features.

## 1. Context: why v3?

The project came out of discovery (BMAD 2026-03) and implemented ~70% of the product. Four problems converge and justify a new plan:

**Problem 1 — Catastrophic song matching.** The `collection:migrate-tenant` command had 2 serious bugs that caused duplicates in production.

**Problem 2 — Incoherent Album model.** Three album models coexist (LouvorJA SQLite, legacy tenant, current sda-v2).

**Problem 3 — Unsatisfactory UI.** Nuxt frontend and Filament admin were built without mature visual direction.

**Problem 4 — Documentation fragmentation.** 11 plans in `docs/superpowers/plans/`, some DONE, some superseded.

## 2. Inviolable principles

(See frontmatter principles for canonical list. This section elaborates each in human-readable form.)

### 2.1 Truth source is the 2 dumps

The files `data/dumps/vsda_landlord.dump` and `data/dumps/vsda_tenant.dump` are copies of production and the only authoritative source of legacy data. The local PostgreSQL `vsda` is a result, disposable.

### 2.2 Total determinism — zero AI at runtime

Every data, migration, matching, and classification operation runs through idempotent and deterministic scripts. No transformation depends on an LLM call at runtime.

(...continues for all 6 principles...)

## 3. Phase tree

(See frontmatter `phases:` for canonical list. The tree is rendered by aiDeck in the Plan view.)

This is a demo fixture. Real v3-redesign content lives in the source project. aiDeck's renderer must handle data of this scale and complexity.
