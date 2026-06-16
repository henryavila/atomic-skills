import assert from 'node:assert/strict';
import { test } from 'node:test';

import { assertValidAppMap, validateAppMap } from '../../src/app-map/validate.js';

function buildValidCatalog() {
  return {
    schemaVersion: '0.1',
    inputsHash: 'sha256:abcdef123456',
    projectId: 'demo-project',
    pages: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        purpose: 'Shows the user their current work.',
        audience: 'registered',
        accessTier: 'auth:member',
        status: 'built',
        regime: 'brownfield',
        existence: 'confirmed',
        aliases: ['home'],
        provenance: {
          id: 'routes/dashboard.tsx',
          label: 'docs/product-map.md',
          purpose: 'docs/product-map.md',
          audience: 'docs/personas.md',
          accessTier: 'middleware/auth.ts',
          status: 'routes/dashboard.tsx',
          regime: 'routes/dashboard.tsx',
          existence: 'routes/dashboard.tsx',
        },
        conflicts: [
          {
            field: 'audience',
            artefactValue: 'visitor',
            codeValue: 'registered',
            evidence: 'docs/personas.md disagrees with middleware/auth.ts',
            resolution: 'pending',
          },
        ],
      },
    ],
  };
}

test('assertValidAppMap accepts a fully populated catalog', () => {
  const catalog = buildValidCatalog();

  assert.doesNotThrow(() => assertValidAppMap(catalog));
  assert.equal(validateAppMap(catalog).valid, true);
});

test('assertValidAppMap throws a readable error for malformed catalogs', () => {
  const catalog = buildValidCatalog();
  delete catalog.pages[0].status;
  catalog.pages[0].accessTier = 'private';

  assert.throws(
    () => assertValidAppMap(catalog),
    (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /app-map catalog is invalid/i);
      assert.match(error.message, /status/);
      assert.match(error.message, /accessTier/);
      return true;
    },
  );

  const result = validateAppMap(catalog);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.instancePath === '/pages/0' && error.params.missingProperty === 'status'));
  assert.ok(result.errors.some((error) => error.instancePath === '/pages/0/accessTier'));
});
