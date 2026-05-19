---
schemaVersion: '0.1'
slug: v3-f0-foundation-repair
title: 'F0 — Foundation Repair'
goal: 'Resolve data fully before any UI work. Restore local infra, rewrite deterministic matcher, eliminate duplicates.'
status: active
branch: v2-rebuild
started: '2026-05-19T10:00:00Z'
lastUpdated: '2026-05-19T18:42:00Z'
nextAction: 'T-002: Pipeline dumps → PostgreSQL'

parentPlan: v3-redesign
phaseId: F0
audience: 'Developer'

scope:
  paths:
    - 'backend/app/Console/Commands/CollectionMigrateTenant.php'
    - 'backend/app/Console/Commands/MatchLouvorjaV2.php'
    - 'scripts/load-from-dumps.sh'
    - 'scripts/full-pipeline.sh'
    - 'backend/database/migrations/*'

exitGates:
  - id: F0-G1
    description: 'Git tag `core-v2` created'
    verifier: { kind: shell, command: 'git tag | grep core-v2', expectExitCode: 0 }
    status: pending
  - id: F0-G2
    description: 'Audit query returns 0 duplicates'
    verifier:
      kind: query
      sql: 'SELECT COUNT(*) FROM v_song_duplicates'
      expectRowCount: 0
    status: pending
  - id: F0-G3
    description: 'scripts/full-pipeline.sh runs end-to-end without intervention'
    verifier: { kind: shell, command: 'bash scripts/full-pipeline.sh', expectExitCode: 0 }
    status: pending

stack:
  - id: 1
    title: 'F0 kickoff'
    type: task
    openedAt: '2026-05-19T10:00:00Z'

tasks:
  - id: T-001
    title: 'Restore local infra'
    description: 'Composer install, .env, PostgreSQL vsda, npm install, MySQL legacy verified'
    status: done
    lastUpdated: '2026-05-19T11:30:00Z'
    closedAt: '2026-05-19T11:30:00Z'
    outputs:
      - { kind: file, path: '.env', description: 'Local env populated' }
      - { kind: command, command: 'php artisan migrate', description: 'Schema applied' }

  - id: T-002
    title: 'Pipeline dumps → PostgreSQL'
    description: |
      Reproducible script that loads dumps (data/dumps/) into PostgreSQL zeroed.
      Equivalent local and production.
    status: active
    lastUpdated: '2026-05-19T14:00:00Z'
    outputs:
      - { kind: file, path: 'scripts/load-from-dumps.sh' }
    verifier:
      kind: shell
      command: 'bash scripts/load-from-dumps.sh && psql vsda -c "SELECT 1"'
      expectExitCode: 0

  - id: T-003
    title: 'Album model unification'
    description: |
      Resolve 3 conflicting models (LouvorJA SQLite, legacy tenant, current sda-v2).
      Migration + `app:audit-album-model` command.
    status: pending
    lastUpdated: '2026-05-19T10:00:00Z'
    outputs:
      - { kind: migration, path: 'backend/database/migrations/2026_05_20_*_unify_album.php' }
      - { kind: command, command: 'php artisan app:audit-album-model' }

  - id: T-004
    title: 'Cleanup tenant songs'
    description: 'Delete ~1129 songs without chordpro or event_song. Preserve ~200 keepers.'
    status: pending
    lastUpdated: '2026-05-19T10:00:00Z'
    resourceCounts:
      to_delete: 1129
      keepers: 200
    outputs:
      - { kind: command, command: 'php artisan app:cleanup-tenant-songs' }
    verifier:
      kind: query
      sql: "SELECT COUNT(*) FROM songs WHERE tenant_id IS NOT NULL AND chordpro IS NULL AND id NOT IN (SELECT song_id FROM event_song)"
      expectRowCount: 0

  - id: T-005
    title: 'Rewrite matcher'
    description: |
      Deterministic. Album+artist signals, canonical during matching, N:1 detection,
      annotations stripped. Command `app:match-louvorja-v2`.
    status: blocked
    lastUpdated: '2026-05-19T10:00:00Z'
    blockedBy: [T-003, T-004]
    tags: [critical, gap-legacy]
    outputs:
      - { kind: command, command: 'php artisan app:match-louvorja-v2' }
    verifier:
      kind: test
      runner: pest
      pattern: 'tests/Feature/MatcherV2Test.php'

  - id: T-006
    title: 'Human validation via HTML report'
    description: 'Human decides each ambiguous match and canonical via HTML with audio preview. Saves `approved-v2.json`.'
    status: pending
    lastUpdated: '2026-05-19T10:00:00Z'
    blockedBy: [T-005]
    outputs:
      - { kind: file, path: 'storage/reports/matching-validation.html' }
      - { kind: json, path: 'data/decisions/approved-v2.json' }

  - id: T-007
    title: 'Re-run full pipeline + verify'
    description: '`scripts/full-pipeline.sh` end-to-end. 0 duplicates measured.'
    status: pending
    lastUpdated: '2026-05-19T10:00:00Z'
    blockedBy: [T-006]
    verifier:
      kind: shell
      command: 'bash scripts/full-pipeline.sh && psql vsda -c "SELECT COUNT(*) FROM v_song_duplicates"'
      expectExitCode: 0

  - id: T-008
    title: 'Tag core-v2 + archive old plans + API snapshot'
    description: 'Git tag, move 11 plans to archive, OpenAPI snapshot.'
    status: pending
    lastUpdated: '2026-05-19T10:00:00Z'
    blockedBy: [T-007]
    outputs:
      - { kind: command, command: 'git tag core-v2' }
      - { kind: command, command: 'php artisan l5-swagger:generate' }
      - { kind: file, path: 'docs/api/openapi-v2-snapshot.yaml' }

