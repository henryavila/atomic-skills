# Final local adversarial review — installer-hardening P0+P1

**Branch:** `plan/installer-hardening-p0-p1`  
**Repo:** `/Volumes/External/code/atomic-skills`  
**Scope:** Read-only review of recovery, auto-update drop-revert, Grok refcount, stageRuntimeArtifacts, adopt, manifest, install/uninstall orchestration, CLI flags.  
**Engine pin:** `@henryavila/minimalist-installer#67dddc35151a4ef02cd7eed6500bf59cd8cb918f` (post-U per-effect journaling present; **no** engine drop-effect revert in package).  
**Date:** 2026-07-17  

---

## Findings (max 15)

### F1 — Critical — IDE shrink Grok release throws on untrusted registry (fail-closed bypassed)

**WHERE:** `src/install.js:1052`, `src/install.js:1060–1070`; `src/runtime-layers/grok-refcount.js:149–155`, `251–277`

**WHAT:**  
`syncGrokPluginHostAfterInstall` defaults  
`listInstallBases = () => listKnownInstallBases(home)`.  
That helper **throws** `REGISTRY_UNTRUSTED` on corrupt/unknown `installs.json`.  
`releaseGrokOutsideJournal` only applies the untrusted **skip** path when `listInstallBases` is *omitted*; when a function is passed, it is used unconditionally and never runs `scanKnownInstallBases` fail-closed handling.

**WHY:**  
Uninstall/release path (`releaseGrokAndUnregisterRuntime`) correctly uses `scanKnownInstallBases` and skips host/isolation mutations on untrusted registry. Shrink-after-install does the opposite of the documented multi-owner contract.

**IMPACT:**  
After `installSkills` / Driver already committed a complete journal with `ides` **without** `grok`, a corrupt registry makes shrink cleanup throw. Manifest no longer lists grok → subsequent installs do not re-enter the shrink branch (`priorIdes` lack grok). Global Grok host/isolation can remain as **phantom state** with no automatic cleanup path short of residual package detection on full uninstall or manual host CLI. Operator sees a hard install failure after partial success (skills installed, host unclean).

**RECOMMENDATION:**  
Default shrink/list path to `scanKnownInstallBases` (or wrap `listKnownInstallBases` in try/catch and map untrusted → skip, same shape as `releaseGrokOutsideJournal` when no callback). Never throw after journal commit for registry parse failures on the outside-journal release path. Align with `releaseGrokAndUnregisterRuntime` (skip, do not mutate).

---

### F2 — Major — force-incomplete / repair reverse does not unregister registry or reclaim outside-journal state

**WHERE:** `src/recovery-cli.js:616–869` (`forceIncompleteUninstall`); `src/recovery-cli.js:455–596` (`repairIncompleteInstall`); `src/uninstall.js:81–136` (force path returns before Grok/runtime release)

**WHAT:**  
Recovery mutators reverse journaled effects and clear/retain incomplete + write residual ledger. They never call `unregisterInstall` / `unregisterAndMaybeReclaimRuntime` / `releaseGrokAndUnregisterRuntime`.

**WHY:**  
Design targets “unblock reinstall” not full uninstall. That is fine when the operator reinstalls via full `install()`. It is incomplete as a standalone “clean recovery.”

**IMPACT:**  
If a base was previously registered (successful install, then incomplete update) and the operator force-incompletes and **does not** reinstall:

1. `installs.json` keeps a **ghost owner** → shared `~/.atomic-skills` runtime may never reclaim (refcount never hits 0).  
2. Normal `uninstall` prints “No installation found” (no manifest) and **never** unregisters.  
3. Outside-journal Grok state is untouched by force-incomplete (usually OK on first-install mid-fail before `syncGrokPluginHostAfterInstall`; worse on mid-update after prior grok ownership).

Criterion 1 E2E (force → reinstall) still passes; walk-away residual is real.

**RECOMMENDATION:**  
After successful clear of incomplete (and when reverse emptied ownership): optionally unregister base from registry (or mark non-electable ghost for observe), and if `baseHasGrokResidual` document residual + offer/ call last-owner release. At minimum ledger `nextSteps` should mention registry ghost + `status` ghost owners.

---

### F3 — Major — dual lock roots: recovery vs Driver vs drop-revert (documented residual race)

