import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const designBriefPath = join(repoRoot, 'skills', 'core', 'design-brief.md');

function step2Section() {
  const markdown = readFileSync(designBriefPath, 'utf8');
  const start = markdown.indexOf('### 2.');
  const end = markdown.indexOf('### 3.', start);

  assert.notEqual(start, -1, 'design brief must contain a §2 heading');
  assert.notEqual(end, -1, 'design brief must contain a §3 heading after §2');

  return markdown.slice(start, end);
}

function indexOrInfinity(haystack, needle) {
  const index = haystack.indexOf(needle);
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

test('§2 makes reconstruction the first screen-inventory source', () => {
  const section = step2Section();
  const lower = section.toLowerCase();

  const cliIndex = lower.indexOf('app-map-reconstruct.js');
  assert.ok(cliIndex >= 0, '§2 must invoke the app-map reconstruction CLI');
  assert.ok(lower.indexOf('--delta', cliIndex) > cliIndex, '§2 must run reconstruction with --delta');

  const consumeIndex = indexOrInfinity(lower, 'consume the catalog');
  const globIndex = indexOrInfinity(section, '{{GLOB_TOOL}}');
  assert.notEqual(consumeIndex, Number.POSITIVE_INFINITY, '§2 must include a catalog consumption instruction');
  assert.notEqual(globIndex, Number.POSITIVE_INFINITY, '§2 must mention the live route-Glob fallback');
  assert.ok(cliIndex < consumeIndex, '§2 must invoke reconstruction before consuming the catalog');
  assert.ok(cliIndex < globIndex, '§2 must invoke reconstruction before any live route-Glob fallback');
});

test('§2 builds the ledger from catalog existence and divergence delta', () => {
  const lower = step2Section().toLowerCase();

  assert.match(lower, /existence/, '§2 must reference catalog existence');
  assert.match(lower, /divergence|divergences|delta/, '§2 must reference divergence/delta consumption');
  assert.match(
    lower,
    /confirmed[\s\S]*artefact-only[\s\S]*code-only[\s\S]*possible-alias/,
    '§2 must enumerate the catalog existence classes',
  );
});

test('§2 treats null audience or accessTier as a stop-and-ask signal', () => {
  const lower = step2Section().toLowerCase();

  assert.match(lower, /audience[\s\S]{0,120}accesstier|accesstier[\s\S]{0,120}audience/);
  assert.match(lower, /null/);
  assert.match(lower, /stop[\s\S]{0,80}ask|ask[\s\S]{0,80}stop/);
});

test('§2 marks live route-Glob enumeration as legacy opt-in and never default', () => {
  const lower = step2Section().toLowerCase();

  assert.match(lower, /{{glob_tool}}[\s\S]*{{grep_tool}}|{{grep_tool}}[\s\S]*{{glob_tool}}/);
  assert.match(lower, /legacy/);
  assert.match(lower, /opt-in/);
  assert.match(lower, /never the default|not the default/);
});
