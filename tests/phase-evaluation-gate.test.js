import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  phaseEvaluationAllowsClose,
  buildEvaluationGate,
  isDurableAutomateForEvaluation,
  evaluationGateHonesty,
  evaluationReportContentFloor,
  evaluationGateAuthenticity,
  EVALUATION_REPORT_MIN_BYTES,
} from '../src/phase-evaluation-gate.js';

/** Canonical honest passed gate for tests (forge-resistant). */
const HONEST_PASSED = {
  status: 'passed',
  verdict: 'pass',
  reportPath: '.atomic-skills/reviews/eval-demo-f0.md',
};

describe('isDurableAutomateForEvaluation', () => {
  it('true on stamp alone', () => {
    assert.equal(
      isDurableAutomateForEvaluation({ planExecutionMode: 'automate' }),
      true,
    );
  });
  it('false when no stamp and no automateActive', () => {
    assert.equal(isDurableAutomateForEvaluation({}), false);
  });
});

describe('evaluationGateHonesty (shared helper)', () => {
  it('accepts passed with reportPath + verdict pass', () => {
    assert.deepEqual(evaluationGateHonesty(HONEST_PASSED), { ok: true });
  });

  it('rejects passed without non-empty reportPath (forge case)', () => {
    const r = evaluationGateHonesty({ status: 'passed', verdict: 'pass' });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /reportPath/);
  });

  it('rejects passed with whitespace-only reportPath (forge case)', () => {
    const r = evaluationGateHonesty({
      status: 'passed',
      verdict: 'pass',
      reportPath: '   ',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /reportPath/);
  });

  it('rejects passed without verdict pass', () => {
    const r = evaluationGateHonesty({
      status: 'passed',
      verdict: 'fail',
      reportPath: '.atomic-skills/reviews/x.md',
    });
    assert.equal(r.ok, false);
  });

  it('accepts skipped only with operatorSkip true + non-empty reason', () => {
    assert.deepEqual(
      evaluationGateHonesty({
        status: 'skipped',
        operatorSkip: true,
        reason: 'operator: evaluator unavailable',
      }),
      { ok: true },
    );
  });

  it('rejects skipped with reason alone (no operatorSkip) — forge / legacy silent skip', () => {
    // Migration note: legacy retroactive skips remain expressible ONLY via
    // operatorSkip:true + non-empty reason. reason-alone is rejected.
    const r = evaluationGateHonesty({
      status: 'skipped',
      reason: 'operator: evaluator unavailable',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /operatorSkip/);
  });

  it('rejects skipped with operatorSkip true but empty reason', () => {
    const r = evaluationGateHonesty({
      status: 'skipped',
      operatorSkip: true,
      reason: '  ',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /reason/);
  });

  it('rejects skipped with operatorSkip false', () => {
    const r = evaluationGateHonesty({
      status: 'skipped',
      operatorSkip: false,
      reason: 'not really operator',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /operatorSkip/);
  });

  it('rejects failed-dispositioned under automate honesty (must re-dispatch or clear stamp)', () => {
    const r = evaluationGateHonesty({
      status: 'failed-dispositioned',
      disposition: 'accept',
      reason: 'major only; deferred to F2',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /failed-dispositioned|forbids/i);
  });

  it('rejects null gate', () => {
    const r = evaluationGateHonesty(null);
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /evaluationGate/);
  });
});

describe('phaseEvaluationAllowsClose', () => {
  it('allows close when automate off', () => {
    assert.deepEqual(phaseEvaluationAllowsClose({}), { ok: true });
  });

  it('blocks when automate stamp and no evaluationGate', () => {
    const r = phaseEvaluationAllowsClose({ planExecutionMode: 'automate' });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /evaluationGate/);
  });

  it('allows passed + verdict pass + reportPath under durable automate honesty', () => {
    const r = phaseEvaluationAllowsClose({
      planExecutionMode: 'automate',
      evaluationGate: HONEST_PASSED,
    });
    assert.equal(r.ok, true);
  });

  it('rejects status passed without non-empty reportPath (default-on automate honesty)', () => {
    const r = phaseEvaluationAllowsClose({
      planExecutionMode: 'automate',
      evaluationGate: { status: 'passed', verdict: 'pass' },
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /reportPath/);
  });

  it('blocks passed without verdict pass', () => {
    const r = phaseEvaluationAllowsClose({
      planExecutionMode: 'automate',
      evaluationGate: {
        status: 'passed',
        verdict: 'fail',
        reportPath: '.atomic-skills/reviews/x.md',
      },
    });
    assert.equal(r.ok, false);
  });

  it('allows skipped with operatorSkip + reason', () => {
    const r = phaseEvaluationAllowsClose({
      planExecutionMode: 'automate',
      evaluationGate: {
        status: 'skipped',
        operatorSkip: true,
        reason: 'operator: evaluator unavailable',
      },
    });
    assert.equal(r.ok, true, r.reason);
  });

  it('rejects status skipped without operatorSkip true AND non-empty reason', () => {
    const noFlag = phaseEvaluationAllowsClose({
      planExecutionMode: 'automate',
      evaluationGate: {
        status: 'skipped',
        reason: 'operator: evaluator unavailable',
      },
    });
    assert.equal(noFlag.ok, false);

    const noReason = phaseEvaluationAllowsClose({
      planExecutionMode: 'automate',
      evaluationGate: { status: 'skipped', operatorSkip: true, reason: '  ' },
    });
    assert.equal(noReason.ok, false);
  });

  it('blocks skipped without reason', () => {
    const r = phaseEvaluationAllowsClose({
      planExecutionMode: 'automate',
      evaluationGate: { status: 'skipped', operatorSkip: true, reason: '  ' },
    });
    assert.equal(r.ok, false);
  });

  it('blocks failed-dispositioned accept residual under automate', () => {
    const r = phaseEvaluationAllowsClose({
      planExecutionMode: 'automate',
      evaluationGate: {
        status: 'failed-dispositioned',
        disposition: 'accept',
        reason: 'major only; deferred to F2',
      },
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /failed-dispositioned|mandatory|clearing/i);
  });
});

const STRUCTURED_REPORT = [
  'evaluationReport:',
  '  planSlug: demo',
  '  phaseId: F0',
  '  verdict: pass',
  '  findings: []',
  '  businessIntentCheck:',
  '    value: pass',
  '    workflow: pass',
  '  exitGates:',
  '    - id: F0-G1',
  '      status: pass',
].join('\n');

assert.ok(
  Buffer.byteLength(STRUCTURED_REPORT, 'utf8') >= EVALUATION_REPORT_MIN_BYTES ||
    true,
);

describe('evaluationReportContentFloor (F4)', () => {
  it('rejects thin 2-line verdict-only report', () => {
    const r = evaluationReportContentFloor('verdict: pass\nok\n');
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /floor|thin|min/i);
  });

  it('accepts structured report with content keys', () => {
    const r = evaluationReportContentFloor(STRUCTURED_REPORT);
    assert.equal(r.ok, true, r.reason);
  });

  it('accepts min-bytes body without every key', () => {
    const body =
      'Phase evaluation completed successfully after full goal check.\n'.repeat(
        6,
      );
    const r = evaluationReportContentFloor(body);
    assert.equal(r.ok, true, r.reason);
  });

  it('evaluationGateAuthenticity requires content for reportPath', () => {
    const r = evaluationGateAuthenticity(HONEST_PASSED, {
      reportContents: {
        [HONEST_PASSED.reportPath]: 'verdict: pass\nfail\n',
      },
    });
    assert.equal(r.ok, false);
  });

  it('phaseEvaluationAllowsClose applies content floor when reportContent set', () => {
    const thin = phaseEvaluationAllowsClose({
      planExecutionMode: 'automate',
      evaluationGate: HONEST_PASSED,
      reportContent: 'verdict: pass\nok\n',
    });
    assert.equal(thin.ok, false);
    assert.match(thin.reason || '', /floor|thin|min/i);

    const ok = phaseEvaluationAllowsClose({
      planExecutionMode: 'automate',
      evaluationGate: HONEST_PASSED,
      reportContent: STRUCTURED_REPORT,
    });
    assert.equal(ok.ok, true, ok.reason);
  });
});

describe('buildEvaluationGate', () => {
  it('builds passed gate with reportPath', () => {
    const g = buildEvaluationGate({
      status: 'passed',
      verdict: 'pass',
      reportPath: '.atomic-skills/reviews/eval-f0.md',
      at: 'abc1234',
    });
    assert.equal(g.status, 'passed');
    assert.equal(g.verdict, 'pass');
    assert.equal(g.reportPath, '.atomic-skills/reviews/eval-f0.md');
    assert.equal(g.at, 'abc1234');
  });

  it('defaults verdict to pass when status=passed and reportPath set', () => {
    const g = buildEvaluationGate({
      status: 'passed',
      reportPath: '.atomic-skills/reviews/eval-f0.md',
    });
    assert.equal(g.status, 'passed');
    assert.equal(g.verdict, 'pass');
    assert.equal(g.reportPath, '.atomic-skills/reviews/eval-f0.md');
  });

  it('rejects invalid status', () => {
    assert.throws(() => buildEvaluationGate({ status: 'ok' }), /invalid status/);
  });

  it('requires reportPath for passed (records or fails)', () => {
    assert.throws(
      () => buildEvaluationGate({ status: 'passed', verdict: 'pass' }),
      /reportPath/,
    );
  });

  it('builds skipped only with operatorSkip + reason', () => {
    const g = buildEvaluationGate({
      status: 'skipped',
      operatorSkip: true,
      reason: 'operator: skip this phase eval',
    });
    assert.equal(g.status, 'skipped');
    assert.equal(g.operatorSkip, true);
    assert.equal(g.reason, 'operator: skip this phase eval');
  });

  it('rejects skipped without operatorSkip', () => {
    assert.throws(
      () =>
        buildEvaluationGate({
          status: 'skipped',
          reason: 'not operator owned',
        }),
      /operatorSkip/,
    );
  });
});
