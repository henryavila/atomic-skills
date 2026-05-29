# `atomic-skills:parallel-dispatch-audit` — Audit

> **Iron Law:** `NO CONCLUSION WITHOUT EVIDENCE FROM DISK.`

**Verify each batch deliverable on disk; fix or escalate with evidence**

A green commit can sit on top of an empty file, and a still-running agent looks identical to a failed one. `parallel-dispatch-audit` opens each deliverable on disk and reads the content against the original plan — commit messages don't count as proof. It applies cosmetic fixes only when the batch is clean; the moment it finds five or more issues (or scope drift, a missing deliverable, a destructive op) it flips to read-only and escalates with evidence, because piecemeal fixes would hide that the plan itself was wrong.

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
