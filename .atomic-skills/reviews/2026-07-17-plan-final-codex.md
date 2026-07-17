**Findings**

1. **Critical** — `install --repair` can be unreachable for corrupt/incomplete manifests.  
   `install()` calls `readManifest()` for user/project before checking `repair`; `readManifest` raw-parses JSON, so an invalid incomplete manifest throws before the recovery path runs. This violates “recoverable via CLI without hand-editing JSON.”  
   `src/install.js:1166`, `src/install.js:1172`

2. **Critical** — normal uninstall can hide an incomplete corrupt manifest as “No installation found.”  
   `readManifest()` failures are caught into `manifest = null`, then the function returns at the no-install branch before the incomplete recovery gate. A corrupt incomplete transaction is not surfaced with `--force-incomplete` guidance.  
   `src/uninstall.js:179`, `src/uninstall.js:191`, `src/uninstall.js:196`

3. **Critical** — Grok uninstall unregisters shared runtime ownership before the journal uninstall succeeds.  
   `releaseGrokAndUnregisterRuntime()` is called before `buildInstaller({}).uninstall()`, and it can remove the registry/runtime at `unregisterAndMaybeReclaimRuntimeUnlocked()`. If journal replay then throws, the install files/manifest remain but the refcount says the owner is gone.  
   `src/uninstall.js:234`, `src/install.js:667`, `src/uninstall.js:267`

4. **Critical** — failed/skipped Grok release still suppresses normal registry unregister after uninstall.  
   `registryUnregisteredWithGrok` is set immediately after `releaseGrokAndUnregisterRuntime()`, regardless of whether that function skipped due to untrusted registry or retained the registry on host failure. The journal uninstall then proceeds, and the later normal unregister is skipped, leaving stale registry entries that cannot be retried through normal uninstall once the manifest/package is gone.  
   `src/uninstall.js:235`, `src/uninstall.js:240`, `src/install.js:657`, `src/uninstall.js:274`

5. **Major** — legacy registry survivors often become permanently non-electable, so restage can fail with valid remaining installs.  
   For legacy-array owners, non-live project bases are only electable if `discoverPackageIdentity(basePath)` finds a package checkout or per-base `.atomic-skills/package-root`. Normal project installs do not have that pointer; only the global home pointer is written. After migrating the registry, uninstalling the live writer can leave surviving installs but no electable packageRoot to restage.  
   `src/install.js:330`, `src/install.js:339`, `src/install.js:571`

6. **Major** — auto-update drop-revert pending ledger is not path-safe.  
   The pending ledger uses plain `writeFileSync` + `renameSync` under `.atomic-skills`, not the engine no-follow writer. A symlinked/intermediate `.atomic-skills` path can be followed during the fallback that is specifically part of installer hardening.  
   `src/runtime-layers/auto-update-drop-revert.js:172`, `src/runtime-layers/auto-update-drop-revert.js:176`

7. **Major** — `stageRuntimeArtifacts` reintroduces symlink races after no-follow writes.  
   After `writeFileNoFollow()`, the code calls `chmodSync(join(basePath, item.path), ...)`, which follows paths and can race against a leaf replacement. That breaks the stated no-follow guarantee for staged executable artifacts.  
   `src/runtime-layers/effects/stage-runtime-artifacts.js:94`, `src/runtime-layers/effects/stage-runtime-artifacts.js:101`, `src/runtime-layers/effects/stage-runtime-artifacts.js:105`, `src/runtime-layers/effects/stage-runtime-artifacts.js:111`

8. **Major** — tree removal still follows symlinked directories.  
   `removeTreeNoFollow()` uses `existsSync`, `statSync`, and `readdirSync` on `join(basePath, relPath)`. If an owned tree root is replaced by a symlink to a directory, this follows and traverses outside the install base before no-follow unlink protections get a chance to act.  
   `src/runtime-layers/effects/stage-runtime-artifacts.js:203`, `src/runtime-layers/effects/stage-runtime-artifacts.js:209`, `src/runtime-layers/effects/stage-runtime-artifacts.js:214`