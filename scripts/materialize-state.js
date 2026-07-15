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
import { withCompletionLedgerLock } from './append-completion.js';
import { buildPhaseDoneIdempotencyKey } from './phase-done-transaction.js';
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

export const MATERIALIZATION_PUBLISH_FAULTS = Object.freeze([
  'before-initiative-rename',
  'after-initiative-rename',
  'before-plan-rename',
  'after-plan-rename',
  'before-complete-cleanup',
]);

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
  if (process.platform === 'win32') return;
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
  const descriptorSummary = typeof descriptor?.summary === 'string' ? descriptor.summary.trim() : '';
  const initiativeSummary = typeof initiative.summary === 'string' ? initiative.summary.trim() : '';
  if (!descriptorSummary) errors.push('materialized descriptor summary is required');
  if (!initiativeSummary) errors.push('materialized initiative summary is required');
  if (descriptorSummary && initiativeSummary && descriptorSummary !== initiativeSummary) {
    errors.push('descriptor summary does not match initiative summary');
  }
  const hasConcreteNextAction = typeof initiative.nextAction === 'string'
    && initiative.nextAction.trim() !== '';
  const isIdleZeroTaskPhase = initiative.nextAction === null && initiative.tasks.length === 0;
  if (!hasConcreteNextAction && !isIdleZeroTaskPhase) {
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
  if (marker.authorization != null) {
    const authorization = marker.authorization;
    for (const field of ['targetPhaseId', 'prerequisitePhaseId', 'receiptPath', 'closeSha']) {
      if (typeof authorization[field] !== 'string' || authorization[field].length === 0) {
        throw new Error(`pending materialization marker has invalid authorization.${field}`);
      }
    }
    if (!fullCommitSha(authorization.closeSha)
        || !/^[a-f0-9]{64}$/.test(authorization.receiptDigest ?? '')
        || typeof authorization.receiptIdentity !== 'object'
        || typeof authorization.receiptSources !== 'object') {
      throw new Error('pending materialization marker has invalid successor authorization');
    }
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

function revalidateMarkerAuthorization(root, planRel, marker) {
  if (!marker.authorization) {
    try {
      const planPath = existsSync(resolve(root, marker.paths.stagedPlan))
        ? resolve(root, marker.paths.stagedPlan)
        : resolve(root, planRel);
      const initiativePath = existsSync(resolve(root, marker.paths.stagedInitiative))
        ? resolve(root, marker.paths.stagedInitiative)
        : resolve(root, marker.paths.initiative);
      const plan = readMarkdown(planPath, 'marker plan').frontmatter;
      const initiative = readMarkdown(initiativePath, 'marker initiative').frontmatter;
      const barrier = plan.stateIntegrityHardening?.successorBarriers
        ?.find((candidate) => candidate.phaseId === initiative.phaseId);
      if (barrier) {
        return { valid: false, error: 'pending successor marker lacks persisted authorization' };
      }
      return { valid: true };
    } catch (error) {
      return { valid: false, error: `cannot classify pending marker authorization: ${error.message}` };
    }
  }
  try {
    const authorization = marker.authorization;
    const current = assertSuccessorMaterializationAllowed({
      root,
      planPath: planRel,
      targetPhaseId: authorization.targetPhaseId,
      prerequisitePhaseId: authorization.prerequisitePhaseId,
      receiptPath: authorization.receiptPath,
      receiptIdentity: authorization.receiptIdentity,
      receiptSources: authorization.receiptSources,
      closeSha: authorization.closeSha,
    });
    if (current.receiptDigest !== authorization.receiptDigest) {
      throw new Error('receipt digest changed after transaction preparation');
    }
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

function recover(root, markerPath, marker, faultAt, {
  forceRollback = false,
  authorizationError,
} = {}) {
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

  if (!forceRollback
      && live.plan === marker.hashes.plan.after
      && live.initiative === marker.hashes.initiative.after) {
    const finalizeCompletedPair = () => {
      injectFault('before-complete-cleanup', faultAt);
      if (hashFile(absolute.plan) !== marker.hashes.plan.after
          || hashFile(absolute.initiative) !== marker.hashes.initiative.after) {
        throw new Error('completed materialization pair changed before cleanup; retaining marker');
      }
      cleanup(root, markerPath, marker);
      return { status: 'complete', txId: marker.txId, recovered: true };
    };
    if (marker.authorization) {
      return withCompletionLedgerLock(root, () => {
        const current = assertSuccessorMaterializationAllowedLocked({
          root,
          planPath: marker.paths.plan,
          targetPhaseId: marker.authorization.targetPhaseId,
          prerequisitePhaseId: marker.authorization.prerequisitePhaseId,
          receiptPath: marker.authorization.receiptPath,
          receiptIdentity: marker.authorization.receiptIdentity,
          receiptSources: marker.authorization.receiptSources,
          closeSha: marker.authorization.closeSha,
        });
        if (current.receiptDigest !== marker.authorization.receiptDigest) {
          throw new Error('receipt digest changed immediately before completed-pair cleanup');
        }
        return finalizeCompletedPair();
      });
    }
    return finalizeCompletedPair();
  }

  const planNeedsPublish = live.plan === marker.hashes.plan.before;
  const initiativeNeedsPublish = live.initiative === marker.hashes.initiative.before;
  const stagedPlanReady = !planNeedsPublish || hashFile(absolute.stagedPlan) === marker.hashes.plan.after;
  const stagedInitiativeReady = !initiativeNeedsPublish
    || hashFile(absolute.stagedInitiative) === marker.hashes.initiative.after;

  if (!forceRollback && stagedPlanReady && stagedInitiativeReady) {
    const publish = () => {
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
    };
    if (marker.authorization) {
      return withCompletionLedgerLock(root, () => {
        const current = assertSuccessorMaterializationAllowedLocked({
          root,
          planPath: marker.paths.plan,
          targetPhaseId: marker.authorization.targetPhaseId,
          prerequisitePhaseId: marker.authorization.prerequisitePhaseId,
          receiptPath: marker.authorization.receiptPath,
          receiptIdentity: marker.authorization.receiptIdentity,
          receiptSources: marker.authorization.receiptSources,
          closeSha: marker.authorization.closeSha,
        });
        if (current.receiptDigest !== marker.authorization.receiptDigest) {
          throw new Error('receipt digest changed immediately before successor publication');
        }
        return publish();
      });
    }
    return publish();
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
  return {
    status: 'rolled-back',
    txId: marker.txId,
    recovered: true,
    ...(authorizationError ? { authorizationError } : {}),
  };
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
  prerequisiteCloseSha,
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
      const authorization = revalidateMarkerAuthorization(absoluteRoot, planRel, marker);
      return recover(absoluteRoot, markerPath, marker, faultAt, {
        forceRollback: !authorization.valid,
        authorizationError: authorization.error,
      });
    }

    const candidatePlanContent = typeof planContent === 'string'
      ? planContent
      : (planCandidatePath ? readFileSync(resolve(absoluteRoot, planCandidatePath), 'utf8') : undefined);
    const candidateInitiativeContent = typeof initiativeContent === 'string'
      ? initiativeContent
      : (initiativeCandidatePath
        ? readFileSync(resolve(absoluteRoot, initiativeCandidatePath), 'utf8')
        : undefined);

    let successorAuthorization = null;
    if (typeof candidateInitiativeContent === 'string') {
      const livePlanDocument = readMarkdown(planLive, 'live plan');
      const candidateInitiative = parseFrontmatter(candidateInitiativeContent);
      if (candidateInitiative.error) {
        throw new Error(`initiative candidate is invalid: ${candidateInitiative.error}`);
      }
      const phaseId = candidateInitiative.frontmatter.phaseId;
      const barriers = livePlanDocument.frontmatter.stateIntegrityHardening
        ?.successorBarriers?.filter((barrier) => barrier.phaseId === phaseId) ?? [];
      if (barriers.length > 1) {
        throw new Error(`materialization has duplicate successor barriers for ${phaseId}`);
      }
      if (barriers.length === 1) {
        const barrier = barriers[0];
        if (!fullCommitSha(prerequisiteCloseSha)) {
          throw new Error(
            `${phaseId} materialization requires prerequisiteCloseSha from the phase close commit guard`,
          );
        }
        const authorization = assertSuccessorMaterializationAllowed({
          root: absoluteRoot,
          planPath: planRel,
          targetPhaseId: phaseId,
          prerequisitePhaseId: barrier.prerequisitePhaseId,
          receiptPath: barrier.receiptPath,
          receiptIdentity: barrier.receiptIdentity,
          receiptSources: barrier.receiptSources,
          closeSha: prerequisiteCloseSha,
        });
        successorAuthorization = {
          targetPhaseId: phaseId,
          prerequisitePhaseId: barrier.prerequisitePhaseId,
          receiptPath: barrier.receiptPath,
          receiptIdentity: structuredClone(barrier.receiptIdentity),
          receiptSources: structuredClone(barrier.receiptSources),
          closeSha: prerequisiteCloseSha,
          receiptDigest: authorization.receiptDigest,
        };
      }
    }

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
        ...(successorAuthorization ? { authorization: successorAuthorization } : {}),
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

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().flatMap((key) => (
        value[key] === undefined ? [] : [[key, canonicalize(value[key])]]
      )),
    );
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(canonicalize(value));
}

function digestValue(value) {
  return hashBytes(stableJson(value));
}

function historyPath(root, input, label, { mustExist = true } = {}) {
  const rel = safeRelativePath(root, input, label);
  assertNoSymlinkComponents(root, rel, label);
  const path = resolve(root, rel);
  if (mustExist && !existsSync(path)) throw new Error(`${label} does not exist: ${rel}`);
  return { rel, path };
}

function readMarkdown(path, label) {
  const raw = readFileSync(path, 'utf8');
  const parsed = parseFrontmatter(raw);
  if (parsed.error) throw new Error(`${label} is invalid: ${parsed.error}`);
  return { ...parsed, raw };
}

function reviewReceiptApproves(raw, sha, { mode, requireMode = false } = {}) {
  const parsed = parseFrontmatter(raw);
  if (parsed.error) return false;
  const receipt = parsed.frontmatter;
  const artifact = typeof receipt.artifact === 'string' ? receipt.artifact.trim() : '';
  const artifactTip = artifact.includes('..') ? artifact.split('..').at(-1) : artifact;
  const captureSection = parsed.body.match(/(?:^|\n)## Capture manifest\s*\n([\s\S]*?)(?=\n## |$)/)?.[1] ?? '';
  const captureModes = [...captureSection.matchAll(/^- Mode:\s*(local|codex|both)(?:;|\s*$)/gm)]
    .map((match) => match[1]);
  const declaredMode = typeof receipt.mode === 'string' ? receipt.mode : null;
  const legacyMode = captureModes.length === 1 ? captureModes[0] : null;
  const receiptMode = declaredMode ?? legacyMode;
  const modeContradiction = declaredMode != null
    && captureModes.some((captureMode) => captureMode !== declaredMode);
  return (receipt.final_verdict === 'approve' || receipt.final_verdict === 'approve_with_nits')
    && receipt.skill === 'review-code'
    && typeof receipt.reviewer === 'string'
    && receipt.reviewer.length > 0
    && artifactTip === sha
    && !modeContradiction
    && (!requireMode || receiptMode === mode)
    && (receipt.reviewed_commit === undefined || receipt.reviewed_commit === sha);
}

function fullCommitSha(value) {
  return typeof value === 'string' && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(value);
}

function gitOutput(root, args, label) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    const detail = error?.stderr?.trim();
    throw new Error(`${label}${detail ? `: ${detail}` : ''}`);
  }
}

function assertCommitExists(root, sha, label = 'commit') {
  if (!fullCommitSha(sha)) throw new Error(`${label} must be a full lowercase commit SHA`);
  gitOutput(root, ['cat-file', '-e', `${sha}^{commit}`], `${label} does not exist`);
  return sha;
}

function assertCommitAncestor(root, ancestor, descendant, label) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
      cwd: root,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
  } catch {
    throw new Error(`${label} is not an ancestor of closeSha`);
  }
}

