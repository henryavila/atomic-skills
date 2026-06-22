import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const designBriefPath = join(repoRoot, 'skills', 'core', 'design-brief.md');

// Locate the screen-inventory + coverage-ledger section by its heading TEXT, not its
// number — the process steps get renumbered as the skill evolves (e.g. when a new
// step is inserted), and the contract this test guards is the section's content, not
// its ordinal.
function inventorySection() {
  const markdown = readFileSync(designBriefPath, 'utf8');
  const heading = markdown.indexOf('Screen inventory + coverage ledger');
  assert.notEqual(heading, -1, 'design brief must contain the screen-inventory + coverage-ledger section');

  const start = markdown.lastIndexOf('\n### ', heading) + 1;
  const next = markdown.indexOf('\n### ', heading + 1);
  const end = next === -1 ? markdown.length : next;
  return markdown.slice(start, end);
}

function indexOrInfinity(haystack, needle) {
  const index = haystack.indexOf(needle);
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

test('inventory section makes reconstruction the first screen-inventory source', () => {
  const section = inventorySection();
  const lower = section.toLowerCase();

  const cliIndex = lower.indexOf('app-map-reconstruct.js');
  assert.ok(cliIndex >= 0, 'inventory section must invoke the app-map reconstruction CLI');
  assert.ok(lower.indexOf('--delta', cliIndex) > cliIndex, 'inventory section must run reconstruction with --delta');

  const consumeIndex = indexOrInfinity(lower, 'consume the catalog');
  const globIndex = indexOrInfinity(section, '{{GLOB_TOOL}}');
  assert.notEqual(consumeIndex, Number.POSITIVE_INFINITY, 'inventory section must include a catalog consumption instruction');
  assert.notEqual(globIndex, Number.POSITIVE_INFINITY, 'inventory section must mention the live route-Glob fallback');
  assert.ok(cliIndex < consumeIndex, 'inventory section must invoke reconstruction before consuming the catalog');
  assert.ok(cliIndex < globIndex, 'inventory section must invoke reconstruction before any live route-Glob fallback');
});

test('inventory section builds the ledger from catalog existence and divergence delta', () => {
  const lower = inventorySection().toLowerCase();

  assert.match(lower, /existence/, 'inventory section must reference catalog existence');
  assert.match(lower, /divergence|divergences|delta/, 'inventory section must reference divergence/delta consumption');
  assert.match(
    lower,
    /confirmed[\s\S]*artefact-only[\s\S]*code-only[\s\S]*possible-alias/,
    'inventory section must enumerate the catalog existence classes',
  );
});

test('inventory section treats null audience or accessTier as a stop-and-ask signal', () => {
  const lower = inventorySection().toLowerCase();

  assert.match(lower, /audience[\s\S]{0,120}accesstier|accesstier[\s\S]{0,120}audience/);
  assert.match(lower, /null/);
  assert.match(lower, /stop[\s\S]{0,80}ask|ask[\s\S]{0,80}stop/);
});

test('inventory section marks live route-Glob enumeration as legacy opt-in and never default', () => {
  const lower = inventorySection().toLowerCase();

  assert.match(lower, /{{glob_tool}}[\s\S]*{{grep_tool}}|{{grep_tool}}[\s\S]*{{glob_tool}}/);
  assert.match(lower, /legacy/);
  assert.match(lower, /opt-in/);
  assert.match(lower, /never the default|not the default/);
});
