import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lintTransitionEmits } from '../scripts/lint-transition-emits.js';

const TRANSITIONS = 'skills/shared/project-assets/project-transitions.md';
const HEADERS = {
  done: '## `done <task-id>`',
  reconcile: '## `reconcile`',
  phase: '## `phase-done`',
};

function block(markdown, header) {
  const start = markdown.indexOf(header);
  assert.notEqual(start, -1, `fixture source contains ${header}`);
  const next = markdown.indexOf('\n## ', start + header.length);
  return markdown.slice(start, next === -1 ? markdown.length : next);
}

function tempMarkdown(contents) {
  const dir = mkdtempSync(join(tmpdir(), 'as-transition-emits-'));
  const path = join(dir, 'project-transitions.md');
  writeFileSync(path, contents);
  return { dir, path };
}

function minimalFixture(overrides = {}) {
  const real = readFileSync(TRANSITIONS, 'utf8');
  return [
    overrides.done ?? block(real, HEADERS.done),
    overrides.reconcile ?? block(real, HEADERS.reconcile),
    overrides.phase ?? block(real, HEADERS.phase),
    '## `archive`',
    '',
  ].join('\n\n');
}

test('project-transitions emits are structurally present in all transition blocks', () => {
  const result = lintTransitionEmits(TRANSITIONS);

  assert.equal(result.ok, true);
  assert.deepEqual(result.offenders, []);
});

test('phase-done prose emits one aggregate phase event and forbids bulk task-done close', () => {
  const real = readFileSync(TRANSITIONS, 'utf8');
  const phase = block(real, HEADERS.phase);

  assert.match(phase, /exactly one `phase-done` completion event/);
  assert.match(phase, /aggregate actuals once/);
  assert.match(phase, /do NOT duplicate those aggregate actuals onto prior per-task `task-done` lines/i);
  assert.match(phase, /Do \*\*not\*\* emit per-task `task-done` here|do \*\*not\*\* emit per-task `task-done`/i);
  assert.match(phase, /no bulk-close|Do \*\*not\*\* set open tasks to `done`/i);
  // Prior task-done path is still referenced (done flow ownership)
  assert.match(phase, /task-done/);
});

test('done prose requires verifier handling before status mutation', () => {
  const real = readFileSync(TRANSITIONS, 'utf8');
  const done = block(real, HEADERS.done);

  const verifierIdx = done.indexOf('Verifier handling is the first state-changing gate');
  const statusIdx = done.indexOf('set `status: done`');
  assert.notEqual(verifierIdx, -1);
  assert.notEqual(statusIdx, -1);
  assert.ok(verifierIdx < statusIdx, 'verifier handling must precede status:done');
  assert.match(done, /closure authority/);
  assert.match(done, /Do NOT consume `verify-claim` output as task evidence/);
});

