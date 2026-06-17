import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv/dist/2020.js';

const schema = JSON.parse(
  readFileSync(new URL('../meta/schemas/routing.schema.json', import.meta.url), 'utf8')
);
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

test('accepts a repo-global integrationRef string', () => {
  assert.equal(validate({ mode2Enabled: true, integrationRef: 'develop' }), true);
});

test('rejects unknown keys alongside integrationRef', () => {
  assert.equal(validate({ integrationRef: 'develop', bogusKey: true }), false);
});

test('keeps integrationRef optional', () => {
  assert.equal(validate({}), true);
});

test('rejects a non-string integrationRef', () => {
  assert.equal(validate({ integrationRef: 123 }), false);
});

test('integrationRef "default":"develop" is documentation-only (Ajv runs without useDefaults — not injected)', () => {
  // The schema declares "default":"develop" for integrationRef, but this Ajv
  // instance mirrors scripts/validate-state.js ({ strict:false }, NO useDefaults),
  // so validation must NOT materialize the field. The resolver's
  // declared/default/not-configured distinction depends on {} staying empty
  // after validation — flipping useDefaults on would silently break it.
  const cfg = {};
  assert.equal(validate(cfg), true);
  assert.equal('integrationRef' in cfg, false);
  assert.deepEqual(cfg, {});
});
