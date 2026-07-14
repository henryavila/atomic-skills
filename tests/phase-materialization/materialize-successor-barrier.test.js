import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import {
  assertSuccessorMaterializationAllowed,
  materializeState,
  reconcileMaterializationHistory,
} from '../../scripts/materialize-state.js';
import { createHistoryFixture, sha256 } from './history-fixture.js';

function setPhaseStatus(path, id, status) {
  const raw = readFileSync(path, 'utf8');
  const end = raw.indexOf('\n---', 4);
  const plan = parseYaml(raw.slice(4, end));
  plan.phases.find((phase) => phase.id === id).status = status;
  writeFileSync(path, `---\n${stringifyYaml(plan)}---${raw.slice(end + 4)}`);
}

function configureSuccessorBarrier(path, receiptPath) {
  const raw = readFileSync(path, 'utf8');
  const end = raw.indexOf('\n---', 4);
  const plan = parseYaml(raw.slice(4, end));
  plan.stateIntegrityHardening = {
    enforcedFrom: '2026-07-14T20:00:00Z',
    successorBarriers: [{
      phaseId: 'F3', prerequisitePhaseId: 'F4', receiptPath,
    }],
  };
  writeFileSync(path, `---\n${stringifyYaml(plan)}---${raw.slice(end + 4)}`);
}

test('current receipt plus terminal prerequisite at closeSha allows F3', () => {
  const state = createHistoryFixture();
  try {
    reconcileMaterializationHistory({ ...state.options, apply: true });
    const result = assertSuccessorMaterializationAllowed({
      root: state.root, planPath: state.planRel, targetPhaseId: 'F3',
      prerequisitePhaseId: 'F4', receiptPath: state.receiptRel, closeSha: state.closeSha,
    });
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
    assert.throws(() => assertSuccessorMaterializationAllowed({
      root: state.root, planPath: state.planRel, targetPhaseId: 'F3',
      prerequisitePhaseId: 'F4', receiptPath: state.receiptRel, closeSha: state.closeSha,
    }), /F4.*terminal/i);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('a commit before F4 became done is not a coherent closeSha', () => {
  const state = createHistoryFixture();
  try {
    reconcileMaterializationHistory({ ...state.options, apply: true });
    assert.throws(() => assertSuccessorMaterializationAllowed({
      root: state.root, planPath: state.planRel, targetPhaseId: 'F3',
      prerequisitePhaseId: 'F4', receiptPath: state.receiptRel, closeSha: state.reviewedSha,
    }), /closeSha.*F4.*done/i);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('stale F0 receipt blocks successor activation', () => {
  const state = createHistoryFixture();
  try {
    reconcileMaterializationHistory({ ...state.options, apply: true });
    writeFileSync(state.completionLogPath, `${readFileSync(state.completionLogPath, 'utf8')}\n`);
    const event = JSON.parse(readFileSync(state.completionLogPath, 'utf8').trim());
    writeFileSync(state.completionLogPath, `${JSON.stringify({ ...event, weight: 9 })}\n`);
    assert.throws(() => assertSuccessorMaterializationAllowed({
      root: state.root, planPath: state.planRel, targetPhaseId: 'F3',
      prerequisitePhaseId: 'F4', receiptPath: state.receiptRel, closeSha: state.closeSha,
    }), /history receipt is stale/i);
  } finally {
    rmSync(state.root, { recursive: true, force: true });
  }
});

test('single materialization authority cannot bypass a configured successor barrier', () => {
  const state = createHistoryFixture();
  try {
    reconcileMaterializationHistory({ ...state.options, apply: true });
    configureSuccessorBarrier(state.planPath, state.receiptRel);
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
