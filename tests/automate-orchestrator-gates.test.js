import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  shouldRunPureMaestro,
  canSpawnPhaseWriter,
  canSpawnHostThinPhaseWriter,
  canCloseTasksFromClaims,
  canRunPhaseDone,
  canFinalizeOrArchive,
  automateModeSnapshot,
} from '../src/automate-orchestrator-gates.js';
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
