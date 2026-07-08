import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyLifecycleOrder,
  LIFECYCLE_ORDER_EXCEPTIONS,
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

test('blocks phase-done while tasks are open and recommends the task close command', () => {
  const result = classifyLifecycleOrder({
    command: 'phase-done',
    tasks: [
      { id: 'T-001', status: 'done' },
      { id: 'T-002', status: 'pending' },
    ],
    exitGates: [],
    reviewGate: { status: 'passed', at: 'abc123' },
  });

  assertBlockedWithCommand(result);
  assert.equal(result.code, 'phase-done-open-task');
  assert.match(result.recommendedCommand, /done T-002/);
});

test('blocks phase-done while exit gates are open', () => {
  const result = classifyLifecycleOrder({
    command: 'phase-done',
    tasks: [{ id: 'T-001', status: 'done' }],
    exitGates: [{ id: 'G-1', status: 'pending' }],
    reviewGate: { status: 'passed', at: 'abc123' },
  });

  assertBlockedWithCommand(result);
  assert.equal(result.code, 'phase-done-open-gate');
  assert.match(result.recommendedCommand, /G-1/);
});

test('blocks phase-done until reviewGate is recorded', () => {
  const result = classifyLifecycleOrder({
    command: 'phase-done',
    tasks: [{ id: 'T-001', status: 'done' }],
    exitGates: [{ id: 'G-1', status: 'met' }],
    reviewGate: { status: 'pending' },
  });

  assertBlockedWithCommand(result);
  assert.equal(result.code, 'phase-done-review-open');
  assert.match(result.recommendedCommand, /review-code/);
});

test('allows phase-done when tasks, gates, and review gate are closed', () => {
  const result = classifyLifecycleOrder({
    command: 'phase-done',
    tasks: [{ id: 'T-001', status: 'done' }],
    exitGates: [
      { id: 'G-1', status: 'met' },
      { id: 'G-2', status: 'deferred', deferredReason: 'operator accepted non-blocking follow-up' },
    ],
    reviewGate: { status: 'skipped', reason: 'user requested --skip-review' },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.blocked, false);
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
});
