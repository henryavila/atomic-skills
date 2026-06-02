# `atomic-skills:implement` — Mode 1 Execution Driver

> **Iron Law:** `CODING STAYS SINGLE-THREADED.`

**Drive decomposed tasks to done, one at a time, verifier-gated**

The lifecycle ends in execution, and execution is where state gets lost — work marked done on a claim, context evicted mid-task, a resume that cold-re-investigates. `implement` is a serial loop with durable checkpoints: code one task, gate it through verify-on-done (never a self-asserted pass), snapshot a self-sufficient `## Session handoff` block on observable events (after each task / before each dispatch / phase boundary) — never on a fabricated context-% gauge. Coding stays single-threaded; only heavy reads fan out. The next session resumes from the handoff, and `resume` refuses on a dirty tree or a placeholder.

## Purpose

Read the materialized Tasks a plan produced and drive them to done one at a time, gating each completion on its deterministic verifier and keeping durable state recoverable across sessions.

## Usage

**When to use:**
- A plan has been decomposed and its tasks admitted by the SPEC gate
- You are implementing a phase task-by-task and want verifier-gated completion
- Resuming a prior implementation session from its handoff block

**When NOT to use:**
- There is no plan/design yet (use brainstorm, then project new plan)
- A one-off bug fix with a known root cause (use fix)
- You only need to verify a single claim, not drive a plan (use verify-claim)

## Reference

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `plan-slug` | positional | optional | The plan (or project-id/plan-slug) to implement. If omitted, uses the active plan/initiative. |

**Examples:**
- `/atomic-skills:implement migration-self-host` — Drive the active phase of a plan to done, task-by-task
- `/atomic-skills:implement` — Implement the active plan/initiative; resume from its handoff if present

## Metadata

**Dependencies:** `git`

**Related:** `project`, `verify-claim`, `fix`

**Tags:** `execution`, `lifecycle`, `implement`, `core`

**Version added:** `2.3.0`
