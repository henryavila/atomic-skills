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

function step4Section() {
  const markdown = read(designBriefPath);
  const start = markdown.indexOf('### 4.');
  const end = markdown.indexOf('### 5.', start);

  assert.notEqual(start, -1, 'design brief must contain a §4 heading');
  assert.notEqual(end, -1, 'design brief must contain a §5 heading after §4');

  return markdown.slice(start, end);
}

test('§4 chooses the R2 source by page regime without silencing the parameter', () => {
  const section = step4Section();
  const lower = section.toLowerCase();

  assert.match(
    lower,
    /brownfield[\s\S]{0,220}(mine|extract)[\s\S]{0,120}code|code[\s\S]{0,120}(mine|extract)[\s\S]{0,220}brownfield/,
    '§4 must say brownfield pages mine R2 values from code',
  );
  assert.match(
    lower,
    /greenfield[\s\S]{0,260}ask[\s\S]{0,120}operator[\s\S]{0,260}seeded[\s\S]{0,160}catalog[\s\S]{0,160}artefacts?/,
    '§4 must say greenfield pages ask the operator, seeded by catalog artefacts',
  );
  assert.match(
    lower,
    /never[\s\S]{0,80}silenc|silenc[\s\S]{0,80}never/,
    '§4 must say the R2 parameter is never silenced',
  );
  assert.match(
    lower,
    /interactive omission audit \(r3\)[\s\S]{0,420}omission is a decision/,
    '§4 must keep the R3 omission audit intact',
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
