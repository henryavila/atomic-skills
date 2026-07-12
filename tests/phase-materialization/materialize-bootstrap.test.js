import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify as stringifyYaml } from 'yaml';
import {
  decomposePlan,
  materializeDecomposition,
  writeInitiativeFile,
} from '../../src/decompose.js';
import { materializeState } from '../../scripts/materialize-state.js';
import { parseFrontmatter } from '../../scripts/validate-state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(__dirname, 'fixtures', 'e2e-lifecycle-source.md'), 'utf8');
const BUSINESS_INTENT = {
  value: 'Prevents a phase transition from exposing only half of its state.',
  workflow: 'Materialize a descriptor-only phase into an active initiative.',
  rules: 'Validate both candidate files before publishing either live file.',
  outOfScope: 'Does not harden reopen, switch, or close transitions.',
  doneWhen: 'The plan and initiative publish as one recoverable transaction.',
};

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'as-materialize-state-'));
  const files = materializeDecomposition(
    decomposePlan(SOURCE, { planSlug: 'e2e-lifecycle' }),
    {
      planSlug: 'e2e-lifecycle',
      projectId: 'atomic-skills',
      branch: 'plan/e2e-lifecycle',
      now: new Date('2026-07-01T09:00:00.000Z'),
      businessIntent: BUSINESS_INTENT,
    },
  );
  const plan = files.find((file) => file.kind === 'plan');
  const f1Source = files.find((file) => file.kind === 'source' && file.content.includes('"phaseId": "F1"'));
  const initiativePath = f1Source.relativePath.replace(/\.source\.json$/, '.md');
  const planAbs = join(root, plan.relativePath);
  mkdirSync(dirname(planAbs), { recursive: true });
  writeFileSync(planAbs, plan.content, 'utf8');
  return { root, files, plan, planAbs, initiativePath, f1Source };
}

function renderFrontmatter(frontmatter, body) {
  const renderedBody = body.startsWith('\n') ? body : `\n${body}`;
  return `---\n${stringifyYaml(frontmatter)}---${renderedBody}`;
}

function candidatePair(state) {
  const capture = JSON.parse(state.f1Source.content);
  const parsedPlan = parseFrontmatter(state.plan.content);
  assert.equal(parsedPlan.error, undefined);
  const planFm = structuredClone(parsedPlan.frontmatter);
  planFm.currentPhase = 'F1';
  planFm.lastUpdated = '2026-07-01T10:00:00.000Z';
  for (const phase of planFm.phases) {
    if (phase.id === 'F0') phase.status = 'done';
    if (phase.id === 'F1') {
      phase.status = 'active';
      phase.subPhaseCount = capture.tasks.length;
      phase.businessIntent = { ...BUSINESS_INTENT };
    }
  }
  const initiative = writeInitiativeFile(capture, 'e2e-lifecycle', {
    iso: '2026-07-01T10:00:00.000Z',
    branch: 'plan/e2e-lifecycle',
    active: true,
    stateRoot: '.atomic-skills',
    planDir: '.atomic-skills/projects/atomic-skills/e2e-lifecycle',
    projectId: 'atomic-skills',
    businessIntent: BUSINESS_INTENT,
    seenSlugs: new Set(),
    seenPaths: new Set(),
  });
  assert.equal(initiative.relativePath, state.initiativePath);
  return {
    planContent: renderFrontmatter(planFm, parsedPlan.body),
    initiativeContent: initiative.content,
  };
}

