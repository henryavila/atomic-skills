import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { SKILL_NAMESPACE } from '../config.js';

/**
 * Grok Build host-plugin bridge (outside the install journal).
 *
 * Atomic Skills materializes a **plugin package** under:
 *   <basePath>/.grok/plugins/atomic-skills/
 *
 * That path is intentionally **outside** Codex's skill tree
 * (`.agents/skills/`), so Grok never has to load Codex-rendered tool
 * names for our skills.
 *
 * After the journal writes the package, we register it with the host:
 *   grok plugin install --trust <absPluginRoot>
 * On uninstall (before journal reverse):
 *   grok plugin uninstall atomic-skills --confirm
 *
 * Fail-open: if the `grok` binary is missing or the host command fails,
 * install/uninstall of the filesystem package still succeeds. CI and
 * non-Grok machines must not hard-fail.
 *
 * Orchestrated OUTSIDE the journal (same class as runtime refcount): the
 * host registry is external state the blind replayReverse cannot express,
 * and requires a live host CLI.
 */

/** Relative path of the plugin package root under an install basePath. */
export const GROK_PLUGIN_PACKAGE_REL = `.grok/plugins/${SKILL_NAMESPACE}`;

/** Plugin name as shown by `grok plugin list` / uninstall. */
export const GROK_PLUGIN_NAME = SKILL_NAMESPACE;

/**
 * @param {string[]} [ides]
 * @returns {boolean}
 */
export function wantsGrokPluginHost(ides) {
  return Array.isArray(ides) && ides.includes('grok');
}

/**
 * Resolve absolute path to the materialised plugin package.
 * @param {string} basePath - install base (homedir or project root)
 * @returns {string}
 */
export function resolveGrokPluginPackagePath(basePath) {
  return join(basePath, GROK_PLUGIN_PACKAGE_REL);
}

/**
 * Locate the `grok` CLI. Prefer PATH; fall back to ~/.grok/bin/grok.
 * @param {{ env?: NodeJS.ProcessEnv, home?: string }} [opts]
 * @returns {string | null} absolute path or bare command name, or null
 */
export function resolveGrokBinary(opts = {}) {
  const env = opts.env || process.env;
  const home = opts.home ?? env.HOME ?? homedir();

  if (env.GROK_BIN && existsSync(env.GROK_BIN)) return env.GROK_BIN;

  const bundled = join(home, '.grok', 'bin', 'grok');
  if (existsSync(bundled)) return bundled;

  // PATH lookup — spawn will resolve; we only probe via `which`-like spawn.
  const which = spawnSync('sh', ['-c', 'command -v grok'], {
    encoding: 'utf8',
    env,
  });
  if (which.status === 0 && which.stdout?.trim()) {
    return which.stdout.trim();
  }
  return null;
}

/**
 * @typedef {{ status: number, stdout: string, stderr: string }} HostCmdResult
 * @typedef {(bin: string, args: string[], opts?: { env?: NodeJS.ProcessEnv }) => HostCmdResult} HostRunner
 */

/**
 * Default host runner (spawnSync). Inject a fake in tests.
 * @type {HostRunner}
 */
