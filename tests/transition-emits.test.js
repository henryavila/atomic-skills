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
  reopen: '## `phase-reopen`',
  switch: '## `switch <slug>`',
  unblock: '## `unblock <task-id>`',
  archive: '## `archive [<slug>]`',
};

/** Minimal complete done block for fixtures (completion + gates + F2 projection). */
const COMPLETE_DONE = [
  HEADERS.done,
  '',
  '`done` is the closure authority for task state.',
  'Do NOT consume `verify-claim` output as task evidence.',
  '1. Locate task in `tasks:`.',
  '2. **Verifier handling is the first state-changing gate.**',
  '3. Only after verifier handling succeeds, set `status: done`.',
  "4. Emit exactly one completion event via `appendCompletion(root, { event: 'task-done', projectId, planSlug, phaseId, taskId })`.",
  '5. Run `scripts/refresh-state.js`.',
  '5b. Run `scripts/project-session-todos.js` then apply via `todo_write` on Grok.',
  'Never mark a phase todo completed without phase status done or archived.',
].join('\n');

const COMPLETE_RECONCILE = [
  HEADERS.reconcile,
  '',
  '1. Run the detector.',
  "2. For each reconciled task emit `task-done` via `appendCompletion` with projectId, planSlug, phaseId, taskId.",
  '3. Run `scripts/refresh-state.js`.',
  '4. Optionally document `project-session-todos` after refresh-state.',
].join('\n');

const COMPLETE_PHASE = [
  HEADERS.phase,
  '',
  'Stage A — pure preflight',
  'preflightPhaseDone',
  'Commit guard (HARD — re-read before any terminal write).',
  'commitGuardPhaseDone fingerprint',
  'No bulk-close of open tasks. Do not offer defer/skip as a terminal path.',
  'Never convert `pending` or `deferred` gates to `met`.',
  'Do **not** set open tasks to `done`.',
  "Emit exactly one `phase-done` completion event via `appendCompletion` with projectId, planSlug, phaseId, taskId, actuals.",
  'Prior per-task task-done lines already emitted.',
  'exactly one `phase-done` completion event; aggregate actuals once; do NOT duplicate those aggregate actuals onto prior per-task `task-done` lines.',
  'Run `scripts/refresh-state.js`.',
  'Run `scripts/project-session-todos.js` then apply via `todo_write` on Grok.',
  'Never mark a phase todo completed without phase status done or archived.',
].join('\n');

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
  return [
    overrides.done ?? COMPLETE_DONE,
    overrides.reconcile ?? COMPLETE_RECONCILE,
    overrides.phase ?? COMPLETE_PHASE,
    overrides.reopen ?? null,
    overrides.switch ?? null,
    overrides.unblock ?? null,
    overrides.archive ?? null,
    '## `detect-scope`',
    '',
  ].filter((part) => part != null).join('\n\n');
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
      '5. Run refresh-state and project-session-todos.',
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
      '6. Run refresh-state and project-session-todos.',
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
      '`done` is the closure authority for task state.',
      'Do NOT consume `verify-claim` output as task evidence.',
      '1. Locate task in `tasks:`.',
      '2. **Verifier handling is the first state-changing gate.**',
      '3. Only after verifier handling succeeds, set `status: done`.',
      '4. Run refresh-state and project-session-todos.',
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
      '3. Run refresh-state.',
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
      'Stage A — pure preflight',
      'preflightPhaseDone',
      'Commit guard (HARD',
      'commitGuardPhaseDone fingerprint',
      'No bulk-close. Do not offer defer/skip as a terminal path.',
      'Never convert `pending` or `deferred` gates to `met`.',
      'Do **not** set open tasks to `done`.',
      '1. Load the active initiative.',
      '2. Set all `tasks[].status = done` before archiving.',
      '3. Run refresh-state and project-session-todos.',
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

// --- F2: refresh-state + project-session-todos structural checks ---

