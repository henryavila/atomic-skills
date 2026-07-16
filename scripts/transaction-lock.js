import { createHash, randomUUID } from 'node:crypto';
import {
  lstatSync,
  linkSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { confinedRepositoryFile } from '../src/confined-path.js';
import {
  currentProcessOwner,
  isProcessOwnerAlive,
  readOwnedFile,
  withProcessClaimGuard,
  writeOwnedFileAtomically,
} from '../src/process-lock-guard.js';

const LOCK_RETRIES = 400;
const LOCK_RETRY_MS = 25;
const OWNER_GRACE_MS = 1_000;
const LOCK_WAIT = new Int32Array(new SharedArrayBuffer(4));
const ACTIVE_LOCK_CAPABILITIES = new WeakSet();

function hasText(value) {
  return typeof value === 'string' && value.length > 0;
}

function readOwner(lockPath) {
  try {
    return readOwnedFile(lockPath, 'transaction lock');
  } catch (error) {
    if (/unsupported owner shape/.test(error.message)) return null;
    if (/ENOENT/.test(error.message)) return undefined;
    if (/symbolic link|real regular file/.test(error.message)) throw error;
    return null;
  }
}

function quarantine(lockPath, expectedToken) {
  const target = `${lockPath}.stale.${process.pid}.${randomUUID()}`;
  try {
    renameSync(lockPath, target);
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
  const owner = readOwner(target);
  if (expectedToken !== undefined && owner?.token !== expectedToken) {
    renameSync(target, lockPath);
    return false;
  }
  rmSync(target, { recursive: true, force: true });
  return true;
}

export function scopeTransactionLockPath(root, kind, scope) {
  if (!hasText(kind) || !Array.isArray(scope) || scope.length === 0 || scope.some((part) => !hasText(part))) {
    throw new TypeError('transaction lock requires a kind and non-empty scope parts');
  }
  const digest = createHash('sha256').update(JSON.stringify({ kind, scope })).digest('hex');
  return confinedRepositoryFile(
    root,
    ['.atomic-skills', 'status', 'transaction-locks'],
    `${digest}.lock`,
  );
}

function transactionLockPath(root, kind, scope) {
  return confinedRepositoryFile(
    root,
    ['.atomic-skills', 'status', 'transaction-locks'],
    `${createHash('sha256').update(JSON.stringify({ kind, scope })).digest('hex')}.lock`,
    { createParents: true },
  );
}

function tryAcquireScopeTransactionLock(lockPath, options = {}) {
  return withProcessClaimGuard(`${lockPath}.guard`, () => {
    const token = randomUUID();
    const ownerTemp = `${lockPath}.${process.pid}.${token}.owner`;
    try {
      writeOwnedFileAtomically(ownerTemp, currentProcessOwner(token));
      linkSync(ownerTemp, lockPath);
      rmSync(ownerTemp, { force: true });
      return { lockPath, token };
    } catch (error) {
      rmSync(ownerTemp, { force: true });
      if (error?.code !== 'EEXIST') throw error;
    }

    const stat = lstatSync(lockPath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`transaction lock path is not a real regular file: ${lockPath}`);
    }
    const owner = readOwner(lockPath);
    const orphaned = owner ? !isProcessOwnerAlive(owner) : Date.now() - stat.mtimeMs >= OWNER_GRACE_MS;
    if (!orphaned) return null;
    options.faultAt?.({ point: 'before-stale-reclaim', lockPath, owner: structuredClone(owner) });
    const currentStat = lstatSync(lockPath);
    const currentOwner = readOwner(lockPath);
    if (currentStat.dev !== stat.dev || currentStat.ino !== stat.ino
        || currentOwner?.token !== owner?.token) return null;
    quarantine(lockPath, owner?.token);
    return null;
  }, { label: 'transaction lock guard' });
}

async function acquireScopeTransactionLock(root, kind, scope, options = {}) {
  const lockPath = transactionLockPath(root, kind, scope);
  const maxAttempts = options.maxAttempts ?? LOCK_RETRIES;
  const retryMs = options.retryMs ?? LOCK_RETRY_MS;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const lock = tryAcquireScopeTransactionLock(lockPath, options);
    if (lock) return lock;
    if (attempt < maxAttempts - 1) {
      await new Promise((resolveWait) => setTimeout(resolveWait, retryMs));
    }
  }
  throw new Error(`transaction lock timed out: ${lockPath}`);
}

function acquireScopeTransactionLockSync(root, kind, scope, options = {}) {
  const lockPath = transactionLockPath(root, kind, scope);
  const maxAttempts = options.maxAttempts ?? LOCK_RETRIES;
  const retryMs = options.retryMs ?? LOCK_RETRY_MS;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const lock = tryAcquireScopeTransactionLock(lockPath, options);
    if (lock) return lock;
    if (attempt < maxAttempts - 1) Atomics.wait(LOCK_WAIT, 0, 0, retryMs);
  }
  throw new Error(`transaction lock timed out: ${lockPath}`);
}

function releaseScopeTransactionLock(lock) {
  withProcessClaimGuard(`${lock.lockPath}.guard`, () => {
    const owner = readOwner(lock.lockPath);
    if (owner?.token === lock.token) quarantine(lock.lockPath, lock.token);
  }, { label: 'transaction lock guard' });
}

function assertActiveCapability(root, kind, scope, capability) {
  if (!capability || typeof capability !== 'object'
      || !ACTIVE_LOCK_CAPABILITIES.has(capability)) {
    throw new Error('transaction lock capability is not active');
  }
  const expectedPath = scopeTransactionLockPath(root, kind, scope);
  if (capability.lockPath !== expectedPath) {
    throw new Error('transaction lock capability does not authorize this scope');
  }
  const owner = readOwner(capability.lockPath);
  if (owner?.token !== capability.token) {
    throw new Error('transaction lock capability is no longer owned by this process');
  }
  return capability;
}

export async function withScopeTransactionLock(root, kind, scope, operation, options = {}) {
  if (typeof operation !== 'function') throw new TypeError('transaction lock operation is required');
  if (options.capability !== undefined) {
    const capability = assertActiveCapability(root, kind, scope, options.capability);
    return operation(capability);
  }
  const lock = await acquireScopeTransactionLock(root, kind, scope, options);
  ACTIVE_LOCK_CAPABILITIES.add(lock);
  try {
    return await operation(lock);
  } finally {
    ACTIVE_LOCK_CAPABILITIES.delete(lock);
    releaseScopeTransactionLock(lock);
  }
}

export function withScopeTransactionLockSync(root, kind, scope, operation, options = {}) {
  if (typeof operation !== 'function') throw new TypeError('transaction lock operation is required');
  if (options.capability !== undefined) {
    const capability = assertActiveCapability(root, kind, scope, options.capability);
    const nestedResult = operation(capability);
    if (nestedResult && typeof nestedResult.then === 'function') {
      throw new TypeError('synchronous transaction lock operation must not return a promise');
    }
    return nestedResult;
  }
  const lock = acquireScopeTransactionLockSync(root, kind, scope, options);
  ACTIVE_LOCK_CAPABILITIES.add(lock);
  try {
    const result = operation(lock);
    if (result && typeof result.then === 'function') {
      throw new TypeError('synchronous transaction lock operation must not return a promise');
    }
    return result;
  } finally {
    ACTIVE_LOCK_CAPABILITIES.delete(lock);
    releaseScopeTransactionLock(lock);
  }
}
