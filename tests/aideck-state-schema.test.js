import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Ajv from 'ajv';
import { validateAideckState } from '../scripts/validate-aideck-state.js';

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_PATH = join(PROJECT_ROOT, 'assets', 'aideck-consumer', 'schema.json');

// `totals` is no longer emitted — the Panorama totals are read-time source.agg
// on the aiDeck v0.1 engine, so the bundled schema drops its definition too.
const EMITTED_ENTITIES = [
  'plans', 'phases', 'initiatives', 'tasks', 'gates', 'phaseGates',
  'stack', 'parked', 'emerged', 'projects', 'catalog',
];

describe('aideck state schema gate', () => {
  it('the bundled schema.json defines every emitted dataSource entity', () => {
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
    for (const id of EMITTED_ENTITIES) {
      assert.ok(schema.definitions[id], `missing #/definitions/${id} in the bundled schema`);
    }
  });

  it('the real repo .atomic-skills tree emits state that validates clean', () => {
    const { ok, errors } = validateAideckState(PROJECT_ROOT);
    assert.ok(ok, `emitted state invalid:\n${errors.map((e) => `  ${e.entity}[${e.index}]: ${e.message}`).join('\n')}`);
  });

  it('a malformed record is REJECTED (the gate actually validates)', () => {
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
    const ajv = new Ajv({ strict: false, allErrors: false });
    ajv.addSchema(schema);
    const validatePlan = ajv.getSchema(`${schema.$id}#/definitions/plans`);

    // missing required fields + a stray key + wrong type ⇒ must fail
    assert.equal(validatePlan({ slug: 'x', focusTasksPct: 'not-a-number', bogus: 1 }), false);

    // a structurally complete plan record (every property at its type's zero) passes
    const goodPlan = {};
    for (const [k, def] of Object.entries(schema.definitions.plans.properties)) {
      if (def.type === 'number' || def.type === 'integer') goodPlan[k] = 0;
      else if (def.type === 'boolean') goodPlan[k] = false;
      else goodPlan[k] = '';
    }
    assert.equal(validatePlan(goodPlan), true);
  });
});
