import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, rmSync, rmdirSync, readdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { releaseGrokOutsideJournal, scanKnownInstallBases, sameInstallBase } from './runtime-layers/grok-refcount.js';
import { unlinkIfExists, withSharedRuntimeLocks } from './runtime-locks.js';
import { buildLiveOwnerRecord, discoverPackageIdentity, ownerFingerprint } from './package-identity.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..');

/**
 * Stages the shared package-root pointer under ~/.atomic-skills/.
 *
 * Surviving skills resolve bundled scripts from this file
 * (`node "$(cat "$HOME/.atomic-skills/package-root")/scripts/..."`). The
 * pointer is this package directory (scripts/ plus its node_modules).
 *
 * Older installs also staged an aiDeck launcher, a dashboard client, and a
 * consumer template. This function no longer creates those paths.
 * removeRuntimeArtifacts still deletes them when a previous version left them
 * behind, and never touches ~/.aideck/.
 */
export function installRuntimeArtifacts() {
  const root = join(homedir(), '.atomic-skills');
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, 'package-root'), `${PACKAGE_ROOT}\n`);
}

function installsRegistryPath() {
  return join(homedir(), '.atomic-skills', 'installs.json');
}

export const REGISTRY_SCHEMA_VERSION = '1';

/**
 * Materialize versioned owner objects for the given basePath list.
 * - Live writer (opts.liveBasePath): always populated from process identity.
 * - Prior versioned owners: keep known fields (do not invent packageRoot).
 * - Legacy bare strings / missing metadata: discover or mark non-electable.
 *
 * @param {string[]} basePaths
 * @param {{ format: string, list: string[], raw: unknown }} prior
 * @param {{ liveBasePath?: string|null }} [opts]
 * @returns {Array<object>}
 */
export function materializeRegistryOwners(basePaths, prior, opts = {}) {
  const liveBasePath = opts.liveBasePath ?? null;
  const priorByBase = indexPriorOwnersByBase(prior);
  return basePaths.map(
    (basePath) => materializeRegistryOwner(basePath, priorByBase, liveBasePath),
  );
}

/**
 * Index prior owner records by basePath for both registry shapes
 * (versioned `{ owners: [...] }` and legacy `string[]`).
 *
 * @param {{ format: string, raw: unknown }} prior
 * @returns {Map<string, object>}
 */
function indexPriorOwnersByBase(prior) {
  const priorByBase = new Map();
  const raw = prior?.raw;
  if (prior?.format === 'versioned' && raw && typeof raw === 'object'
    && 'owners' in raw && Array.isArray(raw.owners)) {
    for (const owner of raw.owners) addPriorOwner(priorByBase, owner);
  } else if (prior?.format === 'legacy-array' && Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry === 'string') priorByBase.set(entry, { basePath: entry });
    }
  }
  return priorByBase;
}

/**
 * @param {Map<string, object>} priorByBase
 * @param {unknown} owner
 */
function addPriorOwner(priorByBase, owner) {
  if (owner && typeof owner === 'object' && 'basePath' in owner
    && typeof owner.basePath === 'string') {
    priorByBase.set(owner.basePath, owner);
  } else if (typeof owner === 'string') {
    priorByBase.set(owner, { basePath: owner });
  }
}

/**
 * One owner record: live writer, known prior record, or a discovery for a
 * legacy/incomplete base. Never invents packageRoot.
 *
 * @param {string} basePath
 * @param {Map<string, object>} priorByBase
 * @param {string|null} liveBasePath
 * @returns {object}
 */
function materializeRegistryOwner(basePath, priorByBase, liveBasePath) {
  if (liveBasePath != null && sameInstallBase(basePath, liveBasePath)) {
    return buildLiveOwnerRecord(basePath);
  }
  const prev = findPriorOwner(priorByBase, basePath);
  const known = electablePriorOwner(basePath, prev) || nonElectablePriorOwner(basePath, prev);
  if (known) return known;
  const discovered = discoverPackageIdentity(basePath);
  return {
    basePath,
    packageRoot: discovered.packageRoot,
    version: discovered.version,
    fingerprint: discovered.fingerprint,
    electable: discovered.electable,
  };
}

