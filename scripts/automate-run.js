#!/usr/bin/env node
/**
 * implement --automate start gate.
 *
 * Refuses unless the current host is Claude Code, Codex, or Grok and that
 * host's PreToolUse pen is registered. Architecture and UI detectors are
 * required and are not in this tree yet, so a normal run still refuses.
 * Does not spawn a writer.
 *
 *   node scripts/automate-run.js --host <claude-code|codex|grok> --plan <plan.md> [--root <dir>]
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AUTOMATE_HOSTS,
  PEN_HOOK_SCRIPT,
  assessHostWrite,
  assessPenRegistration,
  extractPenHookScriptToken,
  resolveAutomateHost,
  resolvePenHookScript,
} from '../src/automate-host-pen.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{ host?: string, plan?: string, root?: string, sentinel?: string, hostWriteProbe?: boolean }} */
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--host') out.host = argv[++i];
    else if (token === '--plan') out.plan = argv[++i];
    else if (token === '--root') out.root = argv[++i];
    else if (token === '--sentinel') out.sentinel = argv[++i];
    else if (token === '--host-write-probe') out.hostWriteProbe = true;
    else if (token.startsWith('--host=')) out.host = token.slice('--host='.length);
    else if (token.startsWith('--plan=')) out.plan = token.slice('--plan='.length);
    else if (token.startsWith('--root=')) out.root = token.slice('--root='.length);
    else if (token.startsWith('--sentinel=')) out.sentinel = token.slice('--sentinel='.length);
  }
  return out;
}

/**
 * @param {unknown} hooksConfig
 * @returns {string | null}
 */
function penHookCommand(hooksConfig) {
  if (hooksConfig == null || typeof hooksConfig !== 'object') return null;
  const hooks = /** @type {{ hooks?: { PreToolUse?: unknown } }} */ (hooksConfig).hooks;
  const entries = hooks && hooks.PreToolUse;
  if (!Array.isArray(entries)) return null;
  for (const entry of entries) {
    if (entry == null || typeof entry !== 'object') continue;
    const list = Array.isArray(entry.hooks) ? entry.hooks : [];
    for (const hook of list) {
      const command = hook && typeof hook.command === 'string' ? hook.command : '';
      if (extractPenHookScriptToken(command)) return command;
    }
  }
  return null;
}

/**
 * @param {string} script
 * @param {string[]} args
 * @returns {{ ok: boolean, detail: string }}
 */
function runDetector(script, args) {
  const res = spawnSync(process.execPath, [join(ROOT, 'scripts', script), ...args], {
    encoding: 'utf8',
  });
  const detail = `${res.stdout || ''}${res.stderr || ''}`.trim();
  return { ok: res.status === 0, detail };
}

/**
 * Create an isolated probe lock in a tmpdir (AUTOMATE_PROBE_LOCK), require
 * exit 2, remove it, require exit 0. Does not create or delete repo pen.lock
 * or leftover probe.lock.
 * @param {string} root
 * @returns {string[]}
 */
