---
schemaVersion: "0.1"
slug: mode2-anthropic-subagent-tier
title: Mode 2 — Anthropic subagent executor tier (Sonnet/Haiku)
version: "1.0"
status: archived
started: 2026-06-01T15:47:09Z
lastUpdated: 2026-06-09T22:00:00Z
currentPhase: F0
parallelismAllowed: false
phases:
  - id: F0
    slug: mode2-anthropic-subagent-tier
    title: Mode 2 — Anthropic subagent executor tier (Sonnet/Haiku)
    goal: Add the deferred Anthropic-subagent execution tier (Sonnet/Haiku) to Mode
      2, on top of the v1 Codex-only lane — only once a justifying regime exists
      (metered/per-token billing, OR an explicit decision to add a per-task
      model-tier hint to parallel-dispatch).
    dependsOn: []
    subPhaseCount: 3
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: G-1
          description: "A justifying regime is recorded before any build starts: either
            metered/per-token billing applies, OR a decision is taken to add a
            per-task model-tier hint to parallel-dispatch. Absent a recorded
            regime, this initiative stays deferred."
          status: pending
          verifier:
            kind: manual
            description: Confirm with the user that one justifying regime holds, and record
              which one, before moving any task to active.
        - id: G-2
          description: "When built: per-task routing dispatches mechanical 1-2 file tasks
            to a Haiku subagent and multi-file integration to a Sonnet subagent,
            Opus never executes, the cheap tier never self-certifies (done only
            via the verify-on-done mutation-kill judge or strong-model
            approval), and the subagent-executor lane is gated behind the
            Claude-Code-only conditional because the Gemini investigator tool is
            read-only."
          status: pending
          verifier:
            kind: manual
            description: Verify the tier map, the no-self-certify rule, and the
              Claude-Code-only gating once the lane exists.
    status: pending
    summary: Tier de executor Anthropic (Sonnet/Haiku) no Mode 2 sobre a lane Codex
      — só quando houver regime que justifique (adiado).
references: []
planTitle: Mode 2 — Anthropic subagent executor tier (Sonnet/Haiku)
---

# Mode 2 — Anthropic subagent executor tier (Sonnet/Haiku)

> Migrated standalone initiative — degenerate 1-phase plan (single phase `F0`).
> The phase initiative under `phases/` holds the real work; this plan is the layout wrapper.

**Goal:** Add the deferred Anthropic-subagent execution tier (Sonnet/Haiku) to Mode 2, on top of the v1 Codex-only lane — only once a justifying regime exists (metered/per-token billing, OR an explicit decision to add a per-task model-tier hint to parallel-dispatch).

> **Archived 2026-06-09 — migrated to the idea inbox.** This plan was a deferral
> tracker with no work started (0/3 tasks; gate G-1 itself said "stays deferred").
> Superseded by idea **#1** in `.atomic-skills/projects/atomic-skills/ideas.md`
> ("Mode 2 — tier de executor Anthropic (Sonnet/Haiku)"). Re-entry path:
> `/atomic-skills:project idea promote 1` when a justifying regime exists.
