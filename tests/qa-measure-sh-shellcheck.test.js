import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MEASURER = join(REPO_ROOT, 'qa/measure/sh-shellcheck');
const CEILINGS = join(REPO_ROOT, 'qa/ceilings.tsv');
const STACKS = join(REPO_ROOT, 'qa/stacks.tsv');
const FIXTURE = join(REPO_ROOT, 'tests/fixtures/qa/sh-shellcheck');
const ARGS = 'fake-shellcheck-args';

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

  // A fake shellcheck that records its arguments and prints the recorded
  // report, filtered to the files it was asked about. Exit 1 when there are
  // findings, unless FAKE_SHELLCHECK_EXIT says otherwise.
  function fakeShellcheck(report = 'findings.json') {
    const bin = join(root, 'fakevenv/bin');
    mkdirSync(bin, { recursive: true });
    const script = [
      '#!/usr/bin/env python3',
      'import json, os, sys',
      'args = sys.argv[1:]',
      'with open(os.environ["FAKE_SHELLCHECK_ARGS"], "w", encoding="utf-8") as out:',
      '    out.write("\\n".join(args) + "\\n")',
      'with open(os.environ["FAKE_SHELLCHECK_REPORT"], encoding="utf-8") as handle:',
      '    report = json.load(handle)',
      'files = {arg for arg in args if not arg.startswith("-") and arg != "json"}',
      'report = [item for item in report if item.get("file") in files]',
      'json.dump(report, sys.stdout)',
      'sys.stderr.write(os.environ.get("FAKE_SHELLCHECK_STDERR", ""))',
      'if os.environ.get("FAKE_SHELLCHECK_EXIT"):',
      '    sys.exit(int(os.environ["FAKE_SHELLCHECK_EXIT"]))',
      'sys.exit(1 if report else 0)',
      '',
    ].join('\n');
    writeFileSync(join(bin, 'shellcheck'), script);
    chmodSync(join(bin, 'shellcheck'), 0o755);
    return {
      QA_VENV: join(root, 'fakevenv'),
      FAKE_SHELLCHECK_ARGS: join(root, ARGS),
      FAKE_SHELLCHECK_REPORT: join(FIXTURE, report),
    };
  }

  function passedFiles(result) {
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const args = readFileSync(join(root, ARGS), 'utf8').split('\n').filter(Boolean);
    assert.ok(args.includes('--norc'), args.join(' '));
    assert.ok(args.includes('-f'), args.join(' '));
    assert.ok(args.includes('json'), args.join(' '));
    return args.filter((arg) => !['--norc', '-f', 'json'].includes(arg)).sort();
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

  it('converts a clean recorded report to nothing', () => {
    plant();
    expectLines(run(['--convert', join(FIXTURE, 'clean.json')]), []);
  });

  it('converts findings in a recorded report', () => {
    plant();
    expectLines(run(['--convert', join(FIXTURE, 'findings.json')]), [
      'sh\tstatic-security\t.husky/pre-commit::*\t1',
      'sh\tstatic-security\ttests/hooks/bad.sh::*\t1',
    ]);
  });

  it('counts every finding of a file in a recorded report', () => {
    plant();
    expectLines(run(['--convert', join(FIXTURE, 'counts.json')]), [
      'sh\tstatic-security\t.husky/pre-commit::*\t1',
      'sh\tstatic-security\ttests/hooks/counts.sh::*\t2',
    ]);
  });

  it('fails the converter when shellcheck could not parse a file', () => {
    plant();
    const result = run(['--convert', join(FIXTURE, 'syntax.json')]);
    assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /could not parse/i);
    assert.match(result.stderr, /tests\/hooks\/syntax\.sh/);
  });

  it('prints nothing for a clean tree', () => {
    const env = fakeShellcheck('clean.json');
    plant({ 'tests/hooks/clean.sh': clean });
    expectLines(run([], env), []);
    assert.deepEqual(passedFiles(run([], env)), ['tests/hooks/clean.sh']);
  });

  it('measures findings from the venv shellcheck and passes --norc and JSON', () => {
    const env = fakeShellcheck();
    plant({
      'tests/hooks/bad.sh': bad,
      'tests/hooks/clean.sh': clean,
      '.husky/pre-commit': bad,
    });
    const result = run([], env);
    expectLines(result, [
      'sh\tstatic-security\t.husky/pre-commit::*\t1',
      'sh\tstatic-security\ttests/hooks/bad.sh::*\t1',
    ]);
    assert.deepEqual(passedFiles(result), [
      '.husky/pre-commit',
      'tests/hooks/bad.sh',
      'tests/hooks/clean.sh',
    ]);
  });

  it('limits --files to the listed shell files', () => {
    const env = fakeShellcheck();
    plant({
      'tests/hooks/bad.sh': bad,
      'tests/hooks/clean.sh': clean,
    });
    const result = run(['--files', 'tests/hooks/bad.sh', 'README.md'], env);
    expectLines(result, ['sh\tstatic-security\ttests/hooks/bad.sh::*\t1']);
    assert.deepEqual(passedFiles(result), ['tests/hooks/bad.sh']);
  });

  it('ignores the husky-generated .husky/_ directory', () => {
    const env = fakeShellcheck();
    plant({
      '.husky/_/hook': bad,
      '.husky/pre-commit': bad,
    });
    const result = run([], env);
    expectLines(result, [
      'sh\tstatic-security\t.husky/pre-commit::*\t1',
    ]);
    assert.deepEqual(passedFiles(result), ['.husky/pre-commit']);
    expectLines(run(['--files', '.husky/_/hook'], env), []);
  });

  it('lints only shell sources inside .husky', () => {
    const env = fakeShellcheck();
    plant({
      '.husky/pre-commit': bad,
      '.husky/nested/data.json': bad,
      '.husky/nested/x.sh': bad,
    });
    const result = run([], env);
    expectLines(result, [
      'sh\tstatic-security\t.husky/pre-commit::*\t1',
    ]);
    assert.deepEqual(passedFiles(result), ['.husky/nested/x.sh', '.husky/pre-commit']);
  });

  it('does not lint untracked shell files passed through --files in a git tree', () => {
    const env = fakeShellcheck();
    plant({
      'tests/hooks/bad.sh': bad,
      '.gitignore': 'tests/hooks/ignored.sh\n',
    });
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'qa@example.test'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'QA Test'], { cwd: root });
    execFileSync('git', ['add', '-A'], { cwd: root });
    execFileSync('git', ['commit', '-qm', 'base'], { cwd: root });

    plant({
      'tests/hooks/untracked.sh': bad,
      'tests/hooks/ignored.sh': bad,
    });
    const result = run([
      '--files',
      'tests/hooks/bad.sh',
      'tests/hooks/untracked.sh',
      'tests/hooks/ignored.sh',
    ], env);
    expectLines(result, ['sh\tstatic-security\ttests/hooks/bad.sh::*\t1']);
    assert.deepEqual(passedFiles(result), ['tests/hooks/bad.sh']);
  });

  it('measures only tracked shell files in a git tree', () => {
    const env = fakeShellcheck();
    plant({ 'tests/hooks/bad.sh': bad });
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
    const result = run([], env);
    expectLines(result, [
      'sh\tstatic-security\ttests/hooks/bad.sh::*\t1',
    ]);
    assert.deepEqual(passedFiles(result), ['tests/hooks/bad.sh']);
  });

  it('ignores a repository .shellcheckrc that disables checks', () => {
    const env = fakeShellcheck();
    plant({
      '.shellcheckrc': 'disable=all\n',
      'tests/hooks/bad.sh': bad,
    });
    const result = run([], env);
    expectLines(result, ['sh\tstatic-security\ttests/hooks/bad.sh::*\t1']);
    assert.deepEqual(passedFiles(result), ['tests/hooks/bad.sh']);
  });

  it('fails when shellcheck cannot parse a file', () => {
    const env = fakeShellcheck('syntax.json');
    plant({ 'tests/hooks/syntax.sh': '#!/bin/sh\nif [\n' });
    const result = run([], env);
    assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /could not parse/i);
    assert.match(result.stderr, /tests\/hooks\/syntax\.sh/);
  });

  it('fails when shellcheck exits for a reason other than findings', () => {
    const env = { ...fakeShellcheck(), FAKE_SHELLCHECK_EXIT: '2' };
    plant({ 'tests/hooks/bad.sh': bad });
    const result = run([], env);
    assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /shellcheck exited 2/);
  });

  it('exits 3 when the venv has no shellcheck, even one on PATH', () => {
    plant({ 'tests/hooks/bad.sh': bad });
    const empty = join(root, 'emptyvenv');
    mkdirSync(empty, { recursive: true });
    const onPath = join(root, 'pathbin');
    mkdirSync(onPath, { recursive: true });
    writeFileSync(join(onPath, 'shellcheck'), '#!/bin/sh\necho "[]"\n');
    chmodSync(join(onPath, 'shellcheck'), 0o755);
    const result = run([], {
      QA_VENV: empty,
      PATH: `${onPath}:${process.env.PATH}`,
    });
    assert.equal(result.status, 3, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /shellcheck/);
    assert.match(result.stderr, /scripts\/qa\.sh setup/);
  });
});
