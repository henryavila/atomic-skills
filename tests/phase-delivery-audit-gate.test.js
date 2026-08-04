import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  deliveryAuditGateHonesty,
  deliveryAuditAllowsClose,
  buildDeliveryAuditGate,
  isDurableAutomateForDeliveryAudit,
  DELIVERY_AUDIT_PASS_VERDICTS,
} from '../src/phase-delivery-audit-gate.js';
import { canRunPhaseDone } from '../src/automate-orchestrator-gates.js';

/** Canonical honest passed gate for tests. */
const HONEST_CLOSED = {
  status: 'passed',
  verdict: 'CLOSED',
  reportPath: '.atomic-skills/reviews/audit-delivery-demo-f2.md',
  verifiedAt: '2026-08-04T15:00:00.000Z',
};

const evalPassed = {
  status: 'passed',
  verdict: 'pass',
  reportPath: '.atomic-skills/reviews/eval-demo.md',
};
const decisionPassed = {
  status: 'passed',
  verifiedAt: '2026-07-23T12:00:00.000Z',
  packagePresentedAt: '2026-07-23T11:59:00.000Z',
  packagePath: 'decisions/F0.jsonl',
};
const reviewBoth = {
  status: 'passed',
  mode: 'both',
  at: 'a'.repeat(40),
  reviewFile: '.atomic-skills/reviews/f0-both.md',
  localReceiptPath: '.atomic-skills/reviews/f0-local.md',
  codexReceiptPath: '.atomic-skills/reviews/f0-codex.md',
};

describe('isDurableAutomateForDeliveryAudit', () => {
  it('true on stamp alone', () => {
    assert.equal(
      isDurableAutomateForDeliveryAudit({ planExecutionMode: 'automate' }),
      true,
    );
  });
  it('false when no stamp and no automateActive', () => {
    assert.equal(isDurableAutomateForDeliveryAudit({}), false);
  });
});

