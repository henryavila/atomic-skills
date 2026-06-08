# `atomic-skills:fix` — Root Cause + TDD

> **Iron Law:** `NO FIX WITHOUT ROOT CAUSE.`

**Diagnose root cause → write test → fix → verify**

AI agents love to jump to fixes — patch the first plausible line, declare victory, ship the regression. `fix` forces the detective path instead: reproduce the failure, trace it to the exact root cause, write a test that fails for that reason, *then* fix. The reproducing test stays in the suite — so the bug it caught can never silently return.

## Purpose

Find the true root cause of a bug, prove it with a failing test, then make the minimal fix — a detective's process, not a firefighter's. The reproducing test outlives the fix and guards against regression.

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