function gitPathsAtCommit(root, sha, prefix, label) {
  try {
    const raw = execFileSync(
      'git',
      ['ls-tree', '-r', '-z', '--name-only', sha, '--', prefix],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return raw.split('\0').filter(Boolean);
  } catch (error) {
    const detail = error?.stderr?.trim();
    throw new Error(`${label}${detail ? `: ${detail}` : ''}`);
  }
}

function historicalPhaseInitiative({
  root,
  closeSha,
  planRel,
  planSlug,
  phase,
}) {
  const prefix = `${dirname(planRel)}/phases`;
  const matches = [];
  for (const path of gitPathsAtCommit(
    root,
    closeSha,
    prefix,
    `closeSha cannot enumerate historical ${phase.id} initiatives`,
  ).filter((candidate) => candidate.endsWith('.md'))) {
    let parsed;
    try {
      parsed = parseFrontmatter(gitOutput(
        root,
        ['show', `${closeSha}:${path}`],
        `closeSha cannot read historical initiative ${path}`,
      ));
    } catch {
      continue;
    }
    const candidate = parsed.error ? null : parsed.frontmatter;
    if (candidate?.parentPlan === planSlug
        && candidate?.phaseId === phase.id
        && candidate?.slug === phase.slug) {
      matches.push({ path, initiative: candidate });
    }
  }
  if (matches.length !== 1) {
    throw new Error(`historical ${phase.id} initiative must resolve uniquely at closeSha (found ${matches.length})`);
  }
  return matches[0];
}

function assertHistoricalInitiativeClosed({ phase, initiative }) {
  if (!terminalPhaseStatus(initiative.status)) {
    throw new Error(`historical ${phase.id} initiative is not terminal`);
  }
  if (!Array.isArray(initiative.tasks)
      || initiative.tasks.some((task) => task?.status !== 'done'
        || typeof task?.closedAt !== 'string' || task.closedAt.trim() === '')) {
    throw new Error(`historical ${phase.id} initiative contains an open or unclosed task`);
  }
  const planGates = phase.exitGate?.criteria;
  const initiativeGates = initiative.exitGates;
  if (!Array.isArray(planGates) || !Array.isArray(initiativeGates)) {
    throw new Error(`historical ${phase.id} initiative gate mirror is missing`);
  }
  const planIds = planGates.map((gate) => gate?.id);
  const initiativeIds = initiativeGates.map((gate) => gate?.id);
  if (planIds.some((id) => typeof id !== 'string' || id === '')
      || initiativeIds.some((id) => typeof id !== 'string' || id === '')
      || new Set(planIds).size !== planIds.length
      || new Set(initiativeIds).size !== initiativeIds.length
      || planIds.length !== initiativeIds.length
      || planIds.some((id) => !initiativeIds.includes(id))) {
    throw new Error(`historical ${phase.id} initiative gate mirror is not bijective`);
  }
  for (const planGate of planGates) {
    const initiativeGate = initiativeGates.find((gate) => gate.id === planGate.id);
    if (initiativeGate.status !== planGate.status
        || !isDeepStrictEqual(
          canonicalize(initiativeGate.evidence),
          canonicalize(planGate.evidence),
        )) {
      throw new Error(`historical ${phase.id} initiative gate ${planGate.id} mirror disagrees`);
    }
  }
}

function parseCompletionLog(path) {
  const raw = readFileSync(path, 'utf8');
  const records = [];
  raw.split(/\r?\n/).forEach((line, index) => {
    if (line.trim() === '') return;
    let value;
    try {
      value = JSON.parse(line);
    } catch (error) {
      throw new Error(`completion log line ${index + 1} is invalid JSON: ${error.message}`);
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`completion log line ${index + 1} is not an object`);
    }
    records.push({ line: index + 1, value });
  });
  return { raw, records };
}

