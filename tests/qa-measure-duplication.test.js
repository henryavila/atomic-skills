import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import {
  chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
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

function largeCloneBody(tag, lines, lineLength) {
  const filler = Array.from({ length: lines - 12 }, (_, i) => {
    const prefix = `// ${tag} padding line ${i} `;
    return prefix + 'x'.repeat(Math.max(1, lineLength - prefix.length));
  });
  return cloneBody() + filler.join('\n') + '\n';
}

function fakeJscpdApp() {
  const app = mkdtempSync(join(tmpdir(), 'qa-duplication-app-'));
  mkdirSync(join(app, 'qa/measure'), { recursive: true });
  copyFileSync(MEASURER, join(app, 'qa/measure/duplication'));
  const packageDir = join(app, 'node_modules/jscpd');
  mkdirSync(join(packageDir, 'dist'), { recursive: true });
  mkdirSync(join(packageDir, 'bin'), { recursive: true });
  writeFileSync(
    join(packageDir, 'package.json'),
    JSON.stringify({ name: 'jscpd', version: '0.0.0', main: 'dist/index.js' }),
  );
  writeFileSync(join(packageDir, 'dist/index.js'), 'module.exports = {};\n');
  const bin = join(packageDir, 'bin/jscpd');
  writeFileSync(bin, 'process.exit(0);\n');
  chmodSync(bin, 0o755);
  return app;
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

  function run(args = [], overrides = {}) {
    return spawnSync(process.execPath, [overrides.measurer || MEASURER, ...args], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: { ...process.env, QA_ROOT: root, ...(overrides.env || {}) },
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

  it('ignores a jsx file that jscpd does not measure as javascript', () => {
    plant({ 'src/only.jsx': cloneBody() });
    expectLines(run(), []);
  });

  it('measures a tree of blank source files as empty', () => {
    plant({
      'src/blank.js': '\n'.repeat(9),
      'skills/shared/blank.py': '\n'.repeat(9),
    });
    expectLines(run(), []);
  });

  it('measures files larger than the default line limit', () => {
    plant({
      'src/a.js': largeCloneBody('a', 1001, 40),
      'src/b.js': largeCloneBody('b', 1001, 40),
    });
    expectLines(run(), [
      'js\tduplication\tsrc/a.js::*\t12',
      'js\tduplication\tsrc/b.js::*\t12',
    ]);
  });

  it('measures files larger than the default size limit', () => {
    plant({
      'src/a.js': largeCloneBody('a', 800, 200),
      'src/b.js': largeCloneBody('b', 800, 200),
    });
    expectLines(run(), [
      'js\tduplication\tsrc/a.js::*\t12',
      'js\tduplication\tsrc/b.js::*\t12',
    ]);
  });

  it('ignores hostile jscpd configuration in the measured tree', () => {
    plant({
      'src/a.js': cloneBody(),
      'src/b.js': cloneBody(),
      '.jscpd.json': JSON.stringify({
        ignore: ['**/*'], debug: true, maxLines: 1, maxSize: '1kb',
      }),
      'package.json': JSON.stringify({
        jscpd: {
          ignore: ['**/*'], debug: true, maxLines: 1, maxSize: '1kb',
        },
      }),
    });
    expectLines(run(), [
      'js\tduplication\tsrc/a.js::*\t11',
      'js\tduplication\tsrc/b.js::*\t11',
    ]);
  });

  it('fails when a measured root cannot be inspected', () => {
    plant({ 'src/placeholder.js': 'export const placeholder = 1;\n' });
    const hidden = join(root, 'hidden-parent');
    mkdirSync(join(hidden, 'src'), { recursive: true });
    writeFileSync(join(hidden, 'src/a.js'), cloneBody());
    writeFileSync(join(hidden, 'src/b.js'), cloneBody());
    chmodSync(hidden, 0o000);
    rmSync(join(root, 'src'), { recursive: true, force: true });
    symlinkSync(join(hidden, 'src'), join(root, 'src'));
    try {
      const result = run();
      assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
      assert.match(result.stderr, /src|cannot inspect/i);
      assert.equal(result.stdout, '');
    } finally {
      chmodSync(hidden, 0o755);
    }
  });

  it('fails when jscpd runs without writing a report', () => {
    plant({
      'src/a.js': cloneBody(),
      'src/b.js': cloneBody(),
    });
    const app = fakeJscpdApp();
    try {
      const result = run([], { measurer: join(app, 'qa/measure/duplication') });
      assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
      assert.match(result.stderr, /report/);
      assert.equal(result.stdout, '');
    } finally {
      rmSync(app, { recursive: true, force: true });
    }
  });
});
