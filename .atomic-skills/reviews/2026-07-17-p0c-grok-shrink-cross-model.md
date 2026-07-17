---
kind: code-review
mode: both
provider: codex
model: gpt-5.5
scope: b0de844..6c74f96
phase: P0-C
date: 2026-07-17T18:54:00Z
verdict: needs_changes
counts_local: {blocker: 0, critical: 2, major: 4, minor: 3}
counts_codex: {blocker: 0, critical: 2, major: 2, minor: 0}
---

# P0-C cross-model review (Grok host + Codex external)

## Must-fix before phase green
1. Fail-closed corrupt registry (local F-1/F-4 + Codex F-004)
2. Gate uninstall release: only when departing had grok residual (Codex F-003 + local F-1)
3. Restage failure must not report as clean kept (local F-3 + Codex F-002)
4. Concurrent last-owner: lock with registry unregister when feasible (Codex F-001) — best-effort under existing runtime lock
5. HOME vs homedir + path normalize (local F-4/F-5)
6. Tests for uninstall wiring + corrupt registry + non-grok no host calls

## Local review
## Summary

P0-C correctly introduces a shared last-owner gate (`releaseGrokOutsideJournal`) so host unregister and isolation share multi-owner logic, and wires IDE shrink through `priorIdes` + `syncGrokPluginHostAfterInstall`. The core shrink happy paths are unit-tested.

However, the owner scan is **fail-open on incomplete/corrupt registry data**, while **uninstall always runs full last-owner cleanup** (even for installs that never selected grok). That combination can **unregister the global Grok host and strip isolation while other project installs still list `grok`**. Restage failures are reported as `kept`, path identity is raw string equality, and registry discovery uses `HOME` while writers use `homedir()` — all of which undermine the multi-owner contract the change claims to implement. Uninstall wiring and negative scan cases are untested.

## Findings

### F-1 [critical] Fail-open owner scan + unconditional uninstall release can kill survivors’ host/isolation

- File: `/Volumes/External/code/atomic-skills/src/runtime-layers/grok-refcount.js:28-39`
- File: `/Volumes/External/code/atomic-skills/src/uninstall.js:125-132`
- File: `/Volumes/External/code/atomic-skills/src/runtime-layers/grok-refcount.js:162-178`

- **WHAT:** `listKnownInstallBases` swallows corrupt/unreadable/`unknown-shape` registry JSON and returns only `[home]`. `uninstall` always calls `releaseGrokOutsideJournal` (no gate on “this install ever needed Grok cleanup” beyond the scan). When the scan finds no other grok owner, code always `unregisterGrokPluginHost` + `revertGrokAgentsIsolation` (ides omitted so neither can skip).
- **WHY:** Cross-install ownership is global (one host plugin name, one user `~/.grok/config.toml`). A false-negative survivor set is not fail-safe — it is destructive. Runtime registry reclaim in `install.js` is fail-closed on corrupt registry; Grok refcount is the opposite. Pre-change uninstall only touched host/isolation when `wantsGrokPluginHost(manifest.ides)`; post-change every uninstall can mutate global Grok state.
- **IMPACT:** Two project-scope grok installs, corrupt/missing `installs.json` (or registry only partially listing owners) → uninstall of either base (or a third non-grok base) unregisters `atomic-skills` from the Grok host and removes foreign-skills isolation while the other install still lists `grok`. Multi-owner “keep” contract fails open into data loss of external state.
- **RECOMMENDATION:** Fail closed when the registry is corrupt/unknown (abort release or keep host+isolation with a loud error), matching `readInstallsRegistry`. On uninstall, do not last-owner-clean unless this base previously owned Grok residual **or** the scan is complete/trusted. Prefer reusing the fail-closed registry reader rather than a silent try/catch.

### F-2 [critical] Incomplete install-base discovery: only `home` + registry; missing owners invisible

- File: `/Volumes/External/code/atomic-skills/src/runtime-layers/grok-refcount.js:23-40`
- File: `/Volumes/External/code/atomic-skills/src/runtime-layers/grok-refcount.js:77-90`

