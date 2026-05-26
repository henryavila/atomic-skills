# `atomic-skills:prompt` — Generate Optimized Prompt

> **Iron Law:** `NO PROMPT WITHOUT CODEBASE ANALYSIS.`

**Generate a self-contained prompt with exact paths and guardrails**

Vague tasks produce vague results. `prompt` analyzes your codebase and generates a precise, self-contained prompt with exact file paths, guardrails, and acceptance criteria — ready to hand off to a parallel agent or a fresh session.

## Purpose

Turn a vague task description into an optimized, self-contained prompt with file paths, guardrails, and acceptance criteria. Use as input to another AI session.

## Usage

**When to use:**
- You have a vague task and want to make it actionable
- You need to brief a parallel agent precisely
- You will hand off the work to a different session

**When NOT to use:**
- You will execute the task in this same session
- You need a multi-phase plan (use project-plan)
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

**Related:** `parallel-dispatch`, `fix`, `project-plan`

**Tags:** `meta`, `generation`, `planning`

**Version added:** `1.0.0`
