# `atomic-skills:parallel-dispatch-audit` — Audit

> **Iron Law:** `NO CONCLUSION WITHOUT EVIDENCE FROM DISK.`

**Audit output of a parallel-dispatch batch, apply fixes, report**

Parallel agents finish — but did they actually deliver? `parallel-dispatch-audit` verifies each output against the original plan, applies cosmetic fixes automatically, and escalates real issues with evidence — not opinions.

## Purpose

Verify each dispatched agent's deliverables on disk against the original plan. Cosmetic fixes only; ≥5 issues triggers read-only mode.

## Usage

**When to use:**
- A parallel-dispatch batch has completed
- You need objective verification of agent outputs

**When NOT to use:**
- Agents are still running (commits less than 2 min old)
- You want to refactor what agents wrote (out of scope)

## Reference

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `slug` | positional | optional | Batch slug to audit. Defaults to the most recent dispatch. |

**Examples:**
- `/atomic-skills:parallel-dispatch-audit onboard-ci` — Audit batch by slug

## Metadata

**Output artifacts:** `.atomic-skills/dispatches/<slug>.md (annotated with audit results)`

**Dependencies:** `git`

**Related:** `parallel-dispatch`

**Tags:** `parallelism`, `audit`, `review`, `quality`

**Version added:** `1.6.0`
