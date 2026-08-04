# `atomic-skills:audit-delivery` — Intent vs Delivered

> **Iron Law:** `NO DELIVERY CLAIM WITHOUT INTENT MATRIX + RESIDUAL HUNT + REAUDIT.`

**Intent-vs-delivered system audit with residual hunt and reaudit gate**

A green suite and a blessed diff still leave half-migrated systems: MCP/skills teaching the old lifecycle, client band-aids rewriting server status, recovery that never heals the new residual state. `audit-delivery` is the intent-vs-delivered gate `review-code` cannot be — it requires an Intent Package, fans out specialized auditors (including a monorepo residual hunt), and refuses CLOSED without residual proof. Default is read-only; compose with fix/parallel-dispatch and re-run reaudit rather than treating audit-and-fix as the primary path.

## Purpose

Prove product intent was delivered end-to-end across code and ops surfaces, with residual hunt and reaudit — not patch correctness alone. Default is read-only findings; primary fix path is composition + re-run.

## Usage

**When to use:**
- A handoff/plan claims a redesign shipped and you need proof
- You suspect half-migration (docs/MCP/client still on old model)
- After a large feature, before calling closed-beta / merge done
- review-code looked fine but product acceptance still feels wrong

**When NOT to use:**
- You only need blind diff correctness (use review-code)
- One claim + one deterministic verifier (use verify-claim)
- No decisions/problems written yet (write handoff first)
- Plan premises vs tree before implement (use review-plan ground-truth)

## Reference

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `intent-source` | positional | optional | Path to handoff/plan/design or freeform decision list. If omitted, skill asks once then aborts without Intent Package. |
| `--mode` | option | optional | audit (default, read-only), reaudit (re-run after fixes; requires --out), audit-and-fix (optional advanced in-skill fix loop). |
| `--axes` | option | optional | Comma list of audit legs (default product,residual). backend/frontend remain valid; exclude residual logs and caps verdict PARTIAL. |
| `--max-fix-rounds` | option | optional | Max fix→reaudit loops in audit-and-fix (default 2). |
| `--no-fix` | flag | optional | Force read-only even if mode would fix. |
| `--out` | option | optional | Report path under .atomic-skills/reviews/ (default auto slug). Required for --mode=reaudit. |

**Examples:**
- `/atomic-skills:audit-delivery docs/plans/HANDOFF-note-pipeline-state-machine.md` — Default read-only audit against a handoff Intent Package
- `/atomic-skills:audit-delivery --mode=reaudit --out=.atomic-skills/reviews/audit-delivery-x.md` — Re-run after fix/parallel-dispatch — re-check ledger (read-only product tree)
- `/atomic-skills:audit-delivery docs/plans/HANDOFF-x.md --mode=audit-and-fix` — Optional advanced: in-skill fix WPs + reaudit (prefer composition + re-run)

## Metadata

**Output artifacts:** `.atomic-skills/reviews/audit-delivery-*.md`

**Dependencies:** `git`

**Related:** `review-code`, `verify-claim`, `review-plan`, `parallel-dispatch`, `fix`

**Tags:** `review`, `quality`, `delivery`, `adversarial`, `core`

**Version added:** `2.4.0`
