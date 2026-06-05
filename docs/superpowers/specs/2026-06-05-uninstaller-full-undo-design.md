# Uninstaller: full undo + non-interactive mode — Design

**Date:** 2026-06-05
**Status:** Approved

## Problem

`src/uninstall.js` only undoes the manifest-tracked files. The installer
(`src/install.js`) makes three classes of change and the uninstaller reverses
just one of them:

1. **Manifest-tracked** (`.atomic-skills/manifest.json` → `files`): skill
   `.md` files, `_assets/`, namespace root, the `version-check.sh` hook
   script. → **Removed today.** ✓
2. **Global runtime artifacts** (`installRuntimeArtifacts()`, always under
   `~/.atomic-skills/`): `bin/aideck.mjs`, `dashboard/`, `aideck-consumer/`,
   `src/provision-consumer.js`. → **Not removed.** ✗
3. **Third-party file mutations**: the `.atomic-skills/` line in `.gitignore`
   (project scope) and a `SessionStart` hook entry merged into `settings.json`
   pointing at `version-check.sh`. → **Not removed** — the hook entry becomes a
   dead reference to a script the uninstaller already deleted. ✗

There is also no non-interactive (`--yes`) mode, so scripts can't run the
uninstaller unattended.

## Goals

- `uninstall --yes` skips the confirmation prompt (for scripting).
- Uninstall reverses everything the installer did, scoped safely.
- No regression to existing manifest-file removal or the confirmation prompt.

## Decisions (locked)

- **Global runtime artifacts** (`~/.atomic-skills/{bin,dashboard,aideck-consumer,src}`):
  removed **only on `user`-scope uninstall**. A `project`-scope uninstall leaves
  them, because other installs (user scope or other repos) depend on the same
  global runtime. They are recreated on any `install` run, so this is recoverable.
- **`settings.json` hook entry**: removed surgically — parse the correct
  `settings.json`, drop only the `{type:'command', command:<…/version-check.sh>}`
  entry from the `SessionStart` matcher, prune now-empty arrays/objects, rewrite.
  Never delete `settings.json` itself.
- **`.gitignore` line**: left untouched (current behaviour, treated as a safety
  measure against re-introducing residual `.atomic-skills/` into git).
- **`--yes` scope resolution**: with both `project` and `user` manifests present
  and no `--project` flag, `--yes` defaults to `user` (mirrors the install
  default). `--yes --project` forces project scope.
- **`~/.aideck/`** (user data: plans / initiatives lazily provisioned by the
  project skill) is **never** touched by uninstall.

## Architecture

Extend existing modules; keep undo logic adjacent to the matching install logic
so path definitions stay single-sourced.

| File | Change |
|---|---|
| `bin/cli.js` | `uninstall` reads `values.yes` and passes `{ yes }` to `uninstall()`. |
| `src/install.js` | Export two mirror helpers: `removeRuntimeArtifacts()` and `removeAutoUpdateHook({ basePath, scope })`. |
| `src/uninstall.js` | (1) skip `promptConfirmUninstall` when `yes`; (2) empty-dir cleanup walks up multiple levels bounded at `basePath` (today: one level); (3) call the two new helpers in order. |

### `removeRuntimeArtifacts()`

Mirror of `installRuntimeArtifacts()`. Called **only** when `scope === 'user'`.
Removes:

- `~/.atomic-skills/bin/aideck.mjs` (then prune `bin/` if empty)
- `~/.atomic-skills/dashboard/` (recursive)
- `~/.atomic-skills/aideck-consumer/` (recursive)
- `~/.atomic-skills/src/provision-consumer.js` (then prune `src/` if empty)

Each removal is guarded by `existsSync`. Never touches `~/.aideck/`.

### `removeAutoUpdateHook({ basePath, scope })`

Mirror of `installAutoUpdateHook()`. Resolves the settings path
(`user` → `~/.claude/settings.json`, `project` → `<basePath>/.claude/settings.json`)
and the hook command (`<stateDir>/hooks/version-check.sh`). Parses JSON, finds
the `SessionStart` matcher whose `hooks` contains the command, removes only that
entry, prunes empty `hooks` / matcher / `SessionStart` / `hooks` root, rewrites.
No-op if the file is missing, unparseable, or the entry is absent.

### Undo order in `uninstall.js`

1. Remove manifest-tracked files (existing loop, with multi-level dir prune).
2. Remove `.atomic-skills/manifest.json` and prune `.atomic-skills/` if empty.
3. `removeAutoUpdateHook({ basePath, scope })`.
4. If `scope === 'user'`: `removeRuntimeArtifacts()`.
5. Print summary. `.gitignore` untouched.

## Testing

`tests/uninstall.test.js` (Node test runner, tmp-dir fixtures):

- `--yes` skips confirmation and completes.
- `user`-scope uninstall removes runtime artifacts; `project`-scope does not.
- Hook entry removed from `settings.json` while a co-located unrelated
  `SessionStart` hook is preserved.
- `~/.aideck/` directory preserved.
- Two project installs sharing global runtime: uninstalling one project leaves
  the global runtime intact.
- Nested empty dirs pruned after file removal.

## Out of scope

- Removing the `.gitignore` line.
- A `--purge` flag for forcing global-runtime removal on project scope (could be
  a follow-up if requested).
