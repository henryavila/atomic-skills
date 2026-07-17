import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { readManifest, MANIFEST_DIR } from '../manifest.js';
import {
  registerGrokPluginHost,
  unregisterGrokPluginHost,
  wantsGrokPluginHost,
} from './grok-plugin-host.js';
import { revertGrokAgentsIsolation } from './grok-agents-isolation.js';

/**
 * Shared multi-owner scan for outside-journal Grok state (host plugin registry
 * + foreign-skills isolation). F-003 / P0-C: host unregister must use the same
 * surviving-owner contract as isolation revert.
 */

/**
 * Known install bases: user home + paths listed in ~/.atomic-skills/installs.json.
 * @param {string} home
 * @returns {string[]}
 */
export function listKnownInstallBases(home) {
  const bases = new Set();
  bases.add(home);
  const registryPath = join(home, MANIFEST_DIR, 'installs.json');
  if (existsSync(registryPath)) {
    try {
      const list = JSON.parse(readFileSync(registryPath, 'utf8'));
      if (Array.isArray(list)) {
        for (const p of list) if (typeof p === 'string') bases.add(p);
      } else if (list && Array.isArray(list.owners)) {
        // Versioned registry shape (runtime-observe); tolerate both.
        for (const o of list.owners) {
          if (o && typeof o.basePath === 'string') bases.add(o.basePath);
        }
      }
    } catch { /* ignore corrupt registry */ }
  }
  return [...bases];
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
  const {
    basePath,
    listInstallBases,
    readManifestFor = readManifest,
  } = opts;
  if (typeof listInstallBases !== 'function') {
    throw new Error('hasOtherGrokOwner: listInstallBases is required');
  }
  const others = listInstallBases().filter((p) => p !== basePath);
  for (const other of others) {
    if (wantsGrokPluginHost(readManifestFor(other)?.ides)) return true;
  }
  return false;
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
  const others = listInstallBases().filter((p) => p !== basePath);
  for (const other of others) {
    if (wantsGrokPluginHost(readManifestFor(other)?.ides)) return other;
  }
  return null;
}

/**
 * Outside-journal Grok release for shrink-away-from-grok or uninstall.
 *
 * - **Last owner:** unregister host plugin + revert isolation.
 * - **Survivors remain:** keep host + isolation; optionally restage host
 *   registration from a survivor's package (so the snapshot is not left
 *   pointing at a departing base that is about to lose its package tree).
 *
 * Intentionally does **not** gate on the departing base's current `ides`
 * (residual after shrink must be cleanable when no grok owners remain).
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
    listInstallBases = () => listKnownInstallBases(home),
    readManifestFor = readManifest,
    run,
    resolveBin,
    env = process.env,
    restageSurvivor = true,
  } = opts;

  const survivor = findOtherGrokOwner({
    basePath,
    listInstallBases,
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
      };
      if (run) regOpts.run = run;
      if (resolveBin) regOpts.resolveBin = resolveBin;
      const reg = registerGrokPluginHost(regOpts);
      host = {
        status: 'kept',
        detail: reg.detail || host.detail,
        restage: reg.status,
      };
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
    listInstallBases,
    // Force reverse of managed ignore entries — do not pass ides that would
    // skip when residual after shrink left ides without grok.
  });

  return { lastOwner: true, host, isolation };
}
