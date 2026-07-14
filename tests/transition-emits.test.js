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

test('phase-done prose emits only one aggregate phase event', () => {
  const real = readFileSync(TRANSITIONS, 'utf8');
  const phase = block(real, HEADERS.phase);

  assert.match(phase, /all tasks were already closed individually/);
  assert.match(phase, /Emit no `task-done` completion events/);
  assert.match(phase, /exactly one `phase-done` completion event/);
  assert.match(phase, /aggregate actuals once/);
  assert.doesNotMatch(phase, /closed by this bulk-close/);
  assert.doesNotMatch(phase, /Set all `tasks\[\]\.status = ['`]?done/);
});

test('done prose requires verifier handling before status mutation', () => {
  const real = readFileSync(TRANSITIONS, 'utf8');
  const done = block(real, HEADERS.done);

  const verifierIdx = done.indexOf('Verifier handling is the first state-changing gate');
  const statusIdx = done.indexOf('`status: done`');
  assert.notEqual(verifierIdx, -1);
  assert.notEqual(statusIdx, -1);
  assert.ok(verifierIdx < statusIdx, 'verifier handling must precede status:done');
  assert.match(done, /closure authority/);
  assert.match(done, /Do NOT consume `verify-claim` output as task evidence/);
});

test('phase-done prose makes deferred/skipped gates non-terminal', () => {
  const real = readFileSync(TRANSITIONS, 'utf8');
  const phase = block(real, HEADERS.phase);

  assert.match(phase, /`deferred`[\s\S]{0,120}non-terminal/i);
  assert.match(phase, /Never offer defer\/skip as a phase-close override/);
  assert.match(phase, /never convert an unverified gate to `met`/i);
  assert.doesNotMatch(phase, /set `status: deferred`[\s\S]{0,160}(proceed|continue)/i);
  assert.doesNotMatch(phase, /For each `exitGates\[\]`[\s\S]{0,160}`status !== 'met'`[\s\S]{0,160}set `status: met`/);
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

test('old phase-done bulk-met propagation is reported', () => {
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
    assert.ok(result.offenders[0].missing.includes('no-unverified-to-met'));
    assert.ok(result.offenders[0].missing.includes('no-deferred-terminal'));
    assert.ok(result.offenders[0].missing.includes('no-task-bulk-close'));
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
    assert.ok(result.offenders[0].missing.includes('phase-done'));
    assert.ok(result.offenders[0].missing.includes('actuals'));
    assert.ok(result.offenders[0].missing.includes('no-task-bulk-close'));
    assert.ok(result.offenders[0].missing.includes('task-bulk-close-bypass'));
  } finally {
    rmSync(fixture.dir, { recursive: true, force: true });
  }
});
