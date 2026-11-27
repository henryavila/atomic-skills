import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STACKS = join(REPO_ROOT, 'qa/stacks.tsv');
const LIBRARY = join(REPO_ROOT, 'qa/measure/lib/shellfiles.py');

function shellRoots() {
  for (const line of readFileSync(STACKS, 'utf8').split(/\r?\n/)) {
    const [stack, , roots = ''] = line.split('\t');
    if (stack !== 'sh') continue;
    return roots.split(',').map((root) => root.trim()).filter((root) => root && root !== '-');
  }
  throw new Error('qa/stacks.tsv has no sh row');
}

const PATHS = [
  '.husky/pre-commit',
  '.husky/nested/data.json',
  '.husky/nested/x.sh',
  '.husky/_/h',
  'tests/hooks/a.sh',
  'tests/hooks/a.txt',
];
const EXPECTED = [true, false, true, false, true, false];

const PYTHON = `
import json
import os
import sys

sys.path.insert(0, os.path.join(os.getcwd(), "qa", "measure", "lib"))
import shellfiles

paths = json.loads(sys.argv[1])
roots = json.loads(sys.argv[2])
json.dump([shellfiles.is_shell_source(path, roots) for path in paths], sys.stdout)
`;

describe('shell source rule', () => {
  it('answers the same in python and javascript', async () => {
    const roots = shellRoots();
    const python = spawnSync(
      'python3',
      ['-I', '-c', PYTHON, JSON.stringify(PATHS), JSON.stringify(roots)],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    assert.equal(python.status, 0, python.stderr);
    assert.deepEqual(JSON.parse(python.stdout), EXPECTED);

    const module = await import('../qa/measure/lib/shellfiles.mjs');
    assert.deepEqual(PATHS.map((path) => module.isShellSource(path, roots)), EXPECTED);
  });

  it('is written once next to the python shell sources', () => {
    assert.ok(readFileSync(LIBRARY, 'utf8').includes('def is_shell_source'));
  });
});
