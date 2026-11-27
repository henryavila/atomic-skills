import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MEASURER = join(REPO_ROOT, 'qa/measure/js-deps');
const CEILINGS = join(REPO_ROOT, 'qa/ceilings.tsv');

function advisory(name, severity) {
  return {
    source: 1,
    name,
    dependency: name,
    title: `${severity} advisory for ${name}`,
    url: `https://example.test/${name}`,
    severity,
    range: '*',
  };
}

function vulnerability(name, severity, via) {
  return {
    name,
    severity,
    isDirect: true,
    via,
    effects: [],
    range: '*',
    nodes: [],
    fixAvailable: true,
  };
}

describe('qa/measure/js-deps', () => {
  let root;
  let binDir;
  let auditPath;

  function plant() {
    mkdirSync(join(root, 'qa'), { recursive: true });
    copyFileSync(CEILINGS, join(root, 'qa/ceilings.tsv'));
  }

  function fakeNpm(body) {
    const target = join(binDir, 'npm');
    writeFileSync(target, body);
    chmodSync(target, 0o755);
  }

  function setAudit(report) {
    writeFileSync(auditPath, JSON.stringify(report));
  }

  function run(args = []) {
    return spawnSync(process.execPath, [MEASURER, ...args], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        QA_ROOT: root,
        PATH: `${binDir}:${process.env.PATH}`,
        AUDIT_REPORT: auditPath,
      },
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
    root = mkdtempSync(join(tmpdir(), 'qa-js-deps-'));
    binDir = join(root, 'bin');
    auditPath = join(root, 'audit.json');
    mkdirSync(binDir, { recursive: true });
    plant();
    fakeNpm('#!/bin/sh\ncat "$AUDIT_REPORT"\nexit 1\n');
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
      'covers\tjs\tvulnerable-deps',
    ]);
  });

  it('prints nothing when no advisory is high or critical', () => {
    setAudit({
      auditReportVersion: 2,
      vulnerabilities: {
        moderate: vulnerability('moderate', 'moderate', [advisory('moderate', 'moderate')]),
      },
      metadata: { vulnerabilities: { moderate: 1 } },
    });
    expectLines(run(), []);
  });

  it('measures high and critical advisories per package', () => {
    setAudit({
      auditReportVersion: 2,
      vulnerabilities: {
        risky: vulnerability('risky', 'high', [
          advisory('risky', 'high'),
          advisory('risky', 'critical'),
        ]),
        moderate: vulnerability('moderate', 'moderate', [advisory('moderate', 'moderate')]),
      },
      metadata: { vulnerabilities: { high: 1, critical: 1, moderate: 1 } },
    });
    expectLines(run(), ['js\tvulnerable-deps\tpackage-lock.json::risky\t2']);
  });

  it('exits 3 when npm audit cannot reach the network', () => {
    fakeNpm('#!/bin/sh\necho "network unavailable" >&2\nexit 1\n');
    const result = run();
    assert.equal(result.status, 3, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /network unavailable|npm audit/);
    assert.equal(result.stdout, '');
  });

  it('fails when npm audit exits with an unexpected status', () => {
    fakeNpm('#!/bin/sh\necho "{}"\necho "fatal audit failure" >&2\nexit 42\n');
    const result = run();
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /42|fatal audit failure/);
    assert.equal(result.stdout, '');
  });

  it('fails when npm audit is terminated by a signal', () => {
    fakeNpm('#!/bin/sh\nkill -TERM $$\n');
    const result = run();
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /terminated|signal/i);
    assert.equal(result.stdout, '');
  });

  it('fails when npm audit prints an incomplete report', () => {
    fakeNpm('#!/bin/sh\ncat "$AUDIT_REPORT"\nexit 0\n');
    setAudit({});
    const result = run();
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /incomplete|auditReportVersion|vulnerabilities/i);
    assert.equal(result.stdout, '');
  });

  it('fails when npm audit succeeds without JSON', () => {
    fakeNpm('#!/bin/sh\necho "not json"\nexit 0\n');
    const result = run();
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /JSON|json/i);
    assert.equal(result.stdout, '');
  });
});
