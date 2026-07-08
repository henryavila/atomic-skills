import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const transitions = readFileSync(
  join(ROOT, 'skills', 'shared', 'project-assets', 'project-transitions.md'),
  'utf8',
);
const materialize = readFileSync(
  join(ROOT, 'skills', 'shared', 'project-assets', 'project-materialize.md'),
  'utf8',
);

function section(doc, startHeading, nextHeading) {
  const start = doc.indexOf(startHeading);
  assert.notEqual(start, -1, `missing section: ${startHeading}`);
  const end = nextHeading ? doc.indexOf(nextHeading, start + startHeading.length) : -1;
  assert.notEqual(end, -1, `missing next section: ${nextHeading}`);
  return doc.slice(start, end);
}

function assertInOrder(doc, tokens) {
  let last = -1;
  for (const token of tokens) {
    const idx = doc.indexOf(token, last + 1);
    assert.notEqual(idx, -1, `missing token: ${token}`);
    assert.ok(idx > last, `token out of order: ${token}`);
    last = idx;
  }
}

test('T-010 materialize supports direct and internal caller invocation', () => {
  assert.match(materialize, /For a direct top-level invocation, the requested phase must equal\s+`currentPhase`/);
  assert.match(materialize, /For an internal transition call \(`phase-done`\/`switch`\/\s+`phase-reopen`\), the caller passes the selected active phase id set/);
  assert.match(materialize, /`phase-done`, `switch`, and `phase-reopen` call this same procedure/);
  assert.match(materialize, /They do not duplicate the gate or\s+write their own initiative file/);
});

test('T-010 phase-done materializes descriptor-only successors and preserves parallel choice pre-flight', () => {
  const doc = section(transitions, '## `phase-done`', '### Self-review against gates');
  assertInOrder(doc, [
    'For each newly-active phase id',
    'If the matching initiative',
    'file exists, set that initiative to `status: active`',
    'If the initiative file is absent',
    '(descriptor-only), run `atomic-skills:project materialize <phase-id>`',
    'the full selected active phase id set so parallel-choice phases beyond the',
    'first pass pre-flight',
    'do not propose `new initiative` for descriptor-only',
  ]);
});

test('T-010 phase-reopen reuses existing initiatives and delegates descriptor-only reopen', () => {
  const doc = section(transitions, '## `phase-reopen`', '## `detect-scope`');
  assert.match(doc, /Check both the live path .* and its archive dir/s);
  assertInOrder(doc, [
    'If the matching initiative file is absent (descriptor-only)',
    'run `atomic-skills:project materialize <phase-id>` as an internal transition caller',
    'selected active phase id set containing the reopened target',
    'do not propose `new initiative` for descriptor-only phases',
  ]);
  assertInOrder(doc, [
    'If the matching initiative file exists',
    'If the initiative file was archived: move it back to its live resolved path',
    'Set initiative `status: active`',
  ]);
  assert.match(doc, /Leave every other `done` or `archived` phase untouched/);
});

test('T-010 switch reuses materialized targets and materializes descriptor-only plan current phases', () => {
  const doc = section(transitions, '## `switch <slug>`', '4. Announce.');
  assertInOrder(doc, [
    'Set any other active plan to `status: paused`',
    'Set target plan to `status: active`',
    "Resolve the target plan's `currentPhase`",
    'If the matching initiative file exists, reuse it',
    'do not overwrite it',
    'If the initiative file is absent (descriptor-only)',
    'run `atomic-skills:project materialize <phase-id>` as an internal transition caller',
    'after the old active plan/initiative has been paused/demoted',
    'before reporting the switch complete',
    'do not propose `new initiative` for descriptor-only phases',
  ]);
});

test('T-010 switch supports descriptor-only initiative/phase activation paths', () => {
  const doc = section(transitions, '## `switch <slug>`', '4. Announce.');
  assertInOrder(doc, [
    'OR a phase descriptor id/slug in the currently active plan whose initiative file is absent (descriptor-only)?',
    'Find target initiative or target phase descriptor',
    'Set any other active initiative to `status: paused`',
    'If the matching initiative file exists, reuse it',
    'set target initiative to `status: active`',
    'do not overwrite it',
    'If the matching initiative file is absent and the active plan descriptor has the target phase (descriptor-only)',
    'set `currentPhase` to that phase id',
    'run `atomic-skills:project materialize <phase-id>` as an internal transition caller',
    'selected active phase id set containing the target phase',
    'do not propose `new initiative` for descriptor-only phases',
  ]);
});
