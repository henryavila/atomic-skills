---
schemaVersion: '0.1'
slug: v3-f0-foundation-repair
title: 'Foundation repair'
goal: 'Fix the broken matcher logic before adding features. The join key was wrong; v2 patched around it for 600 lines. v3 fixes the root cause.'
status: active
branch: v2-rebuild
started: '2026-05-19T10:00:00Z'
lastUpdated: '2026-05-20T18:00:00Z'
nextAction: 'Run canary smoke test against the fixed matcher and verify zero diffs'
parentPlan: v3-redesign
phaseId: F0
exitGates:
  - id: G1
    description: 'matcher round-trip test green on the canary dataset'
    status: pending
    verifier:
      kind: shell
      command: 'npm test -- matcher.round-trip --canary=2026-05-20'
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
      outputSummary: 'canary 2026-05-20 committed at commit a3f1c2d, 12 reference matches pinned'
scope:
  paths:
    - src/matcher/
    - tests/canary/
    - tests/matcher/
stack:
  - id: 1
    title: 'Investigate dup-tenant collisions across landlords'
    type: research
    openedAt: '2026-05-19T10:00:00Z'
  - id: 2
    title: 'Fix the matcher join key (landlord_id + tenant_id)'
    type: task
    openedAt: '2026-05-20T09:00:00Z'
tasks:
  - id: T-001
    title: 'Pin canary dataset from production sample'
    status: done
    lastUpdated: '2026-05-19T18:00:00Z'
    closedAt: '2026-05-19T18:00:00Z'
    outputs:
      - kind: file
        path: 'tests/canary/2026-05-20.json'
      - kind: command
        command: 'git tag canary-2026-05-20'
  - id: T-002
    title: 'Fix dup-tenant collision in matcher join'
    description: 'The matcher returned duplicate rows because the join used (tenant_id) instead of (landlord_id, tenant_id). The duplicate landlord-tenant pairs across different landlords were collapsing into one row at the join, then split arbitrarily at the result projection. Fix: include landlord_id in the join key. Add a contract test that constructs a synthetic dataset with deliberate cross-landlord duplicates and asserts zero collapse.'
    status: active
    lastUpdated: '2026-05-20T17:00:00Z'
    tags: [critical]
    verifier:
      kind: shell
      command: 'npm test -- matcher.dup-tenant'
  - id: T-003
    title: 'Update integration tests to use the new join key'
    status: blocked
    lastUpdated: '2026-05-20T17:00:00Z'
    blockedBy: [T-002]
  - id: T-004
    title: 'Document the failure mode and fix in docs/adr-0004-matcher-key.md'
    status: pending
    lastUpdated: '2026-05-20T17:00:00Z'
parked:
  - title: 'Reconsider tenant_id format — should be UUID instead of int?'
    surfacedAt: '2026-05-19T15:00:00Z'
    fromFrame: 1
emerged:
  - title: 'Canary dataset should be versioned in a separate v0.2 initiative'
    surfacedAt: '2026-05-19T16:00:00Z'
    promoted: true
references: []
---

# Body

## Why

v2 silently dropped rows when the same tenant existed across two landlords. v3 keeps them as separate matches because they really are separate relationships.

## Decisions

- D1 (2026-05-19): join on `(landlord_id, tenant_id)` not `(tenant_id)`.
- D2 (2026-05-19): pin a canary dataset before changing matcher logic so we can detect drift cheaply.
- D3 (2026-05-20): the 600 lines of v2 special cases will be deleted in F1, not F0 — they are a side effect of the wrong join.
