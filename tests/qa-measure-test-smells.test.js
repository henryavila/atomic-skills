import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MEASURER = join(REPO_ROOT, 'qa/measure/test-smells');
const CEILINGS = join(REPO_ROOT, 'qa/ceilings.tsv');

describe('qa/measure/test-smells', () => {
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
    root = mkdtempSync(join(tmpdir(), 'qa-test-smells-'));
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
      'covers\tjs\tfixed-sleeps',
      'covers\tjs\tunowned-skips',
    ]);
  });

  it('prints nothing for a clean tree and ignores fixtures', () => {
    plant({
      'tests/clean.test.js': "test('ok', () => {\n  assert.equal(1, 1);\n});\n",
      'test/app-map/fixtures/slow.test.js': [
        "test('slow', async () => {",
        '  await new Promise((resolve) => setTimeout(resolve, 1000));',
        '});',
        "test('skipped', { skip: 'waiting' }, () => {});",
        '',
      ].join('\n'),
    });
    expectLines(run(), []);
  });

  it('measures a fixed sleep', () => {
    plant({
      'tests/slow.test.js': [
        "test('slow', async () => {",
        '  await new Promise((resolve) => setTimeout(resolve, 1000));',
        '});',
        '',
      ].join('\n'),
    });
    expectLines(run(), ['js\tfixed-sleeps\ttests/slow.test.js::*\t1']);
  });

  it('measures unowned skips and accepts an owner with a date', () => {
    plant({
      'tests/skips.test.js': [
        "test('unowned', { skip: 'waiting for infra' }, () => {});",
        "test('owned', { skip: '@alice 2026-01-01 blocked upstream' }, () => {});",
        "test('disabled', { skip: false }, () => {});",
        "test.skip('call', () => {});",
        '',
      ].join('\n'),
    });
    expectLines(run(), ['js\tunowned-skips\ttests/skips.test.js::*\t2']);
  });

  it('limits --files to the listed test files', () => {
    plant({
      'tests/a.test.js': [
        "test('slow', async () => {",
        '  await new Promise((resolve) => setTimeout(resolve, 1000));',
        '});',
        '',
      ].join('\n'),
      'tests/b.test.js': [
        "test('slow', async () => {",
        '  await new Promise((resolve) => setTimeout(resolve, 1000));',
        '});',
        '',
      ].join('\n'),
    });
    expectLines(run(), [
      'js\tfixed-sleeps\ttests/a.test.js::*\t1',
      'js\tfixed-sleeps\ttests/b.test.js::*\t1',
    ]);
    expectLines(run(['--files', 'tests/a.test.js']), ['js\tfixed-sleeps\ttests/a.test.js::*\t1']);
  });
});
