/**
 * worktree-teardown.test.js — decision layer for plan-worktree teardown safety.
 *
 * Teardown is only safe when git ancestry proves the plan branch has already
 * reached the selected base ref. The removal wiring lives elsewhere; these tests
 * use injected fakes and never run git.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isTeardownSafe, resolveBaseRef } from '../scripts/worktree-teardown.js';

test('resolveBaseRef prefers origin/main when present', () => {
  const git = { refExists: (ref) => ref === 'origin/main' };

  assert.equal(resolveBaseRef({ git }), 'origin/main');
});

test('resolveBaseRef falls back to local main', () => {
  const git = { refExists: (ref) => ref === 'main' };

  assert.equal(resolveBaseRef({ git }), 'main');
});

test('resolveBaseRef returns null when no base resolves', () => {
  const git = { refExists: () => false };

  assert.equal(resolveBaseRef({ git }), null);
});

test('isTeardownSafe treats a missing branch as nothing to remove without ancestry checks', () => {
  const calls = [];
  const git = {
    isAncestor(branch, baseRef) {
      calls.push({ branch, baseRef });
      return true;
    },
  };

  assert.deepEqual(isTeardownSafe({ branch: null, baseRef: 'main', git }), {
    safe: false,
    outcome: 'nothing-to-remove',
  });
  assert.equal(calls.length, 0);
});

test('isTeardownSafe blocks when base ref is indeterminate', () => {
  const git = { isAncestor: () => true };

  assert.deepEqual(isTeardownSafe({ branch: 'plan/x', baseRef: null, git }), {
    safe: false,
    outcome: 'blocked',
    reason: 'indeterminate-base',
  });
});

test('isTeardownSafe blocks when branch is not integrated into base', () => {
  const git = { isAncestor: () => false };

  assert.deepEqual(isTeardownSafe({ branch: 'plan/x', baseRef: 'main', git }), {
    safe: false,
    outcome: 'blocked',
    reason: 'not-integrated',
  });
});

test('isTeardownSafe returns safe only when branch is integrated into resolved base', () => {
  const git = { isAncestor: () => true };

  assert.deepEqual(isTeardownSafe({ branch: 'plan/x', baseRef: 'main', git }), {
    safe: true,
    outcome: 'safe',
    baseRef: 'main',
  });
});

test('worktree-teardown module contains no forbidden removal tokens', () => {
  const source = readFileSync(join(import.meta.dirname, '..', 'scripts', 'worktree-teardown.js'), 'utf8');

  assert.doesNotMatch(source, /--force/);
  assert.doesNotMatch(source, /git branch -D\b/);
  assert.doesNotMatch(source, /rm -rf/);
});