- **WHAT:** Survivors are discovered solely via `listKnownInstallBases` → home + `installs.json` entries. An install that materialized grok (journal + host) but never made it into the registry (crash after installSkills/sync, before `registerInstall` / `publishRuntimeAndRegister`) is invisible to `findOtherGrokOwner`.
- **WHY:** Host registration runs **before** registry publish on both install paths (`syncGrokPluginHostAfterInstall` then `publishRuntimeAndRegister` / `registerInstall`). A process kill or failure between those steps leaves a live grok owner outside the refcount set.
- **IMPACT:** Later uninstall/shrink of another base that appears to be last owner tears down host+isolation while the unregistered base still has `ides` including `grok` and a package tree. Same class of false last-owner as F-1 without needing registry corruption.
- **RECOMMENDATION:** Register ownership before or atomically with outside-journal Grok apply; or scan additional durable signals (e.g. known bases only after successful register, and treat “registry missing expected self” as incomplete). Do not last-owner-clean when registry membership for the departing base is inconsistent.

### F-3 [major] Failed survivor restage still returns host `status: 'kept'`

- File: `/Volumes/External/code/atomic-skills/src/runtime-layers/grok-refcount.js:137-159`
- File: `/Volumes/External/code/atomic-skills/src/runtime-layers/grok-plugin-host.js:144-147`

- **WHAT:** When a survivor exists and `restageSurvivor` is true, `registerGrokPluginHost({ basePath: survivor, ... })` may return `failed` (e.g. missing `plugin.json`) or incomplete `already`. `releaseGrokOutsideJournal` still returns `host.status = 'kept'` and only stashes the outcome in `restage`.
- **WHY:** Host snapshot under `~/.grok/installed-plugins/` is a copy of a specific package root. After uninstall/shrink of the departing base, that package tree is journal-removed. Without a successful restage, the global host entry can point at a deleted tree or stay stale.
- **IMPACT:** Multi-owner uninstall/shrink appears successful (`kept`) while Grok host breaks for survivors (missing skills / stale snapshot). Callers/logs in uninstall only special-case `unregistered|kept|failed|skipped` on top-level `host.status`, so restage failure is silent.
- **RECOMMENDATION:** If restage is required and `reg.status` is not `registered|updated|already` (or verify package present), surface `host.status = 'failed'` (or attempt uninstall+install and fail loud). Do not claim `kept` when restage did not leave a usable host registration.

### F-4 [major] Registry path: readers use `HOME`, writers use `homedir()`

- File: `/Volumes/External/code/atomic-skills/src/runtime-layers/grok-refcount.js:26-27`
- File: `/Volumes/External/code/atomic-skills/src/runtime-layers/grok-refcount.js:122-123`
- File: `/Volumes/External/code/atomic-skills/src/install.js:150-151`

- **WHAT:** `listKnownInstallBases(home)` reads `join(home, '.atomic-skills', 'installs.json')` with `home = process.env.HOME || homedir()`. `registerInstall` / `readInstallsRegistry` always use `join(homedir(), '.atomic-skills', 'installs.json')`. User install `basePath` is also `homedir()`.
- **WHY:** When `process.env.HOME !== os.homedir()` (tests, containers, `sudo`/`su`, custom env), the Grok owner scan reads a different file than the one install/uninstall mutates — often empty → scan degenerates to `[HOME]` only.
- **IMPACT:** Multi-owner keep fails; last-owner cleanup runs incorrectly (or self-exclusion fails if `basePath` is `homedir()` and the only listed base is `HOME`). Amplifies F-1 under non-identical HOME.
- **RECOMMENDATION:** Single source of truth for registry path (always `homedir()` or always the same resolved home). Pass that path into `listKnownInstallBases`; align user `basePath` with the same resolver.

### F-5 [major] Owner identity is raw string equality (no resolve/realpath)

- File: `/Volumes/External/code/atomic-skills/src/runtime-layers/grok-refcount.js:61`
- File: `/Volumes/External/code/atomic-skills/src/runtime-layers/grok-refcount.js:87`
- File: `/Volumes/External/code/atomic-skills/src/runtime-layers/grok-agents-isolation.js:266`

