import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  buildInitialCursor,
  recordLastAssert,
  lastAssertAllows,
  recordLastAssertFile,
  readCursorResult,
} from '../src/maestro-cursor.js';

describe('lastAssert', () => {
  it('recordLastAssert + lastAssertAllows gate match', () => {
    const c = buildInitialCursor({ phaseId: 'F0', step: 'E' });
    const r = recordLastAssert(c, { gate: 'done', ok: true });
    assert.equal(r.ok, true);
    assert.equal(lastAssertAllows(r.cursor, 'done').ok, true);
    assert.equal(lastAssertAllows(r.cursor, 'phase-done').ok, false);
  });

  it('lastAssertAllows fails when ok false', () => {
    const c = buildInitialCursor({ phaseId: 'F0', step: 'E' });
    const r = recordLastAssert(c, {
      gate: 'done',
      ok: false,
      reason: 'blocked: claim',
    });
    assert.equal(lastAssertAllows(r.cursor, 'done').ok, false);
  });

  it('recordLastAssertFile round-trip', () => {
    const root = mkdtempSync(join(tmpdir(), 'mc-la-'));
    try {
      const statusRoot = join(root, 'status');
      recordLastAssertFile(statusRoot, 'plan-x', {
        gate: 'phase-done',
        ok: true,
        phaseId: 'F1',
      });
      const read = readCursorResult(statusRoot, 'plan-x');
      assert.equal(read.status, 'ok');
      assert.equal(read.cursor?.lastAssert?.gate, 'phase-done');
      assert.equal(read.cursor?.lastAssert?.ok, true);
      assert.equal(lastAssertAllows(read.cursor, 'phase-done').ok, true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