**WHERE:** `src/recovery-cli.js:37–40`, `456`, `617`; `src/runtime-locks.js:133–136`; `src/runtime-layers/auto-update-drop-revert.js:30–33`, `280–322`

**WHAT:**  
- Recovery / registry: `withSharedRuntimeLocks` → `~/.atomic-skills/locks`  
- Driver install: engine `~/.minimalist-installer/locks` (unless shared lockRoot wired)  
- Auto-update drop-revert: `acquireInstallLocks` then **releases** before `Driver.install` re-acquires  

**WHY:**  
Documented explicitly in module headers; continuous hold needs engine integration.

**IMPACT:**  
Concurrent `install --repair` / `uninstall --force-incomplete` vs `install` can interleave journal mutation. Drop-revert has TOCTOU between pending-ledger clear and Driver journal rewrite. Not happy-path; real under automation/parallel agents.

**RECOMMENDATION:**  
Wire shared `lockRoot` into Driver install/uninstall when engine supports it; hold one lock across drop-revert + install. Track as known residual until engine pin owns drop-revert + shared locks.

---

### F4 — Major — `removeTreeNoFollow` still uses symlink-following fs APIs

**WHERE:** `src/runtime-layers/effects/stage-runtime-artifacts.js:134–136`, `203–228`, `158–172`

**WHAT:**  
Apply path correctly uses `existsNoFollow` / `readFileNoFollow` / `writeFileNoFollow` / `unlinkNoFollow` + `assertLexicalWithinBase`.  
Revert tree deletion uses `existsSync`, `statSync`, `readdirSync` on absolute `join(basePath, relPath)` (follow). `pruneEmptyParentsLexical` also uses following `readdirSync`/`rmdirSync`.

**WHY:**  
P1-D claims all mutations under basePath use no-follow helpers. Revert of directory/`sourceTree` ownership diverges.

**IMPACT:**  
If an owned path is replaced with a directory symlink after apply, revert may **walk the followed target**. Leaf `unlinkNoFollow` should still refuse intermediate symlinks (engine fail-closed), so full escape-to-delete-outside is likely blocked — but behavior is inconsistent, can throw mid-tree, leave partial reverse, and fails the “honor path-safety contract” spirit for criterion 6 on the revert side.

**RECOMMENDATION:**  
Walk with `lstat`/engine no-follow directory listing; refuse symlink dirs the same way as leaf writes. Align prune with no-follow or stop prune on non-dir/symlink.

---

### F5 — Major — Grok shrink release not serialized under shared runtime lock

**WHERE:** `src/install.js:1058–1071` (`releaseGrokOutsideJournal` direct); contrast `src/install.js:628–674` (`releaseGrokAndUnregisterRuntime` under `withSharedRuntimeLocks`); `src/uninstall.js:234–240`

**WHAT:**  
Uninstall (with residual) uses locked `releaseGrokAndUnregisterRuntime` (scan → release against post-removal bases → unregister).  
IDE shrink uses unlocked `releaseGrokOutsideJournal` with a live `listInstallBases` re-scan callback.

**WHY:**  
Install path comments for P0-C concurrency apply to unregister helper, not shrink.

**IMPACT:**  
Two concurrent shrinks/uninstalls can race host unregister vs keep/restage (documented residual for host CLI compounds this). Survivor restage vs last-owner unregister interleaving is the dual-keep/dual-kill failure mode P0-C tried to close for uninstall.

**RECOMMENDATION:**  
Route shrink cleanup through a locked helper that freezes the owner set once (same as uninstall), even when not mutating the registry.

---

### F6 — Major — Engine drop-effect revert still absent; consumer workaround is sole owner + residual TOCTOU

**WHERE:** `src/runtime-layers/auto-update-drop-revert.js:1–34`, `236–323`; `src/install.js:937–951`; pin `package.json` → `67dddc3…` (no drop-effect in engine tree)

**WHAT:**  
P0-B consumer fallback correctly reverts dropped auto-update effects with crash-resumable pending ledger, incomplete fail-closed, install lock. Engine still does not implement drop-effect revert (grep empty under package). Module hard-requires deletion on future pin-bump.

**WHY:**  
Plan U+C: criterion 2 can green via consumer; full ownership story incomplete until engine.

**IMPACT:**  
Criterion 2 met in product tests, but double-apply risk after future pin if workaround not deleted; lock gap F3 remains until engine owns drop-revert inside Driver transaction.

