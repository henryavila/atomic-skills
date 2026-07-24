/**
 * Golden tests for scripts/project-session-todos.js — Grok phase → session TODO
 * projection (docs/kb/grok-phase-todo-projection.md).
 *
 * No live Grok session; no network. Fixtures are tmp `.atomic-skills/` trees.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  buildSessionTodos,
  formatPhaseContent,
  mapPhaseTodoStatus,
  stableTodoId,
  runCli,
} from '../scripts/project-session-todos.js';

const SCRIPT = fileURLToPath(new URL('../scripts/project-session-todos.js', import.meta.url));
const EM_DASH = '—';

function writeFm(path, fm) {
  writeFileSync(path, `---\n${fm}\n---\n\nbody\n`);
}

/**
 * Active plan: F0 materialized 2/5 active, F1 pending with initiative (no rollup
 * invent for a third descriptor-only F2).
 */
function multiPhaseRepo({ includeF2 = true, pausedF1 = false } = {}) {
  const repo = mkdtempSync(join(tmpdir(), 'pst-multi-'));
  const planDir = join(repo, '.atomic-skills', 'projects', 'atomic-skills', 'plan-a');
  mkdirSync(join(planDir, 'phases'), { recursive: true });

  const f1Status = pausedF1 ? 'paused' : 'pending';
  const phasesYaml = [
    'phases:',
    '  - id: F0',
    '    slug: plan-a-f0',
    '    title: Phase Zero',
    '    summary: Foundation work',
    '    status: active',
    '  - id: F1',
    '    slug: plan-a-f1',
    '    title: Phase One',
    '    summary: Follow-on phase',
    `    status: ${f1Status}`,
  ];
  if (includeF2) {
    phasesYaml.push(
      '  - id: F2',
      '    slug: plan-a-f2',
      '    title: Phase Two',
      '    status: pending',
    );
  }

  writeFm(
    join(planDir, 'plan.md'),
    [
      'schemaVersion: "0.1"',
      'slug: plan-a',
      'title: Plan A',
      'status: active',
      'currentPhase: F0',
      'lastUpdated: 2026-06-15T10:00:00Z',
      ...phasesYaml,
    ].join('\n'),
  );

  writeFm(
    join(planDir, 'phases', 'f0-phase-zero.md'),
    [
      'schemaVersion: "0.1"',
      'slug: plan-a-f0',
      'title: Phase Zero',
      'summary: Foundation work',
      'status: active',
      'phaseId: F0',
      'parentPlan: plan-a',
      'tasksDone: 2',
      'tasksTotal: 5',
      'lastUpdated: 2026-06-15T11:00:00Z',
      'current: true',
      'planActive: true',
      'tasks:',
      '  - id: T-001',
      '    status: done',
      '  - id: T-002',
      '    status: done',
      '  - id: T-003',
      '    status: pending',
      '  - id: T-004',
      '    status: pending',
      '  - id: T-005',
      '    status: pending',
    ].join('\n'),
  );

  // F1 has an initiative (materialized) but is not current — optional paused.
  writeFm(
    join(planDir, 'phases', 'f1-phase-one.md'),
    [
      'schemaVersion: "0.1"',
      'slug: plan-a-f1',
      'title: Phase One',
      'summary: Follow-on phase',
      `status: ${f1Status}`,
      'phaseId: F1',
      'parentPlan: plan-a',
      'tasksDone: 0',
      'tasksTotal: 3',
      'lastUpdated: 2026-06-15T11:00:00Z',
      'current: false',
      'planActive: true',
      'tasks:',
      '  - id: T-001',
      '    status: pending',
      '  - id: T-002',
      '    status: pending',
      '  - id: T-003',
      '    status: pending',
    ].join('\n'),
  );

  // F2 is descriptor-only: no phases/*.md initiative file.
  return repo;
}

test('formatPhaseContent: materialized uses done/total and summary', () => {
  const content = formatPhaseContent(
    { id: 'F0', title: 'Phase Zero', summary: 'Foundation work', status: 'active' },
    { tasksDone: 2, tasksTotal: 5, summary: 'Foundation work', title: 'Phase Zero' },
  );
  assert.equal(content, `F0 (2/5) ${EM_DASH} Foundation work`);
});

