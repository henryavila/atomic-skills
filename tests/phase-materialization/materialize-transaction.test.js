/**
 * F4/T-006 — materialize transaction fault injection at each publish boundary.
 * Complements materialize-bootstrap.test.js with focused recovery contracts.
 */
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
import { stringify as stringifyYaml } from 'yaml';
import {
  materializePair,
  recoverMaterialize,
  defaultMarkerPath,
  sha256,
} from '../../scripts/materialize-state.js';

function renderMd(frontmatter, body = '\n# body\n') {
  const renderedBody = body.startsWith('\n') ? body : `\n${body}`;
  return `---\n${stringifyYaml(frontmatter)}---${renderedBody}`;
}

function basePlan(overrides = {}) {
  return {
    schemaVersion: '0.1',
    slug: 'demo',
    title: 'Demo',
    status: 'active',
    currentPhase: 'F0',
    phases: [
      { id: 'F0', slug: 'f0', title: 'F0', status: 'done', subPhaseCount: 1 },
      { id: 'F1', slug: 'f1', title: 'F1', status: 'pending', subPhaseCount: 0 },
    ],
    ...overrides,
  };
}

function planAfter() {
  const plan = basePlan({ currentPhase: 'F1' });
  plan.phases = plan.phases.map((p) => (
    p.id === 'F1'
      ? {
        ...p,
        status: 'active',
        subPhaseCount: 2,
        businessIntent: {
          value: 'v', workflow: 'w', rules: 'r', outOfScope: 'o', doneWhen: 'd',
        },
      }
      : { ...p }
  ));
  return plan;
}

function baseInitiative(overrides = {}) {
  return {
    schemaVersion: '0.1',
    slug: 'f1',
    title: 'F1',
    status: 'active',
    phaseId: 'F1',
    parentPlan: 'demo',
    tasks: [
      { id: 'T-001', title: 'One', status: 'pending' },
      { id: 'T-002', title: 'Two', status: 'pending' },
    ],
    exitGates: [],
    businessIntent: {
      value: 'v', workflow: 'w', rules: 'r', outOfScope: 'o', doneWhen: 'd',
    },
    ...overrides,
  };
}

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'as-mat-tx-'));
  const planDir = join(root, '.atomic-skills', 'projects', 'demo', 'demo');
  mkdirSync(join(planDir, 'phases'), { recursive: true });
  const planPath = join(planDir, 'plan.md');
  const initiativePath = join(planDir, 'phases', 'f1.md');
  const planBefore = renderMd(basePlan());
  writeFileSync(planPath, planBefore);
  return {
    root,
    planPath,
    initiativePath,
    planBefore,
    planAfter: renderMd(planAfter()),
    initiativeAfter: renderMd(baseInitiative()),
    cleanup() { rmSync(root, { recursive: true, force: true }); },
  };
}

describe('F4/T-006 materialize transaction', () => {
  it('fault after marker before renames restores prior pair via marker', () => {
    const fx = setup();
    try {
      assert.throws(
        () => materializePair({
          planPath: fx.planPath,
          initiativePath: fx.initiativePath,
          planContent: fx.planAfter,
          initiativeContent: fx.initiativeAfter,
          faultHooks: {
            afterMarkerWrite: () => {
              throw new Error('fault-after-marker');
            },
          },
        }),
        /fault-after-marker/,
      );
      assert.equal(existsSync(defaultMarkerPath(fx.planPath)), true);
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

  it('fault after initiative rename: retry completes from marker (idempotent)', () => {
    const fx = setup();
    try {
      assert.throws(
        () => materializePair({
          planPath: fx.planPath,
          initiativePath: fx.initiativePath,
          planContent: fx.planAfter,
          initiativeContent: fx.initiativeAfter,
          faultHooks: {
            afterInitiativeRename: () => {
              throw new Error('fault-after-init');
            },
          },
        }),
        /fault-after-init/,
      );
      assert.equal(readFileSync(fx.initiativePath, 'utf8'), fx.initiativeAfter);
      assert.equal(readFileSync(fx.planPath, 'utf8'), fx.planBefore);

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

  it('fault after plan rename before cleanup: recover cleans marker without clobber', () => {
    const fx = setup();
    try {
      assert.throws(
        () => materializePair({
          planPath: fx.planPath,
          initiativePath: fx.initiativePath,
          planContent: fx.planAfter,
          initiativeContent: fx.initiativeAfter,
          faultHooks: {
            afterPlanRename: () => {
              throw new Error('fault-after-plan');
            },
          },
        }),
        /fault-after-plan/,
      );
      const rec = recoverMaterialize(defaultMarkerPath(fx.planPath));
      assert.equal(rec.ok, true);
      assert.equal(rec.status, 'completed');
      assert.equal(sha256(readFileSync(fx.planPath, 'utf8')), sha256(fx.planAfter));
      assert.equal(sha256(readFileSync(fx.initiativePath, 'utf8')), sha256(fx.initiativeAfter));
    } finally {
      fx.cleanup();
    }
  });

  it('second complete call is idempotent and leaves no marker', () => {
    const fx = setup();
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
      assert.equal(existsSync(defaultMarkerPath(fx.planPath)), false);
    } finally {
      fx.cleanup();
    }
  });

  it('plan staging lost after initiative rename restores before pair', () => {
    const fx = setup();
    try {
      assert.throws(
        () => materializePair({
          planPath: fx.planPath,
          initiativePath: fx.initiativePath,
          planContent: fx.planAfter,
          initiativeContent: fx.initiativeAfter,
          faultHooks: {
            afterInitiativeRename: () => {
              const marker = JSON.parse(readFileSync(defaultMarkerPath(fx.planPath), 'utf8'));
              const stagePlan = join(dirname(fx.planPath), marker.staging.plan);
              rmSync(stagePlan, { force: true });
              throw new Error('staging-lost');
            },
          },
        }),
        /staging-lost/,
      );
      const rec = recoverMaterialize(defaultMarkerPath(fx.planPath));
      assert.equal(rec.status, 'restored-before');
      assert.equal(existsSync(fx.initiativePath), false);
      assert.equal(readFileSync(fx.planPath, 'utf8'), fx.planBefore);
    } finally {
      fx.cleanup();
    }
  });
});
