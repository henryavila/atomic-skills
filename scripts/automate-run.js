#!/usr/bin/env node
/**
 * implement --automate start gate + one writer spawn/merge.
 *
 * Refuses unless the current host is Claude Code, Codex, or Grok and that
 * host's PreToolUse pen is registered. After the six gates pass: create a
 * sibling worktree, write pen.lock, spawn the host CLI, merge onto the plan
 * branch, kill a still-living writer, and drop the lock (including failure).
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
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
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
import {
  acquireLeaseFile,
  buildActiveLease,
  clearLeaseFile,
} from '../src/writer-lease.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const HOST_BINS = { 'claude-code': 'claude', codex: 'codex', grok: 'grok' };
const ARG_KEYS = {
  host: 'host',
  plan: 'plan',
  root: 'root',
  sentinel: 'sentinel',
  'host-bin': 'hostBin',
  'worktree-parent': 'worktreeParent',
  'lock-dir': 'lockDir',
  'plan-branch': 'planBranch',
  'writer-branch': 'writerBranch',
  phase: 'phase',
};

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--host-write-probe') {
      out.hostWriteProbe = true;
      continue;
    }
    if (!token.startsWith('--')) continue;
    const eq = token.indexOf('=');
    const raw = eq === -1 ? token.slice(2) : token.slice(2, eq);
    const key = ARG_KEYS[raw];
    if (!key) continue;
    out[key] = eq === -1 ? argv[++i] : token.slice(eq + 1);
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

export function isPidAlive(pid) {
  const n = typeof pid === 'number' ? pid : Number(pid);
  if (!Number.isInteger(n) || n <= 0) return false;
  try {
    process.kill(n, 0);
    return true;
  } catch {
    return false;
  }
}

/** L-F2-1: missing cited writerWorktree is not a skip/pass. Dead pid is explicit. */
export function inspectPenLock(lockPath) {
  if (!lockPath || !existsSync(lockPath)) return { kind: 'absent' };
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(lockPath, 'utf8'));
  } catch (err) {
    return { kind: 'malformed', reason: `unreadable pen.lock: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { kind: 'malformed', reason: 'pen.lock is not an object' };
  }
  const pid = Number(parsed.pid);
  if (!Number.isInteger(pid) || pid <= 0) {
    return { kind: 'malformed', reason: 'pen.lock missing pid', lock: parsed };
  }
  if (isPidAlive(pid)) return { kind: 'held', lock: parsed };
  return { kind: 'stale-dead-pid', lock: parsed };
}

export function writePenLock(lockPath, fields) {
  const writerWorktree = resolve(String(fields.writerWorktree || ''));
  if (!writerWorktree || !existsSync(writerWorktree)) {
    throw new Error('pen.lock writerWorktree must exist (fail closed)');
  }
  mkdirSync(dirname(lockPath), { recursive: true });
  writeFileSync(
    lockPath,
    `${JSON.stringify({ owner: String(fields.owner), pid: fields.pid, writerWorktree }, null, 2)}\n`,
  );
}

export function removePenLock(lockPath) {
  rmSync(lockPath, { force: true });
}

export function reclaimStalePenLock(lockPath) {
  const info = inspectPenLock(lockPath);
  if (info.kind === 'absent') return null;
  if (info.kind === 'stale-dead-pid') {
    removePenLock(lockPath);
    return null;
  }
  if (info.kind === 'held') return 'pen.lock is held by a live pid';
  return info.reason || 'pen.lock is malformed';
}

export function resolveHostBin(host, args, env = process.env) {
  const injected = (args && args.hostBin) || (env && env.AIDECK_HOST_BIN);
  if (injected && String(injected).trim()) return String(injected).trim();
  return host && HOST_BINS[host] ? HOST_BINS[host] : null;
}

function gitExec(cwd, args) {
  return spawnSync('git', ['-c', 'commit.gpgsign=false', ...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'automate',
      GIT_AUTHOR_EMAIL: 'automate@local',
      GIT_COMMITTER_NAME: 'automate',
      GIT_COMMITTER_EMAIL: 'automate@local',
    },
  });
}

function gitOrThrow(cwd, args, label) {
  const res = gitExec(cwd, args);
  if (res.status !== 0) throw new Error(`${label}: ${(res.stderr || res.stdout || '').trim()}`);
  return res;
}

function planSlugOf(planPath) {
  try {
    const match = readFileSync(planPath, 'utf8').match(/^slug:\s*["']?([A-Za-z0-9._-]+)/m);
    if (match) return match[1];
  } catch {
    // fall through
  }
  const dir = basename(dirname(planPath));
  return dir && dir !== '.' ? dir : 'plan';
}

function startHost(opts) {
  const child = spawn(opts.bin, [], { cwd: opts.cwd, env: opts.env, stdio: 'ignore' });
  const wait = (timeoutMs) =>
    new Promise((resolveWait) => {
      const timer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch { /* ignore */ }
      }, timeoutMs);
      child.on('error', (err) => {
        clearTimeout(timer);
        resolveWait({ status: 1, stderr: err.message });
      });
      child.on('exit', (code) => {
        clearTimeout(timer);
        resolveWait({ status: code == null ? 1 : code, stderr: '' });
      });
    });
  return { pid: child.pid, wait, child };
}

function killQuiet(pidOrChild) {
  try {
    if (typeof pidOrChild === 'number') process.kill(pidOrChild, 'SIGKILL');
    else if (pidOrChild && typeof pidOrChild.kill === 'function') pidOrChild.kill('SIGKILL');
  } catch {
    // ignore
  }
}

export async function runWriterSession(input) {
  const { host, root, plan, args } = input;
  const env = process.env;
  const lockDir = resolve(
    args.lockDir || env.AUTOMATE_LOCK_DIR || join(root, '.atomic-skills/status/automate'),
  );
  const lockPath = join(lockDir, 'pen.lock');
  const blocked = reclaimStalePenLock(lockPath);
  if (blocked) throw new Error(blocked);

  const slug = planSlugOf(plan);
  const phaseId = String(args.phase || env.AUTOMATE_PHASE || 'F0').trim() || 'F0';
  const worktreeParent = resolve(
    args.worktreeParent || env.AUTOMATE_WORKTREE_PARENT || join(root, '.worktrees'),
  );
  const worktreePath = join(worktreeParent, `${slug}-${phaseId}-writer`);
  const writerBranch = args.writerBranch || env.AUTOMATE_WRITER_BRANCH || `impl/${slug}-${phaseId}-writer`;
  const planBranch =
    args.planBranch ||
    env.AUTOMATE_PLAN_BRANCH ||
    (gitExec(root, ['rev-parse', '--abbrev-ref', 'HEAD']).stdout || '').trim() ||
    'HEAD';
  const hostBin = resolveHostBin(host, args, env);
  if (!hostBin) throw new Error('host CLI path is missing');

  mkdirSync(worktreeParent, { recursive: true });
  gitOrThrow(root, ['worktree', 'add', '-b', writerBranch, worktreePath, 'HEAD'], 'git worktree add');

  const statusRoot = dirname(lockDir);
  let leaseSecret = null;
  let writerPid;
  let started = null;
  try {
    const lease = acquireLeaseFile(
      statusRoot,
      buildActiveLease({ planSlug: slug, phaseId, hostId: host, worktreePath, writerBranch }),
    );
    leaseSecret = lease.secret;
    writePenLock(lockPath, { owner: host, pid: process.pid, writerWorktree: worktreePath });
    started = startHost({
      bin: hostBin,
      cwd: worktreePath,
      env: { ...env, AUTOMATE_PEN_LOCK: lockPath, AUTOMATE_WRITER_WORKTREE: worktreePath },
    });
    writerPid = started.pid;
    if (!Number.isInteger(writerPid) || writerPid <= 0) throw new Error('host CLI did not start');
    writePenLock(lockPath, { owner: host, pid: writerPid, writerWorktree: worktreePath });
    const result = await started.wait(Number(env.AUTOMATE_WRITER_TIMEOUT_MS || 60_000));
    if (result.status !== 0) {
      throw new Error(`host CLI exited ${result.status}${result.stderr ? `: ${result.stderr}` : ''}`);
    }
    gitOrThrow(worktreePath, ['add', '-A'], 'git add');
    const dirty = gitExec(worktreePath, ['status', '--porcelain']);
    if ((dirty.stdout || '').trim()) {
      gitOrThrow(worktreePath, ['commit', '-m', 'automate writer'], 'writer commit');
    }
    const current = (gitExec(root, ['rev-parse', '--abbrev-ref', 'HEAD']).stdout || '').trim();
    if (planBranch && current && current !== planBranch && planBranch !== 'HEAD') {
      gitOrThrow(root, ['checkout', planBranch], `checkout ${planBranch}`);
    }
    gitOrThrow(root, ['merge', '--no-edit', writerBranch], 'merge');
    process.stderr.write('implement --automate: merged; stopping\n');
    return 0;
  } finally {
    if (writerPid && isPidAlive(writerPid)) killQuiet(writerPid);
    if (started) killQuiet(started.child);
    removePenLock(lockPath);
    if (leaseSecret) {
      try { clearLeaseFile(statusRoot, slug, leaseSecret); } catch { /* best-effort */ }
    }
    gitExec(root, ['worktree', 'remove', '--force', worktreePath]);
    rmSync(worktreePath, { recursive: true, force: true });
  }
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
  const operationalLock = join(root, '.atomic-skills/status/automate/pen.lock');
  const lockDir = args.lockDir || process.env.AUTOMATE_LOCK_DIR;
  const sessionLock = lockDir ? join(resolve(String(lockDir)), 'pen.lock') : operationalLock;
  for (const path of new Set([operationalLock, sessionLock])) {
    const held = reclaimStalePenLock(path);
    if (held) blockers.push(held);
  }
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
      ['find-missing-architecture.js', '--strict', plan],
      ['find-missing-ui.js', '--strict', plan],
    ]) {
      const [name, ...rest] = script;
      const result = runDetector(name, rest);
      if (!result.ok) blockers.push(result.detail || `${name} failed`);
    }
  }

  if (blockers.length > 0) {
    process.stderr.write('implement --automate refused:\n');
    for (const line of blockers) {
      process.stderr.write(`- ${line.split('\n')[0]}\n`);
    }
    process.exit(1);
  }

  runWriterSession({ host, root, plan: resolve(args.plan), args }).then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(
        `implement --automate failed: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(1);
    },
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  if (args.hostWriteProbe) {
    hostShapedWrite(args);
    process.exit(0);
  }
  main();
}
