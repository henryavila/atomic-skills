import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  planEndReviewOk,
  userValidationOk,
  automatePlanEndGatesOk,
  SKIP_PLAN_END_REASON_TAXONOMY,
} from '../src/plan-end-review.js';

describe('planEndReviewOk', () => {
  it('is false when receipt is missing', () => {
    assert.equal(planEndReviewOk(null), false);
    assert.equal(planEndReviewOk(undefined), false);
  });

  it('is true when ≥1 family-different external leg has status succeeded', () => {
    assert.equal(
      planEndReviewOk({
        legs: [
          { provider: 'codex', status: 'succeeded', familyDifferent: true },
          { provider: 'grok', status: 'failed', familyDifferent: true },
        ],
      }),
      true,
    );
    assert.equal(
      planEndReviewOk({
        legs: [
          { provider: 'codex', status: 'succeeded', familyDifferent: true },
          { provider: 'grok', status: 'skipped', familyDifferent: true },
        ],
      }),
      true,
    );
  });

  it('is true when skipPlanEndReview true with non-empty reason even if all legs failed', () => {
    assert.equal(
      planEndReviewOk({
        legs: [
          { provider: 'codex', status: 'failed' },
          { provider: 'grok', status: 'failed' },
        ],
        skipPlanEndReview: true,
        skipReason: 'operator accepted residual risk for dogfood',
      }),
      true,
    );
  });

  it('is false when all legs skipped/failed and no skip reason', () => {
    assert.equal(
      planEndReviewOk({
        legs: [
          { provider: 'codex', status: 'skipped' },
          { provider: 'grok', status: 'failed' },
        ],
      }),
      false,
    );
    assert.equal(
      planEndReviewOk({
        legs: [
          { provider: 'codex', status: 'failed' },
          { provider: 'grok', status: 'failed' },
        ],
        skipPlanEndReview: true,
        skipReason: '',
      }),
      false,
    );
    assert.equal(
      planEndReviewOk({
        legs: [
          { provider: 'codex', status: 'failed' },
        ],
        skipPlanEndReview: true,
      }),
      false,
    );
    assert.equal(planEndReviewOk({ legs: [] }), false);
  });

  it('single remaining leg after host filter counts when succeeded', () => {
    assert.equal(
      planEndReviewOk({
        legs: [{ provider: 'codex', status: 'succeeded', familyDifferent: true }],
      }),
      true,
    );
    assert.equal(
      planEndReviewOk({
        legs: [{ provider: 'grok', status: 'succeeded', familyDifferent: true }],
      }),
      true,
    );
    assert.equal(
      planEndReviewOk({
        legs: [{ provider: 'codex', status: 'failed', familyDifferent: true }],
      }),
      false,
    );
  });

  it('does not count leg with familyDifferent === false even if succeeded', () => {
    assert.equal(
      planEndReviewOk({
        legs: [
          { provider: 'codex', status: 'succeeded', familyDifferent: false },
          { provider: 'grok', status: 'failed', familyDifferent: true },
        ],
      }),
      false,
    );
  });

  it('fail-closed: missing familyDifferent does NOT count (strict true required)', () => {
    assert.equal(
      planEndReviewOk({
        legs: [{ provider: 'codex', status: 'succeeded' }],
      }),
      false,
    );
    assert.equal(
      planEndReviewOk({
        legs: [{ provider: 'grok', status: 'succeeded', familyDifferent: undefined }],
      }),
      false,
    );
  });

  it('fail-closed: missing or unknown provider does not count even if succeeded + familyDifferent', () => {
    assert.equal(
      planEndReviewOk({
        legs: [{ status: 'succeeded', familyDifferent: true }],
      }),
      false,
    );
    assert.equal(
      planEndReviewOk({
        legs: [{ provider: 'local', status: 'succeeded', familyDifferent: true }],
      }),
      false,
    );
    assert.equal(
      planEndReviewOk({
        legs: [{ provider: 'claude', status: 'succeeded', familyDifferent: true }],
      }),
      false,
    );
    assert.equal(
      planEndReviewOk({
        legs: [{ provider: '', status: 'succeeded', familyDifferent: true }],
      }),
      false,
    );
  });

  it('fail-closed: same-family succeeded (familyDifferent false) with known provider does not count', () => {
    assert.equal(
      planEndReviewOk({
        legs: [{ provider: 'codex', status: 'succeeded', familyDifferent: false }],
      }),
      false,
    );
    assert.equal(
      planEndReviewOk({
        legs: [{ provider: 'grok', status: 'succeeded', familyDifferent: false }],
      }),
      false,
    );
  });

  it('only known external providers codex|grok count when succeeded + familyDifferent true', () => {
    assert.equal(
      planEndReviewOk({
        legs: [
          { provider: 'local', status: 'succeeded', familyDifferent: true },
          { provider: 'codex', status: 'succeeded', familyDifferent: true },
        ],
      }),
      true,
    );
  });

  it('finalize-shaped receipt with reviewFile/mode/range still passes when a leg succeeded', () => {
    assert.equal(
      planEndReviewOk({
        mode: 'external-both',
        range: 'origin/develop...HEAD',
        reviewFile: '.atomic-skills/reviews/2026-07-17-1200-demo-plan-end.md',
        verifiedAt: '2026-07-17T12:00:00.000Z',
        legs: [
          { provider: 'codex', status: 'succeeded', familyDifferent: true },
          { provider: 'grok', status: 'skipped', familyDifferent: true },
        ],
      }),
      true,
    );
  });

  it('finalize-shaped receipt with skip-plan-end-review reason taxonomy passes without success legs', () => {
    for (const reason of SKIP_PLAN_END_REASON_TAXONOMY) {
      assert.equal(
        planEndReviewOk({
          mode: 'external-both',
          reviewFile: '.atomic-skills/reviews/2026-07-17-skip.md',
          legs: [
            { provider: 'codex', status: 'skipped', familyDifferent: true },
            { provider: 'grok', status: 'skipped', familyDifferent: true },
          ],
          skipPlanEndReview: true,
          skipReason: reason,
        }),
        true,
        `expected true for taxonomy reason ${reason}`,
      );
    }
  });

  it('exports non-empty skip reason taxonomy for guided --skip-plan-end-review', () => {
    assert.ok(Array.isArray(SKIP_PLAN_END_REASON_TAXONOMY));
    assert.ok(SKIP_PLAN_END_REASON_TAXONOMY.length >= 1);
    assert.ok(SKIP_PLAN_END_REASON_TAXONOMY.includes('no-family-different-provider'));
    assert.ok(SKIP_PLAN_END_REASON_TAXONOMY.includes('operator-accepted-residual-risk'));
  });
});

