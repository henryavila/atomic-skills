import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashContent } from './hash.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..');

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

export function getPackageVersion() {
  const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8'));
  return pkg.version;
}
