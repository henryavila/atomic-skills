import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { MANIFEST_DIR } from '../manifest.js';
import { normalizeInstallBase } from './install-base.js';

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
  return parseInstallsRegistry(readRegistryText(filePath));
}

/**
 * @param {string} filePath
 * @returns {string}
 */
function readRegistryText(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch (err) {
    throw registryScanError('REGISTRY_IO', `installs registry unreadable: ${err.message}`);
  }
}

/**
 * @param {string} rawText
 * @returns {{ format: 'empty'|'legacy-array'|'versioned', list: string[] }}
 */
function parseInstallsRegistry(rawText) {
  const v = parseRegistryJson(rawText);
  if (Array.isArray(v)) {
    return { format: 'legacy-array', list: v.filter(isInstallBase) };
  }
  const record = /** @type {{ owners?: unknown[] } | null} */ (
    v && typeof v === 'object' ? v : null
  );
  const owners = Array.isArray(record?.owners)
    ? record.owners.map(ownerBasePath).filter(isInstallBase)
    : null;
  if (owners) {
    return { format: 'versioned', list: /** @type {string[]} */ (owners) };
  }
  throw registryScanError('REGISTRY_UNKNOWN', 'installs registry unknown format');
}

/**
 * @param {string} rawText
 * @returns {unknown}
 */
function parseRegistryJson(rawText) {
  try {
    return JSON.parse(rawText);
  } catch (err) {
    throw registryScanError('REGISTRY_CORRUPT', `installs registry corrupt JSON: ${err.message}`);
  }
}

/**
 * @param {unknown} owner
 * @returns {unknown}
 */
function ownerBasePath(owner) {
  const record = /** @type {{ basePath?: unknown } | null} */ (
    owner && typeof owner === 'object' ? owner : null
  );
  return typeof owner === 'string' ? owner : record?.basePath;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isInstallBase(value) {
  return typeof value === 'string' && value.length > 0;
}

/**
 * @param {string} code
 * @param {string} message
 * @returns {Error & { code: string }}
 */
function registryScanError(code, message) {
  return Object.assign(new Error(message), { code });
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
    throw registryScanError(
      'REGISTRY_UNTRUSTED',
      scan.detail || 'installs registry untrusted',
    );
  }
  return scan.bases;
}
