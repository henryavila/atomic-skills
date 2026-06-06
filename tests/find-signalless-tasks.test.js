import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { findSignallessTasks } from '../scripts/find-signalless-tasks.js';

function writeFm(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `---\n${stringifyYaml(obj).trimEnd()}\n---\n`);
}

test('findSignallessTasks lists OPEN tasks with neither verifier nor outputs.path; passes tasks with either', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-signalless-'));
  try {
    const phase = join(root, '.atomic-skills', 'projects', 'proj', 'alpha', 'phases', 'f1.md');
    writeFm(phase, {
      schemaVersion: '0.1', slug: 'alpha-f1', status: 'active', parentPlan: 'alpha', phaseId: 'F1', lastUpdated: '2026-06-01T00:00:00Z',
      tasks: [
        { id: 'T-001', title: 'has verifier', status: 'pending', lastUpdated: '2026-06-01T00:00:00Z',
          verifier: { kind: 'shell', command: 'true' } },                                    // signalled (verifier)
        { id: 'T-002', title: 'has output', status: 'active', lastUpdated: '2026-06-01T00:00:00Z',
          outputs: [{ kind: 'file', path: 'src/x.js' }] },                                    // signalled (outputs.path)
        { id: 'T-003', title: 'signalless', status: 'pending', lastUpdated: '2026-06-01T00:00:00Z' }, // OFFENDER
        { id: 'T-004', title: 'signalless blocked', status: 'blocked', lastUpdated: '2026-06-01T00:00:00Z' }, // OFFENDER (blocked is open)
        { id: 'T-005', title: 'signalless but DONE', status: 'done', lastUpdated: '2026-06-01T00:00:00Z' }, // ignored (closed)
        { id: 'T-006', title: 'empty outputs path', status: 'pending', lastUpdated: '2026-06-01T00:00:00Z',
          outputs: [{ kind: 'command', command: 'echo hi' }] },                                // OFFENDER (no path on the output)
      ],
    });

    const report = findSignallessTasks(root);
    assert.equal(report.length, 1, 'one initiative with offenders');
    const ids = report[0].offenders.map((o) => o.taskId).sort();
    assert.deepEqual(ids, ['T-003', 'T-004', 'T-006'], 'open + signalless only; done and signalled excluded');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('findSignallessTasks returns empty when every open task carries a signal', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-signalless-ok-'));
  try {
    writeFm(join(root, '.atomic-skills', 'projects', 'p', 'a', 'phases', 'f1.md'), {
      schemaVersion: '0.1', slug: 'a-f1', status: 'active', lastUpdated: '2026-06-01T00:00:00Z',
      tasks: [
        { id: 'T-001', title: 'ok', status: 'pending', lastUpdated: '2026-06-01T00:00:00Z', outputs: [{ kind: 'file', path: 'a.js' }] },
        { id: 'T-002', title: 'done-no-signal', status: 'done', lastUpdated: '2026-06-01T00:00:00Z' },
      ],
    });
    assert.deepEqual(findSignallessTasks(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
