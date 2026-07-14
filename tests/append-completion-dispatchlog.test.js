import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendCompletion, readDispatchActuals } from '../scripts/append-completion.js';
import { appendDispatchRecord, parseDispatchLog } from '../scripts/dispatch-log.js';
import { validateCompletionEvent } from '../scripts/validate-aideck-state.js';

const LOG = (root) => join(root, '.atomic-skills', 'analytics', 'completions.jsonl');

function seed(root, records) {
  mkdirSync(join(root, '.atomic-skills', 'status'), { recursive: true });
  writeFileSync(
    join(root, '.atomic-skills', 'status', 'dispatch-log.json'),
    `${records.map((record) => JSON.stringify(record)).join('\n')}\n`,
  );
}

function seedRaw(root, raw) {
  mkdirSync(join(root, '.atomic-skills', 'status'), { recursive: true });
  writeFileSync(join(root, '.atomic-skills', 'status', 'dispatch-log.json'), raw);
}

test('canonical dispatch writer appends one validated compact NDJSON record per line', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-dispatch-writer-'));
  try {
    const first = { taskId: 'T-001', plan: 's', phase: 'F4', attempt: 1 };
    const second = { taskId: 'T-002', plan: 's', phase: 'F4', attempt: 2 };
    appendDispatchRecord(root, first);
    appendDispatchRecord(root, second);
    const raw = readFileSync(join(root, '.atomic-skills/status/dispatch-log.json'), 'utf8');
    assert.equal(raw, `${JSON.stringify(first)}\n${JSON.stringify(second)}\n`);
    assert.deepEqual(parseDispatchLog(raw), [first, second]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('canonical dispatch writer validates before creating or appending the ledger', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-dispatch-writer-invalid-'));
  try {
    assert.throws(
      () => appendDispatchRecord(root, { taskId: 'T-001', plan: 's' }),
      /requires non-empty taskId, plan, and phase/,
    );
    assert.throws(
      () => appendDispatchRecord(root, [{ taskId: 'T-001', plan: 's', phase: 'F4' }]),
      /must be a JSON object/,
    );
    const path = join(root, '.atomic-skills/status/dispatch-log.json');
    assert.throws(() => readFileSync(path), /ENOENT/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

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

test('readDispatchActuals selects the newest matching attempt regardless of union-merge line order', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-dispatch-union-order-'));
  try {
    seed(root, [
      {
        taskId: 'T-002', plan: 's', phase: 'F4', attempt: 2, escalationCount: 1,
        startedAt: '2026-06-19T18:01:00Z', finishedAt: '2026-06-19T18:01:07Z',
      },
      {
        taskId: 'T-002', plan: 's', phase: 'F4', attempt: 1, escalationCount: 0,
        startedAt: '2026-06-19T18:00:00Z', finishedAt: '2026-06-19T18:00:05Z',
      },
    ]);

    assert.deepEqual(
      readDispatchActuals(root, { planSlug: 's', phaseId: 'F4', taskId: 'T-002' }),
      { attempts: 2, escalations: 1, durationMs: 7000 },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('readDispatchActuals resolves equal-time equal-attempt records identically in either order', () => {
  const records = [
    {
      taskId: 'T-002', plan: 's', phase: 'F4', attempt: 2, escalationCount: 1,
      startedAt: '2026-06-19T18:00:00Z', finishedAt: '2026-06-19T18:01:00Z',
    },
    {
      taskId: 'T-002', plan: 's', phase: 'F4', attempt: 2, escalationCount: 2,
      startedAt: '2026-06-19T18:00:30Z', finishedAt: '2026-06-19T18:01:00Z',
    },
  ];
  const actuals = [];
  for (const ordered of [records, [...records].reverse()]) {
    const root = mkdtempSync(join(tmpdir(), 'as-dispatch-total-order-'));
    try {
      seed(root, ordered);
      actuals.push(readDispatchActuals(
        root,
        { planSlug: 's', phaseId: 'F4', taskId: 'T-002' },
      ));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  assert.deepEqual(actuals[0], { attempts: 2, escalations: 2, durationMs: 30000 });
  assert.deepEqual(actuals[1], actuals[0]);
});

test('readDispatchActuals prefers a valid finish over a same-time startedAt fallback', () => {
  const records = [
    {
      taskId: 'T-002', plan: 's', phase: 'F4', attempt: 2, escalationCount: 1,
      startedAt: '2026-06-19T18:01:00Z', finishedAt: 'invalid',
    },
    {
      taskId: 'T-002', plan: 's', phase: 'F4', attempt: 2, escalationCount: 1,
      startedAt: '2026-06-19T18:01:00Z', finishedAt: '2026-06-19T18:01:00Z',
    },
  ];
  const actuals = [];
  for (const ordered of [records, [...records].reverse()]) {
    const root = mkdtempSync(join(tmpdir(), 'as-dispatch-finish-quality-'));
    try {
      seed(root, ordered);
      actuals.push(readDispatchActuals(
        root,
        { planSlug: 's', phaseId: 'F4', taskId: 'T-002' },
      ));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  assert.deepEqual(actuals[0], { attempts: 2, escalations: 1, durationMs: 0 });
  assert.deepEqual(actuals[1], actuals[0]);
});

test('readDispatchActuals remains backward-compatible with a legacy JSON array', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-dispatch-legacy-array-'));
  try {
    const record = {
      taskId: 'T-002', plan: 's', phase: 'F4', attempt: 2, escalationCount: 1,
      startedAt: '2026-06-19T18:00:00Z', finishedAt: '2026-06-19T18:00:05Z',
    };
    seedRaw(root, JSON.stringify([record], null, 2));

    assert.deepEqual(
      readDispatchActuals(root, { planSlug: 's', phaseId: 'F4', taskId: 'T-002' }),
      { attempts: 2, escalations: 1, durationMs: 5000 },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('appendCompletion still emits when a pretty legacy record contains a nested array', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-dispatch-legacy-nested-'));
  try {
    // Routing fields mirror records sampled from the tracked dispatch ledger;
    // metadata is an additive forward-compatible field carrying the regression.
    const record = {
      taskId: 'T-002', plan: 's', phase: 'F4', attempt: 2, escalationCount: 1,
      startedAt: '2026-06-19T18:00:00Z', finishedAt: '2026-06-19T18:00:05Z',
      metadata: { checks: ['unit', 'integration'] },
    };
    seedRaw(root, JSON.stringify([record], null, 2));

    const completion = appendCompletion(root, {
      event: 'task-done', projectId: 'proj', planSlug: 's', phaseId: 'F4', taskId: 'T-002',
    });

    // Mutation guard: stopping at the first isolated `]` makes appendCompletion
    // throw before this observable event and its derived actuals exist.
    assert.deepEqual(completion.actuals, { attempts: 2, escalations: 1, durationMs: 5000 });
    const persisted = readFileSync(LOG(root), 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(persisted.length, 1);
    assert.deepEqual(persisted[0], completion);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('parseDispatchLog preserves a CRLF hybrid with nested objects, arrays, strings, and escapes', () => {
  const prefix = { taskId: 'T-001', plan: 's', phase: 'F4' };
  const legacy = {
    taskId: 'T-002', plan: 's', phase: 'F4',
    metadata: {
      checks: [{ label: 'literal ] plus "quote" and \\ path' }],
    },
  };
  const suffix = { taskId: 'T-003', plan: 's', phase: 'F4' };
  const raw = `${JSON.stringify(prefix)}\n${JSON.stringify([legacy], null, 2)}\n${JSON.stringify(suffix)}\n`
    .replace(/\n/g, '\r\n');

  const parsed = parseDispatchLog(raw, { source: 'hybrid.json' });

  // Mutation guard: ignoring nested depth, quoted `]`, escapes, or CRLF breaks
  // either record order or the exact nested payload below.
  assert.deepEqual(parsed.map((record) => record.taskId), ['T-001', 'T-002', 'T-003']);
  assert.deepEqual(parsed[1].metadata, legacy.metadata);
});

test('parseDispatchLog keeps empty, inline-array, and NDJSON boundaries compatible', () => {
  const record = {
    taskId: 'T-002', plan: 's', phase: 'F4', metadata: { checks: ['inline'] },
  };

  // Mutation guard: restricting the structural scanner to pretty multiline
  // arrays makes at least one of these established input partitions fail.
  assert.deepEqual(parseDispatchLog('[]\r\n'), []);
  assert.deepEqual(parseDispatchLog(`${JSON.stringify([record])}\r\n`), [record]);
  assert.deepEqual(parseDispatchLog(`${JSON.stringify(record)}\r\n`), [record]);
});

test('parseDispatchLog reports an unterminated root after a complete nested array', () => {
  const raw = [
    '[',
    '  {',
    '    "taskId": "T-002",',
    '    "plan": "s",',
    '    "phase": "F4",',
    '    "metadata": {',
    '      "checks": [',
    '        "unit"',
    '      ]',
    '    }',
    '  }',
  ].join('\r\n');

  // Mutation guard: treating the nested close as the root close changes this
  // stable root-level EOF error into a truncated JSON.parse error.
  assert.throws(
    () => parseDispatchLog(raw, { source: 'unterminated.json' }),
    /unterminated\.json:1: invalid JSON: unterminated legacy array/,
  );
});

test('readDispatchActuals recovers all segments of the repository-shaped hybrid log', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-dispatch-hybrid-'));
  try {
    // Mirrors the live pre-migration shape: NDJSON prefix, pretty JSON array,
    // then a final NDJSON append. The records are sampled from the tracked log.
    const prefix = {
      taskId: 'T1.1', plan: 'plan-dependencies', phase: 'F1', attempt: 1,
      escalationCount: 0, startedAt: '2026-06-25T19:42:53Z', finishedAt: '2026-06-25T19:49:24Z',
    };
    const legacy = {
      taskId: 'T-002', plan: 'deadline-burnup-forecast', phase: 'F4', attempt: 1,
      escalationCount: 0, startedAt: '2026-06-19T18:53:00Z', finishedAt: '2026-06-19T18:57:30Z',
    };
    const suffix = {
      taskId: 'T-005', plan: 'integrity-remediation', phase: 'F0', attempt: 1,
      escalationCount: 0, startedAt: '2026-07-12T03:09:55Z', finishedAt: '2026-07-12T03:40:43Z',
    };
    seedRaw(root, `${JSON.stringify(prefix)}\n${JSON.stringify([legacy], null, 2)}\n${JSON.stringify(suffix)}\n`);

    assert.deepEqual(
      readDispatchActuals(root, { planSlug: 'plan-dependencies', phaseId: 'F1', taskId: 'T1.1' }),
      { attempts: 1, escalations: 0, durationMs: 391000 },
    );
    assert.deepEqual(
      readDispatchActuals(root, { planSlug: 'deadline-burnup-forecast', phaseId: 'F4', taskId: 'T-002' }),
      { attempts: 1, escalations: 0, durationMs: 270000 },
    );
    assert.deepEqual(
      readDispatchActuals(root, { planSlug: 'integrity-remediation', phaseId: 'F0', taskId: 'T-005' }),
      { attempts: 1, escalations: 0, durationMs: 1848000 },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('readDispatchActuals fails closed with the physical line number for malformed input', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-dispatch-malformed-'));
  try {
    seedRaw(root, [
      JSON.stringify({ taskId: 'T-001', plan: 's', phase: 'F4' }),
      '{"taskId":"T-002",BROKEN}',
      JSON.stringify({ taskId: 'T-003', plan: 's', phase: 'F4' }),
      '',
    ].join('\n'));

    assert.throws(
      () => readDispatchActuals(root, { planSlug: 's', phaseId: 'F4', taskId: 'T-003' }),
      /dispatch-log\.json:2: invalid JSON/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('readDispatchActuals rejects a well-formed legacy array containing a non-object record', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-dispatch-invalid-record-'));
  try {
    seedRaw(root, JSON.stringify([[{ taskId: 'T-002', plan: 's', phase: 'F4' }]]));

    assert.throws(
      () => readDispatchActuals(root, { planSlug: 's', phaseId: 'F4', taskId: 'T-002' }),
      /dispatch-log\.json:1: dispatch record must be a JSON object/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('readDispatchActuals rejects object records without their routing identity', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-dispatch-missing-identity-'));
  try {
    seedRaw(root, [
      JSON.stringify({ taskId: 'T-001', plan: 's', phase: 'F4' }),
      JSON.stringify({}),
      '',
    ].join('\n'));

    assert.throws(
      () => readDispatchActuals(root, { planSlug: 's', phaseId: 'F4', taskId: 'T-001' }),
      /dispatch-log\.json:2: dispatch record requires non-empty taskId, plan, and phase/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('dispatch identity validation independently requires every non-empty routing key', () => {
  for (const field of ['taskId', 'plan', 'phase']) {
    for (const invalid of [undefined, '   ']) {
      const root = mkdtempSync(join(tmpdir(), `as-dispatch-invalid-${field}-`));
      try {
        const record = { taskId: 'T-001', plan: 's', phase: 'F4' };
        if (invalid === undefined) delete record[field];
        else record[field] = invalid;
        seedRaw(root, `${JSON.stringify(record)}\n`);
        assert.throws(
          () => readDispatchActuals(root, { planSlug: 's', phaseId: 'F4', taskId: 'T-001' }),
          /dispatch record requires non-empty taskId, plan, and phase/,
          `${field}=${JSON.stringify(invalid)} must fail closed`,
        );
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
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

test('appendCompletion auto-derives dispatch actuals on a task-done with no explicit actuals (programmatic path)', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-dispatch-autoderive-'));
  try {
    seed(root, [{
      taskId: 'T-002', plan: 's', phase: 'F4', attempt: 2, escalationCount: 1,
      startedAt: '2026-06-19T18:00:00Z', finishedAt: '2026-06-19T18:00:05Z',
    }]);
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
    seed(root, [{
      taskId: 'T-002', plan: 's', phase: 'F4', attempt: 9, escalationCount: 9,
      startedAt: '2026-06-19T18:00:00Z', finishedAt: '2026-06-19T18:00:09Z',
    }]);
    const rec = appendCompletion(root, {
      event: 'task-done', projectId: 'p', planSlug: 's', phaseId: 'F4', taskId: 'T-002',
      actuals: { attempts: 1 },
    });
    assert.deepEqual(rec.actuals, { attempts: 1 }); // explicit wins; no auto-derive
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
