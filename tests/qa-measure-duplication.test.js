import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MEASURER = join(REPO_ROOT, 'qa/measure/duplication');
const CEILINGS = join(REPO_ROOT, 'qa/ceilings.tsv');

function cloneBody() {
  return Array.from(
    { length: 12 },
    (_, i) => `const value${i} = computeSomething(${i}, anotherArgument, thirdArgument);`,
  ).join('\n') + '\n';
}

function pythonCloneBody() {
  return Array.from(
    { length: 12 },
    (_, i) => `value${i} = compute_something(${i}, another_argument, third_argument)`,
  ).join('\n') + '\n';
}

describe('qa/measure/duplication', () => {
  let root;

  function plant(files) {
    mkdirSync(join(root, 'qa'), { recursive: true });
    copyFileSync(CEILINGS, join(root, 'qa/ceilings.tsv'));
    for (const [path, body] of Object.entries(files)) {
      const target = join(root, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, body);
    }
  }

  function run(args = []) {
    return spawnSync(process.execPath, [MEASURER, ...args], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: { ...process.env, QA_ROOT: root },
    });
  }

  function lines(result) {
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    return result.stdout.split('\n').filter(Boolean).sort();
  }

  function expectLines(result, expected) {
    assert.deepEqual(lines(result), [...expected].sort());
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'qa-duplication-'));
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
      'covers\tjs\tduplication',
      'covers\tpy\tduplication',
    ]);
  });

  it('prints nothing for a clean tree', () => {
    plant({
      'src/one.js': 'export const one = 1;\n',
      'src/two.js': 'export const two = 2;\n',
      'skills/shared/one.py': 'one = 1\n',
      'skills/shared/two.py': 'two = 2\n',
    });
    expectLines(run(), []);
  });

  it('measures duplicated lines per file for javascript and python', () => {
    plant({
      'src/a.js': cloneBody(),
      'src/b.js': cloneBody(),
      'skills/shared/c.py': pythonCloneBody(),
      'skills/shared/d.py': pythonCloneBody(),
    });
    expectLines(run(), [
      'js\tduplication\tsrc/a.js::*\t11',
      'js\tduplication\tsrc/b.js::*\t11',
      'py\tduplication\tskills/shared/c.py::*\t11',
      'py\tduplication\tskills/shared/d.py::*\t11',
    ]);
  });
});
