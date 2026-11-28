import { homedir } from 'node:os';
import pc from 'picocolors';
import {
  registerGrokPluginHost,
  wantsGrokPluginHost,
} from './runtime-layers/grok-plugin-host.js';
import { applyGrokAgentsIsolation } from './runtime-layers/grok-agents-isolation.js';
import { releaseGrokOutsideJournal } from './runtime-layers/grok-refcount.js';

/**
 * After the journal materialises `.grok/plugins/atomic-skills/` (or shrinks it away):
 *  1. When `ides` still include grok — register the package with the Grok host
 *     (`grok plugin install --trust`) and apply foreign-skills isolation — fail-open.
 *  2. When prior ides included grok and next do not (IDE shrink, F-003 / P0-C) —
 *     release host registration + isolation only if this install is the last
 *     remaining grok owner (same multi-owner scan as isolation refcount). If
 *     another install still wants grok, keep host + isolation (restage from
 *     survivor package when possible).
 *
 * @param {string} basePath
 * @param {string[]} ides - next ides after this install
 * @param {string} [language]
 * @param {object} [opts]
 * @param {string[]} [opts.priorIdes] - ides from existing manifest before rewrite
 * @param {string} [opts.home]
 * @param {() => string[]} [opts.listInstallBases]
 * @param {import('./runtime-layers/grok-plugin-host.js').HostRunner} [opts.run]
 * @param {() => string | null} [opts.resolveBin]
 * @param {NodeJS.ProcessEnv} [opts.env]
 */
export function syncGrokPluginHostAfterInstall(basePath, ides, language = 'en', opts = {}) {
  const isPt = language === 'pt';
  const {
    priorIdes,
    home = process.env.HOME || homedir(),
    listInstallBases,
    run,
    resolveBin,
    env,
  } = opts;

  // F-003: shrink away from grok — multi-owner-safe outside-journal cleanup.
  if (!wantsGrokPluginHost(ides)) {
    releaseGrokHostOnShrink({
      basePath, priorIdes, home, listInstallBases, run, resolveBin, env, isPt,
    });
    return;
  }

  const regOpts = hostRunnerOptions({ basePath, ides }, { run, resolveBin, env });
  const result = registerGrokPluginHost(regOpts);
  logGrokHostRegistration(result, isPt);

  // Isolation always targets user ~/.grok/config.toml (foreign vendor skill roots).
  applyAndLogGrokIsolation({ ides, home, isPt });
}

/**
 * Shrink path: when grok was selected before and no longer is, release the
 * outside-journal host/isolation state for this install.
 *
 * @param {object} context
 * @param {string} context.basePath
 * @param {string[]} [context.priorIdes]
 * @param {string} context.home
 * @param {() => string[]} [context.listInstallBases]
 * @param {Function} [context.run]
 * @param {() => string|null} [context.resolveBin]
 * @param {NodeJS.ProcessEnv} [context.env]
 * @param {boolean} context.isPt
 */
function releaseGrokHostOnShrink(context) {
  const {
    basePath, priorIdes, home, listInstallBases, run, resolveBin, env, isPt,
  } = context;
  if (priorIdes === undefined || !wantsGrokPluginHost(priorIdes)) return;

  const releaseOpts = hostRunnerOptions({ basePath, home }, { run, resolveBin, env });
  // Only pass an explicit scan callback when the caller supplied one.
  // Default path relies on releaseGrokOutsideJournal's untrusted skip.
  if (typeof listInstallBases === 'function') {
    releaseOpts.listInstallBases = listInstallBases;
  }

  let released;
  try {
    released = releaseGrokOutsideJournal(releaseOpts);
  } catch (err) {
    // Fail-closed: corrupt/untrusted registry must never throw after journal
    // commit (C-local-F1). Map to the same skipped shape as scan path.
    if (!isRegistryTrustError(err)) throw err;
    released = skippedGrokRelease('registry-untrusted');
  }
  logGrokRelease(released, isPt);
}

/**
 * @param {{ run?: Function, resolveBin?: Function, env?: NodeJS.ProcessEnv }} runner
 * @param {object} base
 * @returns {object}
 */
function hostRunnerOptions(base, runner) {
  const opts = { ...base };
  if (runner.run) opts.run = runner.run;
  if (runner.resolveBin) opts.resolveBin = runner.resolveBin;
  if (runner.env) opts.env = runner.env;
  return opts;
}

/**
 * Registry trust failures are skipped (never rethrown) by the shrink path.
 * @param {any} err
 * @returns {boolean}
 */
function isRegistryTrustError(err) {
  return err?.code === 'REGISTRY_UNTRUSTED' || err?.code === 'REGISTRY_CORRUPT'
    || err?.code === 'REGISTRY_UNKNOWN' || err?.code === 'REGISTRY_IO';
}

/**
 * @param {string} reason
 * @returns {{ lastOwner: boolean, host: object, isolation: object }}
 */
