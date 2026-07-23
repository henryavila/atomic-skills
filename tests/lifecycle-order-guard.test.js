import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyLifecycleOrder,
  LIFECYCLE_ORDER_EXCEPTIONS,
  preflightPhaseDone,
  commitGuardPhaseDone,
  decidePhaseDoneTerminal,
  gatePassed,
} from '../scripts/lifecycle-order-guard.js';

function deepFreeze(value) {
  if (value == null || typeof value !== 'object') return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function assertBlockedWithCommand(result) {
  assert.equal(result.allowed, false);
  assert.equal(result.blocked, true);
  assert.equal(typeof result.reason, 'string');
  assert.notEqual(result.reason.length, 0);
  assert.equal(typeof result.recommendedCommand, 'string');
  assert.notEqual(result.recommendedCommand.length, 0);
  assert.equal(result.exception, null);
}

const FP = 'abc123deadbeef01';

function happyCommitInput(overrides = {}) {
  return {
    parentPlan: 'integrity-remediation',
    phaseId: 'F4',
    phase: {
      parentPlan: 'integrity-remediation',
      phaseId: 'F4',
      lessonsState: 'none',
    },
    plan: {
      phases: [
        {
          id: 'F4',
          slug: 'f4',
          status: 'active',
          dependsOn: [],
          exitGate: { summary: 's', criteria: [] },
          subPhaseCount: 0,
          goal: 'g',
          title: 'F4',
        },
      ],
    },
    tasks: [{ id: 'T-001', status: 'done' }],
    exitGates: [{ id: 'F4-G3', status: 'met' }],
    reviewGate: { status: 'passed', at: FP, mode: 'local' },
    fingerprint: FP,
    expectedFingerprint: FP,
    ...overrides,
  };
}

test('blocks archive <slug> before finalize/consolidate publication exists', () => {
  const result = classifyLifecycleOrder({
    command: 'archive',
    targetKind: 'plan',
    target: { slug: 'order-guards', status: 'done', branch: 'plan/order-guards' },
  });

  assertBlockedWithCommand(result);
  assert.equal(result.code, 'archive-missing-publication');
  assert.match(result.reason, /finalize\/consolidate/);
  assert.match(result.recommendedCommand, /finalize order-guards/);
  assert.match(result.recommendedCommand, /archive order-guards/);
});

test('blocks archive <slug> with pr.state NONE as missing publication', () => {
  const result = classifyLifecycleOrder({
    command: 'archive',
    targetKind: 'plan',
    target: {
      slug: 'order-guards',
      status: 'done',
      branch: 'plan/order-guards',
      integration: { pr: { state: 'NONE' } },
    },
  });

  assertBlockedWithCommand(result);
  assert.equal(result.code, 'archive-missing-publication');
  assert.match(result.recommendedCommand, /finalize order-guards/);
  assert.doesNotMatch(result.recommendedCommand, /Merge the PR/);
});

test('blocks archive <slug> when publication exists but merge proof is absent', () => {
  const result = classifyLifecycleOrder({
    command: 'archive',
    targetKind: 'plan',
    target: {
      slug: 'order-guards',
      finalized: true,
      prIdentity: '123',
      integration: { pr: { state: 'OPEN' } },
    },
  });

  assertBlockedWithCommand(result);
  assert.equal(result.code, 'archive-missing-merge');
  assert.match(result.reason, /merged integration proof/);
  assert.match(result.recommendedCommand, /Merge the PR/);
});

test('allows archive <slug> after merged integration proof is present', () => {
  const result = classifyLifecycleOrder({
    command: 'archive',
    targetKind: 'plan',
    target: {
      slug: 'order-guards',
      finalized: true,
      prIdentity: '123',
      integration: { pr: { state: 'MERGED' } },
    },
  });

  assert.deepEqual(result, {
    allowed: true,
    blocked: false,
    code: null,
    reason: null,
    exception: null,
    recommendedCommand: null,
  });
});

test('blocks depend resolve --archived when prerequisite is not archived', () => {
  const result = classifyLifecycleOrder({
    command: 'depend resolve --archived',
    dependentSlug: 'parent-plan',
    prerequisite: { slug: 'child-plan', status: 'done', integration: { pr: { state: 'MERGED' } } },
  });

  assertBlockedWithCommand(result);
  assert.equal(result.code, 'dependency-prerequisite-not-archived');
  assert.match(result.recommendedCommand, /archive child-plan/);
  assert.match(result.recommendedCommand, /depend resolve parent-plan child-plan --archived/);
});

test('blocks depend resolve --archived when archived prerequisite lacks integration proof', () => {
  const result = classifyLifecycleOrder({
    command: 'depend resolve --archived',
    dependentSlug: 'parent-plan',
    prerequisite: { slug: 'child-plan', status: 'archived' },
  });

  assertBlockedWithCommand(result);
  assert.equal(result.code, 'dependency-prerequisite-not-integrated');
  assert.match(result.reason, /no integration proof/);
  assert.match(result.recommendedCommand, /finalize child-plan/);
});

test('allows depend resolve --archived when archived prerequisite is integrated', () => {
  const result = classifyLifecycleOrder({
    command: 'depend resolve --archived',
    dependentSlug: 'parent-plan',
    prerequisite: {
      slug: 'child-plan',
      status: 'archived',
      integration: { integrated: true },
    },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.exception, null);
});

test('preflightPhaseDone allows evidence production when tasks are closed (gates not required)', () => {
  const result = preflightPhaseDone({
    parentPlan: 'integrity-remediation',
    phaseId: 'F4',
    tasks: [{ id: 'T-001', status: 'done' }],
    // pending gate is OK at preflight — evidence production is the next stage
    exitGates: [{ id: 'F4-G3', status: 'pending' }],
  });

  assert.equal(result.allowed, true);
  assert.equal(result.blocked, false);
});

test('preflightPhaseDone blocks open tasks and missing identity', () => {
  const open = preflightPhaseDone({
    parentPlan: 'p',
    phaseId: 'F4',
    tasks: [
      { id: 'T-001', status: 'done' },
      { id: 'T-002', status: 'pending' },
    ],
  });
  assertBlockedWithCommand(open);
  assert.equal(open.code, 'phase-done-open-task');
  assert.match(open.recommendedCommand, /done T-002/);

  const noId = preflightPhaseDone({
    tasks: [{ id: 'T-001', status: 'done' }],
  });
  assertBlockedWithCommand(noId);
  assert.equal(noId.code, 'phase-done-missing-identity');
});

test('preflightPhaseDone blocks invalid phase DAG when plan is provided', () => {
  const result = preflightPhaseDone({
    parentPlan: 'p',
    phaseId: 'A',
    tasks: [{ id: 'T-001', status: 'done' }],
    plan: {
      phases: [
        {
          id: 'A',
          slug: 'a',
          status: 'active',
          dependsOn: ['B'],
          exitGate: { summary: 's', criteria: [] },
          subPhaseCount: 0,
          goal: 'g',
          title: 'A',
        },
        {
          id: 'B',
          slug: 'b',
          status: 'pending',
          dependsOn: ['A'],
          exitGate: { summary: 's', criteria: [] },
          subPhaseCount: 0,
          goal: 'g',
          title: 'B',
        },
      ],
    },
  });

  assertBlockedWithCommand(result);
  assert.match(result.code, /phase-done-dag/);
});

test('blocks phase-done while tasks are open and recommends the task close command', () => {
  const result = classifyLifecycleOrder({
    command: 'phase-done',
    stage: 'preflight',
    parentPlan: 'p',
    phaseId: 'F0',
    tasks: [
      { id: 'T-001', status: 'done' },
      { id: 'T-002', status: 'pending' },
    ],
    exitGates: [],
    reviewGate: { status: 'passed', at: 'abc1234', mode: 'local' },
  });

  assertBlockedWithCommand(result);
  assert.equal(result.code, 'phase-done-open-task');
  assert.match(result.recommendedCommand, /done T-002/);
});

test('gatePassed is true only for met (not deferred)', () => {
  assert.equal(gatePassed({ status: 'met' }), true);
  assert.equal(gatePassed({ status: 'deferred', deferredReason: 'later' }), false);
  assert.equal(gatePassed({ status: 'pending' }), false);
  assert.equal(gatePassed({ status: 'failed' }), false);
});

test('commit guard blocks open exit gates and deferred gates', () => {
  const pending = commitGuardPhaseDone(happyCommitInput({
    exitGates: [{ id: 'G-1', status: 'pending' }],
  }));
  assertBlockedWithCommand(pending);
  assert.equal(pending.code, 'phase-done-open-gate');
  assert.match(pending.recommendedCommand, /G-1/);

  const deferred = commitGuardPhaseDone(happyCommitInput({
    exitGates: [{ id: 'G-2', status: 'deferred', deferredReason: 'operator accepted non-blocking follow-up' }],
  }));
  assertBlockedWithCommand(deferred);
  assert.equal(deferred.code, 'phase-done-gate-deferred');
  assert.match(deferred.reason, /not a terminal path/);
});

test('blocks phase-done until reviewGate is recorded', () => {
  const result = commitGuardPhaseDone(happyCommitInput({
    reviewGate: { status: 'pending' },
  }));

  assertBlockedWithCommand(result);
  assert.equal(result.code, 'phase-done-review-open');
  assert.match(result.recommendedCommand, /review-code/);
});

test('commit guard requires lessons and matching fingerprint', () => {
  const lessons = commitGuardPhaseDone(happyCommitInput({
    phase: { parentPlan: 'integrity-remediation', phaseId: 'F4' },
    lessonsState: undefined,
  }));
  assertBlockedWithCommand(lessons);
  assert.equal(lessons.code, 'phase-done-lessons-open');

  const newHead = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const oldHead = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const stale = commitGuardPhaseDone(happyCommitInput({
    fingerprint: newHead,
    expectedFingerprint: oldHead,
    // Keep reviewGate.at aligned so the failure is the fingerprint gate, not review-stale.
    reviewGate: { status: 'passed', at: newHead, mode: 'local' },
  }));
  assertBlockedWithCommand(stale);
  assert.equal(stale.code, 'phase-done-fingerprint-stale');
});

test('commit guard rejects passed reviewGate without real SHA or mode', () => {
  assert.equal(
    commitGuardPhaseDone(happyCommitInput({
      reviewGate: { status: 'passed', at: 'not-a-sha', mode: 'local' },
    })).code,
    'phase-done-review-open',
  );
  assert.equal(
    commitGuardPhaseDone(happyCommitInput({
      reviewGate: { status: 'passed', at: FP },
    })).code,
    'phase-done-review-open',
  );
});

test('allows phase-done commit when tasks, gates met, review, lessons, and fingerprint match', () => {
  const result = commitGuardPhaseDone(happyCommitInput({
    exitGates: [
      { id: 'G-1', status: 'met' },
      { id: 'G-2', status: 'met' },
    ],
    reviewGate: { status: 'skipped', reason: 'user requested --skip-review' },
  }));

  assert.equal(result.allowed, true);
  assert.equal(result.blocked, false);

  const viaClassify = classifyLifecycleOrder({
    command: 'phase-done',
    ...happyCommitInput(),
  });
  assert.equal(viaClassify.allowed, true);
});

const automateDecisionReviewPassed = {
  status: 'passed',
  verifiedAt: '2026-07-23T12:00:00.000Z',
};

test('B1: under durable automate, reviewGate skipped is blocked even with reason', () => {
  const result = commitGuardPhaseDone(
    happyCommitInput({
      plan: {
        executionMode: 'automate',
        phases: [
          {
            id: 'F4',
            slug: 'f4',
            status: 'active',
            dependsOn: [],
            exitGate: { summary: 's', criteria: [] },
            subPhaseCount: 0,
            goal: 'g',
            title: 'F4',
            evaluationGate: { status: 'passed', verdict: 'pass' },
            decisionReview: automateDecisionReviewPassed,
          },
        ],
      },
      reviewGate: {
        status: 'skipped',
        reason: 'operator: pad pad pad pad pad',
      },
    }),
  );
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'phase-done-review-open');
  assert.match(result.reason, /automate|skip|both/i);
});

test('B1: under durable automate, reviewGate passed + mode local is blocked', () => {
  const result = commitGuardPhaseDone(
    happyCommitInput({
      plan: {
        executionMode: 'automate',
        phases: [
          {
            id: 'F4',
            slug: 'f4',
            status: 'active',
            dependsOn: [],
            exitGate: { summary: 's', criteria: [] },
            subPhaseCount: 0,
            goal: 'g',
            title: 'F4',
            evaluationGate: { status: 'passed', verdict: 'pass' },
            decisionReview: automateDecisionReviewPassed,
          },
        ],
      },
      reviewGate: { status: 'passed', at: FP, mode: 'local' },
    }),
  );
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'phase-done-review-open');
});

