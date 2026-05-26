# `atomic-skills:parallel-dispatch` — Independent Tasks

> **Iron Law:** `NO LAUNCH WITHOUT MECHANICAL SCOPE ISOLATION.`

**Dispatch a task list to N parallel sessions with verified isolation**

Parallel agents that touch the same files produce merge conflicts and wasted runs. `parallel-dispatch` proves scope disjointness via pairwise grep *before* launching — verified isolation, not hopeful isolation.

## Purpose

Verify, isolate, and dispatch a user-provided task list to N parallel sessions. Mechanical scope isolation, batch id, and audit pass.

## Usage

**When to use:**
- You have a finalized list of independent tasks
- Tasks have concrete file-path scopes
- You will be away while agents run

**When NOT to use:**
- Work fits in the current session
- The list is still exploratory
- Tasks have hard sequential dependencies

## Reference

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `task-list` | positional | required | Path to the markdown file containing the finalized task list. |

**Examples:**
- `/atomic-skills:parallel-dispatch task-list.md` — Dispatch validated task list

## Metadata

**Output artifacts:** `.atomic-skills/dispatches/<batch-id>.md`

**Dependencies:** `git`

**Related:** `parallel-dispatch-audit`, `prompt`

**Tags:** `parallelism`, `dispatch`, `workflow`

**Version added:** `1.6.0`
