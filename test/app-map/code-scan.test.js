import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { deriveRegime, scanCode } from '../../src/app-map/code-scan.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BROWNFIELD = join(__dirname, 'fixtures', 'code', 'brownfield');
const GREENFIELD = join(__dirname, 'fixtures', 'code', 'greenfield');

function byId(pages, id) {
  return pages.find((p) => p.id === id);
}

// Acceptance #1 — enumerate pages/routes/views by framework-agnostic globs. The
// brownfield fixture mixes Next pages-router, Next app-router and a Vue view;
// all three must be found, and a plain util module must NOT be mistaken for one.
test('scanCode enumerates routes/views/screens across conventions, not utility modules', () => {
  const pages = scanCode({ roots: [BROWNFIELD] });
  const ids = pages.map((p) => p.id).sort();

  assert.deepEqual(ids, ['checkout', 'dashboard', 'profile', 'settings']);

  // The app-router page resolves to its parent directory, not "page".
  assert.equal(byId(pages, 'checkout').codeEvidence.path, 'app/checkout/page.tsx');
  // A utility module under src/utils is not a route surface.
  assert.equal(pages.some((p) => p.codeEvidence.path.includes('helpers')), false);
});

// Acceptance #2 — each page carries codeEvidence; absence of evidence is the
// greenfield signal.
test('each enumerated page carries codeEvidence and a brownfield regime', () => {
  const pages = scanCode({ roots: [BROWNFIELD] });

  assert.ok(pages.length > 0);
  for (const page of pages) {
    assert.ok(page.codeEvidence && typeof page.codeEvidence.path === 'string', 'page needs codeEvidence');
    assert.equal(page.regime, 'brownfield', 'a page WITH code evidence is brownfield');
  }
});

// Acceptance #3 — regime is derived from the page's OWN code evidence, never
// from a global "routes array is empty" verdict. deriveRegime is a pure per-page
// function: the same brownfield scan can sit beside a doc-only (null-evidence)
// page that is independently greenfield.
test('regime is per-page from its own evidence, never a global empty-routes verdict', () => {
  assert.equal(deriveRegime(null), 'greenfield');
  assert.equal(deriveRegime(undefined), 'greenfield');
  assert.equal(deriveRegime({ path: 'app/checkout/page.tsx' }), 'brownfield');

  // Even within a non-empty scan, a doc-only page (no codeEvidence) is greenfield
  // — proving the verdict is not coupled to the global presence of routes.
  const codePage = scanCode({ roots: [BROWNFIELD] })[0];
  assert.equal(deriveRegime(codePage.codeEvidence), 'brownfield');
  assert.equal(deriveRegime(null), 'greenfield');
});

// Acceptance #4 — a greenfield tree (no route surface) returns zero code pages
// WITHOUT error. The original bug was this returning empty and being treated as
// truth silently; here it must simply be an empty, non-throwing result.
test('greenfield tree yields zero code pages without throwing', () => {
  let pages;
  assert.doesNotThrow(() => {
    pages = scanCode({ roots: [GREENFIELD] });
  });
  assert.deepEqual(pages, []);
});