test('B1: under durable automate, reviewGate passed + mode both is allowed', () => {
  const result = commitGuardPhaseDone(
    happyCommitInput({
      plan: {
        executionMode: 'automate',
        phases: [
          {
            id: 'F4',
            slug: 'f4',
            status: 'active',
            dependsOn: [],
            exitGate: { summary: 's', criteria: [] },
            subPhaseCount: 0,
            goal: 'g',
            title: 'F4',
            evaluationGate: { status: 'passed', verdict: 'pass' },
            decisionReview: automateDecisionReviewPassed,
          },
        ],
      },
      reviewGate: { status: 'passed', at: FP, mode: 'both' },
    }),
  );
  assert.equal(result.allowed, true, result.reason);
});

test('plan.executionMode stamp is authoritative over top-level planExecutionMode:manual', () => {
  const result = preflightPhaseDone({
    parentPlan: 'demo',
    phaseId: 'F0',
    planExecutionMode: 'manual',
    executionMode: 'manual',
    plan: {
      executionMode: 'automate',
      phases: [{ id: 'F0', slug: 'f0', status: 'active', dependsOn: [] }],
    },
    tasks: [{ id: 'T-001', status: 'done' }],
  });
  assert.equal(result.blocked, true);
  assert.equal(result.code, 'phase-done-evaluation-open');
});

