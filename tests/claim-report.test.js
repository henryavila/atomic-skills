import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  parseClaimReport,
  validateTaskClaim,
  validateClaimReport,
  claimRangeFromTask,
  findOverlappingClaimShas,
  validatedRangeForDone,
  validateClaimReachability,
} from '../src/claim-report.js';

function passClaim(overrides = {}) {
  return {
    taskId: 'T-001',
    status: 'claimed-pass',
    commitShas: ['aaa111'],
    paths: ['src/foo.js'],
    verifierCommand: 'node --test tests/foo.test.js',
    exitCode: 0,
    transcript: 'ok',
    ...overrides,
  };
}

describe('parseClaimReport', () => {
  it('parses envelope with tasks[]', () => {
    const report = parseClaimReport({
      planSlug: 'p',
      phaseId: 'F2',
      tasks: [passClaim()],
    });
    assert.ok(report);
    assert.equal(report.planSlug, 'p');
    assert.equal(report.phaseId, 'F2');
    assert.equal(report.tasks.length, 1);
    assert.equal(report.tasks[0].taskId, 'T-001');
  });

  it('parses bare task array', () => {
    const report = parseClaimReport([passClaim({ taskId: 'T-002' })]);
    assert.ok(report);
    assert.equal(report.tasks[0].taskId, 'T-002');
  });

  it('parses JSON string', () => {
    const report = parseClaimReport(JSON.stringify({ tasks: [passClaim()] }));
    assert.ok(report);
    assert.equal(report.tasks[0].taskId, 'T-001');
  });

  it('returns null for garbage', () => {
    assert.equal(parseClaimReport(null), null);
    assert.equal(parseClaimReport(''), null);
    assert.equal(parseClaimReport('{not json'), null);
    assert.equal(parseClaimReport(42), null);
  });
});

describe('validateTaskClaim / claimRangeFromTask', () => {
  it('requires taskId, commitShas or base+head, paths, verifierCommand, exitCode, transcript', () => {
    const good = validateTaskClaim(passClaim());
    assert.equal(good.ok, true);
    assert.deepEqual(good.errors, []);
    assert.equal(good.range?.kind, 'shas');

    const missing = validateTaskClaim({ taskId: 'T-x' });
    assert.equal(missing.ok, false);
    assert.ok(missing.errors.some((e) => /commit identity|commitShas|base/i.test(e)));
    assert.ok(missing.errors.some((e) => /paths/i.test(e)));
    assert.ok(missing.errors.some((e) => /verifierCommand/i.test(e)));
    assert.ok(missing.errors.some((e) => /exitCode/i.test(e)));
    assert.ok(missing.errors.some((e) => /transcript/i.test(e)));
  });

  it('accepts base+head range instead of commitShas', () => {
    const claim = passClaim({
      commitShas: undefined,
      base: 'abc000',
      head: 'def999',
    });
    const result = validateTaskClaim(claim);
    assert.equal(result.ok, true, result.errors.join('; '));
    assert.deepEqual(result.range, { kind: 'range', base: 'abc000', head: 'def999' });
    assert.deepEqual(claimRangeFromTask(claim), {
      kind: 'range',
      base: 'abc000',
      head: 'def999',
    });
  });

  it('rejects partial base without head', () => {
    const result = validateTaskClaim(
      passClaim({ commitShas: undefined, base: 'abc', head: undefined }),
    );
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => /base and head/i.test(e)));
  });

  it('accepts exitCode null and empty transcript', () => {
    const result = validateTaskClaim(
      passClaim({ exitCode: null, transcript: '' }),
    );
    assert.equal(result.ok, true, result.errors.join('; '));
  });

  it('blocked/skipped may omit commit identity', () => {
    const blocked = validateTaskClaim({
      taskId: 'T-b',
      status: 'blocked',
      paths: [],
      notes: 'scope exit',
    });
    assert.equal(blocked.ok, true, blocked.errors.join('; '));
  });

  it('unknown statuses like done/pass/ok are validation errors (not silent non-open)', () => {
    for (const bad of ['done', 'pass', 'ok', 'success', 'failed', 'pending']) {
      const result = validateTaskClaim(passClaim({ status: bad }));
      assert.equal(result.ok, false, `expected error for status ${bad}`);
      assert.ok(
        result.errors.some((e) => /unknown claim status/i.test(e)),
        `expected unknown-status error for ${bad}, got: ${result.errors.join('; ')}`,
      );
    }
    const report = validateClaimReport({
      tasks: [passClaim({ status: 'done' })],
    });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => /unknown claim status/i.test(e)));
  });

  it('open allowlist: claimed-pass, claimed-fail, missing/undefined; closed: blocked, skipped', () => {
    assert.equal(validateTaskClaim(passClaim({ status: 'claimed-pass' })).ok, true);
    assert.equal(validateTaskClaim(passClaim({ status: 'claimed-fail' })).ok, true);
    assert.equal(validateTaskClaim(passClaim({ status: undefined })).ok, true);
    assert.equal(
      validateTaskClaim({
        taskId: 'T-s',
        status: 'skipped',
        paths: [],
        notes: 'n/a',
      }).ok,
      true,
    );
  });
});

