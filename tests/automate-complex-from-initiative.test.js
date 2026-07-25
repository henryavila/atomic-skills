import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildComplexTasksFromInitiative,
  claimTaskIdsFromReport,
  receiptForTask,
} from '../src/automate-complex-from-initiative.js';

describe('claimTaskIdsFromReport', () => {
  it('extracts task ids from envelope', () => {
    assert.deepEqual(
      claimTaskIdsFromReport({
        tasks: [{ taskId: 'T-001' }, { taskId: 'T-002' }],
      }),
      ['T-001', 'T-002'],
    );
  });
});

describe('buildComplexTasksFromInitiative', () => {
  it('skips non-complex tasks', () => {
    const rows = buildComplexTasksFromInitiative({
      tasks: [
        { id: 'T-001', weight: 1 },
        { id: 'T-002', weight: 5 },
      ],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].taskId, 'T-002');
    assert.equal(rows[0].reviewReceipt, null);
  });

  it('attaches receipt from map', () => {
    const rows = buildComplexTasksFromInitiative({
      tasks: [{ id: 'T-009', tags: ['complex'] }],
      receiptsByTaskId: {
        'T-009': { mode: 'both', reviewFile: 'r.md' },
      },
    });
    assert.equal(rows[0].reviewReceipt?.mode, 'both');
  });

  it('filters by claimTaskIds', () => {
    const rows = buildComplexTasksFromInitiative({
      tasks: [
        { id: 'T-001', weight: 9 },
        { id: 'T-002', weight: 9 },
      ],
      claimTaskIds: ['T-002'],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].taskId, 'T-002');
  });
});

describe('receiptForTask', () => {
  it('prefers map over task fields', () => {
    const r = receiptForTask(
      { id: 'T-1', reviewReceipt: { mode: 'local' } },
      { 'T-1': { mode: 'both' } },
    );
    assert.equal(r?.mode, 'both');
  });
});
