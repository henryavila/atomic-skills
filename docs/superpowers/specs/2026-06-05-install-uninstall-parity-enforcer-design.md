# Install/Uninstall Parity + Round-trip Enforcer — Design

**Date:** 2026-06-05
**Status:** Approved

## Problem

The installer (`src/install.js`) performs several classes of persistent
mutation. Until this session, `src/uninstall.js` reversed only the
manifest-tracked file loop, leaving runtime artifacts and the `settings.json`
hook entry behind. The 2026-06-05 uninstaller work closed those gaps, but two
deeper problems remain:

1. **No executable guarantee of parity.** Nothing prevents a future install
   action from shipping without a matching uninstall reversal. The current
   tests check individual reversals in isolation; none proves that a full
   install followed by a full uninstall returns the filesystem to its original
   state.
2. **No documented rule.** `CLAUDE.md` says nothing about the
   install↔uninstall invariant, nor how to verify it.

## Audit (current parity matrix)

| # | Install action | Reversal | Status |
|---|---|---|---|
| 1 | Skill/command `.md` (manifest) | manifest loop + `pruneEmptyParents` | ✅ |
| 2 | Namespace root `SKILL.md` (manifest) | manifest loop | ✅ |
| 3 | `_assets/` + subdirs (manifest) | manifest loop + prune | ✅ |
| 4 | Runtime `~/.atomic-skills/{bin,dashboard,aideck-consumer,src}` | `removeRuntimeArtifacts` (user scope) | ✅ |
| 5 | `version-check.sh` (manifest) | manifest loop | ✅ |
| 6 | `SessionStart` entry in `settings.json` (merge) | `removeAutoUpdateHook` (surgical) | ✅ |
| 7 | `.atomic-skills/` line in `.gitignore` (project) | **none** | ⚠️ deliberate |
| 8 | `~/.aideck/` consumer data | **none** | ⚠️ deliberate |
| 9 | `manifest.json` | unlink + prune | ✅ |

The two non-reversals (#7, #8) are deliberate, not omissions — but they are NOT
the same kind of thing:

- **#7 `.gitignore`** — the installer *does* mutate it (appends the
  `.atomic-skills/` line, project scope). The line stays as a safety measure
  against re-introducing residual `.atomic-skills/` into git on a reinstall.
  This is genuine install-parity residue, allowed **by content** (only the
  appended line may differ), not by path.
- **#8 `~/.aideck/`** — the installer **never creates this**. It is provisioned
  lazily at runtime by the project skill, not by `src/install.js`. It is
  therefore **outside install-parity scope entirely**, not an allowlist entry.
  Documenting it as parity "allowed residue" is misleading (codex F-004): the
  parity contract covers only what the installer writes.

## Goals

- An **executable, regression-proof** check that a full install→uninstall
  round-trip returns the filesystem to its pre-install state, modulo a
  declared allowlist.
- Close any residue the round-trip exposes.
- Document the parity invariant in `CLAUDE.md`; reference it from `AGENTS.md`.

## Decisions (locked)

- **Enforcer = round-trip test** (chosen over a declarative action registry or a
  static source-guard). It is behavioural and catches gaps we didn't think of,
  including emergent side-effects of two surgical operations.
- **The round-trip is bidirectional and content-aware** (codex F-001). It
  snapshots **path → type/content-hash**, and asserts no *added*, *removed*, or
  *modified* path outside the allowlist. A path-set-only diff (additions only)
  is rejected: it would let a round-trip silently delete a pre-existing file or
  rewrite its contents and still pass.
