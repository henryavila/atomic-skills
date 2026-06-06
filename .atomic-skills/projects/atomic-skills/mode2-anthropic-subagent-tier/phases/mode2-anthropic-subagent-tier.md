---
schemaVersion: "0.1"
slug: mode2-anthropic-subagent-tier
title: Mode 2 — Anthropic subagent executor tier (Sonnet/Haiku)
goal: Add the deferred Anthropic-subagent execution tier (Sonnet/Haiku) to Mode
  2, on top of the v1 Codex-only lane — only once a justifying regime exists
  (metered/per-token billing, OR an explicit decision to add a per-task
  model-tier hint to parallel-dispatch).
status: pending
branch: null
started: 2026-06-01T15:47:09Z
lastUpdated: 2026-06-01T15:47:09Z
nextAction: Hold — deferred. Do not build until the G-1 precondition holds (see
  Why deferred).
scope:
  paths:
    - skills/core/implement.md
    - skills/core/parallel-dispatch.md
    - skills/shared/codex-bridge-assets/
references:
  - kind: repo-path
    label: v1 Mode 2 lane this tier complements (Codex workspace-write executor)
    path: skills/shared/codex-bridge-assets/
  - kind: repo-path
    label: Throughput overlap to reconcile before building a parallel tier
    path: skills/core/parallel-dispatch.md
tasksDone: 0
tasksTotal: 3
gatesMet: 0
gatesTotal: 2
exitGates:
  - id: G-1
    description: "A justifying regime is recorded before any build starts: either
      metered/per-token billing applies, OR a decision is taken to add a
      per-task model-tier hint to parallel-dispatch. Absent a recorded regime,
      this initiative stays deferred."
    status: pending
    verifier:
      kind: manual
      description: Confirm with the user that one justifying regime holds, and record
        which one, before moving any task to active.
    verifierLabel: manual
  - id: G-2
    description: "When built: per-task routing dispatches mechanical 1-2 file tasks
      to a Haiku subagent and multi-file integration to a Sonnet subagent, Opus
      never executes, the cheap tier never self-certifies (done only via the
      verify-on-done mutation-kill judge or strong-model approval), and the
      subagent-executor lane is gated behind the Claude-Code-only conditional
      because the Gemini investigator tool is read-only."
    status: pending
    verifier:
      kind: manual
      description: Verify the tier map, the no-self-certify rule, and the
        Claude-Code-only gating once the lane exists.
    verifierLabel: manual
stack:
  - id: 1
    title: Mode 2 Anthropic subagent executor tier
    type: task
    openedAt: 2026-06-01T15:47:09Z
tasks:
  - id: T-001
    title: Confirm the justifying regime before building (else keep deferred)
    status: pending
    lastUpdated: 2026-06-01T15:47:09Z
    description: Gate G-1. Build only if metered/per-token billing applies OR the
      user explicitly wants a per-task model-tier hint on parallel-dispatch.
      Under a flat-rate Claude subscription with no such want, this work stays
      deferred.
  - id: T-002
    title: "Decide: extend parallel-dispatch with a per-task tier hint vs a separate
      subagent lane in implement"
    status: pending
    lastUpdated: 2026-06-01T15:47:09Z
    description: "The execution-stage spec recommends extending parallel-dispatch
      (which already owns the throughput/independence machinery: Q1-Q4 gate,
      pairwise-grep disjointness, batch-id, audit) over building a second
      chooser + routing.json + tier-map that re-derives the same machinery. Pick
      one and record the rationale."
  - id: T-003
    title: "If building the lane: dispatch Sonnet/Haiku per the tier map, reuse the
      Mode 2 handoff + verify-on-done judge"
    status: pending
    lastUpdated: 2026-06-01T15:47:09Z
    description: Dispatch via the abstracted subagent (investigator) tool, model per
      tier (1-2 files -> Haiku, multi-file -> Sonnet, architecture/review ->
      Opus, which never executes). Reuse the Mode 2 handoff work-order contract
      and the verify-on-done mutation-kill as the near-free judge. The cheap
      tier returns a diff + self-check but never self-certifies. Gate the lane
      behind the Claude-Code-only conditional (the Gemini investigator tool is
      read-only, so on Gemini Mode 2 is Codex-only).