test('formatPhaseContent: descriptor-only uses em-dash total + not materialized', () => {
  const content = formatPhaseContent(
    { id: 'F2', title: 'Phase Two', status: 'pending' },
    null,
  );
  assert.equal(content, `F2 (${EM_DASH}) ${EM_DASH} Phase Two · not materialized`);
});

test('formatPhaseContent: paused suffix', () => {
  const content = formatPhaseContent(
    { id: 'F1', title: 'Phase One', status: 'paused' },
    { tasksDone: 0, tasksTotal: 3, title: 'Phase One' },
    { paused: true },
  );
  assert.equal(content, `F1 (0/3) ${EM_DASH} Phase One · paused`);
});

test('mapPhaseTodoStatus: paused wins → pending + paused flag', () => {
  assert.deepEqual(mapPhaseTodoStatus({ id: 'F0', status: 'paused' }, 'F0'), {
    status: 'pending',
    paused: true,
  });
});

test('mapPhaseTodoStatus: current → in_progress; done → completed; else pending', () => {
  assert.deepEqual(mapPhaseTodoStatus({ id: 'F0', status: 'active' }, 'F0'), {
    status: 'in_progress',
    paused: false,
  });
  assert.deepEqual(mapPhaseTodoStatus({ id: 'F1', status: 'pending' }, 'F0'), {
    status: 'pending',
    paused: false,
  });
  assert.deepEqual(mapPhaseTodoStatus({ id: 'F0', status: 'done' }, 'F1'), {
    status: 'completed',
    paused: false,
  });
  assert.deepEqual(mapPhaseTodoStatus({ id: 'F0', status: 'archived' }, null), {
    status: 'completed',
    paused: false,
  });
});

test('stableTodoId is planSlug colon phase id', () => {
  assert.equal(stableTodoId('plan-a', 'F0'), 'plan-a:F0');
  assert.equal(stableTodoId('grok-phase-todo-projection', 'F1'), 'grok-phase-todo-projection:F1');
});

