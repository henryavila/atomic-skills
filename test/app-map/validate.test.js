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

test('assertValidAppMap rejects duplicate canonical page ids', () => {
  const catalog = buildValidCatalog();
  // A second, schema-valid page that reuses the first page's canonical id.
  const dup = JSON.parse(JSON.stringify(catalog.pages[0]));
  dup.label = 'Dashboard (duplicate)';
  catalog.pages.push(dup);

  // The catalog is schema-valid (both pages satisfy the schema); the ONLY
  // defect is the duplicate id, so a passing result would mean the post-schema
  // uniqueness check is absent.
  const result = validateAppMap(catalog);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.keyword === 'duplicatePageId' && error.instancePath === '/pages/1/id'));

  assert.throws(
    () => assertValidAppMap(catalog),
    (error) => {
      assert.match(error.message, /duplicate page id 'dashboard'/);
      return true;
    },
  );
});

// --- 0.3: resolution.choice must reference an existing witness (T-002) -------

// A schema-valid 0.3 catalog: per-page evidenceHash + conflicts shaped as
// witnesses[{value, source, kind}]. `resolution` overridable per test.
function build0_3Catalog(resolution) {
  return {
    schemaVersion: '0.3',
    inputsHash: 'sha256:abcdef123456',
    projectId: 'demo-project',
    pages: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        purpose: 'Shows the user their current work.',
        audience: null,
        accessTier: null,
        status: 'built',
        regime: 'brownfield',
        existence: 'confirmed',
        evidenceHash: 'sha256:0123456789abcdef',
        provenance: { id: 'routes/dashboard.tsx' },
        conflicts: [
          {
            field: 'accessTier',
            witnesses: [
              { value: 'admin', source: 'docs/roles-admin.md', kind: 'artefact' },
              { value: 'registered', source: 'docs/roles-registered.md', kind: 'artefact' },
              { value: 'guardian', source: 'docs/roles-guardian.md', kind: 'artefact' },
            ],
            evidence: '3 docs disagree on accessTier',
            resolution,
          },
        ],
      },
    ],
  };
}

test('validateAppMap rejects a 0.3 resolution.choice that matches no witness', () => {
  // choice value+source point at a witness that is not in the set — the silent
  // arbitration-into-the-void the value+source contract (D4) must catch.
  const catalog = build0_3Catalog({
    resolvedBy: 'operator',
    resolvedAt: '2026-06-16T19:00:00Z',
    choice: { value: 'superuser', source: 'docs/roles-admin.md' },
  });

  const result = validateAppMap(catalog);
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some(
      (error) => error.keyword === 'resolutionChoiceWitness' && error.instancePath === '/pages/0/conflicts/0/resolution/choice',
    ),
    JSON.stringify(result.errors, null, 2),
  );

  assert.throws(
    () => assertValidAppMap(catalog),
    (error) => {
      assert.match(error.message, /app-map catalog is invalid/i);
      assert.match(error.message, /choice/i);
      return true;
    },
  );
});

test('validateAppMap accepts a 0.3 resolution.choice that matches a witness by value+source', () => {
  const catalog = build0_3Catalog({
    resolvedBy: 'operator',
    resolvedAt: '2026-06-16T19:00:00Z',
    choice: { value: 'registered', source: 'docs/roles-registered.md' },
  });

  assert.equal(validateAppMap(catalog).valid, true, JSON.stringify(validateAppMap(catalog).errors, null, 2));
  assert.doesNotThrow(() => assertValidAppMap(catalog));
});

test('validateAppMap does not fire the witness-choice rule on a pending 0.3 conflict', () => {
  // A still-pending conflict has a string resolution, not an arbitration object —
  // the value+source integrity rule must not fire (and 0.1/0.2 never carry witnesses).
  const catalog = build0_3Catalog('pending');
  assert.equal(validateAppMap(catalog).valid, true, JSON.stringify(validateAppMap(catalog).errors, null, 2));
});
