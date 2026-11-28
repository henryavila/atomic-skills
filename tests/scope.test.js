import { describe, it, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveProjectScopeTarget } from '../src/scope.js';

describe('resolveProjectScopeTarget', () => {
  const originalHome = process.env.HOME;
  let tmp;

  afterEach(() => {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (tmp) rmSync(tmp, { recursive: true, force: true });
    tmp = null;
  });

  it('surfaces a home resolution failure that is not a missing path', () => {
    tmp = mkdtempSync(join(tmpdir(), 'as-scope-'));
    const repo = join(tmp, 'repo');
    execFileSync('git', ['init', '-q', repo], { stdio: 'ignore' });

    // A file in place of a directory makes realpathSync(homedir()) throw
    // ENOTDIR rather than the missing-path ENOENT the guard tolerates.
    const blocker = join(tmp, 'blocker');
    writeFileSync(blocker, 'not a directory');
    process.env.HOME = join(blocker, 'home');

    assert.throws(
      () => resolveProjectScopeTarget(repo),
      (err) => err.code === 'ENOTDIR',
    );
  });
});
