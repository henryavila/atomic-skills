import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync, rmSync, symlinkSync, chmodSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const measurer = join(root, 'qa/measure/coverage');

function snapshot(dir) {
  return readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => [entry.name, entry.isDirectory() ? snapshot(join(dir, entry.name))
      : entry.isSymbolicLink() ? 'link' : readFileSync(join(dir, entry.name), 'base64')]);
}

function fixture() {
  const temp = mkdtempSync(join(tmpdir(), 'qa-coverage-test-'));
  const repo = join(temp, 'repo');
  function write(path, body) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), body);
  }
  write('package.json', '{"type":"module"}');
  write('qa/ceilings.tsv', 'metric\tceiling\tapplies_to\nuncovered-pct\t20\tjavascript,python\n');
  write('qa/stacks.tsv', 'stack\tlanguage\troots\njs\tjavascript\tsrc,scripts,bin,tests,test\npy\tpython\tskills/shared\nsh\tshell\t.husky\n');
  write('src/covered.js', 'export const value = 1;\n');
  write('src/uncovered.js', 'export const value = 2;\n');
  write('skills/shared/demo-assets/run.py', 'import sys\nif len(sys.argv) > 1:\n    print("missed")\nelse:\n    print("covered")\n');
  write('skills/shared/demo-assets/unloaded.py', 'print("never run")\n');
  write('tests/run.test.js', `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { value } from '../src/covered.js';
test('covered', () => {
  assert.equal(value, 1);
  const child = spawnSync('python3', ['skills/shared/demo-assets/run.py'], { encoding: 'utf8' });
  try { assert.equal(child.status, 0, child.stderr); } finally { /* spawnSync has reaped the process. */ }
});
`);
  mkdirSync(join(repo, 'qa/.venv'), { recursive: true });
  symlinkSync(join(root, 'qa/.venv/bin'), join(repo, 'qa/.venv/bin'));
  mkdirSync(join(temp, 'scratch'));
  return { temp, repo, write };
}

function run(f, args = [], env = {}) {
  // Synchronous children are reaped before returning, including on timeout.
  let result;
  try {
    result = spawnSync(measurer, args, {
      cwd: f.repo, encoding: 'utf8', timeout: 60000,
      env: { ...process.env, QA_ROOT: f.repo, TMPDIR: join(f.temp, 'scratch'), ...env },
    });
    assert.ifError(result.error);
    return result;
  } finally {
    assert.deepEqual(readdirSync(join(f.temp, 'scratch')), [], 'temporary measurement files leaked');
  }
}

test('coverage describes full, unchanged measurement without requiring tools', () => {
  const f = fixture();
  try {
    rmSync(join(f.repo, 'qa/.venv'), { recursive: true });
    const result = run(f, ['--describe']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'mode\tfull\nchanged\tno\ncovers\tjs\tuncovered-pct\ncovers\tpy\tuncovered-pct\n');
  } finally { rmSync(f.temp, { recursive: true, force: true }); }
});

test('coverage measures loaded Python subprocesses and unloaded production files without mutations', () => {
  const f = fixture();
  try {
    const before = snapshot(f.repo);
    const result = run(f);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, 'coverage: no Python coverage data: skills/shared/demo-assets/unloaded.py\n');
    assert.deepEqual(result.stdout.trim().split('\n'), [
      'js\tuncovered-pct\tsrc/uncovered.js::*\t100.0',
      'py\tuncovered-pct\tskills/shared/demo-assets/run.py::*\t25.0',
      'py\tuncovered-pct\tskills/shared/demo-assets/unloaded.py::*\t100.0',
    ]);
    assert.deepEqual(snapshot(f.repo), before);
    f.write('qa/ceilings.tsv', 'metric\tceiling\tapplies_to\nuncovered-pct\t100\tjavascript,python\n');
    assert.equal(run(f).stdout, '', 'ceiling is read, with strict greater-than comparison');
  } finally { rmSync(f.temp, { recursive: true, force: true }); }
});

test('coverage keeps collected items and reports failed test count', () => {
  const f = fixture();
  try {
    f.write('test/failing.test.js', "import { test } from 'node:test';\ntest('failure', () => { throw new Error('expected'); });\n");
    const result = run(f);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, 'coverage: 1 tests failed\ncoverage: no Python coverage data: skills/shared/demo-assets/unloaded.py\n');
    assert.match(result.stdout, /src\/uncovered.js::\*\t100.0/);
    assert.match(result.stdout, /run.py::\*\t25.0/);
  } finally { rmSync(f.temp, { recursive: true, force: true }); }
});

test('coverage exits 3 for missing Python coverage without changing the fixture', () => {
  const f = fixture();
  try {
    rmSync(join(f.repo, 'qa/.venv'), { recursive: true });
    const before = snapshot(f.repo);
    const result = run(f);
    assert.equal(result.status, 3, result.stderr);
    assert.match(result.stderr, /coverage.*not installed/);
    assert.equal(result.stdout, '');
    assert.deepEqual(snapshot(f.repo), before);
  } finally { rmSync(f.temp, { recursive: true, force: true }); }
});

test('coverage exits 3 when Node lacks built-in test coverage', () => {
  const f = fixture();
  try {
    const bin = join(f.temp, 'bin');
    mkdirSync(bin);
    writeFileSync(join(bin, 'node'), '#!/bin/sh\necho old-node\n');
    chmodSync(join(bin, 'node'), 0o755);
    const result = run(f, [], { PATH: `${bin}:${process.env.PATH}` });
    assert.equal(result.status, 3, result.stderr);
    assert.match(result.stderr, /Node --experimental-test-coverage/);
    assert.equal(result.stdout, '');
  } finally { rmSync(f.temp, { recursive: true, force: true }); }
});

