import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, rmSync, rmdirSync, readdirSync, statSync, renameSync } from 'node:fs';
import { join, dirname, relative, basename, sep as PATH_SEP } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import * as p from '@clack/prompts';
import {
  IDE_CONFIG, PUBLIC_IDE_IDS,
  SKILL_NAMESPACE, normalizeIDESelection,
  LEGACY_NAMESPACE_PATHS,
} from './config.js';
import { hashContent } from './hash.js';
import { readManifest, writeManifest, MANIFEST_DIR } from './manifest.js';
import { GLOBAL_INSTRUCTION_PATHS, DELEGATE_MARKERS, globalInstructionBody, installedGlobalInstructionPaths, globalInstructionState, globalInstructionsDecision } from './global-instructions.js';
import { buildInstaller } from './installer.js';
import { computeSkillsFileSet } from './providers/skills-file-set.js';
import { migrateLegacyInstall } from './migrate-legacy-install.js';
import { adoptPreexistingDesiredFiles } from './adopt-preexisting-desired.js';
import { parse as parseYaml } from 'yaml';
import { detectLanguage, detectIDEs, countSkills } from './detect.js';
import { resolveProjectScopeTarget } from './scope.js';
import {
  showIntro, printConfig, promptAction, promptIDESelection,
  promptLanguageSelection, promptInstallScope,
  showPostInstall, showNonInteractiveResult, msg,
} from './ui.js';
import { DEFAULT_MEMORY_PATH } from './providers/skills-file-set.js';
import { releaseGrokOutsideJournal, scanKnownInstallBases, sameInstallBase } from './runtime-layers/grok-refcount.js';
import { syncGrokPluginHostAfterInstall } from './grok-host-sync.js';
// P0-B / F-002 consumer fallback — DELETE import when engine drop-revert is pinned.
import { revertDroppedAutoUpdateEffects } from './runtime-layers/auto-update-drop-revert.js';
import {
  reconcileAutoUpdateSessionStartSurfaces,
  resolveDesiredAutoUpdateCommands,
} from './runtime-layers/auto-update.js';
import { unlinkIfExists, withSharedRuntimeLocks } from './runtime-locks.js';
import { verifyInstall, decisionsByState } from './status-verify.js';
import {
  getIncompleteInfo,
  incompleteOperatorMessage,
  repairIncompleteInstall,
  formatRecoverySummary,
  resolveIncompleteRecoveryScope,
} from './recovery-cli.js';

export { resolveProjectScopeTarget } from './scope.js';

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

/** Absolute path of the cross-install runtime registry (refcount file). */
function installsRegistryPath() {
  return join(homedir(), '.atomic-skills', 'installs.json');
}

/**
 * Codex F-002: if a previous install customized memory_path away from the
 * canonical `.ai/memory/`, warn once (do not block). Custom path is no longer
 * configurable — rendered skills always use DEFAULT_MEMORY_PATH.
 *
 * @param {object|null} existingManifest
 * @param {string} language
 */
export function warnLegacyCustomMemoryPath(existingManifest, language = 'en') {
  const oldPath = existingManifest?.modules?.memory?.config?.memory_path;
  if (typeof oldPath !== 'string' || oldPath.trim().length === 0) return;
  const normalized = oldPath.endsWith('/') ? oldPath : `${oldPath}/`;
  const canonical = DEFAULT_MEMORY_PATH.endsWith('/')
    ? DEFAULT_MEMORY_PATH
    : `${DEFAULT_MEMORY_PATH}/`;
  if (normalized === canonical) return;
  const isPt = language === 'pt';
  const msgText = isPt
    ? `Caminho de memória customizado "${oldPath}" não é mais suportado. Skills usam ${DEFAULT_MEMORY_PATH}. Migre o conteúdo se necessário.`
    : `Custom memory path "${oldPath}" is no longer supported. Skills use ${DEFAULT_MEMORY_PATH}. Migrate content if needed.`;
  console.warn(`  ${pc.yellow('Warning:')} ${msgText}`);
}

/** Registry schema version for versioned installs.json (P1-B / F-005). */
export const REGISTRY_SCHEMA_VERSION = '1';

/**
 * Stable fingerprint of package identity (packageRoot path + version).
 * Shared helper with observe — never invents packageRoot.
 * @param {string|null|undefined} packageRoot
 * @param {string|null|undefined} version
 * @returns {string|null}
 */
export function ownerFingerprint(packageRoot, version) {
  if (typeof packageRoot !== 'string' || !packageRoot || typeof version !== 'string' || !version) {
    return null;
  }
  return hashContent(`${packageRoot}\n${version}\n`);
}

function nonElectableIdentity() {
  return { packageRoot: null, version: null, fingerprint: null, electable: false };
}

function readThisPackageVersion(root) {
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    if (pkg?.name === '@henryavila/atomic-skills' && typeof pkg.version === 'string') return pkg.version;
  } catch { /* ignore */ }
  return null;
}

function electableIdentity(packageRoot, version) {
  return { packageRoot, version, fingerprint: ownerFingerprint(packageRoot, version), electable: true };
}

