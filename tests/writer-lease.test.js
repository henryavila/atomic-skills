import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync,
  rmSync,
  existsSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
} from 'node:fs';
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
  acquireLeaseFile,
  readLeaseFile,
  readLeaseResult,
  hasActiveLease,
  isLeaseBlocking,
  clearLeaseFile,
  leaseOwnerToken,
  leaseTokenMatches,
} from '../src/writer-lease.js';
import {
  validateClaimReachability,
  parseClaimReport,
} from '../src/claim-report.js';

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

describe('leaseOwnerToken / leaseTokenMatches', () => {
  it('extracts owner token fields', () => {
    const lease = buildActiveLease({
      planSlug: 'p',
      phaseId: 'F1',
      hostId: 'host-a',
      worktreePath: '/wt',
      startedAt: '2026-07-17T00:00:00.000Z',
    });
    const token = leaseOwnerToken(lease);
    assert.deepEqual(token, {
      planSlug: 'p',
      phaseId: 'F1',
      hostId: 'host-a',
      startedAt: '2026-07-17T00:00:00.000Z',
    });
    assert.equal(leaseTokenMatches(lease, token), true);
    assert.equal(
      leaseTokenMatches(lease, { ...token, hostId: 'other' }),
      false,
    );
  });
});

describe('FS wrappers acquire/read/clear/hasActiveLease (C1/C2/C3)', () => {
  /** @type {string} */
  let statusRoot;

  beforeEach(() => {
    statusRoot = mkdtempSync(join(tmpdir(), 'writer-lease-'));
  });

  afterEach(() => {
    try {
      rmSync(statusRoot, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  function activeLease(overrides = {}) {
    return buildActiveLease({
      planSlug: 'iso-plan',
      phaseId: 'F1',
      hostId: 'test-host',
      worktreePath: '/tmp/sibling-wt',
      writerBranch: 'impl/f1',
      startedAt: '2026-07-17T18:00:00.000Z',
      ...overrides,
    });
  }

  // --- C1: atomic exclusive acquire ---

  it('acquireLeaseFile / writeLeaseFile exclusive create then hasActiveLease and readLeaseFile', () => {
    const lease = activeLease();
    const path = acquireLeaseFile(statusRoot, lease);
    assert.equal(path, leasePath(statusRoot, 'iso-plan'));
    assert.equal(existsSync(path), true);
    assert.equal(hasActiveLease(statusRoot, 'iso-plan'), true);
    assert.equal(isLeaseBlocking(statusRoot, 'iso-plan'), true);
    const read = readLeaseFile(statusRoot, 'iso-plan');
    assert.equal(isLeaseActive(read), true);
    assert.equal(read.phaseId, 'F1');
    assert.equal(read.worktreePath, '/tmp/sibling-wt');
  });

  it('writeLeaseFile uses exclusive create (alias path for active acquire)', () => {
    const lease = activeLease({ planSlug: 'wx-plan' });
    const path = writeLeaseFile(statusRoot, lease);
    assert.equal(existsSync(path), true);
    assert.throws(
      () => writeLeaseFile(statusRoot, activeLease({ planSlug: 'wx-plan', hostId: 'other' })),
      /already exists|EEXIST|lease already/i,
    );
  });

  it('C1: concurrent double-acquire fails — second exclusive create refuses', () => {
    const leaseA = activeLease({
      planSlug: 'race-plan',
      hostId: 'host-a',
      startedAt: '2026-07-17T10:00:00.000Z',
    });
    const leaseB = activeLease({
      planSlug: 'race-plan',
      hostId: 'host-b',
      startedAt: '2026-07-17T10:00:01.000Z',
    });

    const pathA = acquireLeaseFile(statusRoot, leaseA);
    assert.equal(existsSync(pathA), true);
    assert.equal(readLeaseFile(statusRoot, 'race-plan').hostId, 'host-a');

    assert.throws(
      () => acquireLeaseFile(statusRoot, leaseB),
      /already exists|EEXIST|lease already/i,
    );
    // Winner unchanged — no overwrite of active lease
    assert.equal(readLeaseFile(statusRoot, 'race-plan').hostId, 'host-a');
    assert.equal(readLeaseFile(statusRoot, 'race-plan').startedAt, leaseA.startedAt);
  });

  // --- C2: malformed fail-closed ---

  it('readLeaseResult: missing vs active vs malformed', () => {
    assert.deepEqual(readLeaseResult(statusRoot, 'nope'), { status: 'missing' });

    const lease = activeLease({ planSlug: 'shape-plan' });
    acquireLeaseFile(statusRoot, lease);
    const active = readLeaseResult(statusRoot, 'shape-plan');
    assert.equal(active.status, 'active');
    assert.equal(active.lease.planSlug, 'shape-plan');

    const badPath = leasePath(statusRoot, 'bad-plan');
    mkdirSync(join(statusRoot, WRITER_LEASES_DIR), { recursive: true });
    writeFileSync(badPath, '{not valid json', 'utf8');
    const bad = readLeaseResult(statusRoot, 'bad-plan');
    assert.equal(bad.status, 'malformed');
    assert.ok(bad.error);
  });

  it('C2: malformed lease is not treated as absent — hasActiveLease / isLeaseBlocking refuse', () => {
    const badPath = leasePath(statusRoot, 'torn-plan');
    mkdirSync(join(statusRoot, WRITER_LEASES_DIR), { recursive: true });
    writeFileSync(badPath, 'truncated garbage', 'utf8');

    assert.equal(readLeaseResult(statusRoot, 'torn-plan').status, 'malformed');
    assert.equal(isLeaseBlocking(statusRoot, 'torn-plan'), true);
    // Fail-closed: gate treats malformed as blocking (resume must refuse)
    assert.equal(hasActiveLease(statusRoot, 'torn-plan'), true);
    assert.throws(() => readLeaseFile(statusRoot, 'torn-plan'), /malformed|LEASE_MALFORMED/i);
  });

  it('readLeaseFile returns null only for missing plan', () => {
    assert.equal(readLeaseFile(statusRoot, 'no-such-plan'), null);
    assert.equal(hasActiveLease(statusRoot, 'no-such-plan'), false);
    assert.equal(isLeaseBlocking(statusRoot, 'no-such-plan'), false);
  });

  // --- C3: clear with owner token CAS ---

  it('clearLeaseFile with matching owner token removes lease', () => {
    const lease = activeLease({ planSlug: 'clear-plan' });
    acquireLeaseFile(statusRoot, lease);
    assert.equal(hasActiveLease(statusRoot, 'clear-plan'), true);

    const token = leaseOwnerToken(lease);
    const removed = clearLeaseFile(statusRoot, 'clear-plan', token);
    assert.equal(removed, true);
    assert.equal(hasActiveLease(statusRoot, 'clear-plan'), false);
    assert.equal(readLeaseFile(statusRoot, 'clear-plan'), null);
    assert.equal(clearLeaseFile(statusRoot, 'clear-plan', token), false);
  });

  it('C3: clearLeaseFile wrong-token refuses and leaves file', () => {
    const lease = activeLease({
      planSlug: 'cas-plan',
      hostId: 'owner-1',
      startedAt: '2026-07-17T12:00:00.000Z',
    });
    acquireLeaseFile(statusRoot, lease);
    const path = leasePath(statusRoot, 'cas-plan');
    const before = readFileSync(path, 'utf8');

    assert.throws(
      () =>
        clearLeaseFile(statusRoot, 'cas-plan', {
          planSlug: 'cas-plan',
          phaseId: 'F1',
          hostId: 'stale-host',
          startedAt: '2026-07-17T12:00:00.000Z',
        }),
      /token|mismatch|owner/i,
    );
    assert.equal(existsSync(path), true);
    assert.equal(readFileSync(path, 'utf8'), before);
    assert.equal(hasActiveLease(statusRoot, 'cas-plan'), true);

    // Wrong startedAt (newer lease scenario)
    assert.throws(
      () =>
        clearLeaseFile(statusRoot, 'cas-plan', {
          planSlug: 'cas-plan',
          phaseId: 'F1',
          hostId: 'owner-1',
          startedAt: '2026-07-17T99:00:00.000Z',
        }),
      /token|mismatch|owner/i,
    );
  });

  it('clearLeaseFile requires owner token', () => {
    const lease = activeLease({ planSlug: 'tok-req' });
    acquireLeaseFile(statusRoot, lease);
    assert.throws(() => clearLeaseFile(statusRoot, 'tok-req'), /token|owner/i);
    assert.throws(() => clearLeaseFile(statusRoot, 'tok-req', null), /token|owner/i);
    assert.throws(
      () => clearLeaseFile(statusRoot, 'tok-req', { planSlug: 'tok-req' }),
      /token|owner|required/i,
    );
    assert.equal(hasActiveLease(statusRoot, 'tok-req'), true);
  });
});

describe('C5: validateClaimReachability (pure helper)', () => {
  it('accepts when all claimed SHAs are in the reachable set', () => {
    const report = parseClaimReport({
      tasks: [
        {
          taskId: 'T-001',
          status: 'claimed-pass',
          commitShas: ['aaa111', 'bbb222'],
          paths: ['src/a.js'],
          verifierCommand: 'node --test',
          exitCode: 0,
          transcript: 'ok',
        },
      ],
    });
    const reachable = new Set(['aaa111', 'bbb222', 'ccc333']);
    const result = validateClaimReachability(report, reachable);
    assert.equal(result.ok, true);
    assert.deepEqual(result.errors, []);
  });

  it('rejects missing / non-ancestor SHAs and range endpoints', () => {
    const report = {
      tasks: [
        {
          taskId: 'T-001',
          status: 'claimed-pass',
          commitShas: ['deadbeef'],
          paths: ['src/a.js'],
          verifierCommand: 'node --test',
          exitCode: 0,
          transcript: 'ok',
        },
        {
          taskId: 'T-002',
          status: 'claimed-pass',
          base: 'base000',
          head: 'head999',
          paths: ['src/b.js'],
          verifierCommand: 'node --test',
          exitCode: 0,
          transcript: 'ok',
        },
      ],
    };
    // Only head is reachable — base and deadbeef are not
    const result = validateClaimReachability(report, new Set(['head999']));
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => /T-001|deadbeef|not reachable/i.test(e)));
    assert.ok(result.errors.some((e) => /T-002|base000|not reachable/i.test(e)));
  });

  it('accepts blocked/skipped without SHAs; predicate form works', () => {
    const report = {
      tasks: [
        {
          taskId: 'T-b',
          status: 'blocked',
          paths: [],
          notes: 'waiting',
        },
        {
          taskId: 'T-ok',
          status: 'claimed-pass',
          commitShas: ['abc'],
          paths: ['x'],
          verifierCommand: 't',
          exitCode: 0,
          transcript: '',
        },
      ],
    };
    const result = validateClaimReachability(report, (sha) => sha === 'abc');
    assert.equal(result.ok, true);
  });
});
