import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  lstatSync,
  linkSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const LOCK_RETRIES = 400;
const LOCK_RETRY_MS = 25;
const OWNER_GRACE_MS = 1_000;

function hasText(value) {
  return typeof value === 'string' && value.length > 0;
}

function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function readProcessIdentity(pid) {
  try {
    if (process.platform === 'linux') {
      const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
      const commandEnd = stat.lastIndexOf(')');
      if (commandEnd < 0) return null;
      const fields = stat.slice(commandEnd + 1).trim().split(/\s+/);
      return fields[19] ? `linux:${fields[19]}` : null;
    }
    if (process.platform === 'win32') {
      const executable = process.env.SystemRoot
        ? join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
        : 'powershell.exe';
      const output = execFileSync(executable, [
        '-NoProfile', '-NonInteractive', '-Command',
        `(Get-Process -Id ${pid} -ErrorAction Stop).StartTime.ToUniversalTime().Ticks`,
      ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      return output ? `win32:${output}` : null;
    }
    const output = execFileSync('/bin/ps', ['-o', 'lstart=', '-p', String(pid)], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, LANG: 'C', LANGUAGE: 'C', LC_ALL: 'C', TZ: 'UTC' },
    }).trim().replace(/\s+/g, ' ');
    return output ? `${process.platform}:${output}` : null;
  } catch {
    return null;
  }
}

const SELF_PROCESS_IDENTITY = readProcessIdentity(process.pid);

function readOwner(lockPath) {
  try {
    const owner = JSON.parse(readFileSync(lockPath, 'utf8'));
    if (owner?.version !== 1 || !Number.isInteger(owner.pid) || owner.pid <= 0
        || !hasText(owner.token)
        || (owner.processIdentity !== undefined && !hasText(owner.processIdentity))) {
      return null;
    }
    return owner;
  } catch {
    return null;
  }
}

function ownerAlive(owner) {
  if (!processAlive(owner.pid)) return false;
  if (!hasText(owner.processIdentity)) return true;
  const identity = owner.pid === process.pid
    ? SELF_PROCESS_IDENTITY
    : readProcessIdentity(owner.pid);
  return identity === null || identity === owner.processIdentity;
}

function quarantine(lockPath) {
  const target = `${lockPath}.stale.${process.pid}.${randomUUID()}`;
  try {
    renameSync(lockPath, target);
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
  rmSync(target, { recursive: true, force: true });
  return true;
}

export function scopeTransactionLockPath(root, kind, scope) {
  if (!hasText(kind) || !Array.isArray(scope) || scope.length === 0 || scope.some((part) => !hasText(part))) {
    throw new TypeError('transaction lock requires a kind and non-empty scope parts');
  }
  const digest = createHash('sha256').update(JSON.stringify({ kind, scope })).digest('hex');
  return join(resolve(root), '.atomic-skills', 'status', 'transaction-locks', `${digest}.lock`);
}

async function acquireScopeTransactionLock(root, kind, scope) {
  const lockPath = scopeTransactionLockPath(root, kind, scope);
  mkdirSync(dirname(lockPath), { recursive: true });
  for (let attempt = 0; attempt < LOCK_RETRIES; attempt += 1) {
    const token = randomUUID();
    const ownerTemp = `${lockPath}.${process.pid}.${token}.owner`;
    try {
      writeFileSync(ownerTemp, `${JSON.stringify({
        version: 1,
        pid: process.pid,
        ...(SELF_PROCESS_IDENTITY ? { processIdentity: SELF_PROCESS_IDENTITY } : {}),
        token,
      })}\n`, { flag: 'wx', mode: 0o600 });
      linkSync(ownerTemp, lockPath);
      rmSync(ownerTemp, { force: true });
      return { lockPath, token };
    } catch (error) {
      rmSync(ownerTemp, { force: true });
      if (error?.code !== 'EEXIST') {
        throw error;
      }
      let stat;
      try {
        stat = lstatSync(lockPath);
      } catch (statError) {
        if (statError?.code === 'ENOENT') continue;
        throw statError;
      }
      if (!stat.isFile() || stat.isSymbolicLink()) {
        throw new Error(`transaction lock path is not a real regular file: ${lockPath}`);
      }
      const owner = readOwner(lockPath);
      const orphaned = owner ? !ownerAlive(owner) : Date.now() - stat.mtimeMs >= OWNER_GRACE_MS;
      if (orphaned) {
        quarantine(lockPath);
        continue;
      }
      if (attempt < LOCK_RETRIES - 1) {
        await new Promise((resolveWait) => setTimeout(resolveWait, LOCK_RETRY_MS));
      }
    }
  }
  throw new Error(`transaction lock timed out: ${lockPath}`);
}

function releaseScopeTransactionLock(lock) {
  const owner = readOwner(lock.lockPath);
  if (owner?.token !== lock.token) return;
  quarantine(lock.lockPath);
}

export async function withScopeTransactionLock(root, kind, scope, operation) {
  if (typeof operation !== 'function') throw new TypeError('transaction lock operation is required');
  const lock = await acquireScopeTransactionLock(root, kind, scope);
  try {
    return await operation();
  } finally {
    releaseScopeTransactionLock(lock);
  }
}
