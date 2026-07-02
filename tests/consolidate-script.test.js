import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
