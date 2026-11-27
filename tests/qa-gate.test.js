import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const QA_SH = join(REPO_ROOT, 'scripts/qa.sh');
const RATCHET_PY = join(REPO_ROOT, 'qa/ratchet.py');

const probe = spawnSync('python3', ['-c', 'import sys'], { encoding: 'utf8' });
const hasPython3 = probe.status === 0;

const STACKS = [
  'stack\tlanguage\troots\tgenerated\ttests\tgroup',
  'js\tjavascript\tsrc,scripts,bin\t-\ttests\t-',
  '',
].join('\n');

const CEILINGS = [
  'metric\tceiling\tapplies_to',
  'complexity\t15\tjavascript',
  'file-lines\t800\tjavascript',
  '',
].join('\n');

const DIMENSIONS = ['dimension\tmetric', 'size\tcomplexity', 'size\tfile-lines', ''].join('\n');
const EXCEPTIONS = 'stack\tmetric\tkey\tlimit\treason\n';

/** A shell line that prints one measure line. */
function measureLine(stack, metric, key, value) {
  return `printf '${stack}\\t${metric}\\t${key}\\t${value}\\n'`;
}

describe('scripts/qa.sh', { skip: !hasPython3 ? 'python3 not on PATH' : false }, () => {
  let tmp;
  let repo;
  let fakeDir;
  let binDir;

  function git(args, options = {}) {
    return execFileSync('git', args, { cwd: repo, encoding: 'utf8', ...options });
  }

  function writeFile(path, body, mode) {
    const target = join(repo, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, body);
    if (mode !== undefined) chmodSync(target, mode);
  }

  /**
   * A fake measurer. `body` runs for a measurement (no arguments) or for
   * `--files`; the descriptor is generated from the fields.
   */
  function writeMeasurer(name, { mode = 'fast', changed = 'no', covers = [['js', 'complexity']], body = 'exit 0' } = {}) {
    const coversLines = covers.map(([stack, metric]) => `  printf 'covers\\t${stack}\\t${metric}\\n'`).join('\n');
    const script = `#!/bin/sh
if [ "$1" = "--describe" ]; then
  printf 'mode\\t${mode}\\n'
  printf 'changed\\t${changed}\\n'
${coversLines}
  exit 0
fi
${body}
`;
    const target = join(repo, 'qa/measure', name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, script);
    chmodSync(target, 0o755);
  }

  function debt(stack, metric, lines) {
    writeFile(join('qa/debt', `${stack}.${metric}.tsv`), lines);
  }

  function run(args, extraEnv = {}) {
    return spawnSync('bash', [join(repo, 'scripts/qa.sh'), ...args], {
      cwd: repo,
      encoding: 'utf8',
      env: {
        ...process.env,
        QA_FAKE_DIR: fakeDir,
        PATH: `${binDir}:${process.env.PATH}`,
        ...extraEnv,
      },
    });
  }

  function both(result) {
    return `${result.stdout}\n${result.stderr}`;
  }

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'qa-gate-'));
    repo = join(tmp, 'repo');
    fakeDir = join(tmp, 'fake');
    binDir = join(tmp, 'bin');
    mkdirSync(repo, { recursive: true });
    mkdirSync(fakeDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });

    writeFile('scripts/qa.sh', readFileSync(QA_SH, 'utf8'), 0o755);
    writeFile('qa/ratchet.py', readFileSync(RATCHET_PY, 'utf8'));
    writeFile('qa/stacks.tsv', STACKS);
    writeFile('qa/ceilings.tsv', CEILINGS);
    writeFile('qa/dimensions.tsv', DIMENSIONS);
    writeFile('qa/exceptions.tsv', EXCEPTIONS);

    git(['init', '-q']);
    git(['config', 'user.email', 'qa@example.test']);
    git(['config', 'user.name', 'QA Test']);
    git(['add', '-A']);
    git(['commit', '-qm', 'base']);
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('passes on a clean tree', () => {
    writeMeasurer('fake');
    const result = run(['fast']);
    assert.equal(result.status, 0, both(result));
  });

  it('fails with the next step on a new item', () => {
    debt('js', 'complexity', 'src/known.js::f\t10\n');
    writeMeasurer('fake', {
      body: [measureLine('js', 'complexity', 'src/known.js::f', 10), measureLine('js', 'complexity', 'src/new.js::g', 20)].join('\n'),
    });
    const result = run(['fast']);
    assert.equal(result.status, 1, both(result));
    assert.match(result.stdout, /new\.js::g/);
    assert.match(both(result), /When the gate is red/);
  });

  it('passes when an item matches its recorded value', () => {
    debt('js', 'complexity', 'src/known.js::f\t20\n');
    writeMeasurer('fake', { body: measureLine('js', 'complexity', 'src/known.js::f', 20) });
    const result = run(['fast']);
    assert.equal(result.status, 0, both(result));
  });

  it('fails when an item is worse than recorded', () => {
    debt('js', 'complexity', 'src/known.js::f\t10\n');
    writeMeasurer('fake', { body: measureLine('js', 'complexity', 'src/known.js::f', 11) });
    const result = run(['fast']);
    assert.equal(result.status, 1, both(result));
    assert.match(result.stdout, /worse/);
  });

  it('exits 2 when a measurer reports its tool is missing', () => {
    writeMeasurer('fake', { body: 'exit 3' });
    const result = run(['fast']);
    assert.equal(result.status, 2, both(result));
    assert.match(result.stderr, /fake: tool not installed/);
    assert.match(result.stderr, /scripts\/qa\.sh setup/);
  });

  it('exits 2 when a measurer crashes', () => {
    writeMeasurer('fake', { body: 'exit 7' });
    const result = run(['fast']);
    assert.equal(result.status, 2, both(result));
    assert.match(result.stderr, /fake/);
  });

  it('exits 2 when a measurer prints a malformed line', () => {
    writeMeasurer('fake', { body: "printf 'js\\tcomplexity\\tonly-three\\n'" });
    const result = run(['fast']);
    assert.equal(result.status, 2, both(result));
    assert.match(result.stderr, /fake/);
  });

  it('changed --staged runs only changed yes measurers with the staged files', () => {
    writeMeasurer('yes', {
      changed: 'yes',
      body: 'printf \'%s\\n\' "$@" > "$QA_FAKE_DIR/yes.args"',
    });
    writeMeasurer('no', {
      changed: 'no',
      body: ': > "$QA_FAKE_DIR/no.ran"',
    });
    writeFile('src/x.js', 'export const x = 1;\n');
    git(['add', 'src/x.js']);

    const result = run(['changed', '--staged']);
    assert.equal(result.status, 0, both(result));
    const args = readFileSync(join(fakeDir, 'yes.args'), 'utf8').trim().split('\n');
    assert.deepEqual(args, ['--files', 'src/x.js']);
    assert.equal(existsSync(join(fakeDir, 'no.ran')), false);
  });

  it('changed --staged passes with a message when nothing is staged', () => {
    writeMeasurer('yes', {
      changed: 'yes',
      body: ': > "$QA_FAKE_DIR/yes.ran"',
    });
    const result = run(['changed', '--staged']);
    assert.equal(result.status, 0, both(result));
    assert.match(both(result), /no changed files/);
    assert.equal(existsSync(join(fakeDir, 'yes.ran')), false);
  });

  it('full does not run the test suite when the fast part failed', () => {
    const npm = join(binDir, 'npm');
    writeFileSync(npm, '#!/bin/sh\n: > "$QA_FAKE_DIR/npm.ran"\nexit 0\n');
    chmodSync(npm, 0o755);
    debt('js', 'complexity', 'src/known.js::f\t10\n');
    writeMeasurer('fake', { body: measureLine('js', 'complexity', 'src/known.js::f', 11) });

    const result = run(['full']);
    assert.equal(result.status, 1, both(result));
    assert.equal(existsSync(join(fakeDir, 'npm.ran')), false);
  });

  it('full runs the test suite when the fast part passed', () => {
    const npm = join(binDir, 'npm');
    writeFileSync(npm, '#!/bin/sh\n: > "$QA_FAKE_DIR/npm.ran"\nexit 0\n');
    chmodSync(npm, 0o755);
    writeMeasurer('fake');

    const result = run(['full']);
    assert.equal(result.status, 0, both(result));
    assert.equal(existsSync(join(fakeDir, 'npm.ran')), true);
  });

  it('strong exits 1 when status is not strong', () => {
    const npm = join(binDir, 'npm');
    writeFileSync(npm, '#!/bin/sh\nexit 0\n');
    chmodSync(npm, 0o755);
    writeMeasurer('fake');

    const result = run(['strong']);
    assert.equal(result.status, 1, both(result));
    assert.match(result.stdout, /not frozen/);
  });

  it('exits 2 on an unknown mode', () => {
    const result = run(['nonsense']);
    assert.equal(result.status, 2, both(result));
    assert.match(result.stderr, /usage:/);
  });

  it('exits 2 when no mode is given', () => {
    const result = run([]);
    assert.equal(result.status, 2, both(result));
    assert.match(result.stderr, /usage:/);
  });

  it('measure prints the lines and does not fail on items', () => {
    writeMeasurer('fake', { body: measureLine('js', 'complexity', 'src/x.js::f', 20) });
    const result = run(['measure']);
    assert.equal(result.status, 0, both(result));
    assert.match(result.stdout, /^js\tcomplexity\tsrc\/x\.js::f\t20$/m);
  });

  it('measure filters by metric', () => {
    writeMeasurer('one', { covers: [['js', 'complexity']], body: measureLine('js', 'complexity', 'src/a.js::f', 20) });
    writeMeasurer('two', { covers: [['js', 'file-lines']], body: measureLine('js', 'file-lines', 'src/b.js::*', 900) });

    const result = run(['measure', '--metric', 'complexity']);
    assert.equal(result.status, 0, both(result));
    assert.match(result.stdout, /src\/a\.js::f/);
    assert.doesNotMatch(result.stdout, /src\/b\.js::\*/);
  });
});
