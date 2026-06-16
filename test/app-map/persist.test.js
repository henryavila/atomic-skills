import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateAppMap } from '../../src/app-map/validate.js';
import { computeEvidenceHash } from '../../src/app-map/hash.js';
import { buildCatalog, emitCatalog, reRunDelta } from '../../src/app-map/persist.js';

const NOW = '2026-06-16T00:00:00.000Z';

// Catalog-ready page facts carrying a raw `evidence` descriptor that persist
// hashes into the per-page evidenceHash.
function pageFact(id, { evidence, conflicts = [], accessTier = 'public' }) {
  return {
    id,
    label: id,
    purpose: `The ${id} page.`,
    audience: 'registered',
    accessTier,
    status: 'built',
    regime: 'brownfield',
    existence: 'confirmed',
    provenance: { id: `routes/${id}.tsx`, accessTier: 'docs/map.md' },
    conflicts,
    evidence,
  };
}

function buildPages() {
  return [
    pageFact('dashboard', { evidence: { code: 'routes/dashboard.tsx', docs: ['docs/a.md#audience=registered'] } }),
    pageFact('settings', {
      accessTier: 'auth:admin',
      evidence: { code: 'routes/settings.tsx', docs: ['docs/c.md#access=admin'] },
      conflicts: [
        {
          field: 'accessTier',
          artefactValue: 'auth:admin',
          codeValue: 'public',
          evidence: 'docs/c.md disagrees with routes/settings.tsx',
          // 0.2: resolution is an object recording the operator's arbitration.
          resolution: { resolvedBy: 'henry', resolvedAt: NOW, choice: 'auth:admin' },
        },
      ],
    }),
  ];
}

// Acceptance #1 — bump schemaVersion 0.1 → 0.2: resolution becomes an object and
// evidenceHash per-page is REQUIRED. The F0 validator (reused at emit-time) must
// accept the 0.2 catalog and reject one missing its per-page evidenceHash.
test('builds a schemaVersion 0.2 catalog: object resolution + required per-page evidenceHash', () => {
  const catalog = buildCatalog({ pages: buildPages(), projectId: 'demo' });

  assert.equal(catalog.schemaVersion, '0.2');
  for (const page of catalog.pages) {
    assert.ok(typeof page.evidenceHash === 'string' && page.evidenceHash.length > 0);
    assert.equal('evidence' in page, false, 'raw evidence is hashed away, not persisted');
  }
  assert.equal(validateAppMap(catalog).valid, true, JSON.stringify(validateAppMap(catalog).errors, null, 2));

  // The object-form resolution survived into the persisted conflict.
  const settings = catalog.pages.find((p) => p.id === 'settings');
  assert.deepEqual(settings.conflicts[0].resolution, { resolvedBy: 'henry', resolvedAt: NOW, choice: 'auth:admin' });

  // Drop a per-page evidenceHash → a 0.2 catalog must fail validation.
  const broken = JSON.parse(JSON.stringify(catalog));
  delete broken.pages[0].evidenceHash;
  assert.equal(validateAppMap(broken).valid, false, '0.2 requires evidenceHash on every page');
});

// Acceptance #2 — evidenceHash = sha256 of the normalized evidence (code + doc),
// per page. Deterministic for equal evidence, distinct for changed evidence.
test('evidenceHash is a per-page sha256 of normalized code+doc evidence', () => {
  const evidence = { code: 'routes/x.tsx', docs: ['docs/x.md#a=1'] };

  const a = computeEvidenceHash(evidence);
  const b = computeEvidenceHash({ docs: ['docs/x.md#a=1'], code: 'routes/x.tsx' }); // key order swapped
  assert.match(a, /^sha256:[0-9a-f]{64}$/);
  assert.equal(a, b, 'normalization makes key order irrelevant');

  const changed = computeEvidenceHash({ code: 'routes/x.tsx', docs: ['docs/x.md#a=2'] });
  assert.notEqual(a, changed, 'changed evidence yields a different hash');
});

// Acceptance #3 — re-execution with UNCHANGED evidence yields zero delta
// (suppresses the re-question); changed evidence puts that page in the delta.
test('re-run delta is empty when evidence is unchanged, non-empty when it changes', () => {
  const prev = buildCatalog({ pages: buildPages(), projectId: 'demo' });

  // Same inputs → identical evidenceHashes → no page needs re-asking.
  const sameRun = buildCatalog({ pages: buildPages(), projectId: 'demo' });
  assert.deepEqual(reRunDelta(prev, sameRun).delta, []);

  // Change dashboard's evidence → only dashboard re-enters the delta.
  const mutated = buildPages();
  mutated[0].evidence.docs = ['docs/a.md#audience=visitor'];
  const nextRun = buildCatalog({ pages: mutated, projectId: 'demo' });
  assert.deepEqual(reRunDelta(prev, nextRun).delta, ['dashboard']);
});

// Acceptance #4 — emit-time validates against the schema (reusing F0) and ABORTS
// on a malformed catalog, before any write.
test('emit-time validation aborts a malformed catalog before writing', () => {
  const writes = [];
  const writeFile = (path, content) => writes.push({ path, content });

  const valid = buildCatalog({ pages: buildPages(), projectId: 'demo' });
  emitCatalog(valid, { dir: '/tmp/app', writeFile });
  assert.equal(writes.length, 2, 'a valid catalog writes app-map.json + the .md mirror');
  assert.ok(writes.some((w) => w.path.endsWith('app-map.json')));
  assert.ok(writes.some((w) => w.path.endsWith('.md')));

  // Malformed: illegal accessTier. Emit must throw and write nothing.
  const broken = buildCatalog({ pages: buildPages(), projectId: 'demo' });
  broken.pages[0].accessTier = 'private';
  const writesBroken = [];
  assert.throws(() => emitCatalog(broken, { dir: '/tmp/app', writeFile: (p, c) => writesBroken.push({ p, c }) }));
  assert.equal(writesBroken.length, 0, 'a malformed catalog writes nothing');
});
