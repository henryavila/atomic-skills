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