function discoverFromStagedPointer(basePath) {
  const pointer = join(basePath, '.atomic-skills', 'package-root');
  if (!existsSync(pointer)) return null;
  try {
    const root = readFileSync(pointer, 'utf8').trim();
    if (!root || !existsSync(join(root, 'package.json'))) return null;
    const version = readThisPackageVersion(root);
    return version ? electableIdentity(root, version) : null;
  } catch { return null; }
}

function discoverFromCheckout(basePath) {
  const version = readThisPackageVersion(basePath);
  return version ? electableIdentity(basePath, version) : null;
}

/**
 * Discover package identity for a legacy basePath without inventing paths.
 * Only returns packageRoot when a real package.json for this package is readable
 * at basePath (dev/checkout install), or when a staged pointer under that base
 * resolves to an existing package root.
 *
 * @param {string} basePath
 * @returns {{ packageRoot: string|null, version: string|null, fingerprint: string|null, electable: boolean }}
 */
export function discoverPackageIdentity(basePath) {
  if (typeof basePath !== 'string' || !basePath) return nonElectableIdentity();
  return discoverFromStagedPointer(basePath) ?? discoverFromCheckout(basePath) ?? nonElectableIdentity();
}

/**
 * Owner record for the live process (current PACKAGE_ROOT + package.json version).
 * @param {string} basePath
 */
export function buildLiveOwnerRecord(basePath) {
  let version = null;
  try {
    version = getPackageVersion();
  } catch {
    version = null;
  }
  const packageRoot = PACKAGE_ROOT;
  const fingerprint = ownerFingerprint(packageRoot, version);
  return {
    basePath,
    packageRoot,
    version,
    fingerprint,
    electable: Boolean(packageRoot && version && fingerprint),
  };
}

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
    const p = installsRegistryPath();
    const prior = readInstallsRegistry(p);
    const list = [...prior.list];
    if (!list.some((b) => sameInstallBase(b, basePath))) list.push(basePath);
    writeInstallsRegistryAtomic(p, list, prior, { liveBasePath: basePath });
  });
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
    const p = installsRegistryPath();
    const prior = readInstallsRegistry(p);
    const list = [...prior.list];
    if (!list.some((b) => sameInstallBase(b, basePath))) list.push(basePath);
    writeInstallsRegistryAtomic(p, list, prior, { liveBasePath: basePath });
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
 * @param {object} [releaseOpts] - forwarded to releaseGrokOutsideJournal
 *   (`basePath` and `listInstallBases` are controlled here; caller listInstallBases is ignored)
 * @param {boolean} [releaseOpts.finalizeRegistry=true] - when false, only host
 *   /isolation release runs; registry is left for the caller after journal success
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

/**
 * Names that have historically been atomic-skills artifacts and are safe to
 * delete from legacy paths. F-002 (codex review 2026-05-24): without this
 * safelist, `--yes` cleanup would silently delete ANY file at a legacy
 * namespace path, including user-owned custom skills the user happened to
 * place under our namespace. Frontmatter-based safelist preserves those.
 *
 * Add removed skill names here when consolidating (so post-removal cleanups
 * still recognize the artifact as ours). Pre-1.x `as-` prefix is included.
 */
const HISTORICAL_ATOMIC_SKILLS_NAMES = new Set([
  // Removed in v2.0.0 consolidation
  'review-plan-internal', 'review-plan-vs-artifacts',
  'review-plan-with-codex', 'review-code-with-codex',
  // Removed in v2.0.0 consolidation (project-status + project-plan → project)
  'project-status', 'project-plan',
  // Removed: plan lifecycle and the implement driver
  'project', 'implement',
  // Pre-1.x prefix (original `as-` form, deprecated)
  'as-fix', 'as-hunt', 'as-prompt', 'as-save-and-push', 'as-init-memory',
  // Namespace root SKILL.md
  SKILL_NAMESPACE,
]);

/**
 * F-002 (review): inspect frontmatter for an atomic-skills signature.
 * Returns true if the file's first frontmatter block has a `name:` field
 * that matches a known atomic-skills name (current catalog or historical).
 * Files without atomic-skills shape are preserved during legacy cleanup.
 */