function terminalPhaseStatus(status) {
  return status === 'done' || status === 'archived';
}

function historyEventIdentity(event) {
  return `${event.event ?? '<unknown>'}:${event.taskId ?? '<phase>'}`;
}

function completionDigest(event) {
  return digestValue(event);
}

function logicalCompletionDigest(event) {
  const comparable = structuredClone(event);
  delete comparable.ts;
  return digestValue(comparable);
}

function eventReceiptId(event) {
  return typeof event.idempotencyKey === 'string' && event.idempotencyKey !== ''
    ? event.idempotencyKey
    : historyEventIdentity(event);
}

function canonicalPhaseDoneCloseEvent(event, {
  projectId,
  planSlug,
  phaseId,
  closeSha,
}) {
  if (event?.event !== 'phase-done'
      || event.projectId !== projectId
      || event.planSlug !== planSlug
      || event.phaseId !== phaseId
      || event.taskId !== null
      || event.closeSha !== closeSha) return false;
  try {
    return event.idempotencyKey === buildPhaseDoneIdempotencyKey({
      projectId: event.projectId,
      planSlug: event.planSlug,
      phaseId: event.phaseId,
      closedAt: event.ts,
    });
  } catch {
    return false;
  }
}

function projectionDigests(projection) {
  return {
    descriptor: digestValue(projection.descriptor),
    initiative: digestValue(projection.initiative),
    creationGate: digestValue(projection.creationGate),
    completionEvents: digestValue(projection.completionEvents),
    sidecars: digestValue(projection.sidecars),
  };
}

