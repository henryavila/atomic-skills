# `atomic-skills:verify-claim` — Completion-Evidence Gate

> **Iron Law:** `NO SUCCESS CLAIM WITHOUT FRESH VERIFICATION.`

**No success claim without fresh verification — run it, cite it**

A self-graded "it works" is worthless precisely when it matters most — the producer is the party least able to see its own blind spot. `verify-claim` is the completion-evidence gate `implement` calls before any task closes: it reads the VCS diff (not the report), re-executes the task's deterministic verifier, and derives a BINARY verdict from the real result — exit 0 AND, for tests, a non-zero collected count, so a green run of zero tests is the false-green it catches. A cheap or cross-provider executor self-checks but never self-certifies.

## Purpose

Verify a completion claim by executing its deterministic verifier and citing the observed evidence, producing a binary pass/fail that no producer can self-grant.

## Usage

**When to use:**
- About to mark a task done and need its verifier run for real first
- An agent, subagent, or Codex reported success and you must adjudicate it
- Gating any "the tests pass / the bug is fixed" claim on captured evidence

**When NOT to use:**
- The claim is a human-judgement / UI observation (use the manual-acceptance gate)
- There is no deterministic verifier (the task failed SPEC admission — surface it)
- You are diagnosing a bug, not verifying a fix (use fix)

## Reference

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `claim` | positional | optional | The claim or task id under verification. If omitted, the skill asks for the claim and its verifier. |

**Examples:**
- `/atomic-skills:verify-claim T-004` — Run the task's verifier, derive a binary verdict, cite the evidence
- `/atomic-skills:verify-claim "the parser handles empty input"` — Gate an "it works" claim on a fresh, captured run

## Metadata

**Dependencies:** `git`

**Related:** `implement`, `fix`, `project`

**Tags:** `quality`, `verification`, `gate`, `core`

**Version added:** `2.3.0`
