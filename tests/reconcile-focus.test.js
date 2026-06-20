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
    schemaVersion: '0.1', slug: 'alpha', title: 'Alpha Plan', status: 'active', currentPhase: 'F1',
    phases: [{ id: 'F0', status: 'done' }, { id: 'F1', status: 'active' }],
  });
  writeFm(join(alpha, 'phases', 'f0.md'), { slug: 'alpha-f0', status: 'done', phaseId: 'F0', parentPlan: 'alpha' });
  writeFm(join(alpha, 'phases', 'f1.md'), { slug: 'alpha-f1', status: 'active', phaseId: 'F1', parentPlan: 'alpha', nextAction: 'do x' });

  // beta is paused but its F0 is still active in BOTH the descriptor and the file.
  writeFm(join(beta, 'plan.md'), {
    schemaVersion: '0.1', slug: 'beta', title: 'Beta Plan', status: 'paused', currentPhase: 'F0',
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

test('reconcileDir denormalizes planTitle onto the plan record + its initiatives', () => {
  const { root, alpha, beta } = buildTree();
  try {
    reconcileDir(root);
    // Plan record carries planTitle so the `phases` dataSource can carry it down
    // to each exploded phase row (repeatLabelField: planTitle on the timeline).
    assert.equal(readFm(join(alpha, 'plan.md')).planTitle, 'Alpha Plan', 'plan record planTitle');
    // Each initiative carries its PARENT plan's title (the `initiatives` dataSource
    // → repeatLabelField: planTitle on the Agora widgets, grouped by parentPlan).
    assert.equal(readFm(join(alpha, 'phases', 'f1.md')).planTitle, 'Alpha Plan', 'active initiative planTitle');
    assert.equal(readFm(join(alpha, 'phases', 'f0.md')).planTitle, 'Alpha Plan', 'non-current initiative planTitle');
    // Denormalized regardless of active state — beta is paused but still labeled.
    assert.equal(readFm(join(beta, 'plan.md')).planTitle, 'Beta Plan', 'paused plan record planTitle');
    assert.equal(readFm(join(beta, 'phases', 'f0.md')).planTitle, 'Beta Plan', 'paused initiative planTitle');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('reconcileDir updates planTitle when the plan title changes (no stale label)', () => {
  const { root, alpha } = buildTree();
  try {
    reconcileDir(root);
    assert.equal(readFm(join(alpha, 'phases', 'f1.md')).planTitle, 'Alpha Plan');
    const plan = readFm(join(alpha, 'plan.md'));
    plan.title = 'Alpha Renamed';
    writeFm(join(alpha, 'plan.md'), plan);
    reconcileDir(root);
    assert.equal(readFm(join(alpha, 'plan.md')).planTitle, 'Alpha Renamed', 'plan planTitle re-synced');
    assert.equal(readFm(join(alpha, 'phases', 'f1.md')).planTitle, 'Alpha Renamed', 'initiative planTitle re-synced');
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

/** A parallel fork: parent (active, currentPhase=anchor) + child (active) whose
 *  links.json sidecar points spawnedFrom at the parent's anchor phase. */
function buildForkTree() {
  const root = mkdtempSync(join(tmpdir(), 'as-reconcile-fork-'));
  const proj = join(root, '.atomic-skills', 'projects', 'proj');
  const parent = join(proj, 'parent');
  const child = join(proj, 'child');
  mkdirSync(join(parent, 'phases'), { recursive: true });
  mkdirSync(join(child, 'phases'), { recursive: true });

  writeFm(join(parent, 'plan.md'), {
    schemaVersion: '0.1', slug: 'parent', title: 'Parent', status: 'active', currentPhase: 'F3',
    phases: [{ id: 'F3', status: 'active' }],
  });
  writeFm(join(parent, 'phases', 'f3.md'), { slug: 'parent-f3', status: 'active', phaseId: 'F3', parentPlan: 'parent' });

  writeFm(join(child, 'plan.md'), {
    schemaVersion: '0.1', slug: 'child', title: 'Child', status: 'active', currentPhase: 'C0',
    phases: [{ id: 'C0', status: 'active' }],
  });
  writeFm(join(child, 'phases', 'c0.md'), { slug: 'child-c0', status: 'active', phaseId: 'C0', parentPlan: 'child' });
  // the fork edge: child was forked FROM parent at anchor F3, parallel mode.
  writeFileSync(join(child, 'links.json'), `${JSON.stringify({ spawnedFrom: { plan: 'parent', phaseId: 'F3', mode: 'parallel' } })}\n`);

  return { root, parent, child };
}

test('reconcileDir defers the parent anchor-phase `current` marker to an active forked child (parallel)', () => {
  const { root, parent, child } = buildForkTree();
  try {
    reconcileDir(root);
    // The child's currentPhase IS the AGORA focus.
    assert.ok(readFm(join(child, 'phases', 'c0.md')).current, 'child currentPhase is current');
    // The parent's anchor phase F3 is its currentPhase, but an active child forked it
    // → the hierarchy defers the `current` marker to the child (no double-AGORA).
    const parentF3 = readFm(join(parent, 'phases', 'f3.md'));
    assert.ok(!parentF3.current, 'parent anchor phase defers current to the active forked child');
    // The parent is still active scope (timeline), just not the AGORA.
    assert.ok(parentF3.planActive, 'parent anchor stays planActive (active timeline scope)');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('reconcileDir leaves `current` on a parent whose forked child is NOT active (no over-defer)', () => {
  const { root, parent, child } = buildForkTree();
  try {
    // child paused → it is not an active work front, so the parent keeps the AGORA.
    const childPlan = readFm(join(child, 'plan.md'));
    childPlan.status = 'paused';
    writeFm(join(child, 'plan.md'), childPlan);
    reconcileDir(root);
    assert.ok(readFm(join(parent, 'phases', 'f3.md')).current, 'parent keeps current when no active child forked it');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
