import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildPhaseWorkOrder,
  withWorkOrderPlacement,
  isSpecAdmittedTask,
  isOpenTaskStatus,
  pathsFromTask,
} from '../src/automate-work-order.js';

function goodTask(overrides = {}) {
  return {
    id: 'T-001',
    title: 'Example',
    status: 'pending',
    outputs: [{ kind: 'file', path: 'src/a.js' }],
    scopeBoundary: ['Do not edit plan.md'],
    acceptance: ['a.js exports foo'],
    verifier: { kind: 'shell', command: 'node -e "process.exit(0)"', expectExitCode: 0 },
    ...overrides,
  };
}

describe('isSpecAdmittedTask', () => {
  it('accepts full SPEC interior', () => {
    const r = isSpecAdmittedTask(goodTask());
    assert.equal(r.ok, true);
    assert.equal(r.taskId, 'T-001');
  });

  it('fails closed without paths', () => {
    const r = isSpecAdmittedTask(goodTask({ outputs: [] }));
    assert.equal(r.ok, false);
    assert.match(r.reason, /paths|outputs/i);
  });

  it('fails closed without acceptance', () => {
    const r = isSpecAdmittedTask(goodTask({ acceptance: [] }));
    assert.equal(r.ok, false);
    assert.match(r.reason, /acceptance/i);
  });

  it('fails closed without scopeBoundary key', () => {
    const t = goodTask();
    delete t.scopeBoundary;
    const r = isSpecAdmittedTask(t);
    assert.equal(r.ok, false);
    assert.match(r.reason, /scopeBoundary/i);
  });

  it('fails closed without verifier command', () => {
    const r = isSpecAdmittedTask(goodTask({ verifier: { kind: 'shell' } }));
    assert.equal(r.ok, false);
    assert.match(r.reason, /verifier/i);
  });
});

describe('isOpenTaskStatus', () => {
  it('pending/active/missing are open; done/blocked/skipped are not', () => {
    assert.equal(isOpenTaskStatus('pending'), true);
    assert.equal(isOpenTaskStatus('active'), true);
    assert.equal(isOpenTaskStatus(''), true);
    assert.equal(isOpenTaskStatus('done'), false);
    assert.equal(isOpenTaskStatus('blocked'), false);
    assert.equal(isOpenTaskStatus('skipped'), false);
  });
});

describe('pathsFromTask', () => {
  it('reads outputs[].path and paths[]', () => {
    assert.deepEqual(pathsFromTask({ outputs: [{ path: 'src/a.js' }] }), ['src/a.js']);
    assert.deepEqual(pathsFromTask({ paths: ['src/b.js'] }), ['src/b.js']);
  });
});

describe('buildPhaseWorkOrder', () => {
  it('includes only pending/active SPEC-admitted tasks', () => {
    const order = buildPhaseWorkOrder({
      planSlug: 'demo',
      phaseId: 'F0',
      tasks: [
        goodTask({ id: 'T-001', status: 'pending' }),
        goodTask({
          id: 'T-002',
          status: 'done',
          outputs: [{ path: 'src/b.js' }],
        }),
        goodTask({
          id: 'T-003',
          status: 'active',
          outputs: [{ path: 'src/c.js' }],
        }),
      ],
      worktreePath: '/tmp/wt',
      writerBranch: 'impl/demo-F0-writer',
      baseRef: 'abc123',
      decisionLogPath: '.atomic-skills/projects/p/demo/decisions/F0.jsonl',
    });
    assert.equal(order.planSlug, 'demo');
    assert.equal(order.phaseId, 'F0');
    assert.equal(order.tasks.length, 2);
    assert.deepEqual(
      order.tasks.map((t) => t.taskId),
      ['T-001', 'T-003'],
    );
    assert.equal(order.worktreePath, '/tmp/wt');
    assert.equal(order.writerBranch, 'impl/demo-F0-writer');
    assert.equal(order.baseRef, 'abc123');
    assert.equal(order.decisionLogPath, '.atomic-skills/projects/p/demo/decisions/F0.jsonl');
    assert.deepEqual(order.tasks[0].paths, ['src/a.js']);
    assert.ok(order.tasks[0].verifier?.command);
  });

  it('fail closed when open task missing SPEC', () => {
    assert.throws(
      () =>
        buildPhaseWorkOrder({
          planSlug: 'demo',
          phaseId: 'F0',
          tasks: [goodTask({ outputs: [] })],
        }),
      /SPEC|fail closed|paths/i,
    );
  });

  it('requires planSlug and phaseId', () => {
    assert.throws(() => buildPhaseWorkOrder({ phaseId: 'F0', tasks: [] }), /planSlug/);
    assert.throws(() => buildPhaseWorkOrder({ planSlug: 'demo', tasks: [] }), /phaseId/);
  });

  it('reads from initiative object', () => {
    const order = buildPhaseWorkOrder({
      initiative: {
        parentPlan: 'from-init',
        phaseId: 'F1',
        tasks: [goodTask()],
      },
      initiativePath: 'phases/f1.md',
    });
    assert.equal(order.planSlug, 'from-init');
    assert.equal(order.phaseId, 'F1');
    assert.equal(order.initiativePath, 'phases/f1.md');
    assert.equal(order.tasks.length, 1);
  });

  it('excludes done tasks even if SPEC incomplete', () => {
    const order = buildPhaseWorkOrder({
      planSlug: 'demo',
      phaseId: 'F0',
      tasks: [
        goodTask({ id: 'T-001' }),
        { id: 'T-002', status: 'done', outputs: [] },
      ],
    });
    assert.equal(order.tasks.length, 1);
    assert.equal(order.tasks[0].taskId, 'T-001');
  });
});

describe('withWorkOrderPlacement', () => {
  it('fills placeholders without mutating input', () => {
    const base = buildPhaseWorkOrder({
      planSlug: 'demo',
      phaseId: 'F0',
      tasks: [goodTask()],
    });
    const filled = withWorkOrderPlacement(base, {
      worktreePath: '/wt',
      writerBranch: 'impl/x',
      baseRef: 'deadbeef',
    });
    assert.equal(filled.worktreePath, '/wt');
    assert.equal(base.worktreePath, undefined);
    assert.equal(filled.writerBranch, 'impl/x');
    assert.equal(filled.baseRef, 'deadbeef');
  });
});
