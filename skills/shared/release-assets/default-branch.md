# Default branch resolution — shared release asset

Canonical procedure for resolving the repository **default branch** (the
integration / protected branch). Consumed by `save-and-push` (PR-only HARD-GATE)
and by the future `release` skill. Prefer this asset over hardcoding `main` or
`master`.

## Resolution order

Resolve once per invocation; reuse the same name for every gate in that run.

1. **`origin/HEAD` (preferred).**
   ```bash
   git symbolic-ref refs/remotes/origin/HEAD
   ```
   Typical output: `refs/remotes/origin/main`. Take the basename after the last
   `/` → e.g. `main`. That name is the default branch even when it is neither
   `main` nor `master` (e.g. `develop`).

2. **Fallback when `origin/HEAD` is missing or unresolvable.** Try, in order,
   the first local or remote-tracking ref that exists (dedupe):
   - `main`
   - `master`

   Existence check: `git show-ref --verify --quiet refs/heads/<name>` or
   `refs/remotes/origin/<name>`.

3. **If nothing resolves:** surface the failure. Do **not** invent a branch
   name and do **not** treat the current branch as “safe to push” by default.

## Policy note

PR-only / protected-branch gates apply to **this resolved default**, not only
to the literals `main`/`master`. If `origin/HEAD` points at `develop`, that is
the branch that must not receive a direct push from agent skills.
