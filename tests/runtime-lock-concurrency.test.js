/**
 * F1/T-005 — concurrent registry mutations must serialize under canonical locks
 * when the remediated engine is available.
 */
import { describe, it, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

async function loadLockApi() {
  if (process.env.ATOMIC_SKILLS_UPSTREAM_MI_ROOT) {
    const root = process.env.ATOMIC_SKILLS_UPSTREAM_MI_ROOT;
    return import(pathToFileURL(join(root, 'src/index.js')).href);
  }
  return import('@henryavila/minimalist-installer');
}

describe('runtime lock concurrency', () => {
  let root;
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  it('30 writers across two roots serialize registry without lost updates', async () => {
    const mi = await loadLockApi();
    if (typeof mi.acquireLocks !== 'function' || typeof mi.resourceIdentity !== 'function') {
      assert.fail('upstream engine without lock API — run via test-with-upstream-pack.js');
    }

    root = mkdtempSync(join(tmpdir(), 'as-runtime-lock-'));
    const lockRoot = join(root, 'locks');
    const registry = join(root, 'installs.json');
    writeFileSync(registry, '[]\n', 'utf8');
    mkdirSync(lockRoot, { recursive: true });

    const registryId = mi.resourceIdentity('registry', registry);
    const rootA = mi.resourceIdentity('install-root', join(root, 'a'));
    const rootB = mi.resourceIdentity('install-root', join(root, 'b'));

    const lockModule = process.env.ATOMIC_SKILLS_UPSTREAM_MI_ROOT
      ? pathToFileURL(join(process.env.ATOMIC_SKILLS_UPSTREAM_MI_ROOT, 'src/index.js')).href
      : '@henryavila/minimalist-installer';

    const worker = (value, extraId) => `
import { readFileSync, writeFileSync } from 'node:fs';
import { acquireLocks } from ${JSON.stringify(lockModule)};
const registry = ${JSON.stringify(registry)};
const value = ${JSON.stringify(value)};
const locks = acquireLocks(
  [${JSON.stringify(registryId)}, ${JSON.stringify(extraId)}],
  { lockRoot: ${JSON.stringify(lockRoot)}, timeoutMs: 60000, pollMs: 10 },
);
try {
  let list = [];
  try {
    const v = JSON.parse(readFileSync(registry, 'utf8'));
    if (Array.isArray(v)) list = v;
  } catch {}
  if (!list.includes(value)) list.push(value);
  writeFileSync(registry, JSON.stringify(list) + '\\n', 'utf8');
} finally {
  locks.release();
}
`;

    const children = [];
    for (let i = 0; i < 30; i++) {
      const extra = i % 2 === 0 ? rootA : rootB;
      const value = `w${i}`;
      children.push(new Promise((resolve, reject) => {
        const c = spawn(process.execPath, ['--input-type=module', '-e', worker(value, extra)], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let err = '';
        c.stderr.on('data', (d) => { err += d; });
        c.on('exit', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`worker ${i} exit ${code}: ${err}`));
        });
      }));
    }

    const results = await Promise.allSettled(children);
    const failures = results.filter((r) => r.status === 'rejected');
    assert.equal(failures.length, 0, failures.map((f) => f.reason?.message || f.reason).join('\n'));

    // Re-read after a brief settle (last fsync/write visibility).
    await new Promise((r) => setTimeout(r, 20));
    const list = JSON.parse(readFileSync(registry, 'utf8'));
    const set = new Set(list);
    assert.equal(set.size, 30, `expected 30 unique entries, got ${set.size}: ${JSON.stringify([...set].sort())}`);
    assert.equal(list.length, 30, `expected 30 entries, got ${list.length}: ${JSON.stringify(list)}`);
  });
});