function skippedGrokRelease(reason) {
  return {
    lastOwner: false,
    host: { status: 'skipped', detail: reason },
    isolation: { status: 'skipped', detail: reason },
  };
}

/**
 * Output text per host registration status, with the `{detail}` placeholder
 * substituted by the result detail (or the per-status fallback).
 */
const GROK_HOST_REGISTRATION_OUTPUT = {
  registered: {
    color: 'dim',
    en: 'Grok plugin host: registered (native).',
    pt: 'Grok plugin host: registrado (nativo).',
  },
  updated: {
    color: 'dim',
    en: 'Grok plugin host: snapshot reloaded (uninstall+install).',
    pt: 'Grok plugin host: snapshot recarregado (uninstall+install).',
  },
  already: {
    color: 'yellow',
    en: 'Grok plugin host: already installed, reload incomplete ({detail}).',
    pt: 'Grok plugin host: já instalado, recarga incompleta ({detail}).',
    enFallback: 'no detail',
    ptFallback: 'sem detalhe',
  },
  skipped: {
    color: 'dim',
    en: 'Grok plugin host: skipped ({detail}).',
    pt: 'Grok plugin host: omitido ({detail}).',
    enFallback: 'skip',
    ptFallback: 'skip',
  },
  failed: {
    color: 'yellow',
    en: 'Grok plugin host: failed ({detail}); .grok/plugins/ package remains.',
    pt: 'Grok plugin host: falhou ({detail}); package em .grok/plugins/ permanece.',
    enFallback: 'error',
    ptFallback: 'erro',
  },
};

/**
 * @param {{ status: string, detail?: string }} result
 * @param {boolean} isPt
 */
function logGrokHostRegistration(result, isPt) {
  const output = GROK_HOST_REGISTRATION_OUTPUT[result.status]
    || GROK_HOST_REGISTRATION_OUTPUT.failed;
  const fallback = isPt ? output.ptFallback : output.enFallback;
  const text = (isPt ? output.pt : output.en).replace('{detail}', result.detail || fallback || '');
  console.log(`  ${output.color === 'yellow' ? pc.yellow(text) : pc.dim(text)}`);
}

/**
 * @param {{ ides: string[], home: string, isPt: boolean }} context
 */
function applyAndLogGrokIsolation(context) {
  const { ides, home, isPt } = context;
  const iso = applyGrokAgentsIsolation({ ides, home });
  if (iso.status === 'applied') {
    console.log(
      `  ${pc.dim(isPt ? 'Grok: isolado de skills estrangeiras (agents/cursor/claude atomic-skills).' : 'Grok: isolated from foreign atomic-skills trees (agents/cursor/claude).')}`,
    );
  } else if (iso.status === 'already') {
    console.log(
      `  ${pc.dim(isPt ? 'Grok: isolamento foreign-skills já presente.' : 'Grok: foreign-skills isolation already present.')}`,
    );
  }
}

/**
 * @param {{ lastOwner: boolean, host: { status: string, detail?: string }, isolation: { status: string, detail?: string } }} released
 * @param {boolean} isPt
 */
function logGrokRelease(released, isPt) {
  logGrokHostRelease(released.host, isPt);
  logGrokIsolationRelease(released.isolation, isPt);
}

/**
 * @param {{ status: string, detail?: string }} host
 * @param {boolean} isPt
 */
function logGrokHostRelease(host, isPt) {
  if (host.status === 'unregistered') {
    console.log(`  ${pc.dim(isPt ? 'Grok plugin host: desregistrado (último owner).' : 'Grok plugin host: unregistered (last owner).')}`);
  } else if (host.status === 'absent') {
    console.log(`  ${pc.dim(isPt ? 'Grok plugin host: já ausente.' : 'Grok plugin host: already absent.')}`);
  } else if (host.status === 'kept') {
    console.log(`  ${pc.dim(isPt ? 'Grok plugin host: mantido (outra install com grok).' : 'Grok plugin host: kept (another grok install remains).')}`);
  } else if (host.status === 'skipped') {
    console.log(`  ${pc.dim(isPt ? `Grok plugin host: omitido (${host.detail || 'skip'}).` : `Grok plugin host: skipped (${host.detail || 'skip'}).`)}`);
  } else if (host.status === 'failed') {
    console.log(`  ${pc.yellow(isPt ? `Grok plugin host: falha (${host.detail || 'erro'}).` : `Grok plugin host: failed (${host.detail || 'error'}).`)}`);
  }
}

/**
 * @param {{ status: string, detail?: string }} isolation
 * @param {boolean} isPt
 */
function logGrokIsolationRelease(isolation, isPt) {
  if (isolation.status === 'removed') {
    console.log(`  ${pc.dim(isPt ? 'Grok: isolamento foreign-skills removido.' : 'Grok: foreign-skills isolation removed.')}`);
  } else if (isolation.status === 'kept') {
    console.log(`  ${pc.dim(isPt ? 'Grok: isolamento foreign-skills mantido (outra install com grok).' : 'Grok: foreign-skills isolation kept (another grok install remains).')}`);
  }
}