describe('userValidationOk', () => {
  it('true when automate is not active (gate only applies under automate)', () => {
    assert.equal(userValidationOk({ automateActive: false }), true);
    assert.equal(
      userValidationOk({ automateActive: false, userValidatedAt: undefined }),
      true,
    );
    assert.equal(
      userValidationOk({ automateActive: false, userValidatedAt: '' }),
      true,
    );
    assert.equal(
      userValidationOk({ automateActive: false, userValidatedAt: 'not-a-date' }),
      true,
    );
  });

  // Callers MUST pass automateActive: true explicitly for automate gates.
  // Omission means the gate is inactive (non-automate path) — do not treat as fail-closed.
  it('omitted automateActive means gate inactive: userValidationOk({}) returns true', () => {
    assert.equal(userValidationOk({}), true);
    assert.equal(userValidationOk(), true);
    assert.equal(
      userValidationOk({ userValidatedAt: 'garbage' }),
      true,
    );
  });

  it('false when userValidatedAt missing/empty under automate', () => {
    assert.equal(userValidationOk({ automateActive: true }), false);
    assert.equal(
      userValidationOk({ automateActive: true, userValidatedAt: undefined }),
      false,
    );
    assert.equal(
      userValidationOk({ automateActive: true, userValidatedAt: null }),
      false,
    );
    assert.equal(
      userValidationOk({ automateActive: true, userValidatedAt: '' }),
      false,
    );
    assert.equal(
      userValidationOk({ automateActive: true, userValidatedAt: '   ' }),
      false,
    );
  });

  it('false for non-ISO / invalid timestamps under automate', () => {
    for (const bad of ['ok', 'yes', '0', 'not-a-date', 'true', '12345', 'July 17 2026']) {
      assert.equal(
        userValidationOk({ automateActive: true, userValidatedAt: bad }),
        false,
        `expected false for ${JSON.stringify(bad)}`,
      );
    }
  });

  it('true only with non-empty ISO timestamp under automate', () => {
    assert.equal(
      userValidationOk({
        automateActive: true,
        userValidatedAt: '2026-07-17T19:00:00.000Z',
      }),
      true,
    );
    assert.equal(
      userValidationOk({
        automateActive: true,
        userValidatedAt: '2026-07-17T19:00:00.000Z',
        validatorId: 'operator-henry',
      }),
      true,
    );
    assert.equal(
      userValidationOk({
        automateActive: true,
        userValidatedAt: '2026-07-17T19:00:00Z',
      }),
      true,
    );
    assert.equal(
      userValidationOk({
        automateActive: true,
        userValidatedAt: '2026-07-17',
      }),
      true,
    );
  });

  it('optional validatorId does not alone satisfy the gate', () => {
    assert.equal(
      userValidationOk({
        automateActive: true,
        userValidatedAt: '',
        validatorId: 'operator-henry',
      }),
      false,
    );
  });
});

