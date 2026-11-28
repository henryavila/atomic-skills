/**
 * Residual recovery ledger and raw-manifest quarantine.
 *
 * Split out of `recovery-cli.js`: these are the durable artifacts a recovery
 * leaves behind, independent of which recovery action produced them.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { atomicWriteJsonNoFollow } from '@henryavila/minimalist-installer';
import { MANIFEST_DIR } from './manifest.js';

export const RECOVERY_LEDGER_FILE = 'recovery-ledger.json';
export const RECOVERY_QUARANTINE_PREFIX = 'recovery-quarantine-manifest';

/**
 * @param {string} basePath
 * @returns {string}
 */
export function recoveryLedgerPath(basePath) {
  return join(basePath, MANIFEST_DIR, RECOVERY_LEDGER_FILE);
}

/**
 * Atomic residual ledger write (tmp+rename / no-follow) before clearing incomplete.
 * @param {string} basePath
 * @param {object} ledger
 */
export function writeRecoveryLedger(basePath, ledger) {
  const dir = join(basePath, MANIFEST_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  // Engine atomic write: same-dir temp + fsync + rename, no symlink follow.
  atomicWriteJsonNoFollow(basePath, `${MANIFEST_DIR}/${RECOVERY_LEDGER_FILE}`, ledger);
  return recoveryLedgerPath(basePath);
}

/**
 * @param {string} basePath
 * @returns {object|null}
 */
export function readRecoveryLedger(basePath) {
  const path = recoveryLedgerPath(basePath);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Quarantine raw incomplete manifest bytes before any unlink.
 * @param {string} basePath
 * @returns {{ ok: boolean, path?: string, relativePath?: string, error?: string, bytes?: number }}
 */
export function quarantineIncompleteManifest(basePath) {
  const manifestPath = join(basePath, MANIFEST_DIR, 'manifest.json');
  if (!existsSync(manifestPath)) {
    return { ok: false, error: 'manifest missing' };
  }
  const dir = join(basePath, MANIFEST_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rel = `${MANIFEST_DIR}/${RECOVERY_QUARANTINE_PREFIX}-${stamp}.raw`;
  const dest = join(basePath, MANIFEST_DIR, `${RECOVERY_QUARANTINE_PREFIX}-${stamp}.raw`);
  try {
    // Prefer byte-copy of raw file (may be invalid JSON).
    copyFileSync(manifestPath, dest);
    const bytes = readFileSync(dest).length;
    return { ok: true, path: dest, relativePath: rel, bytes };
  } catch (err) {
    // Fallback: try read+write if copy fails.
    try {
      const raw = readFileSync(manifestPath);
      writeFileSync(dest, raw);
      return { ok: true, path: dest, relativePath: rel, bytes: raw.length };
    } catch (err2) {
      return { ok: false, error: err2?.message || err?.message || String(err2) };
    }
  }
}
