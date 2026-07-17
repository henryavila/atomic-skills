import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  WRITER_LEASES_DIR,
  leasePath,
  sanitizePlanSlug,
  isLeaseActive,
  buildActiveLease,
  buildClearedLease,
  parseLeaseJson,
  serializeLease,
  writeLeaseFile,
  readLeaseFile,
  hasActiveLease,
  clearLeaseFile,
} from '../src/writer-lease.js';

describe('sanitizePlanSlug / leasePath', () => {
  it('leasePath joins statusRoot/writer-leases/<planSlug>.json', () => {
    const p = leasePath('/repo/.atomic-skills/status', 'implementation-automate-mode');
    assert.equal(
      p,
      join('/repo/.atomic-skills/status', WRITER_LEASES_DIR, 'implementation-automate-mode.json'),
    );
    assert.match(p, /writer-leases/);
    assert.ok(p.endsWith('implementation-automate-mode.json'));
  });

  it('rejects empty statusRoot or planSlug', () => {
    assert.throws(() => leasePath('', 'plan'), /statusRoot/);
    assert.throws(() => leasePath('/status', ''), /planSlug/);
    assert.throws(() => leasePath('/status', null), /planSlug/);
  });

  it('rejects path-traversal planSlug', () => {
    assert.throws(() => sanitizePlanSlug('../evil'), /invalid/);
    assert.throws(() => sanitizePlanSlug('a/b'), /invalid/);
    assert.throws(() => sanitizePlanSlug('a\\b'), /invalid/);
    assert.throws(() => leasePath('/status', '..'), /invalid/);
  });
});

describe('isLeaseActive', () => {
  const base = {
    planSlug: 'my-plan',
    phaseId: 'F1',
    startedAt: '2026-07-17T00:00:00.000Z',
    hostId: 'host-1',
    worktreePath: '/repo/.worktrees/my-plan-f1-writer',
    status: 'active',
  };

  it('true when status active and required fields present', () => {
    assert.equal(isLeaseActive(base), true);
    assert.equal(isLeaseActive({ ...base, writerBranch: 'impl/f1-writer' }), true);
  });

  it('false when status is not active', () => {
    assert.equal(isLeaseActive({ ...base, status: 'cleared' }), false);
    assert.equal(isLeaseActive({ ...base, status: 'done' }), false);
    assert.equal(isLeaseActive({ ...base, status: '' }), false);
  });

  it('false when required fields missing or blank', () => {
    for (const key of ['planSlug', 'phaseId', 'startedAt', 'hostId', 'worktreePath']) {
      assert.equal(isLeaseActive({ ...base, [key]: '' }), false, key);
      assert.equal(isLeaseActive({ ...base, [key]: null }), false, key);
      const missing = { ...base };
      delete missing[key];
      assert.equal(isLeaseActive(missing), false, `missing ${key}`);
    }
  });

  it('false for null/undefined/non-object', () => {
    assert.equal(isLeaseActive(null), false);
    assert.equal(isLeaseActive(undefined), false);
    assert.equal(isLeaseActive('active'), false);
    assert.equal(isLeaseActive(42), false);
  });
});