describe('multi-task SHA exclusivity', () => {
  it('rejects ambiguous overlapping multi-task SHAs without exclusive ranges', () => {
    const shared = 'deadbeef';
    const tasks = [
      passClaim({ taskId: 'T-001', commitShas: [shared, 'aaa'] }),
      passClaim({ taskId: 'T-002', commitShas: [shared, 'bbb'] }),
    ];
    const overlap = findOverlappingClaimShas(tasks);
    assert.ok(overlap.length >= 1);
    assert.ok(overlap.some((e) => /ambiguous overlapping multi-task SHAs/i.test(e)));

    const report = validateClaimReport({ tasks });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => /overlapping multi-task SHAs/i.test(e)));
  });

  it('allows disjoint commitShas lists', () => {
    const tasks = [
      passClaim({ taskId: 'T-001', commitShas: ['aaa'] }),
      passClaim({ taskId: 'T-002', commitShas: ['bbb'] }),
    ];
    assert.deepEqual(findOverlappingClaimShas(tasks), []);
    const report = validateClaimReport({ tasks });
    assert.equal(report.ok, true, report.errors.join('; '));
  });

  it('base+head exclusive ranges do not fight bare SHA lists for the same identity token', () => {
    // Task with exclusive range is not in the bare-SHA pool; another task may list SHAs freely.
    const tasks = [
      passClaim({
        taskId: 'T-001',
        commitShas: undefined,
        base: 'base1',
        head: 'head1',
      }),
      passClaim({ taskId: 'T-002', commitShas: ['sha-only-for-t2'] }),
    ];
    assert.deepEqual(findOverlappingClaimShas(tasks), []);
    assert.equal(validateClaimReport({ tasks }).ok, true);
  });

  it('document: each task needs exclusive range or single SHA list not shared across open claims without base/head', () => {
    // Shared SHA with both tasks also having base+head is OK (range-identified).
    const tasks = [
      passClaim({
        taskId: 'T-001',
        commitShas: ['shared'],
        base: 'b1',
        head: 'h1',
      }),
      passClaim({
        taskId: 'T-002',
        commitShas: ['shared'],
        base: 'b2',
        head: 'h2',
      }),
    ];
    // claimRangeFromTask prefers base+head → kind range → not in bare pool
    assert.deepEqual(findOverlappingClaimShas(tasks), []);
  });

  it('rejects two open claims with the same base+head pair', () => {
    const tasks = [
      passClaim({
        taskId: 'T-001',
        commitShas: undefined,
        base: 'abc000',
        head: 'def999',
      }),
      passClaim({
        taskId: 'T-002',
        commitShas: undefined,
        base: 'abc000',
        head: 'def999',
      }),
    ];
    const overlap = findOverlappingClaimShas(tasks);
    assert.ok(overlap.length >= 1);
    assert.ok(
      overlap.some((e) => /identical base\+head|identical.*range/i.test(e)),
      overlap.join('; '),
    );
    const report = validateClaimReport({ tasks });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => /identical base\+head|identical.*range/i.test(e)));
  });

  it('rejects identical base+head case-insensitively', () => {
    const tasks = [
      passClaim({
        taskId: 'T-001',
        commitShas: undefined,
        base: 'ABC000',
        head: 'DEF999',
      }),
      passClaim({
        taskId: 'T-002',
        commitShas: undefined,
        base: 'abc000',
        head: 'def999',
      }),
    ];
    assert.ok(findOverlappingClaimShas(tasks).length >= 1);
  });

  it('allows distinct base+head ranges', () => {
    const tasks = [
      passClaim({
        taskId: 'T-001',
        commitShas: undefined,
        base: 'b1',
        head: 'h1',
      }),
      passClaim({
        taskId: 'T-002',
        commitShas: undefined,
        base: 'b2',
        head: 'h2',
      }),
    ];
    assert.deepEqual(findOverlappingClaimShas(tasks), []);
    assert.equal(validateClaimReport({ tasks }).ok, true);
  });
});

