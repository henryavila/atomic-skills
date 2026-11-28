/**
 * Read-only observation of the shared runtime registry and package-root
 * (F2/T-004). Never mutates registry, runtime slots, or package-root.
 *
 * Supports:
 * - legacy installs.json: string[] of basePath
 * - versioned installs.json: { schemaVersion, owners: [{ basePath, packageRoot, version, fingerprint }] }
 * - corruption: invalid JSON is reported, never reduced to an empty owner list
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { readManifest } from './manifest.js';

export const REGISTRY_REL = join('.atomic-skills', 'installs.json');
export const PACKAGE_ROOT_REL = join('.atomic-skills', 'package-root');

/**
 * @typedef {{
 *   basePath: string,
 *   packageRoot?: string|null,
 *   version?: string|null,
 *   fingerprint?: string|null,
 *   electable?: boolean,
 * }} RuntimeOwner
 */

/**
 * @typedef {{
 *   format: 'absent'|'legacy'|'versioned'|'corrupt',
 *   owners: RuntimeOwner[],
 *   corruption: string|null,
 *   schemaVersion: string|null,
 * }} RegistryParse
 */

/**
 * @typedef {{
 *   format: string,
 *   owners: RuntimeOwner[],
 *   ghosts: string[],
 *   corruption: string|null,
 *   schemaVersion: string|null,
 *   selectedOwner: RuntimeOwner|null,
 *   packageRootOnDisk: string|null,
 *   runtimeMismatch: string|null,
 *   writes: 0,
 * }} RuntimeObservation
 */

/** @returns {RegistryParse} */
function absentRegistry() {
  return { format: 'absent', owners: [], corruption: null, schemaVersion: null };
}

/**
 * @param {string} corruption
 * @param {string|null} schemaVersion
 * @returns {RegistryParse}
 */
function corruptRegistry(corruption, schemaVersion) {
  return { format: 'corrupt', owners: [], corruption, schemaVersion };
}

/** @returns {RegistryParse} */
function parseLegacyRegistry(entries) {
  if (!entries.every((x) => typeof x === 'string')) {
    return corruptRegistry('legacy registry entries must be strings', null);
  }
  return {
    format: 'legacy',
    owners: entries.map((basePath) => ({
      basePath,
      packageRoot: null,
      version: null,
      fingerprint: null,
      electable: false,
    })),
    corruption: null,
    schemaVersion: null,
  };
}

/** @returns {RuntimeOwner|null} */
function toVersionedOwner(entry) {
  if (!entry || typeof entry !== 'object' || typeof entry.basePath !== 'string') {
    return null;
  }
  const packageRoot = entry.packageRoot ?? null;
  const electable = entry.electable === false
    ? false
    : Boolean(packageRoot);
  return {
    basePath: entry.basePath,
    packageRoot,
    version: entry.version ?? null,
    fingerprint: entry.fingerprint ?? null,
    electable,
  };
}

/** @returns {RegistryParse} */
function parseVersionedRegistry(parsed) {
  const schemaVersion = parsed.schemaVersion != null
    ? String(parsed.schemaVersion)
    : null;
  if (!Array.isArray(parsed.owners)) {
    return corruptRegistry('versioned registry missing owners[]', schemaVersion);
  }
  const owners = [];
  for (const [i, entry] of parsed.owners.entries()) {
    const owner = toVersionedOwner(entry);
    if (!owner) {
      return corruptRegistry(`owners[${i}] missing basePath`, schemaVersion);
    }
    owners.push(owner);
  }
  return {
    format: 'versioned',
    owners,
    corruption: null,
    schemaVersion: schemaVersion || '1',
  };
}

/**
 * Parse registry content without mutating disk.
 * @param {string|null|undefined} raw
 * @returns {{
 *   format: 'absent'|'legacy'|'versioned'|'corrupt',
 *   owners: RuntimeOwner[],
 *   corruption: string|null,
 *   schemaVersion: string|null,
 * }}
 */
