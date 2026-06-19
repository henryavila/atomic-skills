import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildAdjacency, reachable, wouldCreateCycle, hasCycle } from '../src/spawn-graph.js';

describe('spawn-graph buildAdjacency', () => {
  it('flattens spawnedPlans (per phase) into parent→child adjacency, deduped', () => {
    const adj = buildAdjacency([
      { slug: 'A', spawnedPlans: { F1: ['B'], F3: ['C', 'B'] } },
      { slug: 'B', spawnedPlans: { F2: ['D'] } },
      { slug: 'C' },
    ]);
    assert.deepEqual(new Set(adj.A), new Set(['B', 'C']));
    assert.deepEqual(adj.B, ['D']);
    assert.deepEqual(adj.C ?? [], []);
  });

  it('ignores malformed entries (no slug)', () => {
    const adj = buildAdjacency([null, {}, { slug: 'A', spawnedPlans: { F1: ['B'] } }]);
    assert.deepEqual(adj.A, ['B']);
  });
});

describe('spawn-graph reachable', () => {
  const adj = { A: ['B'], B: ['C'], C: [] };

  it('follows directed edges transitively', () => {
    assert.equal(reachable(adj, 'A', 'C'), true);
    assert.equal(reachable(adj, 'A', 'B'), true);
  });

  it('is directional — C cannot reach A', () => {
    assert.equal(reachable(adj, 'C', 'A'), false);
  });

  it('returns false for an unknown start node', () => {
    assert.equal(reachable(adj, 'Z', 'A'), false);
  });

  it('terminates on a cyclic graph instead of looping forever', () => {
    assert.equal(reachable({ A: ['B'], B: ['A'] }, 'A', 'C'), false);
  });
});

describe('spawn-graph wouldCreateCycle (T-003 acceptance)', () => {
  it('rejects a self-fork', () => {
    assert.equal(wouldCreateCycle({}, 'A', 'A'), true);
  });

  it('rejects a fork pointing back to a direct parent', () => {
    // A spawned B (A→B). Forking B→A points to an ancestor → cycle.
    assert.equal(wouldCreateCycle({ A: ['B'] }, 'B', 'A'), true);
  });

  it('rejects a fork pointing to a transitive ancestor', () => {
    // A→B→C. Forking C→A closes a loop.
    assert.equal(wouldCreateCycle({ A: ['B'], B: ['C'] }, 'C', 'A'), true);
  });

  it('accepts an acyclic fork (brand-new child)', () => {
    assert.equal(wouldCreateCycle({ A: ['B'], B: ['C'] }, 'C', 'D'), false);
    assert.equal(wouldCreateCycle({ A: ['B'] }, 'A', 'C'), false);
  });

  it('accepts forking from a leaf into a fresh child (no back-path)', () => {
    assert.equal(wouldCreateCycle({ A: ['B'] }, 'B', 'C'), false);
  });
});

describe('spawn-graph hasCycle', () => {
  it('detects a cycle in an existing graph', () => {
    assert.equal(hasCycle({ A: ['B'], B: ['C'], C: ['A'] }), true);
  });

  it('returns false for an acyclic chain/tree (diamond)', () => {
    assert.equal(hasCycle({ A: ['B', 'C'], B: ['D'], C: ['D'], D: [] }), false);
  });

  it('detects a self-loop', () => {
    assert.equal(hasCycle({ A: ['A'] }), true);
  });
});
