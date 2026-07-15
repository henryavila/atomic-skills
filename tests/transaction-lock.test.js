import test from 'node:test';
import assert from 'node:assert/strict';
import { lstatSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
