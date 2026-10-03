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
  renameSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
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
  leasePath,
} from '../src/writer-lease.js';
import {
  buildPhaseReviewBrief,
  redirectParkPathOffMaestroCursor,
  resolveReviewExternalCli,
  runExternalReviewCli,
  runPhaseReviewLoop,
  upsertPlanReviewExternalCli,
} from '../src/phase-review-gate.js';
import { readFinalPlan, finalAuditsPassed, validationSnapshot, productSnapshot } from '../src/plan-end-review.js';
import { deliveryAuditGraphCoverage } from '../src/phase-delivery-audit-gate.js';
import { phaseCloseFenceOk } from '../src/automate-product-fence.js';

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
  'host-args': 'hostArgs',
  'review-bin': 'reviewBin',
  'github-bin': 'githubBin',
  'pr-base': 'prBase',
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
  const raw = fields && fields.writerWorktree;
  if (raw == null || String(raw).trim() === '') {
    throw new Error('pen.lock writerWorktree must exist (fail closed)');
  }
  const writerWorktree = resolve(String(raw));
  if (!existsSync(writerWorktree)) {
    throw new Error('pen.lock writerWorktree must exist (fail closed)');
  }
  mkdirSync(dirname(lockPath), { recursive: true });
  writeFileSync(
    lockPath,
    `${JSON.stringify({ owner: String(fields.owner), pid: fields.pid, writerWorktree }, null, 2)}\n`,
    { flag: 'wx' },
  );
}

export function removePenLock(lockPath, ownerPid) {
  if (ownerPid !== undefined) {
    const info = inspectPenLock(lockPath);
    if (info.kind === 'absent') return;
    if (!info.lock || Number(info.lock.pid) !== Number(ownerPid)) return;
  }
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

function hostArgv(args, env) {
  const raw = (args && args.hostArgs) || (env && env.AUTOMATE_HOST_ARGS) || '';
  const s = String(raw).trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // fall through
    }
  }
  return s.split(/\s+/).filter(Boolean);
}

function startHost(opts) {
  const argv = Array.isArray(opts.argv) ? opts.argv : [];
  const child = spawn(opts.bin, argv, {
    cwd: opts.cwd,
    env: opts.env,
    stdio: ['pipe', 'ignore', 'ignore'],
  });
  if (child.stdin) {
    child.stdin.on('error', () => {}); // Early CLI exit is reported by its status.
    child.stdin.end(opts.input || '');
  }
  let spawnErr = null;
  child.on('error', (err) => {
    spawnErr = err;
  });
  const wait = (timeoutMs) =>
    new Promise((resolveWait) => {
      let settled = false;
      const timer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch { /* ignore */ }
      }, timeoutMs);
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolveWait(result);
      };
      child.on('error', (err) => finish({ status: 1, stderr: err.message }));
      child.on('exit', (code) => finish({ status: code == null ? 1 : code, stderr: '' }));
      if (spawnErr) finish({ status: 1, stderr: spawnErr.message });
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

/**
 * Ask once (or reuse env/plan) for the family-different external review CLI.
 * Does not ask again when the plan already stores reviewExternalCli.
 * @param {{
 *   planPath: string,
 *   host?: string | null,
 *   env?: NodeJS.ProcessEnv,
 *   ask?: (() => string) | null,
 *   readPlan?: ((path: string) => string) | null,
 *   writePlan?: ((path: string, text: string) => void) | null,
 * }} input
 */
