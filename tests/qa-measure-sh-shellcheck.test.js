import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MEASURER = join(REPO_ROOT, 'qa/measure/sh-shellcheck');
const CEILINGS = join(REPO_ROOT, 'qa/ceilings.tsv');
const STACKS = join(REPO_ROOT, 'qa/stacks.tsv');

describe('qa/measure/sh-shellcheck', () => {
  let root;

  function plant(files = {}) {
    mkdirSync(join(root, 'qa'), { recursive: true });
    copyFileSync(CEILINGS, join(root, 'qa/ceilings.tsv'));
    copyFileSync(STACKS, join(root, 'qa/stacks.tsv'));
    for (const [path, body] of Object.entries(files)) {
      const target = join(root, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, body);
    }
  }

  function run(args = [], env = {}) {
    return spawnSync(MEASURER, args, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: { ...process.env, QA_ROOT: root, PYTHONDONTWRITEBYTECODE: '1', ...env },
    });
  }

  function lines(result) {
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    return result.stdout.split('\n').filter(Boolean).sort();
  }

  function expectLines(result, expected) {
    assert.deepEqual(lines(result), [...expected].sort());
  }

  const bad = '#!/bin/sh\necho $1\n';
  const clean = '#!/bin/sh\nset -eu\nvalue=1\nprintf \'%s\\n\' "$value"\n';

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'qa-sh-shellcheck-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('describes itself', () => {
    const result = run(['--describe']);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.stdout.trim().split('\n'), [
      'mode\tfast',
      'changed\tyes',
      'covers\tsh\tstatic-security',
    ]);
  });

  it('prints nothing for a clean tree', () => {
    plant({ 'tests/hooks/ok.sh': clean });
    expectLines(run(), []);
  });

  it('measures a finding in a script under the sh roots', () => {
    plant({ 'tests/hooks/bad.sh': bad });
    expectLines(run(), ['sh\tstatic-security\ttests/hooks/bad.sh::*\t1']);
  });

  it('measures every file in .husky and limits --files', () => {
    plant({
      'tests/hooks/a.sh': bad,
      'tests/hooks/b.sh': bad,
      '.husky/pre-commit': bad,
    });
    expectLines(run(), [
      'sh\tstatic-security\t.husky/pre-commit::*\t1',
      'sh\tstatic-security\ttests/hooks/a.sh::*\t1',
      'sh\tstatic-security\ttests/hooks/b.sh::*\t1',
    ]);
    expectLines(run(['--files', 'tests/hooks/b.sh']), [
      'sh\tstatic-security\ttests/hooks/b.sh::*\t1',
    ]);
  });

  it('ignores the husky-generated .husky/_ directory', () => {
    plant({
      '.husky/_/hook': bad,
      '.husky/pre-commit': bad,
    });
    expectLines(run(), [
      'sh\tstatic-security\t.husky/pre-commit::*\t1',
    ]);
    expectLines(run(['--files', '.husky/_/hook']), []);
  });

  it('measures only tracked shell files in a git tree', () => {
    plant({ 'tests/hooks/tracked.sh': bad });
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'qa@example.test'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'QA Test'], { cwd: root });
    execFileSync('git', ['add', '-A'], { cwd: root });
    execFileSync('git', ['commit', '-qm', 'base'], { cwd: root });

    plant({
      'tests/hooks/untracked.sh': bad,
      '.husky/_/hook': bad,
      '.husky/pre-commit': bad,
    });
    expectLines(run(), [
      'sh\tstatic-security\ttests/hooks/tracked.sh::*\t1',
    ]);
  });

  it('ignores a repository .shellcheckrc that disables checks', () => {
    plant({
      '.shellcheckrc': 'disable=all\n',
      'tests/hooks/bad.sh': bad,
    });
    expectLines(run(), ['sh\tstatic-security\ttests/hooks/bad.sh::*\t1']);
  });

  it('fails when shellcheck cannot parse a file', () => {
    plant({ 'tests/hooks/syntax.sh': '#!/bin/sh\nif [\n' });
    const result = run();
    assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /could not parse/i);
    assert.match(result.stderr, /tests\/hooks\/syntax\.sh/);
  });

  it('exits 3 when the shellcheck binary is missing', () => {
    plant();
    const result = run([], { QA_SHELLCHECK: join(root, 'missing/shellcheck') });
    assert.equal(result.status, 3, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /shellcheck/);
  });
});