- **`.gitignore` (#7) is allowed by content, not path** (codex F-002). The
  project round-trip permits `.gitignore` to differ from baseline only by the
  appended `.atomic-skills/` line — an exact content assertion, not a wildcard
  on the path.
- **`~/.aideck/` (#8) is out of install-parity scope** (codex F-004), not an
  allowlist entry, because the installer never creates it.
- **No `--purge`.**
- **`CLAUDE.md` = focused expansion** (preserve current content; add the parity
  rule + testing conventions + an install↔uninstall map).
- **`AGENTS.md` already points at `CLAUDE.md`** and asks agents to follow it —
  add only one Cross-Agent Standards item; no rewrite.

## Architecture

### Component A — Round-trip test (`tests/install-uninstall-roundtrip.test.js`)

Strategy: snapshot a **content-aware tree** under a root before install and
after uninstall, then diff in three directions (added / removed / modified). Any
difference outside the allowlist is a gap.

`snapshotTree(root)` walks `root` recursively (skipping `.git`) and returns a
`Map` of root-relative path → `'dir'` for directories or a **sha256 of the file
contents** for files. `diffTree(before, after)` returns `{ added, removed,
modified }`: `added` = in `after` not `before`; `removed` = in `before` not
`after`; `modified` = in both but the hash changed.

This is the F-001 fix: a path-set diff sees only `added`. By hashing contents
and also computing `removed`/`modified`, the round-trip catches a uninstall that
deletes a pre-existing file or rewrites one — the failure modes that matter for
"returns to pre-install state".

**Scenario 1 — user scope (strong invariant: total cleanup).**

1. `fakeHome` empty → `before = snapshotTree(fakeHome)`.
2. `install(projectDir, { yes:true, ide:['claude-code'], lang:'en' })` (user scope).
3. `uninstall(projectDir, { scope:'user', yes:true })`.
4. `after = snapshotTree(fakeHome)`; `{added, removed, modified} = diffTree(before, after)`.
5. Assert all three are empty (user allowlist is empty).

**Scenario 1b — user scope preserves a pre-existing `settings.json`** (F-003).
Seed `~/.claude/settings.json` = `{}` (canonical formatting) BEFORE the
snapshot, then install + uninstall. Assert `removed` is empty (the user's file
was not deleted) and the file still parses to `{}`.

**Scenario 2 — project scope (`.gitignore` allowed by content).**

1. `git init -q` a tmp repo; seed a pre-existing `.gitignore` with known content
   (e.g. `node_modules/\ndist/\n`). `before = snapshotTree(repo)`.
2. `install(repo, { yes:true, project:true, ide:['claude-code'], lang:'en' })`.
3. `uninstall(repo, { scope:'project', yes:true })`.
4. `after = snapshotTree(repo)`; diff.
5. Assert `added` empty, `removed` empty, `modified == ['.gitignore']`, AND the
   `.gitignore` content equals the pre-install content **plus exactly** the
   appended `.atomic-skills/\n` line — nothing else changed (F-002).

The global runtime under `fakeHome` is deliberately left by a project-scope
uninstall (shared across installs); that behaviour is covered by
`tests/uninstall.test.js` and is not asserted by the project repo snapshot here.

### Component B — Orphan `settings.json`, tracked by provenance (F-003)

When the installer **creates** `settings.json` from scratch (solely for the
hook) and the uninstaller removes only the hook entry, an empty `{}\n` file is
left behind — residue the round-trip flags.

The naive fix ("delete if empty after pruning") is wrong (codex F-003): a user
may have had a pre-existing `settings.json` containing `{}`, and "empty" is not
proof the installer created it. Deleting it would destroy the user's file.

Correct fix — **track provenance in the manifest**:

- `installAutoUpdateHook` records `settingsPreexisted = existsSync(settingsPath)`
  **before** the merge, and surfaces `settingsCreated = !settingsPreexisted`
  into the manifest (new top-level field written by `writeManifest`).
- `uninstall` reads `manifest.settingsCreated` and passes it to
  `removeAutoUpdateHook({ basePath, scope, settingsCreated })`.
- `removeAutoUpdateHook` deletes the now-empty `settings.json` **only when
  `settingsCreated === true`**. When the file pre-existed, it rewrites the
  surviving settings (which may legitimately be `{}` — the user's original),
  never deleting it.

Invariant: *delete `settings.json` on uninstall only if the installer created
it and removing our hook emptied it; otherwise preserve the user's file.* Unit
tests cover both branches; Scenario 1b covers the pre-existing case end-to-end.

### Component C — Hook manifest path (user scope) — verify, fix only if needed

Suspicion surfaced during audit: in user scope, `installAutoUpdateHook` records
the hook script path in the manifest via `relative(projectDir, destScript)`,
while `uninstall` resolves manifest entries with `join(basePath = homedir,
relPath)`. If `projectDir !== homedir`, the relative path may not resolve back
to the installed file, leaving `version-check.sh` behind.

The user-scope round-trip (Scenario 1) **proves or refutes** this. If it fails
with `version-check.sh` left behind, fix the path computation at the source
(record a homedir-relative path for user scope). No pre-emptive fix without the
test's evidence (TDD).

### Component D — `CLAUDE.md` (focused expansion)

Add three sections, preserving existing content:

1. **Install/Uninstall parity (HARD RULE)** — the invariant ("every persistent
   install mutation has a matching uninstall reversal, or sits in the documented
   allowlist"), a pointer to the round-trip test as the enforcer, and the
   allowlist. The allowlist lists ONLY `.gitignore` (#7, allowed by content).
   `~/.aideck/` (#8) is documented in a **separate note** as out-of-parity
   (installer never creates it), NOT as an allowlist entry (F-004).
2. **Testing & verification** — the commands (`npm test`,
   `npm run validate-skills`, `npm run test:hooks`) and TDD discipline.
3. **`install.js` ↔ `uninstall.js` map** — where each mutation class lives and
   the function that reverses it (the audit matrix, condensed).

### Component E — `AGENTS.md`

Add one item under "Cross-Agent Standards" referencing the parity HARD RULE.
No rewrite.

## Testing

- `tests/install-uninstall-roundtrip.test.js` — Scenarios 1, 1b, and 2 above
  (content-aware diff).
- New unit cases in `tests/uninstall.test.js` — `removeAutoUpdateHook` deletes
  an emptied `settings.json` **only when `settingsCreated: true`**; preserves a
  pre-existing one (`settingsCreated: false`) even when it ends up `{}`;
  preserves one that still holds other keys.
- Existing suites stay green (`npm test`, `npm run test:hooks`,
  `npm run validate-skills`).

## Implementation order (TDD)

1. Write the round-trip test → expect failures at the gap points (B, possibly C).
2. Fix `uninstall` for what the test exposes (B; C if the test demands it).
3. `CLAUDE.md` (3 sections) + `AGENTS.md` (1 item).
4. Full suite green + `validate-skills`.
5. Commit (including the uninstaller work from this session, still uncommitted).

## Out of scope

- A `--purge` flag.
- Reversing `.gitignore` / `~/.aideck` (they stay in the allowlist).
- A full rewrite of `CLAUDE.md`.
- A declarative action registry or static source-guard enforcer.
