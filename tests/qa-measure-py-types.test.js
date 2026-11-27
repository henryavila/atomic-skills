import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import {
  chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MEASURER = join(REPO_ROOT, 'qa/measure/py-types');
const CEILINGS = join(REPO_ROOT, 'qa/ceilings.tsv');
const STACKS = join(REPO_ROOT, 'qa/stacks.tsv');
const FIXTURE = join(REPO_ROOT, 'tests/fixtures/qa/py-types');

describe('qa/measure/py-types', () => {
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

  function fakeMypy() {
    const bin = join(root, 'fakevenv/bin');
    mkdirSync(bin, { recursive: true });
    const script = [
      '#!/usr/bin/env python3',
      'import os, sys',
      "files = [item for item in sys.argv[1:] if item.endswith('.py')]",
      'for path in files:',
      '    sys.stdout.write(os.path.join(os.getcwd(), path) + ":1: error: fake error  [misc]\\n")',
      'sys.exit(1 if files else 0)',
      '',
    ].join('\n');
    writeFileSync(join(bin, 'mypy'), script);
    chmodSync(join(bin, 'mypy'), 0o755);
    return join(root, 'fakevenv');
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'qa-py-types-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('describes itself', () => {
    const result = run(['--describe']);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.stdout.trim().split('\n'), [
      'mode\tfast',
      'changed\tno',
      'covers\tpy\ttype-errors',
    ]);
  });

  it('converts a recorded mypy report into one count per file', () => {
    plant();
    expectLines(run(['--convert', join(FIXTURE, 'report.txt')]), [
      'py\ttype-errors\tsample/typed.py::*\t3',
    ]);
  });

  it('prints nothing for a clean report', () => {
    plant({ 'report.txt': '' });
    expectLines(run(['--convert', join(root, 'report.txt')]), []);
  });

  it('runs mypy once per script and adds the errors', () => {
    const venv = fakeMypy();
    plant({
      'skills/shared/a.py': 'def a():\n    return 1\n',
      'skills/shared/b.py': 'def b():\n    return 2\n',
    });
    expectLines(run([], { QA_VENV: venv }), [
      'py\ttype-errors\tskills/shared/a.py::*\t1',
      'py\ttype-errors\tskills/shared/b.py::*\t1',
    ]);
  });

  it('exits 3 when mypy is not in the venv', () => {
    const empty = join(root, 'emptyvenv');
    mkdirSync(empty, { recursive: true });
    const result = run([], { QA_VENV: empty });
    assert.equal(result.status, 3, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /mypy/);
    assert.match(result.stderr, /setup/);
  });
});
