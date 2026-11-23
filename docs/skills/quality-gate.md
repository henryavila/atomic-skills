# `atomic-skills:quality-gate` — One Gate, a Debt Ratchet, and Strong Confirmed From Outside

> **Iron Law:** `A DIMENSION IS STRONG ONLY WHEN IT IS DECLARED, ENFORCED, FOLLOWED AND CONFIRMED FROM OUTSIDE.`

**One gate, debt that only goes down, strong confirmed from outside**

## Purpose

Give a repository a quality regime that agents cannot talk their way around: every rule declared, enforced by one gate, followed with zero debt, and confirmed by auditors with no context of the work.

## Usage

**When to use:**
- You want to know which quality rules are enforced and which are only configured
- A repository needs a gate that agents and CI both obey, on any stack
- Legacy debt must stop growing today and be paid over time
- The debt reached zero and you want it confirmed from outside

**When NOT to use:**
- Reviewing one change (use review-code)
- Fixing one bug (use fix)
- Paying the debt itself (use delegate or parallel-dispatch; this skill only measures and blocks)

## Reference

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `mode` | positional | optional | audit (read-only matrix), install (set the regime up) or reaudit (blind confirmation). If omitted: audit when the repository has no qa/stacks.tsv, otherwise the skill asks. |

**Examples:**
- `/atomic-skills:quality-gate audit` — Read-only: tool inventory and the stack by dimension matrix, with evidence
- `/atomic-skills:quality-gate install` — Agree on ceilings, write the gate script, copy the ratchet, freeze the debt, wire the layers
- `/atomic-skills:quality-gate reaudit` — Check that every cell is strong, then repeat the first audit with auditors that saw none of the work

## Metadata

**Dependencies:** `git`, `python3`

**Related:** `audit-delivery`, `review-code`, `delegate`, `parallel-dispatch`, `fix`

**Tags:** `quality`, `enforcement`, `ci`, `core`

**Version added:** `2.4.0`
