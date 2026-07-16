/**
 * F4/T-006 — F0 history reconcile: classify consistent/repairable/ambiguous,
 * build + check receipt, fail closed on stale digests.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
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
  buildHistoryReceipt,
  checkHistoryReceipt,
  classifyHistoryReconcile,
  collectHistoryLive,
  hashPhaseDescriptor,
  sha256,
  stableStringify,
  writeHistoryReceipt,
} from '../../scripts/materialize-state.js';

const CLOSE = 'c44c405bf4051efbffbc6936b2526088a3e39303';

function renderMd(frontmatter, body = '\n# body\n') {
  const renderedBody = body.startsWith('\n') ? body : `\n${body}`;
  return `---\n${stringifyYaml(frontmatter)}---${renderedBody}`;
}

function f0Phase(overrides = {}) {
  return {
    id: 'F0',
    slug: 'f0-runtime',
    title: 'F0',
    status: 'done',
    subPhaseCount: 2,
    dependsOn: [],
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
    ...overrides,
  };
}

function f0Initiative(overrides = {}) {
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
    ...overrides,
  };
}

function seedTree({ withDupes = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'as-hist-rec-'));
  const planSlug = 'integrity-remediation';
  const projectId = 'atomic-skills';
  const planDir = join(root, '.atomic-skills', 'projects', projectId, planSlug);
  const phasesDir = join(planDir, 'phases');
  mkdirSync(phasesDir, { recursive: true });
  mkdirSync(join(root, '.atomic-skills', 'status', 'creation-gates'), { recursive: true });
  mkdirSync(join(root, '.atomic-skills', 'analytics'), { recursive: true });

  const planPath = join(planDir, 'plan.md');
  const initiativePath = join(phasesDir, 'f0-runtime.md');
  const sidecarPath = join(phasesDir, 'f1-next.source.json');
  const gatePath = join(
    root,
    '.atomic-skills',
    'status',
    'creation-gates',
    `${projectId}-${planSlug}.json`,
  );
  const completionsPath = join(root, '.atomic-skills', 'analytics', 'completions.jsonl');

  const planContent = renderMd({
    schemaVersion: '0.1',
    slug: planSlug,
    title: 'Integrity',
    status: 'active',
    currentPhase: 'F4',
    phases: [
      f0Phase(),
      {
        id: 'F4',
        slug: 'f4',
        title: 'F4',
        status: 'active',
        dependsOn: ['F0'],
        subPhaseCount: 1,
      },
      {
        id: 'F3',
        slug: 'f3',
        title: 'F3',
        status: 'pending',
        dependsOn: ['F4'],
        subPhaseCount: 0,
      },
    ],
  });
  writeFileSync(planPath, planContent);
  writeFileSync(initiativePath, renderMd(f0Initiative()));
  writeFileSync(sidecarPath, `${JSON.stringify({ captureVersion: '0.1', phaseId: 'F1' }, null, 2)}\n`);

  const gate = {
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
  };
  writeFileSync(gatePath, `${JSON.stringify(gate, null, 2)}\n`);

  const events = [
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
  ];
  if (withDupes) {
    events.push({ ...events[0], ts: '2026-07-16T11:00:00.000Z' });
  }
  writeFileSync(completionsPath, `${events.map((e) => JSON.stringify(e)).join('\n')}\n`);

  return {
    root,
    planPath,
    initiativePath,
    sidecarPath,
    gatePath,
    completionsPath,
    cleanup() { rmSync(root, { recursive: true, force: true }); },
  };
}

describe('F4/T-006 history reconcile', () => {
  it('stableStringify is order-independent for object keys', () => {
    assert.equal(
      stableStringify({ b: 1, a: 2 }),
      stableStringify({ a: 2, b: 1 }),
    );
    assert.equal(sha256(stableStringify({ a: 1 })), sha256(stableStringify({ a: 1 })));
  });

  it('hashPhaseDescriptor does not equal whole plan.md hash', () => {
    const fx = seedTree();
    try {
      const planRaw = readFileSync(fx.planPath, 'utf8');
      const phaseHash = hashPhaseDescriptor(planRaw, 'F0');
      const wholeHash = sha256(planRaw);
      assert.notEqual(phaseHash, wholeHash);
    } finally {
      fx.cleanup();
    }
  });

  it('build + check receipt is consistent against live fixtures', () => {
    const fx = seedTree();
    try {
      const receiptPath = join(fx.root, 'docs', 'audits', 'f0-receipt.json');
      mkdirSync(dirnameSafe(receiptPath), { recursive: true });
      const written = writeHistoryReceipt(receiptPath, {
        rootDir: fx.root,
        closeSha: CLOSE,
        generatedAt: '2026-07-16T12:00:00.000Z',
      });
      assert.equal(written.receipt.status, 'reconciled');
      assert.equal(written.receipt.phaseId, 'F0');
      assert.equal(written.receipt.closeSha, CLOSE);
      assert.equal(written.receipt.artifacts.gateEvidence['F0-G1'], true);
      assert.equal(written.receipt.artifacts.gateEvidence['F0-G2'], true);
      assert.deepEqual(written.receipt.artifacts.completionEvents.taskIds, ['T-001', 'T-002']);
      assert.equal(written.receipt.artifacts.completionEvents.phaseDone, true);
      assert.ok(written.receipt.artifacts.sidecars.length >= 1);

      const check = checkHistoryReceipt(receiptPath, { rootDir: fx.root });
      assert.equal(check.ok, true);
      assert.equal(check.classification, 'consistent');
    } finally {
      fx.cleanup();
    }
  });

  it('mutating initiative after receipt → ambiguous / check throws (stale)', () => {
    const fx = seedTree();
    try {
      const receiptPath = join(fx.root, 'receipt.json');
      writeHistoryReceipt(receiptPath, { rootDir: fx.root, closeSha: CLOSE });
      writeFileSync(fx.initiativePath, renderMd(f0Initiative({ title: 'MUTATED' })));
      assert.throws(
        () => checkHistoryReceipt(receiptPath, { rootDir: fx.root }),
        /stale|ambiguous|mismatch/i,
      );
      const live = collectHistoryLive({ rootDir: fx.root });
      const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
      const cls = classifyHistoryReconcile({ live, receipt });
      assert.equal(cls.classification, 'ambiguous');
      assert.equal(cls.repairable, false);
    } finally {
      fx.cleanup();
    }
  });

  it('duplicate completion events with unique logical identity → repairable', () => {
    const fx = seedTree({ withDupes: true });
    try {
      const live = collectHistoryLive({ rootDir: fx.root });
      assert.ok(live.completionEvents.rawCount > live.completionEvents.uniqueCount);
      const cls = classifyHistoryReconcile({ live, receipt: null, mode: 'live-only' });
      assert.equal(cls.classification, 'repairable');
      assert.equal(cls.repairable, true);

      // Receipt still checks green (repairable is acceptable).
      const receiptPath = join(fx.root, 'receipt.json');
      writeHistoryReceipt(receiptPath, { rootDir: fx.root, closeSha: CLOSE });
      const check = checkHistoryReceipt(receiptPath, { rootDir: fx.root });
      assert.equal(check.ok, true);
      assert.ok(['consistent', 'repairable'].includes(check.classification));
    } finally {
      fx.cleanup();
    }
  });

  it('missing phase-done event → ambiguous (no write path)', () => {
    const fx = seedTree();
    try {
      // Drop phase-done line.
      writeFileSync(
        fx.completionsPath,
        `${JSON.stringify({
          ts: '2026-07-16T10:00:00.000Z',
          event: 'task-done',
          projectId: 'atomic-skills',
          planSlug: 'integrity-remediation',
          phaseId: 'F0',
          taskId: 'T-001',
          weight: 1,
          weightBasis: 'count',
        })}\n`,
      );
      const live = collectHistoryLive({ rootDir: fx.root });
      const cls = classifyHistoryReconcile({ live, receipt: null, mode: 'live-only' });
      assert.equal(cls.classification, 'ambiguous');
      assert.equal(cls.repairable, false);
      assert.throws(
        () => buildHistoryReceipt({ rootDir: fx.root, closeSha: CLOSE }),
        /ambiguous|refuse/i,
      );
    } finally {
      fx.cleanup();
    }
  });

  it('repo live receipt path (if present) checks consistent', () => {
    const receiptPath = join(
      process.cwd(),
      'docs',
      'audits',
      'integrity-remediation-f0-reconciliation.json',
    );
    if (!existsSync(receiptPath)) {
      // Generated later in the same task; skip if absent in isolated runs.
      return;
    }
    const check = checkHistoryReceipt(receiptPath, { rootDir: process.cwd() });
    assert.equal(check.ok, true);
    assert.ok(['consistent', 'repairable'].includes(check.classification));
  });
});

function dirnameSafe(p) {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return i >= 0 ? p.slice(0, i) : '.';
}
