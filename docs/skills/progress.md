# `atomic-skills:progress` — One Derived Percentage per Project

> **Iron Law:** `NO PERCENTAGE WITHOUT A COMMITTED MAP AND GIT EVIDENCE.`

**Derive project percentages from a committed map, merges and delegate runs**

## Purpose

Derive deterministic milestone and project percentages from a committed map, git merge history and delegate runs, and publish panel data that never depends on a hand-typed count.

## Usage

**When to use:**
- You need the percentage or milestone breakdown of one project or the whole portfolio
- A project has a plan and belongs in the macro panel, so its map must be created or refreshed
- You want a deterministic feed for a dashboard instead of manually updated status prose

**When NOT to use:**
- You are deciding what to build or writing the plan (use brainstorm or prompt)
- A one-off question about a single commit or file
- The project has no integration ref where a committed map can live

## Reference

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `scope` | positional | optional | A repository path, a milestone id, or a card list to map or read. If omitted, the skill asks. |

**Examples:**
- `/atomic-skills:progress create the map for ./app-do-culto from its plan` — Derive milestones and cards, validate them, and register the project
- `/atomic-skills:progress read the status of every registered project` — Run the collector and quote its percentages, milestones and alerts

## Metadata

**Dependencies:** `git`, `python3`, `node`

**Related:** `delegate`, `audit-delivery`, `verify-claim`

**Tags:** `progress`, `portfolio`, `telemetry`, `core`

**Version added:** `2.4.0`