export function runSyntheticProbe(root) {
  const probeDir = mkdtempSync(join(tmpdir(), 'automate-probe-'));
  const probe = join(probeDir, 'probe.lock');
  const pen = join(root, '.atomic-skills/status/automate/pen.lock');
  const repoProbe = join(root, '.atomic-skills/status/automate/probe.lock');
  const hadRepoProbe = existsSync(repoProbe);
  const home = mkdtempSync(join(tmpdir(), 'pen-home-'));
  const script = join(ROOT, 'skills/shared/project-assets/hooks/automate-pen.sh');
  const payload = JSON.stringify({
    tool_name: 'apply_patch',
    tool_input: { file_path: join(root, 'sentinel.js') },
  });
  /** @type {string[]} */
  const blockers = [];
  mkdirSync(join(home, '.atomic-skills'), { recursive: true });
  writeFileSync(join(home, '.atomic-skills/package-root'), `${ROOT}\n`);
  const baseEnv = {
    ...process.env,
    HOME: home,
    CLAUDE_PROJECT_DIR: root,
    GROK_WORKSPACE_ROOT: root,
  };
  delete baseEnv.AUTOMATE_PEN_LOCK;
  delete baseEnv.AUTOMATE_PROBE_LOCK;
  try {
    writeFileSync(probe, '{"kind":"probe"}\n');
    const denied = spawnSync('bash', [script], {
      input: payload,
      encoding: 'utf8',
      env: { ...baseEnv, AUTOMATE_PROBE_LOCK: probe },
    });
    if (denied.status !== 2) {
      blockers.push(
        `probe lock did not make ${PEN_HOOK_SCRIPT} exit 2 (status ${denied.status})`,
      );
    }
    rmSync(probe, { force: true });
    const allowed = spawnSync('bash', [script], {
      input: payload,
      encoding: 'utf8',
      env: baseEnv,
    });
    if (allowed.status !== 0) {
      blockers.push(
        `${PEN_HOOK_SCRIPT} did not exit 0 without a lock (status ${allowed.status})`,
      );
    }
    if (existsSync(join(root, 'sentinel.js'))) {
      blockers.push('probe lock left a sentinel file');
    }
  } finally {
    rmSync(probeDir, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
  if (existsSync(pen)) blockers.push('startup probe created pen.lock');
  if (!hadRepoProbe && existsSync(repoProbe)) {
    blockers.push('startup probe left probe.lock');
  }
  return blockers;
}

const HOST_WRITE_PROBE_PREFIX = 'HOST_WRITE_PROBE=';

/**
 * Host-shaped subprocess body: read the host hook config, invoke the
 * registered pen command (not a parent-side `bash automate-pen.sh`), and
 * only write the sentinel if the hook allows. Running this in-process from
 * the parent does not count — spawn this file with --host-write-probe.
 * @param {{ host?: string, root?: string, sentinel?: string }} args
 */
function hostShapedWrite(args) {
  const host = resolveAutomateHost(args.host);
  const root = resolve(args.root || process.cwd());
  const sentinel = resolve(
    args.sentinel || join(root, '.atomic-skills/status/automate/host-write-sentinel'),
  );
  /** @type {{ invokedHook: boolean, refused: boolean, sentinelCreated: boolean }} */
  const result = { invokedHook: false, refused: false, sentinelCreated: false };

  const emit = () => {
    result.sentinelCreated = existsSync(sentinel);
    process.stdout.write(`${HOST_WRITE_PROBE_PREFIX}${JSON.stringify(result)}\n`);
  };

  if (!host) {
    emit();
    return;
  }

  const hookFile = join(root, AUTOMATE_HOSTS[host].hookFile);
  if (!existsSync(hookFile)) {
    emit();
    return;
  }

  let parsed = null;
  try {
    parsed = JSON.parse(readFileSync(hookFile, 'utf8'));
  } catch {
    parsed = null;
  }
  const command = penHookCommand(parsed);
  if (!command || !assessPenRegistration(host, parsed, root).ok) {
    emit();
    return;
  }
  if (/^\s*[A-Za-z_][A-Za-z0-9_]*=/.test(command)) {
    emit();
    return;
  }

  const probeDir = mkdtempSync(join(tmpdir(), 'host-write-probe-'));
  const probe = join(probeDir, 'probe.lock');
  const home = mkdtempSync(join(tmpdir(), 'host-write-home-'));
  const payload = JSON.stringify({
    tool_name: AUTOMATE_HOSTS[host].writeTools[0],
    tool_input: { file_path: sentinel },
  });
  mkdirSync(join(home, '.atomic-skills'), { recursive: true });
  writeFileSync(join(home, '.atomic-skills/package-root'), `${ROOT}\n`);
  mkdirSync(dirname(sentinel), { recursive: true });

  const env = {
    ...process.env,
    HOME: home,
    CLAUDE_PROJECT_DIR: root,
    GROK_WORKSPACE_ROOT: root,
    AUTOMATE_PROBE_LOCK: probe,
  };
  delete env.AUTOMATE_PEN_LOCK;

  const scriptPath = resolvePenHookScript(command, root, env);
  if (!scriptPath || !existsSync(scriptPath)) {
    rmSync(probeDir, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
    emit();
    return;
  }

  try {
    writeFileSync(probe, '{"kind":"probe"}\n');
    const denied = spawnSync('bash', [scriptPath], {
      input: payload,
      encoding: 'utf8',
      cwd: root,
      env,
    });
    result.invokedHook = !denied.error;
    result.refused = denied.status === 2;
    if (denied.status === 0) {
      writeFileSync(sentinel, 'host-write\n');
    }
  } finally {
    rmSync(probeDir, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
  emit();
}

/**
 * Spawn a host-shaped subprocess that must invoke the registered pen.
 * A parent-side `bash automate-pen.sh` does not set invokedHook.
 * Missing host hook config fails honestly (does not count as a disabled proof).
 * @param {string | null} host
 * @param {string} root
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function runHostWriteProbe(host, root) {
  if (!host || !AUTOMATE_HOSTS[host]) {
    return assessHostWrite({ invokedHook: false, refused: false, sentinelCreated: false });
  }
  const work = mkdtempSync(join(tmpdir(), 'host-write-sentinel-'));
  const sentinel = join(work, 'host-write-sentinel');
  const res = spawnSync(
    process.execPath,
    [
      fileURLToPath(import.meta.url),
      '--host-write-probe',
      '--host',
      host,
      '--root',
      root,
      '--sentinel',
      sentinel,
    ],
    { encoding: 'utf8', timeout: 15000 },
  );
  let parsed = null;
  const combined = `${res.stdout || ''}\n${res.stderr || ''}`;
  for (const line of combined.split(/\r?\n/)) {
    const idx = line.indexOf(HOST_WRITE_PROBE_PREFIX);
    if (idx === -1) continue;
    try {
      parsed = JSON.parse(line.slice(idx + HOST_WRITE_PROBE_PREFIX.length));
    } catch {
      parsed = null;
    }
  }
  const leftoverSentinel = existsSync(sentinel);
  rmSync(work, { recursive: true, force: true });
  if (!parsed || typeof parsed !== 'object') {
    return assessHostWrite({
      invokedHook: false,
      refused: false,
      sentinelCreated: leftoverSentinel,
    });
  }
  return assessHostWrite({
    invokedHook: parsed.invokedHook === true,
    refused: parsed.refused === true,
    sentinelCreated: parsed.sentinelCreated === true || leftoverSentinel,
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const host = resolveAutomateHost(args.host);
  /** @type {string[]} */
  const blockers = [];

  if (!host) {
    blockers.push('host must be claude-code, codex, or grok');
  }
  if (!args.plan) {
    blockers.push('pass --plan <plan.md>');
  }

  const root = resolve(args.root || process.cwd());
  if (host) {
    const hookFile = join(root, AUTOMATE_HOSTS[host].hookFile);
    if (!existsSync(hookFile)) {
      blockers.push(
        `${host} PreToolUse does not call ${PEN_HOOK_SCRIPT} (${AUTOMATE_HOSTS[host].hookFile} missing)`,
      );
    } else {
      let parsed = null;
      try {
        parsed = JSON.parse(readFileSync(hookFile, 'utf8'));
      } catch {
        parsed = null;
      }
      const pen = assessPenRegistration(host, parsed, root);
      if (!pen.ok) blockers.push(pen.reason);
    }
  }

  try {
    blockers.push(...runSyntheticProbe(root));
  } catch (err) {
    blockers.push(`probe lock failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const hostWrite = runHostWriteProbe(host, root);
  if (!hostWrite.ok) blockers.push(hostWrite.reason);

  if (args.plan) {
    const plan = resolve(args.plan);
    for (const script of [
      ['find-missing-flow.js', '--strict', plan],
      ['find-unreviewed-plans.js', '--require-external', plan],
      ['find-plans-missing-ground-truth.js', plan],
    ]) {
      const [name, ...rest] = script;
      const result = runDetector(name, rest);
      if (!result.ok) blockers.push(result.detail || `${name} failed`);
    }
  }

  for (const missing of ['find-missing-architecture.js', 'find-missing-ui.js']) {
    if (!existsSync(join(ROOT, 'scripts', missing))) {
      blockers.push(`missing detector scripts/${missing}`);
    }
  }

  if (blockers.length > 0) {
    process.stderr.write('implement --automate refused:\n');
    for (const line of blockers) {
      process.stderr.write(`- ${line.split('\n')[0]}\n`);
    }
    process.exit(1);
  }

  process.stderr.write('implement --automate: gates passed; writer spawn is not in this build\n');
  process.exit(2);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  if (args.hostWriteProbe) {
    hostShapedWrite(args);
    process.exit(0);
  }
  main();
}
