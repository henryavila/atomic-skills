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

The two non-reversals (#7, #8) are deliberate, not omissions:

- **#7 `.gitignore`** — the `.atomic-skills/` line stays as a safety measure
  against re-introducing residual `.atomic-skills/` into git on a reinstall.
- **#8 `~/.aideck/`** — holds the user's own provisioned plans/initiatives
  (data, not an install artifact). Never touched.

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
- **Opt-outs stay in the allowlist** (`#7`, `#8`). No reversal; no `--purge`.
- **`CLAUDE.md` = focused expansion** (preserve current content; add the parity
  rule + testing conventions + an install↔uninstall map).
- **`AGENTS.md` already points at `CLAUDE.md`** and asks agents to follow it —
  add only one Cross-Agent Standards item; no rewrite.

## Architecture

### Component A — Round-trip test (`tests/install-uninstall-roundtrip.test.js`)

Strategy: snapshot the **set of paths** under a root before install and after
uninstall; any difference outside the allowlist is a gap.

A `snapshotPaths(root)` helper walks `root` recursively and returns a sorted
`Set` of paths relative to `root` (files and dirs).

**Allowlist** declared as a constant at the top of the file:

```js
const ALLOWED_RESIDUE = { user: [], project: ['.gitignore'] };
// ~/.aideck is never created by install (provisionConsumer is lazy, driven by
// the project skill at runtime) — out of scope for the install round-trip.
```

**Scenario 1 — user scope (strong invariant: total cleanup).**

1. `fakeHome` empty → `S0 = snapshotPaths(fakeHome)`.
2. `install(projectDir, { yes:true, ide:['claude-code'], lang:'en' })` (user scope).
3. `uninstall(projectDir, { scope:'user', yes:true })`.
4. `S1 = snapshotPaths(fakeHome)`.
5. Assert `S1` equals `S0` (allowlist for `user` is empty).

**Scenario 2 — project scope.**

1. `git init -q` a tmp repo → `S0 = snapshotPaths(repo)`.
2. `install(repo, { yes:true, project:true, ide:['claude-code'], lang:'en' })`.
3. `uninstall(repo, { scope:'project', yes:true })`.
4. `S1 = snapshotPaths(repo)`.
5. Assert `S1` equals `S0 ∪ {'.gitignore'}` (the `.atomic-skills/` line stays).

The global runtime under `fakeHome` is deliberately left by a project-scope
uninstall; that behaviour is already covered by `tests/uninstall.test.js` and is
not asserted here.

### Component B — Close the residue the round-trip exposes: orphan `settings.json`

When the installer **creates** `settings.json` from scratch (solely for the
hook) and the uninstaller removes only the hook entry, an empty `{}\n` file is
left behind — residue the round-trip will flag.

Fix: extend `removeAutoUpdateHook` so that, after pruning the hook entry, if the
resulting settings object is empty (`Object.keys(settings).length === 0`), the
file is deleted.

Updated invariant: *never delete a `settings.json` that still holds content;
delete it only if it became literally empty (an orphan created solely for our
hook).* A unit test covers this.

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
   allowlist (#7, #8).
2. **Testing & verification** — the commands (`npm test`,
   `npm run validate-skills`, `npm run test:hooks`) and TDD discipline.
3. **`install.js` ↔ `uninstall.js` map** — where each mutation class lives and
   the function that reverses it (the audit matrix, condensed).

### Component E — `AGENTS.md`

Add one item under "Cross-Agent Standards" referencing the parity HARD RULE.
No rewrite.

## Testing

- `tests/install-uninstall-roundtrip.test.js` — Scenarios 1 and 2 above.
- New unit case in `tests/uninstall.test.js` — `removeAutoUpdateHook` deletes a
  `settings.json` that became empty; preserves one that still holds other keys.
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
