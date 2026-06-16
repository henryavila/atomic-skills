/**
 * plan-branch-policy.test.js — deterministic plan branch fork policy.
 *
 * A plan branch is created only when a new active plan is born into an already
 * active front. Solo plan creation keeps `branch: null` and stays in the
 * current working tree.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { planBranchName, retroactiveWorktreeAdd, shouldForkPlanBranch } from '../scripts/plan-branch-policy.js';

test('solo plan creation does not fork a plan branch', () => {
  assert.equal(shouldForkPlanBranch([]), false);
});

test('pre-existing active plan means concurrent creation forks a plan branch', () => {
  assert.equal(shouldForkPlanBranch([{ slug: 'other' }]), true);
});

test('non-array active plan input fails safe toward no fork', () => {
  assert.equal(shouldForkPlanBranch(undefined), false);
});

test('planBranchName prefixes the slug with plan/', () => {
  assert.equal(planBranchName('foo'), 'plan/foo');
});

test('Stage 6 documents branch: null as the solo plan default', () => {
  const doc = readFileSync(join(import.meta.dirname, '..', 'skills', 'shared', 'project-assets', 'project-create-plan.md'), 'utf8');
  const stage6Start = doc.indexOf('### Stage 6 — Create Plan + Initiatives');
  const stage7Start = doc.indexOf('### Stage 7', stage6Start);
  const stage6 = doc.slice(stage6Start, stage7Start === -1 ? undefined : stage7Start);
  const branchNullIndex = stage6.indexOf('branch: null');
  const nearby = stage6.slice(Math.max(0, branchNullIndex - 240), branchNullIndex + 360).toLowerCase();

  assert.notEqual(stage6Start, -1, 'Stage 6 section must exist');
  assert.notEqual(branchNullIndex, -1, 'Stage 6 must explicitly mention `branch: null`');
  assert.match(nearby, /solo|nenhum outro plano ativo|sem outro plano ativo|no other active plan/);
});

test('retroactiveWorktreeAdd composes a non-forced worktree add from captured baseRef', () => {
  const command = retroactiveWorktreeAdd({ slug: 'old', baseRef: 'abc123' });

  assert.match(command, /\.worktrees\/old/);
  assert.match(command, /-b plan\/old/);
  assert.match(command, /abc123/);
  assert.doesNotMatch(command, /--force/);
});

test('retroactiveWorktreeAdd throws without a captured baseRef', () => {
  assert.throws(() => retroactiveWorktreeAdd({ slug: 'old' }));
});

test('retroactiveWorktreeAdd throws for an empty captured baseRef', () => {
  assert.throws(() => retroactiveWorktreeAdd({ slug: 'old', baseRef: '' }));
});

test('Stage 6 documents capture-before-write for retroactive worktrees', () => {
  const doc = readFileSync(join(import.meta.dirname, '..', 'skills', 'shared', 'project-assets', 'project-create-plan.md'), 'utf8');
  const stage6Start = doc.indexOf('### Stage 6 — Create Plan + Initiatives');
  const stage7Start = doc.indexOf('### Stage 7', stage6Start);
  const stage6 = doc.slice(stage6Start, stage7Start === -1 ? undefined : stage7Start);

  assert.notEqual(stage6Start, -1, 'Stage 6 section must exist');
  assert.match(stage6, /retroactiveWorktreeAdd/);
  assert.match(stage6.toLowerCase(), /(antes de escrever|capturad)/);
});
