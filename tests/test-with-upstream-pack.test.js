/**
 * CLI contract for scripts/test-with-upstream-pack.js.
 *
 * The staging half runs against a local throwaway git repo, never the network.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const SCRIPT = fileURLToPath(new URL('../scripts/test-with-upstream-pack.js', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

function runScript(args, env = process.env) {
  // The outer runner's marker would make the child runner skip its own file.
  const childEnv = { ...env };
  delete childEnv.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: childEnv,
  });
}

function git(dir, args) {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim();
}

describe('test-with-upstream-pack CLI', () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'upstream-pack-cli-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('prints usage and exits 1 without a worktree and test', () => {
    const r = runScript([]);
    assert.equal(r.status, 1);
    assert.equal(r.stdout, '');
    assert.equal(
      r.stderr,
      'Usage: test-with-upstream-pack.js --worktree <path> --test <file> [--test ...] [--receipt path]\n',
    );
  });

  it('stages a local worktree, runs the test with the overlay env, then cleans up', () => {
    const worktree = join(dir, 'upstream');
    mkdirSync(join(worktree, 'src'), { recursive: true });
    writeFileSync(join(worktree, 'src', 'index.js'), 'export const ok = true;\n');
    writeFileSync(
      join(worktree, 'package.json'),
      '{"name":"@henryavila/minimalist-installer","version":"0.0.0"}\n',
    );
    writeFileSync(join(worktree, 'LICENSE'), 'MIT\n');
    git(worktree, ['init', '-q']);
    git(worktree, ['add', '-A']);
    git(worktree, [
      '-c', 'user.email=qa@example.test',
      '-c', 'user.name=qa',
      'commit', '-q', '-m', 'fixture',
    ]);
    const head = git(worktree, ['rev-parse', 'HEAD']);

    const marker = join(dir, 'marker.txt');
    const spec = join(dir, 'spec.test.js');
    writeFileSync(
      spec,
      [
        "import test from 'node:test';",
        "import { strict as assert } from 'node:assert';",
        "import { writeFileSync } from 'node:fs';",
        "test('overlay env', () => {",
        "  assert.match(process.env.ATOMIC_SKILLS_UPSTREAM_MI_SHA, /^[0-9a-f]{40}$/);",
        "  assert.ok(process.env.ATOMIC_SKILLS_UPSTREAM_MI_ROOT);",
        "  assert.ok(process.env.NODE_PATH.includes('node_modules'));",
        "  writeFileSync(process.env.PAY15B_MARKER, process.env.ATOMIC_SKILLS_UPSTREAM_MI_ROOT);",
        '});',
        '',
      ].join('\n'),
    );

    const r = runScript(
      ['--worktree', worktree, '--test', spec],
      { ...process.env, PAY15B_MARKER: marker },
    );
    let stagingRoot = null;
    try {
      assert.equal(r.status, 0, r.stderr);
      const miRoot = readFileSync(marker, 'utf8');
      assert.equal(git(worktree, ['rev-parse', 'HEAD']), head);
      assert.equal(existsSync(join(miRoot, 'src', 'index.js')), true);
      assert.equal(existsSync(join(miRoot, 'LICENSE')), true);
      stagingRoot = dirname(dirname(dirname(miRoot)));
    } finally {
      if (stagingRoot) rmSync(stagingRoot, { recursive: true, force: true });
    }
  });
});