describe('automatePlanEndGatesOk (finalize/archive combined)', () => {
  const goodReceipt = {
    mode: 'external-both',
    reviewFile: '.atomic-skills/reviews/2026-07-17-demo-plan-end.md',
    legs: [{ provider: 'codex', status: 'succeeded', familyDifferent: true }],
  };
  const goodAt = '2026-07-17T19:00:00.000Z';

  it('inactive when automateActive is not true', () => {
    assert.deepEqual(automatePlanEndGatesOk({}), {
      ok: true,
      planEndReviewOk: true,
      userValidationOk: true,
    });
    assert.deepEqual(
      automatePlanEndGatesOk({ automateActive: false, receipt: null }),
      { ok: true, planEndReviewOk: true, userValidationOk: true },
    );
  });

  it('HARD-BLOCKs finalize/archive under automate when receipt missing', () => {
    const r = automatePlanEndGatesOk({
      automateActive: true,
      receipt: null,
      userValidatedAt: goodAt,
    });
    assert.equal(r.ok, false);
    assert.equal(r.planEndReviewOk, false);
    assert.equal(r.userValidationOk, true);
  });

  it('HARD-BLOCKs when all legs failed/skipped without skip reason', () => {
    const r = automatePlanEndGatesOk({
      automateActive: true,
      receipt: {
        legs: [
          { provider: 'codex', status: 'failed', familyDifferent: true },
          { provider: 'grok', status: 'skipped', familyDifferent: true },
        ],
      },
      userValidatedAt: goodAt,
    });
    assert.equal(r.ok, false);
    assert.equal(r.planEndReviewOk, false);
  });

  it('HARD-BLOCKs when skipPlanEndReview without non-empty reason', () => {
    const r = automatePlanEndGatesOk({
      automateActive: true,
      receipt: {
        legs: [],
        skipPlanEndReview: true,
        skipReason: '   ',
      },
      userValidatedAt: goodAt,
    });
    assert.equal(r.ok, false);
    assert.equal(r.planEndReviewOk, false);
  });

  it('HARD-BLOCKs when userValidatedAt missing under automate even if receipt ok', () => {
    const r = automatePlanEndGatesOk({
      automateActive: true,
      receipt: goodReceipt,
    });
    assert.equal(r.ok, false);
    assert.equal(r.planEndReviewOk, true);
    assert.equal(r.userValidationOk, false);
  });

  it('ok when succeeded family-different leg + ISO userValidatedAt', () => {
    const r = automatePlanEndGatesOk({
      automateActive: true,
      receipt: goodReceipt,
      userValidatedAt: goodAt,
    });
    assert.deepEqual(r, {
      ok: true,
      planEndReviewOk: true,
      userValidationOk: true,
    });
  });

  it('ok when valid skip-plan-end-review reason + ISO userValidatedAt', () => {
    const r = automatePlanEndGatesOk({
      automateActive: true,
      receipt: {
        skipPlanEndReview: true,
        skipReason: 'no-family-different-provider',
        legs: [{ provider: 'codex', status: 'skipped', familyDifferent: false }],
      },
      userValidatedAt: goodAt,
    });
    assert.equal(r.ok, true);
    assert.equal(r.planEndReviewOk, true);
    assert.equal(r.userValidationOk, true);
  });
});