describe('validateClaimReachability — exact match only', () => {
  it('accepts exact (case-insensitive) SHA membership', () => {
    const report = {
      tasks: [passClaim({ taskId: 'T-001', commitShas: ['AaA111'] })],
    };
    const result = validateClaimReachability(report, new Set(['aaa111', 'other']));
    assert.equal(result.ok, true, result.errors.join('; '));
  });

  it('rejects free prefix / startsWith matches (no free prefix)', () => {
    const report = {
      tasks: [
        passClaim({
          taskId: 'T-001',
          commitShas: ['deadbeef'], // short
        }),
      ],
    };
    // Full SHA in reachable set must NOT free-match a short claim prefix
    const fullOnly = validateClaimReachability(
      report,
      new Set(['deadbeefcafebabe0123456789abcdef01234567']),
    );
    assert.equal(fullOnly.ok, false, 'prefix of full SHA must not count');
    assert.ok(fullOnly.errors.some((e) => /not reachable/i.test(e)));

    // Short reachable must NOT free-match a longer claim
    const longClaim = {
      tasks: [
        passClaim({
          taskId: 'T-002',
          commitShas: ['deadbeefcafebabe0123456789abcdef01234567'],
        }),
      ],
    };
    const shortOnly = validateClaimReachability(longClaim, new Set(['deadbeef']));
    assert.equal(shortOnly.ok, false, 'claim must not startWith known short sha');
  });
});

describe('validateClaimReport + validatedRangeForDone', () => {
  it('ok full report', () => {
    const report = validateClaimReport({
      planSlug: 'demo',
      phaseId: 'F2',
      tasks: [passClaim(), passClaim({ taskId: 'T-002', commitShas: ['bbb222'] })],
    });
    assert.equal(report.ok, true, report.errors.join('; '));
    assert.equal(report.tasks?.length, 2);
  });

  it('rejects empty tasks', () => {
    const report = validateClaimReport({ tasks: [] });
    assert.equal(report.ok, false);
  });

  it('rejects duplicate taskIds', () => {
    const report = validateClaimReport({
      tasks: [passClaim(), passClaim({ taskId: 'T-001', commitShas: ['other'] })],
    });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => /duplicate taskId/i.test(e)));
  });

  it('validatedRangeForDone returns range only when exclusive + complete', () => {
    const claim = passClaim({ taskId: 'T-007', commitShas: ['cafebabe'] });
    const ok = validatedRangeForDone(claim, {
      allClaims: [claim, passClaim({ taskId: 'T-008', commitShas: ['other'] })],
    });
    assert.equal(ok.ok, true);
    assert.equal(ok.range?.kind, 'shas');

    const bad = validatedRangeForDone(claim, {
      allClaims: [claim, passClaim({ taskId: 'T-008', commitShas: ['cafebabe'] })],
    });
    assert.equal(bad.ok, false);
    assert.ok(bad.errors.some((e) => /overlapping/i.test(e)));
  });
});