function loadHistoryProjection({
  root,
  projectId,
  planSlug,
  phaseId,
  planPath,
  initiativePath,
  creationGatePath,
  completionLogPath,
  sidecarPaths = [],
  closeSha,
}) {
  const absoluteRoot = realpathSync(resolve(root));
  const planFile = historyPath(absoluteRoot, planPath, 'planPath');
  const initiativeFile = historyPath(absoluteRoot, initiativePath, 'initiativePath');
  const creationGateFile = historyPath(absoluteRoot, creationGatePath, 'creationGatePath');
  const completionLogFile = historyPath(absoluteRoot, completionLogPath, 'completionLogPath');
  const sidecarFiles = sidecarPaths.map((path, index) => (
    historyPath(absoluteRoot, path, `sidecarPaths[${index}]`)
  ));
  const planDocument = readMarkdown(planFile.path, 'plan');
  const initiativeDocument = readMarkdown(initiativeFile.path, 'initiative');
  const plan = planDocument.frontmatter;
  const initiative = initiativeDocument.frontmatter;
  const problems = [];
  const repairs = [];
  const descriptors = (plan.phases ?? []).filter((phase) => phase?.id === phaseId);
  if (descriptors.length !== 1) {
    problems.push(`expected exactly one ${phaseId} descriptor, found ${descriptors.length}`);
  }
  const descriptor = descriptors[0] ?? null;

  if (plan.slug !== planSlug) problems.push('plan slug does not match reconciliation identity');
  if (initiative.parentPlan !== planSlug) problems.push('initiative parentPlan does not match plan slug');
  if (initiative.phaseId !== phaseId) problems.push('initiative phaseId does not match reconciliation identity');
  if (descriptor && descriptor.slug !== initiative.slug) {
    problems.push('descriptor slug does not match initiative slug');
  }
  if (descriptor && !terminalPhaseStatus(descriptor.status)) {
    problems.push(`${phaseId} descriptor is not terminal`);
  }
  if (!terminalPhaseStatus(initiative.status)) problems.push(`${phaseId} initiative is not terminal`);
  if (descriptor?.reviewGate?.status !== 'passed') problems.push(`${phaseId} review gate is not passed`);
  const reviewedSha = descriptor?.reviewGate?.at;
  if (!fullCommitSha(reviewedSha)) problems.push(`${phaseId} review gate lacks a full commit SHA`);
  else {
    try {
      assertCommitExists(absoluteRoot, reviewedSha, `${phaseId} reviewed commit`);
    } catch (error) {
      problems.push(error.message);
    }
  }
  if (typeof descriptor?.reviewGate?.reviewFile !== 'string') {
    problems.push(`${phaseId} review gate lacks a review receipt`);
  } else {
    try {
      const reviewFile = historyPath(
        absoluteRoot,
        descriptor.reviewGate.reviewFile,
        `${phaseId} review receipt`,
        { mustExist: false },
      );
      const reviewRaw = gitOutput(
        absoluteRoot,
        ['show', `${closeSha}:${reviewFile.rel}`],
        `closeSha cannot read ${phaseId} review receipt`,
      );
      if (fullCommitSha(reviewedSha)
          && !reviewReceiptApproves(reviewRaw, reviewedSha, {
            mode: descriptor.reviewGate.mode,
            requireMode: true,
          })) {
        problems.push(`${phaseId} review receipt does not approve the reviewed commit and mode`);
      }
    } catch (error) {
      problems.push(error.message);
    }
  }

  const planCriteria = descriptor?.exitGate?.criteria ?? [];
  const initiativeCriteria = initiative.exitGates ?? [];
  const planCriterionIds = planCriteria.map((criterion) => criterion?.id);
  const initiativeCriterionIds = initiativeCriteria.map((criterion) => criterion?.id);
  if (new Set(planCriterionIds).size !== planCriterionIds.length) {
    problems.push('plan gate criterion ids are not unique');
  }
  if (new Set(initiativeCriterionIds).size !== initiativeCriterionIds.length) {
    problems.push('initiative gate criterion ids are not unique');
  }
  const evidence = [];
  for (const planCriterion of planCriteria) {
    const matches = initiativeCriteria.filter((criterion) => criterion?.id === planCriterion?.id);
    if (matches.length !== 1) {
      problems.push(`criterion ${planCriterion?.id ?? '<unknown>'} has ${matches.length} initiative matches`);
      continue;
    }
    const initiativeCriterion = matches[0];
    if (planCriterion.status !== 'met' || initiativeCriterion.status !== 'met') {
      problems.push(`criterion ${planCriterion.id} is not met in both mirrors`);
    }
    if (planCriterion.evidence?.passed !== true || initiativeCriterion.evidence?.passed !== true) {
      problems.push(`criterion ${planCriterion.id} lacks passing evidence in both mirrors`);
    }
    const planComparable = structuredClone(planCriterion.evidence ?? null);
    const initiativeComparable = structuredClone(initiativeCriterion.evidence ?? null);
    if (planComparable) delete planComparable.verifiedCommit;
    if (initiativeComparable) delete initiativeComparable.verifiedCommit;
    if (!isDeepStrictEqual(canonicalize(planComparable), canonicalize(initiativeComparable))) {
      problems.push(`criterion ${planCriterion.id} evidence mirrors disagree`);
    }
    const expectedCommit = reviewedSha;
    for (const [mirror, criterion] of [['plan', planCriterion], ['initiative', initiativeCriterion]]) {
      if (fullCommitSha(expectedCommit) && criterion.evidence?.verifiedCommit !== expectedCommit) {
        problems.push(
          `criterion ${planCriterion.id} ${mirror} evidence verifiedCommit does not match reviewed commit`,
        );
      }
    }
    const normalizedEvidence = structuredClone(planCriterion.evidence ?? {});
    evidence.push({
      id: planCriterion.id,
      digest: digestValue(normalizedEvidence),
      verifiedCommit: normalizedEvidence.verifiedCommit ?? null,
    });
  }
  for (const initiativeCriterion of initiativeCriteria) {
    if (!planCriteria.some((criterion) => criterion?.id === initiativeCriterion?.id)) {
      problems.push(`initiative criterion ${initiativeCriterion?.id ?? '<unknown>'} has no plan match`);
    }
  }

  let creationGate;
  try {
    creationGate = JSON.parse(readFileSync(creationGateFile.path, 'utf8'));
  } catch (error) {
    problems.push(`creation gate is invalid JSON: ${error.message}`);
    creationGate = null;
  }
  if (creationGate) {
    if (creationGate.projectId !== projectId || creationGate.slug !== planSlug) {
      problems.push('creation gate identity does not match plan');
    }
    if (creationGate.status !== 'ready' || creationGate.stage !== 'ready') {
      problems.push('creation gate is not ready');
    }
  }

  const completionLog = parseCompletionLog(completionLogFile.path);
  const matchingRecords = completionLog.records.filter(({ value }) => (
    value.projectId === projectId
    && value.planSlug === planSlug
    && value.phaseId === phaseId
  ));
  if (matchingRecords.length === 0) problems.push(`${phaseId} has no completion events`);
  const recordsToDrop = new Set();
  const reconciliationRecords = matchingRecords.filter(({ value }) => (
    value.event === 'reconcile'
    && value.reconciliation?.action === 'ignore-duplicate-completion'
  ));
  const byIdentity = new Map();
  for (const record of matchingRecords.filter(({ value }) => value.event !== 'reconcile')) {
    const identity = historyEventIdentity(record.value);
    const group = byIdentity.get(identity) ?? [];
    group.push(record);
    byIdentity.set(identity, group);
  }
  for (const [identity, records] of byIdentity) {
    if (records.length < 2) continue;
    const idempotencyKeys = new Set(records.map(({ value }) => value.idempotencyKey));
    const closeShas = new Set(records.map(({ value }) => value.closeSha));
    const logicalPayloads = new Set(records.map(({ value }) => logicalCompletionDigest(value)));
    const canonicalDigest = completionDigest(records[0].value);
    const duplicateDigests = records.slice(1).map(({ value }) => completionDigest(value));
    const matchingMarkers = reconciliationRecords.filter(({ value }) => (
      value.closeSha === closeSha
      && value.reconciliation.eventIdentity === identity
      && value.reconciliation.canonicalDigest === canonicalDigest
      && isDeepStrictEqual(value.reconciliation.duplicateDigests, duplicateDigests)
    ));
    if (matchingMarkers.length === 1) {
      records.slice(1).forEach((record) => recordsToDrop.add(record.line));
      continue;
    }
    if (matchingMarkers.length > 1) {
      problems.push(`completion identity ${identity} has duplicate reconciliation markers`);
      continue;
    }
    const uniquelyRepairable = idempotencyKeys.size === 1
      && closeShas.size === 1
      && logicalPayloads.size === 1
      && typeof records[0].value.idempotencyKey === 'string'
      && records[0].value.idempotencyKey !== ''
      && records[0].value.closeSha === closeSha;
    if (!uniquelyRepairable) {
      problems.push(`completion identity ${identity} is duplicated without one close identity and closeSha`);
      continue;
    }
    repairs.push({
      kind: 'duplicate-completion',
      identity,
      idempotencyKey: records[0].value.idempotencyKey,
      closeSha,
      lines: records.map((record) => record.line),
      canonicalDigest,
      duplicateDigests,
    });
  }
  for (const record of matchingRecords) {
    if (record.value.closeSha !== undefined && record.value.closeSha !== closeSha) {
      problems.push(`completion event ${eventReceiptId(record.value)} has a conflicting closeSha`);
    }
  }

  try {
    assertCommitExists(absoluteRoot, closeSha, 'closeSha');
    const planAtCloseRaw = gitOutput(
      absoluteRoot,
      ['show', `${closeSha}:${planFile.rel}`],
      `closeSha cannot read ${planFile.rel}`,
    );
    const planAtClose = parseFrontmatter(planAtCloseRaw);
    if (planAtClose.error) problems.push(`closeSha plan is invalid: ${planAtClose.error}`);
    else {
      const closedDescriptors = (planAtClose.frontmatter.phases ?? [])
        .filter((phase) => phase?.id === phaseId);
      if (closedDescriptors.length !== 1 || !terminalPhaseStatus(closedDescriptors[0].status)) {
        problems.push(`closeSha does not contain ${phaseId} as done`);
      }
    }
  } catch (error) {
    problems.push(error.message);
  }

  const keptMatchingRecords = matchingRecords.filter((record) => !recordsToDrop.has(record.line));
  const normalizedDescriptor = structuredClone(descriptor);
  for (const criterion of normalizedDescriptor?.exitGate?.criteria ?? []) {
    if (fullCommitSha(reviewedSha) && criterion.evidence) {
      criterion.evidence.verifiedCommit = reviewedSha;
    }
  }
  const normalizedInitiative = structuredClone(initiative);
  for (const criterion of normalizedInitiative.exitGates ?? []) {
    if (fullCommitSha(reviewedSha) && criterion.evidence) {
      criterion.evidence.verifiedCommit = reviewedSha;
    }
  }
  const projection = {
    version: 1,
    identity: { projectId, planSlug, phaseId },
    descriptor: normalizedDescriptor,
    initiative: {
      frontmatter: normalizedInitiative,
      body: initiativeDocument.body,
    },
    creationGate: creationGate === null ? null : canonicalize(creationGate),
    sidecars: sidecarFiles.map((file) => ({
      path: file.rel,
      digest: hashFile(file.path),
    })),
    evidence,
    completionEvents: keptMatchingRecords.map(({ value }) => ({
      id: eventReceiptId(value),
      digest: digestValue(value),
      closeSha: value.closeSha ?? null,
      value: canonicalize(value),
    })),
    closeSha,
  };
  return {
    root: absoluteRoot,
    files: {
      plan: planFile,
      initiative: initiativeFile,
      creationGate: creationGateFile,
      completionLog: completionLogFile,
      sidecars: sidecarFiles,
    },
    documents: { plan: planDocument, initiative: initiativeDocument },
    completionLog,
    recordsToDrop,
    projection,
    digests: projectionDigests(projection),
    projectionDigest: digestValue(projection),
    problems,
    repairs,
  };
}

