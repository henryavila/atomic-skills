import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  appendPlanQualityEvent,
  countByKind,
  defaultEventsPath,
  readPlanQualityEvents,
} from '../src/plan-quality-events.js';

describe('plan-quality-events', () => {
  it('appends JSONL and counts by kind', () => {
    const root = mkdtempSync(join(tmpdir(), 'pqe-'));
    try {
      const stateRoot = join(root, '.atomic-skills');
      const path = defaultEventsPath(stateRoot);
      const a = appendPlanQualityEvent({
        kind: 'fingerprint_refuse',
        planSlug: 'p',
        phaseId: 'F1',
        stateRoot,
      });
      assert.equal(a.ok, true);
      appendPlanQualityEvent({ kind: 'spine_quality_fail', planSlug: 'p', stateRoot });
      const events = readPlanQualityEvents(path, { windowDays: 14 });
      assert.equal(events.length, 2);
      const c = countByKind(events);
      assert.equal(c.fingerprint_refuse, 1);
      assert.equal(c.spine_quality_fail, 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects invalid kind', () => {
    const r = appendPlanQualityEvent({ kind: 'nope', stateRoot: '/tmp' });
    assert.equal(r.ok, false);
  });
});
