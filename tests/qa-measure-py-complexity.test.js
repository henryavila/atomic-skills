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
const MEASURER = join(REPO_ROOT, 'qa/measure/py-complexity');
const CEILINGS = join(REPO_ROOT, 'qa/ceilings.tsv');
const STACKS = join(REPO_ROOT, 'qa/stacks.tsv');
const FIXTURE = join(REPO_ROOT, 'tests/fixtures/qa/py-complexity');

describe('qa/measure/py-complexity', () => {
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

  function run(args = [], env = {}) {
    return spawnSync(MEASURER, args, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: { ...process.env, QA_ROOT: root, PYTHONDONTWRITEBYTECODE: '1', ...env },
    });
  }

  function lines(result) {
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    return result.stdout.split('\n').filter(Boolean).sort();
  }

  function expectLines(result, expected) {
    assert.deepEqual(lines(result), [...expected].sort());
  }

  function fakeRuff() {
    const bin = join(root, 'fakevenv/bin');
    mkdirSync(bin, { recursive: true });
    const script = [
      '#!/usr/bin/env python3',
      'import json, os, sys',
      "files = [item for item in sys.argv[1:] if item.endswith('.py')]",
      'results = []',
      'for path in files:',
      '    results.append({',
      '        "code": "C901",',
      '        "filename": os.path.join(os.getcwd(), path),',
      '        "location": {"row": 1, "column": 1},',
      '        "message": "`fake` is too complex (16 > 15)",',
      '    })',
      'json.dump(results, sys.stdout)',
      'sys.exit(1 if results else 0)',
      '',
    ].join('\n');
    writeFileSync(join(bin, 'ruff'), script);
    chmodSync(join(bin, 'ruff'), 0o755);
    return join(root, 'fakevenv');
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'qa-py-complexity-'));
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
      'covers\tpy\tcomplexity',
    ]);
  });

  it('converts a recorded ruff report with the symbol rules', () => {
    const report = JSON.parse(readFileSync(join(FIXTURE, 'report.json'), 'utf8'));
    const relocated = report.map((item) => ({ ...item, filename: 'sample/complex.py' }));
    plant({
      'sample/complex.py': readFileSync(join(FIXTURE, 'complex.py'), 'utf8'),
      'report.json': JSON.stringify(relocated),
    });
    expectLines(run(['--convert', join(root, 'report.json')]), [
      'py\tcomplexity\tsample/complex.py::Widget.handle\t17',
      'py\tcomplexity\tsample/complex.py::outer\t18',
      'py\tcomplexity\tsample/complex.py::outer>inner\t17',
      'py\tcomplexity\tsample/complex.py::dup\t17',
      'py\tcomplexity\tsample/complex.py::dup#2\t17',
    ]);
  });

  it('prints nothing for a clean report', () => {
    plant({ 'report.json': '[]' });
    expectLines(run(['--convert', join(root, 'report.json')]), []);
  });

  it('limits --files to the listed python files', () => {
    const venv = fakeRuff();
    plant({
      'skills/shared/a.py': 'def fake():\n    return 1\n',
      'skills/shared/b.py': 'def fake():\n    return 1\n',
    });
    expectLines(run([], { QA_VENV: venv }), [
      'py\tcomplexity\tskills/shared/a.py::fake\t16',
      'py\tcomplexity\tskills/shared/b.py::fake\t16',
    ]);
    expectLines(run(['--files', 'skills/shared/a.py'], { QA_VENV: venv }), [
      'py\tcomplexity\tskills/shared/a.py::fake\t16',
    ]);
  });

  it('exits 3 when ruff is not in the venv', () => {
    const empty = join(root, 'emptyvenv');
    mkdirSync(empty, { recursive: true });
    const result = run([], { QA_VENV: empty });
    assert.equal(result.status, 3, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /ruff/);
    assert.match(result.stderr, /setup/);
  });
});
