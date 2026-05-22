# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
