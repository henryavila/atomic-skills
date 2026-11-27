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
const MEASURER = join(REPO_ROOT, 'qa/measure/py-security');
const CEILINGS = join(REPO_ROOT, 'qa/ceilings.tsv');
const STACKS = join(REPO_ROOT, 'qa/stacks.tsv');
const FIXTURE = join(REPO_ROOT, 'tests/fixtures/qa/py-security');

describe('qa/measure/py-security', () => {
  let root;

  function plant(files = {}) {
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

  function fakeBandit() {
    const bin = join(root, 'fakevenv/bin');
    mkdirSync(bin, { recursive: true });
    const script = [
      '#!/usr/bin/env python3',
      'import json, os, sys',
      "files = [item for item in sys.argv[1:] if item.endswith('.py')]",
      'results = []',
      'for path in files:',
      '    results.append({',
      '        "filename": os.path.join(os.getcwd(), path),',
      '        "line_number": 2,',
      '        "issue_severity": "HIGH",',
      '    })',
      'json.dump({"results": results, "errors": []}, sys.stdout)',
      'sys.exit(1 if results else 0)',
      '',
    ].join('\n');
    writeFileSync(join(bin, 'bandit'), script);
    chmodSync(join(bin, 'bandit'), 0o755);
    return join(root, 'fakevenv');
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'qa-py-security-'));
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
      'covers\tpy\tstatic-security',
    ]);
  });

  it('keeps medium and high findings with the symbol rules', () => {
    plant({
      'sample/security.py': readFileSync(join(FIXTURE, 'security.py'), 'utf8'),
    });
    expectLines(run(['--convert', join(FIXTURE, 'report.json')]), [
      'py\tstatic-security\tsample/security.py::Widget.load\t1',
      'py\tstatic-security\tsample/security.py::outer>inner\t1',
      'py\tstatic-security\tsample/security.py::digest\t1',
      'py\tstatic-security\tsample/security.py::dup\t1',
      'py\tstatic-security\tsample/security.py::dup#2\t1',
    ]);
  });

  it('prints nothing for a clean report', () => {
    plant({ 'report.json': '{"results": [], "errors": []}' });
    expectLines(run(['--convert', join(root, 'report.json')]), []);
  });

  it('limits --files to the listed python files', () => {
    const venv = fakeBandit();
    plant({
      'skills/shared/a.py': 'def fake():\n    return 1\n',
      'skills/shared/b.py': 'def fake():\n    return 2\n',
    });
    expectLines(run([], { QA_VENV: venv }), [
      'py\tstatic-security\tskills/shared/a.py::fake\t1',
      'py\tstatic-security\tskills/shared/b.py::fake\t1',
    ]);
    expectLines(run(['--files', 'skills/shared/b.py'], { QA_VENV: venv }), [
      'py\tstatic-security\tskills/shared/b.py::fake\t1',
    ]);
  });

  it('exits 3 when bandit is not in the venv', () => {
    const empty = join(root, 'emptyvenv');
    mkdirSync(empty, { recursive: true });
    const result = run([], { QA_VENV: empty });
    assert.equal(result.status, 3, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /bandit/);
    assert.match(result.stderr, /setup/);
  });
});