export function prepareReviewExternalCli(input) {
  const env = input.env || process.env;
  const planPath = input.planPath;
  const readPlan =
    typeof input.readPlan === 'function'
      ? input.readPlan
      : (path) => readFileSync(path, 'utf8');
  const writePlan =
    typeof input.writePlan === 'function'
      ? input.writePlan
      : (path, text) => writeFileSync(path, text);
  let planText = '';
  try {
    planText = readPlan(planPath);
  } catch {
    planText = '';
  }
  const fromEnv =
    env.AUTOMATE_REVIEW_EXTERNAL_CLI != null
      ? String(env.AUTOMATE_REVIEW_EXTERNAL_CLI).trim()
      : '';
  const result = resolveReviewExternalCli({
    openHost: input.host,
    planText,
    planReviewExternalCli: fromEnv || undefined,
    ask: input.ask,
  });
  if (result.ok && result.cli) {
    const next = result.planText && result.asked
      ? result.planText
      : upsertPlanReviewExternalCli(planText, result.cli);
    if (next !== planText) writePlan(planPath, next);
    return { ...result, planText: next };
  }
  return result;
}

/**
 * Spawn the stored external review CLI, wait, and return the receipt.
 * Brief includes the ratified flow graph and chosen architecture sketch.
 * @param {{
 *   cli: string,
 *   argv?: string[] | null,
 *   spawn?: ((bin: string, argv: string[]) => { status?: number, stdout?: string, stderr?: string }) | null,
 *   flowGraph?: unknown,
 *   architectureSketch?: unknown,
 *   complexTasks?: unknown[] | null,
 * }} input
 */
/**
 * One step of the 3-review loop after both. Mix of the stamped block stops.
 * @param {Parameters<typeof runPhaseReviewLoop>[0]} input
 */
export function continuePhaseAfterReview(input) {
  return runPhaseReviewLoop(input);
}

/**
 * Phase close: claim report + plan-tree product fence.
 * @param {Parameters<typeof phaseCloseFenceOk>[0]} input
 */
export function validatePhaseClose(input) {
  return phaseCloseFenceOk(input);
}

export function runPhaseReviewBoth(input) {
  const brief = buildPhaseReviewBrief({
    flowGraph: input.flowGraph,
    architectureSketch: input.architectureSketch,
    complexTasks: input.complexTasks,
  });
  const argv = Array.isArray(input.argv) ? input.argv : ['review'];
  const spawn =
    typeof input.spawn === 'function'
      ? input.spawn
      : (bin, args) =>
          spawnSync(bin, args, { encoding: 'utf8', input: brief });
  return runExternalReviewCli({ cli: input.cli, argv, spawn });
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
  gitExec(root, ['worktree', 'remove', '--force', worktreePath]);
  rmSync(worktreePath, { recursive: true, force: true });
  gitOrThrow(root, ['worktree', 'add', '-B', writerBranch, worktreePath, 'HEAD'], 'git worktree add');

  const statusRoot = dirname(lockDir);
  let leaseSecret = null;
  let writerPid;
  let started = null;
  let lockHeld = false;
  const ownerPid = process.pid;
  try {
    let lease;
    try {
      lease = acquireLeaseFile(
        statusRoot,
        buildActiveLease({ planSlug: slug, phaseId, hostId: host, worktreePath, writerBranch }),
      );
    } catch (err) {
      if (err && /** @type {any} */ (err).code === 'LEASE_EXISTS') {
        throw new Error(
          `${err instanceof Error ? err.message : String(err)} (${leasePath(statusRoot, slug)})`,
        );
      }
      throw err;
    }
    leaseSecret = lease.secret;
    writePenLock(lockPath, { owner: host, pid: ownerPid, writerWorktree: worktreePath });
    lockHeld = true;
    started = startHost({
      bin: hostBin,
      argv: hostArgv(args, env),
      cwd: worktreePath,
      input: input.prompt,
      env: { ...env, AUTOMATE_PEN_LOCK: lockPath, AUTOMATE_WRITER_WORKTREE: worktreePath },
    });
    writerPid = started.pid;
    if (!Number.isInteger(writerPid) || writerPid <= 0) {
      const failed = await started.wait(Number(env.AUTOMATE_WRITER_TIMEOUT_MS || 5_000));
      throw new Error(`host CLI did not start${failed.stderr ? `: ${failed.stderr}` : ''}`);
    }
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
    gitExec(root, ['worktree', 'remove', '--force', worktreePath]);
    rmSync(worktreePath, { recursive: true, force: true });
    gitExec(root, ['branch', '-D', writerBranch]);
    if (lockHeld) removePenLock(lockPath, ownerPid);
    if (leaseSecret) {
      const leftover = leasePath(statusRoot, slug);
      const cleared = clearLeaseFile(statusRoot, slug, leaseSecret);
      if (!cleared && existsSync(leftover)) {
        throw new Error(`clearLeaseFile left residue (${leftover})`);
      }
    }
  }
}


