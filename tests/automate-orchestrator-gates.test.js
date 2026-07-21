import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  shouldRunPureMaestro,
  canSpawnPhaseWriter,
  canCloseTasksFromClaims,
  canRunPhaseDone,
  canFinalizeOrArchive,
  automateModeSnapshot,
} from '../src/automate-orchestrator-gates.js';

describe('shouldRunPureMaestro', () => {
  it('true for cli automate', () => {
    assert.equal(shouldRunPureMaestro({ cliMode: 'automate' }), true);
  });
  it('false by default', () => {
    assert.equal(shouldRunPureMaestro({}), false);
  });
  it('stamp alone true; clear flag false', () => {
    assert.equal(shouldRunPureMaestro({ planExecutionMode: 'automate' }), true);
    assert.equal(
      shouldRunPureMaestro({
        planExecutionMode: 'automate',
        clearExecutionMode: true,
      }),
      false,
    );
  });
});

describe('canSpawnPhaseWriter', () => {
  it('ok when missing', () => {
    assert.equal(canSpawnPhaseWriter({ leaseStatus: 'missing' }).ok, true);
    assert.equal(canSpawnPhaseWriter({}).ok, true);
  });
  it('blocks active/cleared/malformed', () => {
    assert.equal(canSpawnPhaseWriter({ leaseStatus: 'active' }).ok, false);
    assert.equal(canSpawnPhaseWriter({ leaseStatus: 'cleared' }).ok, false);
    assert.equal(canSpawnPhaseWriter({ leaseStatus: 'malformed' }).ok, false);
  });
});

describe('canCloseTasksFromClaims', () => {
  const goodTask = {
    taskId: 'T-001',
    status: 'claimed-pass',
    commitShas: ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
    paths: ['src/a.js'],
    verifierCommand: 'node -e "process.exit(0)"',
    exitCode: 0,
    transcript: '',
  };

  it('rejects missing report', () => {
    assert.equal(canCloseTasksFromClaims({}).ok, false);
  });

  it('accepts valid claim report', () => {
    const r = canCloseTasksFromClaims({
      claimReport: { tasks: [goodTask] },
    });
    assert.equal(r.ok, true);
  });

  it('reachability check when requested', () => {
    const sha = goodTask.commitShas[0];
    assert.equal(
      canCloseTasksFromClaims({
        claimReport: { tasks: [goodTask] },
        checkReachability: true,
        reachableSet: new Set([sha]),
      }).ok,
      true,
    );
    assert.equal(
      canCloseTasksFromClaims({
        claimReport: { tasks: [goodTask] },
        checkReachability: true,
        reachableSet: new Set(),
      }).ok,
      false,
    );
  });
});

describe('canRunPhaseDone + canFinalizeOrArchive', () => {
  it('phase-done blocked under stamp without evaluation', () => {
    assert.equal(
      canRunPhaseDone({ planExecutionMode: 'automate' }).ok,
      false,
    );
  });

  it('finalize durable stamp still gates when session clear would turn isAutomateActive off', () => {
    // H1: stamp remains → durable HARD-BLOCK even if session cleared
    const gates = canFinalizeOrArchive({
      planExecutionMode: 'automate',
      clearExecutionMode: true,
      receipt: null,
      userValidatedAt: null,
    });
    assert.equal(gates.ok, false);
    assert.equal(gates.planEndReviewOk, false);
  });

  it('finalize open when non-automate', () => {
    const gates = canFinalizeOrArchive({ receipt: null });
    assert.equal(gates.ok, true);
  });
});

describe('automateModeSnapshot', () => {
  it('distinguishes session vs durable when clear flag set', () => {
    const s = automateModeSnapshot({
      planExecutionMode: 'automate',
      clearExecutionMode: true,
    });
    assert.equal(s.sessionAutomate, false);
    assert.equal(s.durableAutomate, true);
    assert.equal(s.hasStamp, true);
  });
});
