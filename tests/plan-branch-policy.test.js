/**
 * plan-branch-policy.test.js — deterministic plan branch fork policy.
 *
 * A valid plan creation always forks its own plan branch. Invalid active-plan
 * input fails safe toward no fork.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { planBranchName, retroactiveWorktreeAdd, shouldForkPlanBranch } from '../scripts/plan-branch-policy.js';

test('solo plan creation forks a plan branch', () => {
  assert.equal(shouldForkPlanBranch([]), true);
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

test('Stage 6 documents unconditional plan branch creation', () => {
  const doc = readFileSync(join(import.meta.dirname, '..', 'skills', 'shared', 'project-assets', 'project-create-plan.md'), 'utf8');
  const stage6Start = doc.indexOf('### Stage 6 — Create Plan + Initiatives');
  const stage7Start = doc.indexOf('### Stage 7', stage6Start);
  const stage6 = doc.slice(stage6Start, stage7Start === -1 ? undefined : stage7Start);

  assert.notEqual(stage6Start, -1, 'Stage 6 section must exist');
  // discriminating: the unconditional-fork declaration absent from the old lazy doc
  // (the old Stage 6 said "só cria plan/<slug> sob concorrência" — no "forka incondicional").
  assert.match(stage6.toLowerCase(), /todo plano[^\n]*forka incondicional/,
    'Stage 6 must declare every plan forks unconditionally on creation');
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
