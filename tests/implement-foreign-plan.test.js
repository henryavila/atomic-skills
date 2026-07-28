/**
 * Foreign-plan implement lane — detect, sidecar work-order, parse, entry choice.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  classifyImplementArgv,
  classifyImplementTarget,
  FOREIGN_ENTRY_CHOICES,
  foreignPlanBranch,
  isAtomicSkillsPlanFilePath,
  looksLikeFilePath,
  normalizeForeignEntryChoice,
  slugFromSourcePath,
  splitImplementPlanArg,
  workOrderSidecarPath,
} from '../src/implement-target-kind.js';
import {
  admitReadiness,
  createWorkOrder,
  ensureTerminalPhases,
  loadWorkOrder,
  markTaskDone,
  nextPendingWorkTask,
  PHASE_ARCHIVE,
  PHASE_FINALIZE,
  serializeWorkOrder,
  stampArchive,
  stampFinalize,
  stampGroundTruth,
  taskSpecGaps,
  workPhasesComplete,
  WORK_ORDER_KIND,
} from '../src/foreign-work-order.js';
import {
  classifyStructure,
  parseForeignPlanMarkdown,
} from '../src/foreign-plan-parse.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMPLEMENT = join(ROOT, 'skills', 'core', 'implement.md');
const FOREIGN_ASSET = join(ROOT, 'skills', 'shared', 'implement-foreign-plan.md');

describe('splitImplementPlanArg / looksLikeFilePath', () => {
  it('strips mode flags and returns residual plan arg', () => {
    assert.equal(
      splitImplementPlanArg('docs/plan.md --mode=automate').planArg,
      'docs/plan.md',
    );
    assert.equal(
      splitImplementPlanArg('--mode=1 path/to/x.md').planArg,
      'path/to/x.md',
    );
    assert.equal(splitImplementPlanArg('my-slug').planArg, 'my-slug');
    assert.equal(splitImplementPlanArg('--clear-execution-mode').planArg, null);
  });

  it('detects path-like args vs bare slugs', () => {
    assert.equal(looksLikeFilePath('docs/foo.md'), true);
    assert.equal(looksLikeFilePath('./plan.md'), true);
    assert.equal(looksLikeFilePath('/abs/x.md'), true);
    assert.equal(looksLikeFilePath('feature-x.md'), true);
    assert.equal(looksLikeFilePath('my-feature'), false);
    assert.equal(looksLikeFilePath('atomic-skills/plan-b'), true); // slash form
  });

  it('project/slug without a real file stays atomic-plan inventory', () => {
    const r = classifyImplementTarget({
      arg: 'atomic-skills/plan-b',
      exists: () => false,
      resolvePath: (p) => `/repo/${p}`,
    });
    assert.equal(r.kind, 'atomic-plan');
    assert.equal(r.slug, 'plan-b');
  });
});

describe('classifyImplementTarget', () => {
  it('classifies existing non-AS markdown as foreign-plan with entry choice', () => {
    const r = classifyImplementTarget({
      arg: 'docs/cutover.md',
      exists: (p) => p === 'docs/cutover.md' || p.endsWith('docs/cutover.md'),
      resolvePath: (p) => `/repo/${p}`,
      cwd: '/repo',
    });
    assert.equal(r.kind, 'foreign-plan');
    assert.equal(r.entryChoiceRequired, true);
    assert.equal(r.sidecarPath, 'docs/cutover.implement.yaml');
    assert.equal(r.slug, 'cutover');
  });

  it('classifies AS plan.md path as atomic-plan-path (no entry choice)', () => {
    const p = '.atomic-skills/projects/atomic-skills/foo/plan.md';
    const r = classifyImplementTarget({
      arg: p,
      exists: () => true,
      resolvePath: (x) => x,
    });
    assert.equal(r.kind, 'atomic-plan-path');
    assert.equal(r.entryChoiceRequired, false);
  });

  it('classifies bare slug as atomic-plan inventory', () => {
    const r = classifyImplementTarget({ arg: 'my-feature', exists: () => false });
    assert.equal(r.kind, 'atomic-plan');
    assert.equal(r.entryChoiceRequired, false);
  });

  it('returns path-not-found when path-like missing on disk', () => {
    const r = classifyImplementTarget({
      arg: 'docs/missing.md',
      exists: () => false,
      resolvePath: (p) => `/repo/${p}`,
    });
    assert.equal(r.kind, 'path-not-found');
  });

  it('classifyImplementArgv strips mode then classifies', () => {
    const r = classifyImplementArgv('docs/x.md --mode=1', {
      exists: (p) => String(p).includes('docs/x.md'),
      resolvePath: (p) => p,
    });
    assert.equal(r.kind, 'foreign-plan');
  });
});

describe('isAtomicSkillsPlanFilePath / sidecar / slug', () => {
  it('matches nested plan.md only', () => {
    assert.equal(
      isAtomicSkillsPlanFilePath('.atomic-skills/projects/p/s/plan.md'),
      true,
    );
    assert.equal(isAtomicSkillsPlanFilePath('docs/plan.md'), false);
    assert.equal(
      isAtomicSkillsPlanFilePath('/repo/.atomic-skills/projects/a/b/plan.md'),
      true,
    );
  });

  it('sidecar colocated with source', () => {
    assert.equal(workOrderSidecarPath('docs/a.md'), 'docs/a.implement.yaml');
    assert.equal(slugFromSourcePath('docs/My_Plan.md'), 'my-plan');
    assert.equal(foreignPlanBranch('cutover'), 'plan/cutover');
  });
});

describe('normalizeForeignEntryChoice', () => {
  it('maps promote and foreign aliases', () => {
    assert.equal(normalizeForeignEntryChoice('Promote to AS'), null); // needs exact tokens — free text partial
    assert.equal(normalizeForeignEntryChoice('promote'), FOREIGN_ENTRY_CHOICES.PROMOTE);
    assert.equal(normalizeForeignEntryChoice('adopt'), FOREIGN_ENTRY_CHOICES.PROMOTE);
    assert.equal(normalizeForeignEntryChoice('foreign'), FOREIGN_ENTRY_CHOICES.FOREIGN);
    assert.equal(normalizeForeignEntryChoice('implement-as-foreign'), FOREIGN_ENTRY_CHOICES.FOREIGN);
    assert.equal(normalizeForeignEntryChoice('nope'), null);
  });
});

describe('foreign work-order', () => {
  it('creates work order with FINALIZE and ARCHIVE terminal phases', () => {
    const wo = createWorkOrder({
      sourcePath: 'docs/cutover.md',
      phases: [
        {
          id: 'P0',
          title: 'Work',
          status: 'active',
          tasks: [
            {
              id: 'T-001',
              title: 'Do thing',
              outputs: [{ path: 'src/a.js' }],
              scopeBoundary: ['no auth'],
              acceptance: ['exports foo'],
              verifier: { kind: 'shell', command: 'npm test', expectExitCode: 0 },
            },
          ],
        },
      ],
    });
    assert.equal(wo.kind, WORK_ORDER_KIND);
    assert.equal(wo.executionMode, 'automate');
    assert.ok(wo.phases.some((p) => p.id === PHASE_FINALIZE && p.terminal));
    assert.ok(wo.phases.some((p) => p.id === PHASE_ARCHIVE && p.terminal));
    assert.equal(wo.branch, 'plan/cutover');
  });

  it('admitReadiness reports SPEC gaps; ready when complete', () => {
    const incomplete = createWorkOrder({
      sourcePath: 'x.md',
      phases: [
        {
          id: 'P0',
          title: 'P',
          tasks: [{ id: 'T-001', title: 't', outputs: [], acceptance: [], verifier: null }],
        },
      ],
    });
    const gap = admitReadiness(incomplete);
    assert.equal(gap.ready, false);
    assert.ok(gap.gaps[0].missing.includes('outputs'));

    const complete = createWorkOrder({
      sourcePath: 'x.md',
      phases: [
        {
          id: 'P0',
          title: 'P',
          tasks: [
            {
              id: 'T-001',
              title: 't',
              outputs: [{ path: 'a.js' }],
              acceptance: ['ok'],
              verifier: { kind: 'shell', command: 'true', expectExitCode: 0 },
            },
          ],
        },
      ],
    });
    assert.equal(admitReadiness(complete).ready, true);
    assert.deepEqual(taskSpecGaps(complete.phases[0].tasks[0]), []);
  });

  it('never self-certifies: markTaskDone requires evidence.passed', () => {
    const wo = createWorkOrder({
      sourcePath: 'x.md',
      phases: [
        {
          id: 'P0',
          title: 'P',
          tasks: [
            {
              id: 'T-001',
              title: 't',
              outputs: [{ path: 'a.js' }],
              acceptance: ['ok'],
              verifier: { kind: 'shell', command: 'true', expectExitCode: 0 },
            },
          ],
        },
      ],
    });
    assert.throws(() => markTaskDone(wo, 'T-001', { passed: false }), /passed/);
    assert.throws(() => markTaskDone(wo, 'T-001', null), /passed/);
    const done = markTaskDone(wo, 'T-001', {
      passed: true,
      command: 'true',
      exitCode: 0,
    });
    assert.equal(done.phases[0].tasks[0].status, 'done');
    assert.equal(nextPendingWorkTask(done), null);
    assert.equal(workPhasesComplete(done), true);
  });

  it('finalize then archive; archive refuses without finalize', () => {
    let wo = createWorkOrder({
      sourcePath: 'x.md',
      phases: [
        {
          id: 'P0',
          title: 'P',
          tasks: [
            {
              id: 'T-001',
              title: 't',
              status: 'done',
              outputs: [{ path: 'a.js' }],
              acceptance: ['ok'],
              verifier: { kind: 'shell', command: 'true', expectExitCode: 0 },
              evidence: { passed: true },
            },
          ],
        },
      ],
    });
    // mark phase done
    wo.phases[0].status = 'done';

    assert.throws(() => stampArchive(wo, { worktreeRemoved: true }), /finalize/);

    wo = stampFinalize(wo, {
      userValidatedAt: '2026-07-28T12:00:00.000Z',
      intentVsDelivered: [{ item: 'T-001', status: 'matched' }],
      prUrl: 'https://example.com/pr/1',
    });
    assert.equal(wo.status, 'finalizing');
    assert.equal(wo.currentPhase, PHASE_ARCHIVE);
    assert.ok(wo.finalize.userValidatedAt);

    wo = stampArchive(wo, {
      worktreeRemoved: true,
      worktreePath: '.worktrees/x',
      branchDisposition: 'kept-for-pr',
    });
    assert.equal(wo.status, 'archived');
    assert.equal(wo.archive.worktreeRemoved, true);

    // round-trip YAML
    const loaded = loadWorkOrder(serializeWorkOrder(wo));
    assert.equal(loaded.status, 'archived');
    assert.equal(loaded.finalize.userValidatedAt, '2026-07-28T12:00:00.000Z');
  });

  it('stampGroundTruth stores receipt', () => {
    const wo = stampGroundTruth(createWorkOrder({ sourcePath: 'x.md' }), {
      status: 'complete',
      mode: 'ground-truth',
    });
    assert.equal(wo.groundTruth.status, 'complete');
  });

  it('ensureTerminalPhases is idempotent', () => {
    const once = ensureTerminalPhases([]);
    const twice = ensureTerminalPhases(once);
    assert.equal(twice.filter((p) => p.id === PHASE_FINALIZE).length, 1);
    assert.equal(twice.filter((p) => p.id === PHASE_ARCHIVE).length, 1);
  });
});

describe('foreign-plan-parse', () => {
  it('classifies S0 structured near-AS source', () => {
    const md = `
## F0 — Boot

### T0.1 First task

- Files: src/a.js
- scopeBoundary: do not touch b.js
- acceptance: exports a
- verifier: kind shell, command: "npm test", expectExitCode: 0
`;
    assert.equal(classifyStructure(md), 'S0');
    const parsed = parseForeignPlanMarkdown(md);
    assert.equal(parsed.structureClass, 'S0');
    assert.ok(parsed.phases.length >= 1);
    assert.ok(parsed.phases[0].tasks.length >= 1);
    assert.equal(parsed.phases[0].tasks[0].outputs[0].path, 'src/a.js');
    assert.ok(parsed.phases[0].tasks[0].verifier);
  });

  it('classifies S2 checkbox list into P0 tasks', () => {
    const md = `
# Todo
- [ ] Add health endpoint
- [x] Already done item
`;
    assert.equal(classifyStructure(md), 'S2');
    const parsed = parseForeignPlanMarkdown(md);
    assert.equal(parsed.phases[0].tasks.length, 2);
    assert.equal(parsed.phases[0].tasks[1].status, 'done');
  });

  it('S3 narrative yields empty tasks + warning', () => {
    const md = `We should improve the login flow and make it faster somehow.`;
    assert.equal(classifyStructure(md), 'S3');
    const parsed = parseForeignPlanMarkdown(md);
    assert.ok(parsed.warnings.length >= 1);
    assert.equal(parsed.phases[0].tasks.length, 0);
  });
});

describe('implement skill prose — foreign lane contract', () => {
  it('implement.md documents foreign entry AskUserQuestion and asset', () => {
    assert.ok(existsSync(FOREIGN_ASSET), 'implement-foreign-plan.md must exist');
    const impl = readFileSync(IMPLEMENT, 'utf8');
    const foreign = readFileSync(FOREIGN_ASSET, 'utf8');

    assert.match(impl, /foreign-plan|Foreign plan/i);
    assert.match(impl, /implement-foreign-plan\.md/);
    assert.match(impl, /AskUserQuestion|ASK_USER_QUESTION/);
    assert.match(impl, /Promote|promote/);
    assert.match(impl, /path\/to\/.*\.md|pathToFile|\.md/);

    assert.match(foreign, /FINALIZE/);
    assert.match(foreign, /ARCHIVE/);
    assert.match(foreign, /worktree/i);
    assert.match(foreign, /\.implement\.yaml/);
    assert.match(foreign, /ground-truth|Ground-truth/i);
    assert.match(foreign, /automate/i);
    assert.match(foreign, /never.*promote|no promote|Promote is entry-time only/i);
    assert.match(foreign, /project adopt|atomic-skills:project adopt/i);
  });
});