/**
 * @param {Map<string, object>} priorByBase
 * @param {string} basePath
 * @returns {object|undefined}
 */
function findPriorOwner(priorByBase, basePath) {
  return priorByBase.get(basePath)
    || [...priorByBase.entries()].find(([key]) => sameInstallBase(key, basePath))?.[1];
}

/** Keep a prior owner's package identity when it is electable. */
function electablePriorOwner(basePath, prev) {
  if (prev && typeof prev === 'object' && prev.packageRoot && prev.version && prev.electable !== false) {
    return {
      basePath,
      packageRoot: prev.packageRoot,
      version: prev.version,
      fingerprint: prev.fingerprint || ownerFingerprint(prev.packageRoot, prev.version),
      electable: prev.electable !== false,
    };
  }
  return null;
}

/** Keep a prior owner's explicit non-electable record (legacy/incomplete). */
function nonElectablePriorOwner(basePath, prev) {
  if (prev && typeof prev === 'object' && prev.electable === false) {
    return {
      basePath,
      packageRoot: prev.packageRoot ?? null,
      version: prev.version ?? null,
      fingerprint: prev.fingerprint ?? null,
      electable: false,
    };
  }
  return null;
}

/**
 * Strict parse of the installs registry (Codex F-005).
 * Supports legacy string[] and versioned `{ owners: [{ basePath, ... }] }`.
 * Fail-closed on corrupt JSON or unknown shapes — never treat as empty owners.
 *
 * @param {string} [filePath]
 * @returns {{ format: 'empty'|'legacy-array'|'versioned', list: string[], raw: unknown, owners: object[] }}
 */
export function readInstallsRegistry(filePath = installsRegistryPath()) {
  if (!existsSync(filePath)) {
    return { format: 'empty', list: [], raw: null, owners: [] };
  }
  const v = parseRegistryJson(readRegistryText(filePath));
  if (Array.isArray(v)) return legacyRegistryFromArray(v);
  if (v && typeof v === 'object' && 'owners' in v && Array.isArray(v.owners)) {
    return versionedRegistryFromObject({ owners: v.owners });
  }
  throw unknownRegistryFormatError();
}

/**
 * Read the registry text, mapping an I/O failure to a coded error.
 * @param {string} filePath
 * @returns {string}
 */
function readRegistryText(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch (err) {
    /** @type {Error & { code?: string }} */
    const e = new Error(`installs registry unreadable: ${err.message}`);
    e.code = 'REGISTRY_IO';
    throw e;
  }
}

/**
 * Parse the registry JSON, mapping a syntax failure to a coded error.
 * @param {string} rawText
 * @returns {unknown}
 */
function parseRegistryJson(rawText) {
  try {
    return JSON.parse(rawText);
  } catch (err) {
    /** @type {Error & { code?: string }} */
    const e = new Error(`installs registry corrupt JSON: ${err.message}`);
    e.code = 'REGISTRY_CORRUPT';
    throw e;
  }
}

/** @returns {Error & { code?: string }} */
function unknownRegistryFormatError() {
  /** @type {Error & { code?: string }} */
  const e = new Error('installs registry unknown format');
  e.code = 'REGISTRY_UNKNOWN';
  return e;
}

/**
 * Shape a non-electable owner record (legacy string / missing metadata).
 * @param {string} basePath
 * @returns {object}
 */
function nonElectableOwnerRecord(basePath) {
  return {
    basePath, packageRoot: null, version: null, fingerprint: null, electable: false,
  };
}

/**
 * Legacy shape: `string[]` of basePaths.
 * @param {unknown[]} raw
 * @returns {{ format: 'legacy-array', list: string[], raw: unknown[], owners: object[] }}
 */
