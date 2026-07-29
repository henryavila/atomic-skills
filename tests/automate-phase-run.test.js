import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  preparePhaseRun,
  validatePhaseClaims,
  isNestedUnderPlanWorktree,
  defaultSiblingWorktreePath,
  defaultWriterBranch,
} from '../src/automate-phase-run-lib.js';
import { isLeaseBlocking, acquireLeaseFile, buildActiveLease } from '../src/writer-lease.js';
import { runAutomatePhaseRun } from '../scripts/automate-phase-run.js';

const SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SHA2 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function goodInitiativeTasks() {
  return [
    {
      id: 'T-001',
      title: 'One',
      status: 'pending',
      outputs: [{ kind: 'file', path: 'src/a.js' }],
      scopeBoundary: ['no plan.md'],
      acceptance: ['exports a'],
      verifier: { kind: 'shell', command: 'node -e "process.exit(0)"', expectExitCode: 0 },
    },
  ];
}

describe('isNestedUnderPlanWorktree', () => {
  it('detects nesting under plan worktree', () => {
    assert.equal(
      isNestedUnderPlanWorktree('/repo/.worktrees/plan-x', '/repo/.worktrees/plan-x/nested'),
      true,
    );
    assert.equal(
      isNestedUnderPlanWorktree('/repo/.worktrees/plan-x', '/repo/.worktrees/plan-x-F0-writer'),
      false,
    );
  });
});

describe('defaultSiblingWorktreePath', () => {
  it('never nests under plan worktree', () => {
    const planWt = '/repo/.worktrees/my-plan';
    const p = defaultSiblingWorktreePath({
      planSlug: 'my-plan',
      phaseId: 'F0',
      planWorktreePath: planWt,
      repoRoot: '/repo',
    });
    assert.equal(isNestedUnderPlanWorktree(planWt, p), false);
    assert.match(p, /my-plan-F0-writer/);
  });
});

describe('defaultWriterBranch', () => {
  it('names impl/<slug>-<phase>-writer', () => {
    assert.equal(defaultWriterBranch('demo', 'F1'), 'impl/demo-F1-writer');
  });
});

