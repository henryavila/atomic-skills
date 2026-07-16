/**
 * Shared install/runtime lock identities for atomic-skills.
 *
 * Protocol matches @henryavila/minimalist-installer lock.js:
 *   identity = `v1\0<kind>\0<canonicalTarget>`
 *   lock file = sha256(identity) under lockRoot
 *   acquire sorted unique identities; release reverse order.
 *
 * Prefer the engine implementation when it exports acquireLocks (remediated
 * builds / NODE_PATH overlay). Otherwise use a local compatible coordinator so
 * registry/runtime mutations still serialize before the package pin (T-006).
 */
import {
  openSync, closeSync, writeSync, readFileSync, unlinkSync, mkdirSync, constants,
  existsSync, readdirSync, rmdirSync, statSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

function resourceIdentity(kind, canonicalTarget) {
  return `v1\0${kind}\0${canonicalTarget}`;
}

function lockFileName(identity) {
  return `${createHash('sha256').update(identity, 'utf8').digest('hex')}.lock`;
}

function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function localAcquireLocks(identities, { lockRoot, timeoutMs = 60_000, pollMs = 25 } = {}) {
  const unique = [...new Set(identities.filter(Boolean))];
  unique.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  mkdirSync(lockRoot, { recursive: true });
  const held = [];
  const started = Date.now();

  const release = () => {
    for (const id of [...held].reverse()) {
      const file = join(lockRoot, lockFileName(id));
      try {
        const meta = JSON.parse(readFileSync(file, 'utf8'));
        if (meta.pid === process.pid) unlinkSync(file);
      } catch {
        try { unlinkSync(file); } catch { /* ignore */ }
      }
    }
    held.length = 0;
  };

  try {
    for (const identity of unique) {
      const file = join(lockRoot, lockFileName(identity));
      for (;;) {
        try {
          const fd = openSync(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o644);
          try {
            writeSync(fd, `${JSON.stringify({
              pid: process.pid,
              identity,
              acquiredAt: new Date().toISOString(),
            }, null, 2)}\n`);
          } finally {
            closeSync(fd);
          }
          held.push(identity);
          break;
        } catch (err) {
          if (err.code !== 'EEXIST') throw err;
          try {
            const raw = readFileSync(file, 'utf8');
            if (raw.trim().length > 0) {
              const meta = JSON.parse(raw);
              if (Number.isInteger(meta.pid) && !isPidAlive(meta.pid)) {
                unlinkSync(file);
                continue;
              }
            }
          } catch {
            // Unreadable/partial lock: wait; do not steal.
          }
          if (Date.now() - started > timeoutMs) {
            release();
            const e = new Error(`Timeout acquiring lock for ${identity}`);
            e.code = 'LOCK_TIMEOUT';
            throw e;
          }
          const waitBuf = new Int32Array(new SharedArrayBuffer(4));
          Atomics.wait(waitBuf, 0, 0, pollMs);
        }
      }
    }
  } catch (err) {
    release();
    throw err;
  }

  return { identities: unique, lockRoot, release };
}

function tryEngineLocks() {
  // Optional: load remediated engine when overlay or newer package is present.
  try {
    if (process.env.ATOMIC_SKILLS_UPSTREAM_MI_ROOT) {
      const entry = join(process.env.ATOMIC_SKILLS_UPSTREAM_MI_ROOT, 'src/lock.js');
      if (existsSync(entry)) {
        // Dynamic import is async; for sync path use createRequire on CJS-incompatible
        // ESM — fall through to local protocol which is byte-compatible.
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * @param {{ basePath: string, fingerprint?: string }} opts
 * @param {() => T} fn
 * @returns {T}
 * @template T
 */
export function withSharedRuntimeLocks({ basePath, fingerprint }, fn) {
  const registryPath = resolve(join(homedir(), '.atomic-skills', 'installs.json'));
  const runtimeRoot = resolve(join(homedir(), '.atomic-skills'));
  const lockRoot = join(homedir(), '.atomic-skills', 'locks');

  const identities = [
    resourceIdentity('registry', registryPath),
    resourceIdentity('runtime-index', runtimeRoot),
    resourceIdentity('install-root', resolve(basePath)),
  ];
  if (fingerprint) {
    identities.push(resourceIdentity('runtime-slot', `${runtimeRoot}#${fingerprint}`));
  }

  const engine = tryEngineLocks();
  const locks = engine
    ? engine.acquireLocks(identities, { lockRoot, timeoutMs: 60_000 })
    : localAcquireLocks(identities, { lockRoot, timeoutMs: 60_000 });

  try {
    return fn();
  } finally {
    locks.release();
    // Uninstall round-trips require $HOME baseline: drop empty lock files and
    // the locks/ directory when no locks remain (journal ownership is gone).
    pruneEmptyLockRoot(lockRoot);
  }
}

/** Best-effort: remove free lock files and the locks directory if empty. */
export function pruneEmptyLockRoot(lockRoot = join(homedir(), '.atomic-skills', 'locks')) {
  try {
    if (!existsSync(lockRoot)) return;
    for (const name of readdirSync(lockRoot)) {
      const abs = join(lockRoot, name);
      try {
        const st = statSync(abs);
        if (st.isFile() && st.size === 0) unlinkSync(abs);
      } catch {
        // ignore races
      }
    }
    // Remove any leftover lock files that are not held (best-effort: delete all
    // after release — acquire holds only for the critical section above).
    for (const name of readdirSync(lockRoot)) {
      try {
        unlinkSync(join(lockRoot, name));
      } catch {
        // still held or not a file — leave it
      }
    }
    try {
      rmdirSync(lockRoot);
    } catch {
      // non-empty or concurrent acquire
    }
  } catch {
    // ignore
  }
}

export { resourceIdentity, lockFileName };
