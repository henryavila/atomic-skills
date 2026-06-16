import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { recallSources } from '../../src/app-map/sources.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = join(__dirname, 'fixtures', 'sources');

function recall() {
  return recallSources({ roots: [FIXTURES_ROOT] });
}

function pagesNamed(candidates, name) {
  const key = name.trim().toLowerCase();
  return candidates.filter((c) => c.page.value.trim().toLowerCase() === key);
}

// Acceptance #1 — discovers docs in configurable roots without assuming a
// convention. BMAD, README, atomic-skills and no-convention must ALL produce
// candidates; a recall heuristic that only understood one convention would
// leave some of these four buckets empty.
test('recallSources discovers candidates across every convention without classifying it', () => {
  const candidates = recall();

  for (const convention of ['bmad/', 'readme/', 'atomic-skills/', 'no-convention/']) {
    const fromConvention = candidates.filter((c) => c.page.source.path.startsWith(convention));
    assert.ok(
      fromConvention.length > 0,
      `expected at least one candidate discovered under '${convention}', got none`,
    );
  }
});

// Acceptance #2 — each candidate carries PER-FIELD provenance: the source that
// asserted each field, not one source for the whole row. The BMAD Dashboard
// asserts its page (heading), audience and access on three DIFFERENT lines of
// the same file, so a per-row provenance model would collapse them to one line.
test('each candidate carries per-field provenance (source + line per field)', () => {
  const dashboard = pagesNamed(recall(), 'Dashboard').find(
    (c) => c.page.source.path === 'bmad/prd.md',
  );
  assert.ok(dashboard, 'expected a Dashboard candidate sourced from bmad/prd.md');

  for (const field of ['page', 'audience', 'accessTier']) {
    const prov = dashboard[field].source;
    assert.equal(prov.path, 'bmad/prd.md', `${field} provenance must name its source file`);
    assert.ok(Number.isInteger(prov.line) && prov.line > 0, `${field} provenance must carry a line`);
  }

  // Per-field, not per-row: the audience assertion and the page assertion are on
  // distinct lines. Equal lines here would mean provenance is row-level.
  assert.notEqual(dashboard.audience.source.line, dashboard.page.source.line);
  assert.notEqual(dashboard.accessTier.source.line, dashboard.audience.source.line);
});

// Acceptance #3 — a candidate is text that asserts a page, an audience OR an
// access. The three are independent: Checkout asserts page+access but NOT
// audience, and must still be a candidate. Conversely, headings that assert
// none of the three (prose titles) must NOT become phantom pages.
test('a candidate is text asserting a page, audience or access — and nothing else', () => {
  const candidates = recall();

  const checkout = candidates.find((c) => c.page.value === 'Checkout');
  assert.ok(checkout, 'Checkout asserts page+access and must be a candidate');
  assert.equal(checkout.accessTier.value, 'auth');
  assert.equal(checkout.audience, null, 'Checkout asserts no audience — that field stays null');

  // Section/document titles that assert no audience/access and carry no page
  // marker are NOT pages. A recall that turned every heading into a candidate
  // would surface these.
  for (const phantom of ['Pages', 'Acme App', 'Product Requirements', 'Memory notes']) {
    assert.equal(
      candidates.some((c) => c.page.value === phantom),
      false,
      `'${phantom}' is a doc heading, not an asserted page`,
    );
  }
});

// Acceptance #4 — no precedence auto-resolves divergence between sources. Two
// sources assert page "Dashboard" with conflicting audiences (bmad: registered,
// memory: visitor). recallSources must return BOTH, untouched — picking a winner
// here would be the silent choice P2 forbids.
test('no precedence auto-resolves divergence between sources', () => {
  const dashboards = pagesNamed(recall(), 'Dashboard');

  assert.equal(dashboards.length, 2, 'both Dashboard candidates must survive — neither merged away');

  const audiences = dashboards.map((c) => c.audience.value).sort();
  assert.deepEqual(audiences, ['registered', 'visitor']);

  const sources = dashboards.map((c) => c.page.source.path).sort();
  assert.deepEqual(sources, ['atomic-skills/memory.md', 'bmad/prd.md']);
});
