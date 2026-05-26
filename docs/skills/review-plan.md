# `atomic-skills:review-plan` — Adversarial (Local + Codex)

> **Iron Law:** `NO APPROVAL WITHOUT EVIDENCE.`

**Adversarial plan review with local/codex/both mode picker**

Plans fail when the author reviews their own work. `review-plan` runs adversarial passes — locally, via a cross-model codex envelope, or both — to catch gaps, missing edge cases, and optimistic assumptions before execution begins.

## Purpose

Adversarial review with mode picker: local (cheap, fast), codex (cross-model via OpenAI Codex CLI, ~$1-2), or both (default — local first, codex second on cleaned plan with sealed envelope). Optionally cross-references against source artifacts. Iterates up to 3 passes in local; two-pass envelope in codex.

## Usage

**When to use:**
- You finished writing a plan and want a structural review
- Significant plan about to enter execution (both mode recommended)
- Cross-model bug hunt against self-preference bias (codex or both)
- Plan was derived from a PRD/spec and you want coverage verification

**When NOT to use:**
- Plan is still brainstorming (not structured yet)
- Trivial plan (skip review entirely)
- Codex CLI not installed and you need codex mode (use --mode=local)

## Reference

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `plan-path` | positional | required | Path to the plan markdown file under review. |
| `--mode` | option | optional | Force a review mode (local, codex, both, or the v2.x alias internal). Skips the Step 0a picker. |
| `--no-cross-ref` | flag | optional | Skip the Step 0b cross-ref picker; force internal-only. |
| `--cross-ref` | option | optional | Comma-separated list of artifact paths to cross-reference against. Skips the picker. |
| `--artifacts` | option | optional | Alias of --cross-ref (compat with v2.x). |
| `--allow-dirty` | flag | optional | Pass through to the codex pre-flight; suppresses the dirty-tree abort. |

**Examples:**
- `/atomic-skills:review-plan docs/plans/migration.md` — Interactive picker — chooses mode + cross-ref
- `/atomic-skills:review-plan docs/plans/migration.md --mode=local` — Force local-only self-loop
- `/atomic-skills:review-plan docs/plans/migration.md --mode=both` — Local then codex (sealed envelope)

## Metadata

**Output artifacts:** `.atomic-skills/reviews/YYYY-MM-DD-HHMM-<slug>.md (codex/both modes)`, `.atomic-skills/reviews/INDEX.md`

**Dependencies:** `codex`, `git`

**Related:** `review-code`

**Tags:** `review`, `planning`, `adversarial`, `cross-model`

**Version added:** `2.0.0`
