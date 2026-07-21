import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  phaseEvaluationAllowsClose,
  buildEvaluationGate,
  isDurableAutomateForEvaluation,
  evaluationGateHonesty,
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

  it('accepts failed-dispositioned with disposition + reason', () => {
    assert.deepEqual(
      evaluationGateHonesty({
        status: 'failed-dispositioned',
        disposition: 'accept',
        reason: 'major only; deferred to F2',
      }),
      { ok: true },
    );
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
    assert.equal(r.ok, true);
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

  it('allows failed-dispositioned with disposition + reason', () => {
    const r = phaseEvaluationAllowsClose({
      planExecutionMode: 'automate',
      evaluationGate: {
        status: 'failed-dispositioned',
        disposition: 'accept',
        reason: 'major only; deferred to F2',
      },
    });
    assert.equal(r.ok, true);
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
