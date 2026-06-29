import { describe, it, before } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

// Mirrors the canonical validator setup in scripts/validate-state.js buildAjv()
// (Ajv 2020, allErrors, strict:false; schemas resolved by $id against common.schema.json).
const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = join(__dirname, '..', '..', 'meta', 'schemas');

function buildValidators() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  for (const name of ['common.schema.json', 'plan.schema.json', 'initiative.schema.json']) {
    const schema = JSON.parse(readFileSync(join(SCHEMA_DIR, name), 'utf8'));
    ajv.addSchema(schema);
  }
  return {
    validatePlan: ajv.getSchema('https://atomic-skills.henryavila.com/schemas/plan.schema.json'),
    validateInitiative: ajv.getSchema('https://atomic-skills.henryavila.com/schemas/initiative.schema.json'),
  };
}

const ISO = '2026-06-29T00:00:00.000Z';

// Minimal valid phaseDescriptor, legacy (no businessIntent) — required fields only.
function basePhase() {
  return {
    id: 'F0',
    slug: 'f0',
    title: 'F0',
    goal: 'goal text',
    dependsOn: [],
    subPhaseCount: 0,
    exitGate: { summary: 'gate summary', criteria: [] },
    status: 'pending',
  };
}

// Minimal valid plan wrapping one phase (legacy, no businessIntent).
function basePlan() {
  return {
    schemaVersion: '0.1',
    slug: 'test-plan',
    title: 'Test Plan',
    version: '1.0',
    status: 'active',
    started: ISO,
    lastUpdated: ISO,
    currentPhase: 'F0',
    parallelismAllowed: false,
    phases: [basePhase()],
  };
}

// Minimal valid initiative, legacy (no businessIntent) — required fields only.
function baseInitiative() {
  return {
    schemaVersion: '0.1',
    slug: 'some-init',
    title: 'Some Initiative',
    goal: 'goal text',
    status: 'pending',
    branch: 'plan/some-init',
    started: ISO,
    lastUpdated: ISO,
    nextAction: 'start T-001',
    exitGates: [],
    stack: [],
    tasks: [],
    parked: [],
    emerged: [],
  };
}

// The canonical businessIntent spine: 5 required-when-present string fields.
// derived[] deliberately omitted (optional tail).
function spine() {
  return {
    value: 'why this phase exists for the business',
    workflow: 'how the work flows end-to-end',
    rules: 'the load-bearing invariants',
    outOfScope: 'what is explicitly excluded',
    doneWhen: 'the exit definition',
  };
}

function planWithPhaseBusinessIntent(businessIntent) {
  const plan = basePlan();
  if (businessIntent !== undefined) plan.phases[0].businessIntent = businessIntent;
  return plan;
}

const showErrors = (fn) => `errors: ${JSON.stringify(fn.errors)}`;

describe('businessIntent sub-schema (T-001)', () => {
  let v;
  before(() => { v = buildValidators(); });

  describe('plan surface (phases[].businessIntent)', () => {
    it('accepts a plan whose phase carries a complete businessIntent (5 fields)', () => {
      const plan = planWithPhaseBusinessIntent(spine());
      assert.equal(v.validatePlan(plan), true, showErrors(v.validatePlan));
    });

    it('accepts a legacy plan WITHOUT businessIntent (optional confirmed)', () => {
      assert.equal(v.validatePlan(basePlan()), true, showErrors(v.validatePlan));
    });

    it('rejects a businessIntent missing `value`', () => {
      const { value, ...partial } = spine();
      assert.equal(v.validatePlan(planWithPhaseBusinessIntent(partial)), false);
    });

    it('accepts a businessIntent WITHOUT derived[] (derived is optional)', () => {
      // spine() already omits derived[]
      assert.equal(v.validatePlan(planWithPhaseBusinessIntent(spine())), true, showErrors(v.validatePlan));
    });

    it('accepts a businessIntent WITH a derived[] entry (question + optional answer)', () => {
      const bi = { ...spine(), derived: [{ question: 'open question?', answer: 'a tentative answer' }] };
      assert.equal(v.validatePlan(planWithPhaseBusinessIntent(bi)), true, showErrors(v.validatePlan));
    });

    it('rejects an empty-string spine field (minLength: 1)', () => {
      assert.equal(v.validatePlan(planWithPhaseBusinessIntent({ ...spine(), value: '' })), false);
    });

    it('rejects an unknown property inside businessIntent (additionalProperties: false)', () => {
      assert.equal(v.validatePlan(planWithPhaseBusinessIntent({ ...spine(), bogus: 1 })), false);
    });
  });

  describe('initiative surface (top-level businessIntent)', () => {
    it('accepts an initiative with a complete businessIntent', () => {
      assert.equal(v.validateInitiative({ ...baseInitiative(), businessIntent: spine() }), true, showErrors(v.validateInitiative));
    });

    it('accepts a legacy initiative WITHOUT businessIntent (optional confirmed)', () => {
      assert.equal(v.validateInitiative(baseInitiative()), true, showErrors(v.validateInitiative));
    });

    it('rejects a businessIntent missing `value`', () => {
      const { value, ...partial } = spine();
      assert.equal(v.validateInitiative({ ...baseInitiative(), businessIntent: partial }), false);
    });

    it('rejects an unknown property inside businessIntent (additionalProperties: false)', () => {
      assert.equal(v.validateInitiative({ ...baseInitiative(), businessIntent: { ...spine(), bogus: 1 } }), false);
    });
  });
});
