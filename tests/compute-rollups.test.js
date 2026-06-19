import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rollupsFor, computeRollupsFile } from '../scripts/compute-rollups.js';

describe('rollupsFor', () => {
  it('sums task weights, defaulting missing weight to 1 and preserving weight: 0', () => {
    const rollups = rollupsFor({
      tasks: [
        { id: 'T-1', status: 'done', weight: 2 },
        { id: 'T-2', status: 'pending', weight: 3 },
        { id: 'T-3', status: 'done' },
        { id: 'T-4', status: 'done', weight: 0 },
      ],
      exitGates: [],
    });

    assert.equal(rollups.tasksDone, 3);
    assert.equal(rollups.tasksTotal, 4);
    assert.equal(rollups.weightDone, 3);
    assert.equal(rollups.weightTotal, 6);
  });

  it('degrades to count rollups when no task carries weight', () => {
    const rollups = rollupsFor({
      tasks: [
        { id: 'T-1', status: 'done' },
        { id: 'T-2', status: 'pending' },
        { id: 'T-3', status: 'done' },
      ],
      exitGates: [],
    });

    assert.equal(rollups.tasksDone, 2);
    assert.equal(rollups.tasksTotal, 3);
    assert.equal(rollups.weightDone, rollups.tasksDone);
    assert.equal(rollups.weightTotal, rollups.tasksTotal);
  });
});

describe('computeRollupsFile', () => {
  it('is idempotent after writing weighted rollups once', () => {
    const dir = mkdtempSync(join(tmpdir(), 'compute-rollups-'));
    try {
      const file = join(dir, 'initiative.md');
      writeFileSync(
        file,
        '---\nslug: demo\ntasks:\n  - id: T-1\n    status: done\n    weight: 2\n  - id: T-2\n    status: pending\nexitGates:\n  - id: G-1\n    status: met\n---\n',
      );

      const first = computeRollupsFile(file);
      assert.equal(first.changed, true);

      const second = computeRollupsFile(file);
      assert.equal(second.changed, false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