test('top-level evaluationGate cannot spoof missing plan.phases[] stamp', () => {
  const result = preflightPhaseDone({
    parentPlan: 'demo',
    phaseId: 'F0',
    plan: {
      executionMode: 'automate',
      phases: [{ id: 'F0', slug: 'f0', status: 'active', dependsOn: [] }],
    },
    evaluationGate: { status: 'passed', verdict: 'pass' },
    decisionReview: automateDecisionReviewPassed,
    tasks: [{ id: 'T-001', status: 'done' }],
  });
  assert.equal(result.blocked, true);
  assert.equal(result.code, 'phase-done-evaluation-open');
});

test('decidePhaseDoneTerminal returns empty effects when blocked and terminal writes when allowed', () => {
  const blocked = decidePhaseDoneTerminal(happyCommitInput({
    tasks: [{ id: 'T-001', status: 'active' }],
  }));
  assert.equal(blocked.terminal, false);
  assert.deepEqual(blocked.writes, []);
  assert.deepEqual(blocked.events, []);
  assert.deepEqual(blocked.commits, []);

  const ok = decidePhaseDoneTerminal(happyCommitInput());
  assert.equal(ok.terminal, true);
  assert.ok(ok.writes.length > 0);
  assert.ok(ok.events.some((e) => e.startsWith('phase-done:')));
  assert.ok(ok.commits.length > 0);
  // No bulk task-done events on the phase-done path
  assert.ok(!ok.events.some((e) => e.startsWith('task-done:')));
});

