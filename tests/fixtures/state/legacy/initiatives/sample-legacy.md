---
initiative_id: sample-legacy
status: active
started: 2026-04-01
last_updated: 2026-04-23T15:30:00Z
branch: feat/sample-legacy
worktree:
plan_link: docs/plans/sample.md
wip_limit: 2
scope_paths:
  - src/sample/**
  - tests/sample/**

stack:
  - {id: 1, title: "Sample legacy initiative", type: initiative, opened_at: 2026-04-01T10:00:00Z}
  - {id: 2, title: "Researching X", type: research, opened_at: 2026-04-15T11:00:00Z}

tasks:
  T-001:
    title: "Set up scaffolding"
    status: done
    last_updated: 2026-04-10T09:00:00Z
    closed_at: 2026-04-10T09:00:00Z
  T-002:
    title: "Implement core"
    status: active
    last_updated: 2026-04-20T14:00:00Z
  T-003:
    title: "Wire integration"
    status: blocked
    last_updated: 2026-04-20T14:00:00Z
    blocked_by: [T-002]

parked:
  - {title: "Refactor logger", surfaced_at: 2026-04-15T11:30:00Z, from_frame: 2}

emerged:
  - {title: "Investigate caching strategy", surfaced_at: 2026-04-16T09:00:00Z, promoted: false}

next_action: "Resume T-002: finish core impl"
---

# Sample legacy initiative

Narrative body preserved as-is.

## Decisions

- Decision A.
- Decision B.

## Links

- Plan doc: docs/plans/sample.md
