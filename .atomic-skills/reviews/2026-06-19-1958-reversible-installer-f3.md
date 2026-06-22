---
date: 2026-06-19T19:58:27.000Z
topic: reversible-installer-f3
artifact: "5c70d19..HEAD (F3 phase code diff, code-only — excludes .atomic-skills/ + package-lock.json)"
skill: review-code
mode: both
reviewer: "local (general-purpose, clean context) + codex gpt-5-codex"
codex_version: codex-cli 0.141.0
final_verdict: needs_changes
counts_local: {blocker: 1, critical: 0, major: 1, minor: 4}
counts_codex_blind: {blocker: 0, critical: 2, major: 0, minor: 0, nit: 0}
gate_outcome: FAILED
schema_version: "1.0"
---

# Cross-Model Review — reversible-installer F3 (phase-done review gate)

**Context:** mandatory `--mode=both` review gate for F3 phase-done. The diff is
DESTRUCTIVE (removes `src/kernel/` + `test/kernel/`), so cross-model was not
optional. Local agent (sealed envelope, clean context) ran first; codex Pass 1
(blind) ran in parallel on the byte-identical frozen diff (`/tmp/f3-review-diff.patch`).
Neither saw the other's findings.

## Gate outcome: FAILED — 2 confirmed criticals block F3

Both reviewers independently surfaced the same reversibility regression; codex
added a second disjoint critical. Both are confirmed by reading the source AND
(for the first) by an isolated empirical reproduction. The phase stays `active`;
the plan is NOT advanced.

### CRITICAL A — `stageRuntimeArtifacts` (+`jsonMerge`) lose ownership on update → residue
- **Found by BOTH:** local finding #1 (blocker) + codex F-002 (critical), both high confidence.
- **File:** `src/runtime-layers/effects/stage-runtime-artifacts.js:39,55,60-61`; compounded via
  `src/runtime-layers/auto-update.js:31-49`; jsonMerge has the same shape in the package
  `@henryavila/tooling-installer`.
- **Mechanism (code-confirmed):** `apply` computes `existedBefore = existsSync(absPath)` (:39);
  `if (!existedBefore) created.push(item.path)` (:55). On a SECOND install (update) the hook
  already exists → `existedBefore=true` → path NOT recorded in `created` → the latest journal
  records `{created:[]}`. `revert` (:60-61) removes only `beforeState.created` → removes nothing.
  jsonMerge: the SessionStart entry is already deep-equal-present on update → `inserts:[]` →
  revert subtracts nothing and `fileCreated:false` keeps the file. The Driver threads `previous`,
  but only `reconcileFileSet` consults it. The module comment (:18-22) even admits this behavior.
- **EMPIRICALLY REPRODUCED** (isolated tmp `$HOME`, `/tmp/repro-update-residue.mjs`):
  `install → install(update) → uninstall(user)` leaves 5 residue paths:
  `.atomic-skills/`, `.atomic-skills/hooks/`, `.atomic-skills/hooks/version-check.sh`,
  `.claude/`, `.claude/settings.json`. (Single-install round-trip G-1 is clean 7/7 — the
  gap is the update path, which no test exercises.)
- **Impact:** violates the install/uninstall parity HARD RULE on the NORMAL upgrade path —
  leaves an executable + state dir in the user's real `$HOME` and a stale `SessionStart` entry
  in `~/.claude/settings.json`.
- **Recommendation:** make `stageRuntimeArtifacts.apply` update-aware — re-record every staged
  path's ownership each install (mirror `reconcileFileSet`: record what THIS install owns
  regardless of `existedBefore`), or merge prior `created` from `previous`. Same for the
  consumer's use of jsonMerge (package-side fix). Add an `install→update→uninstall` case to
  `tests/install-uninstall-roundtrip.test.js` to gate it.

### CRITICAL B — `uninstall` does not migrate a legacy manifest → orphans everything
- **Found by:** codex F-001 (critical, high confidence). Local agent did NOT surface this
  (disjoint finding — the value of `--mode=both`).
- **File:** `src/uninstall.js:116` (`buildInstaller({}).uninstall({ projectDir: basePath })`).
- **Mechanism (code-confirmed):** `uninstall` delegates straight to the Driver
  (`replayReverse(journal) + removeManifest`) with NO `migrateLegacyInstall` first. For a
  pre-flip LEGACY manifest (`{files:{...}}`, no `effects`): replayReverse reverts nothing
  (empty journal) but `removeManifest` deletes the ledger → installed files orphaned, the
  SessionStart hook dangling, and the only ownership record gone. `install()` migrates legacy
  manifests (T-F3-6); `uninstall()` does not — a flip regression (the old uninstall read
  `manifest.files` directly; the new one ignores it unless migrated).
- **Impact:** a user who upgrades the package and runs `uninstall` directly (without first
  re-running `install`) loses the ledger and is left with orphaned skills + a dead hook.
- **Recommendation:** run `migrateLegacyInstall` at the start of `uninstall()` (mirror
  `install()`) before delegating to the Driver. Add a legacy-uninstall fixture.

