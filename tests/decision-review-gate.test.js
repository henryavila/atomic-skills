import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  decisionReviewAllowsPhaseDone,
  buildDecisionReview,
  isDurableAutomateForDecisionReview,
  hasDecisionPackagePresentEvidence,
} from '../src/decision-review-gate.js';
import { canRunPhaseDone } from '../src/automate-orchestrator-gates.js';

/** Valid passed stamp including present-before-PASS evidence. */
const passedWithPresent = {
  status: 'passed',
  verifiedAt: '2026-07-23T12:00:00.000Z',
  packagePresentedAt: '2026-07-23T11:59:00.000Z',
  packagePath:
    '.atomic-skills/projects/x/y/decisions/F3.jsonl',
};

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

  it('true on session automateActive alone (no-stamp session default)', () => {
    assert.equal(
      isDurableAutomateForDecisionReview({ automateActive: true }),
      true,
    );
  });

  it('false when no stamp and no automateActive', () => {
    assert.equal(isDurableAutomateForDecisionReview({}), false);
  });
});

describe('hasDecisionPackagePresentEvidence', () => {
  it('ok with packagePresentedAt ISO', () => {
    assert.equal(
      hasDecisionPackagePresentEvidence({
        packagePresentedAt: '2026-07-26T10:00:00.000Z',
      }).ok,
      true,
    );
  });

  it('ok with packagePath alone', () => {
    assert.equal(
      hasDecisionPackagePresentEvidence({
        packagePath: 'decisions/F1.jsonl',
      }).ok,
      true,
    );
  });

  it('fails closed without either present field', () => {
    const r = hasDecisionPackagePresentEvidence({
      status: 'passed',
      verifiedAt: '2026-07-23T12:00:00.000Z',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /present-before-PASS|packagePresented|packagePath/i);
  });

  it('rejects non-ISO packagePresentedAt', () => {
    const r = hasDecisionPackagePresentEvidence({
      packagePresentedAt: 'not-a-date',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /ISO|timestamp/i);
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
      decisionReview: {
        status: 'passed',
        packagePresentedAt: '2026-07-23T11:59:00.000Z',
      },
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /verifiedAt/);
  });

  it('blocks passed with non-ISO verifiedAt', () => {
    const r = decisionReviewAllowsPhaseDone({
      planExecutionMode: 'automate',
      decisionReview: {
        status: 'passed',
        verifiedAt: 'x',
        packagePresentedAt: '2026-07-23T11:59:00.000Z',
      },
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /ISO|timestamp/i);
  });

  it('blocks passed with verifiedAt but without package present evidence (present-before-PASS)', () => {
    const r = decisionReviewAllowsPhaseDone({
      planExecutionMode: 'automate',
      decisionReview: {
        status: 'passed',
        verifiedAt: '2026-07-23T12:00:00.000Z',
        evidencePath: '.atomic-skills/projects/x/y/decisions/F3.jsonl',
      },
    });
    assert.equal(r.ok, false);
    assert.match(
      r.reason || '',
      /present-before-PASS|read-before-PASS|packagePresented|packagePath/i,
    );
  });

  it('blocks under session automateActive alone without present evidence (no-stamp session default)', () => {
    const r = decisionReviewAllowsPhaseDone({
      automateActive: true,
      decisionReview: {
        status: 'passed',
        verifiedAt: '2026-07-23T12:00:00.000Z',
      },
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /present-before-PASS|packagePresented|packagePath/i);
  });

  it('allows automate + status passed + verifiedAt + packagePresentedAt', () => {
    const r = decisionReviewAllowsPhaseDone({
      planExecutionMode: 'automate',
      decisionReview: passedWithPresent,
    });
    assert.equal(r.ok, true);
  });

  it('allows passed with packagePath alone as present evidence', () => {
    const r = decisionReviewAllowsPhaseDone({
      planExecutionMode: 'automate',
      decisionReview: {
        status: 'passed',
        verifiedAt: '2026-07-23T12:00:00.000Z',
        packagePath: 'decisions/F3.jsonl',
      },
    });
    assert.equal(r.ok, true);
  });

  it('allows under session automateActive with present evidence (no stamp)', () => {
    const r = decisionReviewAllowsPhaseDone({
      automateActive: true,
      decisionReview: passedWithPresent,
    });
    assert.equal(r.ok, true);
  });
});

describe('canRunPhaseDone wires present-before-PASS', () => {
  const evalPassed = {
    status: 'passed',
    verdict: 'pass',
    reportPath: '.atomic-skills/reviews/eval-demo.md',
  };
  const reviewBoth = {
    status: 'passed',
    mode: 'both',
    at: 'a'.repeat(40),
    reviewFile: '.atomic-skills/reviews/f0-both.md',
    localReceiptPath: '.atomic-skills/reviews/f0-local.md',
    codexReceiptPath: '.atomic-skills/reviews/f0-codex.md',
  };

  it('fails closed when passed without package present evidence', () => {
    const r = canRunPhaseDone({
      planExecutionMode: 'automate',
      evaluationGate: evalPassed,
      lessonsState: 'none',
      reviewGate: reviewBoth,
      decisionReview: {
        status: 'passed',
        verifiedAt: '2026-07-23T12:00:00.000Z',
      },
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /present-before-PASS|packagePresented|packagePath/i);
  });

  it('allows when present evidence present', () => {
    const r = canRunPhaseDone({
      planExecutionMode: 'automate',
      evaluationGate: evalPassed,
      lessonsState: 'none',
      reviewGate: reviewBoth,
      decisionReview: passedWithPresent,
      deliveryAuditGate: {
        status: 'passed',
        verdict: 'CLOSED',
        reportPath: '.atomic-skills/reviews/audit-delivery-demo.md',
        verifiedAt: '2026-08-04T15:00:00.000Z',
      },
    });
    assert.equal(r.ok, true, r.reason);
  });
});

describe('buildDecisionReview', () => {
  it('builds passed stamp with verifiedAt, package present evidence, and optional evidencePath', () => {
    const g = buildDecisionReview({
      status: 'passed',
      verifiedAt: '2026-07-23T12:00:00Z',
      evidencePath: 'decisions/F3.jsonl',
      packagePresentedAt: '2026-07-23T11:59:00Z',
      packagePath: 'decisions/F3.jsonl',
      at: 'abc1234',
    });
    assert.equal(g.status, 'passed');
    assert.equal(g.verifiedAt, '2026-07-23T12:00:00Z');
    assert.equal(g.evidencePath, 'decisions/F3.jsonl');
    assert.equal(g.packagePresentedAt, '2026-07-23T11:59:00Z');
    assert.equal(g.packagePath, 'decisions/F3.jsonl');
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