test('permits named internal exceptions only when their explicit conditions match', () => {
  const phaseArchive = classifyLifecycleOrder({
    command: 'archive',
    targetKind: 'phase',
    caller: 'phase-done',
  });
  const splitPhase = classifyLifecycleOrder({
    command: 'split-phase',
    preservesExecutionPath: true,
  });
  const historicalDiscover = classifyLifecycleOrder({
    command: 'discover',
    historicalImport: true,
  });

  assert.equal(phaseArchive.allowed, true);
  assert.equal(phaseArchive.exception, LIFECYCLE_ORDER_EXCEPTIONS.PHASE_ARCHIVE);
  assert.equal(splitPhase.allowed, true);
  assert.equal(splitPhase.exception, LIFECYCLE_ORDER_EXCEPTIONS.SPLIT_PHASE);
  assert.equal(historicalDiscover.allowed, true);
  assert.equal(historicalDiscover.exception, LIFECYCLE_ORDER_EXCEPTIONS.HISTORICAL_DISCOVER);
});

test('blocks named exception paths when their explicit condition is absent', () => {
  const results = [
    classifyLifecycleOrder({ command: 'archive', targetKind: 'phase' }),
    classifyLifecycleOrder({ command: 'split-phase' }),
    classifyLifecycleOrder({ command: 'discover' }),
  ];

  for (const result of results) assertBlockedWithCommand(result);
});