export function parseInstallsRegistry(raw) {
  if (raw == null || raw === '') return absentRegistry();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return corruptRegistry(`invalid JSON: ${err.message}`, null);
  }

  if (Array.isArray(parsed)) return parseLegacyRegistry(parsed);
  if (parsed && typeof parsed === 'object') return parseVersionedRegistry(parsed);
  return corruptRegistry('registry root must be array or object', null);
}

/**
 * Select the owner that F1-style election would use: match package-root
 * fingerprint/path when available; otherwise last non-ghost owner.
 *
 * @param {RuntimeOwner[]} owners
 * @param {{ packageRootOnDisk?: string|null, ghosts?: string[] }} [ctx]
 * @returns {RuntimeOwner|null}
 */
export function selectRuntimeOwner(owners, ctx = {}) {
  const ghosts = new Set(ctx.ghosts || []);
  // P1-B: skip non-electable / null-packageRoot owners for restage election.
  // Ghosts and electable:false never become restage sources.
  const live = owners.filter(
    (o) => !ghosts.has(o.basePath) && o.electable !== false,
  );
  // Fall back to any non-ghost if no electable owner exists (observe-only).
  const pool = live.length > 0
    ? live
    : owners.filter((o) => !ghosts.has(o.basePath));
  if (pool.length === 0) return null;

  const onDisk = ctx.packageRootOnDisk;
  if (onDisk) {
    const byRoot = pool.find((o) => o.packageRoot && o.packageRoot === onDisk);
    if (byRoot) return byRoot;
    const byFp = pool.find(
      (o) => o.fingerprint && (o.fingerprint === onDisk || onDisk.includes(o.fingerprint)),
    );
    if (byFp) return byFp;
  }
  // Surviving owner: last live electable entry (last-writer-wins election surface)
  return pool[pool.length - 1];
}

/**
 * Classify ghost owners (basePath missing or without manifest).
 * @param {RuntimeOwner[]} owners
 * @param {{ existsFn?: (p: string) => boolean, readManifestFn?: (p: string) => object|null }} [io]
 * @returns {string[]} ghost basePaths
 */
export function findGhostOwners(owners, io = {}) {
  const existsFn = io.existsFn || existsSync;
  const readManifestFn = io.readManifestFn || readManifest;
  const ghosts = [];
  for (const o of owners) {
    if (!existsFn(o.basePath)) {
      ghosts.push(o.basePath);
      continue;
    }
    try {
      const m = readManifestFn(o.basePath);
      if (!m) ghosts.push(o.basePath);
    } catch {
      ghosts.push(o.basePath);
    }
  }
  return ghosts;
}

function readRegistryText(registryPath, injectedRaw) {
  if (injectedRaw !== undefined) return { raw: injectedRaw, error: null };
  if (!existsSync(registryPath)) return { raw: null, error: null };
  try {
    return { raw: readFileSync(registryPath, 'utf8'), error: null };
  } catch (err) {
    return { raw: null, error: err.message };
  }
}