describe('preparePhaseRun', () => {
  /** @type {string} */
  let tmp;
  before(() => {
    tmp = mkdtempSync(join(tmpdir(), 'apr-prepare-'));
  });
  after(() => {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('refuses prepare when lease is blocking', () => {
    const statusRoot = join(tmp, 'status-block');
    mkdirSync(statusRoot, { recursive: true });
    acquireLeaseFile(
      statusRoot,
      buildActiveLease({
        planSlug: 'demo',
        phaseId: 'F0',
        hostId: 'other',
        worktreePath: '/tmp/other',
      }),
    );
    assert.equal(isLeaseBlocking(statusRoot, 'demo'), true);

    const r = preparePhaseRun({
      statusRoot,
      planSlug: 'demo',
      phaseId: 'F0',
      planWorktreePath: join(tmp, 'plan-wt'),
      initiative: { tasks: goodInitiativeTasks(), parentPlan: 'demo', phaseId: 'F0' },
      skipWorktree: true,
      baseRef: SHA,
    });
    assert.equal(r.ok, false);
    assert.match(r.message, /lease blocking/i);
  });

  it('prepare exits 0 when lease acquired and brief path exists (no git)', () => {
    const statusRoot = join(tmp, 'status-ok');
    mkdirSync(statusRoot, { recursive: true });
    const planWt = join(tmp, 'plan-wt-ok');
    mkdirSync(planWt, { recursive: true });
    const sibling = join(tmp, 'sibling-wt-ok');

    const r = preparePhaseRun({
      statusRoot,
      planSlug: 'demo',
      phaseId: 'F0',
      planWorktreePath: planWt,
      worktreePath: sibling,
      initiative: {
        parentPlan: 'demo',
        phaseId: 'F0',
        tasks: goodInitiativeTasks(),
      },
      skipWorktree: true,
      baseRef: SHA,
      hostId: 'test-host',
    });
    assert.equal(r.ok, true, r.message);
    assert.equal(r.exitCode, 0);
    assert.ok(r.result?.sealedBriefPath);
    assert.ok(existsSync(r.result.sealedBriefPath));
    const brief = readFileSync(r.result.sealedBriefPath, 'utf8');
    assert.match(brief, /Code-only fence/i);
    assert.match(brief, /T-001/);
    assert.match(brief, /host-chat-history:\s*excluded/i);
    assert.ok(r.result.leaseSecret);
    assert.ok(r.result.leasePath);
    assert.equal(isLeaseBlocking(statusRoot, 'demo'), true);
    // secret not on disk in brief
    assert.doesNotMatch(brief, new RegExp(r.result.leaseSecret));
    assert.match(r.result.spawnInstructions, /general-purpose|Spawn/i);
  });

  it('refuses nested worktree path under plan worktree', () => {
    const statusRoot = join(tmp, 'status-nest');
    mkdirSync(statusRoot, { recursive: true });
    const planWt = join(tmp, 'plan-nested-root');
    mkdirSync(planWt, { recursive: true });
    const r = preparePhaseRun({
      statusRoot,
      planSlug: 'demo-nest',
      phaseId: 'F0',
      planWorktreePath: planWt,
      worktreePath: join(planWt, 'nested-writer'),
      initiative: {
        parentPlan: 'demo-nest',
        phaseId: 'F0',
        tasks: goodInitiativeTasks(),
      },
      skipWorktree: true,
      baseRef: SHA,
    });
    assert.equal(r.ok, false);
    assert.match(r.message, /nest/i);
  });

  it('fail closed on missing SPEC open tasks', () => {
    const statusRoot = join(tmp, 'status-spec');
    mkdirSync(statusRoot, { recursive: true });
    const r = preparePhaseRun({
      statusRoot,
      planSlug: 'demo-spec',
      phaseId: 'F0',
      planWorktreePath: join(tmp, 'pw'),
      initiative: {
        parentPlan: 'demo-spec',
        phaseId: 'F0',
        tasks: [{ id: 'T-001', status: 'pending', outputs: [] }],
      },
      skipWorktree: true,
      baseRef: SHA,
    });
    assert.equal(r.ok, false);
    assert.match(r.message, /SPEC|work-order/i);
  });
});

describe('validatePhaseClaims', () => {
  /** @type {string} */
  let tmp;
  before(() => {
    tmp = mkdtempSync(join(tmpdir(), 'apr-validate-'));
  });
  after(() => {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('validate ok on valid exclusive claims', () => {
    const report = {
      planSlug: 'demo',
      phaseId: 'F0',
      writerBranch: 'impl/demo-F0-writer',
      tasks: [
        {
          taskId: 'T-001',
          status: 'claimed-pass',
          commitShas: [SHA],
          paths: ['src/a.js'],
          verifierCommand: 'node -e "process.exit(0)"',
          exitCode: 0,
          transcript: 'ok',
        },
      ],
    };
    const r = validatePhaseClaims({
      claimReport: report,
      planBranch: 'plan/demo',
      writerBranch: 'impl/demo-F0-writer',
    });
    assert.equal(r.ok, true, r.message);
    assert.match(r.result.mergeCommands, /merge/i);
  });

  it('validate exits non-zero on invalid claim (shared SHAs without base/head)', () => {
    const report = {
      tasks: [
        {
          taskId: 'T-001',
          status: 'claimed-pass',
          commitShas: [SHA],
          paths: ['src/a.js'],
          verifierCommand: 'true',
          exitCode: 0,
          transcript: '',
        },
        {
          taskId: 'T-002',
          status: 'claimed-pass',
          commitShas: [SHA],
          paths: ['src/b.js'],
          verifierCommand: 'true',
          exitCode: 0,
          transcript: '',
        },
      ],
    };
    const r = validatePhaseClaims({ claimReport: report });
    assert.equal(r.ok, false);
    assert.match(r.message, /overlap|ambiguous|invalid/i);
  });

  it('validate from file path', () => {
    const path = join(tmp, 'claims.json');
    writeFileSync(
      path,
      JSON.stringify({
        tasks: [
          {
            taskId: 'T-001',
            status: 'claimed-pass',
            base: SHA,
            head: SHA2,
            paths: ['src/a.js'],
            verifierCommand: 'true',
            exitCode: 0,
            transcript: '',
          },
        ],
      }),
      'utf8',
    );
    const r = validatePhaseClaims({ claimReportPath: path });
    assert.equal(r.ok, true, r.message);
  });

  it('reachability check fails when SHA not in set', () => {
    const r = validatePhaseClaims({
      claimReport: {
        tasks: [
          {
            taskId: 'T-001',
            status: 'claimed-pass',
            commitShas: [SHA],
            paths: ['src/a.js'],
            verifierCommand: 'true',
            exitCode: 0,
            transcript: '',
          },
        ],
      },
      checkReachability: true,
      reachableSet: new Set([SHA2]),
    });
    assert.equal(r.ok, false);
    assert.match(r.message, /reachab/i);
  });
});

describe('runAutomatePhaseRun CLI (temp dirs, no network)', () => {
  /** @type {string} */
  let tmp;
  before(() => {
    tmp = mkdtempSync(join(tmpdir(), 'apr-cli-'));
  });
  after(() => {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('validate subcommand via runAutomatePhaseRun', () => {
    const claimPath = join(tmp, 'cli-claims.json');
    writeFileSync(
      claimPath,
      JSON.stringify({
        tasks: [
          {
            taskId: 'T-001',
            status: 'claimed-pass',
            commitShas: [SHA],
            paths: ['src/x.js'],
            verifierCommand: 'true',
            exitCode: 0,
            transcript: '',
          },
        ],
      }),
      'utf8',
    );
    const r = runAutomatePhaseRun(
      ['validate', '--claim-report', claimPath, '--plan-branch', 'plan/x', '--writer-branch', 'impl/x'],
      { cwd: tmp },
    );
    assert.equal(r.exitCode, 0, r.message);
    assert.match(r.message, /^ok/m);
  });

  it('prepare via CLI with fixture initiative and skip-worktree', () => {
    const stateRoot = join(tmp, '.atomic-skills');
    const planDir = join(stateRoot, 'projects', 'p', 'cli-demo');
    const phasesDir = join(planDir, 'phases');
    mkdirSync(phasesDir, { recursive: true });
    writeFileSync(
      join(planDir, 'plan.md'),
      `---
schemaVersion: "0.1"
slug: cli-demo
status: active
currentPhase: F0
phases:
  - id: F0
    title: Test
---
# plan
`,
      'utf8',
    );
    writeFileSync(
      join(phasesDir, 'f0-test.md'),
      `---
schemaVersion: "0.1"
slug: cli-demo-f0
parentPlan: cli-demo
phaseId: F0
status: active
tasks:
  - id: T-001
    title: One
    status: pending
    outputs:
      - kind: file
        path: src/a.js
    scopeBoundary:
      - no state
    acceptance:
      - works
    verifier:
      kind: shell
      command: "node -e \\"process.exit(0)\\""
      expectExitCode: 0
---
# initiative
`,
      'utf8',
    );
    const planWt = join(tmp, 'plan-home');
    mkdirSync(planWt, { recursive: true });
    const sibling = join(tmp, 'cli-sibling');

    const r = runAutomatePhaseRun(
      [
        'prepare',
        '--plan',
        'cli-demo',
        '--phase',
        'F0',
        '--project',
        'p',
        '--state-root',
        stateRoot,
        '--status-root',
        join(stateRoot, 'status'),
        '--plan-worktree',
        planWt,
        '--worktree-path',
        sibling,
        '--base-ref',
        SHA,
        '--skip-worktree',
        '--host-id',
        'cli-test',
      ],
      { cwd: tmp },
    );
    assert.equal(r.exitCode, 0, r.message);
    assert.match(r.message, /sealedBriefPath:/);
    assert.match(r.message, /leaseSecret:/);
  });
});
