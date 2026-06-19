import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  detectPlanStatusRegression,
  resolveFinalizePlanScope,
} from '../scripts/finalize-plan-scope.js';

function deepFreeze(value) {
  if (value == null || typeof value !== 'object') return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

test('resolveFinalizePlanScope classifies target, other-active, and archived-unmerged plans', () => {
  const result = resolveFinalizePlanScope({
    plans: [
      { slug: 'target', status: 'archived', phases: [] },
      { slug: 'sibling', status: 'active', phases: [] },
      { slug: 'old', status: 'archived', phases: [] },
    ],
    focusSlug: 'target',
    targetSlug: 'target',
  });

  assert.deepEqual(result.classifications, [
    { slug: 'target', class: 'target' },
    { slug: 'sibling', class: 'other-active' },
    { slug: 'old', class: 'archived-unmerged' },
  ]);
});

test('resolveFinalizePlanScope classifies unknown non-target statuses as archived-unmerged', () => {
  const result = resolveFinalizePlanScope({
    plans: [
      { slug: 'target', status: 'archived', phases: [] },
      { slug: 'unknown', status: 'paused', phases: [] },
    ],
    focusSlug: 'target',
    targetSlug: 'target',
  });

  assert.deepEqual(result.classifications, [
    { slug: 'target', class: 'target' },
    { slug: 'unknown', class: 'archived-unmerged' },
  ]);
});

test('resolveFinalizePlanScope blocks active targets with un-done phases and names them', () => {
  const result = resolveFinalizePlanScope({
    plans: [
      {
        slug: 'target',
        status: 'active',
        phases: [
          { id: 'done-phase', status: 'done' },
          { id: 'review', status: 'active' },
          { id: 'ship', status: 'pending' },
        ],
      },
    ],
    focusSlug: 'target',
    targetSlug: 'target',
  });

  assert.equal(result.decision, 'block');
  assert.match(result.blockReason ?? '', /review/);
  assert.match(result.blockReason ?? '', /ship/);
});

test('resolveFinalizePlanScope proceeds for an active target when all phases are done and target matches focus', () => {
  const result = resolveFinalizePlanScope({
    plans: [
      {
        slug: 'target',
        status: 'active',
        phases: [
          { id: 'build', status: 'done' },
          { id: 'verify', status: 'done' },
        ],
      },
    ],
    focusSlug: 'target',
    targetSlug: 'target',
  });

  assert.equal(result.decision, 'proceed');
  assert.equal(result.blockReason, null);
});

test('resolveFinalizePlanScope proceeds for an archived target when target matches focus', () => {
  const result = resolveFinalizePlanScope({
    plans: [{ slug: 'target', status: 'archived', phases: [{ id: 'ship', status: 'active' }] }],
    focusSlug: 'target',
    targetSlug: 'target',
  });

  assert.equal(result.decision, 'proceed');
  assert.equal(result.blockReason, null);
});

test('resolveFinalizePlanScope blocks target-focus mismatches until explicitly confirmed', () => {
  const result = resolveFinalizePlanScope({
    plans: [{ slug: 'old-plan', status: 'archived', phases: [], branch: 'multiplan' }],
    focusSlug: 'new-plan',
    targetSlug: 'old-plan',
  });

  assert.equal(result.decision, 'block');
  assert.match(result.blockReason ?? '', /old-plan/);
  assert.match(result.blockReason ?? '', /new-plan/);
  assert.match(result.blockReason ?? '', /branch name.*not.*plan slug/i);
});

test('resolveFinalizePlanScope does not block target-focus mismatches when confirmed and otherwise terminal', () => {
  const result = resolveFinalizePlanScope({
    plans: [{ slug: 'old-plan', status: 'archived', phases: [], branch: 'multiplan' }],
    focusSlug: 'new-plan',
    targetSlug: 'old-plan',
    confirmed: true,
  });

  assert.equal(result.decision, 'proceed');
  assert.equal(result.blockReason, null);
});

test('resolveFinalizePlanScope warns about every active sibling plan the branch merge would drag', () => {
  const result = resolveFinalizePlanScope({
    plans: [
      { slug: 'target', status: 'archived', phases: [] },
      { slug: 'sibling-a', status: 'active', phases: [] },
      { slug: 'sibling-b', status: 'active', phases: [] },
      { slug: 'old', status: 'archived', phases: [] },
    ],
    focusSlug: 'target',
    targetSlug: 'target',
  });

  assert.deepEqual(result.warnings, [
    {
      kind: 'sibling-active-plan',
      slug: 'sibling-a',
      reason: 'active sibling plan sibling-a would be included by a branch merge',
    },
    {
      kind: 'sibling-active-plan',
      slug: 'sibling-b',
      reason: 'active sibling plan sibling-b would be included by a branch merge',
    },
  ]);
});

test('resolveFinalizePlanScope fail-closes on null input without throwing', () => {
  let result;
  assert.doesNotThrow(() => {
    result = resolveFinalizePlanScope(null);
  });
  assert.equal(result.decision, 'block');
  assert.equal(result.target, null);
  assert.equal(typeof result.blockReason, 'string');
});

test('resolveFinalizePlanScope fail-closes on malformed plans and missing targets', () => {
  const malformed = resolveFinalizePlanScope({
    plans: 'not-an-array',
    focusSlug: 'target',
    targetSlug: 'target',
  });
  const missing = resolveFinalizePlanScope({
    plans: [{ slug: 'other', status: 'archived', phases: [] }],
    focusSlug: 'target',
    targetSlug: 'target',
  });

  assert.equal(malformed.decision, 'block');
  assert.match(malformed.blockReason ?? '', /plans/i);
  assert.equal(missing.decision, 'block');
  assert.match(missing.blockReason ?? '', /not found/i);
});

test('resolveFinalizePlanScope is pure and never throws on frozen input', () => {
  const input = deepFreeze({
    plans: [
      {
        slug: 'target',
        status: 'active',
        phases: [{ id: 'build', status: 'done' }],
        branch: 'plan/target',
      },
      { slug: 'sibling', status: 'active', phases: [] },
    ],
    focusSlug: 'target',
    targetSlug: 'target',
  });
  const before = structuredClone(input);

  assert.doesNotThrow(() => resolveFinalizePlanScope(input));
  assert.deepEqual(input, before);
});

test('detectPlanStatusRegression returns the slug regressed from archived on ref to active on branch', () => {
  const regressions = detectPlanStatusRegression({
    branchPlans: [{ slug: 'plan-a', status: 'active' }],
    refPlans: [{ slug: 'plan-a', status: 'archived' }],
  });

  assert.deepEqual(regressions, [
    {
      slug: 'plan-a',
      branchStatus: 'active',
      refStatus: 'archived',
      reason: 'plan plan-a is active on the branch but archived on the integration ref; merge would regress it',
    },
  ]);
});

test('detectPlanStatusRegression returns empty for equal or ahead branch statuses', () => {
  assert.deepEqual(
    detectPlanStatusRegression({
      branchPlans: [
        { slug: 'ahead', status: 'archived' },
        { slug: 'equal-active', status: 'active' },
        { slug: 'equal-archived', status: 'archived' },
      ],
      refPlans: [
        { slug: 'ahead', status: 'active' },
        { slug: 'equal-active', status: 'active' },
        { slug: 'equal-archived', status: 'archived' },
      ],
    }),
    [],
  );
});

test('detectPlanStatusRegression ignores slugs present on only one side', () => {
  assert.deepEqual(
    detectPlanStatusRegression({
      branchPlans: [
        { slug: 'branch-only', status: 'active' },
        { slug: 'shared', status: 'active' },
      ],
      refPlans: [
        { slug: 'ref-only', status: 'archived' },
        { slug: 'shared', status: 'active' },
      ],
    }),
    [],
  );
});

test('detectPlanStatusRegression returns empty for unknown branch status against active ref', () => {
  const regressions = detectPlanStatusRegression({
    branchPlans: [{ slug: 'unknown', status: 'paused' }],
    refPlans: [{ slug: 'unknown', status: 'active' }],
  });

  assert.deepEqual(regressions, [
    {
      slug: 'unknown',
      branchStatus: 'paused',
      refStatus: 'active',
      reason: 'plan unknown is paused on the branch but active on the integration ref; merge would regress it',
    },
  ]);
});

test('detectPlanStatusRegression never throws on null or malformed input and returns empty results', () => {
  let nullResult;
  let malformedResult;

  assert.doesNotThrow(() => {
    nullResult = detectPlanStatusRegression(null);
    malformedResult = detectPlanStatusRegression({
      branchPlans: 'not-an-array',
      refPlans: [{ slug: 'x', status: 'archived' }],
    });
  });
  assert.deepEqual(nullResult, []);
  assert.deepEqual(malformedResult, []);
});
