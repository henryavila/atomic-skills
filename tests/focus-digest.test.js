/**
 * focus-digest.test.js — the producer side of the claudebar integration.
 *
 * `scripts/emit-focus.js` projects the canonical `.atomic-skills/` state into a
 * single flat `focus.json` digest that an external statusline (claudebar) reads
 * to render "plan · phase i/n · tasks done/total" without walking the YAML tree.
 *
 * Contract under test (see docs/design/statusline-focus-integration.md):
 *  - the digest shape validates against meta/schemas/focus.schema.json,
 *  - done/total come from the precomputed rollups; blocked is counted from tasks[],
 *  - phase index/total are 1-based position within plan.phases[],
 *  - `sources[]` records each source file's repo-relative path + frontmatter
 *    `lastUpdated` (the staleness fingerprint the consumer re-reads),
 *  - no active plan → `plan: null`,
 *  - >1 active plan → `flags.multipleActivePlans: true`, focus = the `current:true` phase,
 *  - the write is atomic (tmp + rename) and only happens when `.atomic-skills/` exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Ajv from 'ajv/dist/2020.js';

import { buildFocusDigest, emitFocus } from '../scripts/emit-focus.js';

const FIXED_NOW = '2026-06-15T12:00:00.000Z';

function schemaValidator() {
  const schema = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'meta', 'schemas', 'focus.schema.json'), 'utf8'));
  const ajv = new Ajv({ allErrors: true, strict: false });
  return ajv.compile(schema);
}

function writeFm(path, fm) {
  writeFileSync(path, `---\n${fm}\n---\n\nbody\n`);
}

/** Build a repo fixture with one active plan (F0 of 2) and its phase initiative. */
function singleActiveRepo() {
  const repo = mkdtempSync(join(tmpdir(), 'focus-single-'));
  const planDir = join(repo, '.atomic-skills', 'projects', 'atomic-skills', 'plan-a');
  mkdirSync(join(planDir, 'phases'), { recursive: true });
  writeFm(join(planDir, 'plan.md'), [
    'schemaVersion: "0.1"',
    'slug: plan-a',
    'title: Plan A',
    'status: active',
    'currentPhase: F0',
    'lastUpdated: 2026-06-15T10:00:00Z',
    'phases:',
    '  - id: F0',
    '    slug: plan-a-f0',
    '    title: Phase Zero',
    '    status: active',
    '  - id: F1',
    '    slug: plan-a-f1',
    '    title: Phase One',
    '    status: pending',
  ].join('\n'));
  writeFm(join(planDir, 'phases', 'f0-phase-zero.md'), [
    'schemaVersion: "0.1"',
    'slug: plan-a-f0',
    'title: Phase Zero',
    'status: active',
    'phaseId: F0',
    'parentPlan: plan-a',
    'nextAction: "Do T0.1"',
    'tasksDone: 2',     // rollup is authoritative for done/total ...
    'tasksTotal: 5',
    'gatesMet: 0',
    'gatesTotal: 1',
    'lastUpdated: 2026-06-15T11:00:00Z',
    'current: true',
    'planActive: true',
    'tasks:',          // ... blocked is counted here (no rollup field exists)
    '  - id: T0.1',
    '    status: done',
    '  - id: T0.2',
    '    status: blocked',
  ].join('\n'));
  return repo;
}

