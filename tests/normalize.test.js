import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse as parseYaml } from 'yaml';
import {
  normalizeGateStatus,
  normalizeReference,
  normalizeEntity,
  normalizeStateDir,
} from '../src/normalize.js';

const NOW = '2026-05-29T12:00:00.000Z';

describe('normalizeGateStatus', () => {
  it('leaves valid statuses untouched', () => {
    for (const s of ['pending', 'met', 'deferred']) {
      assert.equal(normalizeGateStatus(s), null);
    }
  });

  it('maps completion synonyms to met', () => {
    for (const s of ['done', 'complete', 'completed', 'closed', 'passed']) {
      assert.equal(normalizeGateStatus(s), 'met');
    }
  });

  it('maps unknown/incomplete statuses to pending', () => {
    for (const s of ['active', 'blocked', 'open', 'in-progress', '', undefined]) {
      assert.equal(normalizeGateStatus(s), 'pending');
    }
  });
});

describe('normalizeReference', () => {
  it('infers kind=url for http(s) paths', () => {
    const { ref, changed } = normalizeReference({ path: 'https://x.com/a', label: 'X' });
    assert.equal(ref.kind, 'url');
    assert.equal(changed, true);
  });

  it('infers kind=file for non-url paths', () => {
    const { ref } = normalizeReference({ path: 'docs/plan.md' });
    assert.equal(ref.kind, 'file');
  });

  it('renames title to label and drops title', () => {
    const { ref, changed } = normalizeReference({ kind: 'file', path: 'a.md', title: 'A doc' });
    assert.equal(ref.label, 'A doc');
    assert.equal(ref.title, undefined);
    assert.equal(changed, true);
  });

  it('does not overwrite an existing label with title', () => {
    const { ref } = normalizeReference({ kind: 'file', path: 'a.md', title: 'T', label: 'L' });
    assert.equal(ref.label, 'L');
    assert.equal(ref.title, undefined);
  });

  it('leaves a valid reference unchanged', () => {
    const { ref, changed } = normalizeReference({ kind: 'repo-path', path: 'src/x', label: 'L' });
    assert.equal(changed, false);
    assert.deepEqual(ref, { kind: 'repo-path', path: 'src/x', label: 'L' });
  });
});

describe('normalizeEntity — initiative exitGates', () => {
  it('rewrites exitGate status: done -> met and adds metAt', () => {
    const entity = {
      slug: 'x',
      status: 'done',
      lastUpdated: '2026-05-20T00:00:00.000Z',
      exitGates: [{ id: 'G-1', description: 'd', status: 'done' }],
    };
    const { entity: out, changes } = normalizeEntity(entity, { nowIso: NOW });
    assert.equal(out.exitGates[0].status, 'met');
    assert.equal(out.exitGates[0].metAt, '2026-05-20T00:00:00.000Z'); // falls back to lastUpdated
    assert.ok(changes.length >= 1);
  });

  it('does not mutate the input entity (immutability)', () => {
    const entity = { slug: 'x', exitGates: [{ id: 'G-1', description: 'd', status: 'done' }] };
    normalizeEntity(entity, { nowIso: NOW });
    assert.equal(entity.exitGates[0].status, 'done');
  });

  it('returns no changes for an already-valid entity', () => {
    const entity = {
      schemaVersion: '0.1',
      slug: 'x',
      branch: null,
      nextAction: null,
      exitGates: [{ id: 'G-1', description: 'd', status: 'met', metAt: NOW }],
      stack: [],
      tasks: [],
      parked: [],
      emerged: [],
      references: [{ kind: 'file', path: 'a.md', label: 'L' }],
    };
    const { changes } = normalizeEntity(entity, { nowIso: NOW });
    assert.equal(changes.length, 0);
  });
});

describe('normalizeEntity — initiative backfill', () => {
  it('backfills a missing required array field (stack)', () => {
    const entity = { slug: 'x', exitGates: [], tasks: [] }; // inferred initiative
    const { entity: out, changes } = normalizeEntity(entity, { nowIso: NOW });
    assert.deepEqual(out.stack, []);
    assert.deepEqual(out.parked, []);
    assert.equal(out.branch, null);
    assert.equal(out.nextAction, null);
    assert.ok(changes.some((c) => c.includes('stack')));
  });

  it('does not overwrite present fields during backfill', () => {
    const entity = { slug: 'x', exitGates: [], stack: [{ id: 1 }], branch: 'main' };
    const { out } = { out: normalizeEntity(entity, { nowIso: NOW }).entity };
    assert.deepEqual(out.stack, [{ id: 1 }]);
    assert.equal(out.branch, 'main');
  });

  it('NEVER backfills a plan (would inject keys a .strict() plan rejects)', () => {
    const plan = { slug: 'p', phases: [{ id: 'F0' }] }; // inferred plan
    const { entity: out, changes } = normalizeEntity(plan, { nowIso: NOW });
    assert.equal('stack' in out, false);
    assert.equal('tasks' in out, false);
    assert.equal(changes.length, 0);
  });

  it('respects an explicit kind hint over inference', () => {
    const entity = { slug: 'x' }; // no shape signal
    const { entity: out } = normalizeEntity(entity, { nowIso: NOW, kind: 'initiative' });
    assert.deepEqual(out.exitGates, []);
  });
});

describe('normalizeEntity — plan phase criteria', () => {
  it('rewrites phase exitGate.criteria status: done -> met', () => {
    const plan = {
      slug: 'p',
      phases: [
        { id: 'F0', exitGate: { summary: 's', criteria: [{ id: 'G-1', description: 'd', status: 'done' }] } },
      ],
    };
    const { entity: out } = normalizeEntity(plan, { nowIso: NOW });
    assert.equal(out.phases[0].exitGate.criteria[0].status, 'met');
  });
});

describe('normalizeStateDir', () => {
  it('repairs files on disk and preserves the body', () => {
    const dir = mkdtempSync(join(tmpdir(), 'as-normalize-'));
    try {
      const initDir = join(dir, 'initiatives');
      mkdirSync(initDir, { recursive: true });
      const file = join(initDir, 'broken.md');
      writeFileSync(
        file,
        `---
schemaVersion: '0.1'
slug: broken
status: done
lastUpdated: '2026-05-20T00:00:00.000Z'
exitGates:
  - id: G-1
    description: "gate one"
    status: done
references:
  - path: "docs/x.md"
    title: "X doc"
tasks: []
---
# Body stays intact

Some narrative.
`
      );
      const report = normalizeStateDir(dir, { nowIso: NOW });
      assert.equal(report.files.length, 1);
      assert.ok(report.totalChanges >= 2);

      const raw = readFileSync(file, 'utf8');
      assert.match(raw, /# Body stays intact/);
      const fmBlock = raw.slice(4, raw.indexOf('\n---', 4));
      const fm = parseYaml(fmBlock);
      assert.equal(fm.exitGates[0].status, 'met');
      assert.equal(fm.references[0].kind, 'file');
      assert.equal(fm.references[0].label, 'X doc');
      assert.equal(fm.references[0].title, undefined);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('is idempotent (second run makes no changes)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'as-normalize-'));
    try {
      const initDir = join(dir, 'initiatives');
      mkdirSync(initDir, { recursive: true });
      writeFileSync(
        join(initDir, 'broken.md'),
        `---
slug: broken
exitGates:
  - id: G-1
    description: d
    status: done
tasks: []
---
body
`
      );
      normalizeStateDir(dir, { nowIso: NOW });
      const second = normalizeStateDir(dir, { nowIso: NOW });
      assert.equal(second.totalChanges, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