test('done, reconcile, and phase-done fail lint if refresh-state is missing', () => {
  const fixture = tempMarkdown(minimalFixture({
    done: COMPLETE_DONE.replace(/refresh-state/g, 'rollup-recompute'),
    reconcile: COMPLETE_RECONCILE.replace(/refresh-state/g, 'rollup-recompute'),
    phase: COMPLETE_PHASE.replace(/refresh-state/g, 'rollup-recompute'),
  }));
  try {
    const result = lintTransitionEmits(fixture.path);

    assert.equal(result.ok, false);
    const byBlock = Object.fromEntries(result.offenders.map((o) => [o.block, o.missing]));
    assert.ok(byBlock[HEADERS.done]?.includes('refresh-state'));
    assert.ok(byBlock[HEADERS.reconcile]?.includes('refresh-state'));
    assert.ok(byBlock[HEADERS.phase]?.includes('refresh-state'));
  } finally {
    rmSync(fixture.dir, { recursive: true, force: true });
  }
});

test('done and phase-done fail lint if project-session-todos is not mentioned', () => {
  const fixture = tempMarkdown(minimalFixture({
    done: COMPLETE_DONE.replace(/project-session-todos/g, 'session-helper'),
    phase: COMPLETE_PHASE.replace(/project-session-todos/g, 'session-helper'),
  }));
  try {
    const result = lintTransitionEmits(fixture.path);

    assert.equal(result.ok, false);
    const byBlock = Object.fromEntries(result.offenders.map((o) => [o.block, o.missing]));
    assert.ok(byBlock[HEADERS.done]?.includes('project-session-todos'));
    assert.ok(byBlock[HEADERS.phase]?.includes('project-session-todos'));
    // reconcile is not hard-required for project-session-todos by T-001 acceptance
    assert.equal(byBlock[HEADERS.reconcile], undefined);
  } finally {
    rmSync(fixture.dir, { recursive: true, force: true });
  }
});

test('complete fixture still passes completion-emit and projection requirements', () => {
  const fixture = tempMarkdown(minimalFixture());
  try {
    const result = lintTransitionEmits(fixture.path);
    assert.equal(result.ok, true, JSON.stringify(result.offenders, null, 2));
    assert.deepEqual(result.offenders, []);
  } finally {
    rmSync(fixture.dir, { recursive: true, force: true });
  }
});

test('focus mutators fail lint if refresh-state or project-session-todos missing', () => {
  const fixture = tempMarkdown(minimalFixture({
    reopen: [HEADERS.reopen, '', '1. Reopen the phase.', '2. Save.'].join('\n'),
    switch: [HEADERS.switch, '', '1. Switch plan.', '2. Run refresh-state only.'].join('\n'),
    unblock: [
      HEADERS.unblock,
      '',
      '1. Unblock the task.',
      '2. Run refresh-state and project-session-todos.',
    ].join('\n'),
    archive: [
      HEADERS.archive,
      '',
      '1. Archive the target.',
      '2. Run scripts/refresh-state.js then scripts/project-session-todos.js.',
    ].join('\n'),
  }));
  try {
    const result = lintTransitionEmits(fixture.path);

    assert.equal(result.ok, false);
    const byBlock = Object.fromEntries(result.offenders.map((o) => [o.block, o.missing]));
    assert.ok(byBlock[HEADERS.reopen]?.includes('refresh-state'));
    assert.ok(byBlock[HEADERS.reopen]?.includes('project-session-todos'));
    assert.ok(byBlock[HEADERS.switch]?.includes('project-session-todos'));
    assert.equal(byBlock[HEADERS.switch]?.includes('refresh-state'), false);
    // unblock + archive are complete → not offenders
    assert.equal(byBlock[HEADERS.unblock], undefined);
    assert.equal(byBlock[HEADERS.archive], undefined);
  } finally {
    rmSync(fixture.dir, { recursive: true, force: true });
  }
});