describe('deliveryAuditGateHonesty', () => {
  it('accepts passed + CLOSED + reportPath', () => {
    assert.deepEqual(deliveryAuditGateHonesty(HONEST_CLOSED), { ok: true });
  });

  it('accepts passed + PARTIAL + reportPath', () => {
    assert.deepEqual(
      deliveryAuditGateHonesty({
        status: 'passed',
        verdict: 'PARTIAL',
        reportPath: '.atomic-skills/reviews/audit-delivery-partial.md',
      }),
      { ok: true },
    );
  });

  it('rejects null / missing gate', () => {
    const r = deliveryAuditGateHonesty(null);
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /deliveryAuditGate/);
  });

  it('rejects status skipped (skip illegal)', () => {
    const r = deliveryAuditGateHonesty({
      status: 'skipped',
      operatorSkip: true,
      reason: 'small phase',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /skipped|illegal/i);
  });

  it('rejects operatorSkip even with passed shape', () => {
    const r = deliveryAuditGateHonesty({
      ...HONEST_CLOSED,
      operatorSkip: true,
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /operatorSkip/);
  });

  it('rejects reason-only without passed stamp', () => {
    const r = deliveryAuditGateHonesty({
      reason: 'we audited in chat',
    });
    assert.equal(r.ok, false);
  });

  it('rejects empty reportPath', () => {
    const r = deliveryAuditGateHonesty({
      status: 'passed',
      verdict: 'CLOSED',
      reportPath: '   ',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /reportPath/);
  });

  it('rejects OPEN verdict (never stamps passed)', () => {
    const r = deliveryAuditGateHonesty({
      status: 'passed',
      verdict: 'OPEN',
      reportPath: '.atomic-skills/reviews/x.md',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /OPEN/);
  });

  it('rejects missing verdict', () => {
    const r = deliveryAuditGateHonesty({
      status: 'passed',
      reportPath: '.atomic-skills/reviews/x.md',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /CLOSED|PARTIAL|verdict/i);
  });

  it('pass verdicts constant lists CLOSED and PARTIAL', () => {
    assert.deepEqual([...DELIVERY_AUDIT_PASS_VERDICTS].sort(), [
      'CLOSED',
      'PARTIAL',
    ]);
  });
});

describe('deliveryAuditAllowsClose', () => {
  it('allows close when automate off', () => {
    assert.deepEqual(deliveryAuditAllowsClose({}), { ok: true });
  });

  it('blocks when automate stamp and no deliveryAuditGate', () => {
    const r = deliveryAuditAllowsClose({ planExecutionMode: 'automate' });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /deliveryAuditGate/);
  });

  it('allows honest CLOSED under durable automate', () => {
    const r = deliveryAuditAllowsClose({
      planExecutionMode: 'automate',
      deliveryAuditGate: HONEST_CLOSED,
    });
    assert.equal(r.ok, true);
  });

  it('reads gate from phase.deliveryAuditGate', () => {
    const r = deliveryAuditAllowsClose({
      planExecutionMode: 'automate',
      phase: { deliveryAuditGate: HONEST_CLOSED },
    });
    assert.equal(r.ok, true);
  });

  it('blocks skip shapes under automate', () => {
    const r = deliveryAuditAllowsClose({
      planExecutionMode: 'automate',
      deliveryAuditGate: {
        status: 'skipped',
        operatorSkip: true,
        reason: 'no product intent',
      },
    });
    assert.equal(r.ok, false);
  });
});

describe('buildDeliveryAuditGate', () => {
  it('builds CLOSED stamp', () => {
    const g = buildDeliveryAuditGate({
      reportPath: '.atomic-skills/reviews/a.md',
      verdict: 'CLOSED',
      verifiedAt: '2026-08-04T15:00:00.000Z',
    });
    assert.equal(g.status, 'passed');
    assert.equal(g.verdict, 'CLOSED');
    assert.equal(g.reportPath, '.atomic-skills/reviews/a.md');
  });

  it('throws on OPEN', () => {
    assert.throws(
      () =>
        buildDeliveryAuditGate({
          reportPath: '.atomic-skills/reviews/a.md',
          verdict: 'OPEN',
        }),
      /OPEN/,
    );
  });

  it('throws on empty reportPath', () => {
    assert.throws(
      () => buildDeliveryAuditGate({ reportPath: '', verdict: 'CLOSED' }),
      /reportPath/,
    );
  });

  it('throws on skipped status', () => {
    assert.throws(
      () =>
        buildDeliveryAuditGate({
          status: 'skipped',
          reportPath: '.atomic-skills/reviews/a.md',
          verdict: 'CLOSED',
        }),
      /skipped|illegal/i,
    );
  });

  it('throws on operatorSkip', () => {
    assert.throws(
      () =>
        buildDeliveryAuditGate({
          reportPath: '.atomic-skills/reviews/a.md',
          verdict: 'CLOSED',
          operatorSkip: true,
        }),
      /operatorSkip/,
    );
  });
});

describe('canRunPhaseDone requires deliveryAuditGate', () => {
  const baseOk = {
    planExecutionMode: 'automate',
    evaluationGate: evalPassed,
    lessonsState: 'none',
    reviewGate: reviewBoth,
    decisionReview: decisionPassed,
  };

  it('blocks full chain without deliveryAuditGate (missing fail)', () => {
    const r = canRunPhaseDone(baseOk);
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /deliveryAuditGate|audit-delivery/i);
  });

  it('blocks skip deliveryAuditGate', () => {
    const r = canRunPhaseDone({
      ...baseOk,
      deliveryAuditGate: {
        status: 'skipped',
        operatorSkip: true,
        reason: 'waive',
      },
    });
    assert.equal(r.ok, false);
  });

  it('allows valid CLOSED deliveryAuditGate', () => {
    const r = canRunPhaseDone({
      ...baseOk,
      deliveryAuditGate: HONEST_CLOSED,
    });
    assert.equal(r.ok, true, r.reason);
  });

  it('blocks OPEN verdict on deliveryAuditGate', () => {
    const r = canRunPhaseDone({
      ...baseOk,
      deliveryAuditGate: {
        status: 'passed',
        verdict: 'OPEN',
        reportPath: '.atomic-skills/reviews/x.md',
      },
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /OPEN/);
  });
});
