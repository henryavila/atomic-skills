import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveIntegrationRef } from '../scripts/integration-ref.js';

test('declared integrationRef is honored', () => {
  assert.deepEqual(resolveIntegrationRef({ integrationRef: 'main' }), {
    ref: 'main',
    configured: true,
    source: 'declared',
  });
});

test('present routing config without integrationRef defaults to develop', () => {
  assert.deepEqual(resolveIntegrationRef({ mode2Enabled: true }), {
    ref: 'develop',
    configured: true,
    source: 'default',
  });
});

test('null routing config returns not-configured without throwing', () => {
  assert.doesNotThrow(() => resolveIntegrationRef(null));
  assert.deepEqual(resolveIntegrationRef(null), {
    ref: null,
    configured: false,
    source: 'not-configured',
  });
});

test('undefined routing config returns not-configured without throwing', () => {
  assert.doesNotThrow(() => resolveIntegrationRef(undefined));
  assert.deepEqual(resolveIntegrationRef(undefined), {
    ref: null,
    configured: false,
    source: 'not-configured',
  });
});

test('resolver does not mutate input', () => {
  const routingConfig = Object.freeze({ integrationRef: 'release' });
  assert.deepEqual(resolveIntegrationRef(routingConfig), {
    ref: 'release',
    configured: true,
    source: 'declared',
  });
  assert.deepEqual(routingConfig, { integrationRef: 'release' });
});

test('empty string integrationRef falls back to develop default', () => {
  assert.deepEqual(resolveIntegrationRef({ integrationRef: '' }), {
    ref: 'develop',
    configured: true,
    source: 'default',
  });
});

test('present-but-non-string integrationRef is tolerated as default, never promoted to declared', () => {
  // The schema (routing.schema.json) is the validation gate and rejects a
  // non-string integrationRef before this resolver runs; the resolver is called
  // on schema-valid content. If a non-string value slips through, it must fall
  // to the `default` branch (defensive) — NEVER be promoted to a `declared` ref.
  for (const bad of [123, true, [], {}]) {
    assert.deepEqual(resolveIntegrationRef({ integrationRef: bad }), {
      ref: 'develop',
      configured: true,
      source: 'default',
    });
  }
});

test('an INHERITED integrationRef (prototype chain) is ignored — only own property counts', () => {
  // Defensive: a polluted Object.prototype or a non-JSON.parse object must not
  // leak an inherited ref in as `declared`. With no OWN integrationRef the config
  // resolves to the default, not to the inherited value.
  const inherited = Object.create({ integrationRef: 'main' });
  assert.equal(Object.hasOwn(inherited, 'integrationRef'), false);
  assert.deepEqual(resolveIntegrationRef(inherited), {
    ref: 'develop',
    configured: true,
    source: 'default',
  });
});