test('RED: an invalid staged pair touches no live bytes and publishes no marker', () => {
  const { root, plan, planAbs, initiativePath } = fixture();
  const before = readFileSync(planAbs);
  const markerPath = join(dirname(planAbs), '.materialize-state.json');
  try {
    assert.throws(
      () => materializeState({
        root,
        planPath: plan.relativePath,
        initiativePath,
        planContent: plan.content,
        initiativeContent: 'not valid frontmatter\n',
        txId: 'tx-invalid-pair',
      }),
      /validation|frontmatter|invalid/i,
    );
    assert.deepEqual(readFileSync(planAbs), before);
    assert.equal(existsSync(join(root, initiativePath)), false);
    assert.equal(existsSync(markerPath), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('fault after initiative rename leaves a durable marker and retry completes initiative then plan', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const beforePlan = readFileSync(state.planAbs, 'utf8');
  const initiativeAbs = join(state.root, state.initiativePath);
  const markerPath = join(dirname(state.planAbs), '.materialize-state.json');
  try {
    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
        ...pair,
        txId: 'tx-after-initiative',
        faultAt: 'after-initiative-rename',
      }),
      /fault injection: after-initiative-rename/,
    );
    assert.equal(readFileSync(state.planAbs, 'utf8'), beforePlan);
    assert.equal(readFileSync(initiativeAbs, 'utf8'), pair.initiativeContent);
    const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
    assert.equal(marker.txId, 'tx-after-initiative');
    assert.ok(Object.values(marker.paths).every((path) => !path.startsWith('/')));
    assert.match(marker.hashes.plan.before, /^[a-f0-9]{64}$/);
    assert.match(marker.hashes.plan.after, /^[a-f0-9]{64}$/);

    const result = materializeState({
      root: state.root,
      planPath: state.plan.relativePath,
      initiativePath: state.initiativePath,
    });
    assert.equal(result.status, 'complete');
    assert.equal(readFileSync(state.planAbs, 'utf8'), pair.planContent);
    assert.equal(readFileSync(initiativeAbs, 'utf8'), pair.initiativeContent);
    assert.equal(existsSync(markerPath), false);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('fault after plan rename keeps the completed pair recoverable and retry only finalizes it', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const initiativeAbs = join(state.root, state.initiativePath);
  const markerPath = join(dirname(state.planAbs), '.materialize-state.json');
  try {
    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
        ...pair,
        txId: 'tx-after-plan',
        faultAt: 'after-plan-rename',
      }),
      /fault injection: after-plan-rename/,
    );
    assert.equal(readFileSync(state.planAbs, 'utf8'), pair.planContent);
    assert.equal(readFileSync(initiativeAbs, 'utf8'), pair.initiativeContent);
    assert.equal(existsSync(markerPath), true);

    const result = materializeState({
      root: state.root,
      planPath: state.plan.relativePath,
      initiativePath: state.initiativePath,
    });
    assert.equal(result.status, 'complete');
    assert.equal(result.recovered, true);
    assert.equal(readFileSync(state.planAbs, 'utf8'), pair.planContent);
    assert.equal(readFileSync(initiativeAbs, 'utf8'), pair.initiativeContent);
    assert.equal(existsSync(markerPath), false);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('retry rolls back to the exact previous pair when required staging was lost', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const beforePlan = readFileSync(state.planAbs);
  const initiativeAbs = join(state.root, state.initiativePath);
  const markerPath = join(dirname(state.planAbs), '.materialize-state.json');
  try {
    assert.throws(() => materializeState({
      root: state.root,
      planPath: state.plan.relativePath,
      initiativePath: state.initiativePath,
      ...pair,
      txId: 'tx-lost-stage',
      faultAt: 'after-initiative-rename',
    }), /fault injection/);
    const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
    rmSync(resolve(state.root, marker.paths.txDir, 'stage'), { recursive: true, force: true });

    const result = materializeState({
      root: state.root,
      planPath: state.plan.relativePath,
      initiativePath: state.initiativePath,
    });
    assert.equal(result.status, 'rolled-back');
    assert.deepEqual(readFileSync(state.planAbs), beforePlan);
    assert.equal(existsSync(initiativeAbs), false);
    assert.equal(existsSync(markerPath), false);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('retry fails closed without writes when a live hash is outside before/after', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const initiativeAbs = join(state.root, state.initiativePath);
  const markerPath = join(dirname(state.planAbs), '.materialize-state.json');
  try {
    assert.throws(() => materializeState({
      root: state.root,
      planPath: state.plan.relativePath,
      initiativePath: state.initiativePath,
      ...pair,
      txId: 'tx-ambiguous',
      faultAt: 'after-initiative-rename',
    }), /fault injection/);
    writeFileSync(state.planAbs, 'concurrent unknown bytes\n', 'utf8');
    const strangePlan = readFileSync(state.planAbs);
    const publishedInitiative = readFileSync(initiativeAbs);

    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
      }),
      /ambiguous live plan hash/,
    );
    assert.deepEqual(readFileSync(state.planAbs), strangePlan);
    assert.deepEqual(readFileSync(initiativeAbs), publishedInitiative);
    assert.equal(existsSync(markerPath), true);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('repeating the same completed request is idempotent', () => {
  const state = fixture();
  const pair = candidatePair(state);
  try {
    const request = {
      root: state.root,
      planPath: state.plan.relativePath,
      initiativePath: state.initiativePath,
      ...pair,
      txId: 'tx-idempotent',
    };
    assert.equal(materializeState(request).status, 'complete');
    const planAfter = readFileSync(state.planAbs);
    const initiativeAfter = readFileSync(join(state.root, state.initiativePath));

    const retry = materializeState(request);
    assert.equal(retry.status, 'complete');
    assert.equal(retry.idempotent, true);
    assert.deepEqual(readFileSync(state.planAbs), planAfter);
    assert.deepEqual(readFileSync(join(state.root, state.initiativePath)), initiativeAfter);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('materialization rejects symlinked plan ancestry without touching the external target', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const outside = mkdtempSync(join(tmpdir(), 'as-materialize-state-outside-'));
  const planDir = dirname(state.planAbs);
  const txDir = join(outside, '.materialize-state-tx-symlink-escape');
  const sentinel = join(txDir, 'sentinel.txt');
  const initiativeOutside = join(outside, 'phases', basename(state.initiativePath));
  const beforePlan = state.plan.content;
  try {
    rmSync(planDir, { recursive: true, force: true });
    writeFileSync(join(outside, 'plan.md'), beforePlan, 'utf8');
    mkdirSync(txDir, { recursive: true });
    writeFileSync(sentinel, 'must survive\n', 'utf8');
    symlinkSync(outside, planDir, process.platform === 'win32' ? 'junction' : 'dir');

    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
        ...pair,
        txId: 'tx-symlink-escape',
      }),
      /symbolic link|symlink/i,
    );
    assert.equal(readFileSync(join(outside, 'plan.md'), 'utf8'), beforePlan);
    assert.equal(readFileSync(sentinel, 'utf8'), 'must survive\n');
    assert.equal(existsSync(initiativeOutside), false);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('recovery rejects a transaction directory replaced by a symlink', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const outside = mkdtempSync(join(tmpdir(), 'as-materialize-state-recovery-outside-'));
  const sentinel = join(outside, 'sentinel.txt');
  const markerPath = join(dirname(state.planAbs), '.materialize-state.json');
  try {
    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
        ...pair,
        txId: 'tx-recovery-symlink',
        faultAt: 'after-initiative-rename',
      }),
      /fault injection: after-initiative-rename/,
    );
    const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
    const txDir = resolve(state.root, marker.paths.txDir);
    const planBeforeRetry = readFileSync(state.planAbs);
    const initiativeBeforeRetry = readFileSync(join(state.root, state.initiativePath));
    rmSync(txDir, { recursive: true, force: true });
    writeFileSync(sentinel, 'must survive\n', 'utf8');
    symlinkSync(outside, txDir, process.platform === 'win32' ? 'junction' : 'dir');

    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
      }),
      /marker paths\.txDir.*symbolic link/i,
    );
    assert.equal(readFileSync(sentinel, 'utf8'), 'must survive\n');
    assert.deepEqual(readFileSync(state.planAbs), planBeforeRetry);
    assert.deepEqual(
      readFileSync(join(state.root, state.initiativePath)),
      initiativeBeforeRetry,
    );
    assert.equal(existsSync(markerPath), true);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('materialization rejects an initiative path outside the supplied plan phases directory', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const beforePlan = readFileSync(state.planAbs);
  const foreignInitiativePath = join(
    '.atomic-skills',
    'projects',
    'atomic-skills',
    'other-plan',
    'phases',
    basename(state.initiativePath),
  );
  try {
    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: foreignInitiativePath,
        ...pair,
        txId: 'tx-foreign-initiative',
      }),
      /initiativePath.*plan.*phases/i,
    );
    assert.deepEqual(readFileSync(state.planAbs), beforePlan);
    assert.equal(existsSync(join(state.root, foreignInitiativePath)), false);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('materialization never adopts or removes a pre-existing transaction directory', () => {
  const state = fixture();
  const pair = candidatePair(state);
  const beforePlan = readFileSync(state.planAbs);
  const txDir = join(dirname(state.planAbs), '.materialize-state-tx-preexisting');
  const sentinel = join(txDir, 'sentinel.txt');
  try {
    mkdirSync(txDir, { recursive: true });
    writeFileSync(sentinel, 'must survive\n', 'utf8');
    assert.throws(
      () => materializeState({
        root: state.root,
        planPath: state.plan.relativePath,
        initiativePath: state.initiativePath,
        ...pair,
        txId: 'tx-preexisting',
      }),
      /transaction directory already exists/i,
    );
    assert.deepEqual(readFileSync(state.planAbs), beforePlan);
    assert.equal(readFileSync(sentinel, 'utf8'), 'must survive\n');
    assert.equal(existsSync(join(state.root, state.initiativePath)), false);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('materialize skill routes descriptor-only publication through the package-root authority', () => {
  const detail = readFileSync(
    join(__dirname, '..', '..', 'skills', 'shared', 'project-assets', 'project-materialize.md'),
    'utf8',
  );
  const command = detail.split('\n').find((line) => line.includes('/scripts/materialize-state.js')) ?? '';
  assert.match(command, /\$HOME\/\.atomic-skills\/package-root/);
  assert.match(command, /--plan .*\/plan\.md --initiative .*\/phases\//);
  assert.match(detail, /one command, no sequential live writes/);
  assert.doesNotMatch(detail, /Write the returned initiative file with `\{\{WRITE_TOOL\}\}`/);
  assert.match(detail, /descriptor-only-to-initiative publication inside `materialize`/);
});
