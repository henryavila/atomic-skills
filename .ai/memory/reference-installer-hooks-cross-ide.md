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
- Cross-model review after closure caught that `PROJECT-STATUS.md` can remain
  stale even when the plan frontmatter is `done`; explicitly reconcile/refresh
  the project status index when finishing plan phases or closing a plan.
- Hook config examples must show the host's top-level `"hooks"` object, not only
  nested event keys. Soft setup is `SessionStart` + `PreToolUse`; Strict adds
  `Stop`. Keep tests asserting that Soft does not include `stop.sh`.
- Review evidence for this lesson lives at
  `.atomic-skills/reviews/2026-07-10-1217-installer-hooks-cross-ide-f3-local.md`.

## Follow-up: audit the installer as a delivery protocol

The 2026-07-10 adversarial audit showed that hook correctness is only one layer;
future installer work must also verify transactionality, rendered dependency
closure, namespace ownership, and multi-owner runtime selection.

- A happy-path install→uninstall round-trip does not prove atomicity. Inject a
  failure after every effect on both fresh install and update, then require
  retry→uninstall to restore the byte-for-byte baseline. A late failure can occur
  after the file set changed but before the new manifest is durable.
- Retry reconciliation must re-adopt a file when its current bytes already equal
  the new desired bytes. Treating every `current != previous` case as a user edit
  turns a partial update into permanent unmanaged residue.
- `.atomic-skills/` is both installer state and product lifecycle state. Never use
  the directory's mere existence as the `project` setup sentinel; require a
  canonical project-state artifact or separate the namespaces.
- Validate the closure of the *rendered installed file set*, not just the source
  tree. Every local path a skill instructs the host to read must resolve through
  `{{ASSETS_PATH}}` (or another installed runtime root) for every public IDE and
  scope. Comparing two implementations of the same incomplete file-set rule is
  not an independent oracle.
- A singleton `~/.atomic-skills/package-root` is last-writer-wins across owners.
  Runtime ownership needs version/fingerprint/package-root metadata, ghost-owner
  pruning, and deterministic restoration when an owner is removed.
- During diagnosis, separate: (1) source-vs-installed staleness fixed by a
  reinstall, (2) defects reproduced in a fresh temporary install, and (3) skill
  logic defects that remain after a correct install. Do not attribute all three
  to one layer.

Canonical evidence and remediation ordering:

- `docs/audits/installer-audit-2026-07-10.md`
- `docs/audits/project-implement-audit-2026-07-10.md`
