---
schemaVersion: '0.1'
slug: v3-redesign
title: 'SDA v3 — Redesign Plan'
version: '1.0'
status: active
started: '2026-05-19T10:00:00Z'
lastUpdated: '2026-05-20T18:00:00Z'
branch: v2-rebuild
currentPhase: F0
parallelismAllowed: true
tracks:
  - { id: A, title: 'Data', domain: 'data' }
  - { id: B, title: 'UI', domain: 'ui' }
principles:
  - id: P1
    title: 'Files are canonical'
    body: 'The two dumps are the only authoritative data. PostgreSQL is a result, disposable. aiDeck never owns state — it projects from .atomic-skills/.'
  - id: P2
    title: 'Zero AI at runtime'
    body: 'All AI work happens in tooling, never in production pipelines. The matcher must be a pure deterministic function over the dumps.'
  - id: P3
    title: 'Bidirectional human ↔ AI'
    body: 'Annotations and highlights are not afterthoughts — they are the channel through which humans flag things for AI and vice versa.'
glossary:
  - term: ingestion
    definition: pipeline reading the raw dumps into Postgres tables
  - term: matcher
    definition: deterministic resolver linking tenant ↔ landlord rows
  - term: canary
    definition: pinned reference dataset used to detect matcher regressions
  - term: drift
    definition: divergence between v2 and v3 outputs on the same input
phases:
  - id: F0
    slug: foundation-repair
    title: 'Foundation repair'
    goal: 'Fix the broken matcher logic before adding features'
    dependsOn: []
    track: A
    subPhaseCount: 0
    status: active
    exitGate:
      summary: 'matcher round-trip passes on canary dataset'
      criteria:
        - id: G1
          description: 'matcher round-trip test green on canary dataset'
          status: pending
          verifier:
            kind: shell
            command: 'npm test -- matcher.round-trip'
        - id: G2
          description: 'canary dataset committed and versioned'
          status: met
          metAt: '2026-05-20T12:00:00Z'
          verifier:
            kind: manual
            description: 'git log shows the canary commit'
          evidence:
            verifierKind: manual
            verifiedAt: '2026-05-20T12:00:00Z'
            passed: true
            outputSummary: 'canary 2026-05-20 committed at commit a3f1c2d'
  - id: F1
    slug: ingestion-rewrite
    title: 'Ingestion rewrite'
    goal: 'Replace ad-hoc CSV scripts with a structured idempotent pipeline'
    dependsOn: [F0]
    parallelWith: [F2]
    track: A
    subPhaseCount: 0
    status: pending
    exitGate:
      summary: 'ingestion is idempotent and re-runnable'
      criteria: []
  - id: F2
    slug: dashboard-pilot
    title: 'Dashboard pilot'
    goal: 'Ship a thin slice of the new UI for the matcher review workflow'
    dependsOn: [F0]
    parallelWith: [F1]
    track: B
    subPhaseCount: 0
    status: pending
    exitGate:
      summary: 'F2 demoable end-to-end in a browser'
      criteria: []
  - id: F3
    slug: rollout
    title: 'Rollout'
    goal: 'Replace v2 in production behind a feature flag, then default-on'
    dependsOn: [F1, F2]
    track: A
    subPhaseCount: 0
    status: pending
    exitGate:
      summary: 'all reads use v3, v2 disabled for one full week'
      criteria: []
references: []
---

# SDA v3 — Redesign

## Why now

The matcher hit a wall on duplicate-tenant-IDs across landlords. v2 patched it with a runtime override that grew into 600 lines of special cases. v3 fixes the root: the join was on `(tenant_id)` when it should have been on `(landlord_id, tenant_id)`.

## What stays valid from before

- The two dumps (`vsda_landlord.dump` and `vsda_tenant.dump`) are the only inputs. They do not change.
- The matcher's external contract (input shape, output schema) is preserved. Only the internal join logic moves.

## Track A — Data path

F0 fixes the join. F1 turns the migration scripts into a real pipeline. F3 cuts over.

## Track B — UI path

F2 ships the dashboard pilot so reviewers can audit matcher decisions without dropping into psql. Lives in parallel with F1 because they share no files.
