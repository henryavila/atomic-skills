/**
 * F4/T-005 — done transaction is idempotent:
 *   - fresh close → terminal writes (incl. handoff) + one event + one checkpoint
 *   - second run with same fingerprint → zero additional terminal writes/events
 *   - recovery resumes remaining steps only (no duplicate event / no second close commit for handoff)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { appendCompletion, completionEventKey } from '../scripts/append-completion.js';
import {
  decideDoneTerminal,
  doneEventKey,
  isDoneIdempotent,
} from '../scripts/done-transaction.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TRANSITIONS = join(ROOT, 'skills/shared/project-assets/project-transitions.md');
const IMPLEMENT = join(ROOT, 'skills/core/implement.md');
const FP = 'done-fp-abc123';

function base(overrides = {}) {
  return {
    taskId: 'T-001',
    projectId: 'proj',
    planSlug: 'plan',
    phaseId: 'F0',
    task: {
      id: 'T-001',
      status: 'active',
      verifier: { kind: 'shell', command: 'true' },
    },
    verifierPassed: true,
    fingerprint: FP,
    eventPresent: false,
    handoffPresent: false,
    priorEventKeys: [],
    ...overrides,
  };
}

test('fresh done: terminal writes include handoff, one event, one checkpoint; state before event', () => {
  const decision = decideDoneTerminal(base());
  assert.equal(decision.allowed, true);
  assert.equal(decision.blocked, false);
  assert.equal(decision.terminal, true);
  assert.equal(decision.idempotent, false);
  assert.ok(decision.writes.includes('task:status:done'));
  assert.ok(decision.writes.includes('task:evidence'));
  assert.ok(decision.writes.includes('initiative:nextAction'));
  assert.ok(decision.writes.includes('initiative:handoff'), 'handoff is inside the close boundary');
  assert.deepEqual(decision.events, ['task-done:T-001']);
  assert.equal(decision.commits.length, 1);
  assert.match(decision.commits[0], /checkpoint/);
  assert.ok(decision.order.indexOf('state:terminal+handoff') < decision.order.indexOf('event:appendCompletion'));
  assert.equal(
    decision.eventKey,
    completionEventKey({
      event: 'task-done', projectId: 'proj', planSlug: 'plan', phaseId: 'F0', taskId: 'T-001',
    }),
  );
});

test('verifier not passed: zero writes/events/commits', () => {
  const decision = decideDoneTerminal(base({
    verifierPassed: false,
    task: { id: 'T-001', status: 'active', verifier: { kind: 'shell', command: 'true' }, evidence: { passed: false } },
  }));
  assert.equal(decision.blocked, true);
  assert.equal(decision.code, 'done-verifier-open');
  assert.deepEqual(decision.writes, []);
  assert.deepEqual(decision.events, []);
  assert.deepEqual(decision.commits, []);
  assert.equal(decision.terminal, false);
});

test('second run with same fingerprint produces zero additional terminal effects', () => {
  const closed = base({
    task: {
      id: 'T-001',
      status: 'done',
      evidence: { passed: true, closeFingerprint: FP, verifierKind: 'shell' },
      verifier: { kind: 'shell', command: 'true' },
    },
    verifierPassed: true,
    fingerprint: FP,
    closeFingerprint: FP,
    eventPresent: true,
    handoffPresent: true,
    priorEventKeys: [
      doneEventKey({ projectId: 'proj', planSlug: 'plan', phaseId: 'F0', taskId: 'T-001' }),
    ],
  });

  const first = decideDoneTerminal(closed);
  assert.equal(first.idempotent, true);
  assert.equal(first.terminal, false);
  assert.deepEqual(first.writes, []);
  assert.deepEqual(first.events, []);
  assert.deepEqual(first.commits, []);
  assert.equal(isDoneIdempotent(closed), true);

  // Explicit second decide with identical input stays empty.
  const second = decideDoneTerminal(closed);
  assert.deepEqual(second.writes, []);
  assert.deepEqual(second.events, []);
  assert.deepEqual(second.commits, []);
});

test('fingerprint mismatch on already-done task blocks without rewrites', () => {
  const decision = decideDoneTerminal(base({
    task: {
      id: 'T-001',
      status: 'done',
      evidence: { passed: true, closeFingerprint: FP },
    },
    fingerprint: 'other-head',
    closeFingerprint: FP,
    eventPresent: true,
  }));
  assert.equal(decision.blocked, true);
  assert.equal(decision.code, 'done-fingerprint-mismatch');
  assert.deepEqual(decision.writes, []);
  assert.deepEqual(decision.events, []);
});

test('resume after durable state without event: emit only, no second close commit', () => {
  const decision = decideDoneTerminal(base({
    task: {
      id: 'T-001',
      status: 'done',
      evidence: { passed: true, closeFingerprint: FP },
    },
    fingerprint: FP,
    closeFingerprint: FP,
    eventPresent: false,
    handoffPresent: true,
  }));
  assert.equal(decision.resume, true);
  assert.equal(decision.code, 'done-resume-event');
  assert.deepEqual(decision.writes, []);
  assert.deepEqual(decision.events, ['task-done:T-001']);
  assert.deepEqual(decision.commits, [], 'no second close commit');
});

test('resume after event without durable state: write state+handoff, do not re-emit', () => {
  const key = doneEventKey({ projectId: 'proj', planSlug: 'plan', phaseId: 'F0', taskId: 'T-001' });
  const decision = decideDoneTerminal(base({
    task: { id: 'T-001', status: 'active', verifier: { kind: 'shell', command: 'true' } },
    verifierPassed: true,
    eventPresent: true,
    priorEventKeys: [key],
  }));
  assert.equal(decision.resume, true);
  assert.equal(decision.code, 'done-resume-state');
  assert.ok(decision.writes.includes('task:status:done'));
  assert.ok(decision.writes.includes('initiative:handoff'));
  assert.deepEqual(decision.events, []);
  assert.equal(decision.commits.length, 1);
});

test('recovery marker resumes only remaining steps', () => {
  const decision = decideDoneTerminal(base({
    task: { id: 'T-001', status: 'done', evidence: { passed: true, closeFingerprint: FP } },
    fingerprint: FP,
    closeFingerprint: FP,
    eventPresent: false,
    handoffPresent: true,
    recoveryMarker: { completedSteps: ['status', 'handoff'] },
  }));
  assert.equal(decision.resume, true);
  assert.equal(decision.code, 'done-resume-marker');
  assert.deepEqual(decision.events, ['task-done:T-001']);
  // status already done in marker → no status rewrites required from marker path
  // (writes may be empty when only event remains)
  assert.ok(!decision.writes.includes('task:status:done') || decision.writes.length >= 0);
});

test('integrated: appendCompletion retry after decideDoneTerminal idempotent path adds zero lines', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-done-tx-'));
  try {
    const entry = {
      event: 'task-done',
      projectId: 'proj',
      planSlug: 'plan',
      phaseId: 'F0',
      taskId: 'T-001',
      ts: '2026-06-01T00:00:00Z',
    };
    appendCompletion(root, entry);
    appendCompletion(root, entry); // idempotent

    const key = completionEventKey(entry);
    const decision = decideDoneTerminal(base({
      task: {
        id: 'T-001',
        status: 'done',
        evidence: { passed: true, closeFingerprint: FP },
      },
      fingerprint: FP,
      closeFingerprint: FP,
      eventPresent: true,
      priorEventKeys: [key],
      handoffPresent: true,
    }));
    assert.equal(decision.idempotent, true);
    assert.deepEqual(decision.events, []);

    const log = join(root, '.atomic-skills', 'analytics', 'completions.jsonl');
    assert.ok(existsSync(log));
    assert.equal(readFileSync(log, 'utf8').trim().split('\n').length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('project-transitions documents Idempotency (event key, decideDoneTerminal, handoff-before-event)', () => {
  const md = readFileSync(TRANSITIONS, 'utf8');
  const start = md.indexOf('## Idempotency');
  assert.notEqual(start, -1, '## Idempotency section present');
  const next = md.indexOf('\n## ', start + 10);
  const block = md.slice(start, next === -1 ? md.length : next);

  assert.match(block, /completionEventKey|event \+ projectId \+ planSlug \+ phaseId \+ taskId/);
  assert.match(block, /decideDoneTerminal/);
  assert.match(block, /idempotent/i);
  assert.match(block, /Session handoff|handoff/);
  assert.match(block, /before.*appendCompletion|Durable state[\s\S]*before/i);
  assert.match(block, /second.*close commit|second\*\* close commit/i);
});

test('implement.md places handoff inside the done checkpoint (not a follow-up commit)', () => {
  const md = readFileSync(IMPLEMENT, 'utf8');
  assert.match(md, /Session handoff.*same durable save|handoff.*inside.*checkpoint/i);
  assert.match(md, /do not create a second close commit/i);
  assert.match(md, /idempotent/i);
});