function atomicHistoryWrite(path, bytes) {
  const temp = `${path}.${randomUUID()}.tmp`;
  durableWrite(temp, bytes, 'wx');
  durableRename(temp, path);
}

function backupBytes(path, bytes) {
  const digest = hashBytes(bytes);
  const backup = `${path}.history-backup-${digest.slice(0, 16)}.bak`;
  if (existsSync(backup)) {
    const stat = lstatSync(backup);
    if (stat.isSymbolicLink()) {
      throw new Error(`history backup is a symbolic link: ${backup}`);
    }
    if (!stat.isFile() || stat.nlink !== 1) {
      throw new Error(`history backup is not a private regular file: ${backup}`);
    }
    if (hashFile(backup) !== digest) throw new Error(`history backup collision at ${backup}`);
    return backup;
  }
  durableWrite(backup, bytes, 'wx');
  return backup;
}

function componentHashReceipt(before, after) {
  return Object.fromEntries(Object.keys(after.digests).map((key) => [key, {
    before: before.digests[key],
    after: after.digests[key],
  }]));
}

function buildHistoryReceipt(state, initial, classification) {
  return {
    version: 1,
    kind: 'materialization-history-reconciliation',
    identity: state.projection.identity,
    classification,
    sources: {
      planPath: state.files.plan.rel,
      initiativePath: state.files.initiative.rel,
      creationGatePath: state.files.creationGate.rel,
      completionLogPath: state.files.completionLog.rel,
      sidecarPaths: state.files.sidecars.map((file) => file.rel),
    },
    closeSha: state.projection.closeSha,
    reconciledCommit: gitOutput(state.root, ['rev-parse', 'HEAD'], 'cannot resolve reconciledCommit'),
    projectionDigest: state.projectionDigest,
    hashes: componentHashReceipt(initial, state),
    evidence: state.projection.evidence,
    completionEvents: state.projection.completionEvents.map(({ id, digest, closeSha }) => ({
      id,
      digest,
      closeSha,
    })),
    creationGate: {
      path: state.files.creationGate.rel,
      digest: state.digests.creationGate,
    },
    sidecars: state.projection.sidecars,
  };
}

