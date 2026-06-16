import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import Ajv from 'ajv/dist/2020.js';

const schemaPath = join(process.cwd(), 'meta', 'schemas', 'app-map.schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));

function buildValidator() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  return ajv.compile(schema);
}

test('app-map schema declares the frozen catalog and page contract fields', () => {
  assert.deepEqual(schema.required, ['schemaVersion', 'inputsHash', 'pages']);

  const page = schema.$defs.page;
  assert.ok(page, 'schema must define a page object');
  assert.deepEqual(page.required, [
    'id',
    'label',
    'purpose',
    'audience',
    'accessTier',
    'status',
    'regime',
    'existence',
    'provenance',
    'conflicts',
  ]);
});

test('app-map schema constrains access tier, page status, and page existence', () => {
  const { accessTier, status, existence } = schema.$defs.page.properties;

  assert.ok(accessTier.oneOf.some((branch) => branch.enum?.includes('public')));
  assert.ok(accessTier.oneOf.some((branch) => branch.enum?.includes('auth')));
  assert.ok(accessTier.oneOf.some((branch) => branch.pattern === '^auth:.+$'));

  assert.deepEqual(status.enum, ['built', 'planned', 'drifted', 'abandoned']);
  assert.deepEqual(existence.enum, ['confirmed', 'artefact-only', 'code-only', 'possible-alias']);
});

test('app-map schema validates a fully populated catalog', () => {
  const validate = buildValidator();
  const catalog = {
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

  assert.equal(validate(catalog), true, JSON.stringify(validate.errors, null, 2));
});

test('app-map schema rejects missing required fields and bad enum values', () => {
  const validate = buildValidator();
  const catalog = {
    schemaVersion: '0.1',
    inputsHash: 'sha256:abcdef123456',
    pages: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        purpose: 'Shows the user their current work.',
        audience: 'registered',
        accessTier: 'private',
        regime: 'brownfield',
        existence: 'confirmed',
        provenance: {
          id: 'routes/dashboard.tsx',
        },
        conflicts: [],
      },
    ],
  };

  assert.equal(validate(catalog), false);
  assert.ok(validate.errors.some((error) => error.instancePath === '/pages/0' && error.params.missingProperty === 'status'));
  assert.ok(validate.errors.some((error) => error.instancePath === '/pages/0/accessTier'));
});
