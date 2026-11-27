import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MEASURER = join(REPO_ROOT, 'qa/measure/hygiene');
const CEILINGS = join(REPO_ROOT, 'qa/ceilings.tsv');
const STACKS = join(REPO_ROOT, 'qa/stacks.tsv');

/** Fixture text is assembled at run time so this file is not a finding itself. */
const sups = {
  eslint: 'eslint' + '-disable',
  noqa: 'no' + 'qa',
  shellcheck: 'shell' + 'check disable',
};

function awsKey() {
  return 'AK' + 'IA' + 'A'.repeat(16);
}

function githubToken() {
  return 'ghp' + '_' + 'a'.repeat(30);
}

describe('qa/measure/hygiene', () => {
  let root;

  function plant(files) {
    mkdirSync(join(root, 'qa'), { recursive: true });
    copyFileSync(CEILINGS, join(root, 'qa/ceilings.tsv'));
    copyFileSync(STACKS, join(root, 'qa/stacks.tsv'));
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
    root = mkdtempSync(join(tmpdir(), 'qa-hygiene-'));
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
      'covers\tjs\tsuppressions',
      'covers\tjs\tsecrets',
      'covers\tpy\tsuppressions',
      'covers\tpy\tsecrets',
      'covers\tsh\tsuppressions',
      'covers\tsh\tsecrets',
    ]);
  });

  it('prints nothing for a clean tree and ignores generated fixtures', () => {
    plant({
      'src/clean.js': 'export const clean = 1;\n',
      'skills/shared/clean.py': 'clean = 1\n',
      '.husky/clean': 'set -e\n',
      'test/app-map/fixtures/x.js': `// ${sups.eslint}-next-line\nexport const x = 1;\n`,
    });
    expectLines(run(), []);
  });

  it('measures suppression comments in every stack', () => {
    plant({
      'src/a.js': `// ${sups.eslint}-next-line\nconst a = 1;\n`,
      'skills/shared/x.py': `# ${sups.noqa}\nvalue = 1\n`,
      '.husky/pre-commit': `# ${sups.shellcheck}=SC2086\nwith space\n`,
    });
    expectLines(run(), [
      'js\tsuppressions\tsrc/a.js::*\t1',
      'py\tsuppressions\tskills/shared/x.py::*\t1',
      'sh\tsuppressions\t.husky/pre-commit::*\t1',
    ]);
  });

  it('measures secrets in every stack', () => {
    plant({
      'src/leak.js': `export const value = '${awsKey()}';\n`,
      'skills/shared/leak.py': `password = "${'x'.repeat(24)}"\n`,
      '.husky/leak': `value='${githubToken()}'\n`,
    });
    expectLines(run(), [
      'js\tsecrets\tsrc/leak.js::*\t1',
      'py\tsecrets\tskills/shared/leak.py::*\t1',
      'sh\tsecrets\t.husky/leak::*\t1',
    ]);
  });

  it('limits --files to the listed files inside the stack roots', () => {
    plant({
      'src/a.js': `// ${sups.eslint}-next-line\nconst a = 1;\n`,
      'src/b.js': `// ${sups.eslint}-next-line\nconst b = 1;\n`,
      'docs/ignored.js': `// ${sups.eslint}-next-line\nconst x = 1;\n`,
    });
    expectLines(run(), [
      'js\tsuppressions\tsrc/a.js::*\t1',
      'js\tsuppressions\tsrc/b.js::*\t1',
    ]);
    expectLines(run(['--files', 'src/a.js', 'docs/ignored.js']), [
      'js\tsuppressions\tsrc/a.js::*\t1',
    ]);
  });
});
