/**
 * Hash-based install verification (F2/T-003).
 *
 * Compares every manifest file path (skills, assets, hooks) against disk and
 * optional package-desired content. Never infers up-to-date from semver alone.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hashContent } from './hash.js';

/**
 * @param {object} input
 * @param {boolean} input.exists
 * @param {string|null} input.diskHash
 * @param {string|null|undefined} input.installedHash
 * @param {string|null|undefined} input.desiredHash
 * @param {boolean} [input.asConflict]
 * @returns {'missing'|'unchanged'|'stale'|'modified'|'preserved'|'conflict'|'updated'}
 */
export function classifyFileState({
  exists,
  diskHash,
  installedHash,
  desiredHash = null,
  asConflict = false,
}) {
  if (!exists) return 'missing';

  const hasDesired = typeof desiredHash === 'string' && desiredHash.length > 0;
  const hasInstalled = typeof installedHash === 'string' && installedHash.length > 0;

  if (hasDesired && diskHash === desiredHash) {
    if (hasInstalled && diskHash !== installedHash) return 'updated';
    return 'unchanged';
  }

  if (hasInstalled && diskHash === installedHash) {
    if (hasDesired && desiredHash !== installedHash) return 'stale';
    return 'unchanged';
  }

  // disk differs from installed
  if (hasDesired && diskHash !== desiredHash) {
    return asConflict ? 'conflict' : 'preserved';
  }
  if (hasDesired && diskHash === desiredHash) return 'updated';
  return 'modified';
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

  const filesMap = manifest?.files && typeof manifest.files === 'object'
    ? manifest.files
    : {};

  const files = [];
  for (const [rel, meta] of Object.entries(filesMap)) {
    const abs = join(basePath, rel);
    const onDisk = existsSync(abs);
    let diskHash = null;
    if (onDisk) {
      try {
        diskHash = hashContent(readFileSync(abs));
      } catch {
        diskHash = null;
      }
    }
    const installedHash = meta?.installed_hash ?? meta?.installedHash ?? null;
    const desiredHash = desiredByPath && Object.prototype.hasOwnProperty.call(desiredByPath, rel)
      ? desiredByPath[rel]
      : null;

    const state = classifyFileState({
      exists: onDisk && diskHash != null,
      diskHash,
      installedHash,
      desiredHash,
      asConflict: preservedAsConflict,
    });

    files.push({
      path: rel,
      state,
      installedHash,
      diskHash,
      desiredHash,
      source: meta?.source,
    });
  }

  const counts = summarizeVerification({ files });
  const drifted = files.some((f) => f.state !== 'unchanged' && f.state !== 'updated');
  const versionMatch = packageVersion != null && manifest?.version != null
    ? manifest.version === packageVersion
    : null;

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
  const out = {};
  for (const f of report.files || []) {
    if (!out[f.state]) out[f.state] = [];
    out[f.state].push(f.path);
  }
  return out;
}
