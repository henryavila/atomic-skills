/**
 * F4/T-001 — state identity, terminality, and uniqueness authority.
 *
 * Contract fixtures for src/state-invariants.js + its wiring through
 * scripts/validate-state.js crossValidate. Red reproductions of the
 * false-green skip at validate-state.js (missing initiative for done phase)
 * and the adversarial shapes listed in integrity-remediation F4/T-001.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STATE_INTEGRITY_CODES,
  isValidLazyDescriptor,
  resolvePhaseInitiative,
  checkUniqueIds,
  checkTerminalGates,
  collectStateIntegrityErrors,
  formatIntegrityError,
} from '../src/state-invariants.js';
import { crossValidate } from '../scripts/validate-state.js';

const codesIn = (errors) => {
  const list = Array.isArray(errors)
    ? errors.flatMap((e) => (Array.isArray(e.errors) ? e.errors : [e]))
    : [];
  return list.map((e) => {
    if (e && typeof e === 'object' && e.code) return e.code;
    const m = String(e).match(/^\[([a-z0-9-]+)\]/i);
    return m ? m[1] : null;
  }).filter(Boolean);
};

const hasCode = (errors, code) => codesIn(errors).includes(code);

// --- pure helpers ------------------------------------------------------------

test('isValidLazyDescriptor: pending + subPhaseCount 0 + sidecar → true', () => {
  assert.equal(
    isValidLazyDescriptor({ status: 'pending', subPhaseCount: 0 }, { hasSidecar: true }),
    true,
  );
});

test('isValidLazyDescriptor: rejects active/paused/done or missing sidecar/nonzero count', () => {
  assert.equal(isValidLazyDescriptor({ status: 'active', subPhaseCount: 0 }, { hasSidecar: true }), false);
  assert.equal(isValidLazyDescriptor({ status: 'paused', subPhaseCount: 0 }, { hasSidecar: true }), false);
  assert.equal(isValidLazyDescriptor({ status: 'done', subPhaseCount: 0 }, { hasSidecar: true }), false);
  assert.equal(isValidLazyDescriptor({ status: 'pending', subPhaseCount: 0 }, { hasSidecar: false }), false);
  assert.equal(isValidLazyDescriptor({ status: 'pending', subPhaseCount: 3 }, { hasSidecar: true }), false);
  assert.equal(isValidLazyDescriptor({ status: 'pending', subPhaseCount: 0 }, {}), false);
});

test('resolvePhaseInitiative: joins by projectId + plan + phase slug (not bare slug alone)', () => {
  const plan = { slug: 'p', __projectId: 'proj-a' };
  const phase = { id: 'F0', slug: 'p-f0' };
  const inits = new Map([
    ['proj-b/p-f0', { slug: 'p-f0', __projectId: 'proj-b', parentPlan: 'other', phaseId: 'F0' }],
    ['proj-a/p-f0', { slug: 'p-f0', __projectId: 'proj-a', parentPlan: 'p', phaseId: 'F0' }],
  ]);
  const hit = resolvePhaseInitiative(plan, phase, inits);
  assert.equal(hit.kind, 'matched');
  assert.equal(hit.initiative.__projectId, 'proj-a');
  assert.equal(hit.initiative.parentPlan, 'p');
});

test('resolvePhaseInitiative: bare-slug foreign-project match is slug-collision', () => {
  const plan = { slug: 'p', __projectId: 'proj-a' };
  const phase = { id: 'F0', slug: 'p-f0' };
  // Map only has a bare key whose __projectId is a different project — must not join.
  const inits = new Map([
    ['p-f0', { slug: 'p-f0', __projectId: 'proj-b', parentPlan: 'other', phaseId: 'F0' }],
  ]);
  const hit = resolvePhaseInitiative(plan, phase, inits);
  assert.equal(hit.kind, 'slug-collision');
  assert.equal(hit.code, STATE_INTEGRITY_CODES.SLUG_COLLISION);
});

test('resolvePhaseInitiative: identity mismatch when parentPlan/phaseId disagree', () => {
  const plan = { slug: 'p', __projectId: 'proj' };
  const phase = { id: 'F0', slug: 'p-f0' };
  const inits = new Map([
    ['proj/p-f0', {
      slug: 'p-f0',
      __projectId: 'proj',
      parentPlan: 'other-plan',
      phaseId: 'F9',
    }],
  ]);
  const hit = resolvePhaseInitiative(plan, phase, inits);
  assert.equal(hit.kind, 'identity-mismatch');
  assert.equal(hit.code, STATE_INTEGRITY_CODES.IDENTITY_MISMATCH);
});

test('checkUniqueIds: duplicate phase/task/gate ids yield stable codes', () => {
  const plan = {
    slug: 'p',
    phases: [
      { id: 'F0', slug: 'a', exitGate: { criteria: [{ id: 'G1' }, { id: 'G1' }] } },
      { id: 'F0', slug: 'b', exitGate: { criteria: [] } },
    ],
  };
  const init = {
    slug: 'a',
    tasks: [{ id: 'T-001' }, { id: 'T-001' }],
    exitGates: [{ id: 'G1' }, { id: 'G1' }],
  };
  const errs = checkUniqueIds({ plan, initiative: init });
  assert.ok(errs.some((e) => e.code === STATE_INTEGRITY_CODES.DUPLICATE_PHASE_ID));
  assert.ok(errs.some((e) => e.code === STATE_INTEGRITY_CODES.DUPLICATE_TASK_ID));
  assert.ok(errs.some((e) => e.code === STATE_INTEGRITY_CODES.DUPLICATE_GATE_ID));
});

test('checkTerminalGates: done/archived phase with pending gate → terminal-pending-gate', () => {
  const done = checkTerminalGates({
    id: 'F0',
    status: 'done',
    exitGate: { criteria: [{ id: 'G1', status: 'pending' }] },
  });
  assert.equal(done.length, 1);
  assert.equal(done[0].code, STATE_INTEGRITY_CODES.TERMINAL_PENDING_GATE);

  const archived = checkTerminalGates({
    id: 'F1',
    status: 'archived',
    exitGate: { criteria: [{ id: 'G1', status: 'pending' }] },
  });
  assert.equal(archived[0].code, STATE_INTEGRITY_CODES.TERMINAL_PENDING_GATE);

  const active = checkTerminalGates({
    id: 'F2',
    status: 'active',
    exitGate: { criteria: [{ id: 'G1', status: 'pending' }] },
  });
  assert.equal(active.length, 0);
});

// --- collectStateIntegrityErrors (corpus-shaped) -----------------------------

test('collectStateIntegrityErrors: descriptor-only pending + sidecar + subPhaseCount 0 passes', () => {
  const plans = new Map([['proj/p', {
    slug: 'p',
    __projectId: 'proj',
    phases: [{
      id: 'F1',
      slug: 'p-f1',
      status: 'pending',
      subPhaseCount: 0,
      exitGate: { criteria: [] },
    }],
  }]]);
  const inits = new Map();
  const sidecars = new Set(['proj/p/p-f1']);
  const errs = collectStateIntegrityErrors(plans, inits, { sidecars });
  assert.deepEqual(errs, []);
});

test('collectStateIntegrityErrors: active/paused/done without initiative → missing-initiative', () => {
  for (const status of ['active', 'paused', 'done']) {
    const plans = new Map([['proj/p', {
      slug: 'p',
      __projectId: 'proj',
      phases: [{
        id: 'F0',
        slug: 'p-f0',
        status,
        subPhaseCount: 0,
        exitGate: { criteria: [] },
      }],
    }]]);
    const errs = collectStateIntegrityErrors(plans, new Map(), { sidecars: new Set(['proj/p/p-f0']) });
    assert.ok(
      errs.some((e) => e.code === STATE_INTEGRITY_CODES.MISSING_INITIATIVE),
      `status=${status} must reject missing initiative`,
    );
  }
});

test('collectStateIntegrityErrors: identity mismatch and slug collision return stable codes', () => {
  const plans = new Map([['proj-a/p', {
    slug: 'p',
    __projectId: 'proj-a',
    phases: [{
      id: 'F0',
      slug: 'shared-slug',
      status: 'active',
      exitGate: { criteria: [] },
    }],
  }]]);
  // Foreign project, same phase slug, stored under bare key (collision risk).
  const inits = new Map([
    ['shared-slug', {
      slug: 'shared-slug',
      __projectId: 'proj-b',
      parentPlan: 'other',
      phaseId: 'F0',
    }],
  ]);
  const errs = collectStateIntegrityErrors(plans, inits, { sidecars: new Set() });
  assert.ok(errs.some((e) => e.code === STATE_INTEGRITY_CODES.SLUG_COLLISION
    || e.code === STATE_INTEGRITY_CODES.MISSING_INITIATIVE));

  const mismatchInits = new Map([
    ['proj-a/shared-slug', {
      slug: 'shared-slug',
      __projectId: 'proj-a',
      parentPlan: 'wrong',
      phaseId: 'FX',
    }],
  ]);
  const mismatchErrs = collectStateIntegrityErrors(plans, mismatchInits, { sidecars: new Set() });
  assert.ok(mismatchErrs.some((e) => e.code === STATE_INTEGRITY_CODES.IDENTITY_MISMATCH));
});

test('collectStateIntegrityErrors: duplicate ids + terminal pending gate', () => {
  const plans = new Map([['p', {
    slug: 'p',
    phases: [
      {
        id: 'F0',
        slug: 'p-f0',
        status: 'done',
        exitGate: { criteria: [{ id: 'G1', status: 'pending' }, { id: 'G1', status: 'met' }] },
      },
      {
        id: 'F0',
        slug: 'p-f0-dup',
        status: 'pending',
        subPhaseCount: 0,
        exitGate: { criteria: [] },
      },
    ],
  }]]);
  const inits = new Map([['p-f0', {
    slug: 'p-f0',
    status: 'done',
    parentPlan: 'p',
    phaseId: 'F0',
    tasks: [{ id: 'T-001', status: 'done' }, { id: 'T-001', status: 'done' }],
    exitGates: [{ id: 'G1', status: 'met' }],
  }]]);
  const errs = collectStateIntegrityErrors(plans, inits, {
    sidecars: new Set(['__legacy/p/p-f0-dup']),
  });
  assert.ok(hasCode(errs, STATE_INTEGRITY_CODES.DUPLICATE_PHASE_ID));
  assert.ok(hasCode(errs, STATE_INTEGRITY_CODES.DUPLICATE_GATE_ID));
  assert.ok(hasCode(errs, STATE_INTEGRITY_CODES.DUPLICATE_TASK_ID));
  assert.ok(hasCode(errs, STATE_INTEGRITY_CODES.TERMINAL_PENDING_GATE));
});

test('formatIntegrityError prefixes stable code', () => {
  const msg = formatIntegrityError({
    code: STATE_INTEGRITY_CODES.MISSING_INITIATIVE,
    message: 'phase F0 has no initiative',
  });
  assert.equal(msg, `[${STATE_INTEGRITY_CODES.MISSING_INITIATIVE}] phase F0 has no initiative`);
});

// --- crossValidate wiring (false-green skip closed) --------------------------

test('crossValidate: done phase + no matching initiative → missing-initiative (no false-green skip)', () => {
  const plans = new Map([['p', {
    slug: 'p',
    phases: [{
      id: 'F0', slug: 'p-f0', status: 'done',
      exitGate: { criteria: [{ id: 'F0-G1', status: 'met' }] },
    }],
  }]]);
  const errors = crossValidate(plans, new Map());
  assert.ok(errors.length >= 1, 'must not skip missing initiative');
  assert.ok(
    errors.some((ce) => ce.errors.some((e) => String(e).includes(STATE_INTEGRITY_CODES.MISSING_INITIATIVE))),
    `expected missing-initiative, got ${JSON.stringify(errors)}`,
  );
});

test('crossValidate: descriptor-only pending with sidecar option passes', () => {
  const plans = new Map([['proj/p', {
    slug: 'p',
    __projectId: 'proj',
    phases: [{
      id: 'F1',
      slug: 'p-f1',
      status: 'pending',
      subPhaseCount: 0,
      exitGate: { criteria: [] },
    }],
  }]]);
  const errors = crossValidate(plans, new Map(), {
    sidecars: new Set(['proj/p/p-f1']),
  });
  assert.equal(errors.length, 0);
});

test('crossValidate: active without initiative fails; done with pending gate fails', () => {
  const plans = new Map([['p', {
    slug: 'p',
    phases: [
      {
        id: 'F0',
        slug: 'p-f0',
        status: 'active',
        exitGate: { criteria: [] },
      },
      {
        id: 'F1',
        slug: 'p-f1',
        status: 'done',
        exitGate: { criteria: [{ id: 'G1', status: 'pending' }] },
      },
    ],
  }]]);
  const inits = new Map([['p-f1', {
    slug: 'p-f1',
    status: 'done',
    parentPlan: 'p',
    phaseId: 'F1',
    tasks: [{ id: 'T-001', status: 'done' }],
    exitGates: [{ id: 'G1', status: 'pending' }],
  }]]);
  const errors = crossValidate(plans, inits);
  const flat = errors.flatMap((e) => e.errors).join('\n');
  assert.match(flat, new RegExp(STATE_INTEGRITY_CODES.MISSING_INITIATIVE));
  assert.match(flat, new RegExp(STATE_INTEGRITY_CODES.TERMINAL_PENDING_GATE));
});