parked: []

emerged:
  - title: 'Investigate Patrimony Clone (mentioned in F1 docs but might affect F0 audit)'
    surfacedAt: '2026-05-19T13:15:00Z'
    promoted: false

references:
  - { kind: section, path: '../plans/v3-redesign.demo.md', section: 'F0 — Foundation Repair (Data)', label: 'Phase definition in master plan', inside_repo: true }
  - { kind: file, path: 'docs/RUNBOOK.md', section: '§2 data pipeline', label: 'Canonical pipeline reference', inside_repo: true }
  - { kind: file, path: 'data/README.md', label: 'Data directory README (dumps gitignored)', inside_repo: true }

crossTaskRefs:
  - fromTaskId: T-005
    toInitiativeSlug: v3-f1-filament-redesign
    toTaskId: T-002
    relation: unblocks
    note: 'Matcher fix is prerequisite for clean Song Resource data in F1'
  - fromTaskId: T-008
    toInitiativeSlug: v3-f1-filament-redesign
    toTaskId: T-001
    relation: unblocks
    note: 'core-v2 tag is the official handoff to F1'
---

# F0 — Foundation Repair

## Why this phase exists

The current state of production data is broken:
- Duplicates in the public song listing
- Album versions appearing separately
- Two known matcher bugs:
  - `backend/app/Console/Commands/CollectionMigrateTenant.php:73` — index keeps only first occurrence per normalized key
  - `backend/app/Console/Commands/CollectionMigrateTenant.php:102-110` — loop breaks on first fuzzy match without detecting N:1 collisions

Any UI work would be papering over corrupt data. F0 is the foundation — nothing else starts.

## T-005 deep dive

The matcher rewrite is the critical path. Two specific issues to fix:

1. **Index single-occurrence bug**: when normalized title+artist matches multiple rows, only the first is indexed. Fix: index ALL rows under the normalized key.
2. **N:1 collision blindness**: loop continues after first match without checking other candidates. Fix: collect all candidates, then disambiguate using album+artist signals.

The new matcher is deterministic by design — no LLM at runtime (Principle P2). Where ambiguity remains after signal extraction, the human decides via HTML report (Principle P3) and the decision is serialized to `approved-v2.json` consumed by the script (Principle P5).

## Exit gate verification plan

When all 8 tasks are done, the implementing agent runs:

1. `bash scripts/full-pipeline.sh` — exit 0 (verifies F0-G3)
2. `psql vsda -c "SELECT COUNT(*) FROM v_song_duplicates"` — returns 0 (verifies F0-G2)
3. `git tag core-v2 && git tag | grep core-v2` — verifies F0-G1

Each gate's `verifier` field encodes this. aiDeck's `verify_exit_gate` MCP tool runs these on demand.

## Handoff to F1

Once F0 closes (all 3 gates met + tag pushed), F1 can start. The cross-task refs declare:
- `T-005 unblocks F1.T-002` (clean Song data for Filament Resource)
- `T-008 unblocks F1.T-001` (core-v2 tag is the handoff signal)

aiDeck renders these as `↗` arrows in the Initiative view.
