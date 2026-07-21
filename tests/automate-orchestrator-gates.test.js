import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  shouldRunPureMaestro,
  canSpawnPhaseWriter,
  canCloseTasksFromClaims,
  canDoneFromAutomateClaims,
  canRunPhaseDone,
  canFinalizeOrArchive,
  automateModeSnapshot,
} from '../src/automate-orchestrator-gates.js';
import { complexTaskAllowsDone } from '../src/complex-task.js';

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
    assert.match(canCloseTasksFromClaims({}).reason || '', /missing claim/i);
  });

  it('accepts valid claim report', () => {
    const r = canCloseTasksFromClaims({
      claimReport: { tasks: [goodTask] },
    });
    assert.equal(r.ok, true);
  });

  it('rejects overlapping multi-task SHAs', () => {
    const shared = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const r = canCloseTasksFromClaims({
      claimReport: {
        tasks: [
          { ...goodTask, taskId: 'T-001', commitShas: [shared] },
          {
            ...goodTask,
            taskId: 'T-002',
            commitShas: [shared],
            paths: ['src/b.js'],
          },
        ],
      },
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /overlap|ambiguous/i);
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

describe('canDoneFromAutomateClaims (claim-bound automate done)', () => {
  const sha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const goodTask = {
    taskId: 'T-001',
    status: 'claimed-pass',
    commitShas: [sha],
    paths: ['src/a.js'],
    verifierCommand: 'node -e "process.exit(0)"',
    exitCode: 0,
    transcript: '',
  };

  it('rejects missing claim report (claim-bound)', () => {
    const r = canDoneFromAutomateClaims({});
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /missing claim/i);
  });

  it('defaults checkReachability true for automate done', () => {
    // Valid claim shape alone is insufficient without reachable set (default on).
    const noReach = canDoneFromAutomateClaims({
      claimReport: { tasks: [goodTask] },
    });
    assert.equal(noReach.ok, false, 'reachability defaults true → empty set fails');
    assert.match(noReach.reason || '', /reachab|missing|not reachable/i);

    const reachable = canDoneFromAutomateClaims({
      claimReport: { tasks: [goodTask] },
      reachableSet: new Set([sha]),
    });
    assert.equal(reachable.ok, true, reachable.reason);

    // Explicit opt-out allowed for pre-merge claim-shape-only checks
    const shapeOnly = canDoneFromAutomateClaims({
      claimReport: { tasks: [goodTask] },
      checkReachability: false,
    });
    assert.equal(shapeOnly.ok, true, shapeOnly.reason);
  });

  it('rejects non-reachable SHA under default reachability', () => {
    const r = canDoneFromAutomateClaims({
      claimReport: { tasks: [goodTask] },
      reachableSet: new Set(['cccccccccccccccccccccccccccccccccccccccc']),
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /not reachable|reachab/i);
  });

  it('rejects overlapping SHAs even with reachability opted out', () => {
    const shared = 'dddddddddddddddddddddddddddddddddddddddd';
    const r = canDoneFromAutomateClaims({
      checkReachability: false,
      claimReport: {
        tasks: [
          { ...goodTask, taskId: 'T-001', commitShas: [shared] },
          {
            ...goodTask,
            taskId: 'T-002',
            commitShas: [shared],
            paths: ['src/b.js'],
          },
        ],
      },
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /overlap|ambiguous/i);
  });
});

describe('complexTaskAllowsDone (complex-before-done under automate)', () => {
  it('non-complex allows verifier-only path (no receipt)', () => {
    const r = complexTaskAllowsDone({
      task: { weight: 1, tags: [], destructiveDiff: false },
    });
    assert.equal(r.ok, true);
    assert.equal(r.complex, false);
    assert.equal(r.path, 'verifier-only');
  });

  it('complex without receipt blocks done', () => {
    const r = complexTaskAllowsDone({
      task: { weight: 3 },
    });
    assert.equal(r.ok, false);
    assert.equal(r.complex, true);
    assert.match(r.reason || '', /receipt|both|complex/i);
  });

  it('complex with durable review receipt mode both allows done', () => {
    const r = complexTaskAllowsDone({
      task: { tags: ['destructive'] },
      reviewReceipt: {
        mode: 'both',
        reviewFile: '.atomic-skills/reviews/demo-t001-both.md',
        verifiedAt: '2026-07-21T00:00:00.000Z',
      },
    });
    assert.equal(r.ok, true, r.reason);
    assert.equal(r.complex, true);
    assert.equal(r.path, 'both-receipt');
  });

  it('complex with local mode receipt still blocks', () => {
    const r = complexTaskAllowsDone({
      task: { destructiveDiff: true },
      reviewReceipt: {
        mode: 'local',
        reviewFile: '.atomic-skills/reviews/demo-local.md',
      },
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /both|mode/i);
  });

  it('complex with operator disposition skip allows done', () => {
    const r = complexTaskAllowsDone({
      task: { weight: 5 },
      operatorSkip: true,
      disposition: 'accept',
      reason: 'operator accepted residual risk after local review',
    });
    assert.equal(r.ok, true, r.reason);
    assert.equal(r.complex, true);
    assert.equal(r.path, 'operator-disposition');
  });

  it('complex operator skip without disposition or reason blocks', () => {
    assert.equal(
      complexTaskAllowsDone({
        task: { weight: 3 },
        operatorSkip: true,
        reason: 'no disposition',
      }).ok,
      false,
    );
    assert.equal(
      complexTaskAllowsDone({
        task: { weight: 3 },
        operatorSkip: true,
        disposition: 'accept',
        reason: '',
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

  it('phase-done blocked under stamp with evaluation but without lessonsState', () => {
    assert.equal(
      canRunPhaseDone({
        planExecutionMode: 'automate',
        evaluationGate: {
          status: 'passed',
          verdict: 'pass',
          reportPath: '.atomic-skills/reviews/eval.md',
        },
      }).ok,
      false,
    );
  });

  it('phase-done ok under stamp with evaluation + lessonsState none', () => {
    assert.equal(
      canRunPhaseDone({
        planExecutionMode: 'automate',
        evaluationGate: {
          status: 'passed',
          verdict: 'pass',
          reportPath: '.atomic-skills/reviews/eval.md',
        },
        lessonsState: 'none',
      }).ok,
      true,
    );
  });

  it('phase-done ok under stamp with evaluation + lessons recorded+path', () => {
    assert.equal(
      canRunPhaseDone({
        planExecutionMode: 'automate',
        evaluationGate: {
          status: 'passed',
          verdict: 'pass',
          reportPath: '.atomic-skills/reviews/eval.md',
        },
        lessonsState: 'recorded',
        lessonsPath:
          '.atomic-skills/projects/demo/plan/lessons/f0-demo.md',
      }).ok,
      true,
    );
  });

  it('phase-done blocked when recorded without lessonsPath', () => {
    assert.equal(
      canRunPhaseDone({
        planExecutionMode: 'automate',
        evaluationGate: {
          status: 'passed',
          verdict: 'pass',
          reportPath: '.atomic-skills/reviews/eval.md',
        },
        lessonsState: 'recorded',
      }).ok,
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
