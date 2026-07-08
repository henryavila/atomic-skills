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

  // the fork edge is INLINE (F5/T-003): spawnedFrom in the child plan.md frontmatter.
  writeFm(join(child, 'plan.md'), {
    schemaVersion: '0.1', slug: 'child', title: 'Child', status: 'active', currentPhase: 'C0',
    spawnedFrom: { plan: 'parent', phaseId: 'F3', mode: 'parallel' },
    phases: [{ id: 'C0', status: 'active' }],
  });
  writeFm(join(child, 'phases', 'c0.md'), { slug: 'child-c0', status: 'active', phaseId: 'C0', parentPlan: 'child' });

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

// F4 robustness (cross-model review findings #1, #3) — now against the INLINE elo
test('reconcileDir does not throw on a plan.md with malformed frontmatter (inline elo source)', () => {
  const { root, child } = buildForkTree();
  try {
    // a torn/half-written plan.md (the elo now lives in frontmatter, not a sidecar)
    writeFileSync(join(child, 'plan.md'), '---\nschemaVersion: "0.1"\n  : broken : :\nspawnedFrom: nope\n---\nbody\n');
    // Kills "readFmSafe/safeSpawnedFrom unguarded": without them the whole reconcile throws.
    assert.doesNotThrow(() => reconcileDir(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('reconcileDir does not blank ALL `current` markers on a spawnedFrom cycle', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-reconcile-cycle-'));
  const proj = join(root, '.atomic-skills', 'projects', 'proj');
  try {
    // mutual fork (a cycle; upstream cycle-check should prevent it): the inline
    // spawnedFrom on each plan points at the other.
    for (const [slug, other] of [['a', 'b'], ['b', 'a']]) {
      const dir = join(proj, slug);
      mkdirSync(join(dir, 'phases'), { recursive: true });
      writeFm(join(dir, 'plan.md'), {
        schemaVersion: '0.1', slug, title: slug, status: 'active', currentPhase: 'F0',
        spawnedFrom: { plan: other, phaseId: 'F0', mode: 'parallel' },
        phases: [{ id: 'F0', status: 'active' }],
      });
      writeFm(join(dir, 'phases', 'f0.md'), { slug: `${slug}-f0`, status: 'active', phaseId: 'F0', parentPlan: slug });
    }
    reconcileDir(root);
    // cycle members are skipped → neither defers → each keeps its own current
    // (baseline multi-current), never the worse-than-baseline zero-AGORA state.
    const aCur = readFm(join(proj, 'a', 'phases', 'f0.md')).current;
    const bCur = readFm(join(proj, 'b', 'phases', 'f0.md')).current;
    assert.ok(aCur && bCur, 'a cyclic fork leaves both currents intact (no no-AGORA regression)');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('reconcileDir does not defer a same-named parent in ANOTHER project (intra-project scoping)', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-reconcile-xproj-'));
  try {
    // Two projects each with an active "parent" plan at currentPhase F3. Only projX
    // has an active child forked from parent/F3. projY's "parent" must KEEP its
    // current — the deferral must not cross the project boundary on a slug match.
    const mkParent = (proj) => {
      const dir = join(root, '.atomic-skills', 'projects', proj, 'parent');
      mkdirSync(join(dir, 'phases'), { recursive: true });
      writeFm(join(dir, 'plan.md'), {
        schemaVersion: '0.1', slug: 'parent', title: 'Parent', status: 'active', currentPhase: 'F3',
        phases: [{ id: 'F3', status: 'active' }],
      });
      writeFm(join(dir, 'phases', 'f3.md'), { slug: 'parent-f3', status: 'active', phaseId: 'F3', parentPlan: 'parent' });
      return dir;
    };
    mkParent('projX');
    mkParent('projY');
    // child in projX only, forked from parent/F3
    const childDir = join(root, '.atomic-skills', 'projects', 'projX', 'child');
    mkdirSync(join(childDir, 'phases'), { recursive: true });
    writeFm(join(childDir, 'plan.md'), {
      schemaVersion: '0.1', slug: 'child', title: 'Child', status: 'active', currentPhase: 'C0',
      spawnedFrom: { plan: 'parent', phaseId: 'F3', mode: 'parallel' }, // inline elo (F5/T-003)
      phases: [{ id: 'C0', status: 'active' }],
    });
    writeFm(join(childDir, 'phases', 'c0.md'), { slug: 'child-c0', status: 'active', phaseId: 'C0', parentPlan: 'child' });
    reconcileDir(root);
    assert.ok(!readFm(join(root, '.atomic-skills', 'projects', 'projX', 'parent', 'phases', 'f3.md')).current, 'projX parent defers to its forked child');
    assert.ok(readFm(join(root, '.atomic-skills', 'projects', 'projY', 'parent', 'phases', 'f3.md')).current, 'projY parent (no child) keeps its AGORA');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// C-4: a flat legacy tree (plans/*.md + initiatives/*.md, no projects/) must get
// its planActive/current/planTitle focus markers — was skipped entirely because
// reconcileDir returned early when projects/ was absent.
test('reconcileDir reconciles a flat legacy tree (planActive + denormalized markers)', () => {
  const root = mkdtempSync(join(tmpdir(), 'as-reconcile-flat-'));
  const asDir = join(root, '.atomic-skills');
  mkdirSync(join(asDir, 'plans'), { recursive: true });
  mkdirSync(join(asDir, 'initiatives'), { recursive: true });
  try {
    writeFm(join(asDir, 'plans', 'legacy.md'), {
      schemaVersion: '0.1', slug: 'legacy', title: 'Legacy Plan', status: 'active', currentPhase: 'F0',
      phases: [{ id: 'F0', status: 'active' }],
    });
    writeFm(join(asDir, 'initiatives', 'legacy.md'), {
      schemaVersion: '0.1', slug: 'legacy-f0', status: 'active', phaseId: 'F0', parentPlan: 'legacy',
    });

    const report = reconcileDir(root);
    assert.ok(report.changed > 0, 'flat tree is reconciled, not skipped');
    assert.equal(readFm(join(asDir, 'plans', 'legacy.md')).planActive, true, 'flat plan gets planActive');
    const init = readFm(join(asDir, 'initiatives', 'legacy.md'));
    assert.equal(init.planActive, true, 'flat initiative gets planActive denormalized');
    assert.equal(init.planTitle, 'Legacy Plan', 'flat initiative gets planTitle denormalized');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
