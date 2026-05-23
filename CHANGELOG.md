# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] — 2026-05-22

### Breaking changes

- **Removed `review-plan-with-codex`** — merged into `review-plan`. The codex
  cross-model envelope is now opt-in via a Step 0 mode picker.
  Migration: replace `/atomic-skills:review-plan-with-codex <path>` with
  `/atomic-skills:review-plan <path>`; when prompted, choose "Codex only" or
  "Both". Non-interactive callers must pass `--mode=codex` or `--mode=both`.
- **Removed `review-code-with-codex`** — merged into `review-code`. Same
  pattern as above with `/atomic-skills:review-code <git-ref>`. Non-interactive
  callers must pass `--mode=codex` or `--mode=both`.

### Added

- **Step 0 mode picker in `review-plan` and `review-code`** — choose between
  `local` (cheap, fast same-model self-loop), `codex` (cross-model two-pass
  sealed envelope, ~$1-2), or `both` (default — local first then codex on the
  cleaned plan / same captured diff). Honors `--mode=local|codex|both` from
  the argument string for non-interactive use; aborts without TTY if no
  `--mode=` flag is supplied.
- **Sealed envelope preservation in "both" mode** — when the merged skill
  runs local + codex sequentially, the codex briefing receives only the
  cleaned artifact + external constraints, never the local findings or fix
  descriptions. Anti-framing rule baked into the skill body and Red Flags
  table (cites [arXiv 2603.18740](https://arxiv.org/abs/2603.18740)).
- **`review-code` captured-diff invariant** — both phases consume the same
  `CAPTURED_DIFF` materialized once via the shape-specific diff command;
  `git diff` is never re-run between phases. Guarantees byte-identical
  material across local and codex reviewers.
- **Argument contract documented** at the top of both skill bodies:
  `--mode=local|codex|both|internal`, `--no-cross-ref`, `--cross-ref=...`,
  `--allow-dirty`, plus the non-interactive abort policy.

### Changed

- `review-plan` Step 0 split into Step 0a (mode picker) + Step 0b (cross-ref
  picker). The two pickers are orthogonal — cross-ref selection applies to
  every mode.
- `review-code` Step 0 simplified to a single mode picker; ref validation and
  diff capture moved to a dedicated "Argument & diff capture contract"
  section that runs BEFORE the picker so abort paths (invalid ref, dirty
  tree without `--allow-dirty`) do not depend on TTY.
- `meta/skills.yaml`: 13 → 11 entries; `related:` arrays no longer reference
  the removed `-with-codex` skills.

### Rationale

Empirically verified across two consecutive sessions (2026-05-21 and
2026-05-22), local self-review and codex cross-review catch DISJOINT sets of
findings — neither subsumes the other (literature backs this: arXiv
[2603.12123](https://arxiv.org/abs/2603.12123), [2410.21819](https://arxiv.org/abs/2410.21819),
[2604.19049](https://arxiv.org/html/2604.19049v1)). The user explicitly stated
wanting both reviews for significant work. Forcing two slash commands
sequentially was friction; the mode picker encodes the common workflow with
a default and lets the user opt down for cost-sensitive cases. Local runs
first in `both` so cheap obvious issues filter out before the paid codex
pass, and so codex sees a CLEANED artifact without anchoring on local
findings (reverse order would let GPT-from-Claude self-preference bias
contaminate the cross-model invariant).

## [2.0.0] — 2026-05-22

### Breaking changes

- **Removed `review-plan-internal`** — merged into `review-plan` (new). The new
  skill auto-detects whether to run an internal review or a cross-reference
  review based on a Step 0 confirmation. Migration: replace
  `/atomic-skills:review-plan-internal <path>` with `/atomic-skills:review-plan <path>`;
  when prompted, choose "Internal only". Non-interactive callers (loops in
  `project-plan` Stage 8a and `project-status` phase-completion review) MUST
  pass `--mode=internal` to skip the prompt.
- **Removed `review-plan-vs-artifacts`** — merged into `review-plan` (new).
  Migration: replace `/atomic-skills:review-plan-vs-artifacts <path>` with
  `/atomic-skills:review-plan <path>`; when prompted, choose
  "Cross-reference with detected artifacts" (or supply a custom list).
  Non-interactive callers can pass
  `--mode=cross-ref --artifacts=path1,path2,...`.

### Added

- **`review-plan`** — merged same-model plan review (internal + optional
  cross-reference) with `{{ASK_USER_QUESTION_TOOL}}` at Step 0. Detects
  artifacts under common section headings (Source Documents, References,
  Artifacts, Inputs, Originated From, Based On), classifies LOCAL paths vs
  URLs, and runs the 7 internal + 6 cross-ref checks. Activates a HARD-GATE
  ("plan corrected, artifacts never edited") on cross-ref mode.
- **`review-code`** — same-model adversarial review of a git ref/diff.
  Free alternative to `review-code-with-codex` for cheap pre-merge sanity
  checks. Range-aware Step 0 (triple-dot detected first, then double-dot),
  deterministic branch-vs-commit classification, shape-specific diff command
  (avoids the `git diff <single-ref>` worktree-leak bug). 7-item checklist
  covers logic bugs, race conditions, error handling, schema/migrations,
  API contracts, file/function references, and test coverage.
- **G1+G2+G6 code-quality gates** added to `review-plan-with-codex`
  (previously had none) plus a self-review block printed before closing.
- **`{{ASK_USER_QUESTION_TOOL}}` template variable** in `src/render.js` —
  resolves to `AskUserQuestion tool` on Claude Code, and to a descriptive
  plain-text fallback on every other IDE (Gemini, Cursor, Codex CLI,
  Opencode, GitHub Copilot, generic). Documented in `CLAUDE.md`,
  `AGENTS.md`, and `docs/kb/gemini-cli-compatibility.md`.

### Fixed

- `review-code-with-codex` Step 2 (Collect input) used raw
  `git rev-parse --verify <ref>` which rejects revision-range syntax —
  `main..HEAD` failed even when both endpoints existed. Now detects ref
  shape (triple-dot first, then double-dot) and validates each endpoint
  separately for ranges.

### Notes

- All catalog metadata still uses `schema_version: '0.1'`. The v0.2
  expansion (one_liner, emoji, subcommands, etc.) ships in a follow-up
  release. See `docs/plan-skills-catalog-v0.2.md`.
- The skills count stays at 13 (delete 2, add 2, net 0).
