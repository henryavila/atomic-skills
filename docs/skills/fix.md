# `atomic-skills:fix` — Root Cause + TDD

> **Iron Law:** `NO FIX WITHOUT ROOT CAUSE.`

**Diagnose root cause → write test → fix → verify**

AI agents love to jump to fixes. `fix` forces the detective path: reproduce first, understand the root cause, write a failing test, *then* fix. The test stays — so the bug never comes back.

## Purpose

Identify the root cause of a bug, write a reproducing test, and only then apply the fix. Detective mindset, not firefighter.

## Usage

**When to use:**
- You observed a bug or unexpected behavior
- A test is failing for unclear reasons
- A regression appeared after a recent change

**When NOT to use:**
- You want to add a new feature (use prompt)
- The issue is in design, not implementation
- You have no symptom to reproduce

## Reference

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `symptom` | positional | optional | Observed bug or unexpected behavior. If omitted, skill prompts interactively. |

**Examples:**
- `/atomic-skills:fix "duplicates in /musicas listing"` — Diagnose and fix with provided symptom
- `/atomic-skills:fix` — Skill prompts you for the symptom interactively

## Metadata

**Dependencies:** `git`

**Related:** `hunt`, `review-code`

**Tags:** `quality`, `debugging`, `tdd`, `core`

**Version added:** `1.0.0`
