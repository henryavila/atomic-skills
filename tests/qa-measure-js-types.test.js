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
const MEASURER = join(REPO_ROOT, 'qa/measure/js-types');
const CEILINGS = join(REPO_ROOT, 'qa/ceilings.tsv');
const TSCONFIG = join(REPO_ROOT, 'qa/measure/lib/tsconfig.json');

function fakeTypescriptApp(script) {
  const app = mkdtempSync(join(tmpdir(), 'qa-js-types-app-'));
  mkdirSync(join(app, 'qa/measure/lib'), { recursive: true });
  copyFileSync(MEASURER, join(app, 'qa/measure/js-types'));
  copyFileSync(TSCONFIG, join(app, 'qa/measure/lib/tsconfig.json'));
  const packageDir = join(app, 'node_modules/typescript');
  mkdirSync(join(packageDir, 'bin'), { recursive: true });
  mkdirSync(join(app, 'node_modules/@types'), { recursive: true });
  writeFileSync(
    join(packageDir, 'package.json'),
    JSON.stringify({ name: 'typescript', version: '0.0.0', bin: { tsc: 'bin/tsc' } }),
  );
  const bin = join(packageDir, 'bin/tsc');
  writeFileSync(bin, script);
  chmodSync(bin, 0o755);
  return app;
}

describe('qa/measure/js-types', () => {
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
    root = mkdtempSync(join(tmpdir(), 'qa-js-types-'));
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
      'covers\tjs\ttype-errors',
    ]);
  });

  it('prints nothing for a clean tree and ignores files outside the roots', () => {
    plant({
      'package.json': '{"type":"module"}\n',
      'src/ok.js': 'export const answer = 42;\n',
      'tests/bad.js': "/** @type {number} */\nexport const bad = 'not a number';\n",
    });
    expectLines(run(), []);
  });

  it('measures type errors per file', () => {
    plant({
      'package.json': '{"type":"module"}\n',
      'src/bad.js': "/** @type {number} */\nexport const bad = 'not a number';\n/** @type {string} */\nexport const also = 42;\n",
    });
    expectLines(run(), ['js\ttype-errors\tsrc/bad.js::*\t2']);
  });

  it('accepts an indented continuation of a located diagnostic', () => {
    plant({
      'package.json': '{"type":"module"}\n',
      'src/bad.js': "/** @type {number} */\nexport const bad = 'not a number';\n",
    });
    const target = join(root, 'src/bad.js');
    const diagnostic = `${target}(1,1): error TS2322: mocked type error`;
    const app = fakeTypescriptApp([
      `process.stdout.write(${JSON.stringify(`${diagnostic}\n  The types are not related.\n`)});`,
      'process.exit(2);',
      '',
    ].join('\n'));
    try {
      expectLines(run([], { measurer: join(app, 'qa/measure/js-types') }), [
        'js\ttype-errors\tsrc/bad.js::*\t1',
      ]);
    } finally {
      rmSync(app, { recursive: true, force: true });
    }
  });

  it('fails when a measured subtree cannot be read', () => {
    plant({
      'package.json': '{"type":"module"}\n',
      'src/ok.js': 'export const ok = 1;\n',
      'src/locked/hidden.js': 'export const hidden = 1;\n',
    });
    const locked = join(root, 'src/locked');
    chmodSync(locked, 0o000);
    try {
      const result = run();
      assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
      assert.match(result.stderr, /locked/);
      assert.equal(result.stdout, '');
    } finally {
      chmodSync(locked, 0o755);
    }
  });

  it('fails when the compiler writes to stderr after a diagnostic', () => {
    plant({
      'package.json': '{"type":"module"}\n',
      'src/bad.js': "/** @type {number} */\nexport const bad = 'not a number';\n",
    });
    const target = join(root, 'src/bad.js');
    const diagnostic = `${target}(1,1): error TS2322: mocked type error`;
    const app = fakeTypescriptApp([
      `process.stdout.write(${JSON.stringify(`${diagnostic}\n`)});`,
      "process.stderr.write('fatal compiler failure\\n');",
      'process.exit(1);',
      '',
    ].join('\n'));
    try {
      const result = run([], { measurer: join(app, 'qa/measure/js-types') });
      assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
      assert.match(result.stderr, /fatal compiler failure/);
      assert.equal(result.stdout, '');
    } finally {
      rmSync(app, { recursive: true, force: true });
    }
  });

  it('fails on a global compiler error after a located diagnostic', () => {
    plant({
      'package.json': '{"type":"module"}\n',
      'src/bad.js': "/** @type {number} */\nexport const bad = 'not a number';\n",
    });
    const target = join(root, 'src/bad.js');
    const diagnostic = `${target}(1,1): error TS2322: mocked type error`;
    const app = fakeTypescriptApp([
      `process.stdout.write(${JSON.stringify(`${diagnostic}\nerror TS6053: File 'missing.js' not found.\n`)});`,
      'process.exit(2);',
      '',
    ].join('\n'));
    try {
      const result = run([], { measurer: join(app, 'qa/measure/js-types') });
      assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
      assert.match(result.stderr, /TS6053/);
      assert.equal(result.stdout, '');
    } finally {
      rmSync(app, { recursive: true, force: true });
    }
  });

  it('fails before running the compiler when a source file cannot be read', () => {
    plant({
      'package.json': '{"type":"module"}\n',
      'src/locked.js': 'export const locked = 1;\n',
    });
    const locked = join(root, 'src/locked.js');
    chmodSync(locked, 0o000);
    const app = fakeTypescriptApp('process.exit(0);\n');
    try {
      let readable = true;
      try {
        readFileSync(locked);
      } catch {
        readable = false;
      }
      if (!readable) {
        const result = run([], { measurer: join(app, 'qa/measure/js-types') });
        assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
        assert.match(result.stderr, /cannot read.*locked\.js/);
        assert.equal(result.stdout, '');
      }
    } finally {
      chmodSync(locked, 0o644);
      rmSync(app, { recursive: true, force: true });
    }
  });

  it('fails when the compiler crashes after printing a diagnostic', () => {
    plant({
      'package.json': '{"type":"module"}\n',
      'src/bad.js': "/** @type {number} */\nexport const bad = 'not a number';\n",
    });
    const target = join(root, 'src/bad.js');
    const diagnostic = `${target}(1,1): error TS2322: mocked type error`;
    const app = fakeTypescriptApp([
      `process.stdout.write(${JSON.stringify(`${diagnostic}\n`)});`,
      "process.stderr.write('fatal compiler failure\\n');",
      'process.exit(42);',
      '',
    ].join('\n'));
    try {
      const result = run([], { measurer: join(app, 'qa/measure/js-types') });
      assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
      assert.match(result.stderr, /42/);
      assert.equal(result.stdout, '');
    } finally {
      rmSync(app, { recursive: true, force: true });
    }
  });
});