parked: []
emerged: []
parentPlan: mode2-anthropic-subagent-tier
phaseId: F0
summary: Tier de executor Anthropic (Sonnet/Haiku) no Mode 2 sobre a lane Codex
  — só quando houver regime que justifique (adiado).
planTitle: Mode 2 — Anthropic subagent executor tier (Sonnet/Haiku)
---

# Mode 2 — Anthropic subagent executor tier (Sonnet/Haiku)

## Context

Decided 2026-06-01 (design session). Mode 2 ("Opus plans, another model executes") was re-scoped to a **Codex-only v1**: Opus plans + reviews, and the OpenAI Codex CLI executes via a `workspace-write` extension of the existing read-only codex bridge. The Anthropic-subagent execution tier (route execution to Sonnet/Haiku subagents) was **deferred to this initiative** rather than dropped.

## Why deferred

Under a **flat-rate Claude Max subscription**, the only scarce resource that actually binds is the **shared weekly Claude ceiling**. Routing execution from Opus to a Sonnet/Haiku subagent spends that **same shared ceiling**, plus handoff + verification + escalation overhead on top — so it does **not** serve Mode 2's primary purpose (conserve the scarce Opus/Claude budget). The one lever it could serve is **throughput** (run independent tasks concurrently), and that is already owned by `parallel-dispatch` (its Q1-Q4 benefit gate, grep-proven scope disjointness, batch id, and audit). External evidence pointed the same way: the AkitaOnRails 2026 real-coding benchmark and Anthropic's orchestrator-worker (~15x token cost) both find a strong-planner + cheap-executor split loses to solo-strong on cohesive coding except in narrow regimes.

The genuinely novel, defensible Mode 2 capability is the **Codex cross-provider lane** (it moves work entirely off the Claude account — the only lever that survives flat-rate). The Anthropic-subagent tier is a convenience for right-sizing/throughput, not a resource-conservation win, so it waits for a regime that justifies it.

## When to revisit (the G-1 precondition)

Build this only when one of these holds, recorded against G-1:

- **Metered / per-token billing** applies (then routing to a cheaper Anthropic model is a real dollar saving, and Aider's architect/editor 30-50% cost reduction becomes relevant); or
- A deliberate decision is taken to add a **per-task model-tier hint to `parallel-dispatch`** for throughput on independent batches.

If neither holds, keep this deferred — building it earns nothing under flat-rate and adds maintenance + ceremony.

## Relationship to the rest of the system

- **Builds on:** the v1 Codex `workspace-write` lane and the Mode 2 handoff work-order contract (`skills/shared/codex-bridge-assets/`, `skills/core/implement.md`).
- **Reconcile with:** `skills/core/parallel-dispatch.md` — prefer extending it with a per-task tier hint over a second, overlapping orchestration path (T-002).
- **Hard dependency:** the verify-on-done mutation-kill judge (the un-stubbed `kind:test`/`kind:shell` verifier). Like the Codex lane, this tier is only safe to delegate to when a delegated task self-proves via a mutation-killing test, so Opus stays off the critical path.

## Format note

This file is the first inhabitant of the new per-entity layout (`.atomic-skills/projects/<project-id>/<slug>/`). It uses the validated initiative schema (`schemaVersion: '0.1'`) in the new folder location. Under the planned unified model (standalone initiative = degenerate 1-phase plan, schema `0.2`), it converts to that shape during the layout migration. Current tooling (`validate-state`, the aiDeck reader, the hooks) reads the legacy flat `initiatives/` + `plans/` dirs and does not yet walk `projects/*/` — so this is a deliberate forward-declaration; it becomes tooling-visible when the layout migration (Inc2) lands.
