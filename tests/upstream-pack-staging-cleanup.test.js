/**
 * PAY-15B: the staging dir must not leak when staging the upstream package fails.
 *
 * Runs against a local throwaway git repo with its own TMPDIR, never the network.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const SCRIPT = fileURLToPath(new URL('../scripts/test-with-upstream-pack.js', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

function git(dir, args) {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim();
}

describe('test-with-upstream-pack staging cleanup', () => {
  it('removes the staging dir when copying the package fails', () => {
    const dir = mkdtempSync(join(tmpdir(), 'upstream-pack-leak-'));
    try {
      const privateTmp = join(dir, 'tmp');
      mkdirSync(privateTmp);

      // A committed worktree without src/ makes cpSync throw after mkdtempSync.
      const worktree = join(dir, 'upstream');
      mkdirSync(worktree, { recursive: true });
      writeFileSync(
        join(worktree, 'package.json'),
        '{"name":"@henryavila/minimalist-installer","version":"0.0.0"}\n',
      );
      git(worktree, ['init', '-q']);
      git(worktree, ['add', '-A']);
      git(worktree, [
        '-c', 'user.email=qa@example.test',
        '-c', 'user.name=qa',
        'commit', '-q', '-m', 'fixture',
      ]);

      const childEnv = { ...process.env, TMPDIR: privateTmp };
      delete childEnv.NODE_TEST_CONTEXT;
      const r = spawnSync(
        process.execPath,
        [SCRIPT, '--worktree', worktree, '--test', 'tests/does-not-exist.test.js'],
        { cwd: REPO_ROOT, encoding: 'utf8', env: childEnv },
      );

      assert.notEqual(r.status, 0);
      assert.deepEqual(readdirSync(privateTmp), []);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
