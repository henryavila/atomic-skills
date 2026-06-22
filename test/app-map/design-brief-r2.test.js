import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const designBriefPath = join(repoRoot, 'skills', 'core', 'design-brief.md');
const antiContaminationPath = join(
  repoRoot,
  'skills',
  'shared',
  'design-brief-assets',
  'anti-contamination.md',
);

const layer1Row =
  '| **1. Visual form** | colour, radius, shadow, which widget, spacing, typography | design agent | **silence** |';
const ironLaw = 'NEVER SILENCE BEHAVIOUR OR PHILOSOPHY — SILENCE IS FOR VISUAL FORM ONLY';

function read(path) {
  return readFileSync(path, 'utf8');
}

// Locate the R2 mining section by its heading TEXT, not its number — process steps
// get renumbered as the skill evolves; the contract guarded here is the section's
// content (per-regime R2 source + R3 omission audit), not its ordinal.
function r2Section() {
  const markdown = read(designBriefPath);
  const heading = markdown.indexOf('Mine the behavioural parameters');
  assert.notEqual(heading, -1, 'design brief must contain the R2 mining section');

  const start = markdown.lastIndexOf('\n### ', heading) + 1;
  const next = markdown.indexOf('\n### ', heading + 1);
  const end = next === -1 ? markdown.length : next;
  return markdown.slice(start, end);
}

test('R2 mining section chooses the source by page regime without silencing the parameter', () => {
  const section = r2Section();
  const lower = section.toLowerCase();

  assert.match(
    lower,
    /brownfield[\s\S]{0,220}(mine|extract)[\s\S]{0,120}code|code[\s\S]{0,120}(mine|extract)[\s\S]{0,220}brownfield/,
    'R2 section must say brownfield pages mine R2 values from code',
  );
  assert.match(
    lower,
    /greenfield[\s\S]{0,260}ask[\s\S]{0,120}operator[\s\S]{0,260}seeded[\s\S]{0,160}catalog[\s\S]{0,160}artefacts?/,
    'R2 section must say greenfield pages ask the operator, seeded by catalog artefacts',
  );
  assert.match(
    lower,
    /never[\s\S]{0,80}silenc|silenc[\s\S]{0,80}never/,
    'R2 section must say the R2 parameter is never silenced',
  );
  assert.match(
    lower,
    /interactive omission audit \(r3\)[\s\S]{0,420}omission is a decision/,
    'R2 section must keep the R3 omission audit intact',
  );
});

test('layer-1 silence rule remains intact in the design brief', () => {
  const markdown = read(designBriefPath);

  assert.ok(markdown.includes(ironLaw), 'the Iron Law sentence must remain verbatim');
  assert.ok(markdown.includes(layer1Row), 'the layer-1 visual-form silence row must remain verbatim');
});

test('anti-contamination asset documents the per-regime R2 source without weakening layer 1', () => {
  const markdown = read(antiContaminationPath);
  const lower = markdown.toLowerCase();

  assert.match(
    lower,
    /per-regime source[\s\S]{0,260}brownfield[\s\S]{0,160}(mine|extract)[\s\S]{0,120}code/,
    'asset must note that brownfield pages mine R2 values from code',
  );
  assert.match(
    lower,
    /greenfield[\s\S]{0,260}ask[\s\S]{0,120}operator[\s\S]{0,260}seeded[\s\S]{0,160}catalog[\s\S]{0,160}artefacts?/,
    'asset must note that greenfield pages ask the operator, seeded by catalog artefacts',
  );
  assert.match(
    lower,
    /(value|values)[\s\S]{0,120}always[\s\S]{0,120}stated|never[\s\S]{0,120}silenc/,
    'asset must say the value is always stated rather than silenced',
  );
  assert.ok(markdown.includes(layer1Row), 'the existing layer-1 silence row must remain verbatim');
});
