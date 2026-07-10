# Reference - installer hooks cross-IDE

Date: 2026-07-10

Context: plan `installer-hooks-cross-ide` closed on branch `develop` after F3
(`Reparo local e validacao final`).

Operational notes:

- `.codex/hooks.json` is repaired locally for Codex hooks, but the path is ignored
  by the global git ignore (`/Users/henry/.gitignore_global` ignores `.codex/`).
  Normal `git status` will not show that local repair. Use
  `git status --short --ignored .codex/hooks.json` when checking it.
- The local repair preserves the existing Nexus `PostToolUse` hook and adds only
  approved Atomic Skills entries for `SessionStart`, `Stop`, and `PreToolUse`
  (`Edit|Write|MultiEdit`), all invoking the project hook scripts via `bash`.
- Phase-final verifiers must cover the full project state. Use
  `node scripts/validate-state.js` with no narrowed path subset before targeted
  suites such as `node --test ...` or `bash tests/hooks/session-start.test.sh`.
  A narrowed final verifier missed the still-active F3 initiative during review.
- Review evidence for this lesson lives at
  `.atomic-skills/reviews/2026-07-10-1217-installer-hooks-cross-ide-f3-local.md`.