function legacyRegistryFromArray(raw) {
  const list = /** @type {string[]} */ (
    raw.filter((x) => typeof x === 'string' && x.length > 0)
  );
  const owners = list.map((basePath) => nonElectableOwnerRecord(basePath));
  return { format: 'legacy-array', list, raw, owners };
}

/**
 * One versioned owner entry, or null when it has no usable basePath.
 * @param {unknown} entry
 * @returns {object|null}
 */
function versionedOwnerFromEntry(entry) {
  if (typeof entry === 'string') return entry ? nonElectableOwnerRecord(entry) : null;
  /** @type {{ basePath?: unknown, packageRoot?: unknown, version?: unknown, fingerprint?: unknown, electable?: unknown }} */
  const o = entry;
  const basePath = o?.basePath;
  if (typeof basePath !== 'string' || !basePath) return null;
  return {
    basePath,
    packageRoot: o.packageRoot ?? null,
    version: o.version ?? null,
    fingerprint: o.fingerprint ?? null,
    electable: o.electable !== false && Boolean(o.packageRoot),
  };
}

/**
 * Versioned shape: `{ owners: [...] }`.
 * @param {{ owners: unknown[] }} v
 * @returns {{ format: 'versioned', list: string[], raw: unknown, owners: object[] }}
 */
function versionedRegistryFromObject(v) {
  const owners = [];
  const list = [];
  for (const entry of v.owners) {
    const owner = versionedOwnerFromEntry(entry);
    if (!owner) continue;
    list.push(owner.basePath);
    owners.push(owner);
  }
  return { format: 'versioned', list, raw: v, owners };
}

/**
 * Always write versioned schema (P1-B / F-005).
 * @param {string} filePath
 * @param {string[]} list basePaths in order
 * @param {{ format: string, list: string[], raw: unknown }} prior
 * @param {{ liveBasePath?: string|null }} [opts]
 */
function writeInstallsRegistryAtomic(filePath, list, prior, opts = {}) {
  mkdirSync(dirname(filePath), { recursive: true });
  const owners = materializeRegistryOwners(list, prior, opts);
  const payload = {
    schemaVersion: REGISTRY_SCHEMA_VERSION,
    owners,
  };
  const tmp = `${filePath}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`);
  renameSync(tmp, filePath);
}

/**
 * Point ~/.atomic-skills/package-root at a surviving owner's packageRoot.
 * Does not invent paths — only writes when packageRoot exists on disk.
 * @param {string} packageRoot
 */
export function restagePackageRootFrom(packageRoot) {
  if (typeof packageRoot !== 'string' || !packageRoot) return false;
  if (!existsSync(join(packageRoot, 'package.json'))) {
    return false;
  }
  const root = join(homedir(), '.atomic-skills');
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, 'package-root'), `${packageRoot}\n`);
  return true;
}

/**
 * Record an install base path in the shared runtime registry (idempotent). The
 * global runtime artifacts under ~/.atomic-skills/ are shared across every
 * install (user + each project), so they must only be reclaimed once the LAST
 * install is gone — this registry is the refcount that makes that decision
 * honest (F-003). `basePath` is homedir() for a user install, the repo root for
 * a project install.
 *
 * P1-B: always writes versioned owners with live packageRoot/version/fingerprint.
 */
export function registerInstall(basePath) {
  return withSharedRuntimeLocks({ basePath }, () => {
    recordBasePathUnlocked(basePath);
  });
}

/**
 * Add a base path to the registry and record the live owner. Caller must hold
 * the shared runtime lock.
 * @param {string} basePath
 */
function recordBasePathUnlocked(basePath) {
  const p = installsRegistryPath();
  const prior = readInstallsRegistry(p);
  const list = [...prior.list];
  if (!list.some((b) => sameInstallBase(b, basePath))) list.push(basePath);
  writeInstallsRegistryAtomic(p, list, prior, { liveBasePath: basePath });
}

