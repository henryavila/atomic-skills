/**
 * F4/T-003 + F4/T-004 — phase-done transaction shape:
 *   - open task  → zero writes / events / commits (preflight + commit)
 *   - happy path → terminal only when every exit gate is met + review/lessons
 *     + matching HEAD fingerprint / evidence.verifiedCommit
 *   - review that mutates HEAD invalidates prior gate evidence (must re-run
 *     verifiers before commit guard accepts)
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
const VERIFIER_EXEC = join(ROOT, 'skills/shared/project-assets/verifier-exec.md');
/** Real hex SHAs (not labels) — F4/T-004. */
const FP = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const FP_POST_REVIEW = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const TS = '2026-07-16T12:00:00Z';

function evidenceAt(sha) {
  return {
    verifierKind: 'shell',
    verifiedAt: TS,
    passed: true,
    exitCode: 0,
    verifiedCommit: sha,
    outputSummary: 'ok',
  };
}

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
      { id: 'G-1', status: 'met', evidence: evidenceAt(FP) },
      { id: 'G-2', status: 'met', evidence: evidenceAt(FP) },
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
      { id: 'G-1', status: 'met', evidence: evidenceAt(FP) },
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
    commitGuardPhaseDone(base({ fingerprint: FP_POST_REVIEW, expectedFingerprint: FP })).code,
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

test('review that mutates HEAD invalidates prior gate evidence before commit guard', () => {
  // Stage B produced evidence at FP. Stage C review applied fixes → HEAD is FP_POST_REVIEW.
  // Prior verifiedCommit must not close; commit guard blocks until verifiers re-run.
  const staleAfterReview = commitGuardPhaseDone(base({
    fingerprint: FP_POST_REVIEW,
    expectedFingerprint: FP_POST_REVIEW, // even if the caller lies about the expected match…
    exitGates: [
      { id: 'G-1', status: 'met', evidence: evidenceAt(FP) }, // still anchored to pre-review HEAD
      { id: 'G-2', status: 'met', evidence: evidenceAt(FP) },
    ],
    reviewGate: {
      status: 'passed',
      at: FP_POST_REVIEW,
      mode: 'local',
      reviewFile: '.atomic-skills/reviews/demo-f1-local.md',
    },
  }));
  assert.equal(staleAfterReview.blocked, true);
  assert.equal(staleAfterReview.code, 'phase-done-fingerprint-stale');
  assert.match(staleAfterReview.reason, /verifiedCommit|invalidate/i);
  assert.match(staleAfterReview.recommendedCommand, /Re-run exit-gate verifiers/i);

  // After re-running verifiers against post-review HEAD, evidence carries new verifiedCommit.
  const reVerified = commitGuardPhaseDone(base({
    fingerprint: FP_POST_REVIEW,
    expectedFingerprint: FP_POST_REVIEW,
    exitGates: [
      { id: 'G-1', status: 'met', evidence: evidenceAt(FP_POST_REVIEW) },
      { id: 'G-2', status: 'met', evidence: evidenceAt(FP_POST_REVIEW) },
    ],
    reviewGate: {
      status: 'passed',
      at: FP_POST_REVIEW,
      mode: 'local',
      reviewFile: '.atomic-skills/reviews/demo-f1-local.md',
    },
  }));
  assert.equal(reVerified.allowed, true);
  assert.equal(reVerified.blocked, false);

  // Terminal decision also stays empty while evidence is pre-review.
  const terminalStale = decidePhaseDoneTerminal(base({
    fingerprint: FP_POST_REVIEW,
    expectedFingerprint: FP_POST_REVIEW,
    exitGates: [
      { id: 'G-1', status: 'met', evidence: evidenceAt(FP) },
      { id: 'G-2', status: 'met', evidence: evidenceAt(FP) },
    ],
    reviewGate: { status: 'passed', at: FP_POST_REVIEW, mode: 'local' },
  }));
  assert.equal(terminalStale.terminal, false);
  assert.deepEqual(terminalStale.writes, []);
  assert.deepEqual(terminalStale.events, []);
  assert.deepEqual(terminalStale.commits, []);
});

test('reviewGate.at lagging HEAD is rejected as review-stale', () => {
  const result = commitGuardPhaseDone(base({
    fingerprint: FP_POST_REVIEW,
    expectedFingerprint: FP_POST_REVIEW,
    exitGates: [
      { id: 'G-1', status: 'met', evidence: evidenceAt(FP_POST_REVIEW) },
      { id: 'G-2', status: 'met', evidence: evidenceAt(FP_POST_REVIEW) },
    ],
    reviewGate: { status: 'passed', at: FP, mode: 'local' }, // review stamped before re-fix HEAD
  }));
  assert.equal(result.blocked, true);
  assert.equal(result.code, 'phase-done-review-stale');
});

test('evidence.verifiedCommit alone anchors the commit guard (no explicit expectedFingerprint)', () => {
  const result = commitGuardPhaseDone(base({
    expectedFingerprint: undefined,
    exitGates: [
      { id: 'G-1', status: 'met', evidence: evidenceAt(FP) },
      { id: 'G-2', status: 'met', evidence: evidenceAt(FP) },
    ],
  }));
  assert.equal(result.allowed, true);
});

test('project-transitions documents preflight, verifiedCommit, HEAD invalidation, commit guard', () => {
  const md = readFileSync(TRANSITIONS, 'utf8');
  const start = md.indexOf('## `phase-done`');
  assert.notEqual(start, -1);
  const next = md.indexOf('\n## ', start + 10);
  const block = md.slice(start, next === -1 ? md.length : next);

  assert.match(block, /preflightPhaseDone|Stage A — pure preflight/);
  assert.match(block, /commitGuardPhaseDone|Commit guard \(HARD/);
  assert.match(block, /fingerprint/);
  assert.match(block, /verifiedCommit/);
  assert.match(block, /no bulk-close|Do \*\*not\*\* set open tasks to `done`/i);
  assert.match(block, /defer\/skip/i);
  assert.match(block, /terminal path/i);
  assert.match(block, /invalidat|stale evidence|Re-run exit-gate verifiers against the new HEAD/i);
  assert.doesNotMatch(
    block,
    /Set all `tasks\[\]\.status = 'done'`[\s\S]{0,80}for any task not already `done`/,
  );
  assert.doesNotMatch(
    block,
    /Defer the remaining gates and mark phase done anyway/,
  );
});

test('verifier-exec documents verifiedCommit HEAD anchor', () => {
  const md = readFileSync(VERIFIER_EXEC, 'utf8');
  assert.match(md, /verifiedCommit/);
  assert.match(md, /git rev-parse HEAD/);
  assert.match(md, /HEAD change|stale|re-run/i);
});
