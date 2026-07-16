import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { stringify as stringifyYaml } from 'yaml';
import {
  materializePair,
  recoverMaterialize,
  defaultMarkerPath,
  validateStagedPair,
} from '../../scripts/materialize-state.js';
import { parseFrontmatter } from '../../scripts/validate-state.js';

function sha256(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function renderMd(frontmatter, body = '\n# body\n') {
  const renderedBody = body.startsWith('\n') ? body : `\n${body}`;
  return `---\n${stringifyYaml(frontmatter)}---${renderedBody}`;
}

function basePlan(overrides = {}) {
  return {
    schemaVersion: '0.1',
    slug: 'demo',
    title: 'Demo plan',
    status: 'active',
    currentPhase: 'F0',
    phases: [
      {
        id: 'F0',
        slug: 'f0-foundation',
        title: 'Foundation',
        status: 'done',
        subPhaseCount: 1,
      },
      {
        id: 'F1',
        slug: 'f1-next',
        title: 'Next',
        status: 'pending',
        subPhaseCount: 0,
      },
    ],
    ...overrides,
  };
}

function planAfterF1Active() {
  const plan = basePlan({
    currentPhase: 'F1',
    lastUpdated: '2026-07-01T10:00:00.000Z',
  });
  plan.phases = plan.phases.map((phase) => {
    if (phase.id === 'F1') {
      return {
        ...phase,
        status: 'active',
        subPhaseCount: 2,
        businessIntent: {
          value: 'v',
          workflow: 'w',
          rules: 'r',
          outOfScope: 'o',
          doneWhen: 'd',
        },
      };
    }
    return { ...phase };
  });
  return plan;
}

function baseInitiative(overrides = {}) {
  return {
    schemaVersion: '0.1',
    slug: 'f1-next',
    title: 'Next',
    status: 'active',
    phaseId: 'F1',
    parentPlan: 'demo',
    tasks: [
      { id: 'T-001', title: 'One', status: 'pending' },
      { id: 'T-002', title: 'Two', status: 'pending' },
    ],
    exitGates: [],
    businessIntent: {
      value: 'v',
      workflow: 'w',
      rules: 'r',
      outOfScope: 'o',
      doneWhen: 'd',
    },
    ...overrides,
  };
}

function setupFixture() {
  const root = mkdtempSync(join(tmpdir(), 'as-materialize-boot-'));
  const planDir = join(root, '.atomic-skills', 'projects', 'demo', 'demo');
  const phasesDir = join(planDir, 'phases');
  mkdirSync(phasesDir, { recursive: true });
  const planPath = join(planDir, 'plan.md');
  const initiativePath = join(phasesDir, 'f1-next.md');
  const planBefore = renderMd(basePlan());
  writeFileSync(planPath, planBefore, 'utf8');
  return {
    root,
    planPath,
    initiativePath,
    planBefore,
    planAfter: renderMd(planAfterF1Active()),
    initiativeAfter: renderMd(baseInitiative()),
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

function readPlanPhaseStatus(planPath, phaseId) {
  const { frontmatter } = parseFrontmatter(readFileSync(planPath, 'utf8'));
  return frontmatter.phases.find((p) => p.id === phaseId)?.status;
}

describe('T-005 materialize-state bootstrap', () => {
  it('invalid staged pair leaves live bytes untouched and publishes no marker', () => {
    const fx = setupFixture();
    try {
      const planBeforeHash = sha256(fx.planBefore);
      assert.equal(existsSync(fx.initiativePath), false);

      assert.throws(
        () => materializePair({
          planPath: fx.planPath,
          initiativePath: fx.initiativePath,
          planContent: fx.planAfter,
          initiativeContent: 'not valid yaml frontmatter at all',
        }),
        /invalid|YAML|frontmatter|staged/i,
      );

      assert.equal(readFileSync(fx.planPath, 'utf8'), fx.planBefore);
      assert.equal(sha256(readFileSync(fx.planPath, 'utf8')), planBeforeHash);
      assert.equal(existsSync(fx.initiativePath), false);
      assert.equal(existsSync(defaultMarkerPath(fx.planPath)), false);

      assert.throws(
        () => materializePair({
          planPath: fx.planPath,
          initiativePath: fx.initiativePath,
          // plan missing phases entirely
          planContent: renderMd({
            schemaVersion: '0.1',
            slug: 'demo',
            title: 'Demo',
            status: 'active',
          }),
          initiativeContent: fx.initiativeAfter,
        }),
        /phase|phases|invalid|staged/i,
      );

      assert.equal(readFileSync(fx.planPath, 'utf8'), fx.planBefore);
      assert.equal(existsSync(defaultMarkerPath(fx.planPath)), false);
      assert.equal(existsSync(fx.initiativePath), false);

      // F-003: phaseId is required (slug alone is not enough); must match a plan phase.
      assert.throws(
        () => validateStagedPair(
          fx.planAfter,
          renderMd(baseInitiative({ phaseId: undefined, slug: 'totally-wrong-phase' })),
        ),
        /missing phaseId/i,
      );
      assert.throws(
        () => materializePair({
          planPath: fx.planPath,
          initiativePath: fx.initiativePath,
          planContent: fx.planAfter,
          initiativeContent: renderMd(baseInitiative({ phaseId: undefined, slug: 'orphan-slug' })),
        }),
        /missing phaseId/i,
      );
      assert.throws(
        () => validateStagedPair(
          fx.planAfter,
          renderMd(baseInitiative({ phaseId: 'F9' })),
        ),
        /plan has no phase F9/i,
      );
      assert.equal(readFileSync(fx.planPath, 'utf8'), fx.planBefore);
      assert.equal(existsSync(fx.initiativePath), false);
      assert.equal(existsSync(defaultMarkerPath(fx.planPath)), false);
    } finally {
      fx.cleanup();
    }
  });

  it('happy path: both files reach after content, marker removed, initiative before plan active', () => {
    const fx = setupFixture();
    try {
      const order = [];
      const result = materializePair({
        planPath: fx.planPath,
        initiativePath: fx.initiativePath,
        planContent: fx.planAfter,
        initiativeContent: fx.initiativeAfter,
        faultHooks: {
          afterInitiativeRename: () => {
            order.push('initiative');
            assert.equal(existsSync(fx.initiativePath), true);
            assert.equal(readFileSync(fx.initiativePath, 'utf8'), fx.initiativeAfter);
            // Plan must still be prior content — not yet declaring F1 active.
            assert.equal(readFileSync(fx.planPath, 'utf8'), fx.planBefore);
            assert.equal(readPlanPhaseStatus(fx.planPath, 'F1'), 'pending');
          },
          afterPlanRename: () => {
            order.push('plan');
            assert.equal(readFileSync(fx.planPath, 'utf8'), fx.planAfter);
            assert.equal(readPlanPhaseStatus(fx.planPath, 'F1'), 'active');
            assert.equal(existsSync(fx.initiativePath), true);
          },
        },
      });

      assert.equal(result.ok, true);
      assert.deepEqual(order, ['initiative', 'plan']);
      assert.equal(readFileSync(fx.planPath, 'utf8'), fx.planAfter);
      assert.equal(readFileSync(fx.initiativePath, 'utf8'), fx.initiativeAfter);
      assert.equal(existsSync(defaultMarkerPath(fx.planPath)), false);
      assert.equal(existsSync(`${fx.planPath}.materialize-stage`), false);
      assert.equal(existsSync(`${fx.initiativePath}.materialize-stage`), false);
    } finally {
      fx.cleanup();
    }
  });

  it('fault after initiative rename leaves recoverable marker; retry completes', () => {
    const fx = setupFixture();
    try {
      assert.throws(
        () => materializePair({
          planPath: fx.planPath,
          initiativePath: fx.initiativePath,
          planContent: fx.planAfter,
          initiativeContent: fx.initiativeAfter,
          faultHooks: {
            afterInitiativeRename: () => {
              throw new Error('injected-fault-after-initiative');
            },
          },
        }),
        /injected-fault-after-initiative/,
      );

      assert.equal(existsSync(defaultMarkerPath(fx.planPath)), true);
      assert.equal(readFileSync(fx.initiativePath, 'utf8'), fx.initiativeAfter);
      assert.equal(readFileSync(fx.planPath, 'utf8'), fx.planBefore);
      assert.equal(readPlanPhaseStatus(fx.planPath, 'F1'), 'pending');

      const retry = materializePair({
        planPath: fx.planPath,
        initiativePath: fx.initiativePath,
        planContent: fx.planAfter,
        initiativeContent: fx.initiativeAfter,
      });
      assert.equal(retry.ok, true);
      assert.equal(retry.recovered, true);
      assert.equal(readFileSync(fx.planPath, 'utf8'), fx.planAfter);
      assert.equal(readFileSync(fx.initiativePath, 'utf8'), fx.initiativeAfter);
      assert.equal(existsSync(defaultMarkerPath(fx.planPath)), false);
    } finally {
      fx.cleanup();
    }
  });

  it('fault after plan rename before cleanup: retry cleans up', () => {
    const fx = setupFixture();
    try {
      assert.throws(
        () => materializePair({
          planPath: fx.planPath,
          initiativePath: fx.initiativePath,
          planContent: fx.planAfter,
          initiativeContent: fx.initiativeAfter,
          faultHooks: {
            afterPlanRename: () => {
              throw new Error('injected-fault-after-plan');
            },
          },
        }),
        /injected-fault-after-plan/,
      );

      assert.equal(existsSync(defaultMarkerPath(fx.planPath)), true);
      assert.equal(readFileSync(fx.planPath, 'utf8'), fx.planAfter);
      assert.equal(readFileSync(fx.initiativePath, 'utf8'), fx.initiativeAfter);

      const retry = recoverMaterialize(defaultMarkerPath(fx.planPath));
      assert.equal(retry.ok, true);
      assert.equal(retry.status, 'completed');
      assert.equal(existsSync(defaultMarkerPath(fx.planPath)), false);
      assert.equal(readFileSync(fx.planPath, 'utf8'), fx.planAfter);
      assert.equal(readFileSync(fx.initiativePath, 'utf8'), fx.initiativeAfter);
    } finally {
      fx.cleanup();
    }
  });

  it('ambiguous live hash (external write) fails closed without clobber', () => {
    const fx = setupFixture();
    try {
      assert.throws(
        () => materializePair({
          planPath: fx.planPath,
          initiativePath: fx.initiativePath,
          planContent: fx.planAfter,
          initiativeContent: fx.initiativeAfter,
          faultHooks: {
            afterInitiativeRename: () => {
              throw new Error('stop-mid-tx');
            },
          },
        }),
        /stop-mid-tx/,
      );

      // External actor rewrites initiative to content outside {before, after}.
      const external = renderMd(baseInitiative({ title: 'EXTERNAL CLOBBER' }));
      writeFileSync(fx.initiativePath, external, 'utf8');
      const externalHash = sha256(external);
      const planSnap = readFileSync(fx.planPath, 'utf8');

      assert.throws(
        () => recoverMaterialize(defaultMarkerPath(fx.planPath)),
        /ambiguous|outside|fail closed|conflict/i,
      );

      assert.equal(readFileSync(fx.initiativePath, 'utf8'), external);
      assert.equal(sha256(readFileSync(fx.initiativePath, 'utf8')), externalHash);
      assert.equal(readFileSync(fx.planPath, 'utf8'), planSnap);
      // Marker retained so operator can inspect; no destructive cleanup.
      assert.equal(existsSync(defaultMarkerPath(fx.planPath)), true);
    } finally {
      fx.cleanup();
    }
  });

  it('staging lost after marker: restore before pair when live still matches before', () => {
    const fx = setupFixture();
    try {
      // Begin tx then fault before any rename by deleting staging after marker.
      // Simulate: marker written, staging files removed, lives still at before.
      assert.throws(
        () => materializePair({
          planPath: fx.planPath,
          initiativePath: fx.initiativePath,
          planContent: fx.planAfter,
          initiativeContent: fx.initiativeAfter,
          faultHooks: {
            afterMarkerWrite: () => {
              // Remove staging so recovery must restore/clean to prior pair.
              const marker = JSON.parse(readFileSync(defaultMarkerPath(fx.planPath), 'utf8'));
              const stagePlan = join(dirname(fx.planPath), marker.staging.plan);
              const stageInit = join(dirname(fx.planPath), marker.staging.initiative);
              if (existsSync(stagePlan)) rmSync(stagePlan, { force: true });
              if (existsSync(stageInit)) rmSync(stageInit, { force: true });
              throw new Error('stop-after-marker-staging-gone');
            },
          },
        }),
        /stop-after-marker-staging-gone/,
      );

      assert.equal(existsSync(defaultMarkerPath(fx.planPath)), true);
      assert.equal(existsSync(fx.initiativePath), false);
      assert.equal(readFileSync(fx.planPath, 'utf8'), fx.planBefore);

      const recovered = recoverMaterialize(defaultMarkerPath(fx.planPath));
      assert.equal(recovered.ok, true);
      assert.equal(recovered.status, 'restored-before');
      assert.equal(readFileSync(fx.planPath, 'utf8'), fx.planBefore);
      assert.equal(existsSync(fx.initiativePath), false);
      assert.equal(existsSync(defaultMarkerPath(fx.planPath)), false);
    } finally {
      fx.cleanup();
    }
  });

  it('F-001: plan staging lost after initiative rename restores before (drops initiative)', () => {
    const fx = setupFixture();
    try {
      assert.throws(
        () => materializePair({
          planPath: fx.planPath,
          initiativePath: fx.initiativePath,
          planContent: fx.planAfter,
          initiativeContent: fx.initiativeAfter,
          faultHooks: {
            afterInitiativeRename: () => {
              // Initiative published; plan still before. Wipe plan staging so recovery
              // cannot complete-from-staging and must restoreBeforePair.
              const marker = JSON.parse(readFileSync(defaultMarkerPath(fx.planPath), 'utf8'));
              const baseDir = dirname(fx.planPath);
              const stagePlan = join(baseDir, marker.staging.plan);
              assert.equal(existsSync(stagePlan), true);
              rmSync(stagePlan, { force: true });
              // Initiative staging residue should already be gone (renamed to live).
              throw new Error('stop-after-init-plan-staging-gone');
            },
          },
        }),
        /stop-after-init-plan-staging-gone/,
      );

      assert.equal(existsSync(defaultMarkerPath(fx.planPath)), true);
      assert.equal(readFileSync(fx.initiativePath, 'utf8'), fx.initiativeAfter);
      assert.equal(readFileSync(fx.planPath, 'utf8'), fx.planBefore);
      assert.equal(existsSync(`${fx.planPath}.materialize-stage`), false);

      const recovered = recoverMaterialize(defaultMarkerPath(fx.planPath));
      assert.equal(recovered.ok, true);
      assert.equal(recovered.status, 'restored-before');
      assert.equal(readFileSync(fx.planPath, 'utf8'), fx.planBefore);
      // before === null for initiative → published after bytes are unlinked.
      assert.equal(existsSync(fx.initiativePath), false);
      assert.equal(existsSync(defaultMarkerPath(fx.planPath)), false);
      assert.equal(readPlanPhaseStatus(fx.planPath, 'F1'), 'pending');

      // Retry after restore completes a clean materialize (proves gate is not stuck).
      const retry = materializePair({
        planPath: fx.planPath,
        initiativePath: fx.initiativePath,
        planContent: fx.planAfter,
        initiativeContent: fx.initiativeAfter,
      });
      assert.equal(retry.ok, true);
      assert.equal(readFileSync(fx.planPath, 'utf8'), fx.planAfter);
      assert.equal(readFileSync(fx.initiativePath, 'utf8'), fx.initiativeAfter);
      assert.equal(existsSync(defaultMarkerPath(fx.planPath)), false);
    } finally {
      fx.cleanup();
    }
  });

  it('F-001: plan staging lost after initiative rename fails closed when before-backup missing', () => {
    const fx = setupFixture();
    try {
      // Craft mid-flight state: initiative at after, plan at before, staging gone.
      // Initiative before was non-null (replacement) but its before-backup is absent,
      // so restoreBeforePair cannot undo the published after bytes.
      const priorInitiative = renderMd(baseInitiative({ title: 'prior-before-content' }));
      writeFileSync(fx.initiativePath, fx.initiativeAfter, 'utf8');
      const markerPath = defaultMarkerPath(fx.planPath);
      const marker = {
        version: 1,
        txId: 'test-fail-closed-no-backup',
        createdAt: new Date().toISOString(),
        plan: {
          path: 'plan.md',
          before: sha256(fx.planBefore),
          after: sha256(fx.planAfter),
        },
        initiative: {
          path: 'phases/f1-next.md',
          before: sha256(priorInitiative),
          after: sha256(fx.initiativeAfter),
        },
        staging: {
          plan: 'plan.md.materialize-stage',
          initiative: 'phases/f1-next.md.materialize-stage',
          planBefore: null,
          initiativeBefore: null,
        },
      };
      writeFileSync(markerPath, `${JSON.stringify(marker, null, 2)}\n`, 'utf8');

      assert.throws(
        () => recoverMaterialize(markerPath),
        /plan staging lost after initiative rename|before-pair backup unavailable|fail closed/i,
      );

      // Live state left for operator inspection; marker retained (no destructive cleanup).
      assert.equal(existsSync(markerPath), true);
      assert.equal(readFileSync(fx.initiativePath, 'utf8'), fx.initiativeAfter);
      assert.equal(readFileSync(fx.planPath, 'utf8'), fx.planBefore);
    } finally {
      fx.cleanup();
    }
  });

  it('idempotent retry after complete success is a no-op / clean', () => {
    const fx = setupFixture();
    try {
      const first = materializePair({
        planPath: fx.planPath,
        initiativePath: fx.initiativePath,
        planContent: fx.planAfter,
        initiativeContent: fx.initiativeAfter,
      });
      assert.equal(first.ok, true);

      const second = materializePair({
        planPath: fx.planPath,
        initiativePath: fx.initiativePath,
        planContent: fx.planAfter,
        initiativeContent: fx.initiativeAfter,
      });
      assert.equal(second.ok, true);
      assert.equal(second.idempotent, true);
      assert.equal(readFileSync(fx.planPath, 'utf8'), fx.planAfter);
      assert.equal(readFileSync(fx.initiativePath, 'utf8'), fx.initiativeAfter);
      assert.equal(existsSync(defaultMarkerPath(fx.planPath)), false);
    } finally {
      fx.cleanup();
    }
  });

  it('observational: never leaves plan phase active while initiative file is missing', () => {
    const fx = setupFixture();
    try {
      // Mid-tx after initiative only: plan must still be pending.
      assert.throws(
        () => materializePair({
          planPath: fx.planPath,
          initiativePath: fx.initiativePath,
          planContent: fx.planAfter,
          initiativeContent: fx.initiativeAfter,
          faultHooks: {
            afterInitiativeRename: () => {
              assert.equal(existsSync(fx.initiativePath), true);
              assert.notEqual(readPlanPhaseStatus(fx.planPath, 'F1'), 'active');
              throw new Error('observe-mid');
            },
          },
        }),
        /observe-mid/,
      );
      assert.equal(existsSync(fx.initiativePath), true);
      assert.notEqual(readPlanPhaseStatus(fx.planPath, 'F1'), 'active');

      // Complete path: active only with initiative present.
      materializePair({
        planPath: fx.planPath,
        initiativePath: fx.initiativePath,
        planContent: fx.planAfter,
        initiativeContent: fx.initiativeAfter,
      });
      assert.equal(existsSync(fx.initiativePath), true);
      assert.equal(readPlanPhaseStatus(fx.planPath, 'F1'), 'active');
    } finally {
      fx.cleanup();
    }
  });

  it('refuses when initiative already exists (clean state) with different content', () => {
    const fx = setupFixture();
    try {
      writeFileSync(fx.initiativePath, renderMd(baseInitiative({ title: 'pre-existing' })), 'utf8');
      assert.throws(
        () => materializePair({
          planPath: fx.planPath,
          initiativePath: fx.initiativePath,
          planContent: fx.planAfter,
          initiativeContent: fx.initiativeAfter,
        }),
        /already exists|already materialized/i,
      );
      assert.equal(readFileSync(fx.planPath, 'utf8'), fx.planBefore);
    } finally {
      fx.cleanup();
    }
  });
});
