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
 * }} RuntimeOwner
 */

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
  if (raw == null || raw === '') {
    return { format: 'absent', owners: [], corruption: null, schemaVersion: null };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      format: 'corrupt',
      owners: [],
      corruption: `invalid JSON: ${err.message}`,
      schemaVersion: null,
    };
  }

  if (Array.isArray(parsed)) {
    // legacy: list of basePath strings
    if (!parsed.every((x) => typeof x === 'string')) {
      return {
        format: 'corrupt',
        owners: [],
        corruption: 'legacy registry entries must be strings',
        schemaVersion: null,
      };
    }
    return {
      format: 'legacy',
      owners: parsed.map((basePath) => ({
        basePath,
        packageRoot: null,
        version: null,
        fingerprint: null,
      })),
      corruption: null,
      schemaVersion: null,
    };
  }

  if (parsed && typeof parsed === 'object') {
    const schemaVersion = parsed.schemaVersion != null
      ? String(parsed.schemaVersion)
      : null;
    if (!Array.isArray(parsed.owners)) {
      return {
        format: 'corrupt',
        owners: [],
        corruption: 'versioned registry missing owners[]',
        schemaVersion,
      };
    }
    const owners = [];
    for (const [i, o] of parsed.owners.entries()) {
      if (!o || typeof o !== 'object' || typeof o.basePath !== 'string') {
        return {
          format: 'corrupt',
          owners: [],
          corruption: `owners[${i}] missing basePath`,
          schemaVersion,
        };
      }
      owners.push({
        basePath: o.basePath,
        packageRoot: o.packageRoot ?? null,
        version: o.version ?? null,
        fingerprint: o.fingerprint ?? null,
      });
    }
    return {
      format: 'versioned',
      owners,
      corruption: null,
      schemaVersion: schemaVersion || '1',
    };
  }

  return {
    format: 'corrupt',
    owners: [],
    corruption: 'registry root must be array or object',
    schemaVersion: null,
  };
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
  const live = owners.filter((o) => !ghosts.has(o.basePath));
  if (live.length === 0) return null;

  const onDisk = ctx.packageRootOnDisk;
  if (onDisk) {
    const byRoot = live.find((o) => o.packageRoot && o.packageRoot === onDisk);
    if (byRoot) return byRoot;
    const byFp = live.find(
      (o) => o.fingerprint && (o.fingerprint === onDisk || onDisk.includes(o.fingerprint)),
    );
    if (byFp) return byFp;
  }
  // Surviving owner: last live entry (last-writer-wins election surface)
  return live[live.length - 1];
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
 * @returns {{
 *   format: string,
 *   owners: RuntimeOwner[],
 *   ghosts: string[],
 *   corruption: string|null,
 *   schemaVersion: string|null,
 *   selectedOwner: RuntimeOwner|null,
 *   packageRootOnDisk: string|null,
 *   runtimeMismatch: string|null,
 *   writes: 0,
 * }}
 */
export function observeRuntimeRegistry(opts = {}) {
  const home = opts.homeDir || homedir();
  const registryPath = join(home, REGISTRY_REL);
  const packageRootPath = join(home, PACKAGE_ROOT_REL);

  let raw = opts.registryRaw;
  if (raw === undefined) {
    if (existsSync(registryPath)) {
      try {
        raw = readFileSync(registryPath, 'utf8');
      } catch (err) {
        raw = null;
        return {
          format: 'corrupt',
          owners: [],
          ghosts: [],
          corruption: `unreadable registry: ${err.message}`,
          schemaVersion: null,
          selectedOwner: null,
          packageRootOnDisk: null,
          runtimeMismatch: null,
          writes: 0,
        };
      }
    } else {
      raw = null;
    }
  }

  const parsed = parseInstallsRegistry(raw);

  let packageRootOnDisk = opts.packageRootFile;
  if (packageRootFileIsUnset(opts)) {
    if (existsSync(packageRootPath)) {
      try {
        packageRootOnDisk = readFileSync(packageRootPath, 'utf8').trim() || null;
      } catch {
        packageRootOnDisk = null;
      }
    } else {
      packageRootOnDisk = null;
    }
  }

  if (parsed.corruption) {
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

  const ghosts = findGhostOwners(parsed.owners, {
    existsFn: opts.existsFn,
    readManifestFn: opts.readManifestFn,
  });

  const selectedOwner = selectRuntimeOwner(parsed.owners, {
    packageRootOnDisk,
    ghosts,
  });

  let runtimeMismatch = null;
  if (packageRootOnDisk && selectedOwner?.packageRoot) {
    if (packageRootOnDisk !== selectedOwner.packageRoot) {
      runtimeMismatch = `package-root (${packageRootOnDisk}) != selected owner packageRoot (${selectedOwner.packageRoot})`;
    }
  }
  if (!runtimeMismatch && opts.packageRoot && packageRootOnDisk) {
    if (packageRootOnDisk !== opts.packageRoot && selectedOwner?.packageRoot
      && selectedOwner.packageRoot !== packageRootOnDisk) {
      runtimeMismatch = `package-root points at ${packageRootOnDisk}; process package is ${opts.packageRoot}`;
    }
  }
  // Explicit mismatch when package-root is missing but owners claim a packageRoot
  if (!runtimeMismatch && !packageRootOnDisk && selectedOwner?.packageRoot) {
    runtimeMismatch = 'package-root missing while selected owner declares packageRoot';
  }
  // package-root points at nonexistent path
  if (!runtimeMismatch && packageRootOnDisk && opts.existsFn) {
    if (!opts.existsFn(packageRootOnDisk)) {
      runtimeMismatch = `package-root path does not exist: ${packageRootOnDisk}`;
    }
  } else if (!runtimeMismatch && packageRootOnDisk && !opts.existsFn) {
    if (!existsSync(packageRootOnDisk)) {
      runtimeMismatch = `package-root path does not exist: ${packageRootOnDisk}`;
    }
  }

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
