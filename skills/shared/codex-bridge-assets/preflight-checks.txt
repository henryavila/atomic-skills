# Pre-flight Checks for Codex Invocation

Run these checks BEFORE any codex invocation. ALL must pass or skill aborts
with a clear message.

## 1. Codex binary present

Run: `which codex`

If exit != 0: ABORT with message:
> "OpenAI Codex CLI not found in PATH. Install it with `npm install -g @openai/codex` or `brew install --cask codex`, then run `codex login`."

## 2. Codex version meets minimum

Run: `codex --version`

Parse output (format: `codex X.Y.Z` or similar). Compare to minimum:
- Minimum: `0.140.0`

If below minimum: ABORT with message:
> "Codex CLI version <X.Y.Z> below required <MIN>. Run `codex update`."

## 3. Working tree clean (or --allow-dirty)

Run: `git status --porcelain`

If output is non-empty AND user did NOT pass `--allow-dirty`: ABORT with message:
> "Working tree has uncommitted changes. Codex bug #8404 can cause hallucinated findings when reviewing against a dirty tree. Either commit/stash changes, or re-invoke with `--allow-dirty` to proceed anyway."

## 4. Inside git repo (or --skip-git-check)

Run: `git rev-parse --is-inside-work-tree`

If exit != 0 AND user did NOT pass `--skip-git-check`: ABORT with message:
> "Not inside a git repository. Codex `exec` requires `--skip-git-repo-check`. Re-invoke with `--skip-git-check` if intentional."

## All checks passed

Proceed to briefing curation.
