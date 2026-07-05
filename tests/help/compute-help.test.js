// Decision-map + fail-open coverage for scripts/compute-help.js (F1 of the
// help-command plan). The verifier for both F1 tasks and the F1 exit gate.
//
// Layers:
//   1. classify() — one assertion per precedence item + 3 overlap fixtures that
//      prove ORDER (higher-priority rule wins).
//   2. spineStageOf() — lifecycle position {n,m,name}.
//   3. nextStepFrom() — persisted (verbatim nextAction) vs fallback commandSource.
//   4. runDriftDetector() — the detect-completion.js exit-code contract:
//      parse JSON on exit 0 AND 1; fail-open only on exit 2 / unparseable / spawn-fail.
//   5. computeHelp() integration on a hermetic .atomic-skills fixture — proves the
//      persisted command end-to-end AND zero mutation of the state tree.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readdirSync, readFileSync, statSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  SPINE,
  classify,
  spineStageOf,
  nextStepFrom,
  runDriftDetector,
  computeHelp,
} from '../../scripts/compute-help.js';
import { PRECEDENCE, OVERLAPS, COMMAND_SOURCE } from './fixtures/states.js';

// ---------------------------------------------------------------------------
// 1. classify() — the precedence decision map
// ---------------------------------------------------------------------------

for (const fx of PRECEDENCE) {
  test(`classify: precedence item "${fx.name}" → stage ${fx.stage} · ${fx.command}`, () => {
    const d = classify(fx.state);
    assert.equal(d.stage, fx.stage, `stage for ${fx.name}`);
    assert.equal(d.fallbackCommand, fx.command, `command for ${fx.name}`);
    assert.ok(typeof d.reason === 'string' && d.reason.length > 0, 'reason present');
    assert.ok(typeof d.why === 'string' && d.why.length > 0, 'why present');
  });
}

for (const fx of OVERLAPS) {
  test(`classify overlap: ${fx.name}`, () => {
    const d = classify(fx.state);
    assert.equal(d.stage, fx.stage, `overlap stage: ${fx.name}`);
    assert.equal(d.fallbackCommand, fx.command, `overlap command: ${fx.name}`);
  });
}

test('classify: fallback commands never leave an unresolved <placeholder>', () => {
  for (const fx of [...PRECEDENCE, ...OVERLAPS]) {
    const d = classify(fx.state);
    assert.ok(!/<[^>]+>/.test(d.fallbackCommand), `${fx.name} resolved: ${d.fallbackCommand}`);
  }
});

// ---------------------------------------------------------------------------
// 2. spineStageOf()
// ---------------------------------------------------------------------------

test('spineStageOf: positions are 1-based within the 10-node spine', () => {
  assert.equal(SPINE.length, 10);
  const impl = spineStageOf('implement');
  assert.deepEqual(impl, { n: 6, m: 10, name: 'IMPLEMENT' });
  assert.deepEqual(spineStageOf('materialize'), { n: 5, m: 10, name: 'MATERIALIZE' });
  for (const fx of PRECEDENCE) {
    const s = spineStageOf(fx.stage);
    assert.equal(s.m, 10);
    assert.ok(s.n >= 1 && s.n <= 10, `${fx.stage} n in range`);
    assert.equal(s.name, SPINE[s.n - 1]);
  }
});

// ---------------------------------------------------------------------------
// 3. nextStepFrom() — commandSource
// ---------------------------------------------------------------------------

test('nextStepFrom: present nextAction is read verbatim (commandSource persisted)', () => {
  const decision = classify(COMMAND_SOURCE.fallbackState); // fallback would be "implement"
  const step = nextStepFrom(COMMAND_SOURCE.persistedNextAction, decision);
  assert.equal(step.command, COMMAND_SOURCE.persistedNextAction);
  assert.equal(step.commandSource, 'persisted');
  assert.equal(step.reason, decision.reason);
  assert.equal(step.why, decision.why);
});

test('nextStepFrom: absent/blank nextAction falls back to the precedence command', () => {
  const decision = classify(COMMAND_SOURCE.fallbackState);
  for (const empty of ['', '   ', null, undefined]) {
    const step = nextStepFrom(empty, decision);
    assert.equal(step.command, 'implement', `fallback for ${JSON.stringify(empty)}`);
    assert.equal(step.commandSource, 'fallback');
  }
});