/**
 * Classify and, only when correspondence is unique, repair the historical
 * descriptor/initiative projection written by the F0 bootstrap.
 */
function reconcileMaterializationHistoryLocked(options = {}, ledger) {
  const initial = loadHistoryProjection(options);
  const classification = initial.problems.length > 0
    ? 'ambiguous'
    : (initial.repairs.length > 0 ? 'repairable' : 'consistent');
  const result = {
    classification,
    problems: initial.problems,
    repairs: initial.repairs,
    writes: [],
    backups: {},
  };
  if (classification === 'ambiguous' || options.apply !== true) return result;

  const duplicateRepairs = initial.repairs.filter((repair) => repair.kind === 'duplicate-completion');
  if (duplicateRepairs.length > 0) {
    if (ledger.readRaw() !== initial.completionLog.raw) {
      throw new Error('completion log changed during history reconciliation; refusing writes');
    }
    const bytes = Buffer.from(initial.completionLog.raw);
    result.backups.completionLog = backupBytes(initial.files.completionLog.path, bytes);
    for (const repair of duplicateRepairs) {
      ledger.append({
        ts: new Date().toISOString(),
        event: 'reconcile',
        projectId: options.projectId,
        planSlug: options.planSlug,
        phaseId: options.phaseId,
        taskId: null,
        idempotencyKey: `reconcile:${options.projectId}/${options.planSlug}/${options.phaseId}:${repair.closeSha}:${repair.canonicalDigest}`,
        closeSha: repair.closeSha,
        weight: 0,
        weightBasis: 'count',
        reconciliation: {
          action: 'ignore-duplicate-completion',
          eventIdentity: repair.identity,
          canonicalDigest: repair.canonicalDigest,
          duplicateDigests: repair.duplicateDigests,
        },
      });
    }
    result.writes.push(initial.files.completionLog.rel);
  }

  const current = loadHistoryProjection(options);
  if (current.problems.length > 0 || current.repairs.length > 0) {
    throw new Error(`history repair did not converge: ${[
      ...current.problems,
      ...current.repairs.map((repair) => repair.kind),
    ].join('; ')}`);
  }
  const receiptFile = historyPath(current.root, options.receiptPath, 'receiptPath', {
    mustExist: false,
  });
  const receipt = buildHistoryReceipt(current, initial, classification);
  atomicHistoryWrite(receiptFile.path, `${JSON.stringify(receipt, null, 2)}\n`);
  result.writes.push(receiptFile.rel);
  result.receipt = receipt;
  return result;
}

export function reconcileMaterializationHistory(options = {}) {
  const absoluteRoot = realpathSync(resolve(options.root ?? process.cwd()));
  const planRel = safeRelativePath(absoluteRoot, options.planPath, 'planPath');
  const lockPath = join(dirname(resolve(absoluteRoot, planRel)), LOCK_NAME);
  const lockToken = acquireMaterializationLock(lockPath);
  try {
    return withCompletionLedgerLock(absoluteRoot, (ledger) => (
      reconcileMaterializationHistoryLocked({ ...options, root: absoluteRoot }, ledger)
    ));
  } finally {
    releaseMaterializationLock(lockPath, lockToken);
  }
}

