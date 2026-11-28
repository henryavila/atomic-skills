/**
 * Pins the exit codes and stderr text of verify-upstream-receipt's CLI.
 * Each case runs the real script against a throwaway local git worktree; no
 * network and no provider CLI is involved.
 */
import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'scripts/verify-upstream-receipt.js');
const TASK = 'F1/T-002';

describe('verify-upstream-receipt CLI error table', () => {
  let tempDir;
  let worktree;
  let receiptPath;
  let baseSha;

  const git = (args) => execFileSync(
    'git',
    ['-C', worktree, '-c', 'user.name=test', '-c', 'user.email=test@example.com', ...args],
    { encoding: 'utf8' },
  ).trim();

  const receipt = (overrides = {}) => ({
    schemaVersion: '1',
    package: '@henryavila/minimalist-installer',
    version: '0.1.0',
    dist: { integrity: 'sha512-test' },
    baseSha,
    tasks: { [TASK]: { status: 'local', resultSha: baseSha } },
    ...overrides,
  });

  const run = (args) => spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    cwd: ROOT,
  });

  const worktreeArgs = () => [
    '--task', TASK,
    '--worktree', worktree,
    '--receipt', receiptPath,
  ];

  before(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'upstream-receipt-errors-'));
    worktree = join(tempDir, 'worktree');
    receiptPath = join(tempDir, 'receipt.json');
    execFileSync('git', ['init', '-b', 'main', worktree]);
    execFileSync('git', [
      '-C', worktree, 'remote', 'add', 'origin', 'git@example.com:test/repo.git',
    ]);
    git(['commit', '--allow-empty', '-m', 'base']);
    baseSha = git(['rev-parse', 'HEAD']);
    git(['commit', '--allow-empty', '-m', 'head']);
  });

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const CASES = [
    {
      name: 'missing arguments',
      args: [],
      status: 1,
      stdout: `Usage: node scripts/verify-upstream-receipt.js --task F1/T-00N --worktree <path> [--require-remote] [--receipt path]\n`,
      stderr: '',
    },
    {
      name: 'help',
      args: ['--help'],
      status: 0,
      stdout: `Usage: node scripts/verify-upstream-receipt.js --task F1/T-00N --worktree <path> [--require-remote] [--receipt path]\n`,
      stderr: '',
    },
    {
      name: 'missing receipt',
      setup: null,
      args: () => [
        '--task', TASK,
        '--worktree', worktree,
        '--receipt', join(tempDir, 'absent.json'),
      ],
      status: 1,
      stdout: '',
      stderr: () => `verify-upstream-receipt: receipt missing: ${join(tempDir, 'absent.json')}\n`,
    },
    {
      name: 'incomplete worktree',
      setup: () => receipt(),
      args: () => worktreeArgs().map((arg) => (arg === worktree ? join(tempDir, 'absent') : arg)),
      status: 1,
      stdout: '',
      stderr: () => `verify-upstream-receipt: worktree not found or incomplete: ${join(tempDir, 'absent')}\n`,
    },
    {
      name: 'missing dist integrity',
      setup: () => receipt({ dist: {} }),
      status: 1,
      stdout: '',
      stderr: 'verify-upstream-receipt: receipt.dist.integrity missing (0.1.0 baseline tarball integrity)\n',
    },
    {
      name: 'integrated integrity differs from lock',
      setup: () => receipt({ integrated: { integrity: 'sha512-other' } }),
      status: 1,
      stdout: '',
      stderr: () => 'verify-upstream-receipt: receipt.integrated.integrity !== package-lock integrity\n'
        + '  receipt: sha512-other\n'
        + `  lock:    ${lockIntegrity()}\n`,
    },
    {
      name: 'baseSha is not a full sha',
      setup: () => receipt({ baseSha: 'abc' }),
      status: 1,
      stdout: '',
      stderr: 'verify-upstream-receipt: receipt.baseSha must be a full 40-char SHA, got: abc\n',
    },
    {
      name: 'baseSha is not a commit',
      setup: () => receipt({ baseSha: '0'.repeat(40) }),
      status: 1,
      stdout: '',
      stderr: `verify-upstream-receipt: baseSha ${'0'.repeat(40)} is not a commit in worktree\n`,
    },
    {
      name: 'task missing from receipt',
      setup: () => receipt({ tasks: {} }),
      status: 1,
      stdout: '',
      stderr: `verify-upstream-receipt: receipt.tasks missing entry for ${TASK}\n`,
    },
    {
      name: 'task resultSha not in worktree',
      setup: () => receipt({ tasks: { [TASK]: { status: 'local', resultSha: '1'.repeat(40) } } }),
      status: 1,
      stdout: '',
      stderr: `verify-upstream-receipt: task ${TASK} resultSha ${'1'.repeat(40)} not in worktree\n`,
    },
  ];

  for (const testCase of CASES) {
    it(testCase.name, () => {
      if (testCase.setup) {
        writeFileSync(receiptPath, JSON.stringify(testCase.setup()));
      } else {
        rmSync(receiptPath, { force: true });
      }
      const result = run(typeof testCase.args === 'function' ? testCase.args() : (testCase.args || worktreeArgs()));
      assert.equal(result.status, testCase.status);
      assert.equal(result.stdout, typeof testCase.stdout === 'function' ? testCase.stdout() : testCase.stdout);
      assert.equal(result.stderr, typeof testCase.stderr === 'function' ? testCase.stderr() : testCase.stderr);
    });
  }

  it('reports a coherent worktree as JSON', () => {
    writeFileSync(receiptPath, JSON.stringify(receipt()));
    const result = run(worktreeArgs());
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout), {
      ok: true,
      task: TASK,
      baseSha,
      head: git(['rev-parse', 'HEAD']),
      branch: 'main',
      taskResultSha: baseSha,
      remotePublished: false,
    });
  });
});

function lockIntegrity() {
  const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'));
  return lock.packages['node_modules/@henryavila/minimalist-installer'].integrity;
}