// ---------------------------------------------------------------------------
// 4. runDriftDetector() — detect-completion.js exit-code contract
// ---------------------------------------------------------------------------

const okDrift = () => ({ status: 1, stdout: '{"drift":true,"candidates":[{"id":"T-001"}]}' });
const okClean = () => ({ status: 0, stdout: '{"drift":false,"candidates":[]}' });
const badArgs = () => ({ status: 2, stdout: '' });
const unparseable = () => ({ status: 1, stdout: 'boom — not json' });
const spawnFail = () => { throw new Error('ENOENT: node not found'); };

test('runDriftDetector: exit 1 + valid JSON → drift true', () => {
  assert.equal(runDriftDetector({ dir: '.', exec: okDrift }), true);
});

test('runDriftDetector: exit 0 + valid JSON → drift false', () => {
  assert.equal(runDriftDetector({ dir: '.', exec: okClean }), false);
});

test('runDriftDetector: fail-open on exit 2 (bad args)', () => {
  assert.equal(runDriftDetector({ dir: '.', exec: badArgs }), false);
});

test('runDriftDetector: fail-open on unparseable stdout (never treats exit 1 as thrown error)', () => {
  assert.equal(runDriftDetector({ dir: '.', exec: unparseable }), false);
});

test('runDriftDetector: fail-open on spawn failure', () => {
  assert.equal(runDriftDetector({ dir: '.', exec: spawnFail }), false);
});

// ---------------------------------------------------------------------------
// 5. computeHelp() — integration + zero mutation
// ---------------------------------------------------------------------------

/** Recursively snapshot { relPath → content } for a mutation check. */
function snapshot(root) {
  const out = {};
  const walk = (dir, rel) => {
    for (const entry of readdirSync(dir)) {
      const abs = join(dir, entry);
      const r = rel ? `${rel}/${entry}` : entry;
      if (statSync(abs).isDirectory()) walk(abs, r);
      else out[r] = readFileSync(abs, 'utf8');
    }
  };
  walk(root, '');
  return out;
}

function buildFixtureTree() {
  const dir = mkdtempSync(join(tmpdir(), 'compute-help-'));
  const planDir = join(dir, '.atomic-skills', 'projects', 'demo', 'demo-plan');
  mkdirSync(join(planDir, 'phases'), { recursive: true });
  writeFileSync(join(planDir, 'plan.md'), [
    '---',
    'schemaVersion: "0.1"',
    'slug: demo-plan',
    'status: active',
    'currentPhase: F1',
    'phases:',
    '  - id: F1',
    '    status: active',
    '---',
    '# demo plan',
    '',
  ].join('\n'));
  writeFileSync(join(planDir, 'phases', 'f1.md'), [
    '---',
    'schemaVersion: "0.1"',
    'slug: demo-plan-f1',
    'status: active',
    'phaseId: F1',
    'parentPlan: demo-plan',
    'nextAction: "Rodar `done T-001`."',
    'tasksDone: 0',
    'tasksTotal: 2',
    'title: A fase de exemplo',
    'tasks:',
    '  - id: T-001',
    '    status: pending',
    '  - id: T-002',
    '    status: pending',
    '---',
    '# f1',
    '',
  ].join('\n'));
  return dir;
}

