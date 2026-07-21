/**
 * assert-automate-gate CLI — pure-gate matrix (no network).
 *
 * Covers spawn / claims|done / phase-done / finalize via Layer-1 helpers.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
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
const SCRIPT = join(ROOT, 'scripts', 'assert-automate-gate.js');

const GOOD_SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function tmpRoot() {
  return mkdtempSync(join(tmpdir(), 'assert-gate-'));
}

/**
 * @param {string} root
 * @param {{
 *   projectId?: string,
 *   slug?: string,
 *   executionMode?: string | null,
 *   currentPhase?: string,
 *   evaluationGate?: object | null,
 *   planEndReview?: object | null,
 *   userValidatedAt?: string | null,
 * }} [opts]
 */
function writePlan(root, opts = {}) {
  const projectId = opts.projectId ?? 'atomic-skills';
  const slug = opts.slug ?? 'demo-plan';
  const planDir = join(root, '.atomic-skills', 'projects', projectId, slug);
  mkdirSync(planDir, { recursive: true });

  const phases = [
    {
      id: opts.currentPhase ?? 'F0',
      status: 'active',
      ...(opts.evaluationGate !== undefined
        ? { evaluationGate: opts.evaluationGate }
        : {}),
    },
  ];

  const fm = {
    schemaVersion: '0.1',
    slug,
    status: 'active',
    currentPhase: opts.currentPhase ?? 'F0',
    phases,
  };
  if (opts.executionMode != null) fm.executionMode = opts.executionMode;
  if (opts.planEndReview !== undefined) fm.planEndReview = opts.planEndReview;
  if (opts.userValidatedAt !== undefined) fm.userValidatedAt = opts.userValidatedAt;

  // Minimal YAML (no external dump) — values we use are simple scalars/objects.
  const lines = ['---'];
  lines.push(`schemaVersion: "${fm.schemaVersion}"`);
  lines.push(`slug: ${fm.slug}`);
  lines.push(`status: ${fm.status}`);
  lines.push(`currentPhase: ${fm.currentPhase}`);
  if (fm.executionMode != null) lines.push(`executionMode: ${fm.executionMode}`);
  if (fm.userValidatedAt != null) {
    lines.push(`userValidatedAt: "${fm.userValidatedAt}"`);
  }
  if (fm.planEndReview != null) {
    lines.push('planEndReview:');
    const r = fm.planEndReview;
    if (r.mode != null) lines.push(`  mode: ${r.mode}`);
    if (r.reviewFile != null) lines.push(`  reviewFile: "${r.reviewFile}"`);
    if (r.verifiedAt != null) lines.push(`  verifiedAt: "${r.verifiedAt}"`);
    if (r.skipPlanEndReview === true) {
      lines.push('  skipPlanEndReview: true');
      if (r.skipReason != null) lines.push(`  skipReason: "${r.skipReason}"`);
    }
    if (Array.isArray(r.legs)) {
      lines.push('  legs:');
      for (const leg of r.legs) {
        lines.push(
          `    - { provider: ${leg.provider}, status: ${leg.status}, familyDifferent: ${leg.familyDifferent === true} }`,
        );
      }
    }
  }
  lines.push('phases:');
  for (const p of phases) {
    lines.push(`  - id: ${p.id}`);
    lines.push(`    status: ${p.status}`);
    if (p.evaluationGate != null) {
      const g = p.evaluationGate;
      lines.push('    evaluationGate:');
      if (g.status != null) lines.push(`      status: ${g.status}`);
      if (g.verdict != null) lines.push(`      verdict: ${g.verdict}`);
      if (g.reason != null) lines.push(`      reason: "${g.reason}"`);
      if (g.disposition != null) lines.push(`      disposition: ${g.disposition}`);
    }
  }
  lines.push('---');
  lines.push('');
  lines.push('# plan');
  writeFileSync(join(planDir, 'plan.md'), lines.join('\n') + '\n', 'utf8');
  return { projectId, slug, planDir, stateRoot: join(root, '.atomic-skills') };
}

/**
 * @param {string[]} args
 * @param {{ cwd?: string }} [opts]
 */
function run(args, opts = {}) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    cwd: opts.cwd ?? ROOT,
    env: { ...process.env },
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    signal: result.signal,
  };
}

function combined(r) {
  return `${r.stdout}\n${r.stderr}`;
}

function goodClaimReport(overrides = {}) {
  return {
    planSlug: 'demo-plan',
    phaseId: 'F0',
    tasks: [
      {
        taskId: 'T-001',
        status: 'claimed-pass',
        commitShas: [GOOD_SHA],
        paths: ['src/a.js'],
        verifierCommand: 'node -e "process.exit(0)"',
        exitCode: 0,
        transcript: 'ok',
        ...overrides.task,
      },
    ],
    ...overrides.envelope,
  };
}

