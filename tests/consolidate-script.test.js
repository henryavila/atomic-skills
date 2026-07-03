import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function git(repo, args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
}

function initRepo(rootName = 'repo') {
  const root = mkdtempSync(join(tmpdir(), 'as-consolidate-'));
  const repo = join(root, rootName);
  execFileSync('git', ['init', repo], { encoding: 'utf8' });
  git(repo, ['config', 'user.email', 'test@example.com']);
  git(repo, ['config', 'user.name', 'Test User']);
  writeFileSync(join(repo, 'README.md'), '# fixture\n');
  git(repo, ['add', 'README.md']);
  git(repo, ['commit', '-m', 'initial']);
  return { root, repo };
}

function runConsolidate(args) {
  return spawnSync(process.execPath, ['scripts/consolidate.mjs', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

function currentBranch(repo) {
  return git(repo, ['branch', '--show-current']).trim();
}

function readRun(repo) {
  return JSON.parse(readFileSync(join(repo, '.atomic-skills', 'status', 'consolidate-run.json'), 'utf8'));
}

test('consolidate fails when a requested branch cannot be resolved', () => {
  const { root, repo } = initRepo();
  try {
    const result = runConsolidate([
      '--workdir', repo,
      '--base', 'HEAD',
      '--branches', '__missing_branch__',
    ]);
    assert.notEqual(result.status, 0);
    assert.match(`${result.stderr}\n${result.stdout}`, /__missing_branch__/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('consolidate runs gate with cwd option, not shell-interpolated workdir', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-consolidate-injection-'));
  const marker = join(root, 'pwned');
  const repoName = `repo; echo PWNED > ${marker} #`;
  const repo = join(root, repoName);
  execFileSync('git', ['init', repo], { encoding: 'utf8' });
  git(repo, ['config', 'user.email', 'test@example.com']);
  git(repo, ['config', 'user.name', 'Test User']);
  writeFileSync(join(repo, 'README.md'), '# fixture\n');
  git(repo, ['add', 'README.md']);
  git(repo, ['commit', '-m', 'initial']);

  try {
    const result = runConsolidate([
      '--workdir', repo,
      '--base', 'HEAD',
      '--branches', 'HEAD',
      '--gate', 'printf gate-ok',
    ]);
    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    assert.equal(existsSync(marker), false, 'workdir shell metacharacters must not execute');
    assert.match(result.stdout, /GATE PASS/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('consolidate persists a passed run record with merged candidate state', () => {
  const { root, repo } = initRepo();
  try {
    const base = currentBranch(repo);
    git(repo, ['checkout', '-b', 'plan/a']);
    writeFileSync(join(repo, 'a.txt'), 'a\n');
    git(repo, ['add', 'a.txt']);
    git(repo, ['commit', '-m', 'feat: a']);
    git(repo, ['checkout', base]);

    const result = runConsolidate([
      '--workdir', repo,
      '--base', base,
      '--branches', 'plan/a',
    ]);

    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    const run = readRun(repo);
    assert.equal(run.kind, 'consolidate-run');
    assert.equal(run.status, 'passed');
    assert.deepEqual(run.branches, ['plan/a']);
    assert.equal(run.candidates[0].branch, 'plan/a');
    assert.equal(run.candidates[0].status, 'merged');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('consolidate persists blocked run record with ejected paths before halting', () => {
  const { root, repo } = initRepo();
  try {
    const base = currentBranch(repo);
    writeFileSync(join(repo, 'conflict.txt'), 'base\n');
    git(repo, ['add', 'conflict.txt']);
    git(repo, ['commit', '-m', 'base conflict file']);

    git(repo, ['checkout', '-b', 'plan/a']);
    writeFileSync(join(repo, 'conflict.txt'), 'branch\n');
    git(repo, ['add', 'conflict.txt']);
    git(repo, ['commit', '-m', 'feat: branch conflict']);

    git(repo, ['checkout', base]);
    writeFileSync(join(repo, 'conflict.txt'), 'main\n');
    git(repo, ['add', 'conflict.txt']);
    git(repo, ['commit', '-m', 'chore: main conflict']);

    const result = runConsolidate([
      '--workdir', repo,
      '--base', base,
      '--branches', 'plan/a',
    ]);

    assert.equal(result.status, 2, `${result.stderr}\n${result.stdout}`);
    const run = readRun(repo);
    assert.equal(run.status, 'blocked');
    assert.equal(run.stop.branch, 'plan/a');
    assert.equal(run.candidates[0].status, 'ejected');
    assert.deepEqual(run.candidates[0].ejected.map((entry) => entry.path), ['conflict.txt']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('consolidate --resume reloads base and branches from the run file', () => {
  const { root, repo } = initRepo();
  try {
    const base = currentBranch(repo);
    const runDir = join(repo, '.atomic-skills', 'status');
    mkdirSync(runDir, { recursive: true });
    writeFileSync(join(runDir, 'consolidate-run.json'), JSON.stringify({
      schemaVersion: '0.1',
      kind: 'consolidate-run',
      runId: 'cons-test',
      status: 'blocked',
      workdir: repo,
      base,
      branches: [base],
      gate: 'printf resumed-gate',
      candidates: [{ branch: base, status: 'ejected', ejected: [{ path: 'README.md', class: 'eject' }] }],
      audit: [],
      stop: { branch: base, ejected: [{ path: 'README.md', class: 'eject' }] },
    }, null, 2));

    const result = runConsolidate([
      '--workdir', repo,
      '--resume',
    ]);

    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    assert.match(result.stdout, /GATE PASS/);
    const run = readRun(repo);
    assert.equal(run.status, 'passed');
    assert.equal(run.gate, 'printf resumed-gate');
    assert.equal(run.resumedAt.includes('T'), true);
    assert.deepEqual(run.branches, [base]);
    assert.equal(run.candidates[0].status, 'skipped');
    assert.equal(run.candidates[0].history[0].status, 'ejected');
    assert.deepEqual(run.candidates[0].history[0].ejected.map((entry) => entry.path), ['README.md']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