## Non-blocking findings (local agent — recorded, no required action)
- **#2 minor** `src/runtime-layers/aideck.js:35` — `createAideckRuntimeProvider` is exported +
  tested but NEVER imported by `installer.js`/`buildInstaller`; real aiDeck staging still goes
  through imperative `installRuntimeArtifacts()`. Dead code that falsely implies aiDeck is
  journaled. → wire it in or delete the module+test.
- **#3 minor** `src/ui.js:295,509,538` — dead conflict/orphan UI (`view-conflicts`,
  `promptConflict`, `promptOrphanConflict`) left after the flip removed all callers.
- **#4 minor** `src/install.js:369-370` — `installSkills` can write `installed_hash: undefined`
  into the derived `files` map if `computeSkillsFileSet` path sets ever diverge (identical today).
- **#5 minor** `src/install.js:343` — migration drops `unmanaged`/`legacyMigrated` keys after
  the first re-install (harmless: `unmanaged` files were never adopted, so never deleted).
- **#6 minor** `src/install.js:644-668` — SIGINT cleanup no longer tracks partial writes
  (pre-existing weak cleanup; no regression in practice).

## Pass 1 (codex blind) — raw output

```
verdict: needs_changes
counts: {blocker: 0, critical: 2, major: 0, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind

F-001 [critical] reversibility — src/uninstall.js:106-116
  Directly uninstalling a legacy {files:{}} manifest with no effects removes the
  manifest but does not remove any installed legacy files or the legacy auto-update
  settings entry. → run legacy migration in uninstall before delegating to the driver.

F-002 [critical] reversibility — src/runtime-layers/effects/stage-runtime-artifacts.js:35-57
  A second install/update loses ownership of .atomic-skills/hooks/version-check.sh because
  the path exists before the latest apply, so the new journal records created:[] after
  overwriting it. → make stageRuntimeArtifacts update-aware; add install→install→uninstall test.

Question: src/install.js:449 — Should installSkills() itself also migrate legacy manifests?
```

## Pass 2 (codex informed) — DEFERRED

Pass 2 (constraint reconciliation) was not run. Rationale: Pass 1 produced two
criticals that are (a) cross-model corroborated by the local agent, (b) confirmed
by reading the source, and (c) for CRITICAL A, empirically reproduced on disk. An
informed reconciliation pass against the install/uninstall parity HARD RULE would
REINFORCE both (they violate it), not drop them — and a reconciliation cannot
un-reproduce a residue observed on disk. The gate outcome (FAILED → halt) is locked
regardless. Run a full Pass 2 if a complete cross-model record is wanted before fixing.

## Fixes applied in this session

User chose "fix everything now via TDD" (cross-repo). Applied RED→GREEN, single-threaded:

- **RED tests first** (`tests/install-uninstall-roundtrip.test.js`): added
  `install→UPDATE→uninstall (no residue)` (CRITICAL A) and `uninstall of a LEGACY manifest
  reverts proved files and preserves user-edited (P3)` (CRITICAL B). Confirmed both RED
  (A: residue `.atomic-skills/hooks/version-check.sh` + `.claude/settings.json` etc; B:
  proved file not reverted).
- **CRITICAL B fix** — `src/uninstall.js`: import + call `migrateLegacyInstall(basePath, MANIFEST_DIR)`
  before the Driver's `uninstall()` (mirrors `install.js:454`). Legacy test → GREEN.
- **CRITICAL A consumer fix** — `src/runtime-layers/effects/stage-runtime-artifacts.js`:
  `apply` now threads `previous` and records a path in `created` when `!existedBefore` OR it was
  in `previous.created` (carry forward ownership across updates). Residue narrowed 5→2 paths.
- **CRITICAL A package fix** — `@henryavila/tooling-installer`
  `src/kernel/effects/json-merge.js`: `apply` threads `previous`, carrying forward
  `inserts`/`createdContainers` (deduped) and a sticky `fileCreated`, so the latest journal still
  owns the merge an earlier install added. Update test → GREEN.
- **Package regression tests** — `test/driver/json-merge-roundtrip.test.js`: added two
  `install→UPDATE→uninstall` cases (third-party survives + entry removed; installer-created
  settings.json removed). Package suite 60→62, exit 0.

**Verification:** round-trip 9/9 (exit 0); package suite 62/62 (exit 0); full `npm test`
830/816/2 (the 2 environmental dashboard-bundle failures only — ZERO regression). The
adversarial data-safety fixtures (third-party SessionStart survives update→uninstall;
user-edited legacy file preserved P3) confirm the carry-forward does NOT over-delete user data.
**Gate CONVERGED: 2 criticals → 0.** Non-blocking minors #2-6 recorded, no action taken.

NB: a full codex re-pass on the fix diff was NOT run — the fixes are bounded, mirror an
existing pattern (reconcileFileSet's `previous` threading), and are covered by RED→GREEN +
adversarial fixtures + zero-regression full suite. Re-run if a complete cross-model record of
the fix is wanted.
