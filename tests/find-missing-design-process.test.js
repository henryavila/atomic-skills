/**
 * Tests for find-missing-design-process (design-gates presence/ready).
 * Includes R-ORCH-03 exempt-lane negative cases (adopt / ad-hoc / single-task).
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  evaluateDesignProcess,
  isExemptLane,
  EXEMPT_LANES,
  loadDesignProcessGate,
  exemptKindFromCreationGate,
} from '../scripts/find-missing-design-process.js';
import {
  createDesignGate,
  designGatePath,
  DESIGN_STATUS,
} from '../scripts/design-gates.js';

const SCRIPT = fileURLToPath(
  new URL('../scripts/find-missing-design-process.js', import.meta.url),
);

const COMPLETE = {
  interviewAccepted: true,
  debateGate: {
    invoked: true,
    readyForValidation: true,
    singleApproach: false,
  },
  researchDigest: 'projects/demo/sample/research-digest.md',
  criticVerdict: 'Approved',
  userApproved: true,
  status: DESIGN_STATUS.READY,
};

function runCli(args, cwd) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    cwd,
  });
}

describe('isExemptLane / R-ORCH-03', () => {
  it('recognizes adopt, ad-hoc, adhoc, single-task', () => {
    assert.equal(isExemptLane('adopt'), true);
    assert.equal(isExemptLane('ad-hoc'), true);
    assert.equal(isExemptLane('adhoc'), true);
    assert.equal(isExemptLane('single-task'), true);
    assert.equal(isExemptLane('single_task'), true);
    assert.equal(isExemptLane('new-plan'), false);
    assert.equal(isExemptLane(null), false);
  });

  it('exports EXEMPT_LANES including adopt', () => {
    assert.ok(EXEMPT_LANES.includes('adopt'));
    assert.ok(EXEMPT_LANES.includes('ad-hoc') || EXEMPT_LANES.includes('adhoc'));
  });
});

describe('evaluateDesignProcess', () => {
  it('fails when receipt missing', () => {
    const r = evaluateDesignProcess(null);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'missing-receipt');
  });

  it('fails when not ready (missing fields)', () => {
    const r = evaluateDesignProcess({
      schemaVersion: '0.1',
      interviewAccepted: true,
      status: 'pending',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason, /not-ready/);
    assert.ok(r.missing.includes('debateGate'));
  });

  it('passes complete ready gate', () => {
    const r = evaluateDesignProcess({
      schemaVersion: '0.1',
      projectId: 'demo',
      slug: 'sample',
      ...COMPLETE,
    });
    assert.equal(r.ok, true);
  });

  it('exempt adopt lane does not false-positive on missing receipt', () => {
    const r = evaluateDesignProcess(null, { lane: 'adopt' });
    assert.equal(r.ok, true);
    assert.equal(r.exempt, true);
    assert.match(r.reason, /R-ORCH-03/);
  });

  it('exempt ad-hoc and single-task lanes skip receipt', () => {
    assert.equal(evaluateDesignProcess(null, { lane: 'ad-hoc' }).ok, true);
    assert.equal(evaluateDesignProcess(null, { lane: 'single-task' }).ok, true);
  });
});

describe('CLI + disk', () => {
  let root;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'fmdp-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('exits 1 when design-gates file missing', () => {
    const path = join(root, 'missing.json');
    const res = runCli([path], root);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /missing-receipt|HARD-BLOCK/);
  });

  it('exits 1 when receipt present but not ready', () => {
    createDesignGate(root, 'demo', 'sample', { interviewAccepted: true });
    const path = designGatePath(root, 'demo', 'sample');
    const res = runCli([path], root);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /not-ready/);
  });

  it('exits 0 when ready', () => {
    createDesignGate(root, 'demo', 'sample', COMPLETE);
    // create demotes ready if incomplete; force full via update path
    const path = designGatePath(root, 'demo', 'sample');
    writeFileSync(
      path,
      JSON.stringify(
        {
          schemaVersion: '0.1',
          projectId: 'demo',
          slug: 'sample',
          ...COMPLETE,
          updatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    const res = runCli([path], root);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /ready/);
  });

  it('CLI --lane adopt exits 0 without receipt (exempt)', () => {
    const res = runCli(['--lane', 'adopt', join(root, 'nope.json')], root);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /exempt|R-ORCH-03/);
  });

  it('CLI --lane ad-hoc and single-task exit 0', () => {
    assert.equal(runCli(['--lane', 'ad-hoc'], root).status, 0);
    assert.equal(runCli(['--lane', 'single-task'], root).status, 0);
  });

  it('creation-gate kind adopt exempts via --creation-gate', () => {
    const cgDir = join(root, '.atomic-skills', 'status', 'creation-gates');
    mkdirSync(cgDir, { recursive: true });
    const cgPath = join(cgDir, 'demo-adopted.json');
    writeFileSync(
      cgPath,
      JSON.stringify({
        schemaVersion: '0.1',
        kind: 'adopt',
        stage: 'slug',
        projectId: 'demo',
        slug: 'adopted',
      }),
    );
    assert.equal(exemptKindFromCreationGate(cgPath), 'adopt');
    const res = runCli(['--creation-gate', cgPath, join(root, 'no-design.json')], root);
    assert.equal(res.status, 0, res.stderr);
  });

  it('loadDesignProcessGate reads state-root form', () => {
    createDesignGate(root, 'demo', 'sample', { interviewAccepted: true });
    const { gate } = loadDesignProcessGate({
      stateRoot: root,
      projectId: 'demo',
      slug: 'sample',
    });
    assert.equal(gate.interviewAccepted, true);
  });
});
