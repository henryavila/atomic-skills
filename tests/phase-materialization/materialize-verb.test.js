import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DETAIL = join(
  __dirname,
  '..',
  '..',
  'skills',
  'shared',
  'project-assets',
  'project-materialize.md',
);
const doc = readFileSync(DETAIL, 'utf8');

function assertInOrder(tokens) {
  let last = -1;
  for (const token of tokens) {
    const idx = doc.indexOf(token, last + 1);
    assert.notEqual(idx, -1, `missing token: ${token}`);
    assert.ok(idx > last, `token out of order: ${token}`);
    last = idx;
  }
}

test('T-009 documents the materialize flow from retained source to active phase', () => {
  assertInOrder([
    'Load retained source sidecar.',
    'Run the phase-start lessons gate.',
    'Collect the user-written `businessIntent` spine.',
    'Reuse `decomposeOnePhase(phaseSource, ctx)`',
    'Reuse `writeInitiativeFile(initiative, planSlug, ctx)`.',
    'Write the initiative with `businessIntent` and update the parent plan',
    'descriptor atomically via `scripts/materialize-state.js`.',
    'Run `scripts/find-missing-business-intent.js`.',
    'Run `scripts/validate-state.js`.',
    'Run `scripts/refresh-state.js`.',
  ]);
});

test('T-005 materialize publish is owned by materialize-state.js (no sequential dual WRITE)', () => {
  assert.match(doc, /scripts\/materialize-state\.js/);
  assert.match(doc, /Atomic publish via `scripts\/materialize-state\.js`/);
  assert.match(doc, /renames \*\*initiative first\*\*, \*\*plan last\*\*/);
  assert.match(doc, /Do \*\*not\*\* write either file with sequential `\{\{WRITE_TOOL\}\}` calls/);
  assert.doesNotMatch(
    doc,
    /Write the returned initiative file with `\{\{WRITE_TOOL\}\}` and write the parent\s+plan descriptor/,
  );
});

test('T-009 businessIntent gate requires business/customer value and non-goal outOfScope', () => {
  assert.match(doc, /`value` states both business value and customer\/user value\./);
  assert.match(doc, /`outOfScope` is a non-goal, not a vague omission\./);
  assert.match(doc, /Reject the block when any required field is blank/);
  assert.match(doc, /\[NEEDS CLARIFICATION\]/);
});

test('T-009 body reuses F1/F2 primitives and does not duplicate decompose logic', () => {
  assert.match(doc, /do not duplicate decomposition heuristics/);
  assert.match(doc, /For the F2 `captureVersion: "0\.1"` shape/);
  assert.match(doc, /reuse its `goal`, `tasks`, and\s+`exitGates` directly/);
  assert.match(doc, /do not re-parse the\s+whole source markdown as a fallback/);
});

test('T-009 descriptor update names the fields required by the detector and readers', () => {
  assertInOrder([
    'add `businessIntent` to the initiative frontmatter',
    'set `businessIntent` on the parent plan descriptor;',
    'set `subPhaseCount` to `initiative.tasks.length`;',
    'set the descriptor `status` to `active`;',
    'set `currentPhase` to the phase id;',
    'The detector runs',
  ]);
});

test('T-009 detector command uses package-root resolution and scopes to the active plan file', () => {
  assert.match(doc, /scripts\/find-missing-business-intent\.js" \.atomic-skills\/projects\/<project-id>\/<plan-slug>\/plan\.md/);
  assert.doesNotMatch(doc, /find-missing-business-intent\.js" \.atomic-skills`/);
  assert.match(doc, /Pass the parent `plan\.md` so unrelated legacy plans cannot block this materialization/);
});

test('T-009 materialize target is dependency-safe and does not leave two active phases', () => {
  assert.match(doc, /For a direct top-level invocation, the requested phase must equal\s+`currentPhase`/);
  assert.match(doc, /caller passes the selected active phase id set/);
  assert.match(doc, /Every `dependsOn\[\]`\s+phase must be `done`/);
  assert.match(doc, /no phase outside the selected active set may remain\s+`active`/);
});

test('router treats materialize as mutating with a no-active-initiative exception', () => {
  const router = readFileSync(join(__dirname, '..', '..', 'skills', 'core', 'project.md'), 'utf8');
  const gateLine = router.split('\n').find((line) => line.includes('BEFORE executing a mutating command')) || '';
  const commandList = gateLine.match(/\(([^)]*)\)/)?.[1] || '';
  assert.doesNotMatch(commandList, /`materialize`/);
  assert.match(router, /`materialize` exception: may create the initiative/);
  assert.match(router, /Callers gated/);
});

test('T-009 validate-state targets the materialized initiative file explicitly', () => {
  assert.match(doc, /validate-state\.js" \.atomic-skills\/projects\/<project-id>\/<plan-slug>\/plan\.md \.atomic-skills\/projects\/<project-id>\/<plan-slug>\/phases\/<resolved-phase-file>\.md/);
  assert.match(doc, /Pass the newly written initiative file explicitly/);
  assert.doesNotMatch(doc, /validate-state\.js" \.atomic-skills\/projects\/<project-id>\/<plan-slug>\/plan\.md \.atomic-skills\/projects\/<project-id>\/<plan-slug>\/phases\/`/);
});

test('phase transitions delegate descriptor-only activation to materialize, not new initiative', () => {
  const transitions = readFileSync(
    join(__dirname, '..', '..', 'skills', 'shared', 'project-assets', 'project-transitions.md'),
    'utf8',
  );
  assert.match(transitions, /atomic-skills:project materialize <phase-id>/);
  assert.match(transitions, /do not propose `new initiative` for descriptor-only\s+phases/);
  assert.match(transitions, /If the matching initiative\s+file exists, set that initiative to `status: active`/);
  assert.match(transitions, /full selected active phase id set so parallel-choice phases beyond the\s+first pass pre-flight/);
});

test('new-phase cannot create a materialized initiative without businessIntent', () => {
  const emergence = readFileSync(
    join(__dirname, '..', '..', 'skills', 'shared', 'project-assets', 'project-emergence.md'),
    'utf8',
  );
  const start = emergence.indexOf('## `new-phase <id>');
  const end = emergence.indexOf('## `split-phase <id>`');
  assert.notEqual(start, -1, 'new-phase section must exist');
  assert.notEqual(end, -1, 'split-phase section must exist');
  const block = emergence.slice(start, end);

  let last = -1;
  for (const token of [
    'Run the phase-start lessons gate before materialization',
    'Collect the user-written `businessIntent` spine',
    'Create the phase initiative file',
    'add `businessIntent` to the new initiative frontmatter',
    'set `businessIntent` on the parent plan descriptor',
    'Run `scripts/find-missing-business-intent.js` scoped to the parent plan',
  ]) {
    const idx = block.indexOf(token, last + 1);
    assert.notEqual(idx, -1, `missing token: ${token}`);
    assert.ok(idx > last, `token out of order: ${token}`);
    last = idx;
  }
});