function assertReceiptExpectation(actual, expected, label) {
  if (expected == null) return;
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (!isDeepStrictEqual(actual?.[key], expectedValue)) {
      throw new Error(`receipt ${label}.${key} does not match configured expectation`);
    }
  }
}

function assertConfiguredReceiptContract(identity, sources, label = 'successor barrier') {
  for (const field of ['projectId', 'planSlug', 'phaseId']) {
    if (typeof identity?.[field] !== 'string' || identity[field].trim() === '') {
      throw new Error(`${label} requires receiptIdentity.${field}`);
    }
  }
  for (const field of [
    'planPath', 'initiativePath', 'creationGatePath', 'completionLogPath',
  ]) {
    if (typeof sources?.[field] !== 'string' || sources[field].trim() === '') {
      throw new Error(`${label} requires receiptSources.${field}`);
    }
  }
  if (!Array.isArray(sources.sidecarPaths)
      || sources.sidecarPaths.some((path) => typeof path !== 'string' || path.trim() === '')) {
    throw new Error(`${label} requires receiptSources.sidecarPaths`);
  }
}

function checkHistoryReceiptLocked({
  root = process.cwd(),
  receiptPath,
  expectedIdentity,
  expectedSources,
} = {}) {
  const absoluteRoot = realpathSync(resolve(root));
  const receiptFile = historyPath(absoluteRoot, receiptPath, 'receiptPath');
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(receiptFile.path, 'utf8'));
  } catch (error) {
    throw new Error(`history receipt is stale: invalid JSON (${error.message})`);
  }
  try {
    if (receipt?.version !== 1 || receipt.kind !== 'materialization-history-reconciliation') {
      throw new Error('unsupported receipt shape');
    }
    const { identity, sources } = receipt;
    if (!identity || !sources) throw new Error('missing identity or sources');
    assertReceiptExpectation(identity, expectedIdentity, 'identity');
    assertReceiptExpectation(sources, expectedSources, 'sources');
    assertCommitExists(absoluteRoot, receipt.closeSha, 'receipt closeSha');
    assertCommitExists(absoluteRoot, receipt.reconciledCommit, 'receipt reconciledCommit');
    const current = loadHistoryProjection({
      root: absoluteRoot,
      projectId: identity.projectId,
      planSlug: identity.planSlug,
      phaseId: identity.phaseId,
      planPath: sources.planPath,
      initiativePath: sources.initiativePath,
      creationGatePath: sources.creationGatePath,
      completionLogPath: sources.completionLogPath,
      sidecarPaths: sources.sidecarPaths,
      closeSha: receipt.closeSha,
    });
    if (current.problems.length > 0 || current.repairs.length > 0) {
      throw new Error(`projection is not consistent (${[
        ...current.problems,
        ...current.repairs.map((repair) => repair.kind),
      ].join('; ')})`);
    }
    if (current.projectionDigest !== receipt.projectionDigest) {
      throw new Error('projection digest changed');
    }
    if (!isDeepStrictEqual(current.projection.evidence, receipt.evidence)) {
      throw new Error('evidence digest list changed');
    }
    const eventReceipts = current.projection.completionEvents.map(({ id, digest, closeSha }) => ({
      id,
      digest,
      closeSha,
    }));
    if (!isDeepStrictEqual(eventReceipts, receipt.completionEvents)) {
      throw new Error('completion event digest list changed');
    }
    if (current.digests.creationGate !== receipt.creationGate?.digest) {
      throw new Error('creation gate digest changed');
    }
    if (!isDeepStrictEqual(current.projection.sidecars, receipt.sidecars)) {
      throw new Error('sidecar digest list changed');
    }
    return { ok: true, receipt, projectionDigest: current.projectionDigest };
  } catch (error) {
    throw new Error(`history receipt is stale: ${error.message}`);
  }
}

export function checkHistoryReceipt(options = {}) {
  const absoluteRoot = realpathSync(resolve(options.root ?? process.cwd()));
  return withCompletionLedgerLock(absoluteRoot, () => (
    checkHistoryReceiptLocked({ ...options, root: absoluteRoot })
  ));
}

