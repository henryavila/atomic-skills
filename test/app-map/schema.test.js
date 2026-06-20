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

test('app-map schema rejects an unsupported schemaVersion', () => {
  const validate = buildValidator();
  const catalog = {
    schemaVersion: '999',
    inputsHash: 'sha256:abcdef123456',
    pages: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        purpose: 'Shows the user their current work.',
        audience: 'registered',
        accessTier: 'public',
        status: 'built',
        regime: 'brownfield',
        existence: 'confirmed',
        provenance: { id: 'routes/dashboard.tsx' },
        conflicts: [],
      },
    ],
  };

  // Only schemaVersion is invalid; everything else satisfies the contract,
  // so a passing result would mean the enum constraint is absent.
  assert.equal(validate(catalog), false);
  assert.ok(validate.errors.some((error) => error.instancePath === '/schemaVersion'));
});

// --- 0.3: conflict becomes a SET of witnesses (T-001) ------------------------

// A 0.3 page carries the per-page evidenceHash (the single-direction door from
// 0.2 onward) and conflicts shaped as witnesses[{value, source, kind}].
function catalog0_3(conflicts) {
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
        conflicts,
      },
    ],
  };
}

// The truncation bug (review F2 #2): three discordant doc witnesses must all be
// representable — N is not capped at two positional slots.
const threeWitnesses = [
  { value: 'admin', source: 'docs/roles-admin.md', kind: 'artefact' },
  { value: 'registered', source: 'docs/roles-registered.md', kind: 'artefact' },
  { value: 'guardian', source: 'docs/roles-guardian.md', kind: 'artefact' },
];

test('app-map schema 0.3 admits the new version and keeps 0.1/0.2 valid', () => {
  const validate = buildValidator();

  assert.ok(schema.properties.schemaVersion.enum.includes('0.3'), 'enum must admit 0.3');
  assert.ok(schema.properties.schemaVersion.enum.includes('0.1'));
  assert.ok(schema.properties.schemaVersion.enum.includes('0.2'));

  // A 0.3 catalog with a 3-witness conflict validates (no truncation).
  const catalog = catalog0_3([
    { field: 'accessTier', witnesses: threeWitnesses, evidence: '3 docs disagree', resolution: 'pending' },
  ]);
  assert.equal(validate(catalog), true, JSON.stringify(validate.errors, null, 2));
});

test('app-map schema 0.3 rejects the removed artefactValue/codeValue slots', () => {
  const validate = buildValidator();
  const catalog = catalog0_3([
    {
      field: 'audience',
      witnesses: [{ value: 'visitor', source: 'docs/personas.md', kind: 'artefact' }],
      artefactValue: 'visitor',
      codeValue: 'registered',
      evidence: 'legacy slots must not survive in 0.3',
      resolution: 'pending',
    },
  ]);

  assert.equal(validate(catalog), false);
  assert.ok(
    validate.errors.some((error) => /artefactValue|codeValue|additionalProperties/.test(JSON.stringify(error))),
    JSON.stringify(validate.errors, null, 2),
  );
});

test('app-map schema 0.3 rejects a witness kind outside {code, artefact}', () => {
  const validate = buildValidator();
  const catalog = catalog0_3([
    {
      field: 'accessTier',
      witnesses: [{ value: 'admin', source: 'docs/roles.md', kind: 'doc' }],
      evidence: 'kind must be code or artefact',
      resolution: 'pending',
    },
  ]);

  assert.equal(validate(catalog), false);
  assert.ok(
    validate.errors.some((error) => error.instancePath.endsWith('/kind')),
    JSON.stringify(validate.errors, null, 2),
  );
});

test('app-map schema 0.3 requires each witness to carry value, source and kind', () => {
  const validate = buildValidator();
  const catalog = catalog0_3([
    {
      field: 'accessTier',
      witnesses: [{ value: 'admin', source: 'docs/roles.md' }],
      evidence: 'kind is mandatory on every witness',
      resolution: 'pending',
    },
  ]);

  assert.equal(validate(catalog), false);
  assert.ok(
    validate.errors.some((error) => error.params?.missingProperty === 'kind'),
    JSON.stringify(validate.errors, null, 2),
  );
});

// The reverse gating direction (P3 single-direction door): the legacy 0.1/0.2
// conflict descriptor must REJECT the 0.3 witnesses[] field — otherwise the
// version boundary leaks and a 0.1/0.2 catalog could smuggle the new shape past
// the additionalProperties:false guard on the legacy conflict $def.
test('app-map schema rejects the 0.3 witnesses field on a 0.1/0.2 conflict', () => {
  const validate = buildValidator();
  for (const version of ['0.1', '0.2']) {
    const catalog = {
      schemaVersion: version,
      inputsHash: 'sha256:abcdef123456',
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
          // 0.2 requires the per-page evidenceHash (single-direction door); harmless on 0.1.
          evidenceHash: 'sha256:0123456789abcdef',
          provenance: { id: 'routes/dashboard.tsx' },
          conflicts: [
            {
              field: 'audience',
              witnesses: [{ value: 'visitor', source: 'docs/personas.md', kind: 'artefact' }],
              evidence: 'witnesses[] must not be admitted under a legacy version',
              resolution: 'pending',
            },
          ],
        },
      ],
    };

    assert.equal(validate(catalog), false, `${version} catalog with witnesses must be rejected`);
    assert.ok(
      validate.errors.some(
        (error) => error.instancePath.startsWith('/pages/0/conflicts/0') && /additionalProperties/.test(error.keyword ?? ''),
      ),
      `${version}: ${JSON.stringify(validate.errors, null, 2)}`,
    );
  }
});
