import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MEASURER = join(REPO_ROOT, 'qa/measure/py-size');
const CEILINGS = join(REPO_ROOT, 'qa/ceilings.tsv');
const STACKS = join(REPO_ROOT, 'qa/stacks.tsv');

describe('qa/measure/py-size', () => {
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
    return spawnSync(MEASURER, args, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: { ...process.env, QA_ROOT: root, PYTHONDONTWRITEBYTECODE: '1' },
    });
  }

  function lines(result) {
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    return result.stdout.split('\n').filter(Boolean).sort();
  }

  function expectLines(result, expected) {
    assert.deepEqual(lines(result), [...expected].sort());
  }

  function longFunction(name, codeLines) {
    const body = Array.from({ length: codeLines }, (_, i) => `    value_${i} = ${i}`).join('\n');
    return `def ${name}():\n${body}\n    # a comment that is not counted\n\n    return value_0\n`;
  }

  function manyLines(count) {
    return `${Array.from({ length: count }, (_, i) => `value_${i} = ${i}`).join('\n')}\n`;
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'qa-py-size-'));
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
      'covers\tpy\tfunction-lines',
      'covers\tpy\tparams',
      'covers\tpy\tfile-lines',
      'covers\tpy\tsilent-errors',
      'covers\tsh\tfile-lines',
    ]);
  });

  it('prints nothing for a clean tree', () => {
    plant({ 'skills/shared/ok.py': 'def ok(value):\n    return value\n' });
    expectLines(run(), []);
  });

  it('measures function lines without blank or comment lines', () => {
    // 1 def line + 79 assignment lines + 1 return = 81 counted lines.
    plant({ 'skills/shared/long.py': longFunction('long_one', 79) });
    expectLines(run(), ['py\tfunction-lines\tskills/shared/long.py::long_one\t81']);
  });

  it('measures parameters without self or cls', () => {
    plant({
      'skills/shared/params.py': [
        'def many(a, b, c, d, e, f):',
        '    return a',
        '',
        'class Widget:',
        '    def handle(self, a, b, c, d, e, f):',
        '        return a',
        '',
      ].join('\n'),
    });
    expectLines(run(), [
      'py\tparams\tskills/shared/params.py::many\t6',
      'py\tparams\tskills/shared/params.py::Widget.handle\t6',
    ]);
  });

  it('measures file lines', () => {
    plant({ 'skills/shared/big.py': manyLines(801) });
    expectLines(run(), ['py\tfile-lines\tskills/shared/big.py::*\t801']);
  });

  it('measures silent error handlers per function and per module', () => {
    const body = [
      'def bad():',
      '    try:',
      '        first()',
      '    except Exception:',
      '        pass',
      '    try:',
      '        second()',
      '    except (ValueError, BaseException) as error:',
      '        log()',
      '',
      'def reraises():',
      '    try:',
      '        third()',
      '    except Exception as error:',
      '        raise',
      '',
      'def uses_name():',
      '    try:',
      '        fourth()',
      '    except Exception as error:',
      '        print(error)',
      '',
      'try:',
      '    fifth()',
      'except BaseException:',
      '    pass',
      '',
    ].join('\n');
    plant({ 'skills/shared/errors.py': body });
    expectLines(run(), [
      'py\tsilent-errors\tskills/shared/errors.py::bad\t2',
      'py\tsilent-errors\tskills/shared/errors.py::<module>\t1',
    ]);
  });

  it('counts exception names used when defining a nested function', () => {
    const body = [
      'def decorator(value):',
      '    return lambda function: function',
      '',
      'def uses_default():',
      '    try:',
      '        first()',
      '    except Exception as error:',
      '        def log(value=error):',
      '            return value',
      '        log()',
      '',
      'def uses_decorator():',
      '    try:',
      '        second()',
      '    except Exception as error:',
      '        @decorator(error)',
      '        def nested():',
      '            return 1',
      '        nested()',
      '',
      'def uses_annotation():',
      '    try:',
      '        third()',
      '    except Exception as error:',
      '        def nested(value: error):',
      '            return value',
      '        return nested',
      '',
      'def silent_in_body_only():',
      '    try:',
      '        fourth()',
      '    except Exception as error:',
      '        def nested():',
      '            return error',
      '        nested()',
      '',
    ].join('\n');
    plant({ 'skills/shared/definitions.py': body });
    expectLines(run(), [
      'py\tsilent-errors\tskills/shared/definitions.py::silent_in_body_only\t1',
    ]);
  });

  it('names functions by class, nesting and duplicate', () => {
    const body = [
      'class Widget:',
      '    def handle(self, a, b, c, d, e, f):',
      '        return a',
      '',
      'def outer():',
      '    def inner(a, b, c, d, e, f):',
      '        return a',
      '    return inner',
      '',
      'def dup(a, b, c, d, e, f):',
      '    return a',
      '',
      'def dup(a, b, c, d, e, f):',
      '    return a',
      '',
    ].join('\n');
    plant({ 'skills/shared/names.py': body });
    expectLines(run(), [
      'py\tparams\tskills/shared/names.py::Widget.handle\t6',
      'py\tparams\tskills/shared/names.py::outer>inner\t6',
      'py\tparams\tskills/shared/names.py::dup\t6',
      'py\tparams\tskills/shared/names.py::dup#2\t6',
    ]);
  });

  it('keeps a key when a line is added above the function', () => {
    const file = join(root, 'skills/shared/stable.py');
    plant({ 'skills/shared/stable.py': longFunction('long_one', 79) });
    const before = lines(run());
    writeFileSync(file, `# a new comment\n\n${longFunction('long_one', 79)}`);
    expectLines(run(), before);
    assert.deepEqual(before, ['py\tfunction-lines\tskills/shared/stable.py::long_one\t81']);
  });

  it('does not measure files outside the python roots', () => {
    plant({
      'tests/x.py': 'def many(a, b, c, d, e, f):\n    return a\n',
      'src/x.py': 'def many(a, b, c, d, e, f):\n    return a\n',
    });
    expectLines(run(), []);
    expectLines(run(['--files', 'tests/x.py', 'src/x.py']), []);
  });

  it('limits --files to the listed python files', () => {
    plant({
      'skills/shared/a.py': 'def many(a, b, c, d, e, f):\n    return a\n',
      'skills/shared/b.py': 'def also_many(a, b, c, d, e, f):\n    return a\n',
    });
    expectLines(run(), [
      'py\tparams\tskills/shared/a.py::many\t6',
      'py\tparams\tskills/shared/b.py::also_many\t6',
    ]);
    expectLines(run(['--files', 'skills/shared/a.py']), ['py\tparams\tskills/shared/a.py::many\t6']);
  });

  it('measures shell file lines under the sh roots and every .husky file', () => {
    plant({
      'tests/hooks/big.sh': manyLines(801),
      'skills/shared/auto-update-hook/big.sh': manyLines(801),
      '.husky/pre-commit': manyLines(801),
      'scripts/outside.sh': manyLines(801),
    });
    expectLines(run(), [
      'sh\tfile-lines\t.husky/pre-commit::*\t801',
      'sh\tfile-lines\tskills/shared/auto-update-hook/big.sh::*\t801',
      'sh\tfile-lines\ttests/hooks/big.sh::*\t801',
    ]);
    expectLines(run(['--files', '.husky/pre-commit']), [
      'sh\tfile-lines\t.husky/pre-commit::*\t801',
    ]);
  });

  it('ignores the husky-generated .husky/_ directory', () => {
    plant({
      '.husky/_/hook': manyLines(801),
      '.husky/pre-commit': manyLines(801),
    });
    expectLines(run(), ['sh\tfile-lines\t.husky/pre-commit::*\t801']);
    expectLines(run(['--files', '.husky/_/hook']), []);
  });

  it('measures only tracked shell files in a git tree', () => {
    plant({ 'tests/hooks/tracked.sh': manyLines(801) });
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'qa@example.test'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'QA Test'], { cwd: root });
    execFileSync('git', ['add', '-A'], { cwd: root });
    execFileSync('git', ['commit', '-qm', 'base'], { cwd: root });

    plant({
      'tests/hooks/untracked.sh': manyLines(801),
      '.husky/_/hook': manyLines(801),
      '.husky/pre-commit': manyLines(801),
    });
    expectLines(run(), [
      'sh\tfile-lines\ttests/hooks/tracked.sh::*\t801',
    ]);
  });
});