test('computeHelp: persisted nextAction is surfaced verbatim + stage implement', () => {
  const dir = buildFixtureTree();
  try {
    const json = computeHelp({ dir, driftFn: () => false });
    assert.equal(json.nextStep.command, 'Rodar `done T-001`.');
    assert.equal(json.nextStep.commandSource, 'persisted');
    assert.equal(json.spineStage.name, 'IMPLEMENT');
    assert.ok(json.youAreHere && json.youAreHere.phaseId === 'F1');
    assert.ok(Array.isArray(json.escapes) && json.escapes.length > 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('computeHelp: zero mutation — the state tree is byte-identical after a run', () => {
  const dir = buildFixtureTree();
  try {
    const before = snapshot(dir);
    computeHelp({ dir, driftFn: () => false });
    const after = snapshot(dir);
    assert.deepEqual(after, before);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('computeHelp: fail-open — a missing directory yields a partial object, never throws', () => {
  const json = computeHelp({ dir: join(tmpdir(), 'does-not-exist-help-xyz'), driftFn: () => false });
  assert.ok(json && typeof json === 'object');
  assert.ok(json.nextStep, 'still emits a nextStep');
  assert.equal(json.spineStage.name, 'IDEIA'); // no state → setup stage
});

// --- resolveState frontmatter→flag derivation (integration, not synthetic classify) ---
// These drive the flag derivation through real plan.md/phase frontmatter, which the
// synthetic classify fixtures bypass.

/** Plan whose currentPhase (F2) is descriptor-only: F2 has NO initiative file; the
 *  only initiative on disk is the DONE F1. The next step must name F2 (the phase
 *  that needs materializing), NOT the resolved-initiative phase F1. */
function buildDescriptorOnlyTree() {
  const dir = mkdtempSync(join(tmpdir(), 'compute-help-desc-'));
  const planDir = join(dir, '.atomic-skills', 'projects', 'demo', 'demo-plan');
  mkdirSync(join(planDir, 'phases'), { recursive: true });
  writeFileSync(join(planDir, 'plan.md'), [
    '---', 'schemaVersion: "0.1"', 'slug: demo-plan', 'status: active',
    'currentPhase: F2',
    'phases:',
    '  - id: F1', '    status: done',
    '  - id: F2', '    status: active',
    '---', '# demo', '',
  ].join('\n'));
  writeFileSync(join(planDir, 'phases', 'f1.md'), [
    '---', 'schemaVersion: "0.1"', 'slug: demo-plan-f1', 'status: done',
    'phaseId: F1', 'parentPlan: demo-plan', 'title: Fase F1 concluída',
    'tasksDone: 1', 'tasksTotal: 1',
    'tasks:', '  - id: T-001', '    status: done',
    '---', '# f1', '',
  ].join('\n'));
  return dir;
}

test('computeHelp: descriptor-only currentPhase → materialize names currentPhase (F2), not the resolved phase', () => {
  const dir = buildDescriptorOnlyTree();
  try {
    const json = computeHelp({ dir, driftFn: () => false });
    // Fallback path (F1's initiative carries no nextAction), so the precedence command surfaces.
    assert.equal(json.nextStep.commandSource, 'fallback');
    assert.equal(json.nextStep.command, 'materialize F2'); // pre-fix bug emitted "materialize F1"
    assert.equal(json.spineStage.name, 'MATERIALIZE');
    assert.equal(json.youAreHere.phaseId, 'F2');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** Plan blocked by an unmet cross-plan dependency. The blocked branch must win and
 *  name the prerequisite as `switch <prereq>`. */
function buildBlockedPlanTree() {
  const dir = mkdtempSync(join(tmpdir(), 'compute-help-blocked-'));
  const planDir = join(dir, '.atomic-skills', 'projects', 'demo', 'demo-plan');
  mkdirSync(join(planDir, 'phases'), { recursive: true });
  writeFileSync(join(planDir, 'plan.md'), [
    '---', 'schemaVersion: "0.1"', 'slug: demo-plan', 'status: blocked',
    'currentPhase: F1',
    'dependsOnPlans:', '  - plan: core-api',
    'phases:', '  - id: F1', '    status: active',
    '---', '# demo', '',
  ].join('\n'));
  writeFileSync(join(planDir, 'phases', 'f1.md'), [
    '---', 'schemaVersion: "0.1"', 'slug: demo-plan-f1', 'status: active',
    'phaseId: F1', 'parentPlan: demo-plan', 'title: Fase F1',
    'tasksDone: 0', 'tasksTotal: 1',
    'tasks:', '  - id: T-001', '    status: pending',
    '---', '# f1', '',
  ].join('\n'));
  return dir;
}

test('computeHelp: blocked plan → switch <prereq> wins over the open-task implement branch', () => {
  const dir = buildBlockedPlanTree();
  try {
    const json = computeHelp({ dir, driftFn: () => false });
    assert.equal(json.nextStep.commandSource, 'fallback');
    assert.equal(json.nextStep.command, 'switch core-api');
    assert.equal(json.spineStage.name, 'PLANO');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