test('buildFocusDigest projects the active plan/phase with rollups + sources', () => {
  const repo = singleActiveRepo();
  try {
    const d = buildFocusDigest(repo, { now: FIXED_NOW });

    assert.equal(d.schemaVersion, '0.1');
    assert.equal(d.generatedAt, FIXED_NOW);
    assert.equal(d.projectId, 'atomic-skills');

    assert.deepEqual(d.plan, { slug: 'plan-a', title: 'Plan A', status: 'active' });
    assert.equal(d.phase.id, 'F0');
    assert.equal(d.phase.index, 1);   // 1-based position in plan.phases[]
    assert.equal(d.phase.total, 2);
    assert.equal(d.phase.title, 'Phase Zero');

    assert.deepEqual(d.tasks, { done: 2, total: 5, blocked: 1 }); // done/total=rollup, blocked=tasks[]
    assert.deepEqual(d.gates, { met: 0, total: 1 });
    assert.equal(d.nextAction, 'Do T0.1');
    assert.equal(d.flags.drift, false);
    assert.equal(d.flags.multipleActivePlans, false);

    // sources: plan.md + the phase file, repo-relative, with frontmatter lastUpdated.
    const byPath = Object.fromEntries(d.sources.map((s) => [s.path, s.lastUpdated]));
    assert.equal(byPath['.atomic-skills/projects/atomic-skills/plan-a/plan.md'], '2026-06-15T10:00:00Z');
    assert.equal(byPath['.atomic-skills/projects/atomic-skills/plan-a/phases/f0-phase-zero.md'], '2026-06-15T11:00:00Z');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('digest validates against focus.schema.json', () => {
  const repo = singleActiveRepo();
  try {
    const validate = schemaValidator();
    const d = buildFocusDigest(repo, { now: FIXED_NOW });
    assert.ok(validate(d), `schema errors: ${JSON.stringify(validate.errors, null, 2)}`);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('no active plan → plan: null, schema still valid', () => {
  const repo = mkdtempSync(join(tmpdir(), 'focus-none-'));
  try {
    const planDir = join(repo, '.atomic-skills', 'projects', 'p', 'paused-plan');
    mkdirSync(join(planDir, 'phases'), { recursive: true });
    writeFm(join(planDir, 'plan.md'), [
      'schemaVersion: "0.1"',
      'slug: paused-plan',
      'title: Paused',
      'status: paused',
      'currentPhase: F0',
      'lastUpdated: 2026-06-15T10:00:00Z',
      'phases:',
      '  - id: F0',
      '    slug: p-f0',
      '    title: Zero',
      '    status: paused',
    ].join('\n'));
    const validate = schemaValidator();
    const d = buildFocusDigest(repo, { now: FIXED_NOW });
    assert.equal(d.plan, null);
    assert.equal(d.phase, null);
    assert.deepEqual(d.sources, []);
    assert.ok(validate(d), `schema errors: ${JSON.stringify(validate.errors)}`);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('multiple active plans → branch match wins, else recency; flag is set', () => {
  const repo = mkdtempSync(join(tmpdir(), 'focus-multi-'));
  try {
    const mk = (slug, last, branch) => {
      const planDir = join(repo, '.atomic-skills', 'projects', 'p', slug);
      mkdirSync(join(planDir, 'phases'), { recursive: true });
      writeFm(join(planDir, 'plan.md'), [
        'schemaVersion: "0.1"', `slug: ${slug}`, `title: ${slug}`, 'status: active',
        'currentPhase: F0', `lastUpdated: ${last}`, ...(branch ? [`branch: ${branch}`] : []),
        'phases:', '  - id: F0', `    slug: ${slug}-f0`, '    title: Zero', '    status: active',
      ].join('\n'));
      writeFm(join(planDir, 'phases', 'f0-zero.md'), [
        'schemaVersion: "0.1"', `slug: ${slug}-f0`, 'title: Zero', 'status: active',
        'phaseId: F0', `parentPlan: ${slug}`, 'tasksDone: 1', 'tasksTotal: 3', 'gatesMet: 0', 'gatesTotal: 0',
        `lastUpdated: ${last}`, 'current: true', 'planActive: true',
      ].join('\n'));
    };
    // plan-fresh is more recent; plan-feature carries the matching branch.
    mk('plan-fresh', '2026-06-15T11:00:00Z', null);
    mk('plan-feature', '2026-06-15T09:00:00Z', 'feature/x');

    // No branch context → newest (plan-fresh) wins.
    const recency = buildFocusDigest(repo, { now: FIXED_NOW });
    assert.equal(recency.plan.slug, 'plan-fresh');
    assert.equal(recency.flags.multipleActivePlans, true);

    // Branch match beats recency.
    const matched = buildFocusDigest(repo, { now: FIXED_NOW, branch: 'feature/x' });
    assert.equal(matched.plan.slug, 'plan-feature');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('emitFocus writes .atomic-skills/focus.json atomically; no-op without state', () => {
  const repo = singleActiveRepo();
  try {
    const res = emitFocus(repo, { now: FIXED_NOW });
    const out = join(repo, '.atomic-skills', 'focus.json');
    assert.equal(res.written, true);
    assert.ok(existsSync(out));
    assert.ok(!existsSync(`${out}.tmp`), 'temp file must be renamed away');
    const onDisk = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(onDisk.plan.slug, 'plan-a');

    // A repo with no .atomic-skills/ is a no-op (never litters the tree).
    const bare = mkdtempSync(join(tmpdir(), 'focus-bare-'));
    try {
      const r2 = emitFocus(bare, { now: FIXED_NOW });
      assert.equal(r2.written, false);
      assert.ok(!existsSync(join(bare, '.atomic-skills')));
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
