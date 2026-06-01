import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import { MANUAL_GATE_ID, makeManualGate, hasManualGate, withManualGate } from '../src/manual-gate.js';

const SCHEMA_DIR = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'meta', 'schemas');

// Validator for a single exitCriterion (the shape the gate must conform to).
function buildCriterionValidator() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  for (const n of ['common.schema.json', 'plan.schema.json', 'initiative.schema.json']) {
    ajv.addSchema(JSON.parse(readFileSync(join(SCHEMA_DIR, n), 'utf8')));
  }
  return ajv.compile({
    $ref: 'https://atomic-skills.henryavila.com/schemas/common.schema.json#/$defs/exitCriterion',
  });
}

describe('manual-gate', () => {
  it('reserves the id G-MANUAL', () => {
    assert.equal(MANUAL_GATE_ID, 'G-MANUAL');
    assert.equal(makeManualGate().id, 'G-MANUAL');
  });

  it('makeManualGate produces a pending manual criterion that validates against the schema', () => {
    const gate = makeManualGate();
    assert.equal(gate.status, 'pending');
    assert.equal(gate.verifier.kind, 'manual');
    assert.ok(gate.description.length > 0);
    assert.ok(gate.verifier.description.length > 0);
    const validate = buildCriterionValidator();
    assert.equal(validate(gate), true, JSON.stringify(validate.errors));
  });

  it('makeManualGate returns a fresh object each call (no shared mutable state)', () => {
    const a = makeManualGate();
    const b = makeManualGate();
    assert.notEqual(a, b);
    a.status = 'met';
    assert.equal(b.status, 'pending', 'mutating one must not affect another');
  });

  it('hasManualGate detects presence and tolerates non-arrays', () => {
    assert.equal(hasManualGate([makeManualGate()]), true);
    assert.equal(hasManualGate([{ id: 'G-1', description: 'x', status: 'pending' }]), false);
    assert.equal(hasManualGate([]), false);
    assert.equal(hasManualGate(undefined), false);
    assert.equal(hasManualGate(null), false);
  });

  it('withManualGate appends the gate when absent', () => {
    const out = withManualGate([{ id: 'G-1', description: 'real gate', status: 'pending' }]);
    assert.equal(out.length, 2);
    assert.equal(out[0].id, 'G-1', 'existing criteria preserved, in order');
    assert.equal(out[1].id, MANUAL_GATE_ID, 'gate appended last');
  });

  it('withManualGate is idempotent', () => {
    const once = withManualGate([]);
    const twice = withManualGate(once);
    assert.equal(twice.filter((c) => c.id === MANUAL_GATE_ID).length, 1);
  });

  it('withManualGate does not mutate its input', () => {
    const input = [{ id: 'G-1', description: 'real gate', status: 'pending' }];
    const out = withManualGate(input);
    assert.equal(input.length, 1, 'input untouched');
    assert.notEqual(out, input, 'returns a new array');
  });

  it('withManualGate handles a missing/undefined list', () => {
    const out = withManualGate(undefined);
    assert.equal(out.length, 1);
    assert.equal(out[0].id, MANUAL_GATE_ID);
  });
});
