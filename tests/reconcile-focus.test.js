import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { reconcileDir } from '../scripts/reconcile-focus.js';

function writeFm(path, obj, body = '') {
  writeFileSync(path, `---\n${stringifyYaml(obj).trimEnd()}\n---\n${body ? `\n${body}\n` : ''}`);
}
function readFm(path) {
  const m = readFileSync(path, 'utf8').match(/^---\n([\s\S]*?)\n---/);
  return parseYaml(m[1]);
}

/** Build a nested .atomic-skills tree: one ACTIVE plan (alpha, currentPhase F1)
 *  and one PAUSED plan (beta) carrying a STALE active F0 (descriptor+initiative). */
function buildTree() {
  const root = mkdtempSync(join(tmpdir(), 'as-reconcile-'));
  const proj = join(root, '.atomic-skills', 'projects', 'proj');
  const alpha = join(proj, 'alpha');
  const beta = join(proj, 'beta');
  mkdirSync(join(alpha, 'phases'), { recursive: true });
  mkdirSync(join(beta, 'phases'), { recursive: true });

  writeFm(join(alpha, 'plan.md'), {
    schemaVersion: '0.1', slug: 'alpha', status: 'active', currentPhase: 'F1',
    phases: [{ id: 'F0', status: 'done' }, { id: 'F1', status: 'active' }],
  });
  writeFm(join(alpha, 'phases', 'f0.md'), { slug: 'alpha-f0', status: 'done', phaseId: 'F0', parentPlan: 'alpha' });
  writeFm(join(alpha, 'phases', 'f1.md'), { slug: 'alpha-f1', status: 'active', phaseId: 'F1', parentPlan: 'alpha', nextAction: 'do x' });

  // beta is paused but its F0 is still active in BOTH the descriptor and the file.
  writeFm(join(beta, 'plan.md'), {
    schemaVersion: '0.1', slug: 'beta', status: 'paused', currentPhase: 'F0',
    phases: [{ id: 'F0', status: 'active' }],
  });
  writeFm(join(beta, 'phases', 'f0.md'), { slug: 'beta-f0', status: 'active', phaseId: 'F0', parentPlan: 'beta' });

  return { root, alpha, beta };
}

test('reconcileDir cascades a paused plan’s active phase and stamps focus markers', () => {
  const { root, alpha, beta } = buildTree();
  try {
    const report = reconcileDir(root);
    assert.ok(report.changed > 0, 'first run makes changes');

    // ── Cascade: paused beta must not keep an active phase (descriptor + file) ──
    assert.equal(readFm(join(beta, 'plan.md')).phases[0].status, 'paused', 'beta descriptor F0 → paused');
    const betaF0 = readFm(join(beta, 'phases', 'f0.md'));
    assert.equal(betaF0.status, 'paused', 'beta initiative F0 → paused');
    assert.ok(!betaF0.planActive, 'beta initiative not planActive');
    assert.ok(!betaF0.current, 'beta initiative not current');
    assert.ok(!readFm(join(beta, 'plan.md')).planActive, 'beta plan not planActive');

    // ── Markers: active alpha plan + its currentPhase initiative ──
    assert.equal(readFm(join(alpha, 'plan.md')).planActive, true, 'alpha plan record planActive');
    const f1 = readFm(join(alpha, 'phases', 'f1.md'));
    assert.equal(f1.status, 'active', 'alpha F1 stays active');
    assert.equal(f1.planActive, true, 'alpha F1 planActive');
    assert.equal(f1.current, true, 'alpha F1 is current (== currentPhase)');
    const f0 = readFm(join(alpha, 'phases', 'f0.md'));
    assert.equal(f0.planActive, true, 'alpha F0 planActive (its plan is active)');
    assert.ok(!f0.current, 'alpha F0 not current (not currentPhase)');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('reconcileDir is idempotent', () => {
  const { root } = buildTree();
  try {
    reconcileDir(root);
    const second = reconcileDir(root);
    assert.equal(second.changed, 0, 'second run makes no changes');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('current marker clears when the plan is no longer active (stale-marker strip)', () => {
  const { root, alpha } = buildTree();
  try {
    reconcileDir(root); // alpha F1 → current:true
    assert.equal(readFm(join(alpha, 'phases', 'f1.md')).current, true);

    // Pause alpha; reconcile must strip planActive/current and cascade F1.
    const plan = readFm(join(alpha, 'plan.md'));
    plan.status = 'paused';
    writeFm(join(alpha, 'plan.md'), plan);
    reconcileDir(root);

    const f1 = readFm(join(alpha, 'phases', 'f1.md'));
    assert.ok(!f1.current, 'current stripped after pause');
    assert.ok(!f1.planActive, 'planActive stripped after pause');
    assert.equal(f1.status, 'paused', 'F1 cascaded active→paused');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
