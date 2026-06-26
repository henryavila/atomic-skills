import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildPlanDependencyGraph,
  dependencyBlocks,
  validatePlanDependencyGraph,
} from '../src/plan-dependencies.js';

const plan = (slug, overrides = {}) => ({
  slug,
  status: 'active',
  ...overrides,
});

describe('plan dependency graph', () => {
  it('models a parent plan depending on a child plan and derives the inverse unblocks edge', () => {
    const graph = buildPlanDependencyGraph([
      plan('parent-plan', {
        dependsOnPlans: [{
          plan: 'child-plan',
          createdBy: 'fork-plan',
          origin: { phaseId: 'F2', taskId: 'T-004', mode: 'pause' },
        }],
      }),
      plan('child-plan'),
    ]);

    assert.deepEqual(graph.dependencyEdges, [{
      dependent: 'parent-plan',
      prerequisite: 'child-plan',
      createdBy: 'fork-plan',
      origin: { phaseId: 'F2', taskId: 'T-004', mode: 'pause' },
      release: { archived: 'blocked' },
    }]);
    assert.deepEqual(graph.blockedByPlans['parent-plan'], ['child-plan']);
    assert.deepEqual(graph.unblocksPlans['child-plan'], ['parent-plan']);
    assert.deepEqual(graph.readyPlans, ['child-plan']);
    assert.deepEqual(graph.blockedPlans, ['parent-plan']);
  });

  it('keeps spawnedFrom as origin metadata instead of an implicit dependency', () => {
    const graph = buildPlanDependencyGraph([
      plan('parent-plan'),
      plan('child-plan', {
        spawnedFrom: { plan: 'parent-plan', phaseId: 'F1', taskId: 'T-002', mode: 'parallel' },
      }),
    ]);

    assert.deepEqual(graph.dependencyEdges, []);
    assert.deepEqual(graph.originEdges, [{
      child: 'child-plan',
      parent: 'parent-plan',
      phaseId: 'F1',
      taskId: 'T-002',
      mode: 'parallel',
    }]);
    assert.deepEqual(graph.blockedPlans, []);
    assert.deepEqual(graph.readyPlans, ['parent-plan', 'child-plan']);
  });

  it('reports self-edge and orphan prerequisite errors', () => {
    const errors = validatePlanDependencyGraph([
      plan('parent-plan', {
        dependsOnPlans: [
          { plan: 'parent-plan', createdBy: 'manual' },
          { plan: 'missing-plan', createdBy: 'manual' },
        ],
      }),
    ]);

    assert.deepEqual(errors.map((e) => e.code), ['self-dependency', 'unknown-prerequisite']);
    assert.match(errors[0].message, /parent-plan/);
    assert.match(errors[1].message, /missing-plan/);
  });

  it('reports a transitive dependency cycle', () => {
    const errors = validatePlanDependencyGraph([
      plan('plan-a', { dependsOnPlans: [{ plan: 'plan-b', createdBy: 'manual' }] }),
      plan('plan-b', { dependsOnPlans: [{ plan: 'plan-c', createdBy: 'manual' }] }),
      plan('plan-c', { dependsOnPlans: [{ plan: 'plan-a', createdBy: 'manual' }] }),
    ]);

    assert.equal(errors.length, 1);
    assert.equal(errors[0].code, 'dependency-cycle');
    assert.deepEqual(errors[0].cycle, ['plan-a', 'plan-b', 'plan-c', 'plan-a']);
  });

  it('treats archived prerequisites as blocking unless the edge records resolution', () => {
    const blocked = buildPlanDependencyGraph([
      plan('parent-plan', { dependsOnPlans: [{ plan: 'child-plan', createdBy: 'manual' }] }),
      plan('child-plan', { status: 'archived' }),
    ]);
    assert.deepEqual(blocked.blockedByPlans['parent-plan'], ['child-plan']);
    assert.equal(dependencyBlocks(blocked.dependencyEdges[0], blocked.planBySlug.get('child-plan')), true);

    const resolved = buildPlanDependencyGraph([
      plan('parent-plan', {
        dependsOnPlans: [{ plan: 'child-plan', createdBy: 'manual', release: { archived: 'resolved' } }],
      }),
      plan('child-plan', { status: 'archived' }),
    ]);
    assert.deepEqual(resolved.blockedByPlans['parent-plan'], []);
    assert.equal(dependencyBlocks(resolved.dependencyEdges[0], resolved.planBySlug.get('child-plan')), false);
  });

  it('accepts legacy plans without dependsOnPlans', () => {
    const graph = buildPlanDependencyGraph([
      plan('legacy-parent'),
      plan('legacy-child', { spawnedFrom: { plan: 'legacy-parent', phaseId: 'F0', mode: 'pause' } }),
    ]);

    assert.deepEqual(graph.dependencyEdges, []);
    assert.deepEqual(graph.errors, []);
  });
});