test('phase-done prose forbids defer/skip terminal and bulk-met coercion', () => {
  const real = readFileSync(TRANSITIONS, 'utf8');
  const phase = block(real, HEADERS.phase);

  assert.match(phase, /Never convert `pending` or `deferred` gates to `met`/);
  assert.match(phase, /Do not offer defer\/skip as a terminal path|defer\/skip of exit gates as a terminal path/i);
  assert.match(phase, /preflightPhaseDone|Stage A — pure preflight/);
  assert.match(phase, /commitGuardPhaseDone|Commit guard \(HARD/);
  assert.match(phase, /fingerprint/);
  assert.doesNotMatch(phase, /For each `exitGates\[\]`[\s\S]{0,160}`status !== 'met'`[\s\S]{0,160}set `status: met`/);
  assert.doesNotMatch(phase, /Defer the remaining gates and mark phase done anyway/);
});

test('old done ordering is reported as verifier-before-done', () => {
  const fixture = tempMarkdown(minimalFixture({
    done: [
      HEADERS.done,
      '',
      '1. Locate task in `tasks:`.',
      '2. Change `status: done`, set `closedAt: <now>`, refresh `lastUpdated: <now>`.',
      "3. Emit exactly one completion event via `appendCompletion(root, { event: 'task-done', projectId, planSlug, phaseId, taskId })`.",
      '4. If the closing task has a non-empty `verifier:`, see **Per-task verifiers** below first.',
    ].join('\n'),
  }));
  try {
    const result = lintTransitionEmits(fixture.path);

    assert.equal(result.ok, false);
    assert.deepEqual(result.offenders.map((o) => o.block), [HEADERS.done]);
    assert.ok(result.offenders[0].missing.includes('verifier-before-done'));
    assert.ok(result.offenders[0].missing.includes('done closure authority'));
  } finally {
    rmSync(fixture.dir, { recursive: true, force: true });
  }
});

test('old phase-done bulk-met and missing preflight/commit guard are reported', () => {
  const fixture = tempMarkdown(minimalFixture({
    phase: [
      HEADERS.phase,
      '',
      '1. Load the active initiative.',
      '2. For each criterion (`status === pending`) run the verifier.',
      '3. If any criterion is still `pending`, document the override by setting `deferredReason`.',
      "4. Emit one `task-done` event per task via `appendCompletion(root, { event: 'task-done', projectId, planSlug, phaseId, taskId })`, then exactly one `phase-done` completion event with `actuals`.",
      "5. For each `exitGates[]` in the initiative with `status !== 'met'`: set `status: met`, `metAt: <now>`.",
    ].join('\n'),
  }));
  try {
    const result = lintTransitionEmits(fixture.path);

    assert.equal(result.ok, false);
    assert.deepEqual(result.offenders.map((o) => o.block), [HEADERS.phase]);
    assert.ok(result.offenders[0].missing.includes('no-bulk-met'));
    assert.ok(result.offenders[0].missing.includes('no-pending-or-deferred-to-met'));
    assert.ok(result.offenders[0].missing.includes('no-bulk-close'));
    assert.ok(result.offenders[0].missing.includes('no-defer-skip-terminal'));
    assert.ok(result.offenders[0].missing.includes('phase-done-preflight'));
    assert.ok(result.offenders[0].missing.includes('phase-done-commit-guard'));
    assert.ok(result.offenders[0].missing.includes('phase-done-fingerprint'));
  } finally {
    rmSync(fixture.dir, { recursive: true, force: true });
  }
});

test('missing done emit is reported only on the done block', () => {
  const fixture = tempMarkdown(minimalFixture({
    done: [
      HEADERS.done,
      '',
      '1. Locate task in `tasks:`.',
      '2. Change `status: done`, set `closedAt: <now>`, refresh `lastUpdated: <now>`.',
    ].join('\n'),
  }));
  try {
    const result = lintTransitionEmits(fixture.path);

    assert.equal(result.ok, false);
    assert.deepEqual(result.offenders.map((o) => o.block), [HEADERS.done]);
    assert.ok(result.offenders[0].missing.includes('completion emit'));
    assert.ok(result.offenders[0].missing.includes('task-done'));
    assert.ok(result.offenders[0].missing.includes('projectId'));
  } finally {
    rmSync(fixture.dir, { recursive: true, force: true });
  }
});

test('missing reconcile emit is reported only on the reconcile block', () => {
  const fixture = tempMarkdown(minimalFixture({
    reconcile: [
      HEADERS.reconcile,
      '',
      '1. Run the deterministic detector.',
      '2. Apply the user dispositions.',
    ].join('\n'),
  }));
  try {
    const result = lintTransitionEmits(fixture.path);

    assert.equal(result.ok, false);
    assert.deepEqual(result.offenders.map((o) => o.block), [HEADERS.reconcile]);
    assert.ok(result.offenders[0].missing.includes('completion emit'));
    assert.ok(result.offenders[0].missing.includes('task-done'));
    assert.ok(result.offenders[0].missing.includes('planSlug'));
  } finally {
    rmSync(fixture.dir, { recursive: true, force: true });
  }
});

test('missing phase-done emit is reported only on the phase-done block', () => {
  const fixture = tempMarkdown(minimalFixture({
    phase: [
      HEADERS.phase,
      '',
      '1. Load the active initiative.',
      '2. Set all `tasks[].status = done` before archiving.',
    ].join('\n'),
  }));
  try {
    const result = lintTransitionEmits(fixture.path);

    assert.equal(result.ok, false);
    assert.deepEqual(result.offenders.map((o) => o.block), [HEADERS.phase]);
    assert.ok(result.offenders[0].missing.includes('completion emit'));
    assert.ok(result.offenders[0].missing.includes('task-done'));
    assert.ok(result.offenders[0].missing.includes('phase-done'));
    assert.ok(result.offenders[0].missing.includes('actuals'));
  } finally {
    rmSync(fixture.dir, { recursive: true, force: true });
  }
});
