/**
 * Unit tests for design-gates helpers (schema 0.1 process receipt).
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  SCHEMA_VERSION,
  DESIGN_STATUS,
  designGatePath,
  buildDesignGate,
  readDesignGate,
  createDesignGate,
  updateDesignGate,
  missingDesignGateFields,
  isDesignGateReady,
} from '../scripts/design-gates.js';

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

describe('design-gates', () => {
  let root;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'design-gates-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('buildDesignGate defaults schemaVersion 0.1 and pending fields', () => {
    const g = buildDesignGate({ projectId: 'demo', slug: 'sample' });
    assert.equal(g.schemaVersion, SCHEMA_VERSION);
    assert.equal(g.projectId, 'demo');
    assert.equal(g.slug, 'sample');
    assert.equal(g.interviewAccepted, false);
    assert.equal(g.debateGate, null);
    assert.equal(g.researchDigest, null);
    assert.equal(g.criticVerdict, null);
    assert.equal(g.userApproved, false);
    assert.equal(g.status, DESIGN_STATUS.PENDING);
    assert.ok(g.updatedAt);
  });

  it('missingDesignGateFields lists incomplete process fields', () => {
    const empty = buildDesignGate({});
    const missing = missingDesignGateFields(empty);
    assert.ok(missing.includes('interviewAccepted'));
    assert.ok(missing.includes('debateGate'));
    assert.ok(missing.includes('researchDigest'));
    assert.ok(missing.includes('criticVerdict'));
    assert.ok(missing.includes('userApproved'));
    assert.ok(missing.includes('status'));
    assert.equal(isDesignGateReady(empty), false);
  });

  it('happy path: complete gate is ready', () => {
    const g = buildDesignGate({ projectId: 'demo', slug: 'sample', ...COMPLETE });
    assert.deepEqual(missingDesignGateFields(g), []);
    assert.equal(isDesignGateReady(g), true);
  });

  it('createDesignGate writes JSON under status/design-gates/', () => {
    const gate = createDesignGate(root, 'demo', 'sample', {
      interviewAccepted: true,
    });
    const path = designGatePath(root, 'demo', 'sample');
    assert.ok(existsSync(path));
    assert.equal(gate.interviewAccepted, true);
    assert.equal(gate.status, DESIGN_STATUS.PENDING);
    const disk = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(disk.schemaVersion, '0.1');
    assert.equal(disk.interviewAccepted, true);
  });

  it('readDesignGate returns null when missing', () => {
    assert.equal(readDesignGate(root, 'demo', 'missing'), null);
  });

  it('updateDesignGate merges fields and can reach ready', () => {
    createDesignGate(root, 'demo', 'sample', {});
    updateDesignGate(root, 'demo', 'sample', {
      interviewAccepted: true,
      debateGate: COMPLETE.debateGate,
      researchDigest: COMPLETE.researchDigest,
      criticVerdict: COMPLETE.criticVerdict,
      userApproved: true,
      status: DESIGN_STATUS.READY,
    });
    const gate = readDesignGate(root, 'demo', 'sample');
    assert.equal(isDesignGateReady(gate), true);
    assert.equal(gate.status, DESIGN_STATUS.READY);
    assert.equal(gate.criticVerdict, 'Approved');
  });

  it('update refuses ready when required fields still missing', () => {
    createDesignGate(root, 'demo', 'sample', { interviewAccepted: true });
    const gate = updateDesignGate(root, 'demo', 'sample', {
      status: DESIGN_STATUS.READY,
    });
    assert.equal(gate.status, DESIGN_STATUS.PENDING);
    assert.equal(isDesignGateReady(gate), false);
    const missing = missingDesignGateFields(gate);
    assert.ok(missing.includes('debateGate'));
    assert.ok(missing.includes('researchDigest'));
  });

  it('create without overwrite fails if receipt exists', () => {
    createDesignGate(root, 'demo', 'sample', {});
    assert.throws(
      () => createDesignGate(root, 'demo', 'sample', {}),
      /already exists/,
    );
  });

  it('debateGate incomplete when invoked false', () => {
    const g = buildDesignGate({
      ...COMPLETE,
      debateGate: { invoked: false, readyForValidation: true, singleApproach: false },
    });
    assert.ok(missingDesignGateFields(g).includes('debateGate'));
  });
});
