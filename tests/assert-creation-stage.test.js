/**
 * Tests for assert-creation-stage (monotonic stage / no early ready).
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  assertAtStage,
  assertAdvance,
  assertReady,
} from '../scripts/assert-creation-stage.js';
import {
  CREATION_STAGES,
  createCreationGate,
  creationGatePath,
  advanceCreationStage,
} from '../scripts/creation-gates.js';

const SCRIPT = fileURLToPath(
  new URL('../scripts/assert-creation-stage.js', import.meta.url),
);

function runCli(args, cwd) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    cwd,
  });
}

describe('assertAtStage / assertAdvance / assertReady', () => {
  it('assertAtStage fails when behind', () => {
    const r = assertAtStage({ schemaVersion: '0.1', stage: 'slug' }, 'design');
    assert.equal(r.ok, false);
    assert.match(r.reason, /stage-behind/);
  });

  it('assertAtStage passes when at or past', () => {
    assert.equal(
      assertAtStage({ schemaVersion: '0.1', stage: 'design' }, 'design').ok,
      true,
    );
    assert.equal(
      assertAtStage({ schemaVersion: '0.1', stage: 'source' }, 'design').ok,
      true,
    );
  });

  it('assertAdvance refuses illegal skip', () => {
    const r = assertAdvance({ schemaVersion: '0.1', stage: 'slug' }, 'ready');
    assert.equal(r.ok, false);
    assert.match(r.reason, /illegal-stage-skip/);
  });

  it('assertAdvance allows next stage', () => {
    const r = assertAdvance({ schemaVersion: '0.1', stage: 'slug' }, 'design');
    assert.equal(r.ok, true);
  });

  it('assertReady fails when declaring ready early', () => {
    const r = assertReady({ schemaVersion: '0.1', stage: 'design' });
    assert.equal(r.ok, false);
    assert.match(r.reason, /declare-ready-early/);
  });

  it('assertReady passes when stage is ready', () => {
    assert.equal(
      assertReady({ schemaVersion: '0.1', stage: 'ready' }).ok,
      true,
    );
  });

  it('assertAtStage treats leftover process-map as reviews (behind ready)', () => {
    const r = assertAtStage(
      { schemaVersion: '0.1', stage: 'process-map' },
      'ready',
    );
    assert.equal(r.ok, false);
    assert.match(r.reason, /stage-behind/);
    assert.match(r.reason, /reviews<ready/);
  });

  it('assertAtStage treats leftover process-map as at/past reviews', () => {
    assert.equal(
      assertAtStage({ schemaVersion: '0.1', stage: 'process-map' }, 'reviews')
        .ok,
      true,
    );
  });

  it('assertReady without advancing treats leftover process-map as not ready', () => {
    const r = assertReady({ schemaVersion: '0.1', stage: 'process-map' });
    assert.equal(r.ok, false);
    assert.match(r.reason, /declare-ready-early/);
  });
});

describe('CLI assert-creation-stage', () => {
  let root;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'acs-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('exits 1 on skip advance', () => {
    createCreationGate(root, 'demo', 'plan-a', { stage: 'slug' });
    const path = creationGatePath(root, 'demo', 'plan-a');
    const res = runCli([path, '--advance', 'ready'], root);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /illegal-stage-skip|HARD-BLOCK/);
  });

  it('exits 1 on declare ready early', () => {
    createCreationGate(root, 'demo', 'plan-a', { stage: 'bi-ratified' });
    const path = creationGatePath(root, 'demo', 'plan-a');
    const res = runCli([path, '--ready'], root);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /declare-ready-early|HARD-BLOCK/);
  });

  it('exits 0 for legal single-step advance with --write', () => {
    createCreationGate(root, 'demo', 'plan-a', { stage: 'slug' });
    const path = creationGatePath(root, 'demo', 'plan-a');
    const res = runCli([path, '--advance', 'design', '--write'], root);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /advanced/);
  });

  it('can walk all stages then --ready', () => {
    createCreationGate(root, 'demo', 'plan-a', { stage: 'slug' });
    const path = creationGatePath(root, 'demo', 'plan-a');
    for (let i = 1; i < CREATION_STAGES.length; i++) {
      advanceCreationStage(path, CREATION_STAGES[i]);
    }
    const res = runCli([path, '--ready'], root);
    assert.equal(res.status, 0, res.stderr);
  });

  it('exits 1 when file missing', () => {
    const res = runCli([join(root, 'nope.json'), '--at', 'slug'], root);
    assert.equal(res.status, 1);
  });

  it('CLI --at ready fails when on-disk stage is leftover process-map', () => {
    const path = join(root, 'gate.json');
    writeFileSync(
      path,
      `${JSON.stringify({ schemaVersion: '0.1', stage: 'process-map' }, null, 2)}\n`,
    );
    const res = runCli([path, '--at', 'ready'], root);
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /stage-behind/);
  });

  it('CLI --ready (no --write) fails when on-disk stage is leftover process-map', () => {
    const path = join(root, 'gate.json');
    writeFileSync(
      path,
      `${JSON.stringify({ schemaVersion: '0.1', stage: 'process-map' }, null, 2)}\n`,
    );
    const res = runCli([path, '--ready'], root);
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /declare-ready-early|HARD-BLOCK/);
  });

  it('CLI --ready --write advances leftover process-map to ready and persists', () => {
    const path = join(root, 'gate.json');
    writeFileSync(
      path,
      `${JSON.stringify({ schemaVersion: '0.1', stage: 'process-map' }, null, 2)}\n`,
    );
    const res = runCli([path, '--ready', '--write'], root);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /advanced to ready/);
    assert.equal(/assert-creation-stage: ready ✓/.test(res.stdout), false);
    const onDisk = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(onDisk.stage, 'ready');
  });
});