export function isAtomicSkillsArtifact(filePath, knownCurrentNames) {
  let head;
  try {
    head = readFileSync(filePath, 'utf8').slice(0, 4096);
  } catch {
    // Unreadable file → conservative: preserve.
    return false;
  }
  if (!head.startsWith('---\n')) return false;
  const end = head.indexOf('\n---\n', 4);
  if (end < 0) return false;
  const fm = head.slice(4, end);
  const m = fm.match(/^name:\s*['"]?([a-z][a-z0-9-]*)['"]?\s*$/m);
  if (!m) return false;
  const name = m[1];
  return knownCurrentNames.has(name) || HISTORICAL_ATOMIC_SKILLS_NAMES.has(name);
}

/**
 * P1-A: package leftover at a desired path under our namespace.
 * Command files often lack `name:` (only `description:`) so isAtomicSkillsArtifact
 * alone misses them. Eligible when:
 *   - path is under the atomic-skills namespace segment, AND
 *   - content starts with YAML frontmatter, AND
 *   - basename (or parent dir for SKILL.md) matches a known/historical skill name.
 *
 * Foreign user files without frontmatter or with unrelated basenames stay unmanaged.
 *
 * @param {string} filePath absolute path
 * @param {string} relPath relative desired path
 * @param {Set<string>} knownCurrentNames
 * @returns {boolean}
 */
export function isAtomicSkillsNamespaceLeftover(filePath, relPath, knownCurrentNames) {
  if (typeof relPath !== 'string' || !relPath.includes(SKILL_NAMESPACE)) return false;
  let head;
  try {
    head = readFileSync(filePath, 'utf8').slice(0, 256);
  } catch {
    return false;
  }
  if (!head.startsWith('---\n') && !head.startsWith('---\r\n')) return false;
  const base = basename(relPath);
  const stem = base.includes('.') ? base.slice(0, base.lastIndexOf('.')) : base;
  if (stem === 'SKILL') {
    const parent = basename(dirname(relPath));
    return knownCurrentNames.has(parent) || HISTORICAL_ATOMIC_SKILLS_NAMES.has(parent);
  }
  // Namespace root or asset paths are package-owned when frontmatter-shaped.
  if (stem === SKILL_NAMESPACE || stem.startsWith('_') || relPath.includes('/_assets/')) {
    return true;
  }
  return knownCurrentNames.has(stem) || HISTORICAL_ATOMIC_SKILLS_NAMES.has(stem);
}

/**
 * Scan obsolete install paths (see LEGACY_NAMESPACE_PATHS) for any file
 * still living under the atomic-skills namespace. These are invisible to
 * the manifest-based orphan detector because they predate the current
 * IDE_CONFIG. Returns [{path, legacyRoot, reason, safe}].
 *
 * `safe: true` means the file's frontmatter identifies it as a known
 * atomic-skills artifact (current or historical). `safe: false` means
 * the file is at the legacy path but does not look like an atomic-skills
 * artifact — likely user-owned, preserve it.
 */
export function findLegacyOrphans(basePath, knownCurrentNames = new Set()) {
  const found = [];
  for (const { dir, reason, prefixed } of LEGACY_NAMESPACE_PATHS) {
    const parentDir = join(basePath, dir);
    if (!existsSync(parentDir)) continue;

    // 1. Nested namespace root: <dir>/atomic-skills/...
    const nsRoot = join(parentDir, SKILL_NAMESPACE);
    if (existsSync(nsRoot)) {
      const walk = (cur) => {
        for (const entry of readdirSync(cur, { withFileTypes: true })) {
          const full = join(cur, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (entry.isFile()) {
            const safe = isAtomicSkillsArtifact(full, knownCurrentNames);
            found.push({ path: full, legacyRoot: nsRoot, reason, safe });
          }
        }
      };
      walk(nsRoot);
    }

    // 2. Prefixed sibling entries: <dir>/atomic-skills-* (e.g. legacy Gemini CLI skills/commands)
    if (prefixed) {
      try {
        for (const entry of readdirSync(parentDir, { withFileTypes: true })) {
          if (entry.name === SKILL_NAMESPACE) continue;
          if (entry.name.startsWith(`${SKILL_NAMESPACE}-`)) {
            const full = join(parentDir, entry.name);
            if (entry.isDirectory()) {
              const walk = (cur) => {
                for (const sub of readdirSync(cur, { withFileTypes: true })) {
                  const subFull = join(cur, sub.name);
                  if (sub.isDirectory()) walk(subFull);
                  else if (sub.isFile()) {
                    const safe = isAtomicSkillsArtifact(subFull, knownCurrentNames);
                    found.push({ path: subFull, legacyRoot: full, reason, safe });
                  }
                }
              };
              walk(full);
            } else if (entry.isFile()) {
              const safe = isAtomicSkillsArtifact(full, knownCurrentNames);
              found.push({ path: full, legacyRoot: full, reason, safe });
            }
          }
        }
      } catch (err) { if (err.code !== 'ENOENT') throw err; }
    }
  }
  return found;
}

/**
 * Delete each legacy-orphan file, then walk back up removing empty parents
 * until (and including) the namespace root. Never touches dirs above the
 * namespace root (e.g. .claude/skills/ itself may be co-owned with other
 * tools and is left in place).
 */
export function removeLegacyOrphans(basePath, orphans) {
  const nsRootsSeen = new Set();
  for (const { path: full, legacyRoot } of orphans) {
    try {
      unlinkSync(full);
    } catch (err) {
      // E1 (review 2026-05-24): surface deletion failures so the user knows
      // the cleanup was partial. Skip the parent walkback on failure too.
      console.warn(`[atomic-skills] could not remove legacy orphan ${full}: ${err.message}`);
      continue;
    }
    nsRootsSeen.add(legacyRoot);
    let parent = dirname(full);
    // L1 (review 2026-05-24): path-aware boundary check. A bare `startsWith`
    // would match `<legacyRoot>-sibling/...` directories with a common prefix.
    // Walk up only inside the namespace root (and stop AT the root).
    const legacyRootWithSep = legacyRoot + PATH_SEP;
    while (parent !== legacyRoot && parent.startsWith(legacyRootWithSep)) {
      try {
        if (readdirSync(parent).length === 0) {
          rmdirSync(parent);
          parent = dirname(parent);
        } else break;
      } catch { break; }
    }
  }
  // Try to remove each namespace root if it's now empty (siblings may have
  // been emptied by this call); the parent legacy dir is intentionally left.
  for (const nsRoot of nsRootsSeen) {
    try {
      if (readdirSync(nsRoot).length === 0) rmdirSync(nsRoot);
    } catch { /* Best-effort prune; a sibling or race may keep the root. */ }
  }
}

/**
 * Core install logic (non-interactive, testable) — flipped onto the
 * @henryavila/minimalist-installer engine (T-F3-4). It delegates every file mutation
 * to the install-base Driver (`buildInstaller`): the SkillsProvider emits the
 * skill file set (reconcileFileSet) and the auto-update runtime layer emits the
 * executable hook (stageRuntimeArtifacts) + the settings.json SessionStart entry
 * (jsonMerge). The Driver writes the JOURNAL manifest and, on a re-install,
 * threads each effect's prior before-state — so reconcileFileSet runs the 3-hash
 * no-clobber update (user-modified files survive, P3) and removes unmodified
 * orphans, with no bespoke conflict/orphan logic here.
 *
 * This function then patches the consumer METADATA (version/language/ides)
 * and a DERIVED legacy `files` map onto the manifest: the journal (`effects`) stays
 * authoritative for uninstall, while the `files` map keeps the status/compat
 * readers working.
 *
 * @param {string} projectDir
 * @param {object} options - { language, ides, skillsDir, metaDir, scope,
 *   forceAdopt?, autoUpdateDropInjectFailAfterN? } (inject is a P0-B test seam only)
 * @param {object} [callbacks] - { onFileWritten }
 * @returns {{ files: Array<{ path: string, hash: string }>, adopt?: object }}
 */
export function installSkills(projectDir, options, callbacks = {}) {
  const { language, ides, skillsDir, metaDir, scope, forceAdopt = false } = options;
  const { onFileWritten } = callbacks;
  const plan = { language, ides, skillsDir, metaDir, scope };

  // P1-A / F-004: adopt only safelist / known-package-hash / force-adopt paths.
  // Foreign content at desired paths becomes unmanaged-desired (excluded from
  // reconcile + never owned). See adopt-preexisting-desired.js.
  const desired = computeSkillsFileSet(plan);
  const priorManifest = readManifest(projectDir);
  const knownCurrentNames = readKnownCurrentSkillNames(metaDir);
  const adoptResult = adoptPreexistingDesiredFiles(projectDir, desired, {
    forceAdopt,
    isArtifact: (abs) => isAtomicSkillsOwnedPath(projectDir, abs, knownCurrentNames),
    knownPackageHashes: collectKnownPackageHashes(priorManifest),
  });
  const excludeDesiredPaths = adoptResult.excludeFromDesired || [];
  reportAdoption(adoptResult);

  // P0-B / F-002 consumer fallback: revert auto-update surfaces the next plan
  // drops before Driver.install rewrites the journal. Crash-resumable and
  // fail-closed on incomplete TX, same recovery contract as Driver.install.
  revertDroppedAutoUpdateEffects(projectDir, plan, {
    injectFailAfterN: options.autoUpdateDropInjectFailAfterN,
  });

  // SessionStart reconcile: remove every AS-owned hook that is not the exact
  // desired command; third-party hooks stay.
  reconcileSessionStartSurface(projectDir, plan);

  const installPlan = { ...plan, excludeDesiredPaths, globalInstructions: options.globalInstructions };
  const optedOutGlobalPaths = applyGlobalInstructionsInstaller(projectDir, installPlan, priorManifest);
  reportGlobalInstructionOutcomes(installPlan, optedOutGlobalPaths);

  // Derive the legacy files list from the journal + the plan: the journal has
  // the authoritative installed hashes, the plan each file's `source` tag.
  const journal = readManifest(projectDir);
  const createdFiles = buildCreatedFiles(projectDir, installPlan, journal);
  patchManifestMetadata(projectDir, journal, installPlan, createdFiles);

  if (onFileWritten) for (const f of createdFiles) onFileWritten(f.path);

  // Hash-classify the post-install filesystem (F2/T-003).
  const verification = verifyInstall(projectDir, readManifest(projectDir));
  return {
    files: createdFiles,
    decisions: decisionsByState(verification),
    verification,
    adopt: adoptionSummary(adoptResult),
  };
}

function collectKnownPackageHashes(priorManifest) {
  const hashes = new Set();
  if (priorManifest?.files && typeof priorManifest.files === 'object') addLegacyFileHashes(hashes, priorManifest.files);
  addReconcileEffectHashes(hashes, priorManifest?.effects || []);
  return hashes;
}

function addLegacyFileHashes(hashes, files) {
  for (const entry of Object.values(files)) {
    if (entry && typeof entry.installed_hash === 'string') hashes.add(entry.installed_hash);
  }
}

function addReconcileEffectHashes(hashes, effects) {
  for (const eff of effects) {
    if (eff?.type !== 'reconcileFileSet') continue;
    for (const row of eff.beforeState || []) {
      if (row && typeof row.installedHash === 'string') hashes.add(row.installedHash);
    }
  }
}

function readKnownCurrentSkillNames(metaDir) {
  try {
    const catalog = parseYaml(readFileSync(join(metaDir, 'catalog.yaml'), 'utf8'));
    return new Set(Object.keys(catalog?.core || {}));
  } catch {
    return new Set();
  }
}

function isAtomicSkillsOwnedPath(projectDir, abs, knownCurrentNames) {
  if (isAtomicSkillsArtifact(abs, knownCurrentNames)) return true;
  return isAtomicSkillsNamespaceLeftover(abs, relative(projectDir, abs), knownCurrentNames);
}

function reportAdoption(adoptResult) {
  if (adoptResult.adopted > 0 || adoptResult.unresolved > 0) {
    console.log(`  ${pc.dim(`adopt: ${adoptResult.adopted} reclaimed, ${adoptResult.unresolved} unmanaged-desired (kept local)`)}`);
    for (const pth of adoptResult.unresolvedPaths || []) console.log(`    ${pc.dim('kept-local')} ${pth}`);
  }
}

function reconcileSessionStartSurface(projectDir, plan) {
  const desired = resolveDesiredAutoUpdateCommands(projectDir, plan);
  reconcileAutoUpdateSessionStartSurfaces(projectDir, {
    claudeCommand: desired.claudeCommand,
    grokCommand: desired.grokCommand,
  });
}

function applyGlobalInstructionsInstaller(projectDir, installPlan, priorManifest) {
  const refusedGlobalPaths = [];
  const optedOutGlobalPaths = new Set();
  for (;;) {
    const installer = buildInstaller({ ...installPlan, refusedGlobalPaths, optedOutGlobalPaths });
    try {
      installer.install({ projectDir });
      return optedOutGlobalPaths;
    } catch (err) {
      handleGlobalInstructionRefusal(err, {
        projectDir, priorManifest, language: installPlan.language, refusedGlobalPaths, optedOutGlobalPaths,
      });
    }
  }
}

function handleGlobalInstructionRefusal(err, {
  projectDir, priorManifest, language, refusedGlobalPaths, optedOutGlobalPaths,
}) {
  const path = err.globalInstructionPath ?? Object.values(GLOBAL_INSTRUCTION_PATHS).find(candidate =>
    candidate && err.message?.includes(`"${candidate}"`));
  if (!path || refusedGlobalPaths.includes(path)) throw err;
  // The engine validates ALL prior text blocks, even omitted effects. Preserve
  // the journal rather than rewriting it to bypass validation.
  if (priorManifest?.effects?.some(e => e.type === 'textBlock' && e.beforeState?.path === path)) {
    let reason = err.message;
    try {
      const state = globalInstructionState(projectDir, path);
      if (state !== 'absent' && state !== 'present') reason = state;
    } catch { /* Keep the original path-safety or I/O reason. */ }
    const blocked = new Error(msg(language).globalInstructionsBlocked(path, reason));
    blocked.code = 'GLOBAL_INSTRUCTIONS_BLOCKED';
    throw blocked;
  }
  // A planning refusal precedes mutations. An apply refusal may leave an
  // incomplete journal; never retry over it or discard ownership records.
  if (readManifest(projectDir)?.transaction?.state === 'incomplete') throw err;
  console.log(`  ${msg(language).globalInstructionsRefused(path, err.message)}`);
  refusedGlobalPaths.push(path);
}

function reportGlobalInstructionOutcomes(installPlan, optedOutGlobalPaths) {
  for (const path of optedOutGlobalPaths) console.log(`  ${msg(installPlan.language).globalInstructionsOptOut(path)}`);
  if (installPlan.scope !== 'user' || installPlan.globalInstructions !== true) return;
  const skipped = installPlan.ides.filter(agent => GLOBAL_INSTRUCTION_PATHS[agent] === null);
  if (skipped.length) console.log(`  ${msg(installPlan.language).globalInstructionsSkipped(skipped.join(', '))}`);
}

function buildCreatedFiles(projectDir, installPlan, journal) {
  const excludeSet = new Set(installPlan.excludeDesiredPaths);
  const hashByPath = new Map();
  const hookFiles = [];
  for (const eff of journal.effects || []) {
    if (eff.type === 'reconcileFileSet') {
      for (const { path, installedHash } of eff.beforeState) hashByPath.set(path, installedHash);
    } else if (eff.type === 'stageRuntimeArtifacts') {
      for (const rel of eff.beforeState?.created || []) {
        const abs = join(projectDir, rel);
        if (existsSync(abs) && statSync(abs).isFile()) {
          hookFiles.push({ path: rel, hash: hashContent(readFileSync(abs, 'utf8')), source: `_hooks/${basename(rel)}` });
        }
      }
    }
  }
  return [
    ...computeSkillsFileSet(installPlan)
      .filter(({ path }) => !excludeSet.has(path))
      .map(({ path, source }) => ({ path, hash: hashByPath.get(path), source })),
    ...hookFiles,
  ];
}

function patchManifestMetadata(projectDir, journal, installPlan, createdFiles) {
  const filesMap = {};
  for (const { path, hash, source } of createdFiles) filesMap[path] = { installed_hash: hash, source };
  const { modules: _legacyModules, ...journalRest } = journal;
  writeManifest(projectDir, {
    ...journalRest,
    version: getPackageVersion(),
    language: installPlan.language,
    ides: installPlan.ides,
    files: filesMap,
  });
}

function adoptionSummary(adoptResult) {
  return {
    adopted: adoptResult.adopted,
    unresolved: adoptResult.unresolved,
    paths: adoptResult.paths,
    unresolvedPaths: adoptResult.unresolvedPaths,
  };
}

export { syncGrokPluginHostAfterInstall };

export function getPackageVersion() {
  const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8'));
  return pkg.version;
}

/** Normalize the public install options into one settings object. */
function parseInstallOptions(options) {
  const {
    yes = false,
    project = false,
    ide: cliIDEs = null,
    lang: cliLang = null,
    allDetected = false,
    repair = false,
    forceAdopt = false,
  } = options;
  return { yes, project, cliIDEs, cliLang, allDetected, repair, forceAdopt };
}

function readManifestOrNull(base) {
  try { return readManifest(base); } catch { return null; }
}

function resolveInstallLanguage(cliLang, manifest, fallback) {
  return cliLang || manifest?.language || fallback;
}

function resolveInitialLanguage(cliLang, userManifest, projectManifest) {
  return cliLang || userManifest?.language || projectManifest?.language || detectLanguage();
}

/** Resolve the base `--repair` works on, or null when there is nothing to repair. */
function resolveRepairTarget({ projectDir, project, projectTarget }) {
  if (project) return { scope: 'project', basePath: projectTarget.path };
  const resolved = resolveIncompleteRecoveryScope({ projectDir, forceProject: false, purpose: 'repair' });
  if (resolved.ambiguous) {
    console.error(`  ${pc.red('Error:')}\n${resolved.message}\n`);
    process.exit(resolved.exitCode || 1);
  }
  if (resolved.none) {
    console.log(resolved.message || 'No incomplete transaction found.');
    console.log('');
    return null;
  }
  if (!resolved.ok) {
    console.error(`  ${pc.red('Error:')} ${resolved.message}\n`);
    process.exit(resolved.exitCode || 1);
  }
  return { scope: resolved.scope, basePath: resolved.basePath };
}

function runRepairMode({ projectDir, project, projectTarget }) {
  console.log('\n  ⚛ Installer recovery (--repair)\n');
  const target = resolveRepairTarget({ projectDir, project, projectTarget });
  if (!target) return;
  const { scope, basePath } = target;
  console.log(`  ${pc.dim(`scope: ${scope} (${basePath})`)}\n`);
  let result;
  try {
    result = repairIncompleteInstall(basePath);
  } catch (err) {
    // Mid-repair interrupt: never claim complete; surface residual.
    console.error(`  ${pc.red('Error:')} ${err.message}`);
    console.error(`\n${incompleteOperatorMessage()}\n`);
    process.exit(1);
  }
  if (result.exitCode && result.exitCode !== 0) {
    console.error(result.message || result.summary || '');
    process.exit(result.exitCode);
  }
  console.log(result.message || result.summary || '');
  if (result.action === 'reversed' && result.exitCode === 0) {
    console.log(`\n  ${pc.dim('Incomplete cleared (reverse-only). Re-run install without --repair to complete.')}\n`);
  }
}

async function resolveInstallScope({ yes, project, initialLanguage, projectTarget, projectManifest, userManifest }) {
  if (yes || project) return project ? 'project' : 'user';
  return promptInstallScope(initialLanguage, {
    projectTarget, initialScope: projectManifest && !userManifest ? 'project' : 'user',
  });
}

function assertNoIncompleteTransaction(basePath) {
  const incomplete = getIncompleteInfo(basePath);
  if (!incomplete.incomplete) return;
  console.error(`\n  ${pc.red('Error:')} Incomplete installer transaction.\n`);
  console.error(formatRecoverySummary(incomplete.desc, incomplete.trust));
  console.error(`\n${incompleteOperatorMessage(incomplete.trust)}\n`);
  process.exit(1);
}

function resolveInstallIdes({ allDetected, cliIDEs, existingManifest, basePath }) {
  if (!allDetected) return cliIDEs || existingManifest?.ides?.slice() || detectIDEs(basePath);
  if (existingManifest?.ides?.length) {
    console.log(`  ${pc.dim('Re-detecting IDEs from filesystem (ignoring manifest selection).')}`);
  }
  return detectIDEs(basePath);
}

function validateCLIIDEs(cliIDEs) {
  if (!cliIDEs) return;
  const validIDs = new Set(Object.keys(IDE_CONFIG));
  const invalid = cliIDEs.filter(id => !validIDs.has(id));
  if (invalid.length === 0) return;
  console.error(`  Error: Unknown IDE(s): ${invalid.join(', ')}. Valid: ${PUBLIC_IDE_IDS.join(', ')}`);
  process.exit(1);
}

function findInstallOrphans(basePath, metaDir) {
  const catalog = parseYaml(readFileSync(join(metaDir, 'catalog.yaml'), 'utf8'));
  const knownCurrentNames = new Set(Object.keys(catalog?.core || {}));
  const orphans = findLegacyOrphans(basePath, knownCurrentNames);
  return {
    safeOrphans: orphans.filter((o) => o.safe),
    unsafeOrphans: orphans.filter((o) => !o.safe),
  };
}

/** Run installSkills plus the out-of-journal host publish shared by both modes. */
function executeInstall(context, language, ides, globalInstructions) {
  const { basePath, skillsDir, metaDir, scope, existingManifest, settings } = context;
  const result = installSkills(basePath, {
    language, ides, skillsDir, metaDir, scope,
    forceAdopt: settings.forceAdopt,
    globalInstructions,
  });
  // Host plugin registry (outside journal): register when grok is wanted,
  // release when the IDE shrink leaves the last grok owner (F-003).
  syncGrokPluginHostAfterInstall(basePath, ides, language, { priorIdes: existingManifest?.ides });
  publishRuntimeAndRegister(basePath);
  return result;
}

/** Non-interactive (`--yes`) install: clean legacy orphans, install, report. */
function runNonInteractiveInstall(context) {
  const { basePath, language, ides, pkgVersion, safeOrphans, unsafeOrphans } = context;
  if (ides.length === 0) {
    console.error(`  ${pc.red('Error:')} No IDEs detected. Use --ide to specify.`);
    process.exit(1);
  }
  if (safeOrphans.length > 0) {
    console.log(`  ${pc.dim(`Cleaning ${safeOrphans.length} legacy orphan file(s) at obsolete install path(s):`)}`);
    for (const o of safeOrphans) console.log(`    ${pc.dim('-')} ${relative(basePath, o.path)}`);
    removeLegacyOrphans(basePath, safeOrphans);
  }
  if (unsafeOrphans.length > 0) {
    console.log(`  ${pc.yellow(`Preserved ${unsafeOrphans.length} file(s) at legacy path that don't look like atomic-skills artifacts (no recognized frontmatter \`name:\`):`)}`);
    for (const o of unsafeOrphans) console.log(`    ${pc.dim('-')} ${relative(basePath, o.path)}`);
    console.log(`  ${pc.dim('Inspect manually and remove if intended.')}`);
  }
  console.log(`◇ ${msg(language).installingMsg(pkgVersion)}`);
  const result = executeInstall(context, language, ides, context.options.globalInstructions);
  showNonInteractiveResult(result, ides, language);
}

function buildInteractiveConfig(context) {
  const { language, languageDetected, ides, project, scope, basePath, projectTarget, existingManifest, metaDir } = context;
  return {
    lang: language, languageDetected, ides: [...ides], project, scope,
    scopePath: scope === 'project' ? basePath : '~/',
    projectTarget, existingVersion: existingManifest?.version, skillCount: countSkills(metaDir),
  };
}

/** Interactive orphan review; false when the user cancels the whole install. */
async function reviewLegacyOrphansInteractive({ config, basePath, safeOrphans, unsafeOrphans }) {
  const isPt = config.lang === 'pt';
  if (safeOrphans.length > 0) {
    p.log.warn(isPt
      ? `${safeOrphans.length} arquivo(s) órfão(s) atomic-skills encontrado(s) em caminhos antigos:`
      : `Found ${safeOrphans.length} atomic-skills orphan file(s) at obsolete install path(s):`);
    for (const o of safeOrphans) p.log.message(`  ${pc.dim('-')} ${relative(basePath, o.path)}  ${pc.dim(`(${o.reason})`)}`);
    const removeOrphans = await p.confirm({
      message: isPt ? 'Remover esses arquivos?' : 'Remove these files?',
      initialValue: true,
    });
    if (p.isCancel(removeOrphans)) {
      p.outro(msg(config.lang).cancelled);
      return false;
    }
    if (removeOrphans) {
      removeLegacyOrphans(basePath, safeOrphans);
      p.log.success(isPt ? `${safeOrphans.length} arquivo(s) órfão(s) removido(s).` : `Removed ${safeOrphans.length} orphan file(s).`);
    }
  }
  if (unsafeOrphans.length > 0) {
    p.log.warn(isPt
      ? `${unsafeOrphans.length} arquivo(s) preservado(s) em caminhos antigos (sem assinatura atomic-skills no frontmatter):`
      : `Preserved ${unsafeOrphans.length} file(s) at legacy path(s) without atomic-skills frontmatter signature:`);
    for (const o of unsafeOrphans) p.log.message(`  ${pc.dim('-')} ${relative(basePath, o.path)}`);
    p.log.message(isPt
      ? `  ${pc.dim('Inspecione e remova manualmente se for o caso.')}`
      : `  ${pc.dim('Inspect and remove manually if intended.')}`);
  }
  return true;
}

/** Force IDE selection when detection found none; false on cancel. */
async function ensureInteractiveIdes(config) {
  if (config.ides.length === 0) {
    p.log.warn(msg(config.lang).noIDEsDetected);
    config.ides = await promptIDESelection(config.lang, []);
    if (config.ides.length === 0) {
      p.outro(msg(config.lang).cancelled);
      return false;
    }
    config.ides = normalizeIDESelection(config.ides);
  }
  return true;
}

/** Show the config and run the customize/install/quit action loop. */
async function chooseInteractiveAction(config, isUpdate) {
  let action;
  do {
    printConfig(config, 0);
    action = await promptAction(config.lang, { isUpdate, hasConflicts: false });
    if (action === 'customize-lang') {
      config.lang = await promptLanguageSelection(config.lang);
      config.languageDetected = false;
    } else if (action === 'customize-ides') {
      config.ides = await promptIDESelection(config.lang, config.ides);
      config.ides = normalizeIDESelection(config.ides);
    }
  } while (action !== 'install' && action !== 'quit');
  return action;
}

/** Ask the global-instructions question; `cancelled` aborts the install. */
async function resolveInteractiveGlobalInstructions({ config, basePath, scope, requested }) {
  if (scope !== 'user' || requested !== undefined) return { cancelled: false, value: requested };
  const paths = config.ides.map(agent => GLOBAL_INSTRUCTION_PATHS[agent]).filter(Boolean);
  p.log.message(`${DELEGATE_MARKERS.begin}\n${globalInstructionBody(config.lang)}\n${DELEGATE_MARKERS.end}`);
  p.log.message(msg(config.lang).globalInstructionsFiles(paths.map(path => join(basePath, path)).join(', ')));
  const installedPaths = installedGlobalInstructionPaths(basePath);
  const confirmed = await p.confirm({
    message: msg(config.lang).globalInstructionsPrompt,
    initialValue: globalInstructionsDecision(installedPaths).enabled,
  });
  const decision = globalInstructionsDecision(installedPaths, confirmed);
  if (decision.cancelled) {
    p.outro(msg(config.lang).cancelled);
    return { cancelled: true, value: undefined };
  }
  return { cancelled: false, value: decision.enabled };
}

/** Interactive (dashboard) install. */
async function runInteractiveInstall(context) {
  const config = buildInteractiveConfig(context);
  showIntro(config, { isUpdate: context.isUpdate, pkgVersion: context.pkgVersion });
  // Surface legacy-namespace orphans and prompt for cleanup before the action loop.
  const orphansReviewed = await reviewLegacyOrphansInteractive({
    config, basePath: context.basePath, safeOrphans: context.safeOrphans, unsafeOrphans: context.unsafeOrphans,
  });
  if (!orphansReviewed) return;
  if (!await ensureInteractiveIdes(config)) return;
  const action = await chooseInteractiveAction(config, context.isUpdate);
  if (action === 'quit') {
    p.outro(msg(config.lang).cancelled);
    return;
  }
  // Never unlink writtenFiles on SIGINT: onFileWritten only fires after
  // installSkills fully completes; --repair handles an incomplete journal.
  const global = await resolveInteractiveGlobalInstructions({
    config, basePath: context.basePath, scope: context.scope, requested: context.options.globalInstructions,
  });
  if (global.cancelled) return;
  const result = executeInstall(context, config.lang, config.ides, global.value);
  showPostInstall(result, config.ides, config.lang, context.isFirstInstall);
}

export async function install(projectDir, options = {}) {
  const settings = parseInstallOptions(options);
  const userBasePath = homedir();
  const projectTarget = resolveProjectScopeTarget(projectDir);
  if (settings.project && !projectTarget.ok) {
    console.error(`  ${pc.red('Error:')} ${projectTarget.reason}`);
    process.exit(1);
  }

  // C-codex-1: corrupt/incomplete JSON must not throw before --repair routing.
  const userManifest = readManifestOrNull(userBasePath);
  const projectManifest = projectTarget.ok ? readManifestOrNull(projectTarget.path) : null;
  const initialLanguage = resolveInitialLanguage(settings.cliLang, userManifest, projectManifest);
  // P0-A: --repair routes by incomplete presence across both scopes.
  if (settings.repair) {
    runRepairMode({ projectDir, project: settings.project, projectTarget });
    return;
  }

  const scope = await resolveInstallScope({
    ...settings, initialLanguage, projectTarget, projectManifest, userManifest,
  });
  if (scope === 'project' && !projectTarget.ok) {
    console.error(`  ${pc.red('Error:')} ${projectTarget.reason}`);
    process.exit(1);
  }
  const basePath = scope === 'project' ? projectTarget.path : userBasePath;
  assertNoIncompleteTransaction(basePath);

  const existingManifest = readManifestOrNull(basePath);
  const isFirstInstall = !existingManifest;
  const isUpdate = !!existingManifest;
  const pkgVersion = getPackageVersion();
  const skillsDir = join(PACKAGE_ROOT, 'skills');
  const metaDir = join(PACKAGE_ROOT, 'meta');
  // Adopt a pre-kernel legacy install before the Driver runs (T-F3-6).
  migrateLegacyInstall(basePath, MANIFEST_DIR);

  // Build initial config: CLI overrides > manifest > auto-detection > defaults.
  const language = resolveInstallLanguage(settings.cliLang, existingManifest, initialLanguage);
  const languageDetected = !settings.cliLang && !existingManifest?.language;
  const ides = normalizeIDESelection(resolveInstallIdes({
    allDetected: settings.allDetected, cliIDEs: settings.cliIDEs, existingManifest, basePath,
  }));
  validateCLIIDEs(settings.cliIDEs);
  warnLegacyCustomMemoryPath(existingManifest, language);

  // Legacy-namespace cleanup runs in both modes before the main install.
  const { safeOrphans, unsafeOrphans } = findInstallOrphans(basePath, metaDir);
  const context = {
    basePath, projectDir, language, languageDetected, ides, existingManifest, pkgVersion,
    skillsDir, metaDir, scope, settings, options, project: settings.project, projectTarget,
    safeOrphans, unsafeOrphans, isFirstInstall, isUpdate,
  };

  if (settings.yes) {
    runNonInteractiveInstall(context);
    return;
  }
  await runInteractiveInstall(context);
}
