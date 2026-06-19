import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendCompletion, readDispatchActuals } from '../scripts/append-completion.js';
import { validateCompletionEvent } from '../scripts/validate-aideck-state.js';

const LOG = (root) => join(root, '.atomic-skills', 'analytics', 'completions.jsonl');

function seed(root, records) {
  mkdirSync(join(root, '.atomic-skills', 'status'), { recursive: true });
  writeFileSync(
    join(root, '.atomic-skills', 'status', 'dispatch-log.json'),
    JSON.stringify(records, null, 2),
  );
}

test('readDispatchActuals returns derived actuals for a matching record', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-dispatch-actuals-'));
  try {
    seed(root, [{
      taskId: 'T-002',
      plan: 's',
      phase: 'F4',
      attempt: 2,
      escalationCount: 1,
      startedAt: '2026-06-19T18:00:00Z',
      finishedAt: '2026-06-19T18:00:05Z',
    }]);

    const a = readDispatchActuals(root, { planSlug: 's', phaseId: 'F4', taskId: 'T-002' });
    assert.deepEqual(a, { attempts: 2, escalations: 1, durationMs: 5000 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('readDispatchActuals returns undefined when dispatch-log is absent', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-dispatch-missing-'));
  try {
    assert.equal(
      readDispatchActuals(root, { planSlug: 's', phaseId: 'F4', taskId: 'T-002' }),
      undefined,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('readDispatchActuals matches plan phase and taskId, not taskId alone', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-dispatch-nomatch-'));
  try {
    seed(root, [{
      taskId: 'T-002',
      plan: 's',
      phase: 'F3',
      attempt: 2,
      escalationCount: 1,
      startedAt: '2026-06-19T18:00:00Z',
      finishedAt: '2026-06-19T18:00:05Z',
    }]);

    assert.equal(
      readDispatchActuals(root, { planSlug: 's', phaseId: 'F4', taskId: 'T-002' }),
      undefined,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('readDispatchActuals omits durationMs when timestamps are missing or unparseable', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-dispatch-badtime-'));
  try {
    seed(root, [{
      taskId: 'T-002',
      plan: 's',
      phase: 'F4',
      attempt: 1,
      escalationCount: 0,
      startedAt: 'not-a-date',
    }]);

    assert.deepEqual(
      readDispatchActuals(root, { planSlug: 's', phaseId: 'F4', taskId: 'T-002' }),
      { attempts: 1, escalations: 0 },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('appendCompletion writes a validating task-done line with dispatch actuals', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-dispatch-integration-'));
  try {
    seed(root, [{
      taskId: 'T-002',
      plan: 's',
      phase: 'F4',
      attempt: 2,
      escalationCount: 1,
      startedAt: '2026-06-19T18:00:00Z',
      finishedAt: '2026-06-19T18:00:05Z',
    }]);

    const a = readDispatchActuals(root, { planSlug: 's', phaseId: 'F4', taskId: 'T-002' });
    const rec = appendCompletion(root, {
      event: 'task-done',
      projectId: 'p',
      planSlug: 's',
      phaseId: 'F4',
      taskId: 'T-002',
      actuals: a,
    });

    assert.deepEqual(rec.actuals, { attempts: 2, escalations: 1, durationMs: 5000 });
    assert.equal(validateCompletionEvent(rec).ok, true);

    const parsed = JSON.parse(readFileSync(LOG(root), 'utf8').trim());
    assert.equal(validateCompletionEvent(parsed).ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('appendCompletion omits actuals for Mode-1 task-done events without dispatch-log', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-dispatch-mode1-'));
  try {
    const rec = appendCompletion(root, {
      event: 'task-done',
      projectId: 'p',
      planSlug: 's',
      phaseId: 'F4',
      taskId: 'T-002',
      actuals: readDispatchActuals(root, { planSlug: 's', phaseId: 'F4', taskId: 'T-002' }),
    });

    assert.equal('actuals' in rec, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
