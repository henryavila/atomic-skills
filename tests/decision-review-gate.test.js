import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  decisionReviewAllowsPhaseDone,
  buildDecisionReview,
  isDurableAutomateForDecisionReview,
} from '../src/decision-review-gate.js';

describe('isDurableAutomateForDecisionReview', () => {
  it('true on planExecutionMode stamp alone', () => {
    assert.equal(
      isDurableAutomateForDecisionReview({ planExecutionMode: 'automate' }),
      true,
    );
  });

  it('true on executionMode alias', () => {
    assert.equal(
      isDurableAutomateForDecisionReview({ executionMode: 'automate' }),
      true,
    );
  });

  it('false when no stamp and no automateActive', () => {
    assert.equal(isDurableAutomateForDecisionReview({}), false);
  });
});

describe('decisionReviewAllowsPhaseDone', () => {
  it('allows phase-done when automate off (non-automate skip)', () => {
    assert.deepEqual(decisionReviewAllowsPhaseDone({}), { ok: true });
  });

  it('allows phase-done when non-automate even if decisionReview absent', () => {
    const r = decisionReviewAllowsPhaseDone({
      planExecutionMode: 'manual',
      decisionReview: null,
    });
    assert.equal(r.ok, true);
  });

  it('blocks when automate stamp and no decisionReview', () => {
    const r = decisionReviewAllowsPhaseDone({ planExecutionMode: 'automate' });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /decisionReview/);
  });

  it('blocks when automate + decisionReview pending', () => {
    const r = decisionReviewAllowsPhaseDone({
      planExecutionMode: 'automate',
      decisionReview: { status: 'pending' },
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /pending/i);
  });

  it('blocks when automate + decisionReview failed', () => {
    const r = decisionReviewAllowsPhaseDone({
      executionMode: 'automate',
      decisionReview: { status: 'failed', verifiedAt: '2026-07-23T12:00:00Z' },
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /failed/i);
  });

  it('blocks passed without verifiedAt', () => {
    const r = decisionReviewAllowsPhaseDone({
      planExecutionMode: 'automate',
      decisionReview: { status: 'passed' },
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /verifiedAt/);
  });

  it('blocks passed with non-ISO verifiedAt', () => {
    const r = decisionReviewAllowsPhaseDone({
      planExecutionMode: 'automate',
      decisionReview: { status: 'passed', verifiedAt: 'x' },
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /ISO|timestamp/i);
  });

  it('allows automate + status passed + verifiedAt', () => {
    const r = decisionReviewAllowsPhaseDone({
      planExecutionMode: 'automate',
      decisionReview: {
        status: 'passed',
        verifiedAt: '2026-07-23T12:00:00.000Z',
        evidencePath: '.atomic-skills/projects/x/y/decisions/F3.jsonl',
      },
    });
    assert.equal(r.ok, true);
  });
});

describe('buildDecisionReview', () => {
  it('builds passed stamp with verifiedAt and optional evidencePath', () => {
    const g = buildDecisionReview({
      status: 'passed',
      verifiedAt: '2026-07-23T12:00:00Z',
      evidencePath: 'decisions/F3.jsonl',
      at: 'abc1234',
    });
    assert.equal(g.status, 'passed');
    assert.equal(g.verifiedAt, '2026-07-23T12:00:00Z');
    assert.equal(g.evidencePath, 'decisions/F3.jsonl');
    assert.equal(g.at, 'abc1234');
  });

  it('builds pending stamp', () => {
    const g = buildDecisionReview({ status: 'pending' });
    assert.equal(g.status, 'pending');
  });

  it('builds failed stamp', () => {
    const g = buildDecisionReview({
      status: 'failed',
      verifiedAt: '2026-07-23T12:00:00Z',
    });
    assert.equal(g.status, 'failed');
  });

  it('rejects invalid status', () => {
    assert.throws(() => buildDecisionReview({ status: 'ok' }), /invalid status/);
  });

  it('rejects passed without verifiedAt', () => {
    assert.throws(
      () => buildDecisionReview({ status: 'passed' }),
      /verifiedAt/,
    );
  });

  it('rejects passed with empty verifiedAt', () => {
    assert.throws(
      () => buildDecisionReview({ status: 'passed', verifiedAt: '   ' }),
      /verifiedAt/,
    );
  });
});