describe('assert-automate-gate CLI', () => {
  it('--help exits 0 and documents gates', () => {
    const r = run(['--help']);
    assert.equal(r.status, 0, combined(r));
    assert.match(combined(r), /assert-automate-gate/);
    assert.match(combined(r), /spawn/);
    assert.match(combined(r), /phase-done/);
    assert.match(combined(r), /finalize/);
  });

  it('missing --plan or --gate exits non-zero', () => {
    const r1 = run([]);
    assert.notEqual(r1.status, 0);
    const r2 = run(['--plan', 'x']);
    assert.notEqual(r2.status, 0);
    const r3 = run(['--gate', 'spawn']);
    assert.notEqual(r3.status, 0);
  });

  it('rejects unknown gate', () => {
    const root = tmpRoot();
    try {
      writePlan(root);
      const r = run(
        [
          '--plan',
          'demo-plan',
          '--gate',
          'nope',
          '--state-root',
          join(root, '.atomic-skills'),
        ],
        { cwd: root },
      );
      assert.notEqual(r.status, 0);
      assert.match(combined(r), /unknown gate|invalid gate|gate/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  describe('spawn', () => {
    it('ok when lease missing', () => {
      const root = tmpRoot();
      try {
        writePlan(root, { executionMode: 'automate' });
        const stateRoot = join(root, '.atomic-skills');
        const r = run(
          [
            '--plan',
            'demo-plan',
            '--gate',
            'spawn',
            '--state-root',
            stateRoot,
            '--status-root',
            join(stateRoot, 'status'),
          ],
          { cwd: root },
        );
        assert.equal(r.status, 0, combined(r));
        assert.match(r.stdout, /^ok\b/m);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it('exit 1 when lease blocking (active)', () => {
      const root = tmpRoot();
      try {
        writePlan(root, { executionMode: 'automate' });
        const stateRoot = join(root, '.atomic-skills');
        const statusRoot = join(stateRoot, 'status');
        const leaseDir = join(statusRoot, 'writer-leases');
        mkdirSync(leaseDir, { recursive: true });
        writeFileSync(
          join(leaseDir, 'demo-plan.json'),
          JSON.stringify({
            planSlug: 'demo-plan',
            phaseId: 'F0',
            startedAt: new Date().toISOString(),
            hostId: 'test-host',
            worktreePath: '/tmp/wt',
            status: 'active',
            tokenHash: 'a'.repeat(64),
          }),
          'utf8',
        );
        const r = run(
          [
            '--plan',
            'demo-plan',
            '--gate',
            'spawn',
            '--state-root',
            stateRoot,
            '--status-root',
            statusRoot,
          ],
          { cwd: root },
        );
        assert.equal(r.status, 1, combined(r));
        assert.match(combined(r), /blocked/i);
        assert.match(combined(r), /lease/i);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  describe('claims / done', () => {
    it('exit 1 when claim report missing under automate stamp', () => {
      const root = tmpRoot();
      try {
        writePlan(root, { executionMode: 'automate' });
        const stateRoot = join(root, '.atomic-skills');
        for (const gate of ['claims', 'done']) {
          const r = run(
            ['--plan', 'demo-plan', '--gate', gate, '--state-root', stateRoot],
            { cwd: root },
          );
          assert.equal(r.status, 1, `${gate}: ${combined(r)}`);
          assert.match(combined(r), /claim/i);
        }
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it('exit 1 when claim report invalid', () => {
      const root = tmpRoot();
      try {
        writePlan(root, { executionMode: 'automate' });
        const stateRoot = join(root, '.atomic-skills');
        const claimPath = join(root, 'bad-claim.json');
        writeFileSync(
          claimPath,
          JSON.stringify({ tasks: [{ taskId: 'T-001', status: 'claimed-pass' }] }),
          'utf8',
        );
        const r = run(
          [
            '--plan',
            'demo-plan',
            '--gate',
            'done',
            '--state-root',
            stateRoot,
            '--claim-report',
            claimPath,
          ],
          { cwd: root },
        );
        assert.equal(r.status, 1, combined(r));
        assert.match(combined(r), /blocked/i);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it('exit 0 when claim report validates', () => {
      const root = tmpRoot();
      try {
        writePlan(root, { executionMode: 'automate' });
        const stateRoot = join(root, '.atomic-skills');
        const claimPath = join(root, 'good-claim.json');
        writeFileSync(claimPath, JSON.stringify(goodClaimReport()), 'utf8');
        const r = run(
          [
            '--plan',
            'demo-plan',
            '--gate',
            'claims',
            '--state-root',
            stateRoot,
            '--claim-report',
            claimPath,
          ],
          { cwd: root },
        );
        assert.equal(r.status, 0, combined(r));
        assert.match(r.stdout, /^ok\b/m);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it('exit 1 when check-reachability fails', () => {
      const root = tmpRoot();
      try {
        writePlan(root, { executionMode: 'automate' });
        const stateRoot = join(root, '.atomic-skills');
        const claimPath = join(root, 'good-claim.json');
        writeFileSync(claimPath, JSON.stringify(goodClaimReport()), 'utf8');
        const emptyReachable = join(root, 'empty-reachable.txt');
        writeFileSync(emptyReachable, '', 'utf8');
        const rMissing = run(
          [
            '--plan',
            'demo-plan',
            '--gate',
            'done',
            '--state-root',
            stateRoot,
            '--claim-report',
            claimPath,
            '--check-reachability',
          ],
          { cwd: root },
        );
        assert.notEqual(rMissing.status, 0, combined(rMissing));
        const rEmpty = run(
          [
            '--plan',
            'demo-plan',
            '--gate',
            'done',
            '--state-root',
            stateRoot,
            '--claim-report',
            claimPath,
            '--check-reachability',
            '--reachable-file',
            emptyReachable,
          ],
          { cwd: root },
        );
        assert.equal(rEmpty.status, 1, combined(rEmpty));
        assert.match(combined(rEmpty), /blocked|reachability/i);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  describe('phase-done', () => {
    it('exit 1 under durable automate without evaluationGate', () => {
      const root = tmpRoot();
      try {
        writePlan(root, { executionMode: 'automate' });
        const stateRoot = join(root, '.atomic-skills');
        const r = run(
          ['--plan', 'demo-plan', '--gate', 'phase-done', '--state-root', stateRoot],
          { cwd: root },
        );
        assert.equal(r.status, 1, combined(r));
        assert.match(combined(r), /blocked/i);
        assert.match(combined(r), /evaluationGate/i);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it('exit 0 when evaluationGate allows close', () => {
      const root = tmpRoot();
      try {
        writePlan(root, {
          executionMode: 'automate',
          evaluationGate: { status: 'passed', verdict: 'pass' },
        });
        const stateRoot = join(root, '.atomic-skills');
        const r = run(
          ['--plan', 'demo-plan', '--gate', 'phase-done', '--state-root', stateRoot],
          { cwd: root },
        );
        assert.equal(r.status, 0, combined(r));
        assert.match(r.stdout, /^ok\b/m);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it('exit 0 when non-automate (gate inactive)', () => {
      const root = tmpRoot();
      try {
        writePlan(root); // no executionMode
        const stateRoot = join(root, '.atomic-skills');
        const r = run(
          ['--plan', 'demo-plan', '--gate', 'phase-done', '--state-root', stateRoot],
          { cwd: root },
        );
        assert.equal(r.status, 0, combined(r));
        assert.match(r.stdout, /^ok\b/m);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  describe('finalize', () => {
    it('exit 1 when automatePlanEndGatesOk is false', () => {
      const root = tmpRoot();
      try {
        writePlan(root, { executionMode: 'automate' });
        const stateRoot = join(root, '.atomic-skills');
        const r = run(
          ['--plan', 'demo-plan', '--gate', 'finalize', '--state-root', stateRoot],
          { cwd: root },
        );
        assert.equal(r.status, 1, combined(r));
        assert.match(combined(r), /blocked/i);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it('exit 0 when plan-end receipt + userValidatedAt ok', () => {
      const root = tmpRoot();
      try {
        writePlan(root, {
          executionMode: 'automate',
          planEndReview: {
            mode: 'external-both',
            reviewFile: '.atomic-skills/reviews/x-plan-end.md',
            verifiedAt: '2026-07-21T00:00:00.000Z',
            legs: [
              { provider: 'codex', status: 'succeeded', familyDifferent: true },
            ],
          },
          userValidatedAt: '2026-07-21T12:00:00.000Z',
        });
        const stateRoot = join(root, '.atomic-skills');
        const r = run(
          ['--plan', 'demo-plan', '--gate', 'finalize', '--state-root', stateRoot],
          { cwd: root },
        );
        assert.equal(r.status, 0, combined(r));
        assert.match(r.stdout, /^ok\b/m);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it('exit 0 when non-automate', () => {
      const root = tmpRoot();
      try {
        writePlan(root);
        const stateRoot = join(root, '.atomic-skills');
        const r = run(
          ['--plan', 'demo-plan', '--gate', 'finalize', '--state-root', stateRoot],
          { cwd: root },
        );
        assert.equal(r.status, 0, combined(r));
        assert.match(r.stdout, /^ok\b/m);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  it('resolves nested project/slug and --project filter', () => {
    const root = tmpRoot();
    try {
      writePlan(root, {
        projectId: 'atomic-skills',
        slug: 'demo-plan',
        executionMode: 'automate',
        evaluationGate: { status: 'passed', verdict: 'pass' },
      });
      writePlan(root, {
        projectId: 'other',
        slug: 'demo-plan',
        executionMode: 'automate',
        // no evaluationGate → would block if selected
      });
      const stateRoot = join(root, '.atomic-skills');
      const r = run(
        [
          '--plan',
          'demo-plan',
          '--gate',
          'phase-done',
          '--state-root',
          stateRoot,
          '--project',
          'atomic-skills',
        ],
        { cwd: root },
      );
      assert.equal(r.status, 0, combined(r));

      const rNested = run(
        [
          '--plan',
          'atomic-skills/demo-plan',
          '--gate',
          'phase-done',
          '--state-root',
          stateRoot,
        ],
        { cwd: root },
      );
      assert.equal(rNested.status, 0, combined(rNested));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
