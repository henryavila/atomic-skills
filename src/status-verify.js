/**
 * Hash-based install verification (F2/T-003).
 *
 * Compares every manifest file path (skills, assets, hooks) against disk and
 * optional package-desired content. Never infers up-to-date from semver alone.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hashContent } from './hash.js';

function hasHash(value) {
  return typeof value === 'string' && value.length > 0;
}

function classifyDesiredMatch(diskHash, hasInstalled, installedHash) {
  return hasInstalled && diskHash !== installedHash ? 'updated' : 'unchanged';
}

function classifyInstalledMatch(hasDesired, desiredHash, installedHash) {
  return hasDesired && desiredHash !== installedHash ? 'stale' : 'unchanged';
}

function classifyDrift(hasDesired, asConflict) {
  if (!hasDesired) return 'modified';
  return asConflict ? 'conflict' : 'preserved';
}

/**
 * @param {object} input
 * @param {boolean} input.exists
 * @param {string|null} input.diskHash
 * @param {string|null|undefined} input.installedHash
 * @param {string|null|undefined} input.desiredHash
 * @param {boolean} [input.asConflict]
 * @returns {'missing'|'unchanged'|'stale'|'modified'|'preserved'|'conflict'|'updated'}
 */
export function classifyFileState(input) {
  const {
    exists,
    diskHash,
    installedHash,
    desiredHash = null,
    asConflict = false,
  } = input;
  if (!exists) return 'missing';

  const hasDesired = hasHash(desiredHash);
  const hasInstalled = hasHash(installedHash);

  if (hasDesired && diskHash === desiredHash) {
    return classifyDesiredMatch(diskHash, hasInstalled, installedHash);
  }

  if (hasInstalled && diskHash === installedHash) {
    return classifyInstalledMatch(hasDesired, desiredHash, installedHash);
  }

  return classifyDrift(hasDesired, asConflict);
}

function manifestFiles(manifest) {
  return manifest?.files && typeof manifest.files === 'object'
    ? manifest.files
    : {};
}

function hashOnDisk(absPath) {
  if (!existsSync(absPath)) return { onDisk: false, diskHash: null };
  try {
    return { onDisk: true, diskHash: hashContent(readFileSync(absPath)) };
  } catch {
    return { onDisk: true, diskHash: null };
  }
}

function installedHashOf(meta) {
  return meta?.installed_hash ?? meta?.installedHash ?? null;
}

function desiredHashFor(desiredByPath, rel) {
  if (!desiredByPath || !Object.prototype.hasOwnProperty.call(desiredByPath, rel)) {
    return null;
  }
  return desiredByPath[rel];
}

function verifyManifestFile(basePath, rel, meta, opts) {
  const { onDisk, diskHash } = hashOnDisk(join(basePath, rel));
  const installedHash = installedHashOf(meta);
  const desiredHash = desiredHashFor(opts.desiredByPath, rel);
  const state = classifyFileState({
    exists: onDisk && diskHash != null,
    diskHash,
    installedHash,
    desiredHash,
    asConflict: opts.preservedAsConflict,
  });

  return {
    path: rel,
    state,
    installedHash,
    diskHash,
    desiredHash,
    source: meta?.source,
  };
}

function versionMatchOf(manifest, packageVersion) {
  if (packageVersion == null || manifest?.version == null) return null;
  return manifest.version === packageVersion;
}

/**
 * @param {string} basePath
 * @param {object} manifest - journal/compat manifest with files{} map
 * @param {object} [opts]
 * @param {Record<string, string>} [opts.desiredByPath] - sha256 of package-desired content
 * @param {boolean} [opts.preservedAsConflict] - label preserved as conflict (UX)
 * @param {string} [opts.packageVersion]
 * @returns {{
 *   files: Array<{ path: string, state: string, installedHash?: string, diskHash?: string|null, desiredHash?: string|null }>,
 *   upToDate: boolean,
 *   versionMatch: boolean|null,
 *   counts: Record<string, number>,
 * }}
 */
export function verifyInstall(basePath, manifest, opts = {}) {
  const {
    desiredByPath = null,
    preservedAsConflict = false,
    packageVersion = null,
  } = opts;

  const files = Object.entries(manifestFiles(manifest)).map(([rel, meta]) =>
    verifyManifestFile(basePath, rel, meta, { desiredByPath, preservedAsConflict }));

  const counts = summarizeVerification({ files });
  const drifted = files.some((f) => f.state !== 'unchanged' && f.state !== 'updated');
  const versionMatch = versionMatchOf(manifest, packageVersion);

  // up-to-date requires: no path drift AND (when known) version match
  const upToDate = !drifted && (versionMatch === null || versionMatch === true);

  return { files, upToDate, versionMatch, counts };
}

/**
 * @param {{ files: Array<{ state: string }> }} report
 * @returns {Record<string, number>}
 */
export function summarizeVerification(report) {
  const counts = {
    unchanged: 0,
    updated: 0,
    missing: 0,
    modified: 0,
    stale: 0,
    preserved: 0,
    conflict: 0,
    'runtime-mismatch': 0,
  };
  for (const f of report.files || []) {
    if (counts[f.state] !== undefined) counts[f.state] += 1;
  }
  return counts;
}

/**
 * Build a decisions map useful for install summaries.
 * @param {ReturnType<typeof verifyInstall>} report
 * @returns {Record<string, string[]>} state → paths
 */
export function decisionsByState(report) {
  /** @type {Record<string, string[]>} */
  const out = {};
  for (const f of report.files || []) {
    if (!out[f.state]) out[f.state] = [];
    out[f.state].push(f.path);
  }
  return out;
}
