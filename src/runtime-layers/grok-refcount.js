import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { readManifest, MANIFEST_DIR } from '../manifest.js';
import {
  registerGrokPluginHost,
  unregisterGrokPluginHost,
  wantsGrokPluginHost,
  resolveGrokPluginPackagePath,
  GROK_PLUGIN_PACKAGE_REL,
} from './grok-plugin-host.js';
import { revertGrokAgentsIsolation } from './grok-agents-isolation.js';

/**
 * Shared multi-owner scan for outside-journal Grok state (host plugin registry
 * + foreign-skills isolation). F-003 / P0-C: host unregister must use the same
 * surviving-owner contract as isolation revert.
 *
 * P0-C remediations:
 * - Fail-closed on corrupt/unknown installs.json (never shrink to home-only then unregister)
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

/**
 * True when this install base still owns (or residual-owns) outside-journal Grok
 * state that uninstall must consider for host/isolation release.
 *
 * - manifest.ides includes `grok`, OR
 * - durable residual: Grok plugin package tree still present under this base
 *   (after shrink dropped grok from ides but journal reverse has not run yet)
 *
 * @param {string} basePath
 * @param {object | null | undefined} [manifest]
 * @returns {boolean}
 */
export function baseHasGrokResidual(basePath, manifest) {
  if (wantsGrokPluginHost(manifest?.ides)) return true;
  const pkg = resolveGrokPluginPackagePath(basePath);
  // Durable residual after shrink: package tree (plugin.json or directory) still on disk.
  if (existsSync(join(pkg, 'plugin.json'))) return true;
  if (existsSync(pkg)) return true;
  return false;
}

/**
 * True when some install base other than `basePath` still lists `grok` in ides.
 *
 * @param {object} opts
 * @param {string} opts.basePath - install that is leaving / shrinking away from grok
 * @param {() => string[]} [opts.listInstallBases]
 * @param {(dir: string) => object | null} [opts.readManifestFor]
 * @returns {boolean}
 */
export function hasOtherGrokOwner(opts) {
  return findOtherGrokOwner(opts) != null;
}

/**
 * First other install base that still wants Grok, or null.
 *
 * @param {object} opts
 * @param {string} opts.basePath
 * @param {() => string[]} opts.listInstallBases
 * @param {(dir: string) => object | null} [opts.readManifestFor]
 * @returns {string | null}
 */
export function findOtherGrokOwner(opts) {
  const {
    basePath,
    listInstallBases,
    readManifestFor = readManifest,
  } = opts;
  if (typeof listInstallBases !== 'function') {
    throw new Error('findOtherGrokOwner: listInstallBases is required');
  }
  const self = normalizeInstallBase(basePath);
  const others = listInstallBases().filter((p) => normalizeInstallBase(p) !== self);
  for (const other of others) {
    if (wantsGrokPluginHost(readManifestFor(other)?.ides)) return other;
  }
  return null;
}

/** Restage outcomes that leave a usable host registration for a survivor. */
const RESTAGE_SUCCESS = new Set(['registered', 'updated', 'already']);

/**
 * Outside-journal Grok release for shrink-away-from-grok or uninstall.
 *
 * - **Last owner:** unregister host plugin + revert isolation.
 * - **Survivors remain:** keep host + isolation; optionally restage host
 *   registration from a survivor's package (non-destructive: never uninstall
 *   then fail-reinstall on the keep path).
 * - **Untrusted registry:** skip all host/isolation mutations (fail-closed).
 *
 * Intentionally does **not** gate on the departing base's current `ides`
 * (residual after shrink must be cleanable when no grok owners remain).
 * Callers that must avoid host CLI on never-had-grok bases should gate with
 * `baseHasGrokResidual` before calling.
 *
 * @param {object} opts
 * @param {string} opts.basePath
 * @param {string} [opts.home]
 * @param {() => string[]} [opts.listInstallBases]
 * @param {(dir: string) => object | null} [opts.readManifestFor]
 * @param {import('./grok-plugin-host.js').HostRunner} [opts.run]
 * @param {() => string | null} [opts.resolveBin]
 * @param {NodeJS.ProcessEnv} [opts.env]
 * @param {boolean} [opts.restageSurvivor=true]
 * @returns {{
 *   lastOwner: boolean,
 *   host: { status: string, detail?: string, restage?: string },
 *   isolation: { status: string, detail?: string },
 * }}
 */
export function releaseGrokOutsideJournal(opts) {
  const {
    basePath,
    home = process.env.HOME || homedir(),
    listInstallBases,
    readManifestFor = readManifest,
    run,
    resolveBin,
    env = process.env,
    restageSurvivor = true,
  } = opts;

  /** @type {() => string[]} */
  let basesFn;
  if (typeof listInstallBases === 'function') {
    basesFn = listInstallBases;
  } else {
    const scan = scanKnownInstallBases(home);
    if (scan.status === 'untrusted') {
      return {
        lastOwner: false,
        host: { status: 'skipped', detail: 'registry-untrusted' },
        isolation: { status: 'skipped', detail: 'registry-untrusted' },
      };
    }
    basesFn = () => scan.bases;
  }

  const survivor = findOtherGrokOwner({
    basePath,
    listInstallBases: basesFn,
    readManifestFor,
  });

  if (survivor) {
    /** @type {{ status: string, detail?: string, restage?: string }} */
    let host = { status: 'kept', detail: `still required by ${survivor}` };
    if (restageSurvivor) {
      const regOpts = {
        basePath: survivor,
        ides: ['grok'],
        env,
        // Keep path must not uninstall-then-fail-reinstall (Codex F-002).
        nonDestructive: true,
      };
      if (run) regOpts.run = run;
      if (resolveBin) regOpts.resolveBin = resolveBin;
      const reg = registerGrokPluginHost(regOpts);
      const usablePkg = existsSync(
        join(resolveGrokPluginPackagePath(survivor), 'plugin.json'),
      );
      const restageOk = RESTAGE_SUCCESS.has(reg.status) && (
        reg.status !== 'already' || usablePkg
      );
      // `skipped` (no binary / host bridge disabled) is not a mutation failure —
      // host state was not destroyed. Missing package / failed install is failed.
      if (reg.status === 'skipped') {
        host = {
          status: 'kept',
          detail: reg.detail || host.detail,
          restage: reg.status,
        };
      } else if (restageOk) {
        host = {
          status: 'kept',
          detail: reg.detail || host.detail,
          restage: reg.status,
        };
      } else {
        host = {
          status: 'failed',
          detail: reg.detail || 'survivor restage failed',
          restage: reg.status,
        };
      }
    }
    return {
      lastOwner: false,
      host,
      isolation: { status: 'kept', detail: `still required by ${survivor}` },
    };
  }

  // Last owner (or residual with no remaining grok owners): full cleanup.
  // Omit `ides` so unregister / revert do not skip when the departing
  // manifest already dropped grok (shrink residual path).
  const unregOpts = { env };
  if (run) unregOpts.run = run;
  if (resolveBin) unregOpts.resolveBin = resolveBin;
  const host = unregisterGrokPluginHost(unregOpts);

  const isolation = revertGrokAgentsIsolation({
    basePath,
    home,
    listInstallBases: basesFn,
    // Force reverse of managed ignore entries — do not pass ides that would
    // skip when residual after shrink left ides without grok.
  });

  return { lastOwner: true, host, isolation };
}

// Re-export package rel for residual checks / tests without a second import.
export { GROK_PLUGIN_PACKAGE_REL };
