import test from 'node:test';
import assert from 'node:assert/strict';

import {
  collectStateIntegrityViolations,
  formatStateIntegrityViolation,
  isTerminalStatus,
} from '../src/state-invariants.js';
import { crossValidate } from '../scripts/validate-state.js';

function plan(overrides = {}) {
  return {
    slug: 'demo',
    __projectId: 'proj',
    status: 'active',
    stateIntegrityHardening: { enforcedFrom: '2026-07-14T19:36:31Z' },
    currentPhase: 'F0',
    phases: [{
      id: 'F0',
      slug: 'demo-f0',
      status: 'active',
      exitGate: { criteria: [{ id: 'F0-G1', status: 'pending' }] },
    }],
    ...overrides,
  };
}

function initiative(overrides = {}) {
  return {
    slug: 'demo-f0',
    __projectId: 'proj',
    parentPlan: 'demo',
    phaseId: 'F0',
    status: 'active',
    tasks: [{ id: 'T-001', status: 'pending' }],
    exitGates: [{ id: 'F0-G1', status: 'pending' }],
    ...overrides,
  };
}

function violations(p = plan(), i = initiative()) {
  return collectStateIntegrityViolations(
    new Map([['proj/demo', p]]),
    i ? new Map([['proj/demo-f0', i]]) : new Map(),
  );
}

test('terminal status authority is explicit and does not treat paused as complete', () => {
  assert.equal(isTerminalStatus('done'), true);
  assert.equal(isTerminalStatus('archived'), true);
  assert.equal(isTerminalStatus('active'), false);
  assert.equal(isTerminalStatus('paused'), false);
  assert.equal(isTerminalStatus('pending'), false);
});

test('descriptor-only pending phase remains a valid lazy state', () => {
  assert.deepEqual(violations(plan({
    currentPhase: 'F1',
    phases: [{ id: 'F1', slug: 'demo-f1', status: 'pending', exitGate: { criteria: [] } }],
  }), null), []);
});

test('pending descriptor rejects every materialized initiative state', () => {
  for (const initiativeStatus of ['active', 'paused', 'done', 'archived']) {
    const out = violations(
      plan({
        currentPhase: 'F0',
        phases: [{ id: 'F0', slug: 'demo-f0', status: 'pending', exitGate: { criteria: [] } }],
      }),
      initiative({ status: initiativeStatus, exitGates: [] }),
    );
    assert.ok(
      out.some((item) => item.code === 'pending-initiative-mismatch'),
      `${initiativeStatus}: ${out.map(formatStateIntegrityViolation).join('\n')}`,
    );
  }
});

test('active, paused, done and archived descriptors require their project-scoped initiative', () => {
  for (const status of ['active', 'paused', 'done', 'archived']) {
    const out = violations(plan({
      currentPhase: 'F0',
      phases: [{ id: 'F0', slug: 'demo-f0', status, exitGate: { criteria: [] } }],
    }), null);
    assert.ok(out.some((v) => v.code === 'missing-initiative'), status);
  }
});

test('non-terminal descriptors reject a terminal initiative match', () => {
  for (const descriptorStatus of ['active', 'paused']) {
    for (const initiativeStatus of ['done', 'archived']) {
      const out = violations(
        plan({
          phases: [{
            id: 'F0', slug: 'demo-f0', status: descriptorStatus,
            exitGate: { criteria: [{ id: 'F0-G1', status: 'pending' }] },
          }],
        }),
        initiative({ status: initiativeStatus }),
      );
      assert.ok(
        out.some((item) => item.code === 'nonterminal-status-mismatch'),
        `${descriptorStatus}/${initiativeStatus}: ${out.map(formatStateIntegrityViolation).join('\n')}`,
      );
    }
  }
});

test('join authority rejects parentPlan, phaseId and slug mismatches', () => {
  const cases = [
    ['parent-plan-mismatch', { parentPlan: 'other' }],
    ['phase-id-mismatch', { phaseId: 'F9' }],
    ['phase-slug-mismatch', { slug: 'other-f0' }],
  ];
  for (const [code, patch] of cases) {
    const out = violations(plan(), initiative(patch));
    assert.ok(out.some((v) => v.code === code), `${code}: ${out.map(formatStateIntegrityViolation).join('\n')}`);
  }
});

