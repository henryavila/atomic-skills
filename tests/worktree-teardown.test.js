/**
 * worktree-teardown.test.js — decision layer for plan-worktree teardown safety.
 *
 * Teardown is only safe when local git state and PR metadata prove the plan
 * branch has reached the configured integration ref. These tests inject fakes
 * and never run git or gh.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isTeardownSafe, resolveBaseRef } from '../scripts/worktree-teardown.js';

function ghReturning(live) {
  return {
    prView(prIdentity) {
      assert.equal(prIdentity, '123');
      return live;
    },
  };
}

function mergedPr(overrides = {}) {
  return {
    state: 'MERGED',
    mergedAt: '2026-06-17T12:00:00Z',
    baseRefName: 'develop',
    headRefOid: 'H',
    ...overrides,
  };
}

test('resolveBaseRef returns null when integration ref is not configured', () => {
  const git = { refExists: () => assert.fail('refExists should not be called') };

  assert.equal(resolveBaseRef({ routingConfig: null, git }), null);
});

test('resolveBaseRef prefers origin integration ref when declared ref exists remotely', () => {
  const git = { refExists: (ref) => ref === 'origin/release' };

  assert.deepEqual(resolveBaseRef({ routingConfig: { integrationRef: 'release' }, git }), {
    integrationRef: 'release',
    baseRef: 'origin/release',
  });
});

test('resolveBaseRef uses default integration ref and prefers origin when present', () => {
  const git = { refExists: (ref) => ref === 'origin/develop' };

  assert.deepEqual(resolveBaseRef({ routingConfig: {}, git }), {
    integrationRef: 'develop',
    baseRef: 'origin/develop',
  });
});

test('resolveBaseRef falls back to local integration ref', () => {
  const git = { refExists: (ref) => ref === 'develop' };

  assert.deepEqual(resolveBaseRef({ routingConfig: {}, git }), {
    integrationRef: 'develop',
    baseRef: 'develop',
  });
});

test('resolveBaseRef returns null when configured integration ref is unavailable locally', () => {
  const git = { refExists: () => false };

  assert.equal(resolveBaseRef({ routingConfig: { integrationRef: 'release' }, git }), null);
});

test('isTeardownSafe treats missing branch as nothing to remove without gh or git calls', () => {
  const git = {
    revParse: () => assert.fail('revParse should not be called'),
    isAncestor: () => assert.fail('isAncestor should not be called'),
  };
  const gh = {
    prView: () => assert.fail('prView should not be called'),
  };

  assert.deepEqual(
    isTeardownSafe({
      branch: null,
      baseRef: 'origin/develop',
      integrationRef: 'develop',
      prIdentity: '123',
      git,
      gh,
    }),
    {
      safe: false,
      outcome: 'nothing-to-remove',
    },
  );
});

test('isTeardownSafe blocks when base is indeterminate', () => {
  assert.deepEqual(isTeardownSafe({ branch: 'plan/x', baseRef: null, integrationRef: 'develop', prIdentity: '123' }), {
    safe: false,
    outcome: 'blocked',
    reason: 'indeterminate-base',
  });
});

test('isTeardownSafe blocks when PR identity is missing', () => {
  assert.deepEqual(isTeardownSafe({ branch: 'plan/x', baseRef: 'origin/develop', integrationRef: 'develop' }), {
    safe: false,
    outcome: 'blocked',
    reason: 'pr-identity-missing',
  });
});

test('isTeardownSafe blocks when gh is unauthenticated', () => {
  assert.deepEqual(
    isTeardownSafe({
      branch: 'plan/x',
      baseRef: 'origin/develop',
      integrationRef: 'develop',
      prIdentity: '123',
      gh: ghReturning({ authenticated: false }),
    }),
    {
      safe: false,
      outcome: 'blocked',
      reason: 'gh-unauthenticated',
    },
  );
});

test('isTeardownSafe blocks when PR identity is ambiguous or unresolved', () => {
  assert.deepEqual(
    isTeardownSafe({
      branch: 'plan/x',
      baseRef: 'origin/develop',
      integrationRef: 'develop',
      prIdentity: '123',
      gh: ghReturning(null),
    }),
    {
      safe: false,
      outcome: 'blocked',
      reason: 'pr-identity-ambiguous',
    },
  );

  assert.deepEqual(
    isTeardownSafe({
      branch: 'plan/x',
      baseRef: 'origin/develop',
      integrationRef: 'develop',
      prIdentity: '123',
      gh: ghReturning({ ambiguous: true }),
    }),
    {
      safe: false,
      outcome: 'blocked',
      reason: 'pr-identity-ambiguous',
    },
  );
});

test('isTeardownSafe blocks when PR is not merged', () => {
  assert.deepEqual(
    isTeardownSafe({
      branch: 'plan/x',
      baseRef: 'origin/develop',
      integrationRef: 'develop',
      prIdentity: '123',
      gh: ghReturning(mergedPr({ state: 'OPEN' })),
    }),
    {
      safe: false,
      outcome: 'blocked',
      reason: 'not-merged',
    },
  );
});

test('isTeardownSafe blocks when PR base differs from integration ref', () => {
  assert.deepEqual(
    isTeardownSafe({
      branch: 'plan/x',
      baseRef: 'origin/develop',
      integrationRef: 'develop',
      prIdentity: '123',
      gh: ghReturning(mergedPr({ baseRefName: 'main' })),
    }),
    {
      safe: false,
      outcome: 'blocked',
      reason: 'base-ref-mismatch',
    },
  );
});

test('isTeardownSafe blocks when PR head ref oid is missing', () => {
  assert.deepEqual(
    isTeardownSafe({
      branch: 'plan/x',
      baseRef: 'origin/develop',
      integrationRef: 'develop',
      prIdentity: '123',
      gh: ghReturning(mergedPr({ headRefOid: null })),
    }),
    {
      safe: false,
      outcome: 'blocked',
      reason: 'head-ref-missing',
    },
  );
});

test('isTeardownSafe blocks squash residue beyond the PR head', () => {
  const git = {
    revParse: (branch) => {
      assert.equal(branch, 'plan/x');
      return 'NEW';
    },
    isAncestor: (branch, baseRef) => {
      assert.equal(branch, 'plan/x');
      assert.equal(baseRef, 'origin/develop');
      return false;
    },
  };

  assert.deepEqual(
    isTeardownSafe({
      branch: 'plan/x',
      baseRef: 'origin/develop',
      integrationRef: 'develop',
      prIdentity: '123',
      git,
      gh: ghReturning(mergedPr()),
    }),
    {
      safe: false,
      outcome: 'blocked',
      reason: 'residue-beyond-head',
    },
  );
});

test('isTeardownSafe permits clean squash when branch head matches PR head', () => {
  const git = {
    revParse: (branch) => {
      assert.equal(branch, 'plan/x');
      return 'H';
    },
    isAncestor: () => assert.fail('isAncestor should not be called after squash head match'),
  };

  assert.deepEqual(
    isTeardownSafe({
      branch: 'plan/x',
      baseRef: 'origin/develop',
      integrationRef: 'develop',
      prIdentity: '123',
      git,
      gh: ghReturning(mergedPr()),
    }),
    {
      safe: true,
      outcome: 'safe',
      baseRef: 'origin/develop',
      integrationRef: 'develop',
      headRefOid: 'H',
      via: 'squash-head-match',
    },
  );
});

test('isTeardownSafe permits non-squash ancestry when branch head differs from PR head', () => {
  const git = {
    revParse: (branch) => {
      assert.equal(branch, 'plan/x');
      return 'OTHER';
    },
    isAncestor: (branch, baseRef) => {
      assert.equal(branch, 'plan/x');
      assert.equal(baseRef, 'origin/develop');
      return true;
    },
  };

  assert.deepEqual(
    isTeardownSafe({
      branch: 'plan/x',
      baseRef: 'origin/develop',
      integrationRef: 'develop',
      prIdentity: '123',
      git,
      gh: ghReturning(mergedPr()),
    }),
    {
      safe: true,
      outcome: 'safe',
      baseRef: 'origin/develop',
      integrationRef: 'develop',
      via: 'ancestor',
    },
  );
});

test('worktree-teardown module contains no forbidden removal tokens', () => {
  const source = readFileSync(join(import.meta.dirname, '..', 'scripts', 'worktree-teardown.js'), 'utf8');

  assert.doesNotMatch(source, /--force/);
  assert.doesNotMatch(source, /-D/);
  assert.doesNotMatch(source, /git branch -D\b/);
  assert.doesNotMatch(source, /rm -rf/);
  assert.doesNotMatch(source, /git rev-list --not/);
});
