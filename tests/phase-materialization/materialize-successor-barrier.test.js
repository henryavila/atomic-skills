/**
 * F4/T-006 — successor barrier: materializing F3 (or any F4 successor) re-reads
 * the F0 history receipt and refuses when F4-G3 is pending/failed or receipt stale.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import {
  assertSuccessorBarrier,
  materializePair,
  phaseDependsOn,
  writeHistoryReceipt,
} from '../../scripts/materialize-state.js';

const CLOSE = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function renderMd(frontmatter, body = '\n# body\n') {
  const renderedBody = body.startsWith('\n') ? body : `\n${body}`;
  return `---\n${stringifyYaml(frontmatter)}---${renderedBody}`;
}

function planFm({ f4Status = 'done', g3Status = 'met' } = {}) {
  return {
    schemaVersion: '0.1',
    slug: 'integrity-remediation',
    title: 'Integrity',
    status: 'active',
    currentPhase: f4Status === 'done' ? 'F3' : 'F4',
    phases: [
      {
        id: 'F0',
        slug: 'f0-runtime',
        title: 'F0',
        status: 'done',
        dependsOn: [],
        subPhaseCount: 2,
        exitGate: {
          summary: '2',
          criteria: [
            { id: 'F0-G1', status: 'met' },
            { id: 'F0-G2', status: 'met' },
          ],
        },
        businessIntent: {
          value: 'v', workflow: 'w', rules: 'r', outOfScope: 'o', doneWhen: 'd',
        },
      },
      {
        id: 'F4',
        slug: 'f4',
        title: 'F4',
        status: f4Status,
        dependsOn: ['F0'],
        subPhaseCount: 1,
        exitGate: {
          summary: '3',
          criteria: [
            { id: 'F4-G1', status: 'met' },
            { id: 'F4-G2', status: 'met' },
            { id: 'F4-G3', status: g3Status },
          ],
        },
      },
      {
        id: 'F3',
        slug: 'f3-next',
        title: 'F3',
        status: 'pending',
        dependsOn: ['F4'],
        subPhaseCount: 0,
      },
      {
        id: 'F1',
        slug: 'f1-next',
        title: 'F1',
        status: 'pending',
        dependsOn: ['F3'],
        subPhaseCount: 0,
      },
    ],
  };
}

function f0Initiative() {
  return {
    schemaVersion: '0.1',
    slug: 'f0-runtime',
    title: 'F0',
    status: 'done',
    phaseId: 'F0',
    parentPlan: 'integrity-remediation',
    tasks: [
      { id: 'T-001', status: 'done' },
      { id: 'T-002', status: 'done' },
    ],
    exitGates: [
      {
        id: 'F0-G1',
        status: 'met',
        evidence: { passed: true, verifiedAt: '2026-07-16T00:00:00.000Z' },
      },
      {
        id: 'F0-G2',
        status: 'met',
        evidence: { passed: true, verifiedAt: '2026-07-16T00:00:00.000Z' },
      },
    ],
    businessIntent: {
      value: 'v', workflow: 'w', rules: 'r', outOfScope: 'o', doneWhen: 'd',
    },
  };
}

function seed({ f4Status = 'done', g3Status = 'met', writeReceipt = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'as-barrier-'));
  const planSlug = 'integrity-remediation';
  const projectId = 'atomic-skills';
  const planDir = join(root, '.atomic-skills', 'projects', projectId, planSlug);
  const phasesDir = join(planDir, 'phases');
  mkdirSync(phasesDir, { recursive: true });
  mkdirSync(join(root, '.atomic-skills', 'status', 'creation-gates'), { recursive: true });
  mkdirSync(join(root, '.atomic-skills', 'analytics'), { recursive: true });
  mkdirSync(join(root, 'docs', 'audits'), { recursive: true });

  const planPath = join(planDir, 'plan.md');
  const fm = planFm({ f4Status, g3Status });
  writeFileSync(planPath, renderMd(fm));
  writeFileSync(join(phasesDir, 'f0-runtime.md'), renderMd(f0Initiative()));
  writeFileSync(
    join(phasesDir, 'f1-next.source.json'),
    `${JSON.stringify({ captureVersion: '0.1', phaseId: 'F1' }, null, 2)}\n`,
  );
  writeFileSync(
    join(root, '.atomic-skills', 'status', 'creation-gates', `${projectId}-${planSlug}.json`),
    `${JSON.stringify({
      schemaVersion: '0.1',
      kind: 'new-plan',
      slug: planSlug,
      projectId,
      stage: 'ready',
      status: 'ready',
      filesWritten: [
        `.atomic-skills/projects/${projectId}/${planSlug}/plan.md`,
        `.atomic-skills/projects/${projectId}/${planSlug}/phases/f0-runtime.md`,
        `.atomic-skills/projects/${projectId}/${planSlug}/phases/f1-next.source.json`,
      ],
    }, null, 2)}\n`,
  );
  writeFileSync(
    join(root, '.atomic-skills', 'analytics', 'completions.jsonl'),
    [
      {
        ts: '2026-07-16T10:00:00.000Z',
        event: 'task-done',
        projectId,
        planSlug,
        phaseId: 'F0',
        taskId: 'T-001',
        weight: 1,
        weightBasis: 'count',
      },
      {
        ts: '2026-07-16T10:01:00.000Z',
        event: 'task-done',
        projectId,
        planSlug,
        phaseId: 'F0',
        taskId: 'T-002',
        weight: 1,
        weightBasis: 'count',
      },
      {
        ts: '2026-07-16T10:02:00.000Z',
        event: 'phase-done',
        projectId,
        planSlug,
        phaseId: 'F0',
        taskId: null,
        weight: 1,
        weightBasis: 'count',
      },
    ].map((e) => JSON.stringify(e)).join('\n') + '\n',
  );

  const receiptPath = join(root, 'docs', 'audits', 'integrity-remediation-f0-reconciliation.json');
  if (writeReceipt) {
    writeHistoryReceipt(receiptPath, { rootDir: root, closeSha: CLOSE });
  }

  return {
    root,
    planPath,
    receiptPath,
    fm,
    cleanup() { rmSync(root, { recursive: true, force: true }); },
  };
}

describe('F4/T-006 successor barrier', () => {
  it('phaseDependsOn walks transitive dependsOn (F1 ← F3 ← F4)', () => {
    const fm = planFm();
    assert.equal(phaseDependsOn(fm, 'F3', 'F4'), true);
    assert.equal(phaseDependsOn(fm, 'F1', 'F4'), true);
    assert.equal(phaseDependsOn(fm, 'F0', 'F4'), false);
    assert.equal(phaseDependsOn(fm, 'F4', 'F4'), false);
  });

  it('skips barrier when target does not depend on F4', () => {
    const fx = seed();
    try {
      const res = assertSuccessorBarrier({
        plan: fx.fm,
        targetPhaseId: 'F0',
        f4ReceiptPath: fx.receiptPath,
        rootDir: fx.root,
      });
      assert.equal(res.ok, true);
      assert.equal(res.skipped, true);
    } finally {
      fx.cleanup();
    }
  });

  it('refuses F3 when F4-G3 is pending', () => {
    const fx = seed({ f4Status: 'active', g3Status: 'pending' });
    try {
      assert.throws(
        () => assertSuccessorBarrier({
          planPath: fx.planPath,
          targetPhaseId: 'F3',
          f4ReceiptPath: fx.receiptPath,
          rootDir: fx.root,
        }),
        /F4-G3|refuse|pending|non-deferrable|status/i,
      );
    } finally {
      fx.cleanup();
    }
  });

  it('refuses F3 when F4-G3 is deferred (not a close path)', () => {
    // F4 may already be marked done illicitly; deferred G3 still blocks successors.
    const fx = seed({ f4Status: 'done', g3Status: 'deferred' });
    try {
      assert.throws(
        () => assertSuccessorBarrier({
          plan: readFileSync(fx.planPath, 'utf8'),
          targetPhaseId: 'F3',
          f4ReceiptPath: fx.receiptPath,
          rootDir: fx.root,
        }),
        /F4-G3|refuse|deferred/i,
      );
    } finally {
      fx.cleanup();
    }
  });

  it('refuses F3 when F4 is not terminal even if G3 met', () => {
    const fx = seed({ f4Status: 'active', g3Status: 'met' });
    try {
      assert.throws(
        () => assertSuccessorBarrier({
          planPath: fx.planPath,
          targetPhaseId: 'F3',
          f4ReceiptPath: fx.receiptPath,
          rootDir: fx.root,
        }),
        /status is active|must be done|refuse/i,
      );
    } finally {
      fx.cleanup();
    }
  });

  it('refuses F3 when history receipt is missing', () => {
    const fx = seed({ writeReceipt: false });
    try {
      assert.throws(
        () => assertSuccessorBarrier({
          planPath: fx.planPath,
          targetPhaseId: 'F3',
          f4ReceiptPath: fx.receiptPath,
          rootDir: fx.root,
        }),
        /receipt missing|refuse/i,
      );
    } finally {
      fx.cleanup();
    }
  });

  it('refuses F3 when receipt is stale after artifact mutation', () => {
    const fx = seed();
    try {
      // Mutate F0 initiative so receipt digests diverge.
      writeFileSync(
        join(fx.root, '.atomic-skills', 'projects', 'atomic-skills', 'integrity-remediation', 'phases', 'f0-runtime.md'),
        renderMd({ ...f0Initiative(), title: 'STALE' }),
      );
      assert.throws(
        () => assertSuccessorBarrier({
          planPath: fx.planPath,
          targetPhaseId: 'F3',
          f4ReceiptPath: fx.receiptPath,
          rootDir: fx.root,
        }),
        /stale|ambiguous|invalid|refuse/i,
      );
    } finally {
      fx.cleanup();
    }
  });

  it('allows F3 when F4 done, G3 met, and receipt consistent', () => {
    const fx = seed({ f4Status: 'done', g3Status: 'met' });
    try {
      const res = assertSuccessorBarrier({
        planPath: fx.planPath,
        targetPhaseId: 'F3',
        f4ReceiptPath: fx.receiptPath,
        rootDir: fx.root,
      });
      assert.equal(res.ok, true);
      assert.equal(res.skipped, false);
      assert.equal(res.check.ok, true);

      // Transitive successor F1 also passes the same barrier.
      const resF1 = assertSuccessorBarrier({
        planPath: fx.planPath,
        targetPhaseId: 'F1',
        f4ReceiptPath: fx.receiptPath,
        rootDir: fx.root,
      });
      assert.equal(resF1.ok, true);
      assert.equal(resF1.skipped, false);
    } finally {
      fx.cleanup();
    }
  });

  it('materializePair with successorBarrier refuses before any write', () => {
    const fx = seed({ f4Status: 'active', g3Status: 'pending' });
    try {
      const initiativePath = join(
        fx.root,
        '.atomic-skills',
        'projects',
        'atomic-skills',
        'integrity-remediation',
        'phases',
        'f3-next.md',
      );
      const planBefore = readFileSync(fx.planPath, 'utf8');
      const planAfter = renderMd({
        ...fx.fm,
        currentPhase: 'F3',
        phases: fx.fm.phases.map((p) => (
          p.id === 'F3' ? { ...p, status: 'active', subPhaseCount: 1 } : p
        )),
      });
      const initiativeAfter = renderMd({
        schemaVersion: '0.1',
        slug: 'f3-next',
        title: 'F3',
        status: 'active',
        phaseId: 'F3',
        parentPlan: 'integrity-remediation',
        tasks: [{ id: 'T-001', status: 'pending' }],
        exitGates: [],
        businessIntent: {
          value: 'v', workflow: 'w', rules: 'r', outOfScope: 'o', doneWhen: 'd',
        },
      });

      assert.throws(
        () => materializePair({
          planPath: fx.planPath,
          initiativePath,
          planContent: planAfter,
          initiativeContent: initiativeAfter,
          successorBarrier: {
            planPath: fx.planPath,
            targetPhaseId: 'F3',
            f4ReceiptPath: fx.receiptPath,
            rootDir: fx.root,
          },
        }),
        /successor barrier|F4-G3|refuse/i,
      );
      assert.equal(readFileSync(fx.planPath, 'utf8'), planBefore);
    } finally {
      fx.cleanup();
    }
  });
});
