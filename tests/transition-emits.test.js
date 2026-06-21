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

test('phase-done prose instructs N task events plus one aggregate phase event', () => {
  const real = readFileSync(TRANSITIONS, 'utf8');
  const phase = block(real, HEADERS.phase);

  assert.match(phase, /N task events, one per task/);
  assert.match(phase, /never one shared timestamp/);
  assert.match(phase, /exactly one `phase-done` completion event/);
  assert.match(phase, /aggregate actuals once/);
  assert.match(phase, /do NOT duplicate those aggregate actuals onto the per-task `task-done` lines/);
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
