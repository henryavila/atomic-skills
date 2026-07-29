/**
 * GATE-R4 / checkEvaluationGate authenticity tests (R3).
 *
 * Shares evaluationGateHonesty via phaseEvaluationAllowsClose — same rules as
 * phase-evaluation-gate unit tests (no divergent GATE-R4 prose).
 *
 * Migration note: legacy retroactive skips remain expressible ONLY via
 * operatorSkip:true + non-empty reason. reason-alone is a forge case.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { checkEvaluationGate } from '../scripts/validate-state.js';

function automateDonePlan(evaluationGate, extra = {}) {
  return {
    schemaVersion: '0.1',
    slug: 'gate-r4-demo',
    title: 'Gate R4',
    version: '1.0',
    status: 'active',
    started: '2026-07-21T00:00:00.000Z',
    lastUpdated: '2026-07-21T00:00:00.000Z',
    branch: 'plan/gate-r4-demo',
    currentPhase: null,
    executionMode: 'automate',
    phases: [
      {
        id: 'F0',
        slug: 'f0',
        title: 'F0',
        goal: 'g',
        status: 'done',
        dependsOn: [],
        subPhaseCount: 0,
        exitGate: { summary: 's', criteria: [] },
        ...(evaluationGate !== undefined ? { evaluationGate } : {}),
        ...extra,
      },
    ],
  };
}

test('GATE-R4 RED: automate done phase without evaluationGate violates', () => {
  // Mid-plan Mode-1→automate exempt unless closedUnderAutomate / automate-era stamps.
  const v = checkEvaluationGate(
    automateDonePlan(undefined, { closedUnderAutomate: true }),
  );
  assert.ok(v.length >= 1);
  assert.match(v[0], /evaluationGate/);
});

test('GATE-R4 GREEN: passed with reportPath + verdict pass', () => {
  assert.deepEqual(
    checkEvaluationGate(
      automateDonePlan({
        status: 'passed',
        verdict: 'pass',
        reportPath: '.atomic-skills/reviews/eval-gate-r4-demo-f0.md',
      }),
    ),
    [],
  );
});

test('GATE-R4 RED: passed without reportPath is forge (honesty)', () => {
  const v = checkEvaluationGate(
    automateDonePlan({ status: 'passed', verdict: 'pass' }),
  );
  assert.ok(v.length >= 1);
  assert.match(v[0], /reportPath/);
});

test('GATE-R4 RED: automate done phase with passed but no verdict', () => {
  const v = checkEvaluationGate(
    automateDonePlan({
      status: 'passed',
      reportPath: '.atomic-skills/reviews/x.md',
    }),
  );
  assert.ok(v.length >= 1);
});

test('GATE-R4 GREEN: skipped with operatorSkip + reason', () => {
  assert.deepEqual(
    checkEvaluationGate(
      automateDonePlan({
        status: 'skipped',
        operatorSkip: true,
        reason: 'operator: evaluator unavailable this session',
      }),
    ),
    [],
  );
});

test('GATE-R4 RED: skipped without operatorSkip (legacy silent skip rejected)', () => {
  // Migration: retroactive skips must re-stamp with operatorSkip:true + reason.
  const v = checkEvaluationGate(
    automateDonePlan({
      status: 'skipped',
      reason: 'operator: evaluator unavailable',
    }),
  );
  assert.ok(v.length >= 1);
  assert.match(v[0], /operatorSkip/);
});

test('GATE-R4 RED: failed-dispositioned under automate is forbidden (re-dispatch until passed)', () => {
  // Durable automate no longer accepts failed-dispositioned as a close path —
  // residual accept/defer requires clearing the automate stamp (or re-eval pass).
  const v = checkEvaluationGate(
    automateDonePlan({
      status: 'failed-dispositioned',
      disposition: 'defer',
      reason: 'major residual accepted for F2',
    }),
  );
  assert.ok(v.length >= 1);
  assert.match(v[0], /failed-dispositioned|evaluationGate invalid/i);
});

test('GATE-R4: non-automate plan without evaluationGate is OK', () => {
  const plan = automateDonePlan(undefined);
  delete plan.executionMode;
  assert.deepEqual(checkEvaluationGate(plan), []);
});

test('GATE-R4: non-automate plan with forged passed gate is not honesty-checked (stamp inactive)', () => {
  // Honesty for evaluationGate runs only under durable executionMode: automate.
  const plan = automateDonePlan({ status: 'passed', verdict: 'pass' });
  delete plan.executionMode;
  assert.deepEqual(checkEvaluationGate(plan), []);
});
