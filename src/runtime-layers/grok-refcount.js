import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { readManifest } from '../manifest.js';
import {
  registerGrokPluginHost,
  unregisterGrokPluginHost,
  wantsGrokPluginHost,
  resolveGrokPluginPackagePath,
  GROK_PLUGIN_PACKAGE_REL,
} from './grok-plugin-host.js';
import { revertGrokAgentsIsolation } from './grok-agents-isolation.js';
import { normalizeInstallBase } from './install-base.js';
import {
  installsRegistryPathForScan,
  readInstallsRegistryForScan,
  scanKnownInstallBases,
  listKnownInstallBases,
} from './install-bases.js';

// Kept in its own module so foreign-skills isolation can compare install bases
// without importing this module (no ESM cycle). Re-exported for existing callers.
export { normalizeInstallBase };
export {
  installsRegistryPathForScan,
  readInstallsRegistryForScan,
  scanKnownInstallBases,
  listKnownInstallBases,
};

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
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function sameInstallBase(a, b) {
  return normalizeInstallBase(a) === normalizeInstallBase(b);
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
 * @param {() => string[]} opts.listInstallBases
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
