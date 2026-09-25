# Default branch resolution — shared release asset

Canonical procedure for resolving the repository **default branch** (the
integration / protected branch). Consumed by `save-and-push` (PR-only HARD-GATE)
and by the `release` skill / `scripts/release/release.js` ship gate. Prefer this
asset over hardcoding `main` or `master`.

## Resolution order

Resolve once per invocation; reuse the same name for every gate in that run.

1. **`origin/HEAD` (preferred).**
   ```bash
   git symbolic-ref refs/remotes/origin/HEAD
   ```
   Typical output: `refs/remotes/origin/main`. Strip the prefix
   `refs/remotes/origin/` and keep the remainder, including further slashes.
   `refs/remotes/origin/main` → `main`. `refs/remotes/origin/release/stable` →
   `release/stable`. That name is the default branch even when it is neither
   `main` nor `master` (e.g. `develop`).

2. **Fallback when `origin/HEAD` is missing or unresolvable.** Try, in order,
   the first local or remote-tracking ref that exists (dedupe):
   - `main`
   - `master`

   Existence check: `git show-ref --verify --quiet refs/heads/<name>` or
   `refs/remotes/origin/<name>`.

3. **If nothing resolves:** surface the failure. Do **not** invent a branch
   name and do **not** treat the current branch as safe to push or ship.

## Policy note

PR-only / protected-branch gates apply to **this resolved default**, not only
to the literals `main`/`master`. If `origin/HEAD` points at `develop`, that is
the branch that must not receive a direct push from agent skills.
