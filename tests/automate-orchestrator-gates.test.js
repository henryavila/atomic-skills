import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  shouldRunPureMaestro,
  canSpawnPhaseWriter,
  canSpawnHostThinPhaseWriter,
  canCloseTasksFromClaims,
  canDoneFromAutomateClaims,
  canRunPhaseDone,
  canFinalizeOrArchive,
  automateModeSnapshot,
} from '../src/automate-orchestrator-gates.js';
import { complexTaskAllowsDone } from '../src/complex-task.js';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSERT_SCRIPT = join(ROOT, 'scripts', 'assert-automate-gate.js');
describe('shouldRunPureMaestro', () => {
  it('true for cli automate', () => {
    assert.equal(shouldRunPureMaestro({ cliMode: 'automate' }), true);
  });
  it('true by default (automate-default F0 — bare implement is pure-maestro)', () => {
    assert.equal(shouldRunPureMaestro({}), true);
  });
  it('false for explicit Mode 1', () => {
    assert.equal(shouldRunPureMaestro({ cliMode: '1' }), false);
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
  it('descriptor-only refuse when initiativePresent false', () => {
    const r = canSpawnPhaseWriter({
      leaseStatus: 'missing',
      initiativePresent: false,
    });
    assert.equal(r.ok, false);
    assert.match(String(r.reason), /descriptor-only|initiative/i);
  });
  it('ok when lease clean and initiative present', () => {
    assert.equal(
      canSpawnPhaseWriter({
        leaseStatus: 'missing',
        initiativePresent: true,
        phaseMaterialized: true,
      }).ok,
      true,
    );
  });
});

describe('canSpawnHostThinPhaseWriter', () => {
  it('documents host-thin preconditions: lease clean + phase materialized', () => {
    assert.equal(
      canSpawnHostThinPhaseWriter({
        leaseStatus: 'missing',
        initiativePresent: true,
      }).ok,
      true,
    );
  });
  it('refuses missing materialization probe', () => {
    const r = canSpawnHostThinPhaseWriter({ leaseStatus: 'missing' });
    assert.equal(r.ok, false);
    assert.match(String(r.reason), /materialized|initiative/i);
  });
  it('refuses descriptor-only (initiativePresent false)', () => {
    const r = canSpawnHostThinPhaseWriter({
      leaseStatus: 'missing',
      initiativePresent: false,
      phaseMaterialized: false,
    });
    assert.equal(r.ok, false);
    assert.match(String(r.reason), /descriptor-only|initiative/i);
  });
  it('refuses when lease is active even if materialized', () => {
    const r = canSpawnHostThinPhaseWriter({
      leaseStatus: 'active',
      initiativePresent: true,
    });
    assert.equal(r.ok, false);
    assert.match(String(r.reason), /lease/i);
  });
});

/** Strong-enough BI spine for spawn integrity fixtures (5 fields). */
const INIT_BI_LINES = [
  'businessIntent:',
  '  value: "Sob automate o host fica magro e spawna writer so apos materialize com spine ratificada."',
  '  workflow: "Package draft → operator ratify → materialize Mode B → lease → spawn phase writer."',
  '  rules: "Nunca blank BI; nunca auto-PASS; never spawn before ratify; no product entrypoints on host."',
  '  outOfScope: "Layer 4 daemon multi-host; reescrever Mode 1 ou Mode 2; auto-PASS de gates manuais."',
  '  doneWhen: "assert-automate-gate --gate spawn exits 0 only with complete BI spine and active initiative."',
];

describe('assert-automate-gate spawn descriptor-only', () => {
  /** @type {string | null} */
  let tmp = null;

  function cleanup() {
    if (tmp) {
      try {
        rmSync(tmp, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      tmp = null;
    }
  }

  /**
   * @param {{ withInitiative?: boolean }} [opts]
   */
  function writePlanTree(opts = {}) {
    const withInitiative = opts.withInitiative !== false;
    tmp = mkdtempSync(join(tmpdir(), 'assert-spawn-'));
    const stateRoot = join(tmp, '.atomic-skills');
    const planDir = join(stateRoot, 'projects', 'demo', 'demo-plan');
    const phasesDir = join(planDir, 'phases');
    mkdirSync(phasesDir, { recursive: true });
    mkdirSync(join(stateRoot, 'status'), { recursive: true });
    const planBody = [
      '---',
      'schemaVersion: "0.1"',
      'slug: demo-plan',
      'status: active',
      'currentPhase: F1',
      'executionMode: automate',
      'phases:',
      '  - id: F0',
      '    status: done',
      '  - id: F1',
      '    status: pending',
      '    slug: f1-next',
      '---',
      '',
      '# plan',
      '',
    ].join('\n');
    writeFileSync(join(planDir, 'plan.md'), planBody, 'utf8');
    if (withInitiative) {
      writeFileSync(
        join(phasesDir, 'f1-next.md'),
        [
          '---',
          'schemaVersion: "0.1"',
          'slug: f1-next',
          'phaseId: F1',
          'status: active',
          'parentPlan: demo-plan',
          ...INIT_BI_LINES,
          '---',
          '',
          '# initiative',
          '',
        ].join('\n'),
        'utf8',
      );
    }
    return { stateRoot, planDir };
  }

  /**
   * @param {string[]} args
   * @param {{ cwd?: string }} [opts]
   */
  function run(args, opts = {}) {
    const result = spawnSync(process.execPath, [ASSERT_SCRIPT, ...args], {
      encoding: 'utf8',
      cwd: opts.cwd ?? ROOT,
      env: { ...process.env },
    });
    return {
      status: result.status ?? 1,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
    };
  }

  it('spawn fails when active phase initiative file is missing (descriptor-only)', () => {
    try {
      const { stateRoot } = writePlanTree({ withInitiative: false });
      const r = run(
        [
          '--plan',
          'demo-plan',
          '--project',
          'demo',
          '--gate',
          'spawn',
          '--skip-cursor',
          '--state-root',
          stateRoot,
          '--status-root',
          join(stateRoot, 'status'),
        ],
        { cwd: tmp ?? ROOT },
      );
      assert.notEqual(r.status, 0);
      const out = `${r.stdout}\n${r.stderr}`;
      assert.match(out, /descriptor-only|initiative|materialize/i);
    } finally {
      cleanup();
    }
  });

  it('spawn ok when lease clean and initiative materialized', () => {
    try {
      const { stateRoot } = writePlanTree({ withInitiative: true });
      const r = run(
        [
          '--plan',
          'demo-plan',
          '--project',
          'demo',
          '--gate',
          'spawn',
          '--skip-cursor',
          '--state-root',
          stateRoot,
          '--status-root',
          join(stateRoot, 'status'),
        ],
        { cwd: tmp ?? ROOT },
      );
      assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
      assert.match(r.stdout, /^ok\b/m);
    } finally {
      cleanup();
    }
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

  it('shape-only allows claimed-fail; done gate (requireAllClaimedPass) rejects it', () => {
    const failTask = {
      ...goodTask,
      status: 'claimed-fail',
      exitCode: 1,
    };
    assert.equal(
      canCloseTasksFromClaims({ claimReport: { tasks: [failTask] } }).ok,
      true,
    );
    const done = canCloseTasksFromClaims({
      claimReport: { tasks: [failTask] },
      requireAllClaimedPass: true,
    });
    assert.equal(done.ok, false);
    assert.match(done.reason || '', /claimed-pass/);
  });

  it('requireAllClaimedPass accepts claimed-pass with exit 0', () => {
    assert.equal(
      canCloseTasksFromClaims({
        claimReport: { tasks: [goodTask] },
        requireAllClaimedPass: true,
      }).ok,
      true,
    );
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
  const evalPassed = {
    status: 'passed',
    verdict: 'pass',
    reportPath: '.atomic-skills/reviews/eval-demo.md',
  };
  const decisionPassed = {
    status: 'passed',
    verifiedAt: '2026-07-23T12:00:00.000Z',
    packagePresentedAt: '2026-07-23T11:59:00.000Z',
    packagePath: 'decisions/F0.jsonl',
  };
  const reviewBoth = {
    status: 'passed',
    mode: 'both',
    at: 'a'.repeat(40),
    reviewFile: '.atomic-skills/reviews/f0-both.md',
    localReceiptPath: '.atomic-skills/reviews/f0-local.md',
    codexReceiptPath: '.atomic-skills/reviews/f0-codex.md',
  };
  const fullPhaseDoneOk = {
    planExecutionMode: 'automate',
    evaluationGate: evalPassed,
    lessonsState: 'none',
    reviewGate: reviewBoth,
    decisionReview: decisionPassed,
  };

  it('phase-done blocked under stamp without evaluation', () => {
    assert.equal(
      canRunPhaseDone({ planExecutionMode: 'automate' }).ok,
      false,
    );
  });

  it('automate + eval passed but lessons missing → block', () => {
    const r = canRunPhaseDone({
      planExecutionMode: 'automate',
      evaluationGate: evalPassed,
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /lessons/i);
  });

  it('automate + eval + lessons + review but decisionReview missing → block', () => {
    const r = canRunPhaseDone({
      planExecutionMode: 'automate',
      evaluationGate: evalPassed,
      lessonsState: 'none',
      reviewGate: reviewBoth,
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /decisionReview/);
  });

  it('automate + full chain + decisionReview pending → block', () => {
    const r = canRunPhaseDone({
      ...fullPhaseDoneOk,
      decisionReview: { status: 'pending' },
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /pending|decisionReview/i);
  });

  it('automate + full chain + decisionReview failed → block', () => {
    const r = canRunPhaseDone({
      ...fullPhaseDoneOk,
      decisionReview: { status: 'failed', verifiedAt: decisionPassed.verifiedAt },
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /failed|decisionReview/i);
  });

  it('automate + eval + lessons + review both + decisionReview passed → allow', () => {
    const r = canRunPhaseDone(fullPhaseDoneOk);
    assert.equal(r.ok, true, r.reason);
  });

  it('non-automate skips decisionReview (and evaluation)', () => {
    assert.equal(canRunPhaseDone({}).ok, true);
    assert.equal(
      canRunPhaseDone({
        planExecutionMode: 'manual',
        evaluationGate: null,
        decisionReview: null,
      }).ok,
      true,
    );
  });

  it('automate still requires evaluation even when decisionReview passed', () => {
    const r = canRunPhaseDone({
      planExecutionMode: 'automate',
      decisionReview: decisionPassed,
      lessonsState: 'none',
      reviewGate: reviewBoth,
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /evaluationGate/);
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

describe('assert-automate-gate path safety + flat plan', () => {
  /** @type {string | null} */
  let tmp = null;

  function cleanup() {
    if (tmp) {
      try {
        rmSync(tmp, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      tmp = null;
    }
  }

  /**
   * @param {string[]} args
   * @param {{ cwd?: string }} [opts]
   */
  function run(args, opts = {}) {
    const result = spawnSync(process.execPath, [ASSERT_SCRIPT, ...args], {
      encoding: 'utf8',
      cwd: opts.cwd ?? ROOT,
      env: { ...process.env },
    });
    return {
      status: result.status ?? 1,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
    };
  }

  it('refuses path-traversal plan slug (../evil)', () => {
    try {
      tmp = mkdtempSync(join(tmpdir(), 'assert-path-'));
      const stateRoot = join(tmp, '.atomic-skills');
      mkdirSync(join(stateRoot, 'status'), { recursive: true });
      const r = run(
        [
          '--plan',
          '../evil',
          '--gate',
          'spawn',
          '--skip-cursor',
          '--state-root',
          stateRoot,
          '--status-root',
          join(stateRoot, 'status'),
        ],
        { cwd: tmp },
      );
      assert.notEqual(r.status, 0);
      const out = `${r.stdout}\n${r.stderr}`;
      assert.match(out, /invalid|blocked/i);
      // Must exit 1 cleanly, not throw uncaught
      assert.equal(r.status, 1);
    } finally {
      cleanup();
    }
  });

  it('refuses plan slug with slash/backslash segments', () => {
    try {
      tmp = mkdtempSync(join(tmpdir(), 'assert-path-'));
      const stateRoot = join(tmp, '.atomic-skills');
      mkdirSync(join(stateRoot, 'status'), { recursive: true });
      for (const bad of ['a/b', 'a\\b']) {
        const r = run(
          [
            '--plan',
            bad,
            '--gate',
            'spawn',
            '--state-root',
            stateRoot,
            '--status-root',
            join(stateRoot, 'status'),
          ],
          { cwd: tmp },
        );
        assert.notEqual(r.status, 0, `expected refuse for ${bad}`);
        const out = `${r.stdout}\n${r.stderr}`;
        assert.match(out, /invalid|blocked|not found/i);
      }
    } finally {
      cleanup();
    }
  });

  it('flat plan fallback when projects/ missing (spawn ok with flat initiative)', () => {
    try {
      tmp = mkdtempSync(join(tmpdir(), 'assert-flat-'));
      const stateRoot = join(tmp, '.atomic-skills');
      mkdirSync(join(stateRoot, 'plans'), { recursive: true });
      mkdirSync(join(stateRoot, 'initiatives'), { recursive: true });
      mkdirSync(join(stateRoot, 'status'), { recursive: true });
      writeFileSync(
        join(stateRoot, 'plans', 'flat-plan.md'),
        [
          '---',
          'schemaVersion: "0.1"',
          'slug: flat-plan',
          'status: active',
          'currentPhase: F1',
          'executionMode: automate',
          'phases:',
          '  - id: F1',
          '    status: pending',
          '    slug: f1-work',
          '---',
          '',
          '# plan',
          '',
        ].join('\n'),
        'utf8',
      );
      writeFileSync(
        join(stateRoot, 'initiatives', 'f1-work.md'),
        [
          '---',
          'schemaVersion: "0.1"',
          'slug: f1-work',
          'phaseId: F1',
          'status: active',
          'parentPlan: flat-plan',
          ...INIT_BI_LINES,
          '---',
          '',
          '# initiative',
          '',
        ].join('\n'),
        'utf8',
      );
      const r = run(
        [
          '--plan',
          'flat-plan',
          '--gate',
          'spawn',
          '--skip-cursor',
          '--state-root',
          stateRoot,
          '--status-root',
          join(stateRoot, 'status'),
        ],
        { cwd: tmp },
      );
      assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
      assert.match(r.stdout, /^ok\b/m);
    } finally {
      cleanup();
    }
  });

  it('flat plan without initiative is descriptor-only blocked', () => {
    try {
      tmp = mkdtempSync(join(tmpdir(), 'assert-flat-miss-'));
      const stateRoot = join(tmp, '.atomic-skills');
      mkdirSync(join(stateRoot, 'plans'), { recursive: true });
      mkdirSync(join(stateRoot, 'status'), { recursive: true });
      writeFileSync(
        join(stateRoot, 'plans', 'flat-plan.md'),
        [
          '---',
          'schemaVersion: "0.1"',
          'slug: flat-plan',
          'status: active',
          'currentPhase: F1',
          'executionMode: automate',
          'phases:',
          '  - id: F1',
          '    status: pending',
          '    slug: f1-work',
          '---',
          '',
          '# plan',
          '',
        ].join('\n'),
        'utf8',
      );
      const r = run(
        [
          '--plan',
          'flat-plan',
          '--gate',
          'spawn',
          '--skip-cursor',
          '--state-root',
          stateRoot,
          '--status-root',
          join(stateRoot, 'status'),
        ],
        { cwd: tmp },
      );
      assert.notEqual(r.status, 0);
      const out = `${r.stdout}\n${r.stderr}`;
      assert.match(out, /descriptor-only|initiative|materialize/i);
    } finally {
      cleanup();
    }
  });

  it('jails claim-report path traversal outside cwd/stateRoot', () => {
    try {
      tmp = mkdtempSync(join(tmpdir(), 'assert-jail-'));
      const stateRoot = join(tmp, '.atomic-skills');
      const planDir = join(stateRoot, 'projects', 'demo', 'demo-plan');
      mkdirSync(planDir, { recursive: true });
      mkdirSync(join(stateRoot, 'status'), { recursive: true });
      writeFileSync(
        join(planDir, 'plan.md'),
        [
          '---',
          'schemaVersion: "0.1"',
          'slug: demo-plan',
          'status: active',
          'currentPhase: F1',
          'executionMode: automate',
          'phases:',
          '  - id: F1',
          '    status: pending',
          '---',
          '',
          '# plan',
          '',
        ].join('\n'),
        'utf8',
      );
      // Point claim-report outside the tmp cwd jail
      const outside = join(tmpdir(), `outside-claim-${Date.now()}.json`);
      writeFileSync(
        outside,
        JSON.stringify({
          tasks: [
            {
              taskId: 'T-001',
              status: 'claimed-pass',
              commitShas: ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
              paths: ['src/a.js'],
              verifierCommand: 'true',
              exitCode: 0,
              transcript: '',
            },
          ],
        }),
        'utf8',
      );
      try {
        const r = run(
          [
            '--plan',
            'demo-plan',
            '--project',
            'demo',
            '--gate',
            'claims',
            '--claim-report',
            outside,
            '--state-root',
            stateRoot,
            '--status-root',
            join(stateRoot, 'status'),
          ],
          { cwd: tmp },
        );
        assert.notEqual(r.status, 0);
        const out = `${r.stdout}\n${r.stderr}`;
        assert.match(out, /jail|escapes|blocked/i);
      } finally {
        try {
          rmSync(outside, { force: true });
        } catch {
          /* ignore */
        }
      }
    } finally {
      cleanup();
    }
  });

  it('accepts claim-report under stateRoot when valid', () => {
    try {
      tmp = mkdtempSync(join(tmpdir(), 'assert-claim-ok-'));
      const stateRoot = join(tmp, '.atomic-skills');
      const planDir = join(stateRoot, 'projects', 'demo', 'demo-plan');
      mkdirSync(planDir, { recursive: true });
      mkdirSync(join(stateRoot, 'status'), { recursive: true });
      writeFileSync(
        join(planDir, 'plan.md'),
        [
          '---',
          'schemaVersion: "0.1"',
          'slug: demo-plan',
          'status: active',
          'currentPhase: F1',
          'executionMode: automate',
          'phases:',
          '  - id: F1',
          '    status: pending',
          '---',
          '',
          '# plan',
          '',
        ].join('\n'),
        'utf8',
      );
      const claimPath = join(stateRoot, 'claim.json');
      writeFileSync(
        claimPath,
        JSON.stringify({
          tasks: [
            {
              taskId: 'T-001',
              status: 'claimed-pass',
              commitShas: ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
              paths: ['src/a.js'],
              verifierCommand: 'true',
              exitCode: 0,
              transcript: '',
            },
          ],
        }),
        'utf8',
      );
      const r = run(
        [
          '--plan',
          'demo-plan',
          '--project',
          'demo',
          '--gate',
          'claims',
          '--skip-cursor',
          '--claim-report',
          claimPath,
          '--state-root',
          stateRoot,
          '--status-root',
          join(stateRoot, 'status'),
        ],
        { cwd: tmp },
      );
      assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
      assert.match(r.stdout, /^ok\b/m);
    } finally {
      cleanup();
    }
  });

  it('prefers frontmatter phaseId match over filename hint for initiative', () => {
    try {
      tmp = mkdtempSync(join(tmpdir(), 'assert-fm-pref-'));
      const stateRoot = join(tmp, '.atomic-skills');
      const planDir = join(stateRoot, 'projects', 'demo', 'demo-plan');
      const phasesDir = join(planDir, 'phases');
      mkdirSync(phasesDir, { recursive: true });
      mkdirSync(join(stateRoot, 'status'), { recursive: true });
      writeFileSync(
        join(planDir, 'plan.md'),
        [
          '---',
          'schemaVersion: "0.1"',
          'slug: demo-plan',
          'status: active',
          'currentPhase: F1',
          'executionMode: automate',
          'phases:',
          '  - id: F1',
          '    status: pending',
          '    slug: wrong-name',
          '---',
          '',
          '# plan',
          '',
        ].join('\n'),
        'utf8',
      );
      // Filename does not match slug, but frontmatter phaseId does
      writeFileSync(
        join(phasesDir, 'actual-init.md'),
        [
          '---',
          'schemaVersion: "0.1"',
          'slug: actual-init',
          'phaseId: F1',
          'status: active',
          'parentPlan: demo-plan',
          ...INIT_BI_LINES,
          '---',
          '',
          '# initiative',
          '',
        ].join('\n'),
        'utf8',
      );
      const r = run(
        [
          '--plan',
          'demo-plan',
          '--project',
          'demo',
          '--gate',
          'spawn',
          '--skip-cursor',
          '--state-root',
          stateRoot,
          '--status-root',
          join(stateRoot, 'status'),
        ],
        { cwd: tmp },
      );
      assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
      assert.match(r.stdout, /^ok\b/m);
    } finally {
      cleanup();
    }
  });

  it('host-thin spawn still passes when lease clean + initiative present', () => {
    try {
      tmp = mkdtempSync(join(tmpdir(), 'assert-host-thin-'));
      const stateRoot = join(tmp, '.atomic-skills');
      const planDir = join(stateRoot, 'projects', 'demo', 'demo-plan');
      const phasesDir = join(planDir, 'phases');
      mkdirSync(phasesDir, { recursive: true });
      mkdirSync(join(stateRoot, 'status'), { recursive: true });
      writeFileSync(
        join(planDir, 'plan.md'),
        [
          '---',
          'schemaVersion: "0.1"',
          'slug: demo-plan',
          'status: active',
          'currentPhase: F1',
          'executionMode: automate',
          'phases:',
          '  - id: F1',
          '    status: pending',
          '    slug: f1-next',
          '---',
          '',
          '# plan',
          '',
        ].join('\n'),
        'utf8',
      );
      writeFileSync(
        join(phasesDir, 'f1-next.md'),
        [
          '---',
          'schemaVersion: "0.1"',
          'slug: f1-next',
          'phaseId: F1',
          'status: active',
          'parentPlan: demo-plan',
          ...INIT_BI_LINES,
          '---',
          '',
          '# initiative',
          '',
        ].join('\n'),
        'utf8',
      );
      const r = run(
        [
          '--plan',
          'demo-plan',
          '--project',
          'demo',
          '--gate',
          'spawn',
          '--skip-cursor',
          '--state-root',
          stateRoot,
          '--status-root',
          join(stateRoot, 'status'),
        ],
        { cwd: tmp },
      );
      assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
      assert.match(r.stdout, /^ok\b/m);
    } finally {
      cleanup();
    }
  });

  it('spawn blocks when initiative exists but businessIntent spine is missing', () => {
    try {
      tmp = mkdtempSync(join(tmpdir(), 'assert-spawn-no-bi-'));
      const stateRoot = join(tmp, '.atomic-skills');
      const planDir = join(stateRoot, 'projects', 'demo', 'demo-plan');
      const phasesDir = join(planDir, 'phases');
      mkdirSync(phasesDir, { recursive: true });
      mkdirSync(join(stateRoot, 'status'), { recursive: true });
      writeFileSync(
        join(planDir, 'plan.md'),
        [
          '---',
          'schemaVersion: "0.1"',
          'slug: demo-plan',
          'status: active',
          'currentPhase: F1',
          'executionMode: automate',
          'phases:',
          '  - id: F1',
          '    status: pending',
          '    slug: f1-next',
          '---',
          '',
          '# plan',
          '',
        ].join('\n'),
        'utf8',
      );
      writeFileSync(
        join(phasesDir, 'f1-next.md'),
        [
          '---',
          'schemaVersion: "0.1"',
          'slug: f1-next',
          'phaseId: F1',
          'status: active',
          'parentPlan: demo-plan',
          '---',
          '',
          '# initiative without BI',
          '',
        ].join('\n'),
        'utf8',
      );
      const r = run(
        [
          '--plan',
          'demo-plan',
          '--project',
          'demo',
          '--gate',
          'spawn',
          '--skip-cursor',
          '--state-root',
          stateRoot,
          '--status-root',
          join(stateRoot, 'status'),
        ],
        { cwd: tmp },
      );
      assert.notEqual(r.status, 0);
      assert.match(`${r.stdout}\n${r.stderr}`, /businessIntent/i);
    } finally {
      cleanup();
    }
  });
});