/**
 * Remove an install base path from the registry. Returns the number of installs
 * still registered AFTER removal. When it drops to 0 the registry file itself is
 * deleted (so $HOME returns to baseline). The caller reclaims the shared runtime
 * artifacts only when this returns 0 (F-003).
 *
 * Fail-closed on corrupt/unknown registry (Codex F-005) — never pretend zero owners.
 */
export function unregisterInstall(basePath) {
  return withSharedRuntimeLocks({ basePath }, () => {
    const p = installsRegistryPath();
    const prior = readInstallsRegistry(p);
    const next = prior.list.filter((b) => !sameInstallBase(b, basePath));
    if (next.length === 0) {
      unlinkIfExists(p);
      return 0;
    }
    writeInstallsRegistryAtomic(p, next, prior, { liveBasePath: null });
    return next.length;
  });
}

/**
 * Publish runtime artifacts and register ownership under one lock (Codex F-004).
 * Avoids nested withSharedRuntimeLocks (would deadlock on O_EXCL).
 * @param {string} basePath
 */
export function publishRuntimeAndRegister(basePath) {
  return withSharedRuntimeLocks({ basePath }, () => {
    installRuntimeArtifacts();
    recordBasePathUnlocked(basePath);
  });
}

/**
 * Unregister and optionally reclaim runtime under one lock (Codex F-004).
 * @param {string} basePath
 * @returns {number} remaining installs
 */
export function unregisterAndMaybeReclaimRuntime(basePath) {
  return withSharedRuntimeLocks({ basePath }, () => {
    return unregisterAndMaybeReclaimRuntimeUnlocked(basePath);
  });
}

/**
 * Registry remove + optional runtime reclaim without acquiring locks.
 * Caller MUST hold `withSharedRuntimeLocks` (or accept races).
 * Identity compare uses normalize/realpath (sameInstallBase) so equivalent
 * paths drop correctly after scan-side normalize.
 *
 * P1-B: when the departing owner was the last electable writer of the active
 * packageRoot, elect a surviving electable owner and restage package-root.
 *
 * @param {string} basePath
 * @returns {number} remaining installs
 */
function unregisterAndMaybeReclaimRuntimeUnlocked(basePath) {
  const p = installsRegistryPath();
  const prior = readInstallsRegistry(p);
  const departing = (prior.owners || []).find((o) => sameInstallBase(o.basePath, basePath));
  const next = prior.list.filter((b) => !sameInstallBase(b, basePath));
  if (next.length === 0) {
    unlinkIfExists(p);
    removeRuntimeArtifacts();
    return 0;
  }
  writeInstallsRegistryAtomic(p, next, prior, { liveBasePath: null });

  // Re-read materialised remaining owners after migration write.
  const after = readInstallsRegistry(p);
  const electable = selectSurvivingElectableOwners(after.owners);
  restagePackageRootIfNeeded(departing, electable);

  return next.length;
}

/**
 * Surviving owners that can provide a packageRoot for restaging.
 * @param {object[]|undefined} owners
 * @returns {object[]}
 */
function selectSurvivingElectableOwners(owners) {
  return (owners || []).filter((owner) => owner.electable !== false && owner.packageRoot);
}

/**
 * Re-point ~/.atomic-skills/package-root at the last electable survivor when
 * the departing writer owned the active root, or when the active root is no
 * longer electable while survivors remain.
 *
 * @param {object|undefined} departing
 * @param {object[]} electable
 */
function restagePackageRootIfNeeded(departing, electable) {
  const packageRootOnDisk = readStagedPackageRoot();
  if (!shouldRestagePackageRoot(departing, electable, packageRootOnDisk)) return;
  const survivor = electable[electable.length - 1];
  if (survivor?.packageRoot) {
    restagePackageRootFrom(survivor.packageRoot);
  }
}

/**
 * Read the currently staged package-root pointer, or null when absent/unreadable.
 * @returns {string|null}
 */