export function defaultGrokHostRunner(bin, args, opts = {}) {
  const result = spawnSync(bin, args, {
    encoding: 'utf8',
    env: opts.env || process.env,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

/**
 * @typedef {'registered' | 'already' | 'updated' | 'skipped' | 'failed'} RegisterStatus
 * @typedef {'unregistered' | 'absent' | 'skipped' | 'failed'} UnregisterStatus
 */

/**
 * Register the materialised plugin package with the Grok host.
 * Idempotent: already-installed → try update, else treat as success.
 *
 * @param {object} opts
 * @param {string} opts.basePath
 * @param {string[]} [opts.ides] - if provided and grok not selected, no-op skip
 * @param {HostRunner} [opts.run]
 * @param {() => string | null} [opts.resolveBin]
 * @param {NodeJS.ProcessEnv} [opts.env]
 * @returns {{ status: RegisterStatus, detail?: string }}
 */
/**
 * Test/CI escape hatch: hermetic install tests set this so a real `grok`
 * binary on the machine never mutates a fake HOME (host seed docs + registry
 * residue break content-aware roundtrips).
 */
export function isGrokHostBridgeDisabled(env = process.env) {
  const v = env.ATOMIC_SKILLS_SKIP_GROK_HOST;
  return v === '1' || v === 'true' || v === 'yes';
}

export function registerGrokPluginHost(opts) {
  const {
    basePath,
    ides,
    run = defaultGrokHostRunner,
    resolveBin = resolveGrokBinary,
    env = process.env,
  } = opts;

  if (ides !== undefined && !wantsGrokPluginHost(ides)) {
    return { status: 'skipped', detail: 'grok not in ides' };
  }

  if (isGrokHostBridgeDisabled(env)) {
    return { status: 'skipped', detail: 'ATOMIC_SKILLS_SKIP_GROK_HOST set' };
  }

  const pluginRoot = resolveGrokPluginPackagePath(basePath);
  if (!existsSync(join(pluginRoot, 'plugin.json'))) {
    return { status: 'failed', detail: `plugin package missing at ${pluginRoot}` };
  }

  const bin = resolveBin({ env, home: env.HOME });
  if (!bin) {
    return { status: 'skipped', detail: 'grok binary not found (filesystem package still installed)' };
  }

  const install = run(bin, ['plugin', 'install', '--trust', pluginRoot], { env });
  if (install.status === 0) {
    return { status: 'registered', detail: trimOut(install) };
  }

  const combined = `${install.stdout}\n${install.stderr}`;
  if (/already installed/i.test(combined)) {
    // Grok materializes a DIRECTORY SNAPSHOT under ~/.grok/installed-plugins/
    // (not a live symlink to the journal package). `plugin update` for local
    // sources prints "local symlink, already live" and leaves that snapshot
    // stale — so slash-menu fields like argument-hint never refresh. Force
    // uninstall+install so the host re-copies the journal-rendered package.
    const uninstall = run(
      bin,
      ['plugin', 'uninstall', GROK_PLUGIN_NAME, '--confirm'],
      { env },
    );
    const reinstall = run(bin, ['plugin', 'install', '--trust', pluginRoot], { env });
    if (reinstall.status === 0) {
      return {
        status: 'updated',
        detail:
          trimOut(reinstall)
          || `reinstalled (prior: ${trimOut(uninstall) || 'uninstalled'})`,
      };
    }
    // Fail-open: journal package remains; host may need a manual reinstall.
    return {
      status: 'already',
      detail:
        trimOut(reinstall)
        || trimOut(install)
        || 'already installed; host reinstall failed',
    };
  }

  return {
    status: 'failed',
    detail: trimOut(install) || `grok plugin install exited ${install.status}`,
  };
}

/**
 * Unregister the Atomic Skills plugin from the Grok host registry.
 * Does NOT delete the journal-owned package tree (uninstall reverse does that).
 *
 * @param {object} opts
 * @param {string[]} [opts.ides] - if provided and grok not selected, no-op skip
 * @param {HostRunner} [opts.run]
 * @param {() => string | null} [opts.resolveBin]
 * @param {NodeJS.ProcessEnv} [opts.env]
 * @returns {{ status: UnregisterStatus, detail?: string }}
 */
export function unregisterGrokPluginHost(opts = {}) {
  const {
    ides,
    run = defaultGrokHostRunner,
    resolveBin = resolveGrokBinary,
    env = process.env,
  } = opts;

  if (ides !== undefined && !wantsGrokPluginHost(ides)) {
    return { status: 'skipped', detail: 'grok not in ides' };
  }

  if (isGrokHostBridgeDisabled(env)) {
    return { status: 'skipped', detail: 'ATOMIC_SKILLS_SKIP_GROK_HOST set' };
  }

  const bin = resolveBin({ env, home: env.HOME });
  if (!bin) {
    return { status: 'skipped', detail: 'grok binary not found' };
  }

  const result = run(
    bin,
    ['plugin', 'uninstall', GROK_PLUGIN_NAME, '--confirm'],
    { env },
  );
  if (result.status === 0) {
    return { status: 'unregistered', detail: trimOut(result) };
  }

  const combined = `${result.stdout}\n${result.stderr}`;
  if (/not found|no plugins|not installed/i.test(combined)) {
    return { status: 'absent', detail: trimOut(result) || 'plugin not in host registry' };
  }

  return {
    status: 'failed',
    detail: trimOut(result) || `grok plugin uninstall exited ${result.status}`,
  };
}

/**
 * @param {HostCmdResult} r
 * @returns {string}
 */
function trimOut(r) {
  return `${r.stdout || ''}${r.stderr || ''}`.trim().slice(0, 400);
}
