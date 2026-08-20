/**
 * Unit tests for creation-gates helpers (monotonic stage field).
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  SCHEMA_VERSION,
  CREATION_STAGES,
  creationGatePath,
  buildCreationGate,
  createCreationGate,
  readCreationGate,
  assertCanAdvance,
  advanceCreationStage,
  validateCreationGateStage,
  normalizeCreationStage,
} from '../scripts/creation-gates.js';

describe('creation-gates', () => {
  let root;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'creation-gates-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('exports ordered stages list ending in ready', () => {
    assert.deepEqual(CREATION_STAGES, [
      'slug',
      'design',
      'source',
      'decompose-confirm',
      'bi-ratified',
      'materialized',
      'summaries',
      'reviews',
      'ready',
    ]);
    assert.equal(CREATION_STAGES[CREATION_STAGES.length - 1], 'ready');
    assert.equal(CREATION_STAGES.includes('process-map'), false);
    assert.equal(CREATION_STAGES.includes('flow'), false);
  });

  it('happy path: summaries advances directly to reviews (no process-map)', () => {
    const check = assertCanAdvance('summaries', 'reviews');
    assert.equal(check.ok, true, check.reason);
    assert.equal(assertCanAdvance('summaries', 'ready').ok, false);
  });

  it('remap: stage process-map reads as reviews', () => {
    assert.equal(normalizeCreationStage('process-map'), 'reviews');
    assert.equal(normalizeCreationStage('reviews'), 'reviews');
    assert.equal(normalizeCreationStage('summaries'), 'summaries');

    createCreationGate(root, 'demo', 'plan-a', { stage: 'summaries' });
    const path = creationGatePath(root, 'demo', 'plan-a');
    const raw = readCreationGate(root, 'demo', 'plan-a');
    writeFileSync(
      path,
      `${JSON.stringify({ ...raw, stage: 'process-map' }, null, 2)}\n`,
    );
    const gate = readCreationGate(root, 'demo', 'plan-a');
    assert.equal(gate.stage, 'reviews');
    assert.equal(validateCreationGateStage(gate).length, 0);
    assert.equal(assertCanAdvance('process-map', 'reviews').ok, true);
    const advanced = advanceCreationStage(path, 'reviews');
    assert.equal(advanced.stage, 'reviews');
  });

  it('buildCreationGate defaults schemaVersion 0.1 and stage slug', () => {
    const g = buildCreationGate({ projectId: 'demo', slug: 'plan-a' });
    assert.equal(g.schemaVersion, SCHEMA_VERSION);
    assert.equal(g.stage, 'slug');
    assert.equal(g.kind, 'new-plan');
    assert.equal(g.status, 'pending');
    assert.deepEqual(g.filesWritten, []);
  });

  it('buildCreationGate rejects unknown stage', () => {
    assert.throws(
      () => buildCreationGate({ stage: 'ready-to-materialize' }),
      /unknown stage/,
    );
  });

  it('happy path: create then advance stage by stage to ready', () => {
    createCreationGate(root, 'demo', 'plan-a', { stage: 'slug' });
    const path = creationGatePath(root, 'demo', 'plan-a');
    assert.ok(existsSync(path));

    let gate = readCreationGate(root, 'demo', 'plan-a');
    assert.equal(gate.stage, 'slug');
    assert.equal(validateCreationGateStage(gate).length, 0);

    for (let i = 1; i < CREATION_STAGES.length; i++) {
      gate = advanceCreationStage(path, CREATION_STAGES[i]);
      assert.equal(gate.stage, CREATION_STAGES[i]);
    }
    assert.equal(gate.stage, 'ready');
  });

  it('illegal stage skip is refused', () => {
    createCreationGate(root, 'demo', 'plan-a', { stage: 'slug' });
    const path = creationGatePath(root, 'demo', 'plan-a');
    const check = assertCanAdvance('slug', 'ready');
    assert.equal(check.ok, false);
    assert.match(check.reason, /illegal-stage-skip/);

    assert.throws(
      () => advanceCreationStage(path, 'materialized'),
      (err) => {
        assert.equal(err.code, 'ILLEGAL_STAGE_ADVANCE');
        assert.match(err.reason, /illegal-stage-skip/);
        return true;
      },
    );
    // Unchanged on disk
    assert.equal(readCreationGate(root, 'demo', 'plan-a').stage, 'slug');
  });

  it('reverse stage advance is refused', () => {
    createCreationGate(root, 'demo', 'plan-a', { stage: 'design' });
    const path = creationGatePath(root, 'demo', 'plan-a');
    const check = assertCanAdvance('design', 'slug');
    assert.equal(check.ok, false);
    assert.match(check.reason, /reverse-stage/);
    assert.throws(() => advanceCreationStage(path, 'slug'), /reverse-stage/);
  });

  it('idempotent same-stage advance is allowed', () => {
    createCreationGate(root, 'demo', 'plan-a', { stage: 'source' });
    const path = creationGatePath(root, 'demo', 'plan-a');
    const gate = advanceCreationStage(path, 'source');
    assert.equal(gate.stage, 'source');
  });

  it('missing fields: validateCreationGateStage flags invalid stage', () => {
    const issues = validateCreationGateStage({
      schemaVersion: '0.1',
      stage: 'not-a-real-stage',
    });
    assert.ok(issues.some((i) => i.startsWith('invalid-stage')));
  });

  it('missing gate object reports missing-gate', () => {
    assert.deepEqual(validateCreationGateStage(null), ['missing-gate']);
  });
});