function assertSuccessorMaterializationAllowedLocked({
  root = process.cwd(),
  planPath,
  targetPhaseId,
  prerequisitePhaseId,
  receiptPath,
  receiptIdentity,
  receiptSources,
  closeSha,
} = {}) {
  assertConfiguredReceiptContract(receiptIdentity, receiptSources);
  const absoluteRoot = realpathSync(resolve(root));
  const receiptCheck = checkHistoryReceiptLocked({
    root: absoluteRoot,
    receiptPath,
    expectedIdentity: receiptIdentity,
    expectedSources: receiptSources,
  });
  const planFile = historyPath(absoluteRoot, planPath, 'planPath');
  const currentPlan = readMarkdown(planFile.path, 'plan').frontmatter;
  const prerequisite = (currentPlan.phases ?? [])
    .filter((phase) => phase?.id === prerequisitePhaseId);
  if (prerequisite.length !== 1 || !terminalPhaseStatus(prerequisite[0].status)) {
    throw new Error(`${prerequisitePhaseId} must be terminal before ${targetPhaseId} activation`);
  }
  const target = (currentPlan.phases ?? []).filter((phase) => phase?.id === targetPhaseId);
  if (target.length !== 1) throw new Error(`expected exactly one ${targetPhaseId} descriptor`);
  if (!(target[0].dependsOn ?? []).includes(prerequisitePhaseId)) {
    throw new Error(`${targetPhaseId} does not depend on ${prerequisitePhaseId}`);
  }
  assertCommitExists(absoluteRoot, closeSha, 'closeSha');
  let historicalPlan;
  try {
    const raw = gitOutput(
      absoluteRoot,
      ['show', `${closeSha}:${planFile.rel}`],
      `closeSha cannot read ${planFile.rel}`,
    );
    historicalPlan = parseFrontmatter(raw);
    if (historicalPlan.error) throw new Error(historicalPlan.error);
  } catch (error) {
    throw new Error(`closeSha does not contain ${prerequisitePhaseId} as done: ${error.message}`);
  }
  if (historicalPlan.frontmatter.slug !== currentPlan.slug
      || currentPlan.slug !== receiptIdentity.planSlug) {
    throw new Error('historical, current, and receipt plan identities do not match');
  }
  const historicalPrerequisite = (historicalPlan.frontmatter.phases ?? [])
    .filter((phase) => phase?.id === prerequisitePhaseId);
  if (historicalPrerequisite.length !== 1
      || !terminalPhaseStatus(historicalPrerequisite[0].status)) {
    throw new Error(`closeSha does not contain ${prerequisitePhaseId} as done`);
  }
  const historicalPhase = historicalPrerequisite[0];
  const historicalReview = historicalPhase.reviewGate;
  if (historicalReview?.status !== 'passed' || !fullCommitSha(historicalReview?.at)) {
    throw new Error(`historical ${prerequisitePhaseId} lacks a passed commit-anchored review gate`);
  }
  const historicalGates = historicalPhase.exitGate?.criteria;
  if (!Array.isArray(historicalGates) || historicalGates.length === 0
      || historicalGates.some((gate) => (
        gate?.status !== 'met'
        || gate?.evidence?.passed !== true
        || gate?.evidence?.verifiedCommit !== historicalReview.at
      ))) {
    throw new Error(`historical ${prerequisitePhaseId} gate evidence is not fully met and review-anchored`);
  }
  const historicalInitiative = historicalPhaseInitiative({
    root: absoluteRoot,
    closeSha,
    planRel: planFile.rel,
    planSlug: currentPlan.slug,
    phase: historicalPhase,
  });
  assertHistoricalInitiativeClosed({
    phase: historicalPhase,
    initiative: historicalInitiative.initiative,
  });
  assertCommitAncestor(
    absoluteRoot,
    historicalReview.at,
    closeSha,
    `historical ${prerequisitePhaseId} reviewed commit`,
  );
  if (typeof historicalReview.reviewFile !== 'string') {
    throw new Error(`historical ${prerequisitePhaseId} review receipt is missing`);
  }
  const historicalReviewFile = historyPath(
    absoluteRoot,
    historicalReview.reviewFile,
    `historical ${prerequisitePhaseId} review receipt`,
    { mustExist: false },
  );
  let historicalReviewReceipt;
  try {
    historicalReviewReceipt = gitOutput(
      absoluteRoot,
      ['show', `${closeSha}:${historicalReviewFile.rel}`],
      `closeSha cannot read historical ${prerequisitePhaseId} review receipt`,
    );
  } catch (error) {
    throw new Error(`historical ${prerequisitePhaseId} review receipt is absent at closeSha: ${error.message}`);
  }
  if (!reviewReceiptApproves(historicalReviewReceipt, historicalReview.at, {
    mode: historicalReview.mode,
    requireMode: true,
  })) {
    throw new Error(
      `historical ${prerequisitePhaseId} review receipt at closeSha does not approve its review anchor and mode`,
    );
  }
  const completionLog = historyPath(
    absoluteRoot,
    receiptCheck.receipt.sources.completionLogPath,
    'completionLogPath',
  );
  const closeEvents = parseCompletionLog(completionLog.path).records.filter(({ value }) => (
    canonicalPhaseDoneCloseEvent(value, {
      projectId: receiptIdentity.projectId,
      planSlug: currentPlan.slug,
      phaseId: prerequisitePhaseId,
      closeSha,
    })
  ));
  if (closeEvents.length !== 1) {
    throw new Error(
      `${prerequisitePhaseId} requires exactly one phase-done event bound to closeSha (found ${closeEvents.length})`,
    );
  }
  return {
    allowed: true,
    closeSha,
    receiptDigest: receiptCheck.projectionDigest,
  };
}

export function assertSuccessorMaterializationAllowed(options = {}) {
  const absoluteRoot = realpathSync(resolve(options.root ?? process.cwd()));
  return withCompletionLedgerLock(absoluteRoot, () => (
    assertSuccessorMaterializationAllowedLocked({ ...options, root: absoluteRoot })
  ));
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
  const receiptToCheck = option(args, '--check-history-receipt');
  if (receiptToCheck) {
    const planPath = option(args, '--plan', { required: true });
    const absoluteRoot = realpathSync(resolve(root));
    const planFile = historyPath(absoluteRoot, planPath, 'planPath');
    const receiptFile = historyPath(absoluteRoot, receiptToCheck, 'receiptPath');
    const plan = readMarkdown(planFile.path, 'configured plan').frontmatter;
    const barriers = (plan.stateIntegrityHardening?.successorBarriers ?? []).filter((barrier) => {
      try {
        return safeRelativePath(
          absoluteRoot,
          barrier?.receiptPath,
          'configured successor barrier receiptPath',
        ) === receiptFile.rel;
      } catch {
        return false;
      }
    });
    if (barriers.length !== 1) {
      throw new Error(
        `configured plan must contain exactly one successor barrier for ${receiptFile.rel}`,
      );
    }
    const barrier = barriers[0];
    assertConfiguredReceiptContract(
      barrier.receiptIdentity,
      barrier.receiptSources,
      'configured plan successor barrier',
    );
    const result = checkHistoryReceipt({
      root: absoluteRoot,
      receiptPath: receiptFile.rel,
      expectedIdentity: barrier.receiptIdentity,
      expectedSources: barrier.receiptSources,
    });
    io.log(JSON.stringify(result));
    return result;
  }
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
    prerequisiteCloseSha: option(args, '--prerequisite-close-sha'),
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