test('phase close generation must be absent on both mirrors or match exactly', () => {
  for (const [phaseGeneration, initiativeGeneration] of [[1, undefined], [undefined, 1], [1, 2]]) {
    const out = violations(
      plan({
        phases: [{
          id: 'F0', slug: 'demo-f0', status: 'active', completionGeneration: phaseGeneration,
          exitGate: { criteria: [{ id: 'F0-G1', status: 'pending' }] },
        }],
      }),
      initiative({ completionGeneration: initiativeGeneration }),
    );
    assert.ok(
      out.some((item) => item.code === 'completion-generation-mismatch'),
      `${phaseGeneration}/${initiativeGeneration}: ${out.map(formatStateIntegrityViolation).join('\n')}`,
    );
  }
});

test('hardened materialized initiatives require explicit parentPlan and phaseId identity', () => {
  for (const [code, patch] of [
    ['parent-plan-missing', { parentPlan: undefined }],
    ['phase-id-missing', { phaseId: undefined }],
  ]) {
    const out = violations(plan(), initiative(patch));
    assert.ok(out.some((item) => item.code === code), `${code}: ${out.map(formatStateIntegrityViolation).join('\n')}`);
  }
});

test('duplicate phase, task and gate identities fail with stable codes', () => {
  const duplicatePhases = violations(plan({
    phases: [
      { id: 'F0', slug: 'demo-f0', status: 'pending', exitGate: { criteria: [] } },
      { id: 'F0', slug: 'demo-f0-copy', status: 'pending', exitGate: { criteria: [] } },
      { id: 'F2', slug: 'demo-f0', status: 'pending', exitGate: { criteria: [] } },
    ],
  }), null);
  assert.ok(duplicatePhases.some((v) => v.code === 'duplicate-phase-id'));
  assert.ok(duplicatePhases.some((v) => v.code === 'duplicate-phase-slug'));

  const duplicateMembers = violations(plan({
    phases: [{
      id: 'F0', slug: 'demo-f0', status: 'active',
      exitGate: { criteria: [{ id: 'G1', status: 'pending' }, { id: 'G1', status: 'pending' }] },
    }],
  }), initiative({
    tasks: [{ id: 'T-1', status: 'pending' }, { id: 'T-1', status: 'pending' }],
    exitGates: [{ id: 'G1', status: 'pending' }, { id: 'G1', status: 'pending' }],
  }));
  assert.ok(duplicateMembers.some((v) => v.code === 'duplicate-task-id'));
  assert.ok(duplicateMembers.some((v) => v.code === 'duplicate-plan-gate-id'));
  assert.ok(duplicateMembers.some((v) => v.code === 'duplicate-initiative-gate-id'));
});

test('terminal phase rejects a pending gate and any non-done task', () => {
  const out = violations(
    plan({
      phases: [{ id: 'F0', slug: 'demo-f0', status: 'done', exitGate: { criteria: [{ id: 'G1', status: 'pending' }] } }],
    }),
    initiative({
      status: 'done',
      tasks: [{ id: 'T-1', status: 'pending' }],
      exitGates: [{ id: 'G1', status: 'pending' }],
    }),
  );
  assert.ok(out.some((v) => v.code === 'terminal-open-plan-gate'));
  assert.ok(out.some((v) => v.code === 'terminal-open-initiative-gate'));
  assert.ok(out.some((v) => v.code === 'terminal-open-task'));
});

