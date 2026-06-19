import { test } from 'node:test';
import assert from 'node:assert/strict';

import { findOrphanWorktrees } from '../scripts/detect-orphan-worktrees.js';

function deepFreeze(value) {
  if (value == null || typeof value !== 'object') return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

test('findOrphanWorktrees flags a live worktree merged via pr.state MERGED', () => {
  const findings = findOrphanWorktrees({
    worktrees: [{ path: '/repo/.worktrees/x', branch: 'plan/x', head: 'abc123' }],
    plans: [{ slug: 'x', branch: 'plan/x', status: 'active', pr: { state: 'MERGED' } }],
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].kind, 'merged-feature-worktree');
  assert.equal(findings[0].branch, 'plan/x');
});

test('findOrphanWorktrees flags a live worktree merged via injected isMerged predicate', () => {
  const findings = findOrphanWorktrees({
    worktrees: [{ path: '/repo/.worktrees/x2', branch: 'plan/x2', head: 'def456' }],
    plans: [{ slug: 'x2', branch: 'plan/x2', status: 'active', pr: null }],
    isMerged: (branch) => branch === 'plan/x2',
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].kind, 'merged-feature-worktree');
  assert.equal(findings[0].branch, 'plan/x2');
});

test('findOrphanWorktrees flags an archived branch with no PR', () => {
  const findings = findOrphanWorktrees({
    worktrees: [],
    plans: [{ slug: 'y', branch: 'plan/y', status: 'archived', pr: null }],
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].kind, 'archived-never-pr');
  assert.equal(findings[0].branch, 'plan/y');
});

test('findOrphanWorktrees flags an archived branch with an open unmerged PR', () => {
  const findings = findOrphanWorktrees({
    plans: [{ slug: 'z', branch: 'plan/z', status: 'archived', pr: { state: 'OPEN' } }],
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].kind, 'archived-pr-open-unmerged');
  assert.equal(findings[0].branch, 'plan/z');
});

test('findOrphanWorktrees returns no findings for clean active and healthy archived states', () => {
  const findings = findOrphanWorktrees({
    worktrees: [{ path: '/repo/.worktrees/a', branch: 'plan/a', head: '123abc' }],
    plans: [
      { slug: 'a', branch: 'plan/a', status: 'active', pr: null },
      { slug: 'done', branch: 'plan/done', status: 'archived', pr: { state: 'MERGED' } },
    ],
    isMerged: () => false,
  });

  assert.deepEqual(findings, []);
});

test('findOrphanWorktrees is pure and never throws on frozen or null input', () => {
  const input = deepFreeze({
    worktrees: [{ path: '/repo/.worktrees/pure', branch: 'plan/pure', head: '789abc' }],
    plans: [{ slug: 'pure', branch: 'plan/pure', status: 'active', pr: null }],
    isMerged: () => false,
  });
  const before = structuredClone({
    worktrees: input.worktrees,
    plans: input.plans,
  });

  assert.doesNotThrow(() => findOrphanWorktrees(input));
  assert.deepEqual(
    {
      worktrees: input.worktrees,
      plans: input.plans,
    },
    before,
  );
  assert.deepEqual(findOrphanWorktrees(null), []);
});