- **WHAT:** `listInstallBases().filter((p) => p !== basePath)` uses strict string inequality. No `path.resolve` / `realpathSync` normalization.
- **WHY:** Project install records realpath via `resolveProjectScopeTarget`, but any historical registry entry, trailing slash, symlink, or mixed absolute forms can diverge. Self may not be filtered out (false survivor: departing still “has grok” on uninstall before journal reverse) or true peers may not match expectations when combined with partial lists.
- **IMPACT:** False survivor → host+isolation **leaked** after last real owner leaves. Combined with incomplete lists (F-1/F-2), also contributes to false last-owner kills.
- **RECOMMENDATION:** Normalize all bases with `realpathSync`/`resolve` before compare; store only normalized paths in the registry.

### F-6 [major] Test suite misses uninstall wiring and negative multi-owner cases

- File: `/Volumes/External/code/atomic-skills/test/runtime-layers/grok-shrink-cleanup.test.js:1-333`
- File: `/Volumes/External/code/atomic-skills/src/uninstall.js:125-150`

- **WHAT:** New tests cover `hasOtherGrokOwner`, `releaseGrokOutsideJournal`, and `syncGrokPluginHostAfterInstall` with injected `listInstallBases`. There are **no** tests under `tests/` or `test/` that exercise `uninstall()`’s `departingHadGrok` / `restageSurvivor` wiring, corrupt registry fail-open, missing registry peer, failed restage, or HOME≠homedir.
- **WHY:** P0-C exit gate required multi-owner shrink **and** last-owner uninstall behavior. Unit tests inject perfect base lists and a perfect mock host runner — they cannot catch F-1–F-5.
- **IMPACT:** Regressions in production wiring and scan failure modes ship green.
- **RECOMMENDATION:** Add tests: (1) uninstall grok multi-owner with real `installs.json`; (2) uninstall non-grok must not unregister when another registry owner has grok; (3) corrupt registry must not unregister when peers exist (once fail-closed); (4) restage failure not reported as clean keep; (5) optional end-to-end install grok → reinstall without grok.

### F-7 [minor] Shrink release logs `absent` host as “unregistered (last owner)”

- File: `/Volumes/External/code/atomic-skills/src/install.js:650-653`

- **WHAT:** `logGrokRelease` treats `host.status === 'absent'` like `unregistered` and prints “unregistered (last owner)”.
- **WHY:** `absent` means plugin was not in the host registry (idempotent no-op), not a successful unregister of a live registration.
- **IMPACT:** Misleading operator logs; can hide “cleanup thought it was last owner but host was already gone / never registered” vs real unregister.
- **RECOMMENDATION:** Log `absent` separately (e.g. “host already absent”).

### F-8 [minor] Circular ESM dependency between isolation and refcount

- File: `/Volumes/External/code/atomic-skills/src/runtime-layers/grok-refcount.js:10`
- File: `/Volumes/External/code/atomic-skills/src/runtime-layers/grok-agents-isolation.js:7`

- **WHAT:** `grok-refcount` imports `revertGrokAgentsIsolation` from `grok-agents-isolation`; isolation imports `listKnownInstallBases` from `grok-refcount`.
- **WHY:** ESM live bindings make this work if no top-level call cycles, but the cycle is fragile under partial evaluation / future top-level use.
- **IMPACT:** Risk of `undefined` export if either module later runs cross-calls at load time; harder module graph reasoning.
- **RECOMMENDATION:** Move `listKnownInstallBases` (and path normalization) to a leaf module (e.g. `install-bases.js`) with no reverse imports.

### F-9 [minor] Uninstall logs `host.status === 'failed'` even when departing never had grok

- File: `/Volumes/External/code/atomic-skills/src/uninstall.js:139-140`

- **WHAT:** Failure log is not gated on `departingHadGrok`, unlike `kept`/`skipped`.
- **WHY:** Non-grok uninstall that spuriously takes last-owner path and fails host CLI will yellow-warn every time.
- **IMPACT:** Noise and false implication that this install owned the host; lower signal on real grok uninstall failures.
- **RECOMMENDATION:** Gate failed (and optionally unregistered residual) logs consistently, or only log host mutations when `departingHadGrok || lastOwner` with explicit residual label.

## Counts

| Severity | Count |
|----------|------:|
| blocker  | 0 |
| critical | 2 |
| major    | 4 |
| minor    | 3 |

**Total: 9 findings**


## Codex blind

