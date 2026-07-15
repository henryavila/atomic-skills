import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import {
  assertSuccessorMaterializationAllowed,
  materializeState,
  reconcileMaterializationHistory as reconcileHistory,
  runMaterializeState,
} from '../../scripts/materialize-state.js';
import { buildF3Pair, createHistoryFixture, git, sha256 } from './history-fixture.js';

function reconcileMaterializationHistory(options) {
  const result = reconcileHistory(options);
  if (options.apply === true) {
    git(options.root, ['add', options.receiptPath]);
    git(options.root, ['commit', '-qm', 'authenticate reconciliation receipt']);
  }
  return result;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function completionDigest(event) {
  return sha256(JSON.stringify(canonicalize(event)));
}

function setPhaseStatus(path, id, status) {
  const raw = readFileSync(path, 'utf8');
  const end = raw.indexOf('\n---', 4);
  const plan = parseYaml(raw.slice(4, end));
  plan.phases.find((phase) => phase.id === id).status = status;
  writeFileSync(path, `---\n${stringifyYaml(plan)}---${raw.slice(end + 4)}`);
}

function mutateFrontmatter(path, mutate) {
  const raw = readFileSync(path, 'utf8');
  const end = raw.indexOf('\n---', 4);
  const frontmatter = parseYaml(raw.slice(4, end));
  mutate(frontmatter);
  writeFileSync(path, `---\n${stringifyYaml(frontmatter)}---${raw.slice(end + 4)}`);
}

function bindF4Event(state, closeSha) {
  const events = readFileSync(state.completionLogPath, 'utf8').trim().split('\n').map(JSON.parse);
  events.find((event) => event.phaseId === 'F4').closeSha = closeSha;
  writeFileSync(state.completionLogPath, `${events.map(JSON.stringify).join('\n')}\n`);
}

function receiptContract(state) {
  return {
    receiptIdentity: { projectId: 'proj', planSlug: 'demo', phaseId: 'F0' },
    receiptSources: {
      planPath: state.planRel,
      initiativePath: state.initiativeRel,
      creationGatePath: state.creationGateRel,
      completionLogPath: state.completionLogRel,
      sidecarPaths: [state.sidecarRel],
    },
  };
}

function barrierArgs(state, overrides = {}) {
  return {
    root: state.root, planPath: state.planRel, targetPhaseId: 'F3',
    prerequisitePhaseId: 'F4', receiptPath: state.receiptRel,
    closeSha: state.closeSha, ...receiptContract(state), ...overrides,
  };
}

function configureSuccessorBarrier(state) {
  const path = state.planPath;
  const raw = readFileSync(path, 'utf8');
  const end = raw.indexOf('\n---', 4);
  const plan = parseYaml(raw.slice(4, end));
  plan.stateIntegrityHardening = {
    enforcedFrom: '2026-07-14T20:00:00Z',
    successorBarriers: [{
      phaseId: 'F3', prerequisitePhaseId: 'F4', receiptPath: state.receiptRel,
      ...receiptContract(state),
    }],
  };
  writeFileSync(path, `---\n${stringifyYaml(plan)}---${raw.slice(end + 4)}`);
}

test('current receipt plus terminal prerequisite at closeSha allows F3', () => {
  const state = createHistoryFixture();
  try {
    reconcileMaterializationHistory({ ...state.options, apply: true });
    const result = assertSuccessorMaterializationAllowed(barrierArgs(state));
    assert.equal(result.allowed, true);
    assert.equal(result.closeSha, state.closeSha);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('successor receipt identity must own the project-scoped plan path', () => {
  const state = createHistoryFixture();
  try {
    reconcileMaterializationHistory({ ...state.options, apply: true });
    assert.throws(
      () => assertSuccessorMaterializationAllowed(barrierArgs(state, {
        receiptIdentity: { projectId: 'other-project', planSlug: 'demo', phaseId: 'F0' },
      })),
      /planPath.*project|owning project/i,
    );
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('current prerequisite initiative must still resolve uniquely before F3 activation', () => {
  const state = createHistoryFixture();
  try {
    reconcileMaterializationHistory({ ...state.options, apply: true });
    rmSync(state.f4InitiativePath);
    assert.throws(
      () => assertSuccessorMaterializationAllowed(barrierArgs(state)),
      /current F4 initiative.*uniquely|found 0/i,
    );
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('current prerequisite initiative drift blocks F3 even when closeSha remains valid', () => {
  const state = createHistoryFixture();
  try {
    reconcileMaterializationHistory({ ...state.options, apply: true });
    mutateFrontmatter(state.f4InitiativePath, (initiative) => {
      initiative.tasks[0].status = 'pending';
      delete initiative.tasks[0].closedAt;
    });
    assert.throws(
      () => assertSuccessorMaterializationAllowed(barrierArgs(state)),
      /current F4 initiative.*task/i,
    );
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('pending F4 blocks direct F3 activation even with a current receipt', () => {
  const state = createHistoryFixture();
  try {
    reconcileMaterializationHistory({ ...state.options, apply: true });
    setPhaseStatus(state.planPath, 'F4', 'active');
    assert.throws(() => assertSuccessorMaterializationAllowed(barrierArgs(state)), /F4.*terminal/i);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('a commit before F4 became done is not a coherent closeSha', () => {
  const state = createHistoryFixture();
  try {
    reconcileMaterializationHistory({ ...state.options, apply: true });
    assert.throws(() => assertSuccessorMaterializationAllowed(
      barrierArgs(state, { closeSha: state.reviewedSha }),
    ), /closeSha.*F4.*done/i);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('stale F0 receipt blocks successor activation', () => {
  const state = createHistoryFixture();
  try {
    reconcileMaterializationHistory({ ...state.options, apply: true });
    const events = readFileSync(state.completionLogPath, 'utf8').trim().split('\n').map(JSON.parse);
    events.find((event) => event.phaseId === 'F0').weight = 9;
    writeFileSync(state.completionLogPath, `${events.map(JSON.stringify).join('\n')}\n`);
    assert.throws(() => assertSuccessorMaterializationAllowed(barrierArgs(state)), /history receipt is stale/i);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('successor activation rejects a live reconciliation receipt not authenticated by HEAD', () => {
  const state = createHistoryFixture();
  try {
    reconcileMaterializationHistory({ ...state.options, apply: true });
    const forged = JSON.parse(readFileSync(state.receiptPath, 'utf8'));
    forged.classification = forged.classification === 'consistent' ? 'repairable' : 'consistent';
    writeFileSync(state.receiptPath, `${JSON.stringify(forged, null, 2)}\n`);

    assert.throws(
      () => assertSuccessorMaterializationAllowed(barrierArgs(state)),
      /receipt.*(?:HEAD|commit|authenticated)/i,
    );
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('a single exact reconciliation tombstone makes duplicate F4 closes logically singular', () => {
  const state = createHistoryFixture();
  try {
    reconcileMaterializationHistory({ ...state.options, apply: true });
    const events = readFileSync(state.completionLogPath, 'utf8').trim().split('\n').map(JSON.parse);
    const canonical = events.find((event) => event.event === 'phase-done' && event.phaseId === 'F4');
    const duplicate = structuredClone(canonical);
    const digest = completionDigest(canonical);
    events.push(duplicate, {
      ts: '2026-07-14T20:00:02Z', event: 'reconcile', projectId: 'proj',
      planSlug: 'demo', phaseId: 'F4', taskId: null, weight: 0, weightBasis: 'count',
      idempotencyKey: `reconcile:proj/demo/F4:${state.closeSha}:${digest}`,
      closeSha: state.closeSha,
      reconciliation: {
        action: 'ignore-duplicate-completion', eventIdentity: 'phase-done:<phase>',
        canonicalDigest: digest, duplicateDigests: [digest],
      },
    });
    writeFileSync(state.completionLogPath, `${events.map(JSON.stringify).join('\n')}\n`);

    assert.equal(assertSuccessorMaterializationAllowed(barrierArgs(state)).allowed, true);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('single materialization authority cannot bypass a configured successor barrier', () => {
  const state = createHistoryFixture();
  try {
    reconcileMaterializationHistory({ ...state.options, apply: true });
    configureSuccessorBarrier(state);
    const planContent = readFileSync(state.planPath, 'utf8');
    assert.throws(() => materializeState({
      root: state.root,
      planPath: state.planRel,
      initiativePath: '.atomic-skills/projects/proj/demo/phases/f3-demo.md',
      planContent,
      initiativeContent: '---\nphaseId: F3\n---\n',
      expectedPlanHash: sha256(planContent),
      txId: 'barrier-bypass',
    }), /F3 materialization requires prerequisiteCloseSha/);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('successor publication holds the completion ledger lock through both live renames', () => {
  const state = createHistoryFixture();
  try {
    reconcileMaterializationHistory({ ...state.options, apply: true });
    configureSuccessorBarrier(state);
    const pair = buildF3Pair(state);
    const observed = [];
    const result = materializeState({
      root: state.root,
      planPath: state.planRel,
      initiativePath: '.atomic-skills/projects/proj/demo/phases/f3-demo.md',
      ...pair,
      prerequisiteCloseSha: state.closeSha,
      txId: 'ledger-lock-publication',
      faultAt: (point) => {
        if (point === 'before-initiative-rename' || point === 'before-plan-rename') {
          observed.push(point);
          assert.equal(
            existsSync(join(state.root, '.atomic-skills/analytics/.completions.lock')),
            true,
            `${point} must execute inside the completion-ledger critical section`,
          );
        }
      },
    });
    assert.equal(result.status, 'complete');
    assert.deepEqual(observed, ['before-initiative-rename', 'before-plan-rename']);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('completed-pair recovery holds the completion ledger lock through authorization cleanup', () => {
  const state = createHistoryFixture();
  try {
    reconcileMaterializationHistory({ ...state.options, apply: true });
    configureSuccessorBarrier(state);
    const pair = buildF3Pair(state);
    assert.throws(() => materializeState({
      root: state.root,
      planPath: state.planRel,
      initiativePath: '.atomic-skills/projects/proj/demo/phases/f3-demo.md',
      ...pair,
      prerequisiteCloseSha: state.closeSha,
      txId: 'ledger-lock-complete-recovery',
      faultAt: 'after-plan-rename',
    }), /fault injection/);
    const result = materializeState({
      root: state.root,
      planPath: state.planRel,
      initiativePath: '.atomic-skills/projects/proj/demo/phases/f3-demo.md',
      faultAt: (point) => {
        if (point === 'before-complete-cleanup') {
          assert.equal(
            existsSync(join(state.root, '.atomic-skills/analytics/.completions.lock')),
            true,
            'final authorization and cleanup must share the ledger lock',
          );
        }
      },
    });
    assert.equal(result.status, 'complete');
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('status-only close commit cannot borrow review and gate evidence from live state', () => {
  const state = createHistoryFixture();
  try {
    reconcileMaterializationHistory({ ...state.options, apply: true });
    const valid = readFileSync(state.planPath, 'utf8');
    const end = valid.indexOf('\n---', 4);
    const invalid = parseYaml(valid.slice(4, end));
    const f4 = invalid.phases.find((phase) => phase.id === 'F4');
    delete f4.reviewGate;
    f4.exitGate.criteria[0].status = 'deferred';
    writeFileSync(state.planPath, `---\n${stringifyYaml(invalid)}---${valid.slice(end + 4)}`);
    git(state.root, ['add', state.planRel]);
    git(state.root, ['commit', '-qm', 'status-only F4 close']);
    const statusOnlySha = git(state.root, ['rev-parse', 'HEAD']);
    writeFileSync(state.planPath, valid);

    assert.throws(
      () => assertSuccessorMaterializationAllowed(barrierArgs(state, { closeSha: statusOnlySha })),
      /historical F4.*(review|gate)/i,
    );
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('close authorization requires the review receipt to exist at closeSha', () => {
  const state = createHistoryFixture();
  try {
    reconcileMaterializationHistory({ ...state.options, apply: true });
    const reviewRel = '.atomic-skills/reviews/demo-f4.md';
    git(state.root, ['rm', '-q', reviewRel]);
    git(state.root, ['commit', '-qm', 'close without historical review receipt']);
    const missingReceiptCloseSha = git(state.root, ['rev-parse', 'HEAD']);

    writeFileSync(join(state.root, reviewRel), `late review ${state.reviewedSha}\n`);
    const events = readFileSync(state.completionLogPath, 'utf8').trim().split('\n').map(JSON.parse);
    events.find((event) => event.phaseId === 'F4').closeSha = missingReceiptCloseSha;
    writeFileSync(state.completionLogPath, `${events.map(JSON.stringify).join('\n')}\n`);
    git(state.root, ['add', reviewRel, state.completionLogRel]);
    git(state.root, ['commit', '-qm', 'add late review receipt and close event']);

    assert.throws(
      () => assertSuccessorMaterializationAllowed(barrierArgs(state, {
        closeSha: missingReceiptCloseSha,
      })),
      /review receipt.*closeSha|closeSha.*review receipt/i,
    );
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('historical review receipt mode must equal the persisted reviewGate mode', () => {
  const state = createHistoryFixture();
  try {
    reconcileMaterializationHistory({ ...state.options, apply: true });
    const reviewPath = join(state.root, '.atomic-skills/reviews/demo-f4.md');
    writeFileSync(reviewPath, readFileSync(reviewPath, 'utf8').replace('mode: local', 'mode: both'));
    git(state.root, ['add', '.atomic-skills/reviews/demo-f4.md']);
    git(state.root, ['commit', '-qm', 'mismatched historical review mode']);
    const closeSha = git(state.root, ['rev-parse', 'HEAD']);
    bindF4Event(state, closeSha);
    assert.throws(
      () => assertSuccessorMaterializationAllowed(barrierArgs(state, { closeSha })),
      /review.*mode|mode.*review/i,
    );
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('legacy historical receipt may authenticate mode from its immutable capture manifest', () => {
  const state = createHistoryFixture();
  try {
    reconcileMaterializationHistory({ ...state.options, apply: true });
    const reviewPath = join(state.root, '.atomic-skills/reviews/demo-f4.md');
    const legacyReceipt = readFileSync(reviewPath, 'utf8')
      .replace('mode: local\n', '')
      .concat('\n## Capture manifest\n\n- Mode: local; legacy sealed-envelope capture\n');
    writeFileSync(reviewPath, legacyReceipt);
    git(state.root, ['add', '.atomic-skills/reviews/demo-f4.md']);
    git(state.root, ['commit', '-qm', 'legacy review mode in capture manifest']);
    const closeSha = git(state.root, ['rev-parse', 'HEAD']);
    bindF4Event(state, closeSha);

    const result = assertSuccessorMaterializationAllowed(barrierArgs(state, { closeSha }));
    assert.equal(result.allowed, true);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('historical review receipt accepts a triple-dot review range', () => {
  const state = createHistoryFixture();
  try {
    reconcileMaterializationHistory({ ...state.options, apply: true });
    const reviewPath = join(state.root, '.atomic-skills/reviews/demo-f4.md');
    const ranged = readFileSync(reviewPath, 'utf8').replace(
      `artifact: ${'0'.repeat(40)}..${state.reviewedSha}`,
      `artifact: ${'b'.repeat(40)}...${state.reviewedSha}`,
    );
    writeFileSync(reviewPath, ranged);
    git(state.root, ['add', '.atomic-skills/reviews/demo-f4.md']);
    git(state.root, ['commit', '-qm', 'triple-dot review receipt']);
    const closeSha = git(state.root, ['rev-parse', 'HEAD']);
    bindF4Event(state, closeSha);
    assert.equal(assertSuccessorMaterializationAllowed(barrierArgs(state, { closeSha })).allowed, true);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('historical prerequisite initiative must be terminal with closed tasks and mirrored gates', () => {
  const state = createHistoryFixture();
  try {
    reconcileMaterializationHistory({ ...state.options, apply: true });
    mutateFrontmatter(state.f4InitiativePath, (initiative) => {
      initiative.status = 'active';
      initiative.tasks[0].status = 'pending';
      delete initiative.tasks[0].closedAt;
    });
    git(state.root, ['add', state.f4InitiativeRel]);
    git(state.root, ['commit', '-qm', 'contradictory F4 initiative']);
    const closeSha = git(state.root, ['rev-parse', 'HEAD']);
    bindF4Event(state, closeSha);
    assert.throws(
      () => assertSuccessorMaterializationAllowed(barrierArgs(state, { closeSha })),
      /(?:current|historical) F4 initiative.*terminal|task/i,
    );
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('reviewed commit must be an ancestor of the prerequisite close commit', () => {
  const state = createHistoryFixture();
  try {
    reconcileMaterializationHistory({ ...state.options, apply: true });
    const branch = git(state.root, ['branch', '--show-current']);
    git(state.root, ['checkout', '-qb', 'unrelated-review']);
    git(state.root, ['commit', '--allow-empty', '-qm', 'unrelated review commit']);
    const unrelatedReview = git(state.root, ['rev-parse', 'HEAD']);
    git(state.root, ['checkout', '-q', branch]);

    mutateFrontmatter(state.planPath, (plan) => {
      const f4 = plan.phases.find((phase) => phase.id === 'F4');
      f4.reviewGate.at = unrelatedReview;
      f4.exitGate.criteria[0].evidence.verifiedCommit = unrelatedReview;
    });
    mutateFrontmatter(state.f4InitiativePath, (initiative) => {
      initiative.exitGates[0].evidence.verifiedCommit = unrelatedReview;
    });
    const reviewPath = join(state.root, '.atomic-skills/reviews/demo-f4.md');
    writeFileSync(reviewPath, readFileSync(reviewPath, 'utf8').replace(state.reviewedSha, unrelatedReview));
    git(state.root, ['add', state.planRel, state.f4InitiativeRel, '.atomic-skills/reviews/demo-f4.md']);
    git(state.root, ['commit', '-qm', 'forge unrelated review ancestry']);
    const closeSha = git(state.root, ['rev-parse', 'HEAD']);
    bindF4Event(state, closeSha);
    assert.throws(
      () => assertSuccessorMaterializationAllowed(barrierArgs(state, { closeSha })),
      /review.*ancestor|ancestor.*review/i,
    );
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('CLI history-receipt check must bind expectations from a configured plan barrier', () => {
  const state = createHistoryFixture();
  try {
    reconcileMaterializationHistory({ ...state.options, apply: true });
    configureSuccessorBarrier(state);
    const io = { log: () => {} };
    assert.throws(
      () => runMaterializeState([
        '--root', state.root,
        '--check-history-receipt', state.receiptRel,
      ], io),
      /--plan|configured plan/i,
    );
    assert.equal(runMaterializeState([
      '--root', state.root,
      '--check-history-receipt', state.receiptRel,
      '--plan', state.planRel,
    ], io).ok, true);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('successor barrier requires exactly one phase close event bound to closeSha', () => {
  const state = createHistoryFixture();
  try {
    reconcileMaterializationHistory({ ...state.options, apply: true });
    writeFileSync(state.completionLogPath, `${JSON.stringify(state.event)}\n`);
    assert.throws(
      () => assertSuccessorMaterializationAllowed(barrierArgs(state)),
      /phase-done.*closeSha/i,
    );
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('successor barrier rejects a forged phase event with a non-canonical close identity', () => {
  const state = createHistoryFixture();
  try {
    reconcileMaterializationHistory({ ...state.options, apply: true });
    const events = readFileSync(state.completionLogPath, 'utf8').trim().split('\n').map(JSON.parse);
    events.find((event) => event.phaseId === 'F4').idempotencyKey = 'phase-done:forged';
    writeFileSync(state.completionLogPath, `${events.map(JSON.stringify).join('\n')}\n`);
    assert.throws(
      () => assertSuccessorMaterializationAllowed(barrierArgs(state)),
      /phase-done.*closeSha/i,
    );
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('stale receipt during marker recovery rolls back instead of publishing F3', () => {
  const state = createHistoryFixture();
  try {
    reconcileMaterializationHistory({ ...state.options, apply: true });
    configureSuccessorBarrier(state);
    const pair = buildF3Pair(state);
    assert.throws(() => materializeState({
      root: state.root, planPath: state.planRel,
      initiativePath: '.atomic-skills/projects/proj/demo/phases/f3-demo.md',
      ...pair, prerequisiteCloseSha: state.closeSha, txId: 'stale-recovery',
      faultAt: 'after-initiative-rename',
    }), /fault injection/);

    const events = readFileSync(state.completionLogPath, 'utf8').trim().split('\n').map(JSON.parse);
    events.find((event) => event.phaseId === 'F0').weight = 9;
    writeFileSync(state.completionLogPath, `${events.map(JSON.stringify).join('\n')}\n`);
    const result = materializeState({
      root: state.root, planPath: state.planRel,
      initiativePath: '.atomic-skills/projects/proj/demo/phases/f3-demo.md',
    });
    assert.equal(result.status, 'rolled-back');
    assert.equal(existsSync(join(state.root, '.atomic-skills/projects/proj/demo/phases/f3-demo.md')), false);
    const liveRaw = readFileSync(state.planPath, 'utf8');
    const live = parseYaml(liveRaw.slice(4, liveRaw.indexOf('\n---', 4)));
    assert.equal(live.phases.find((phase) => phase.id === 'F3').status, 'pending');
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});
