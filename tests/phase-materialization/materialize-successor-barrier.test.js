import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import {
  assertSuccessorMaterializationAllowed,
  materializeState,
  reconcileMaterializationHistory,
} from '../../scripts/materialize-state.js';
import { buildF3Pair, createHistoryFixture, git, sha256 } from './history-fixture.js';

function setPhaseStatus(path, id, status) {
  const raw = readFileSync(path, 'utf8');
  const end = raw.indexOf('\n---', 4);
  const plan = parseYaml(raw.slice(4, end));
  plan.phases.find((phase) => phase.id === id).status = status;
  writeFileSync(path, `---\n${stringifyYaml(plan)}---${raw.slice(end + 4)}`);
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
