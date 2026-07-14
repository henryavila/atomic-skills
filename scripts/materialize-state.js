#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fchmodSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import Ajv from 'ajv/dist/2020.js';
import { parseFrontmatter, validateFile } from './validate-state.js';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(SCRIPT_DIR, '..');
const MARKER_NAME = '.materialize-state.json';
const LOCK_NAME = '.materialize-state.lock';
const LOCK_GUARD_SETUP_RETRIES = 3;
const LOCK_GUARD_RETRIES = 100;
const LOCK_GUARD_RETRY_MS = 10;
const LOCK_GUARD_WAIT = new Int32Array(new SharedArrayBuffer(4));
const REQUIRED_SCHEMAS = ['common.schema.json', 'plan.schema.json', 'initiative.schema.json'];

function hashBytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function hashFile(path) {
  return existsSync(path) ? hashBytes(readFileSync(path)) : null;
}

function safeRelativePath(root, input, label) {
  if (typeof input !== 'string' || input.length === 0 || isAbsolute(input)) {
    throw new Error(`${label} must be a non-empty path relative to root`);
  }
  const absolute = resolve(root, input);
  const rel = relative(root, absolute);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`${label} escapes root`);
  }
  return rel;
}

function lstatIfExists(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function assertNoSymlinkComponents(root, relativePath, label) {
  const parts = relativePath.split(sep).filter(Boolean);
  let current = root;
  for (let index = 0; index < parts.length; index += 1) {
    current = join(current, parts[index]);
    const stat = lstatIfExists(current);
    if (!stat) return;
    if (stat.isSymbolicLink()) {
      throw new Error(`${label} traverses symbolic link at ${relative(root, current)}`);
    }
    if (index < parts.length - 1 && !stat.isDirectory()) {
      throw new Error(`${label} traverses non-directory at ${relative(root, current)}`);
    }
  }
}

function validateMaterializationTopology(planRel, initiativeRel) {
  if (basename(planRel) !== 'plan.md') {
    throw new Error('planPath must identify a plan.md file');
  }
  if (dirname(initiativeRel) !== join(dirname(planRel), 'phases')) {
    throw new Error("initiativePath must be inside the supplied plan's phases directory");
  }
  if (!basename(initiativeRel).endsWith('.md')) {
    throw new Error('initiativePath must identify a Markdown file');
  }
}

function transactionPaths(planRel, initiativeRel, txId) {
  const txDir = join(dirname(planRel), `.materialize-state-${txId}`);
  return {
    txDir,
    stagedPlan: join(txDir, 'stage', planRel),
    stagedInitiative: join(txDir, 'stage', initiativeRel),
    beforePlan: join(txDir, 'before', planRel),
    beforeInitiative: join(txDir, 'before', initiativeRel),
  };
}

function fsyncPath(path) {
  const fd = openSync(path, 'r');
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function durableWrite(path, bytes, flag = 'w', mode = 0o600) {
  mkdirSync(dirname(path), { recursive: true });
  const fd = openSync(path, flag, mode);
  try {
    fchmodSync(fd, mode);
    writeFileSync(fd, bytes);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  fsyncPath(dirname(path));
}

function durableRename(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  renameSync(from, to);
  fsyncPath(dirname(to));
  if (dirname(from) !== dirname(to) && existsSync(dirname(from))) fsyncPath(dirname(from));
}

function durableUnlink(path) {
  try {
    unlinkSync(path);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  fsyncPath(dirname(path));
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function readProcessIdentity(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    if (process.platform === 'linux') {
      const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
      const commandEnd = stat.lastIndexOf(')');
      if (commandEnd < 0) return null;
      const fieldsAfterCommand = stat.slice(commandEnd + 1).trim().split(/\s+/);
      const startTicks = fieldsAfterCommand[19];
      return startTicks ? `linux:${startTicks}` : null;
    }

    if (process.platform === 'win32') {
      const executable = process.env.SystemRoot
        ? join(
          process.env.SystemRoot,
          'System32',
          'WindowsPowerShell',
          'v1.0',
          'powershell.exe',
        )
        : 'powershell.exe';
      const output = execFileSync(
        executable,
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `(Get-Process -Id ${pid} -ErrorAction Stop).StartTime.ToUniversalTime().Ticks`,
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
      ).trim();
      return output ? `win32:${output}` : null;
    }

    const output = execFileSync(
      '/bin/ps',
      ['-o', 'lstart=', '-p', String(pid)],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        env: {
          ...process.env,
          LANG: 'C',
          LANGUAGE: 'C',
          LC_ALL: 'C',
          TZ: 'UTC',
        },
      },
    ).trim().replace(/\s+/g, ' ');
    return output ? `${process.platform}:${output}` : null;
  } catch {
    return null;
  }
}

const SELF_PROCESS_IDENTITY = readProcessIdentity(process.pid);

function isLockOwnerAlive(owner) {
  if (!isProcessAlive(owner.pid)) return false;
  if (typeof owner.processIdentity !== 'string') return true;
  const currentIdentity = owner.pid === process.pid
    ? SELF_PROCESS_IDENTITY
    : readProcessIdentity(owner.pid);
  // Identity lookup failure is ambiguous, so preserve fail-closed behavior.
  return currentIdentity === null || currentIdentity === owner.processIdentity;
}

function readLockOwner(lockPath) {
  try {
    const owner = JSON.parse(readFileSync(lockPath, 'utf8'));
    if (owner?.version !== 1
        || !Number.isInteger(owner.pid)
        || owner.pid <= 0
        || typeof owner.token !== 'string'
        || owner.token.trim() === ''
        || (owner.processIdentity !== undefined
          && (typeof owner.processIdentity !== 'string'
            || owner.processIdentity.trim() === ''))) return null;
    return owner;
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined;
    return null;
  }
}

function ownerBytes(token, extra = {}) {
  return `${JSON.stringify({
    version: 1,
    pid: process.pid,
    ...(SELF_PROCESS_IDENTITY ? { processIdentity: SELF_PROCESS_IDENTITY } : {}),
    token,
    ...extra,
  })}\n`;
}

function readGuardClaim(claimPath) {
  const owner = readLockOwner(claimPath);
  if (owner == null) return owner;
  if (typeof owner.choosing !== 'boolean') return null;
  if (!owner.choosing && (!Number.isSafeInteger(owner.ticket) || owner.ticket <= 0)) return null;
  return owner;
}

function liveGuardClaims(guardPath) {
  const claims = [];
  for (const entry of readdirSync(guardPath, { withFileTypes: true })) {
    if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith('.json')) {
      throw new Error('materialization lock guard contains an unsupported claim entry');
    }
    const path = join(guardPath, entry.name);
    const owner = readGuardClaim(path);
    if (owner === undefined) continue;
    if (owner === null) {
      throw new Error('materialization lock guard contains an unreadable claim');
    }
    if (!isLockOwnerAlive(owner)) {
      releaseOwnedFile(path, owner.token);
      continue;
    }
    claims.push({ owner, path });
  }
  return claims;
}

function acquireMaterializationLockGuard(guardPath, faultAt = null) {
  const token = randomUUID();
  const claimPath = join(guardPath, `${token}.json`);
  const claimTempPath = `${guardPath}.${token}.tmp`;
  let claimPublished = false;
  for (let attempt = 0; attempt < LOCK_GUARD_SETUP_RETRIES; attempt += 1) {
    try {
      mkdirSync(guardPath, { recursive: true, mode: 0o700 });
      injectFault('after-guard-mkdir', faultAt);
      const guardStat = lstatSync(guardPath);
      if (!guardStat.isDirectory() || guardStat.isSymbolicLink()) {
        throw new Error('materialization lock guard path is not a real directory');
      }
      durableWrite(claimTempPath, ownerBytes(token, { choosing: true, ticket: null }), 'wx');
      durableRename(claimTempPath, claimPath);
      claimPublished = true;
      break;
    } catch (error) {
      if (existsSync(claimTempPath)) durableUnlink(claimTempPath);
      if (existsSync(claimPath)) releaseOwnedFile(claimPath, token);
      if (error?.code === 'ENOENT' && attempt < LOCK_GUARD_SETUP_RETRIES - 1) continue;
      throw error;
    }
  }
  if (!claimPublished) throw new Error('materialization lock guard setup could not stabilize');

  const ticketTempPath = `${guardPath}.${token}.ticket.tmp`;
  let ticket;
  try {
    const claims = liveGuardClaims(guardPath);
    const maxTicket = claims.reduce((max, claim) => (
      claim.owner.choosing ? max : Math.max(max, claim.owner.ticket)
    ), 0);
    ticket = maxTicket + 1;
    durableWrite(
      ticketTempPath,
      ownerBytes(token, { choosing: false, ticket }),
      'wx',
    );
    durableRename(ticketTempPath, claimPath);
  } catch (error) {
    if (existsSync(ticketTempPath)) durableUnlink(ticketTempPath);
    releaseOwnedFile(claimPath, token);
    cleanupGuardDirectory(guardPath);
    throw error;
  }
  let blockingPid = null;

  try {
    for (let attempt = 0; attempt < LOCK_GUARD_RETRIES; attempt += 1) {
      const claims = liveGuardClaims(guardPath);
      const ownClaim = claims.find((claim) => claim.owner.token === token);
      if (!ownClaim) throw new Error('materialization lock guard lost its own claim');
      const blocker = claims.find((claim) => (
        claim.owner.token !== token
        && (claim.owner.choosing
          || claim.owner.ticket < ticket
          || (claim.owner.ticket === ticket && claim.owner.token.localeCompare(token) < 0))
      ));
      if (!blocker) return { token, claimPath, guardPath };
      blockingPid = blocker.owner.pid;
      if (attempt < LOCK_GUARD_RETRIES - 1) {
        Atomics.wait(LOCK_GUARD_WAIT, 0, 0, LOCK_GUARD_RETRY_MS);
      }
    }
    throw new Error(
      `materialization lock guard is held by a live process (${blockingPid ?? 'unknown'})`,
    );
  } catch (error) {
    releaseOwnedFile(claimPath, token);
    cleanupGuardDirectory(guardPath);
    throw error;
  }
}

function releaseOwnedFile(path, token) {
  const owner = readLockOwner(path);
  if (owner?.token === token) durableUnlink(path);
}

function cleanupGuardDirectory(guardPath) {
  try {
    rmdirSync(guardPath);
  } catch (error) {
    if (error?.code !== 'ENOENT' && error?.code !== 'ENOTEMPTY') throw error;
  }
}

function releaseMaterializationLockGuard(guard) {
  releaseOwnedFile(guard.claimPath, guard.token);
  cleanupGuardDirectory(guard.guardPath);
}

function withMaterializationLockGuard(lockPath, operation, faultAt = null) {
  const guardPath = `${lockPath}.guard`;
  const guard = acquireMaterializationLockGuard(guardPath, faultAt);
  try {
    return operation();
  } finally {
    releaseMaterializationLockGuard(guard);
  }
}

function acquireMaterializationLock(lockPath, faultAt = null) {
  return withMaterializationLockGuard(lockPath, () => {
    const token = randomUUID();
    const lockTempPath = `${lockPath}.tmp`;
    const owner = readLockOwner(lockPath);
    if (owner === null) {
      throw new Error('materialization lock is unreadable; refusing to reclaim it');
    }
    if (owner !== undefined) {
      if (isLockOwnerAlive(owner)) {
        throw new Error(`materialization lock is held by a live process (${owner.pid})`);
      }
      durableUnlink(lockPath);
    }

    // The canonical path is authority only after a complete owner record is
    // durable. An interrupted temp write is therefore safe to reclaim.
    durableUnlink(lockTempPath);
    try {
      const fd = openSync(lockTempPath, 'wx', 0o600);
      try {
        fchmodSync(fd, 0o600);
        injectFault('after-lock-temp-open', faultAt);
        writeFileSync(fd, ownerBytes(token));
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      fsyncPath(dirname(lockTempPath));
      durableRename(lockTempPath, lockPath);
      return token;
    } catch (error) {
      if (existsSync(lockTempPath)) durableUnlink(lockTempPath);
      throw error;
    }
  }, faultAt);
}

function releaseMaterializationLock(lockPath, token) {
  // A legitimate contender never replaces a lock whose owning process is live,
  // so owner release must not depend on a possibly paused guard contender.
  releaseOwnedFile(lockPath, token);
}

function validators() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  for (const name of REQUIRED_SCHEMAS) {
    ajv.addSchema(JSON.parse(readFileSync(join(PACKAGE_ROOT, 'meta', 'schemas', name), 'utf8')));
  }
  return {
    validatePlan: ajv.getSchema('https://atomic-skills.henryavila.com/schemas/plan.schema.json'),
    validateInitiative: ajv.getSchema('https://atomic-skills.henryavila.com/schemas/initiative.schema.json'),
  };
}

function validateStagedPair(planPath, initiativePath) {
  const schemaValidators = validators();
  const planResult = validateFile(planPath, schemaValidators);
  const initiativeResult = validateFile(initiativePath, schemaValidators);
  const errors = [
    ...planResult.errors.map((error) => `plan: ${error}`),
    ...initiativeResult.errors.map((error) => `initiative: ${error}`),
  ];
  if (errors.length > 0) throw new Error(`staged pair validation failed: ${errors.join('; ')}`);

  const plan = parseFrontmatter(readFileSync(planPath, 'utf8')).frontmatter;
  const initiative = parseFrontmatter(readFileSync(initiativePath, 'utf8')).frontmatter;
  const phaseIds = new Set();
  const duplicatePhaseIds = new Set();
  for (const phase of plan.phases ?? []) {
    if (phaseIds.has(phase.id)) duplicatePhaseIds.add(phase.id);
    phaseIds.add(phase.id);
  }
  for (const phaseId of duplicatePhaseIds) {
    errors.push(`plan phase id "${phaseId}" is duplicated`);
  }
  const descriptor = plan.phases?.find((phase) => phase.id === initiative.phaseId);
  if (initiative.parentPlan !== plan.slug) errors.push('initiative parentPlan does not match plan slug');
  if (!descriptor) errors.push('plan has no descriptor matching initiative phaseId');
  if (descriptor?.slug !== initiative.slug) errors.push('descriptor slug does not match initiative slug');
  if (descriptor?.status !== 'active') errors.push('materialized descriptor is not active');
  if (initiative.status !== 'active') errors.push('materialized initiative is not active');
  if (descriptor?.subPhaseCount !== initiative.tasks?.length) {
    errors.push('descriptor subPhaseCount does not match initiative task count');
  }
  if (descriptor && descriptor.businessIntent === undefined) {
    errors.push('materialized descriptor businessIntent is required');
  }
  if (initiative.businessIntent === undefined) {
    errors.push('materialized initiative businessIntent is required');
  }
  if (descriptor?.businessIntent !== undefined
      && initiative.businessIntent !== undefined
      && !isDeepStrictEqual(descriptor.businessIntent, initiative.businessIntent)) {
    errors.push('descriptor businessIntent does not match initiative businessIntent');
  }
  if (typeof initiative.nextAction !== 'string' || initiative.nextAction.trim() === '') {
    errors.push('materialized initiative nextAction is required');
  }
  for (const task of initiative.tasks ?? []) {
    const taskId = typeof task?.id === 'string' && task.id.trim() !== '' ? task.id : '<unknown>';
    if (typeof task?.summary !== 'string' || task.summary.trim() === '') {
      errors.push(`task ${taskId} summary is required`);
    }
    if (!Number.isFinite(task?.weight)) {
      errors.push(`task ${taskId} weight is required`);
    }
    const hasVerifier = typeof task?.verifier?.kind === 'string'
      && task.verifier.kind.trim() !== '';
    const hasOutput = Array.isArray(task?.outputs)
      && task.outputs.some((output) => (
        typeof output?.path === 'string' && output.path.trim() !== ''
      ));
    if (!hasVerifier && !hasOutput) {
      errors.push(`task ${taskId} completion signal is required`);
    }
  }
  const current = plan.phases?.find((phase) => phase.id === plan.currentPhase);
  if (!current || current.status !== 'active') errors.push('plan currentPhase is not an active descriptor');
  if (plan.parallelismAllowed === false) {
    const activeDescriptors = plan.phases?.filter((phase) => phase.status === 'active') ?? [];
    if (activeDescriptors.length !== 1) {
      errors.push(`serial plan must have exactly one active descriptor (found ${activeDescriptors.length})`);
    }
    if (plan.currentPhase !== initiative.phaseId) {
      errors.push('serial plan currentPhase must match initiative phaseId');
    }
  }
  if (errors.length > 0) throw new Error(`staged pair validation failed: ${errors.join('; ')}`);
}

function readMarker(markerPath, root, planRel, initiativeRel) {
  let marker;
  try {
    marker = JSON.parse(readFileSync(markerPath, 'utf8'));
  } catch (error) {
    throw new Error(`pending materialization marker is unreadable: ${error.message}`);
  }
  if (marker?.version !== 1
      || typeof marker.txId !== 'string'
      || !/^[A-Za-z0-9._-]+$/.test(marker.txId)) {
    throw new Error('pending materialization marker has an unsupported shape');
  }
  for (const [label, value] of Object.entries(marker.paths ?? {})) {
    marker.paths[label] = safeRelativePath(root, value, `marker paths.${label}`);
  }
  for (const required of [
    'txDir',
    'plan',
    'initiative',
    'stagedPlan',
    'stagedInitiative',
    'beforePlan',
  ]) {
    if (!marker.paths?.[required]) throw new Error(`pending materialization marker lacks paths.${required}`);
  }
  for (const kind of ['plan', 'initiative']) {
    const before = marker.hashes?.[kind]?.before;
    const after = marker.hashes?.[kind]?.after;
    if ((before !== null && !/^[a-f0-9]{64}$/.test(before)) || !/^[a-f0-9]{64}$/.test(after ?? '')) {
      throw new Error(`pending materialization marker has invalid ${kind} hashes`);
    }
  }
  if (marker.hashes.initiative.before !== null && !marker.paths.beforeInitiative) {
    throw new Error('pending materialization marker lacks paths.beforeInitiative');
  }

  const expected = transactionPaths(planRel, initiativeRel, marker.txId);
  const expectedPaths = {
    plan: planRel,
    initiative: initiativeRel,
    txDir: expected.txDir,
    stagedPlan: expected.stagedPlan,
    stagedInitiative: expected.stagedInitiative,
    beforePlan: expected.beforePlan,
  };
  if (marker.paths.beforeInitiative) expectedPaths.beforeInitiative = expected.beforeInitiative;
  for (const [label, expectedPath] of Object.entries(expectedPaths)) {
    if (marker.paths[label] !== expectedPath) {
      throw new Error(`pending materialization marker has unexpected paths.${label}`);
    }
    assertNoSymlinkComponents(root, marker.paths[label], `marker paths.${label}`);
  }
  return marker;
}

function cleanup(root, markerPath, marker) {
  durableUnlink(markerPath);
  const txDir = resolve(root, marker.paths.txDir);
  rmSync(txDir, { recursive: true, force: true });
  if (existsSync(dirname(txDir))) fsyncPath(dirname(txDir));
}

function injectFault(point, selected) {
  if (typeof selected === 'function') selected(point);
  if (selected === point || process.env.MATERIALIZE_STATE_FAULT === point) {
    throw new Error(`fault injection: ${point}`);
  }
}

function recover(root, markerPath, marker, faultAt) {
  const absolute = Object.fromEntries(
    Object.entries(marker.paths).map(([key, value]) => [key, resolve(root, value)]),
  );
  const live = {
    plan: hashFile(absolute.plan),
    initiative: hashFile(absolute.initiative),
  };
  for (const kind of ['plan', 'initiative']) {
    const allowed = new Set([marker.hashes[kind].before, marker.hashes[kind].after]);
    if (!allowed.has(live[kind])) {
      throw new Error(`ambiguous live ${kind} hash; refusing recovery without writes`);
    }
  }

  if (live.plan === marker.hashes.plan.after && live.initiative === marker.hashes.initiative.after) {
    injectFault('before-complete-cleanup', faultAt);
    if (hashFile(absolute.plan) !== marker.hashes.plan.after
        || hashFile(absolute.initiative) !== marker.hashes.initiative.after) {
      throw new Error('completed materialization pair changed before cleanup; retaining marker');
    }
    cleanup(root, markerPath, marker);
    return { status: 'complete', txId: marker.txId, recovered: true };
  }

  const planNeedsPublish = live.plan === marker.hashes.plan.before;
  const initiativeNeedsPublish = live.initiative === marker.hashes.initiative.before;
  const stagedPlanReady = !planNeedsPublish || hashFile(absolute.stagedPlan) === marker.hashes.plan.after;
  const stagedInitiativeReady = !initiativeNeedsPublish
    || hashFile(absolute.stagedInitiative) === marker.hashes.initiative.after;

  if (stagedPlanReady && stagedInitiativeReady) {
    if (initiativeNeedsPublish) {
      injectFault('before-initiative-rename', faultAt);
      if (hashFile(absolute.initiative) !== marker.hashes.initiative.before) {
        throw new Error('live initiative changed before publish; refusing writes');
      }
      durableRename(absolute.stagedInitiative, absolute.initiative);
      injectFault('after-initiative-rename', faultAt);
    }
    if (planNeedsPublish) {
      if (hashFile(absolute.initiative) !== marker.hashes.initiative.after) {
        throw new Error('live initiative changed before plan publish; refusing writes');
      }
      injectFault('before-plan-rename', faultAt);
      if (hashFile(absolute.plan) !== marker.hashes.plan.before) {
        throw new Error('live plan changed before publish; refusing writes');
      }
      durableRename(absolute.stagedPlan, absolute.plan);
      injectFault('after-plan-rename', faultAt);
    }
    if (hashFile(absolute.plan) !== marker.hashes.plan.after
        || hashFile(absolute.initiative) !== marker.hashes.initiative.after) {
      throw new Error('published materialization pair changed before finalize; retaining marker');
    }
    cleanup(root, markerPath, marker);
    return { status: 'complete', txId: marker.txId, recovered: true };
  }

  // A lost staged file makes roll-forward impossible. Restore the descriptor
  // first so rollback never creates an active-plan-without-initiative window.
  if (live.plan === marker.hashes.plan.after) {
    if (hashFile(absolute.plan) !== marker.hashes.plan.after) {
      throw new Error('live plan changed before rollback; refusing writes');
    }
    if (hashFile(absolute.beforePlan) !== marker.hashes.plan.before) {
      throw new Error('rollback plan backup is missing or corrupt; refusing writes');
    }
    durableRename(absolute.beforePlan, absolute.plan);
  }
  if (live.initiative === marker.hashes.initiative.after) {
    if (hashFile(absolute.initiative) !== marker.hashes.initiative.after) {
      throw new Error('live initiative changed before rollback; refusing writes');
    }
    if (marker.hashes.initiative.before === null) {
      durableUnlink(absolute.initiative);
    } else {
      if (!absolute.beforeInitiative
          || hashFile(absolute.beforeInitiative) !== marker.hashes.initiative.before) {
        throw new Error('rollback initiative backup is missing or corrupt; refusing writes');
      }
      durableRename(absolute.beforeInitiative, absolute.initiative);
    }
  }
  injectFault('before-rollback-cleanup', faultAt);
  if (hashFile(absolute.plan) !== marker.hashes.plan.before
      || hashFile(absolute.initiative) !== marker.hashes.initiative.before) {
    throw new Error('rolled-back materialization pair changed before cleanup; retaining marker');
  }
  cleanup(root, markerPath, marker);
  return { status: 'rolled-back', txId: marker.txId, recovered: true };
}

/**
 * Publish one descriptor-only -> initiative transition as a recoverable pair.
 * Candidate contents are copied to same-filesystem staging and validated before
 * the immutable marker or either live path is touched.
 */
export function materializeState({
  root = process.cwd(),
  planPath,
  initiativePath,
  planContent,
  initiativeContent,
  planCandidatePath,
  initiativeCandidatePath,
  expectedPlanHash,
  txId = randomUUID(),
  faultAt = null,
} = {}) {
  const absoluteRoot = realpathSync(resolve(root));
  const planRel = safeRelativePath(absoluteRoot, planPath, 'planPath');
  const initiativeRel = safeRelativePath(absoluteRoot, initiativePath, 'initiativePath');
  validateMaterializationTopology(planRel, initiativeRel);
  assertNoSymlinkComponents(absoluteRoot, planRel, 'planPath');
  assertNoSymlinkComponents(absoluteRoot, initiativeRel, 'initiativePath');
  const planLive = resolve(absoluteRoot, planRel);
  const initiativeLive = resolve(absoluteRoot, initiativeRel);
  const markerPath = join(dirname(planLive), MARKER_NAME);
  const markerRel = relative(absoluteRoot, markerPath);
  assertNoSymlinkComponents(absoluteRoot, markerRel, 'materialization marker');
  if (!existsSync(planLive) && !existsSync(markerPath)) throw new Error('live plan does not exist');
  const lockPath = join(dirname(planLive), LOCK_NAME);
  const lockRel = relative(absoluteRoot, lockPath);
  assertNoSymlinkComponents(absoluteRoot, lockRel, 'materialization lock');
  const guardPath = `${lockPath}.guard`;
  const guardRel = relative(absoluteRoot, guardPath);
  assertNoSymlinkComponents(absoluteRoot, guardRel, 'materialization lock guard');
  const lockToken = acquireMaterializationLock(lockPath, faultAt);
  try {
    // Recovery is deliberately first and does not depend on caller-owned
    // candidate files, which may be gone after an interrupted invocation.
    if (existsSync(markerPath)) {
      const marker = readMarker(markerPath, absoluteRoot, planRel, initiativeRel);
      if (marker.paths.plan !== planRel || marker.paths.initiative !== initiativeRel) {
        throw new Error('pending materialization marker targets different live paths; refusing writes');
      }
      return recover(absoluteRoot, markerPath, marker, faultAt);
    }

    const candidatePlanContent = typeof planContent === 'string'
      ? planContent
      : (planCandidatePath ? readFileSync(resolve(absoluteRoot, planCandidatePath), 'utf8') : undefined);
    const candidateInitiativeContent = typeof initiativeContent === 'string'
      ? initiativeContent
      : (initiativeCandidatePath
        ? readFileSync(resolve(absoluteRoot, initiativeCandidatePath), 'utf8')
        : undefined);

    if (existsSync(initiativeLive)) {
      if (typeof candidatePlanContent === 'string'
          && typeof candidateInitiativeContent === 'string'
          && hashFile(planLive) === hashBytes(candidatePlanContent)
          && hashFile(initiativeLive) === hashBytes(candidateInitiativeContent)) {
        return { status: 'complete', txId: null, recovered: false, idempotent: true };
      }
      throw new Error('initiative already exists');
    }
    if (typeof candidatePlanContent !== 'string'
        || typeof candidateInitiativeContent !== 'string') {
      throw new Error('planContent and initiativeContent are required for a new transaction');
    }
    if (typeof expectedPlanHash !== 'string' || !/^[a-f0-9]{64}$/.test(expectedPlanHash)) {
      throw new Error('expectedPlanHash must be a lowercase sha256 hash for a new transaction');
    }
    if (hashFile(planLive) !== expectedPlanHash) {
      throw new Error('stale plan candidate: live plan hash does not match expectedPlanHash');
    }
    if (typeof txId !== 'string' || !/^[A-Za-z0-9._-]+$/.test(txId)) {
      throw new Error('txId must contain only letters, digits, dot, underscore, or hyphen');
    }

    const paths = transactionPaths(planRel, initiativeRel, txId);
    const txDirRel = paths.txDir;
    const stagedPlanRel = paths.stagedPlan;
    const stagedInitiativeRel = paths.stagedInitiative;
    const beforePlanRel = paths.beforePlan;
    const stagedPlan = resolve(absoluteRoot, stagedPlanRel);
    const stagedInitiative = resolve(absoluteRoot, stagedInitiativeRel);
    const beforePlan = resolve(absoluteRoot, beforePlanRel);
    const txDir = resolve(absoluteRoot, txDirRel);
    const planMode = lstatSync(planLive).mode & 0o7777;
    assertNoSymlinkComponents(absoluteRoot, txDirRel, 'transaction directory');
    if (lstatIfExists(txDir)) throw new Error('transaction directory already exists');

    let ownsTxDir = false;
    try {
      mkdirSync(txDir, { mode: 0o700 });
      ownsTxDir = true;
      durableWrite(stagedPlan, candidatePlanContent, 'w', planMode);
      durableWrite(stagedInitiative, candidateInitiativeContent);
      validateStagedPair(stagedPlan, stagedInitiative);

      const planBeforeBytes = readFileSync(planLive);
      if (hashBytes(planBeforeBytes) !== expectedPlanHash) {
        throw new Error('stale plan candidate: live plan hash does not match expectedPlanHash');
      }
      durableWrite(beforePlan, planBeforeBytes, 'w', planMode);
      const marker = {
        version: 1,
        operation: 'descriptor-only-to-initiative',
        txId,
        paths: {
          txDir: txDirRel,
          plan: planRel,
          initiative: initiativeRel,
          stagedPlan: stagedPlanRel,
          stagedInitiative: stagedInitiativeRel,
          beforePlan: beforePlanRel,
        },
        hashes: {
          plan: { before: expectedPlanHash, after: hashBytes(candidatePlanContent) },
          initiative: { before: null, after: hashBytes(candidateInitiativeContent) },
        },
      };
      durableWrite(markerPath, `${JSON.stringify(marker, null, 2)}\n`, 'wx');
      return recover(absoluteRoot, markerPath, marker, faultAt);
    } catch (error) {
      if (!existsSync(markerPath) && ownsTxDir) rmSync(txDir, { recursive: true, force: true });
      throw error;
    }
  } finally {
    releaseMaterializationLock(lockPath, lockToken);
  }
}

function option(args, name, { required = false } = {}) {
  const index = args.indexOf(name);
  if (index === -1) {
    if (required) throw new Error(`missing required option ${name}`);
    return null;
  }
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`option ${name} requires a value`);
  return value;
}

export function runMaterializeState(args, io = console) {
  const root = option(args, '--root') ?? process.cwd();
  const planPath = option(args, '--plan', { required: true });
  const initiativePath = option(args, '--initiative', { required: true });
  const planCandidate = option(args, '--plan-candidate');
  const initiativeCandidate = option(args, '--initiative-candidate');
  const result = materializeState({
    root,
    planPath,
    initiativePath,
    planCandidatePath: planCandidate,
    initiativeCandidatePath: initiativeCandidate,
    expectedPlanHash: option(args, '--expected-plan-hash'),
    txId: option(args, '--tx-id') ?? randomUUID(),
    faultAt: option(args, '--fault'),
  });
  io.log(JSON.stringify(result));
  return result;
}

const invokedDirectly = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  try {
    runMaterializeState(process.argv.slice(2));
  } catch (error) {
    console.error(`materialize-state: ${error.message}`);
    process.exitCode = 1;
  }
}
