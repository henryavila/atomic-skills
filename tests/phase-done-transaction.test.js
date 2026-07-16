/**
 * F4/T-003 — phase-done transaction shape:
 *   - open task  → zero writes / events / commits (preflight + commit)
 *   - happy path → terminal only when every exit gate is met + review/lessons
 *     + matching HEAD fingerprint
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  preflightPhaseDone,
  commitGuardPhaseDone,
  decidePhaseDoneTerminal,
} from '../scripts/lifecycle-order-guard.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TRANSITIONS = join(ROOT, 'skills/shared/project-assets/project-transitions.md');
const FP = 'phase-done-fp-aaa';

function base(overrides = {}) {
  return {
    parentPlan: 'demo',
    phaseId: 'F1',
    phase: {
      parentPlan: 'demo',
      phaseId: 'F1',
      lessonsState: 'none',
    },
    plan: {
      phases: [
        {
          id: 'F1',
          slug: 'f1',
          status: 'active',
          dependsOn: [],
          exitGate: { summary: 's', criteria: [] },
          subPhaseCount: 0,
          goal: 'g',
          title: 'F1',
        },
      ],
    },
    tasks: [
      { id: 'T-001', status: 'done' },
      { id: 'T-002', status: 'done' },
    ],
    exitGates: [
      { id: 'G-1', status: 'met' },
      { id: 'G-2', status: 'met' },
    ],
    reviewGate: { status: 'passed', at: FP, mode: 'local' },
    lessonsState: 'none',
    fingerprint: FP,
    expectedFingerprint: FP,
    ...overrides,
  };
}

test('open task: preflight and decidePhaseDoneTerminal produce zero writes/events/commits', () => {
  const input = base({
    tasks: [
      { id: 'T-001', status: 'done' },
      { id: 'T-002', status: 'active' },
    ],
  });

  const pre = preflightPhaseDone(input);
  assert.equal(pre.blocked, true);
  assert.equal(pre.code, 'phase-done-open-task');

  for (const stage of ['preflight', 'commit']) {
    const decision = decidePhaseDoneTerminal({ ...input, stage });
    assert.equal(decision.terminal, false, `stage=${stage}`);
    assert.deepEqual(decision.writes, [], `stage=${stage}`);
    assert.deepEqual(decision.events, [], `stage=${stage}`);
    assert.deepEqual(decision.commits, [], `stage=${stage}`);
  }
});

test('happy path only when all gates are met (deferred does not count)', () => {
  const withDeferred = decidePhaseDoneTerminal(base({
    exitGates: [
      { id: 'G-1', status: 'met' },
      { id: 'G-2', status: 'deferred', deferredReason: 'later' },
    ],
  }));
  assert.equal(withDeferred.terminal, false);
  assert.equal(withDeferred.code, 'phase-done-gate-deferred');
  assert.deepEqual(withDeferred.writes, []);
  assert.deepEqual(withDeferred.events, []);

  const happy = decidePhaseDoneTerminal(base());
  assert.equal(happy.allowed, true);
  assert.equal(happy.terminal, true);
  assert.ok(happy.writes.includes('initiative:status:done'));
  assert.ok(happy.writes.includes('plan:phase:status:done'));
  assert.ok(happy.writes.includes('archive:move'));
  assert.deepEqual(happy.events, ['phase-done:F1']);
  assert.ok(happy.commits.length >= 1);
});

test('commit requires review, lessons, and current fingerprint', () => {
  assert.equal(
    commitGuardPhaseDone(base({ reviewGate: { status: 'pending' } })).code,
    'phase-done-review-open',
  );
  assert.equal(
    commitGuardPhaseDone(base({
      lessonsState: 'pending',
      phase: { parentPlan: 'demo', phaseId: 'F1', lessonsState: 'pending' },
    })).code,
    'phase-done-lessons-open',
  );
  assert.equal(
    commitGuardPhaseDone(base({ fingerprint: 'new', expectedFingerprint: 'old' })).code,
    'phase-done-fingerprint-stale',
  );
  assert.equal(
    commitGuardPhaseDone(base({ fingerprint: '', expectedFingerprint: FP })).code,
    'phase-done-fingerprint-missing',
  );
});

test('preflight allows evidence production before gates/review are complete', () => {
  const pre = preflightPhaseDone(base({
    exitGates: [{ id: 'G-1', status: 'pending' }],
    reviewGate: { status: 'pending' },
    lessonsState: undefined,
    phase: { parentPlan: 'demo', phaseId: 'F1' },
    requireFingerprint: false,
    fingerprint: undefined,
    expectedFingerprint: undefined,
  }));
  assert.equal(pre.allowed, true);
  // Commit still blocked until gates/review/lessons/fingerprint land
  assert.equal(commitGuardPhaseDone(base({
    exitGates: [{ id: 'G-1', status: 'pending' }],
  })).blocked, true);
});

test('project-transitions documents preflight, no bulk-close, no defer terminal, commit guard fingerprint', () => {
  const md = readFileSync(TRANSITIONS, 'utf8');
  const start = md.indexOf('## `phase-done`');
  assert.notEqual(start, -1);
  const next = md.indexOf('\n## ', start + 10);
  const block = md.slice(start, next === -1 ? md.length : next);

  assert.match(block, /preflightPhaseDone|Stage A — pure preflight/);
  assert.match(block, /commitGuardPhaseDone|Commit guard \(HARD/);
  assert.match(block, /fingerprint/);
  assert.match(block, /no bulk-close|Do \*\*not\*\* set open tasks to `done`/i);
  assert.match(block, /defer\/skip/i);
  assert.match(block, /terminal path/i);
  assert.doesNotMatch(
    block,
    /Set all `tasks\[\]\.status = 'done'`[\s\S]{0,80}for any task not already `done`/,
  );
  assert.doesNotMatch(
    block,
    /Defer the remaining gates and mark phase done anyway/,
  );
});
