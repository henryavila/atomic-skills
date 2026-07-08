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
  assert.equal(findings[0].severity, 'warn');
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
  assert.equal(findings[0].severity, 'warn');
  assert.equal(findings[0].kind, 'merged-feature-worktree');
  assert.equal(findings[0].branch, 'plan/x2');
});

test('findOrphanWorktrees flags an archived branch with no PR', () => {
  const findings = findOrphanWorktrees({
    worktrees: [],
    plans: [{ slug: 'y', branch: 'plan/y', status: 'archived', pr: null }],
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, 'fail');
  assert.equal(findings[0].kind, 'archived-never-pr');
  assert.equal(findings[0].branch, 'plan/y');
  assert.match(findings[0].reason, /has no PR\/integration proof/);
  assert.match(findings[0].recommendedCommand, /finalize y/);
  assert.match(findings[0].recommendedCommand, /archive y/);
});

test('findOrphanWorktrees flags an archived branch with an open unmerged PR', () => {
  const findings = findOrphanWorktrees({
    plans: [{ slug: 'z', branch: 'plan/z', status: 'archived', pr: { state: 'OPEN' } }],
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, 'fail');
  assert.equal(findings[0].kind, 'archived-pr-open-unmerged');
  assert.equal(findings[0].branch, 'plan/z');
  assert.match(findings[0].reason, /open\/unmerged PR/);
  assert.match(findings[0].recommendedCommand, /Merge the PR for z/);
  assert.match(findings[0].recommendedCommand, /archive z/);
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

test('findOrphanWorktrees does not block archived plans without their own branch', () => {
  const findings = findOrphanWorktrees({
    plans: [{ slug: 'local-only', branch: null, status: 'archived', pr: null }],
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

// F6 review F-001: an archived branch that REACHED the integration ref via ancestry
// (isMerged true) is healthy — must NOT be flagged "never reached", even with pr:null.
test('findOrphanWorktrees does not flag an archived branch merged via isMerged (no PR record)', () => {
  const findings = findOrphanWorktrees({
    plans: [{ slug: 'm', branch: 'plan/m', status: 'archived', pr: null }],
    isMerged: (branch) => branch === 'plan/m',
  });
  assert.deepEqual(findings, []);
});

// F6 review F-002: the MERGED signal may live on a non-first duplicate plan for one
// branch — condition A must still flag the live worktree (not first-match-wins suppress).
test('findOrphanWorktrees flags via a non-first duplicate plan carrying pr MERGED', () => {
  const findings = findOrphanWorktrees({
    worktrees: [{ path: '/repo/.worktrees/d', branch: 'plan/d', head: 'aaa111' }],
    plans: [
      { slug: 'd-old', branch: 'plan/d', status: 'archived', pr: null },
      { slug: 'd-new', branch: 'plan/d', status: 'active', pr: { state: 'MERGED' } },
    ],
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].kind, 'merged-feature-worktree');
  assert.equal(findings[0].branch, 'plan/d');
  // the WARN must name the plan carrying the merged signal, not the stale archived dup
  assert.equal(findings[0].slug, 'd-new');
});

// F6 review L2: a live worktree whose branch matches NO plan but is merged via ancestry
// must still flag (slug undefined), exercising the no-matching-plan path.
test('findOrphanWorktrees flags a merged worktree with no matching plan', () => {
  const findings = findOrphanWorktrees({
    worktrees: [{ path: '/repo/.worktrees/np', branch: 'plan/np', head: 'bbb222' }],
    plans: [],
    isMerged: (branch) => branch === 'plan/np',
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].kind, 'merged-feature-worktree');
  assert.equal(findings[0].slug, undefined);
});

// F6 review L1 (major): the never-throws contract must survive a THROWING isMerged —
// without the try/catch this test fails (mutation-killing for safelyIsMerged).
test('findOrphanWorktrees swallows a throwing isMerged predicate', () => {
  const throwingMerged = () => {
    throw new Error('boom');
  };
  let findings;
  assert.doesNotThrow(() => {
    findings = findOrphanWorktrees({
      worktrees: [{ path: '/repo/.worktrees/t', branch: 'plan/t', head: 'ccc333' }],
      plans: [{ slug: 't', branch: 'plan/t', status: 'active', pr: null }],
      isMerged: throwingMerged,
    });
  });
  assert.deepEqual(findings, []);
});

// F6 review L3: malformed (null / non-object) array entries must not throw → [].
test('findOrphanWorktrees tolerates malformed worktree/plan entries', () => {
  let findings;
  assert.doesNotThrow(() => {
    findings = findOrphanWorktrees({
      worktrees: [null, 42, { path: '/x', branch: null, head: 'd' }],
      plans: [null, 'nope', { slug: 's' }],
    });
  });
  assert.deepEqual(findings, []);
});
