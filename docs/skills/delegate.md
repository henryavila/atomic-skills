# `atomic-skills:delegate` — External Executors, the Orchestrator Only Creates and Validates

> **Iron Law:** `THE ORCHESTRATOR CREATES AND VALIDATES; EXECUTORS ACT; NOTHING RUNS BEFORE THE USER CONFIRMS THE MODEL.`

**The orchestrator writes the card and judges; cheap executors do the work**

## Purpose

Run work on external executors with a user-confirmed model choice, a host-run gate, a cross-family review and an append-only audit log, keeping the orchestrator usage to creating cards and validating results.

## Usage

**When to use:**
- Work that an external executor can do: implementing a card, fixing review findings, mechanical sweeps
- You want the orchestrator usage limited to writing the card and validating the result
- You need comparable, auditable numbers per executor and model

**When NOT to use:**
- Deciding what to build or designing it (use brainstorm)
- A question, a read, or a one-command check with no product change
- No worktree isolation or no runnable gate is possible for the task

## Reference

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `tasks` | positional | optional | Task ids, a plan file, or a description of what to delegate. If omitted, the skill asks. |

**Examples:**
- `/atomic-skills:delegate T-12 T-13` — Show the batch table, wait for the yes, then run each card on Flash with a Codex review
- `/atomic-skills:delegate "fix the review findings on the billing branch"` — Write a fix card, run it on the executor that wrote the code, gate and record

## Metadata

**Dependencies:** `git`, `python3`

**Related:** `verify-claim`, `review-code`, `parallel-dispatch`, `prompt`

**Tags:** `orchestration`, `delegation`, `executors`, `core`

**Version added:** `2.0.0`
