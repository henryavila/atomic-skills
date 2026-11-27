import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { copyFileSync, chmodSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MEASURER = join(REPO_ROOT, 'qa/measure/js-size');
const CEILINGS = join(REPO_ROOT, 'qa/ceilings.tsv');

/**
 * The measurer is run from the repository so Node resolves eslint, and points
 * at a temporary tree with QA_ROOT.
 */
describe('qa/measure/js-size', () => {
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
    root = mkdtempSync(join(tmpdir(), 'qa-js-size-'));
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
      'covers\tjs\tcomplexity',
      'covers\tjs\tfunction-lines',
      'covers\tjs\tparams',
      'covers\tjs\tfile-lines',
      'covers\tjs\tsilent-errors',
    ]);
  });

  it('prints nothing for a clean tree', () => {
    plant({ 'src/ok.js': 'export function ok(value) {\n  return value;\n}\n' });
    expectLines(run(), []);
  });

  it('exits non-zero with a message when a directory cannot be read', () => {
    plant({ 'src/locked/x.js': 'export const x = 1;\n' });
    const locked = join(root, 'src/locked');
    chmodSync(locked, 0o000);
    try {
      const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
      let readable = true;
      try {
        readdirSync(locked);
      } catch {
        readable = false;
      }
      // Root ignores permissions and some platforms ignore chmod for the
      // owner, so this case cannot be exercised there.
      if (isRoot || readable) {
        assert.ok(isRoot || readable, 'chmod did not make the directory unreadable');
        return;
      }

      const result = run();
      assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
      assert.notEqual(result.status, 3, `${result.stdout}\n${result.stderr}`);
      assert.match(result.stderr, /locked/);
    } finally {
      chmodSync(locked, 0o755);
    }
  });

  it('measures complexity', () => {
    const branches = Array.from({ length: 15 }, (_, i) => `  if (n === ${i}) return ${i};`).join('\n');
    plant({ 'src/complex.js': `export function complicated(n) {\n${branches}\n  return -1;\n}\n` });
    expectLines(run(), ['js\tcomplexity\tsrc/complex.js::complicated\t16']);
  });

  it('measures function lines', () => {
    const body = Array.from({ length: 79 }, (_, i) => `  const value${i} = ${i};`).join('\n');
    plant({ 'src/long.js': `export function longOne() {\n${body}\n}\n` });
    expectLines(run(), ['js\tfunction-lines\tsrc/long.js::longOne\t81']);
  });

  it('measures parameters', () => {
    plant({ 'src/params.js': 'export function many(a, b, c, d, e, f) {\n  return a;\n}\n' });
    expectLines(run(), ['js\tparams\tsrc/params.js::many\t6']);
  });

  it('ignores inline eslint configuration in the measured code', () => {
    plant({
      'src/inline.js': [
        '/* eslint max-params: ["error", 99] */',
        'export function raised(a, b, c, d, e, f) {',
        '  return a;',
        '}',
        '// eslint-disable-next-line max-params',
        'export function disabled(a, b, c, d, e, f) {',
        '  return a;',
        '}',
        '',
      ].join('\n'),
    });
    expectLines(run(), [
      'js\tparams\tsrc/inline.js::disabled\t6',
      'js\tparams\tsrc/inline.js::raised\t6',
    ]);
  });

  it('measures file lines', () => {
    const body = Array.from({ length: 801 }, (_, i) => `const value${i} = ${i};`).join('\n');
    plant({ 'src/big.js': `${body}\n` });
    expectLines(run(), ['js\tfile-lines\tsrc/big.js::*\t801']);
  });

  it('measures silent errors per function and per module', () => {
    const body = [
      'export function bad() {',
      '  try {',
      '    a();',
      '  } catch (error) {}',
      '  try {',
      '    b();',
      '  } catch (error) {}',
      '}',
      'export function commented() {',
      '  try {',
      '    c();',
      '  } catch (error) { /* ignored on purpose */ }',
      '}',
      'try {',
      '  d();',
      '} catch (error) {}',
      '',
    ].join('\n');
    plant({ 'src/errors.js': body });
    expectLines(run(), [
      'js\tsilent-errors\tsrc/errors.js::bad\t2',
      'js\tsilent-errors\tsrc/errors.js::<module>\t1',
    ]);
  });

  it('names a function assigned to a computed property', () => {
    plant({
      'src/computed.js': [
        'const stringKey = {["foo"]: (a, b, c, d, e, f) => a};',
        'const numberKey = {[1]: (a, b, c, d, e, f) => a};',
        'const name = "bar";',
        'const dynamicKey = {[name]: (a, b, c, d, e, f) => a};',
        '',
      ].join('\n'),
    });
    expectLines(run(), [
      'js\tparams\tsrc/computed.js::foo\t6',
      'js\tparams\tsrc/computed.js::1\t6',
      'js\tparams\tsrc/computed.js::<computed>\t6',
    ]);
  });

  it('names functions by class, nesting, assignment and duplicate', () => {
    const body = [
      'class Widget {',
      '  handle(a, b, c, d, e, f) {',
      '    return a;',
      '  }',
      '}',
      'export function outer() {',
      '  function inner(a, b, c, d, e, f) {',
      '    return a;',
      '  }',
      '  return inner;',
      '}',
      'const arrow = (a, b, c, d, e, f) => a;',
      'export function holder() {',
      '  return (a, b, c, d, e, f) => a;',
      '}',
      'const object = { property: (a, b, c, d, e, f) => a };',
      '[1].map((a, b, c, d, e, f) => a);',
      '[2].map((a, b, c, d, e, f) => a);',
      '',
    ].join('\n');
    plant({ 'src/names.js': body });
    expectLines(run(), [
      'js\tparams\tsrc/names.js::Widget.handle\t6',
      'js\tparams\tsrc/names.js::outer>inner\t6',
      'js\tparams\tsrc/names.js::arrow\t6',
      'js\tparams\tsrc/names.js::holder><anonymous>\t6',
      'js\tparams\tsrc/names.js::property\t6',
      'js\tparams\tsrc/names.js::<anonymous>\t6',
      'js\tparams\tsrc/names.js::<anonymous>#2\t6',
    ]);
  });

  it('does not measure tests', () => {
    plant({ 'tests/y.js': 'export function many(a, b, c, d, e, f) {\n  return a;\n}\n' });
    expectLines(run(), []);
    expectLines(run(['--files', 'tests/y.js']), []);
  });

  it('limits --files to the listed production files', () => {
    plant({
      'src/a.js': 'export function many(a, b, c, d, e, f) {\n  return a;\n}\n',
      'src/b.js': 'export function alsoMany(a, b, c, d, e, f) {\n  return a;\n}\n',
    });
    expectLines(run(), [
      'js\tparams\tsrc/a.js::many\t6',
      'js\tparams\tsrc/b.js::alsoMany\t6',
    ]);
    expectLines(run(['--files', 'src/a.js']), ['js\tparams\tsrc/a.js::many\t6']);
  });
});