function saveRunState(path,state) {
  mkdirSync(dirname(path),{recursive:true});
  writeFileSync(path+'.tmp',JSON.stringify(state,null,2)+'\n');renameSync(path+'.tmp',path);
}
function loadRunState(path) {
  if (!existsSync(path)) return {schemaVersion:1,stage:'plan',round:1,confirmedStops:[],residualFindings:[]};
  const state=JSON.parse(readFileSync(path,'utf8'));
  if(state.schemaVersion!==1 || !['plan','audit','pr','complete'].includes(state.stage) || !Number.isInteger(state.round) || state.round<1 || state.round>3) throw new Error('invalid saved automate state');
  return state;
}
function parseReviewResult(result) {
  if(!result || result.status!==0) throw new Error(`review process failed: ${result?.stderr||'missing process receipt'}`);
  let body;try {body=JSON.parse(result.stdout);}catch {throw new Error('review output must be structured JSON');}
  if(!body || !['PASSED','CLOSED','PARTIAL','OPEN'].includes(body.verdict) || !Array.isArray(body.findings)) throw new Error('review output missing verdict or findings');
  if(body.findings.some(f=>!f || typeof f!=='object' || Array.isArray(f) || (!f.stampedBlockMix && !['critical','major','blocker','high','medium','minor','low','info'].includes(String(f.severity||f.level||'').toLowerCase())))) throw new Error('invalid review finding');
  if(body.verdict==='OPEN' && body.findings.length===0) throw new Error('OPEN verdict without actionable findings');
  return body;
}
function reviewVerdictAccepted(stage, verdict) {
  return (stage === 'plan' ? ['PASSED','CLOSED'] : ['PASSED','CLOSED','PARTIAL']).includes(verdict);
}

function repairWriterArgs(host, args, plan, prompt) {
  let argv = hostArgv(args, process.env);
  if (!argv.length) {
    if (host === 'codex') argv = ['exec','--sandbox','workspace-write','-'];
    else if (host === 'grok') {
      const promptPath = join(dirname(plan), `automate-${args.phase}-prompt.txt`);
      writeFileSync(promptPath, prompt);
      argv = ['--prompt-file',promptPath,'--sandbox','workspace-write','--no-memory','--output-format','plain'];
    } else argv = ['-p','--output-format','text','--permission-mode','bypassPermissions'];
  }
  return {...args, hostArgs:JSON.stringify(argv)};
}
function collectPhaseResiduals(plan,root) {
  const {fm}=readFinalPlan(plan);const rows=[];const dir=dirname(plan);
  for(const phase of fm.phases||[]) {
    const raw=phase.deliveryAuditGate?.reportPath;
    if(raw) {
      const base=String(raw).startsWith('.atomic-skills/')?root:dir;
      const path=realpathSync(resolve(base,raw));const confined=realpathSync(root);
      if(path!==confined && !path.startsWith(confined+sep)) throw new Error('phase report escapes root');
      const body=readFileSync(path,'utf8');if(!body.trim() || Buffer.byteLength(body)>2_000_000) throw new Error('invalid phase report');
      rows.push({phaseId:phase.id,reportPath:raw,report:body});
    }
    if(Array.isArray(phase.remainingFindings)) rows.push({phaseId:phase.id,findings:phase.remainingFindings});
  }
  const residualPath=join(root,'.atomic-skills/status/automate',`${fm.slug}-residuals.json`);
  if(existsSync(residualPath)) rows.push(JSON.parse(readFileSync(residualPath,'utf8')));
  return rows;
}
function previewUrl(plan,root) {
  const html=join(dirname(plan),'flow/flow.html');
  const result=spawnSync(process.execPath,[join(ROOT,'scripts/serve-flow.js'),'--up',html,'--plan',plan],{encoding:'utf8',cwd:root,timeout:15000});
  if(result.status!==0) throw new Error(`preview failed: ${result.stderr}`);
  const url=result.stdout.trim();if(!/^http:\/\/127\.0\.0\.1:\d+\/flow\.html$/.test(url)) throw new Error('invalid preview origin');
  return url;
}
function openPage(url) {
  const command=process.platform==='darwin'?'open':process.platform==='win32'?'cmd':'xdg-open';
  const argv=process.platform==='win32'?['/c','start','',url]:[url];
  const child=spawn(command,argv,{stdio:'ignore',detached:true});child.on('error',()=>{});child.unref();
}
function writePlanEndReceipt(plan,receipt) {
  const path=join(dirname(plan),'automate-plan-end-review.json');
  writeFileSync(path+'.tmp',JSON.stringify(receipt,null,2)+'\n');renameSync(path+'.tmp',path);
}