test('hardened terminal phase rejects deferred gates and met gates without passing evidence', () => {
  for (const gate of [
    { id: 'G1', status: 'deferred', evidence: { passed: true } },
    { id: 'G1', status: 'met' },
    { id: 'G1', status: 'met', evidence: { passed: false } },
  ]) {
    const out = violations(
      plan({
        phases: [{ id: 'F0', slug: 'demo-f0', status: 'done', exitGate: { criteria: [gate] } }],
      }),
      initiative({
        status: 'done', tasks: [{ id: 'T-1', status: 'done' }], exitGates: [gate],
      }),
    );
    assert.ok(out.some((v) => v.code === 'terminal-open-plan-gate'), JSON.stringify(gate));
    assert.ok(out.some((v) => v.code === 'terminal-open-initiative-gate'), JSON.stringify(gate));
  }
});

test('hardened terminal phase requires a bijective plan and initiative gate mirror', () => {
  const gate = { id: 'G1', status: 'met', evidence: { passed: true } };
  const missingInitiativeGate = violations(
    plan({
      phases: [{
        id: 'F0', slug: 'demo-f0', status: 'done',
        reviewGate: { status: 'passed', at: 'a'.repeat(40), mode: 'codex', reviewFile: '.atomic-skills/reviews/r.md' },
        exitGate: { criteria: [gate] },
      }],
    }),
    initiative({ status: 'done', tasks: [{ id: 'T-1', status: 'done' }], exitGates: [] }),
  );
  assert.ok(missingInitiativeGate.some((item) => item.code === 'terminal-gate-mirror-missing'));

  const missingPlanGate = violations(
    plan({
      phases: [{
        id: 'F0', slug: 'demo-f0', status: 'done',
        reviewGate: { status: 'passed', at: 'a'.repeat(40), mode: 'codex', reviewFile: '.atomic-skills/reviews/r.md' },
        exitGate: { criteria: [] },
      }],
    }),
    initiative({ status: 'done', tasks: [{ id: 'T-1', status: 'done' }], exitGates: [gate] }),
  );
  assert.ok(missingPlanGate.some((item) => item.code === 'terminal-gate-mirror-missing'));
});

test('legacy terminal phase retains deferred-gate compatibility outside hardening', () => {
  const deferred = { id: 'G1', status: 'deferred' };
  assert.deepEqual(violations(
    plan({
      stateIntegrityHardening: undefined,
      phases: [{ id: 'F0', slug: 'demo-f0', status: 'done', exitGate: { criteria: [deferred] } }],
    }),
    initiative({
      status: 'done', tasks: [{ id: 'T-1', status: 'done' }], exitGates: [deferred],
    }),
  ), []);
});

test('crossValidate exposes stable integrity codes without losing legacy detail', () => {
  const errors = crossValidate(
    new Map([['proj/demo', plan()]]),
    new Map([['proj/demo-f0', initiative({ parentPlan: 'wrong' })]]),
  );
  assert.ok(errors.some((entry) => entry.errors.some((message) => message.startsWith('[parent-plan-mismatch]'))));
});

test('same phase slug in another project never satisfies the join', () => {
  const plans = new Map([['proj-a/demo', plan({ __projectId: 'proj-a' })]]);
  const initiatives = new Map([['proj-b/demo-f0', initiative({ __projectId: 'proj-b' })]]);
  const out = collectStateIntegrityViolations(plans, initiatives);
  assert.ok(out.some((v) => v.code === 'missing-initiative' && v.projectId === 'proj-a'));
  assert.ok(out.some((v) => v.code === 'orphan-initiative' && v.projectId === 'proj-b'));
});

test('explicit-file cross-validation does not invent missing initiatives outside the supplied slice', () => {
  const p = plan({
    currentPhase: 'F4',
    phases: [
      { id: 'F0', slug: 'demo-f0', status: 'done', exitGate: { criteria: [] } },
      { id: 'F4', slug: 'demo-f4', status: 'active', exitGate: { criteria: [] } },
    ],
  });
  const current = initiative({ slug: 'demo-f4', phaseId: 'F4', exitGates: [] });
  const plans = new Map([['proj/demo', p]]);
  const initiatives = new Map([['proj/demo-f4', current]]);
  assert.ok(crossValidate(plans, initiatives).some((entry) => entry.errors.some((message) => message.includes('[missing-initiative]'))));
  assert.deepEqual(crossValidate(plans, initiatives, { completeGraph: false }), []);
});