**RECOMMENDATION:**  
Keep delete-on-pin rule; do not ship engine drop-revert without removing this module in the same PR. Prefer engine continuous lock when pin lands.

---

### F7 — Minor — recovery / drop ledgers not uniformly path-safe writers

**WHERE:** `src/runtime-layers/auto-update-drop-revert.js:172–178` (`writeFileSync`+`renameSync`); `src/recovery-cli.js:251–275` (quarantine `copyFileSync`/`writeFileSync`); contrast `writeRecoveryLedger` → `atomicWriteJsonNoFollow` (`recovery-cli.js:224–228`)

**WHAT:**  
Recovery ledger uses engine atomic no-follow; drop-pending and quarantine do not.

**IMPACT:**  
Low under normal homes; symlink at `.atomic-skills/*` could divert writes. Inconsistent with P1-C “single atomic writer” spirit for adjacent state.

**RECOMMENDATION:**  
Route drop-pending + quarantine through engine no-follow atomic helpers where possible.

---

### F8 — Minor — `chmodSync` after `writeFileNoFollow` (TOCTOU)

**WHERE:** `src/runtime-layers/effects/stage-runtime-artifacts.js:98–102`, `109–112`

**WHAT:**  
Mode is applied via follow-capable `chmodSync(join(basePath, item.path))` after safe write.

**IMPACT:**  
Narrow race: leaf replaced with symlink between write and chmod could chmod the target. Best-effort catch swallows errors.

**RECOMMENDATION:**  
Prefer mode only via `writeFileNoFollow` options; drop re-chmod or use no-follow chmod if engine exports one.

---

### F9 — Minor — `findOtherGrokOwner` ignores durable residual without `ides: grok`

**WHERE:** `src/runtime-layers/grok-refcount.js:202–216` vs `baseHasGrokResidual` at `171–177`

**WHAT:**  
Survivor detection uses only `wantsGrokPluginHost(readManifestFor(other)?.ides)`. Residual package tree after partial shrink on another base does not count as owner.

**IMPACT:**  
Edge: install B mid-shrink residual, install A last-owner path may unregister global host while B still has package bits. Rare if shrink completes atomically per base.

**RECOMMENDATION:**  
Consider `baseHasGrokResidual(other, manifest)` for survivor scan (or document as accepted residual).

---

### F10 — Minor — pre-U force-incomplete clears incomplete even when reverse partially fails

**WHERE:** `src/recovery-cli.js:762–766`, `831–832`

**WHAT:**  
`clearIncomplete = trust === JOURNAL_TRUST_PRE_U || failed.length === 0`. Pre-U always clears marker after ledger write; exit non-zero if `failed.length > 0`.

**WHY:**  
Unblocks reinstall on pre-U (disk may diverge anyway). Documented residual.

**IMPACT:**  
Honest non-zero exit, but install unblocked with leftover owned-looking files → possible GREENFIELD_CONFLICT / adopt paths on reinstall. Acceptable for pre-U; ensure CLI messaging stays loud (it does).

**RECOMMENDATION:**  
No change required for ship; keep ledger + non-zero exit. Optional: list failed effect paths in CLI output more prominently.

---

### F11 — Minor — ambiguous dual-incomplete cannot target user without clearing project first

**WHERE:** `src/recovery-cli.js:400–417`; CLI only exposes `--project` boolean (`bin/cli.js:12`, `41`)

**WHAT:**  
Both user + project incomplete → error; `--project` targets project; no `--user` force flag.

**IMPACT:**  
Operator must fix project incomplete first to recover user (or run outside project tree). Documented; awkward in monorepo workflows.

**RECOMMENDATION:**  
Add `--user` / `--scope=user|project` for recovery commands if this bites operators.

---

### F12 — Positive residual notes (not defects)

