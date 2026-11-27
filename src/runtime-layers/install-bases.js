import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { MANIFEST_DIR } from '../manifest.js';

/**
 * Shared install-base scan for outside-journal Grok state (host plugin registry
 * + foreign-skills isolation). Kept in its own module so both consumers depend
 * on the scan and neither has to import the other.
 *
 * P0-C contract:
 * - Fail-closed on corrupt/unknown installs.json (never shrink then unregister)
 * - Registry path always matches writers (`homedir()`)
 * - Install bases compared after resolve/realpath normalize
 */

/**
 * Absolute path of the cross-install registry — must match install.js writers.
 * Always `homedir()`, never a caller-supplied HOME override (F-4).
 * @returns {string}
 */
export function installsRegistryPathForScan() {
  return join(homedir(), MANIFEST_DIR, 'installs.json');
}

/**
 * Normalize an install base for identity compares.
 * resolve always; realpath when the path exists.
 * @param {string} basePath
 * @returns {string}
 */
export function normalizeInstallBase(basePath) {
  if (typeof basePath !== 'string' || basePath.length === 0) return basePath;
  const abs = resolve(basePath);
  try {
    if (existsSync(abs)) return realpathSync(abs);
  } catch {
    // dangling path / race — fall through to resolved absolute form
  }
  return abs;
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function sameInstallBase(a, b) {
  return normalizeInstallBase(a) === normalizeInstallBase(b);
}

/**
 * Fail-closed registry parse (mirrors install.js `readInstallsRegistry` contract
 * without importing install.js — avoids ESM cycle with install → refcount).
 *
 * @param {string} [filePath]
 * @returns {{ format: 'empty'|'legacy-array'|'versioned', list: string[] }}
 */
export function readInstallsRegistryForScan(filePath = installsRegistryPathForScan()) {
  if (!existsSync(filePath)) {
    return { format: 'empty', list: [] };
  }
  let rawText;
  try {
    rawText = readFileSync(filePath, 'utf8');
  } catch (err) {
    const e = new Error(`installs registry unreadable: ${err.message}`);
    e.code = 'REGISTRY_IO';
    throw e;
  }
  let v;
  try {
    v = JSON.parse(rawText);
  } catch (err) {
    const e = new Error(`installs registry corrupt JSON: ${err.message}`);
    e.code = 'REGISTRY_CORRUPT';
    throw e;
  }
  if (Array.isArray(v)) {
    const list = v.filter((x) => typeof x === 'string' && x.length > 0);
    return { format: 'legacy-array', list };
  }
  if (v && typeof v === 'object' && Array.isArray(v.owners)) {
    const list = v.owners
      .map((o) => (typeof o === 'string' ? o : o?.basePath))
      .filter((x) => typeof x === 'string' && x.length > 0);
    return { format: 'versioned', list };
  }
  const e = new Error('installs registry unknown format');
  e.code = 'REGISTRY_UNKNOWN';
  throw e;
}

/**
 * Scan known install bases with trust status.
 *
 * - **ok**: registry missing/empty/valid — bases = normalized home + registry entries
 * - **untrusted**: corrupt / unreadable / unknown shape — do NOT treat as no owners
 *
 * @param {string} [home] - known home base (isolation / display); registry file always via homedir()
 * @returns {{ status: 'ok'|'untrusted', bases: string[], detail?: string }}
 */
export function scanKnownInstallBases(home = homedir()) {
  const bases = new Set();
  bases.add(normalizeInstallBase(home));
  // Always include writer-home so user install is visible even when `home` is a test override.
  bases.add(normalizeInstallBase(homedir()));

  try {
    const { list } = readInstallsRegistryForScan(installsRegistryPathForScan());
    for (const p of list) bases.add(normalizeInstallBase(p));
    return { status: 'ok', bases: [...bases] };
  } catch (err) {
    if (
      err?.code === 'REGISTRY_CORRUPT'
      || err?.code === 'REGISTRY_UNKNOWN'
      || err?.code === 'REGISTRY_IO'
    ) {
      return {
        status: 'untrusted',
        bases: [],
        detail: err.message || 'registry-untrusted',
      };
    }
    return {
      status: 'untrusted',
      bases: [],
      detail: err?.message || 'registry-untrusted',
    };
  }
}

/**
 * Known install bases: user home + paths listed in ~/.atomic-skills/installs.json.
 * Throws on corrupt/unknown registry (fail-closed). Prefer `scanKnownInstallBases`
 * when the caller must handle untrusted without throwing.
 *
 * @param {string} [home]
 * @returns {string[]}
 */
export function listKnownInstallBases(home = homedir()) {
  const scan = scanKnownInstallBases(home);
  if (scan.status === 'untrusted') {
    const e = new Error(scan.detail || 'installs registry untrusted');
    e.code = 'REGISTRY_UNTRUSTED';
    throw e;
  }
  return scan.bases;
}
