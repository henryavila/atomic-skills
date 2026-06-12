# `atomic-skills:review-code` — Adversarial (Local + Codex)

> **Iron Law:** `NO APPROVAL WITHOUT EVIDENCE.`

**Adversarial code review with local/codex/both mode picker**

Reviewing your own diff in the same context that wrote it inherits every blind spot and rationalization. `review-code` captures the diff once and hands it to a sealed reviewer with clean context — locally, cross-model via codex, or both — stripped of commit messages and intent so framing can't suppress findings. Every finding cites file:line; no evidence, no approval.

## Purpose

Adversarially review code changes — a git ref (branch, commit, range), a scope keyword (wip = uncommitted work, branch = merge-base..HEAD, all = both), or no argument for an interactive scope picker — in clean context, with every finding tied to a file:line and no approval without evidence. Mode picker: local (fast, cheap), codex (cross-model via the OpenAI Codex CLI, ~$1-2), or both (default: local first, then codex on the byte-identical captured diff in a sealed envelope).

## Usage

**When to use:**
- You finished a coherent code change
- You just implemented something and it is still uncommitted (wip scope)
- Significant change about to merge (both mode recommended)
- Critical path (auth, payments, data integrity) — both mode
- Cheap pre-merge sanity check (local mode)

**When NOT to use:**
- Nothing to review (clean tree, no commits ahead of base)
- Trivial change already heavily reviewed
- Codex CLI not installed and you need codex mode (use --mode=local)

## Reference

**Arguments:**

| Name | Kind | Required | Description |
|------|------|----------|-------------|
| `git-ref` | positional | optional | Git ref (branch, commit, a..b / a...b) or scope keyword: wip (uncommitted), branch (merge-base..HEAD), all (both). Empty → interactive scope picker. |
| `--mode` | option | optional | Force a review mode (local, codex, both). Skips the Step 0 picker. |
| `--allow-dirty` | flag | optional | Include working-tree changes in the captured diff; suppresses the dirty-tree abort. |

**Examples:**
- `/atomic-skills:review-code` — No argument — picks scope (wip/branch/all) then mode
- `/atomic-skills:review-code wip --mode=local` — Review uncommitted work, local-only self-loop
- `/atomic-skills:review-code feat/new-feature --mode=local` — Force local-only self-loop
- `/atomic-skills:review-code main..HEAD --mode=both` — Local then codex (sealed envelope)

## Metadata

**Output artifacts:** `.atomic-skills/reviews/YYYY-MM-DD-HHMM-<slug>.md (codex/both modes)`, `.atomic-skills/reviews/INDEX.md`

**Dependencies:** `codex`, `git`

**Related:** `review-plan`, `fix`, `hunt`

**Tags:** `review`, `code`, `adversarial`, `cross-model`

**Version added:** `2.0.0`