- **SIGINT honesty (P1-E):** Fake `writtenFiles` SIGINT handler and `process.kill(SIGINT)` self-reentrancy removed; source guards in `tests/install-sigint-publish-guards.test.js`. Default Node abort is honest; incomplete → repair/force (`install.js:1439–1445`).  
- **publishRuntime parity (P1-F):** Both `--yes` and interactive call `publishRuntimeAndRegister` under one lock (`install.js:1339`, `1461–1462`); no bare `registerInstall` on success path.  
- **Adopt unmanaged (P1-A):** Safelist / known hash / `--force-adopt`; else exclude from desired (`adopt-preexisting-desired.js`, `skills-provider.js:24–27`).  
- **Versioned registry (P1-B):** `schemaVersion` + owners with packageRoot/version/fingerprint; fail-closed corrupt; last-writer restage (`install.js:188–580`).  
- **Manifest writer (P1-C):** Consumer `writeManifest` delegates to engine atomic no-follow (`manifest.js:37–38`).  
- **post-U repair strategy (b):** reverse-only, no auto-reinstall, never write `complete` on partial (`recovery-cli.js:28–32`, `520–567`).  
- **CLI surface:** `install --repair`, `uninstall --force-incomplete`, `install --force-adopt` wired with mutual exclusion errors (`bin/cli.js:21–23`, `51–61`, `77–90`, `115–123`).

---

## Success criteria scorecard

| # | Criterion | Met? | Evidence |
|---|-----------|------|----------|
| 1 | Incomplete recoverable via CLI | **Yes (with caveats)** | Engine pin `67dddc3` post-U journaling; `install --repair` reverse-only post-U / refuse pre-U; `uninstall --force-incomplete` reverse + residual ledger + honest exit; E2E `tests/install-fault-matrix-e2e.test.js`, `tests/recovery-cli.test.js`. Caveats: F2 ghost registry if walk-away; F3 dual lock race; pre-U residual unjournaled applies. |
| 2 | Auto-update shrink clean | **Yes (consumer workaround)** | `revertDroppedAutoUpdateEffects` before Driver; pending ledger crash-resume; incomplete fail-closed; tests `auto-update-drop-revert.test.js` / fault matrix. Caveat: F6 engine still missing drop-revert; F3 TOCTOU. |
| 3 | Grok multi-owner safe | **Mostly yes** | `releaseGrokOutsideJournal` + `releaseGrokAndUnregisterRuntime` last-owner/survivor restage non-destructive; uninstall residual gate `baseHasGrokResidual`; E2E multi-owner shrink. **Gaps:** F1 untrusted throw on shrink; F5 unlock on shrink; F9 residual-only survivors. |
| 4 | Adopt unmanaged | **Yes** | `adoptPreexistingDesiredFiles` + `excludeDesiredPaths` in provider; tests `adopt-unmanaged-desired.test.js`, `adopt-preexisting-desired.test.js`; CLI `--force-adopt`. |
| 5 | Versioned registry | **Yes** | `REGISTRY_SCHEMA_VERSION`, `materializeRegistryOwners`, live fingerprint, fail-closed read, restage on last writer leave; tests `registry-versioned-restage.test.js`, runtime observe. |
| 6 | Path-safety manifest + stage | **Mostly yes** | Manifest via engine no-follow; stage apply no-follow + tests `manifest-atomic-nofollow.test.js`, `stage-runtime-artifacts-path-safety.test.js`. **Gap:** F4 revert tree walk still following. |
| 7 | SIGINT honest | **Yes** | No SIGINT handler / no self-kill / no “No files kept”; comments + `install-sigint-publish-guards.test.js`. |
| 8 | publishRuntime parity | **Yes** | Both interactive and `--yes` use `publishRuntimeAndRegister(basePath)` under one lock; guard test forbids sequential bare stage+register. |

---

## Overall ship recommendation

### **ship-with-caveats**

**Rationale:**  
All eight success criteria are met or mostly met with automated coverage and a real post-U engine pin. P0 consumer recovery, auto-update shrink fallback, adopt policy, versioned registry, SIGINT honesty, and publish parity are in solid shape for operator use.

**Do not treat as clean ship** until F1 is fixed (or explicitly accepted): fail-closed multi-owner Grok release on shrink is violated when `installs.json` is corrupt, and the failure mode can strand host registration after a successful journal commit.

**Accepted residuals (document in release notes / plan session notes):**  
- Dual lock roots (F3) until engine shared lockRoot + drop-revert-in-Driver.  
- Consumer-only drop-revert until pin deletes `auto-update-drop-revert.js` (F6).  
- force-incomplete is reinstall-unblock, not full uninstall (F2).  
- stage revert tree no-follow gap (F4) — follow-up P1 hardening.  

**Suggested pre-merge bar:** fix F1 (small, high leverage); optionally lock shrink path (F5). F2–F4 can follow as fast-follow if release pressure is high.
