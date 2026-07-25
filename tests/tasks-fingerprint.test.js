import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashTasksCore,
  compareTasksCore,
  listCoreMismatches,
  normalizeTitle,
  taskCore,
} from '../src/tasks-fingerprint.js';

const baseTask = {
  id: 'T-001',
  title: '  Do   the thing  ',
  summary: 'ignore me',
  weight: 9,
  status: 'pending',
  outputs: [{ kind: 'file', path: 'src/a.js' }, { kind: 'file', path: 'tests/a.test.js' }],
  scopeBoundary: ['Do not touch b.js'],
  acceptance: ['it - a works'],
  verifier: { kind: 'shell', command: 'node --test tests/a.test.js' },
};

describe('tasks-fingerprint', () => {
  it('normalizes title whitespace', () => {
    assert.equal(normalizeTitle('  Do   the thing  '), 'Do the thing');
  });

  it('same core → same hash; allowlist-only change keeps hash', () => {
    const a = hashTasksCore([baseTask]);
    const b = hashTasksCore([{ ...baseTask, summary: 'other', weight: 1, status: 'done' }]);
    assert.equal(a, b);
  });

  it('changing acceptance / verifier / files / id / title changes hash', () => {
    const base = hashTasksCore([baseTask]);
    assert.notEqual(base, hashTasksCore([{ ...baseTask, acceptance: ['other'] }]));
    assert.notEqual(base, hashTasksCore([{ ...baseTask, verifier: { kind: 'shell', command: 'true' } }]));
    assert.notEqual(
      base,
      hashTasksCore([{ ...baseTask, outputs: [{ kind: 'file', path: 'src/other.js' }] }]),
    );
    assert.notEqual(base, hashTasksCore([{ ...baseTask, id: 'T-002' }]));
    assert.notEqual(base, hashTasksCore([{ ...baseTask, title: 'Do the thing differently' }]));
  });

  it('changing expectExitCode / expectRowCount / connectionCommand / runner changes hash', () => {
    const withExit = {
      ...baseTask,
      verifier: { kind: 'shell', command: 'node --test tests/a.test.js', expectExitCode: 0 },
    };
    const base = hashTasksCore([withExit]);
    assert.notEqual(
      base,
      hashTasksCore([
        {
          ...withExit,
          verifier: { ...withExit.verifier, expectExitCode: 1 },
        },
      ]),
    );
    const query = {
      ...baseTask,
      verifier: {
        kind: 'query',
        sql: 'select 1',
        expectRowCount: 0,
        connectionCommand: 'psql $DB',
      },
    };
    const qBase = hashTasksCore([query]);
    assert.notEqual(
      qBase,
      hashTasksCore([
        {
          ...query,
          verifier: { ...query.verifier, expectRowCount: 1 },
        },
      ]),
    );
    assert.notEqual(
      qBase,
      hashTasksCore([
        {
          ...query,
          verifier: { ...query.verifier, connectionCommand: 'psql $OTHER' },
        },
      ]),
    );
    const withRunner = {
      ...baseTask,
      verifier: { kind: 'test', command: 'npm test', runner: 'jest' },
    };
    assert.notEqual(
      hashTasksCore([withRunner]),
      hashTasksCore([
        {
          ...withRunner,
          verifier: { ...withRunner.verifier, runner: 'vitest' },
        },
      ]),
    );
  });

  it('title-only whitespace rewrite does not change hash after normalize', () => {
    const a = hashTasksCore([baseTask]);
    const b = hashTasksCore([{ ...baseTask, title: 'Do the thing' }]);
    assert.equal(a, b);
  });

  it('compareTasksCore match / mismatch', () => {
    assert.equal(compareTasksCore([baseTask], [{ ...baseTask, summary: 'x' }]).match, true);
    assert.equal(compareTasksCore([baseTask], [{ ...baseTask, acceptance: ['nope'] }]).match, false);
  });

  it('listCoreMismatches names diverging ids', () => {
    const m = listCoreMismatches([baseTask], [{ ...baseTask, acceptance: ['z'] }]);
    assert.deepEqual(m, ['T-001']);
  });

  it('taskCore drops allowlist fields', () => {
    const c = taskCore(baseTask);
    assert.equal(c.title, 'Do the thing');
    assert.deepEqual(c.files, ['src/a.js', 'tests/a.test.js']);
    assert.equal('summary' in c, false);
  });
});