test('fixture F0 2/5 active + F1 pending + descriptor-only F2', () => {
  const repo = multiPhaseRepo({ includeF2: true });
  try {
    // Force no branch filter so unbranched plan claims the tree (no live git dep).
    const { merge, todos } = buildSessionTodos(repo, { branch: null });

    assert.equal(merge, false);
    assert.equal(todos.length, 3);

    const byId = Object.fromEntries(todos.map((t) => [t.id, t]));

    assert.ok(byId['plan-a:F0']);
    assert.equal(byId['plan-a:F0'].status, 'in_progress');
    assert.equal(byId['plan-a:F0'].content, `F0 (2/5) ${EM_DASH} Foundation work`);

    assert.ok(byId['plan-a:F1']);
    assert.equal(byId['plan-a:F1'].status, 'pending');
    assert.equal(byId['plan-a:F1'].content, `F1 (0/3) ${EM_DASH} Follow-on phase`);

    assert.ok(byId['plan-a:F2']);
    assert.equal(byId['plan-a:F2'].status, 'pending');
    assert.equal(
      byId['plan-a:F2'].content,
      `F2 (${EM_DASH}) ${EM_DASH} Phase Two · not materialized`,
    );

    const inProgress = todos.filter((t) => t.status === 'in_progress');
    assert.equal(inProgress.length, 1);
    assert.equal(inProgress[0].id, 'plan-a:F0');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('no active plan emits empty list', () => {
  const repo = mkdtempSync(join(tmpdir(), 'pst-none-'));
  try {
    const planDir = join(repo, '.atomic-skills', 'projects', 'p', 'paused-plan');
    mkdirSync(join(planDir, 'phases'), { recursive: true });
    writeFm(
      join(planDir, 'plan.md'),
      [
        'schemaVersion: "0.1"',
        'slug: paused-plan',
        'title: Paused',
        'status: paused',
        'currentPhase: F0',
        'lastUpdated: 2026-06-15T10:00:00Z',
        'phases:',
        '  - id: F0',
        '    slug: p-f0',
        '    title: Zero',
        '    status: paused',
      ].join('\n'),
    );

    const payload = buildSessionTodos(repo, { branch: null });
    assert.deepEqual(payload, { merge: false, todos: [] });
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('bare repo (no .atomic-skills) emits empty list', () => {
  const repo = mkdtempSync(join(tmpdir(), 'pst-bare-'));
  try {
    const payload = buildSessionTodos(repo, { branch: null });
    assert.deepEqual(payload, { merge: false, todos: [] });
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('paused phase maps to pending with · paused suffix', () => {
  const repo = multiPhaseRepo({ includeF2: false, pausedF1: true });
  try {
    const { todos } = buildSessionTodos(repo, { branch: null });
    const f1 = todos.find((t) => t.id === 'plan-a:F1');
    assert.ok(f1);
    assert.equal(f1.status, 'pending');
    assert.ok(f1.content.endsWith(' · paused'), `expected paused suffix: ${f1.content}`);
    assert.equal(f1.content, `F1 (0/3) ${EM_DASH} Follow-on phase · paused`);

    // Current F0 still in_progress; only one in_progress.
    const f0 = todos.find((t) => t.id === 'plan-a:F0');
    assert.equal(f0.status, 'in_progress');
    assert.equal(todos.filter((t) => t.status === 'in_progress').length, 1);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('paused current phase is pending (not in_progress) with suffix', () => {
  const repo = mkdtempSync(join(tmpdir(), 'pst-paused-cur-'));
  try {
    const planDir = join(repo, '.atomic-skills', 'projects', 'p', 'plan-p');
    mkdirSync(join(planDir, 'phases'), { recursive: true });
    writeFm(
      join(planDir, 'plan.md'),
      [
        'schemaVersion: "0.1"',
        'slug: plan-p',
        'title: Plan P',
        'status: active',
        'currentPhase: F0',
        'lastUpdated: 2026-06-15T10:00:00Z',
        'phases:',
        '  - id: F0',
        '    slug: plan-p-f0',
        '    title: Zero',
        '    status: paused',
        '  - id: F1',
        '    slug: plan-p-f1',
        '    title: One',
        '    status: pending',
      ].join('\n'),
    );
    writeFm(
      join(planDir, 'phases', 'f0.md'),
      [
        'schemaVersion: "0.1"',
        'slug: plan-p-f0',
        'title: Zero',
        'status: paused',
        'phaseId: F0',
        'parentPlan: plan-p',
        'tasksDone: 1',
        'tasksTotal: 2',
        'lastUpdated: 2026-06-15T11:00:00Z',
      ].join('\n'),
    );

    const { todos } = buildSessionTodos(repo, { branch: null });
    assert.equal(todos.find((t) => t.id === 'plan-p:F0').status, 'pending');
    assert.ok(todos.find((t) => t.id === 'plan-p:F0').content.includes(' · paused'));
    assert.equal(todos.filter((t) => t.status === 'in_progress').length, 0);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('runCli --json prints payload shape', () => {
  const repo = multiPhaseRepo({ includeF2: true });
  try {
    const result = runCli(['--json', repo]);
    assert.equal(result.ok, true);
    assert.equal(result.exitCode, 0);
    assert.equal(typeof result.payload.merge, 'boolean');
    assert.ok(Array.isArray(result.payload.todos));
    assert.ok(result.payload.todos.length >= 2);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('CLI smoke: node scripts/project-session-todos.js --json <fixture> exit 0', () => {
  const repo = multiPhaseRepo({ includeF2: false });
  try {
    const res = spawnSync(process.execPath, [SCRIPT, '--json', repo], {
      encoding: 'utf8',
      env: process.env,
    });
    assert.equal(res.status, 0, `stderr: ${res.stderr}`);
    const j = JSON.parse(res.stdout.trim());
    assert.equal(typeof j.merge, 'boolean');
    assert.ok(Array.isArray(j.todos));
    assert.equal(j.todos[0].id, 'plan-a:F0');
    assert.equal(j.todos[0].status, 'in_progress');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
