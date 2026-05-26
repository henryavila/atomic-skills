# `atomic-skills:review-code` — Adversarial (Local + Codex)

> **Iron Law:** `NO APPROVAL WITHOUT EVIDENCE.`

**Adversarial code review with local/codex/both mode picker**

Same-model reviews have blind spots. `review-code` captures your diff and runs adversarial passes — locally, cross-model via codex, or both — to catch bugs, security issues, and logic errors before merge.

## Purpose

Review a git ref (branch, commit, or range) adversarially. Mode picker: local (cheap, fast), codex (cross-model via OpenAI Codex CLI, ~$1-2), or both (default — local first, codex second on the byte-identical captured diff with sealed envelope). Range-aware ref validation + shape-specific diff command.

## Usage

**When to use:**
- You finished a coherent code change
- Significant change about to merge (both mode recommended)
- Critical path (auth, payments, data integrity) — both mode
- Cheap pre-merge sanity check (local mode)

**When NOT to use:**
- No git ref to review (and you don't want to commit/stash first)
- Trivial change already heavily reviewed
- Codex CLI not installed and you need codex mode (use --mode=local)

## Reference

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `git-ref` | positional | required | Branch, single commit, or commit range (a..b / a...b). |
| `--mode` | option | optional | Force a review mode (local, codex, both). Skips the Step 0 picker. |
| `--allow-dirty` | flag | optional | Include working-tree changes in the captured diff; suppresses the dirty-tree abort. |

**Examples:**
- `/atomic-skills:review-code main..HEAD` — Interactive picker — chooses mode
- `/atomic-skills:review-code feat/new-feature --mode=local` — Force local-only self-loop
- `/atomic-skills:review-code main..HEAD --mode=both` — Local then codex (sealed envelope)

## Metadata

**Output artifacts:** `.atomic-skills/reviews/YYYY-MM-DD-HHMM-<slug>.md (codex/both modes)`, `.atomic-skills/reviews/INDEX.md`

**Dependencies:** `codex`, `git`

**Related:** `review-plan`, `fix`, `hunt`

**Tags:** `review`, `code`, `adversarial`, `cross-model`

**Version added:** `2.0.0`
