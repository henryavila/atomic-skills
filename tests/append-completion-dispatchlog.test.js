import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendCompletion, readDispatchActuals } from '../scripts/append-completion.js';
import {
  appendDispatchLog,
  parseDispatchNdjson,
  readDispatchLog,
  validateDispatchLog,
  dispatchLogPath,
} from '../scripts/dispatch-log.js';
import { validateCompletionEvent } from '../scripts/validate-aideck-state.js';

const LOG = (root) => join(root, '.atomic-skills', 'analytics', 'completions.jsonl');

/** Seed the dispatch-log sidecar as pure NDJSON (one compact object per line). */
function seed(root, records) {
  mkdirSync(join(root, '.atomic-skills', 'status'), { recursive: true });
  writeFileSync(
    dispatchLogPath(root),
    records.map((r) => `${JSON.stringify(r)}\n`).join(''),
  );
}

const sampleRec = (overrides = {}) => ({
  taskId: 'T-002',
  plan: 's',
  phase: 'F4',
  attempt: 2,
  escalationCount: 1,
  startedAt: '2026-06-19T18:00:00Z',
  finishedAt: '2026-06-19T18:00:05Z',
  ...overrides,
});

// ── dispatch-log.js: NDJSON append / read / validate ────────────────────────

test('appendDispatchLog writes pure NDJSON and sequential appends stay valid', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-dispatch-append-'));
  try {
    appendDispatchLog(root, sampleRec({ taskId: 'T-001', attempt: 1, escalationCount: 0 }));
    appendDispatchLog(root, sampleRec({ taskId: 'T-002' }));
    appendDispatchLog(root, sampleRec({ taskId: 'T-003', attempt: 3, finishedAt: '2026-06-19T18:00:09Z' }));

    const raw = readFileSync(dispatchLogPath(root), 'utf8');
    const lines = raw.split('\n').filter((l) => l.trim());
    assert.equal(lines.length, 3);
    // Every line must be a single compact JSON object (no pretty-print / array wrapper).
    for (const line of lines) {
      assert.equal(line.startsWith('{'), true);
      assert.equal(line.endsWith('}'), true);
      assert.equal(line.includes('\n'), false);
      const obj = JSON.parse(line);
      assert.equal(typeof obj, 'object');
      assert.equal(Array.isArray(obj), false);
    }
    // Whole-file JSON.parse as array MUST fail — this is NDJSON, not a JSON array.
    assert.throws(() => JSON.parse(raw), SyntaxError);

    const records = validateDispatchLog(root);
    assert.equal(records.length, 3);
    assert.deepEqual(records.map((r) => r.taskId), ['T-001', 'T-002', 'T-003']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('parseDispatchNdjson / readDispatchLog fail closed with line number on malformed line', () => {
  assert.throws(
    () => parseDispatchNdjson('{"ok":true}\nnot-json\n{"also":true}\n'),
    /line 2/,
  );
  assert.throws(
    () => parseDispatchNdjson('{"ok":true}\n[1,2]\n'),
    /line 2.*object/,
  );

  const root = mkdtempSync(join(tmpdir(), 'as-dispatch-malformed-'));
  try {
    mkdirSync(join(root, '.atomic-skills', 'status'), { recursive: true });
    // Mixed legacy: valid NDJSON then a pretty-printed array fragment (the H6 corruption shape).
    writeFileSync(
      dispatchLogPath(root),
      `${JSON.stringify(sampleRec())}\n[\n  {"taskId":"legacy"}\n]\n`,
    );
    assert.throws(() => readDispatchLog(root), /line 2/);
    assert.throws(() => validateDispatchLog(root), /line 2/);
    // readDispatchActuals must not swallow corruption into "no actuals".
    assert.throws(
      () => readDispatchActuals(root, { planSlug: 's', phaseId: 'F4', taskId: 'T-002' }),
      /line 2/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('readDispatchLog returns [] when the file is absent (Mode-1)', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-dispatch-absent-'));
  try {
    assert.deepEqual(readDispatchLog(root), []);
    assert.deepEqual(validateDispatchLog(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── readDispatchActuals + appendCompletion integration ──────────────────────

test('readDispatchActuals returns derived actuals for a matching NDJSON record', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-dispatch-actuals-'));
  try {
    seed(root, [sampleRec()]);

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
    seed(root, [sampleRec({ phase: 'F3' })]);

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
    seed(root, [sampleRec({ startedAt: 'not-a-date', finishedAt: undefined })]);

    assert.deepEqual(
      readDispatchActuals(root, { planSlug: 's', phaseId: 'F4', taskId: 'T-002' }),
      { attempts: 2, escalations: 1 },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('readDispatchActuals uses the last matching NDJSON line for the same task', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-dispatch-last-'));
  try {
    seed(root, [
      sampleRec({ attempt: 1, escalationCount: 0, finishedAt: '2026-06-19T18:00:01Z' }),
      sampleRec({ attempt: 3, escalationCount: 2, finishedAt: '2026-06-19T18:00:10Z' }),
    ]);
    assert.deepEqual(
      readDispatchActuals(root, { planSlug: 's', phaseId: 'F4', taskId: 'T-002' }),
      { attempts: 3, escalations: 2, durationMs: 10000 },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('appendCompletion writes a validating task-done line with dispatch actuals', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-dispatch-integration-'));
  try {
    seed(root, [sampleRec()]);

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

test('appendCompletion auto-derives dispatch actuals on a task-done with no explicit actuals (programmatic path)', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-dispatch-autoderive-'));
  try {
    seed(root, [sampleRec()]);
    // No `actuals` passed — the direct programmatic path must still capture them.
    const rec = appendCompletion(root, {
      event: 'task-done', projectId: 'p', planSlug: 's', phaseId: 'F4', taskId: 'T-002',
    });
    assert.deepEqual(rec.actuals, { attempts: 2, escalations: 1, durationMs: 5000 });
    assert.equal(validateCompletionEvent(rec).ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('appendCompletion does not override explicit actuals on a task-done', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-dispatch-explicit-'));
  try {
    seed(root, [sampleRec({ attempt: 9, escalationCount: 9, finishedAt: '2026-06-19T18:00:09Z' })]);
    const rec = appendCompletion(root, {
      event: 'task-done', projectId: 'p', planSlug: 's', phaseId: 'F4', taskId: 'T-002',
      actuals: { attempts: 1 },
    });
    assert.deepEqual(rec.actuals, { attempts: 1 }); // explicit wins; no auto-derive
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('appendCompletion remains compatible when dispatch-log is pure NDJSON from appendDispatchLog', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-dispatch-compat-'));
  try {
    appendDispatchLog(root, sampleRec());
    const rec = appendCompletion(root, {
      event: 'task-done', projectId: 'p', planSlug: 's', phaseId: 'F4', taskId: 'T-002',
    });
    assert.deepEqual(rec.actuals, { attempts: 2, escalations: 1, durationMs: 5000 });
    assert.equal(rec.appended, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
