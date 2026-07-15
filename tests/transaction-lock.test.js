import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync,
  unlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  scopeTransactionLockPath,
  withScopeTransactionLock,
} from '../scripts/transaction-lock.js';

test('a scope lock publishes one complete owner record as one atomic regular file', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-transaction-lock-'));
  try {
    const scope = ['proj', 'plan', 'F0'];
    const lockPath = scopeTransactionLockPath(root, 'phase-done', scope);
    await withScopeTransactionLock(root, 'phase-done', scope, async () => {
      const stat = lstatSync(lockPath);
      assert.equal(stat.isFile(), true);
      assert.equal(stat.isSymbolicLink(), false);
      const owner = JSON.parse(readFileSync(lockPath, 'utf8'));
      assert.equal(owner.version, 1);
      assert.equal(owner.pid, process.pid);
      assert.match(owner.token, /^[0-9a-f-]+$/i);
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('stale reclamation never removes a live replacement owner', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-transaction-lock-reclaim-'));
  try {
    const scope = ['proj', 'plan', 'F0'];
    const lockPath = scopeTransactionLockPath(root, 'phase-state', scope);
    mkdirSync(dirname(lockPath), { recursive: true });
    writeFileSync(lockPath, `${JSON.stringify({ version: 1, pid: 99999999, token: 'stale' })}\n`);
    const liveOwner = { version: 1, pid: process.pid, token: 'live-replacement' };
    let injected = false;
    let entered = false;

    await assert.rejects(
      withScopeTransactionLock(root, 'phase-state', scope, async () => {
        entered = true;
      }, {
        maxAttempts: 2,
        retryMs: 0,
        faultAt: ({ point }) => {
          if (point !== 'before-stale-reclaim' || injected) return;
          injected = true;
          unlinkSync(lockPath);
          writeFileSync(lockPath, `${JSON.stringify(liveOwner)}\n`);
        },
      }),
      /timed out/i,
    );
    assert.equal(injected, true);
    assert.equal(entered, false);
    assert.deepEqual(JSON.parse(readFileSync(lockPath, 'utf8')), liveOwner);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('scope lock rejects a symlinked state root before creating external files', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-transaction-lock-symlink-'));
  const outside = mkdtempSync(join(tmpdir(), 'as-transaction-lock-outside-'));
  try {
    symlinkSync(outside, join(root, '.atomic-skills'));
    await assert.rejects(
      withScopeTransactionLock(root, 'phase-state', ['proj', 'plan', 'F0'], async () => {}),
      /symbolic link|symlink|confined/i,
    );
    assert.equal(existsSync(join(outside, 'status')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('scope lock rejects a symlinked status directory before creating external files', async () => {
  const root = mkdtempSync(join(tmpdir(), 'as-transaction-lock-status-symlink-'));
  const outside = mkdtempSync(join(tmpdir(), 'as-transaction-lock-status-outside-'));
  try {
    mkdirSync(join(root, '.atomic-skills'));
    symlinkSync(outside, join(root, '.atomic-skills', 'status'));
    await assert.rejects(
      withScopeTransactionLock(root, 'phase-state', ['proj', 'plan', 'F0'], async () => {}),
      /symbolic link|symlink|confined/i,
    );
    assert.equal(existsSync(join(outside, 'transaction-locks')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});