test('is pure and never mutates frozen input', () => {
  const input = deepFreeze({
    command: 'depend resolve --archived',
    dependentSlug: 'parent-plan',
    prerequisite: { slug: 'child-plan', status: 'archived', integration: { integrated: true } },
  });
  const before = structuredClone(input);

  assert.doesNotThrow(() => classifyLifecycleOrder(input));
  assert.deepEqual(input, before);

  const phaseInput = deepFreeze(happyCommitInput());
  const phaseBefore = structuredClone(phaseInput);
  assert.doesNotThrow(() => {
    preflightPhaseDone(phaseInput);
    commitGuardPhaseDone(phaseInput);
    decidePhaseDoneTerminal(phaseInput);
  });
  assert.deepEqual(phaseInput, phaseBefore);
});

test('preflightPhaseDone blocks under automate without evaluationGate (R1)', () => {
  const result = preflightPhaseDone({
    parentPlan: 'demo',
    phaseId: 'F0',
    plan: {
      executionMode: 'automate',
      phases: [{ id: 'F0', slug: 'f0', status: 'active', dependsOn: [] }],
    },
    tasks: [{ id: 'T-001', status: 'done' }],
  });
  assert.equal(result.blocked, true);
  assert.equal(result.code, 'phase-done-evaluation-open');
  assert.match(result.recommendedCommand || '', /evaluation/i);
});

test('preflightPhaseDone blocks automate when evaluationGate passed but decisionReview missing', () => {
  const result = preflightPhaseDone({
    parentPlan: 'demo',
    phaseId: 'F0',
    plan: {
      executionMode: 'automate',
      phases: [
        {
          id: 'F0',
          slug: 'f0',
          status: 'active',
          dependsOn: [],
          evaluationGate: { status: 'passed', verdict: 'pass' },
        },
      ],
    },
    tasks: [{ id: 'T-001', status: 'done' }],
  });
  assert.equal(result.blocked, true);
  assert.equal(result.code, 'phase-done-decision-review-open');
  assert.match(result.reason || '', /decisionReview/);
});