test('gate routes this descriptor only through the full phase, after fast measurers', () => {
  const f = fixture();
  function exec(command, args, env = {}) {
    let result;
    try {
      result = spawnSync(command, args, { cwd: f.repo, encoding: 'utf8', timeout: 60000,
        env: { ...process.env, ...env } });
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      return result;
    } finally { /* spawnSync reaps each child, also on timeout. */ }
  }
  try {
    f.write('scripts/qa.sh', readFileSync(join(root, 'scripts/qa.sh')));
    f.write('qa/ratchet.py', 'import sys\nsys.exit(0)\n');
    f.write('qa/dimensions.tsv', 'dimension\tmetric\ncoverage\tuncovered-pct\n');
    const marker = join(f.temp, 'phases');
    f.write('qa/measure/coverage', `#!/bin/sh
if [ "$1" = --describe ]; then exec '${measurer}' --describe; fi
echo full >> '${marker}'
`);
    f.write('qa/measure/fast', `#!/bin/sh
if [ "$1" = --describe ]; then printf 'mode\\tfast\\nchanged\\tyes\\ncovers\\tjs\\tuncovered-pct\\n'; exit; fi
echo fast >> '${marker}'
`);
    for (const name of ['coverage', 'fast']) chmodSync(join(f.repo, 'qa/measure', name), 0o755);
    const bin = join(f.temp, 'bin');
    mkdirSync(bin);
    writeFileSync(join(bin, 'npm'), '#!/bin/sh\nexit 0\n');
    chmodSync(join(bin, 'npm'), 0o755);
    exec('git', ['init', '-q']);
    exec('git', ['add', 'src/covered.js']);
    for (const args of [['fast'], ['changed', '--staged'], ['full']]) {
      rmSync(marker, { force: true });
      exec('bash', ['scripts/qa.sh', ...args], { PATH: `${bin}:${process.env.PATH}` });
      assert.equal(readFileSync(marker, 'utf8'), args[0] === 'full' ? 'fast\nfull\n' : 'fast\n');
    }
  } finally { rmSync(f.temp, { recursive: true, force: true }); }
});

for (const ending of ['sigterm', '_exit', 'exec']) {
  test(`coverage saves Python lines before ${ending}, including another interpreter`, () => {
    const f = fixture();
    try {
      // /usr/bin/python3 is independent of the QA venv on macOS and Ubuntu.
      const python = existsSync('/usr/bin/python3') ? '/usr/bin/python3' : 'python3';
      f.write('skills/shared/demo-assets/ending.py', `import os, signal, sys
value = 1
if sys.argv[1] == 'sigterm':
    os.kill(os.getpid(), signal.SIGTERM)
elif sys.argv[1] == '_exit':
    os._exit(0)
else:
    os.execv(sys.executable, [sys.executable, '-c', 'pass'])
`);
      f.write('tests/ending.test.js', `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
test('ending', () => {
  const child = spawnSync(${JSON.stringify(python)}, ['skills/shared/demo-assets/ending.py', '${ending}'], { encoding: 'utf8' });
  try {
    assert.equal(child.error, undefined);
    assert.equal(child.signal, ${ending === 'sigterm' ? "'SIGTERM'" : 'null'}, child.stderr);
    if (!child.signal) assert.equal(child.status, 0, child.stderr);
  } finally { /* spawnSync has reaped the child, including signal termination. */ }
});
`);
      const result = run(f);
      assert.equal(result.status, 0, result.stderr);
      const row = result.stdout.split('\n').find(line => line.includes('/ending.py::*'));
      assert.ok(row, result.stdout);
      assert.equal(row, `py\tuncovered-pct\tskills/shared/demo-assets/ending.py::*\t${ending === 'sigterm' ? '42.9' : '28.6'}`);
    } finally { rmSync(f.temp, { recursive: true, force: true }); }
  });
}

test('coverage diagnoses files without Python data when isolated mode bypasses startup', () => {
  const f = fixture();
  try {
    f.write('tests/run.test.js', `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
test('isolated', () => {
  const child = spawnSync('python3', ['-I', 'skills/shared/demo-assets/run.py'], { encoding: 'utf8' });
  try { assert.equal(child.status, 0, child.stderr); } finally { /* Already reaped. */ }
});
`);
    const result = run(f);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /coverage: no Python coverage data: skills\/shared\/demo-assets\/run.py/);
    assert.match(result.stdout, /run.py::\*\t100.0/);
  } finally { rmSync(f.temp, { recursive: true, force: true }); }
});

test('coverage report cannot consume an enclosing run through COVERAGE_FILE', () => {
  const f = fixture();
  try {
    const foreignData = join(f.temp, 'outer.coverage');
    // A real parallel file detects combine() consuming an enclosing run's data.
    const seed = spawnSync(join(root, 'qa/.venv/bin/python'), ['-c',
      'import coverage, sys; d = coverage.CoverageData(basename=sys.argv[1], suffix="sentinel"); d.add_lines({sys.argv[2]: {1}}); d.write()',
      foreignData, join(f.repo, 'skills/shared/demo-assets/unloaded.py')], {
      encoding: 'utf8', env: { ...process.env, COVERAGE_PROCESS_START: '', COVERAGE_FILE: foreignData },
    });
    try { assert.equal(seed.status, 0, seed.stderr); } finally { /* Already reaped. */ }
    const parallelData = `${foreignData}.sentinel`;
    const before = readFileSync(parallelData);
    const result = run(f, [], { COVERAGE_FILE: foreignData });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /run.py::\*\t25.0/);
    assert.equal(existsSync(foreignData), false, 'report wrote into the enclosing run');
    assert.deepEqual(readFileSync(parallelData), before, 'report consumed the enclosing parallel data');
  } finally { rmSync(f.temp, { recursive: true, force: true }); }
});
