import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MEASURER = join(REPO_ROOT, 'qa/measure/js-cycles');
const CEILINGS = join(REPO_ROOT, 'qa/ceilings.tsv');

describe('qa/measure/js-cycles', () => {
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
    root = mkdtempSync(join(tmpdir(), 'qa-js-cycles-'));
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
      'covers\tjs\timport-cycles',
    ]);
  });

  it('prints nothing for a clean tree', () => {
    plant({
      'src/a.js': "import { b } from './b.js';\nexport const a = b;\n",
      'src/b.js': 'export const b = 1;\n',
    });
    expectLines(run(), []);
  });

  it('measures a cycle with the first file in sorted order as the key', () => {
    plant({
      'src/z.js': "import { a } from './a.js';\nexport const z = a;\n",
      'src/a.js': "import { z } from './z.js';\nexport const a = z;\n",
    });
    expectLines(run(), ['js\timport-cycles\tsrc/a.js::cycle>src/z.js\t1']);
  });
});
