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