function readStagedPackageRoot() {
  const packageRootFile = join(homedir(), '.atomic-skills', 'package-root');
  if (!existsSync(packageRootFile)) return null;
  try {
    return readFileSync(packageRootFile, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

/**
 * Decide whether a departing owner requires re-electing package-root.
 * @param {object|undefined} departing
 * @param {object[]} electable
 * @param {string|null} packageRootOnDisk
 * @returns {boolean}
 */
function shouldRestagePackageRoot(departing, electable, packageRootOnDisk) {
  const departingRoot = departing?.packageRoot || null;
  const lastWriterOfActiveRoot = Boolean(
    departingRoot
    && packageRootOnDisk
    && departingRoot === packageRootOnDisk
    && !electable.some((o) => o.packageRoot === departingRoot),
  );
  const activeRootStillElectable = packageRootOnDisk
    && electable.some((o) => o.packageRoot === packageRootOnDisk);
  return Boolean(lastWriterOfActiveRoot || (electable.length > 0 && !activeRootStillElectable));
}

/**
 * Current registry owner count when readable; -1 if corrupt/unreadable.
 * Does not throw — used for return values on fail-closed skip paths.
 * @returns {number}
 */
function registryOwnerCountSafe() {
  try {
    return readInstallsRegistry(installsRegistryPath()).list.length;
  } catch {
    return -1;
  }
}

/**
 * Grok outside-journal release + optional registry unregister under one shared
 * lock (Codex F-001 / P0-C concurrency).
 *
 * Order under the lock (P0-C C1–C3):
 * 1. Trusted scan of registry (+ known bases). If untrusted → skip host and
 *    isolation mutations and do **not** mutate the registry.
 * 2. `remainingBases` = scan bases without this `basePath` (in-memory only).
 * 3. `releaseGrokOutsideJournal` with `listInstallBases: () => remainingBases`
 *    forced (caller cannot override — survivor set must be the post-removal
 *    snapshot, not a re-scan that still includes self).
 * 4. If last-owner host unregister **failed** (may be half-applied) → keep
 *    registry so a retry still sees this owner. Fail-open skips (binary
 *    missing / bridge disabled) still commit unregister when finalizeRegistry.
 * 5. Else, when `finalizeRegistry` (default true): write registry without
 *    basePath; if empty → reclaim runtime.
 *
 * Uninstall orchestration (C-codex-3/4) calls with `finalizeRegistry: false`
 * so host/isolation release runs against the post-removal simulation first,
 * then journal Driver.uninstall, then registry unregister only after journal
 * success — and only when this helper did not retain ownership for host-fail
 * retry (`registryUnregistered` / `retainRegistryForHostRetry`).
 *
 * Residual race (documented): host CLI (`grok plugin …`) is external and not
 * covered by the O_EXCL file lock — two processes can still interleave host
 * commands after both pass the registry decision. Full atomicity with the host
 * would need a host-level lock or single daemon; this serializes our registry
 * decision + release sequencing which is the primary dual-keep failure mode.
 *
 * @param {string} basePath
 * @param {{
 *   home?: string,
 *   listInstallBases?: () => string[],
 *   readManifestFor?: (dir: string) => object | null,
 *   run?: import('./runtime-layers/grok-plugin-host.js').HostRunner,
 *   resolveBin?: () => string | null,
 *   env?: NodeJS.ProcessEnv,
 *   restageSurvivor?: boolean,
 *   finalizeRegistry?: boolean,
 * }} [releaseOpts] - forwarded to releaseGrokOutsideJournal
 *   (`basePath` and `listInstallBases` are controlled here; caller listInstallBases is ignored).
 *   `finalizeRegistry` defaults to true; when false, only host /isolation release runs
 *   and the registry is left for the caller after journal success.
 * @returns {{
 *   remaining: number,
 *   lastOwner: boolean,
 *   host: { status: string, detail?: string, restage?: string },
 *   isolation: { status: string, detail?: string },
 *   registryUnregistered: boolean,
 *   retainRegistryForHostRetry: boolean,
 * }}
 */
export function releaseGrokAndUnregisterRuntime(basePath, releaseOpts = {}) {
  return withSharedRuntimeLocks({ basePath }, () => {
    const home = releaseOpts.home || process.env.HOME || homedir();
    const finalizeRegistry = releaseOpts.finalizeRegistry !== false;

    // 1. Trusted scan — fail-closed: never shrink owners / mutate on corrupt registry.
    const scan = scanKnownInstallBases(home);
    if (scan.status === 'untrusted') {
      return {
        remaining: registryOwnerCountSafe(),
        lastOwner: false,
        host: { status: 'skipped', detail: 'registry-untrusted' },
        isolation: { status: 'skipped', detail: 'registry-untrusted' },
        registryUnregistered: false,
        retainRegistryForHostRetry: false,
      };
    }

    // 2. Post-removal owner set (in-memory). Do not re-scan ambient state later.
    const remainingBases = scan.bases.filter((b) => !sameInstallBase(b, basePath));

    // 3. Release against that exact list. Drop caller listInstallBases + finalize
    // flag so they cannot reintroduce self or diverge from the post-removal snapshot (C3).
    const {
      listInstallBases: _ignoredListInstallBases,
      finalizeRegistry: _ignoredFinalize,
      ...restReleaseOpts
    } = releaseOpts;
    const released = releaseGrokOutsideJournal({
      ...restReleaseOpts,
      basePath,
      listInstallBases: () => remainingBases,
    });

    // 4. Last-owner host failure may leave host half-applied — keep registry
    // so retry still sees this owner. Fail-open `skipped` (binary gone) commits.
    if (released.lastOwner && released.host.status === 'failed') {
      return {
        remaining: registryOwnerCountSafe(),
        lastOwner: true,
        host: released.host,
        isolation: released.isolation,
        registryUnregistered: false,
        retainRegistryForHostRetry: true,
      };
    }

    // 5. Finalize registry remove + optional runtime reclaim (optional for
    // uninstall that must journal-uninstall first — C-codex-3).
    if (!finalizeRegistry) {
      return {
        remaining: registryOwnerCountSafe(),
        lastOwner: released.lastOwner,
        host: released.host,
        isolation: released.isolation,
        registryUnregistered: false,
        retainRegistryForHostRetry: false,
      };
    }

    const remaining = unregisterAndMaybeReclaimRuntimeUnlocked(basePath);
    return {
      remaining,
      lastOwner: released.lastOwner,
      host: released.host,
      isolation: released.isolation,
      registryUnregistered: true,
      retainRegistryForHostRetry: false,
    };
  });
}

/**
 * Reverse of installRuntimeArtifacts(): remove ~/.atomic-skills/package-root.
 * Also deletes leftover aiDeck paths from older installs (bin/aideck.mjs,
 * dashboard/, aideck-consumer/, src/provision-consumer.js). Current installs
 * do not create those paths. They are not manifest-tracked because they live
 * at a fixed user path regardless of install scope.
 *
 * Caller is responsible for scope-gating: these artifacts are shared across all
 * installs, so only a USER-scope uninstall should call this (a project uninstall
 * must leave them so other repos / the user install keep working).
 *
 * Never touches ~/.aideck/. That directory is leftover user data from the
 * removed dashboard, not an install artifact.
 */
export function removeRuntimeArtifacts() {
  const root = join(homedir(), '.atomic-skills');

  for (const file of [
    join(root, 'bin', 'aideck.mjs'),
    join(root, 'src', 'provision-consumer.js'),
    join(root, 'package-root'),
  ]) {
    if (!existsSync(file)) continue;
    try { unlinkSync(file); } catch { /* Best-effort reclaim: never abort an uninstall. */ }
    const parent = dirname(file);
    try { if (readdirSync(parent).length === 0) rmdirSync(parent); } catch { /* Best-effort prune: parent may be co-owned. */ }
  }

  for (const dir of [join(root, 'dashboard'), join(root, 'aideck-consumer')]) {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  }
}
