import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fchmodSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const WAIT = new Int32Array(new SharedArrayBuffer(4));

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
  if (!Number.isInteger(pid) || pid <= 0) return null;
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

export function currentProcessOwner(token, extra = {}) {
  return {
    version: 1,
    pid: process.pid,
    ...(SELF_PROCESS_IDENTITY ? { processIdentity: SELF_PROCESS_IDENTITY } : {}),
    token,
    ...extra,
  };
}

export function isProcessOwnerAlive(owner) {
  if (!processAlive(owner?.pid)) return false;
  if (!hasText(owner.processIdentity)) return true;
  const identity = owner.pid === process.pid
    ? SELF_PROCESS_IDENTITY
    : readProcessIdentity(owner.pid);
  return identity === null || identity === owner.processIdentity;
}

export function readOwnedFile(path, label = 'owned file') {
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error('path is not a real regular file');
    }
    const owner = JSON.parse(readFileSync(path, 'utf8'));
    if (owner?.version !== 1 || !Number.isInteger(owner.pid) || owner.pid <= 0
        || !hasText(owner.token)
        || (owner.processIdentity !== undefined && !hasText(owner.processIdentity))) {
      throw new Error('unsupported owner shape');
    }
    return owner;
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined;
    throw new Error(`${label} is unreadable: ${error.message}`);
  }
}

export function writeOwnedFileAtomically(path, owner, temporaryBase = path) {
  const temporary = `${temporaryBase}.${process.pid}.${randomUUID()}.tmp`;
  try {
    const fd = openSync(temporary, 'wx', 0o600);
    try {
      fchmodSync(fd, 0o600);
      writeFileSync(fd, `${JSON.stringify(owner)}\n`);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(temporary, path);
  } catch (error) {
    if (existsSync(temporary)) unlinkSync(temporary);
    throw error;
  }
}

export function releaseOwnedFile(path, token, label = 'owned file') {
  const owner = readOwnedFile(path, label);
  if (owner?.token !== token) return false;
  unlinkSync(path);
  return true;
}

function readGuardClaims(guardPath, label) {
  const claims = [];
  for (const entry of readdirSync(guardPath, { withFileTypes: true })) {
    if (!entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith('.json')) {
      throw new Error(`${label} contains an unsupported entry`);
    }
    const path = join(guardPath, entry.name);
    const owner = readOwnedFile(path, `${label} claim`);
    if (owner === undefined) continue;
    if (typeof owner.choosing !== 'boolean'
        || (!owner.choosing && (!Number.isSafeInteger(owner.ticket) || owner.ticket <= 0))) {
      throw new Error(`${label} contains an unreadable claim`);
    }
    if (!isProcessOwnerAlive(owner)) {
      releaseOwnedFile(path, owner.token, `${label} claim`);
      continue;
    }
    claims.push({ owner, path });
  }
  return claims;
}

function cleanupGuardDirectory(guardPath) {
  try {
    rmdirSync(guardPath);
  } catch (error) {
    if (error?.code !== 'ENOENT' && error?.code !== 'ENOTEMPTY') throw error;
  }
}

export function withProcessClaimGuard(guardPath, operation, {
  label = 'process lock guard',
  retries = 400,
  retryMs = 25,
} = {}) {
  if (typeof operation !== 'function') throw new TypeError(`${label} operation is required`);
  const token = randomUUID();
  const claimPath = join(guardPath, `${token}.json`);
  let published = false;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      mkdirSync(guardPath, { recursive: true, mode: 0o700 });
      const stat = lstatSync(guardPath);
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new Error(`${label} path is not a real directory`);
      }
      writeOwnedFileAtomically(
        claimPath,
        currentProcessOwner(token, { choosing: true, ticket: null }),
        guardPath,
      );
      published = true;
      break;
    } catch (error) {
      if ((error?.code === 'ENOENT' || error?.code === 'EINVAL') && attempt < retries - 1) continue;
      throw error;
    }
  }
  if (!published) throw new Error(`${label} setup could not stabilize`);

  let ticket;
  try {
    const claims = readGuardClaims(guardPath, label);
    ticket = claims.reduce((maximum, claim) => (
      claim.owner.choosing ? maximum : Math.max(maximum, claim.owner.ticket)
    ), 0) + 1;
    writeOwnedFileAtomically(
      claimPath,
      currentProcessOwner(token, { choosing: false, ticket }),
      guardPath,
    );
    for (let attempt = 0; attempt < retries; attempt += 1) {
      const current = readGuardClaims(guardPath, label);
      const own = current.find((claim) => claim.owner.token === token);
      if (!own) throw new Error(`${label} lost its own claim`);
      const blocker = current.find((claim) => (
        claim.owner.token !== token
        && (claim.owner.choosing
          || claim.owner.ticket < ticket
          || (claim.owner.ticket === ticket && claim.owner.token.localeCompare(token) < 0))
      ));
      if (!blocker) return operation();
      if (attempt < retries - 1) Atomics.wait(WAIT, 0, 0, retryMs);
    }
    throw new Error(`${label} timed out`);
  } finally {
    releaseOwnedFile(claimPath, token, `${label} claim`);
    cleanupGuardDirectory(guardPath);
  }
}