function defaultPr(input) {
  const bin=input.args?.githubBin||process.env.AUTOMATE_GITHUB_BIN||'gh';
  const branch=gitOrThrow(input.root,['rev-parse','--abbrev-ref','HEAD'],'read branch').stdout.trim();
  if(branch==='HEAD') throw new Error('PR requires a branch');
  gitOrThrow(input.root,['push','--set-upstream','origin',branch],'deliver branch');
  const existing=spawnSync(bin,['pr','view','--json','url,state'],{cwd:input.root,encoding:'utf8'});
  if(existing.status===0) {
    const pr=JSON.parse(existing.stdout);if(pr.state!=='OPEN') throw new Error('existing PR is not open');return pr;
  }
  let base=input.args?.prBase||process.env.AUTOMATE_PR_BASE;
  if(!base) {const ref=gitExec(input.root,['symbolic-ref','refs/remotes/origin/HEAD']);if(ref.status===0) base=ref.stdout.trim().replace(/^refs\/remotes\/origin\//,'');}
  if(!base) throw new Error('PR base is required (--pr-base or origin/HEAD)');
  const bodyPath=join(dirname(input.plan),'automate-pr-body.txt');
  writeFileSync(bodyPath,`Delivered the ratified plan on the branch.\n\nReviews: whole plan and delivery audit, including phase residual findings.\n\nValidate delivery on the HTTP final page before finalize/archive.\n`);
  const result=spawnSync(bin,['pr','create','--base',base,'--head',branch,'--title',`Deliver ${planSlugOf(input.plan)}`,'--body-file',bodyPath],{cwd:input.root,encoding:'utf8'});
  if(result.status!==0) throw new Error(`PR create failed: ${result.stderr}`);
  const url=result.stdout.trim();if(!/^https?:\/\//.test(url)) throw new Error('PR create returned no URL');
  return {url,state:'OPEN'};
}
/** Production plan-end state machine. No PR merge or archive operation. */
export async function runPlanEndWorkflow(input) {
  const plan=resolve(input.plan);const root=resolve(input.root||dirname(plan));const deps=input.deps||{};
  const statePath=join(dirname(plan),'automate-run-state.json');let state=loadRunState(statePath);
  const preview=deps.preview||(()=>previewUrl(plan,root));const open=deps.open||openPage;
  const page=async()=>new URL('/final',await preview()).href;
  const stop=async(reason,findings)=>{
    state.pendingStop={id:`${state.stage}-${reason}-${state.round}-${Date.now()}`,reason,stage:state.stage,findings};
    saveRunState(statePath,state);const url=`${await page()}?stop=${encodeURIComponent(state.pendingStop.id)}`;open(url);
    return {action:'stop',reason,url};
  };
  if(state.pendingStop) {const url=`${await page()}?stop=${encodeURIComponent(state.pendingStop.id)}`;open(url);return {action:'stop',reason:state.pendingStop.reason,url};}
  const currentInputs=validationSnapshot(plan,{reviewInputs:true});
  state.reviewRounds ||= {
    plan:state.stage==='plan' ? state.round : Math.max(1,...(state.reviews||[]).filter(r=>r.stage==='plan').map(r=>r.round)),
    audit:state.stage==='audit' ? state.round : Math.max(1,...(state.reviews||[]).filter(r=>r.stage==='audit').map(r=>r.round)),
  };
  const invalidateReviews = snapshot => {
    if (state.stage !== 'plan') state.reviewRounds.plan = Math.min(3, state.reviewRounds.plan + 1);
    state.stage = 'plan';
    state.round = state.reviewRounds.plan;
    state.reviews = [];
    state.residualFindings = [];
    state.reviewInputSnapshot = snapshot;
    rmSync(join(dirname(plan),'automate-plan-end-review.json'), {force:true});
  };
  // Compare before adopting current inputs at EVERY saved stage, including PR
  // retries. Invalidation keeps the durable stage budgets rather than resetting
  // the repair cap whenever an audit repair changes source.
  if (state.reviewInputSnapshot !== undefined && state.reviewInputSnapshot !== currentInputs) {
    invalidateReviews(currentInputs);
    return stop('não avanço',[{title:'Delivery changed since the saved reviews; confirm to review the current source again'}]);
  }
  if (!state.reviewInputSnapshot && state.stage !== 'plan') {
    invalidateReviews(currentInputs);
    return stop('não avanço',[{title:'Saved reviews lack input identity; confirm to review the current source'}]);
  }
  if(state.stage==='complete') {
    const url=await page();return {action:'pr-open',pr:state.pr,url};
  }
  state.reviewInputSnapshot=currentInputs;
  if(!finalAuditsPassed(plan)) return stop('não avanço',[{title:'Waiting for every phase delivery audit to pass'}]);
  let residuals;try{residuals=collectPhaseResiduals(plan,root);}catch(e){return stop('não avanço',[{title:e.message}]);}
  state.phaseResiduals=residuals;saveRunState(statePath,state);
  const localBin=resolveHostBin(input.host,input.args||{},process.env);
  const review=deps.review||((request)=>{
    const prompt=`Return only the structured JSON specified by outputContract. No Markdown fences.\n${request.brief}`;
    const invoke=(provider,bin)=>{
      let argv;
      if(process.env.AUTOMATE_REVIEW_ARGS) argv=hostArgv({hostArgs:process.env.AUTOMATE_REVIEW_ARGS},process.env);
      else if(provider==='codex') argv=['exec','--sandbox','read-only','-'];
      else if(provider==='grok') {const promptPath=join(dirname(plan),`automate-${request.stage}-review-prompt.txt`);writeFileSync(promptPath,prompt);argv=['--prompt-file',promptPath,'--sandbox','read-only','--no-memory','--output-format','plain'];}
      else argv=['-p','--output-format','text','--permission-mode','dontAsk','--tools','Read,Grep,Glob'];
      return spawnSync(bin,argv,{cwd:root,encoding:'utf8',input:prompt,timeout:120000});
    };
    const localProvider=input.host==='claude-code'?'claude':input.host;
    if(localProvider===input.cli) throw new Error('external review must use a different provider');
    const local=invoke(localProvider,localBin);
    const external=invoke(input.cli,input.args?.reviewBin||process.env.AUTOMATE_REVIEW_BIN||input.cli);
    const a=parseReviewResult(local);const b=parseReviewResult(external);
    const verdict = reviewVerdictAccepted(request.stage,a.verdict) && reviewVerdictAccepted(request.stage,b.verdict) ? b.verdict : 'OPEN';
    return {status:0,stderr:external.stderr||'',stdout:JSON.stringify({...b,verdict,legVerdicts:{local:a.verdict,external:b.verdict},findings:[...a.findings,...b.findings]}),local,external};
  });
  const fix=deps.fix||(async request=>{
    const prompt=JSON.stringify({
      operation:request.stage==='plan'?'repair-whole-plan':'repair-delivery',
      scope:'current review findings only', stage:request.stage, round:request.round,
      findings:request.findings, reviewContext:JSON.parse(request.brief),
      constraints:['Repair product source in the isolated writer worktree.',
        'Do not change ratified plan, architecture, flow, receipts, or operational project state.',
        'Do not publish, merge a PR, finalize, archive, or stamp operator validation.'],
      requiredVerification:['Reproduce the current findings before editing.',
        'Add relevant regression tests and run the affected existing tests after repair.',
        'Leave the source and test changes ready for the coordinator to commit.'],
    },null,2);
    const args=repairWriterArgs(input.host,{...(input.args||{}),phase:`${request.stage}-fix-${request.round}`},plan,prompt);
    const code=await runWriterSession({host:input.host,root,plan,args,prompt});return {ok:code===0};
  });
  while(state.stage==='plan'||state.stage==='audit') {
    const stage=state.stage;let parsed,result;
    const brief=JSON.stringify({operation:stage==='plan'?'review-whole-plan':'audit-delivery',scope:'whole-plan',productIdentity:productSnapshot(plan),plan:readFileSync(plan,'utf8'),flowGraph:JSON.parse(readFileSync(join(dirname(plan),'flow/flow.json'),'utf8')),architectureSketch:JSON.parse(readFileSync(join(dirname(plan),'architecture/decisions.json'),'utf8')),phaseResiduals:residuals,priorReviews:state.reviews||[],outputContract:{verdict:'PASSED|CLOSED|PARTIAL|OPEN',findings:'array with severity and title',intentVsDelivered:'non-empty array for audit with matched|partial|missing|extra',graphCoverage:'audit array of {kind:machine|xor,id,status:faz|pela metade|não faz} covering every machine and xor in the supplied ratified graph'}},null,2);
    try{result=await review({stage,round:state.round,brief});parsed=parseReviewResult(result);}catch(e){return stop('não avanço',[{title:e.message}]);}
    let decision=continuePhaseAfterReview({slug:planSlugOf(plan),round:state.round,findings:parsed.findings});
    if(decision.action==='close-and-advance' && !reviewVerdictAccepted(stage,parsed.verdict)) {
      decision = state.round >= 3 ? {action:'stop',reason:'round-cap'} : {action:'fix-and-review'};
    }
    const reportPath=join(dirname(plan),`automate-${stage}-review-${state.round}.json`);
    writeFileSync(reportPath,JSON.stringify({stage,round:state.round,command:input.cli,exit:result.status,stderr:result.stderr||'',local:result.local||null,external:result.external||null,...parsed},null,2)+'\n');
    state.reviews=[...(state.reviews||[]),{stage,round:state.round,reportPath,verdict:parsed.verdict}];saveRunState(statePath,state);
    if(decision.action==='stop') return stop(decision.reason==='mix'?'mudança grande':'travei',parsed.findings);
    if(decision.action==='fix-and-review') {
      let fixed;try{fixed=await fix({stage,round:state.round,findings:parsed.findings,brief});}catch(e){return stop('não avanço',[{title:e.message}]);}
      if(!fixed || fixed.ok!==true) return stop('não avanço',parsed.findings);
      const repairedInputs=validationSnapshot(plan,{reviewInputs:true});
      state.reviewRounds[stage]=state.round+1;
      if(stage==='audit' && repairedInputs!==state.reviewInputSnapshot) invalidateReviews(repairedInputs);
      else {state.reviewInputSnapshot=repairedInputs;state.round=state.reviewRounds[stage];}
      saveRunState(statePath,state);continue;
    }
    state.residualFindings=[...(state.residualFindings||[]),...parsed.findings.map(f=>({...f,stage}))];
    if(stage==='plan') {state.stage='audit';state.round=state.reviewRounds.audit;saveRunState(statePath,state);continue;}
    const coverageRows=parsed.graphCoverage;
    if(!Array.isArray(coverageRows)||coverageRows.some(row=>!row||!['machine','xor'].includes(row.kind)||!/^[A-Za-z][A-Za-z0-9_.]*$/.test(row.id)||!['faz','pela metade','não faz'].includes(row.status))) return stop('não avanço',[{title:'Delivery audit lacks structured graph coverage'}]);
    const flowPath=join(dirname(plan),'flow/flow.json');
    const coverage=deliveryAuditGraphCoverage({planPath:plan,flowPath,exists:existsSync,readFile:path=>readFileSync(path,'utf8'),reportText:coverageRows.map(row=>`${row.kind} ${row.id}: ${row.status}`).join('\n')});
    if(!coverage.ok) return stop('não avanço',[{title:coverage.reason}]);
    if(!Array.isArray(parsed.intentVsDelivered)||!parsed.intentVsDelivered.length||parsed.intentVsDelivered.some(row=>!['matched','partial','missing','extra'].includes(row.status))) return stop('não avanço',[{title:'Delivery audit lacks intent-vs-delivered rows'}]);
    const provider=String(input.cli||'').replace('claude-code','claude');
    if(!['grok','codex','claude'].includes(provider)) return stop('não avanço',[{title:'Unknown external review provider'}]);
    const receipt={mode:'external-both',reviewFile:reportPath,verifiedAt:new Date().toISOString(),reviewInputSnapshot:state.reviewInputSnapshot,legs:[{provider,status:'succeeded',familyDifferent:true}],intentVsDelivered:parsed.intentVsDelivered,graphCoverage:coverage.lines};
    writePlanEndReceipt(plan,receipt);state.stage='pr';state.round=1;saveRunState(statePath,state);
  }
  const reviewedInputs=validationSnapshot(plan,{reviewInputs:true});
  if(state.reviewInputSnapshot!==reviewedInputs) {invalidateReviews(reviewedInputs);return stop('não avanço',[{title:'Delivery changed while reviews ran; confirm to review the current source again'}]);}
  try{
    state.pr=await (deps.createPr||(()=>defaultPr({...input,plan,root})))();
    if(!state.pr || state.pr.state!=='OPEN'||!/^https?:\/\//.test(state.pr.url||'')) throw new Error('PR must exist and remain open');
  }catch(e){return stop('não avanço',[{title:e.message}]);}
  state.stage='complete';saveRunState(statePath,state);const url=await page();open(url);return {action:'pr-open',pr:state.pr,url};
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

  const planPath = resolve(args.plan);
  const prepared = prepareReviewExternalCli({
    planPath,
    host,
    env: process.env,
  });

  const milestone=process.env.AUTOMATE_STOP_AFTER_MERGE==='1';
  if(!prepared.ok && !milestone) {
    process.stderr.write(`implement --automate refused: ${prepared.reason||'reviewExternalCli is required'}\n`);process.exit(1);
  }
  const statePath=join(dirname(planPath),'automate-run-state.json');
  const run=async()=>{
    if(!existsSync(statePath)) await runWriterSession({host,root,plan:planPath,args});
    if(milestone) return 0;
    const outcome=await runPlanEndWorkflow({host,root,plan:planPath,args,cli:prepared.cli});
    process.stdout.write(JSON.stringify(outcome)+'\n');return outcome.action==='stop'?2:0;
  };
  run().then(code=>process.exit(code),err=>{process.stderr.write(`implement --automate failed: ${err.message}\n`);process.exit(1);});
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  if (args.hostWriteProbe) {
    hostShapedWrite(args);
    process.exit(0);
  }
  main();
}
