import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const implement = readFileSync(join(ROOT, 'skills', 'core', 'implement.md'), 'utf8');

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

test('T-011 Step 1 refuses descriptor-only phases before accepting pending tasks', () => {
  const doc = section(implement, '### Step 1 — Load the admitted tasks', '### Step 2 — Execute one task');

  assertInOrder(doc, [
    'Resolve the active phase before accepting any pending task',
    'find the active phase descriptor',
    'resolve the expected materialized initiative path',
    'If the parent plan phase descriptor exists but the matching initiative file is absent',
    'descriptor-only phase',
    'Refuse execution',
    'atomic-skills:project materialize <phase-id>',
    'Do not enter degraded mode',
    'After that hard pre-check passes',
    'confirm each pending task carries the SPEC interior',
  ]);
});

test('T-011 Step 1 requires a complete businessIntent spine on descriptor and initiative', () => {
  const doc = section(implement, '### Step 1 — Load the admitted tasks', '### Step 2 — Execute one task');

  assert.match(doc, /businessIntent` spine on \*\*both\*\* the parent plan phase descriptor and the initiative frontmatter/);
  for (const field of ['value', 'workflow', 'rules', 'outOfScope', 'doneWhen']) {
    assert.match(doc, new RegExp(`\`${field}\``));
  }

  assertInOrder(doc, [
    'If either side is missing `businessIntent`',
    'any required field is absent, blank, empty after trimming',
    'still contains `[NEEDS CLARIFICATION]`',
    'refuse execution',
    're-materialize/re-question the `businessIntent` spine',
    'This is not the loose checklist/degraded-mode path',
  ]);
});

test('T-011 Step 2.1 documents exactly the two D6.1 re-question events', () => {
  const step2 = section(implement, '### Step 2 — Execute one task', '### Step 3 — Phase boundary');
  const d61 = section(step2, '**D6.1 `businessIntent` re-question events (exactly two):**', '2. **Distill heavy reads');
  const triggers = [...d61.matchAll(/^   \d+\. .+$/gm)].map((match) => match[0]);

  assert.deepEqual(triggers, [
    '   1. A critic/review reports drift from the original `businessIntent`.',
    '   2. Implement Step 2.1 reports a runtime `scopeBoundary` exit with the exact path and reason.',
  ]);
  assert.match(d61, /These are the only two `businessIntent` re-question points for this plan/);
  assert.match(d61, /`lint-source\.js` is explicitly not the D6\.1b runtime trigger/);
  assert.match(d61, /validates admitted `scopeBoundary\[\]` at admit time/);
  assert.match(d61, /adds no new static detector machinery/);
});

test('T-011 Step 2.1 runtime scope exits stop and report path plus reason', () => {
  const step2 = section(implement, '### Step 2 — Execute one task', '### Step 3 — Phase boundary');

  assertInOrder(step2, [
    '1. **Orient.**',
    'Read the task\'s `Files`, `acceptance[]`, and `scopeBoundary[]`',
    'a change outside `scopeBoundary[]` is a scope exit',
    'stop and report the exact path and reason',
    'When a task would require a runtime change outside `scopeBoundary[]`',
    'treat this stop-and-report as a `businessIntent` re-question event',
  ]);
});