describe('buildActiveLease / buildClearedLease (pure)', () => {
  it('buildActiveLease sets status active and required fields', () => {
    const lease = buildActiveLease({
      planSlug: 'p',
      phaseId: 'F1',
      hostId: 'h',
      worktreePath: '/wt',
      writerBranch: 'w/branch',
      startedAt: '2026-01-01T00:00:00.000Z',
    });
    assert.equal(lease.status, 'active');
    assert.equal(lease.planSlug, 'p');
    assert.equal(lease.phaseId, 'F1');
    assert.equal(lease.hostId, 'h');
    assert.equal(lease.worktreePath, '/wt');
    assert.equal(lease.writerBranch, 'w/branch');
    assert.equal(lease.startedAt, '2026-01-01T00:00:00.000Z');
    assert.equal(isLeaseActive(lease), true);
  });

  it('buildActiveLease fills startedAt when omitted', () => {
    const lease = buildActiveLease({
      planSlug: 'p',
      phaseId: 'F1',
      hostId: 'h',
      worktreePath: '/wt',
    });
    assert.ok(lease.startedAt);
    assert.match(lease.startedAt, /^\d{4}-\d{2}-\d{2}/);
  });

  it('buildActiveLease rejects incomplete input', () => {
    assert.throws(() => buildActiveLease({}), /required/);
    assert.throws(
      () => buildActiveLease({ planSlug: 'p', phaseId: 'F1', hostId: 'h' }),
      /required/,
    );
  });

  it('buildClearedLease returns new object with status cleared (no mutation)', () => {
    const active = buildActiveLease({
      planSlug: 'p',
      phaseId: 'F1',
      hostId: 'h',
      worktreePath: '/wt',
    });
    const cleared = buildClearedLease(active);
    assert.equal(cleared.status, 'cleared');
    assert.equal(active.status, 'active');
    assert.equal(isLeaseActive(cleared), false);
    assert.notEqual(cleared, active);
  });
});

describe('parseLeaseJson / serializeLease', () => {
  it('round-trips a lease object', () => {
    const lease = buildActiveLease({
      planSlug: 'p',
      phaseId: 'F2',
      hostId: 'h',
      worktreePath: '/wt',
      startedAt: '2026-07-17T12:00:00.000Z',
    });
    const text = serializeLease(lease);
    const parsed = parseLeaseJson(text);
    assert.deepEqual(parsed, lease);
    assert.equal(isLeaseActive(parsed), true);
  });

  it('parseLeaseJson returns null on empty or invalid', () => {
    assert.equal(parseLeaseJson(''), null);
    assert.equal(parseLeaseJson(null), null);
    assert.equal(parseLeaseJson('not-json'), null);
    assert.equal(parseLeaseJson('[]'), null);
  });
});

describe('FS wrappers write/read/clear/hasActiveLease', () => {
  /** @type {string} */
  let statusRoot;

  before(() => {
    statusRoot = mkdtempSync(join(tmpdir(), 'writer-lease-'));
  });

  after(() => {
    try {
      rmSync(statusRoot, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('writeLeaseFile then hasActiveLease and readLeaseFile', () => {
    const lease = buildActiveLease({
      planSlug: 'iso-plan',
      phaseId: 'F1',
      hostId: 'test-host',
      worktreePath: '/tmp/sibling-wt',
      writerBranch: 'impl/f1',
      startedAt: '2026-07-17T18:00:00.000Z',
    });
    const path = writeLeaseFile(statusRoot, lease);
    assert.equal(path, leasePath(statusRoot, 'iso-plan'));
    assert.equal(existsSync(path), true);
    assert.equal(hasActiveLease(statusRoot, 'iso-plan'), true);
    const read = readLeaseFile(statusRoot, 'iso-plan');
    assert.equal(isLeaseActive(read), true);
    assert.equal(read.phaseId, 'F1');
    assert.equal(read.worktreePath, '/tmp/sibling-wt');
  });

  it('clearLeaseFile removes lease and hasActiveLease becomes false', () => {
    assert.equal(hasActiveLease(statusRoot, 'iso-plan'), true);
    const removed = clearLeaseFile(statusRoot, 'iso-plan');
    assert.equal(removed, true);
    assert.equal(hasActiveLease(statusRoot, 'iso-plan'), false);
    assert.equal(readLeaseFile(statusRoot, 'iso-plan'), null);
    assert.equal(clearLeaseFile(statusRoot, 'iso-plan'), false);
  });

  it('readLeaseFile returns null for unknown plan', () => {
    assert.equal(readLeaseFile(statusRoot, 'no-such-plan'), null);
    assert.equal(hasActiveLease(statusRoot, 'no-such-plan'), false);
  });
});