test('preflightPhaseDone blocks automate when decisionReview pending', () => {
  const result = preflightPhaseDone({
    parentPlan: 'demo',
    phaseId: 'F0',
    plan: {
      executionMode: 'automate',
      phases: [
        {
          id: 'F0',
          slug: 'f0',
          status: 'active',
          dependsOn: [],
          evaluationGate: { status: 'passed', verdict: 'pass' },
          decisionReview: { status: 'pending' },
        },
      ],
    },
    tasks: [{ id: 'T-001', status: 'done' }],
  });
  assert.equal(result.blocked, true);
  assert.equal(result.code, 'phase-done-decision-review-open');
  assert.match(result.reason || '', /pending/i);
});

test('preflightPhaseDone allows automate when evaluationGate and decisionReview both passed', () => {
  const result = preflightPhaseDone({
    parentPlan: 'demo',
    phaseId: 'F0',
    plan: {
      executionMode: 'automate',
      phases: [
        {
          id: 'F0',
          slug: 'f0',
          status: 'active',
          dependsOn: [],
          evaluationGate: { status: 'passed', verdict: 'pass' },
          decisionReview: {
            status: 'passed',
            verifiedAt: '2026-07-23T12:00:00.000Z',
          },
        },
      ],
    },
    tasks: [{ id: 'T-001', status: 'done' }],
  });
  assert.equal(result.allowed, true);
  assert.equal(result.blocked, false);
});

test('top-level executionMode automate: preflight/commitGuard block when decisionReview missing', () => {
  const input = happyCommitInput({
    executionMode: 'automate',
    plan: {
      phases: [
        {
          id: 'F4',
          slug: 'f4',
          status: 'active',
          dependsOn: [],
          exitGate: { summary: 's', criteria: [] },
          subPhaseCount: 0,
          goal: 'g',
          title: 'F4',
          evaluationGate: { status: 'passed', verdict: 'pass' },
        },
      ],
    },
    evaluationGate: { status: 'passed', verdict: 'pass' },
    reviewGate: { status: 'passed', at: FP, mode: 'both' },
  });
  const preflight = preflightPhaseDone(input);
  assert.equal(preflight.blocked, true);
  assert.equal(preflight.code, 'phase-done-decision-review-open');
  const commit = commitGuardPhaseDone(input);
  assert.equal(commit.blocked, true);
  assert.equal(commit.code, 'phase-done-decision-review-open');
});

test('top-level executionMode automate: preflight/commitGuard allow when decisionReview passed+verifiedAt', () => {
  const input = happyCommitInput({
    executionMode: 'automate',
    plan: {
      phases: [
        {
          id: 'F4',
          slug: 'f4',
          status: 'active',
          dependsOn: [],
          exitGate: { summary: 's', criteria: [] },
          subPhaseCount: 0,
          goal: 'g',
          title: 'F4',
          evaluationGate: { status: 'passed', verdict: 'pass' },
          decisionReview: {
            status: 'passed',
            verifiedAt: '2026-07-23T12:00:00.000Z',
          },
        },
      ],
    },
    evaluationGate: { status: 'passed', verdict: 'pass' },
    decisionReview: {
      status: 'passed',
      verifiedAt: '2026-07-23T12:00:00.000Z',
    },
    reviewGate: { status: 'passed', at: FP, mode: 'both' },
  });
  const preflight = preflightPhaseDone(input);
  assert.equal(preflight.allowed, true, preflight.reason);
  assert.equal(preflight.blocked, false);
  const commit = commitGuardPhaseDone(input);
  assert.equal(commit.allowed, true, commit.reason);
  assert.equal(commit.blocked, false);
});

test('preflightPhaseDone non-automate still allows without evaluationGate', () => {
  const result = preflightPhaseDone({
    parentPlan: 'demo',
    phaseId: 'F0',
    plan: {
      phases: [{ id: 'F0', slug: 'f0', status: 'active', dependsOn: [] }],
    },
    tasks: [{ id: 'T-001', status: 'done' }],
  });
  assert.equal(result.allowed, true);
});