---
verdict: needs_changes
counts: {blocker: 0, critical: 2, major: 2, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The patch improves the shape of Grok refcounting, but the last-owner decision is still not atomic with owner removal and can leave stale host/isolation state under concurrent uninstall. It also introduces unsafe cleanup paths: non-Grok uninstalls can mutate Grok host state, and corrupt registry reads collapse to “home only,” which can unregister while other owners still exist.

## Findings
### F-001 [critical] concurrent Grok-owner uninstalls can both keep, leaving stale external state — src/uninstall.js:127
**Evidence:**
```js
const { host, isolation: iso } = releaseGrokOutsideJournal({
  basePath,
  restageSurvivor: departingHadGrok,
});
...
unregisterAndMaybeReclaimRuntime(basePath);
```
**Claim:** The Grok last-owner decision runs before this install is removed from the shared registry, and it is not covered by the shared runtime lock used later by `unregisterAndMaybeReclaimRuntime`.
**Impact:** If two Grok owners uninstall concurrently, each can observe the other as a survivor, both keep host/isolation, then both remove their packages and registry entries. Final state has no owners but still has Grok host registration and foreign-skill isolation.
**Recommendation:** Put Grok release and registry owner removal under the same lock/transaction, and make the last-owner decision against the post-removal owner set. Add a concurrent two-owner uninstall regression test.
**Confidence:** high

### F-002 [critical] survivor restage can transiently or permanently unregister the remaining owner — src/runtime-layers/grok-refcount.js:148
**Evidence:**
```js
const reg = registerGrokPluginHost(regOpts);
```
and `registerGrokPluginHost` does:
```js
const uninstall = run(bin, ['plugin', 'uninstall', GROK_PLUGIN_NAME, '--confirm'], { env });
const reinstall = run(bin, ['plugin', 'install', '--trust', pluginRoot], { env });
```
**Claim:** The “survivor remains” path calls registration code that may uninstall the global Grok plugin before reinstalling it from the survivor package.
**Impact:** If reinstall fails after the uninstall, the surviving Grok install loses host registration even though `releaseGrokOutsideJournal` reports `host.status: 'kept'`. Concurrent Grok use can also observe the plugin missing during the restage window.
**Recommendation:** Avoid destructive uninstall/reinstall in the keep path, or serialize it and treat failed reinstall as a real failed external-state mutation with recovery. Cover the “already installed, uninstall succeeds, reinstall fails” path.
**Confidence:** high

### F-003 [major] uninstalling a non-Grok install can unregister Grok host state — src/uninstall.js:126
**Evidence:**
```js
const departingHadGrok = Array.isArray(manifest.ides) && manifest.ides.includes('grok');
const { host, isolation: iso } = releaseGrokOutsideJournal({
  basePath,
  restageSurvivor: departingHadGrok,
});
```
**Claim:** `releaseGrokOutsideJournal` is called unconditionally, and its last-owner path omits `ides`, so a manifest that never selected Grok still runs `grok plugin uninstall atomic-skills` when no survivor is found.
**Impact:** A Codex/Cursor-only uninstall can remove Grok host registration or managed ignore entries it did not own, especially if registry state is incomplete or the plugin was installed manually/outside this manifest.
**Recommendation:** Gate release on `departingHadGrok` or a durable “this base owns Grok outside-journal state” marker. Add a test that a non-Grok uninstall with a mock Grok binary performs no host calls and leaves config unchanged.
**Confidence:** high

### F-004 [major] corrupt installs registry is treated as no other owners — src/runtime-layers/grok-refcount.js:27
**Evidence:**
```js
if (existsSync(registryPath)) {
  try {
    const list = JSON.parse(readFileSync(registryPath, 'utf8'));
    ...
  } catch { /* ignore corrupt registry */ }
}
return [...bases];
```
**Claim:** `listKnownInstallBases` silently ignores corrupt/unreadable registry content and returns only `home`.
**Impact:** A corrupted `~/.atomic-skills/installs.json` can make release logic falsely conclude this is the last Grok owner, unregistering host state and removing isolation while other installs still exist.
**Recommendation:** Fail closed for Grok release owner scans, matching `readInstallsRegistry`: return a skipped/failed cleanup status on corrupt registry instead of shrinking the owner set. Add corrupt-registry tests for both shrink and uninstall.
**Confidence:** high