import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  phaseEvaluationAllowsClose,
  buildEvaluationGate,
  isDurableAutomateForEvaluation,
} from '../src/phase-evaluation-gate.js';

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

describe('phaseEvaluationAllowsClose', () => {
  it('allows close when automate off', () => {
    assert.deepEqual(phaseEvaluationAllowsClose({}), { ok: true });
  });

  it('blocks when automate stamp and no evaluationGate', () => {
    const r = phaseEvaluationAllowsClose({ planExecutionMode: 'automate' });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /evaluationGate/);
  });

  it('allows passed + verdict pass', () => {
    const r = phaseEvaluationAllowsClose({
      planExecutionMode: 'automate',
      evaluationGate: { status: 'passed', verdict: 'pass' },
    });
    assert.equal(r.ok, true);
  });

  it('blocks passed without verdict pass', () => {
    const r = phaseEvaluationAllowsClose({
      planExecutionMode: 'automate',
      evaluationGate: { status: 'passed', verdict: 'fail' },
    });
    assert.equal(r.ok, false);
  });

  it('allows skipped with reason', () => {
    const r = phaseEvaluationAllowsClose({
      planExecutionMode: 'automate',
      evaluationGate: { status: 'skipped', reason: 'operator: evaluator unavailable' },
    });
    assert.equal(r.ok, true);
  });

  it('blocks skipped without reason', () => {
    const r = phaseEvaluationAllowsClose({
      planExecutionMode: 'automate',
      evaluationGate: { status: 'skipped', reason: '  ' },
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
  it('builds passed gate', () => {
    const g = buildEvaluationGate({ status: 'passed', verdict: 'pass', at: 'abc1234' });
    assert.equal(g.status, 'passed');
    assert.equal(g.verdict, 'pass');
    assert.equal(g.at, 'abc1234');
  });

  it('rejects invalid status', () => {
    assert.throws(() => buildEvaluationGate({ status: 'ok' }), /invalid status/);
  });
});
