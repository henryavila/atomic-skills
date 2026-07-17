import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { planEndReviewOk, userValidationOk } from '../src/plan-end-review.js';

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
          { provider: 'codex', status: 'succeeded' },
          { provider: 'grok', status: 'skipped' },
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
        legs: [{ provider: 'grok', status: 'succeeded' }],
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

  it('missing familyDifferent is treated as true for external legs', () => {
    assert.equal(
      planEndReviewOk({
        legs: [{ provider: 'codex', status: 'succeeded' }],
      }),
      true,
    );
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
