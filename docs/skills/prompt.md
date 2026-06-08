# `atomic-skills:prompt` — Generate Optimized Prompt

> **Iron Law:** `NO PROMPT WITHOUT CODEBASE ANALYSIS.`

**Generate a self-contained prompt with exact paths and guardrails**

Hand an agent a vague task and you get a vague result — it guesses paths, invents constraints, and drifts from what you meant. `prompt` reads your actual codebase first, then writes a precise, self-contained brief: exact file paths, explicit guardrails, and acceptance criteria the receiving agent can check itself against. Hand it to a parallel session or a fresh context and the work comes back on-target the first time.

## Purpose

Turn a one-line task into a self-contained, codebase-grounded prompt — real file paths, explicit guardrails, and acceptance criteria — ready to drive a parallel agent or a fresh session without back-and-forth.

## Usage

**When to use:**
- You have a vague task and want to make it actionable
- You need to brief a parallel agent precisely
- You will hand off the work to a different session

**When NOT to use:**
- You will execute the task in this same session
- You need a multi-phase plan (use project)
- You want to dispatch many tasks (use parallel-dispatch)

## Reference

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `task` | positional | optional | Task description in natural language. If omitted, skill asks interactively. |

**Examples:**
- `/atomic-skills:prompt "refactor auth middleware to use new session API"` — Generate a precise prompt with file paths and guards
- `/atomic-skills:prompt` — Skill asks for task interactively

## Metadata

**Related:** `parallel-dispatch`, `fix`, `project`

**Tags:** `meta`, `generation`, `planning`

**Version added:** `1.0.0`