function resolvePackageRootOnDisk(packageRootPath, opts) {
  if (!packageRootFileIsUnset(opts)) return opts.packageRootFile;
  if (!existsSync(packageRootPath)) return null;
  try {
    return readFileSync(packageRootPath, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

/**
 * @param {{ format: string, corruption: string|null, schemaVersion: string|null }} parsed
 * @param {string|null} packageRootOnDisk
 * @returns {RuntimeObservation}
 */
function corruptObservation(parsed, packageRootOnDisk) {
  return {
    format: parsed.format,
    owners: [],
    ghosts: [],
    corruption: parsed.corruption,
    schemaVersion: parsed.schemaVersion,
    selectedOwner: null,
    packageRootOnDisk,
    runtimeMismatch: null,
    writes: 0,
  };
}

function packageRootExists(packageRootOnDisk, opts) {
  const existsFn = opts.existsFn || existsSync;
  return existsFn(packageRootOnDisk);
}

function selectedOwnerMismatch(packageRootOnDisk, selectedOwner) {
  if (!packageRootOnDisk || !selectedOwner?.packageRoot) return null;
  if (packageRootOnDisk === selectedOwner.packageRoot) return null;
  return `package-root (${packageRootOnDisk}) != selected owner packageRoot (${selectedOwner.packageRoot})`;
}

function processPackageMismatch(packageRootOnDisk, selectedOwner, opts) {
  if (!opts.packageRoot || !packageRootOnDisk) return null;
  if (packageRootOnDisk === opts.packageRoot) return null;
  if (!selectedOwner?.packageRoot) return null;
  if (selectedOwner.packageRoot === packageRootOnDisk) return null;
  return `package-root points at ${packageRootOnDisk}; process package is ${opts.packageRoot}`;
}

function missingPackageRootMismatch(packageRootOnDisk, selectedOwner) {
  if (packageRootOnDisk || !selectedOwner?.packageRoot) return null;
  return 'package-root missing while selected owner declares packageRoot';
}

function missingPathMismatch(packageRootOnDisk, opts) {
  if (!packageRootOnDisk) return null;
  if (packageRootExists(packageRootOnDisk, opts)) return null;
  return `package-root path does not exist: ${packageRootOnDisk}`;
}

function computeRuntimeMismatch(packageRootOnDisk, selectedOwner, opts) {
  return selectedOwnerMismatch(packageRootOnDisk, selectedOwner)
    || processPackageMismatch(packageRootOnDisk, selectedOwner, opts)
    || missingPackageRootMismatch(packageRootOnDisk, selectedOwner)
    || missingPathMismatch(packageRootOnDisk, opts);
}

/**
 * Observe shared runtime registry + package-root (read-only).
 *
 * @param {object} [opts]
 * @param {string} [opts.homeDir]
 * @param {string} [opts.packageRoot] - current process package root (for mismatch)
 * @param {string} [opts.registryRaw] - inject raw registry text (tests)
 * @param {string|null} [opts.packageRootFile] - inject package-root file contents
 * @param {(p: string) => boolean} [opts.existsFn]
 * @param {(p: string) => object|null} [opts.readManifestFn]
 * @returns {RuntimeObservation}
 */
export function observeRuntimeRegistry(opts = {}) {
  const home = opts.homeDir || homedir();
  const registryPath = join(home, REGISTRY_REL);
  const packageRootPath = join(home, PACKAGE_ROOT_REL);

  const registry = readRegistryText(registryPath, opts.registryRaw);
  if (registry.error) {
    return corruptObservation({
      format: 'corrupt',
      corruption: `unreadable registry: ${registry.error}`,
      schemaVersion: null,
    }, null);
  }

  const parsed = parseInstallsRegistry(registry.raw);
  const packageRootOnDisk = resolvePackageRootOnDisk(packageRootPath, opts);
  if (parsed.corruption) return corruptObservation(parsed, packageRootOnDisk);

  const ghosts = findGhostOwners(parsed.owners, {
    existsFn: opts.existsFn,
    readManifestFn: opts.readManifestFn,
  });

  const selectedOwner = selectRuntimeOwner(parsed.owners, {
    packageRootOnDisk,
    ghosts,
  });

  const runtimeMismatch = computeRuntimeMismatch(packageRootOnDisk, selectedOwner, opts);

  return {
    format: parsed.format,
    owners: parsed.owners,
    ghosts,
    corruption: null,
    schemaVersion: parsed.schemaVersion,
    selectedOwner,
    packageRootOnDisk,
    runtimeMismatch,
    writes: 0,
  };
}

function packageRootFileIsUnset(opts) {
  return !Object.prototype.hasOwnProperty.call(opts, 'packageRootFile');
}
