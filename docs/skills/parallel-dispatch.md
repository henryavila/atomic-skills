# `atomic-skills:parallel-dispatch` — Independent Tasks

> **Iron Law:** `NO LAUNCH WITHOUT MECHANICAL SCOPE ISOLATION.`

**Dispatch a task list to N parallel sessions with verified isolation**

Fire off parallel agents that happen to touch the same files and you get merge conflicts, clobbered work, and runs you throw away. `parallel-dispatch` refuses to launch until it has *proven* the task scopes are disjoint — pairwise grep across every pair, verified isolation rather than hopeful isolation — then dispatches the batch under one tracking id. You walk away; N agents work in true parallel and their results merge clean.

## Purpose

Validate that a finalized task list is genuinely parallelizable, prove scope disjointness mechanically, and dispatch it to N isolated sessions under one batch id — so independent work runs concurrently without collisions. This skill dispatches your list; it does not invent tasks.

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
