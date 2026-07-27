import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildIntentSurface,
  buildDeliveredSurface,
  buildIntentVsDeliveredBrief,
  buildIntentVsDeliveredRows,
  INTENT_VS_DELIVERED_STATUSES,
} from '../src/plan-end-intent-surface.js';

/** Multi-phase plan + initiative-shaped sample used across collector tests. */
function multiPhaseSample() {
  return {
    plan: {
      slug: 'demo-intent-plan',
      title: 'Demo intent plan',
      businessIntent: {
        value: 'Ship intent-vs-delivered gate',
        workflow: 'build surfaces then external-both',
        rules: 'fail closed on empty intentVsDelivered',
        outOfScope: 'auto-merge product PRs',
        doneWhen: 'finalize blocked without intentVsDelivered under automate',
      },
      phases: [
        {
          id: 'F0',
          goal: 'Automate as default mode',
          exitCriteria: ['default isAutomateActive', 'Mode 1 explicit escape'],
        },
        {
          id: 'F1',
          goal: 'Decision package present-before-PASS',
          businessIntent: {
            value: 'Never blind PASS decision-review',
            workflow: 'present package then AskUserQuestion',
            rules: 'packagePresentedAt required',
            outOfScope: 'auto-PASS by host',
            doneWhen: 'phase-done requires present evidence',
          },
          exitGate: {
            criteria: [
              { id: 'F1-G1', description: 'Package tests pass' },
              { id: 'F1-G2', description: 'present-before-PASS prose' },
            ],
          },
        },
        {
          id: 'F2',
          goal: 'Plan-end intent-vs-delivered',
          exitCriteria: 'intent surface + receipt field land',
        },
      ],
    },
    initiatives: [
      {
        phaseId: 'F0',
        tasks: [
          {
            id: 'T-001',
            title: 'Default isAutomateActive',
            acceptance: [
              'bare implement activates automate',
              'Mode 1 requires explicit flag',
            ],
            status: 'done',
          },
          {
            id: 'T-002',
            title: 'Docs for escape',
            acceptance: 'implement.md documents Mode 1 escape',
            status: 'done',
          },
        ],
      },
      {
        phaseId: 'F1',
        tasks: [
          {
            id: 'T-001',
            title: 'buildDecisionPackage',
            acceptance: 'exports summaryMarkdown + empty banner',
            status: 'done',
          },
          {
            id: 'T-002',
            title: 'present-before-PASS gate',
            acceptance: 'fail closed without packagePresentedAt',
            status: 'done',
          },
        ],
      },
      {
        phaseId: 'F2',
        tasks: [
          {
            id: 'T-001',
            title: 'Intent surface collectors',
            acceptance: 'buildIntentSurface + buildDeliveredSurface + brief',
            status: 'done',
          },
          {
            id: 'T-002',
            title: 'Receipt contract',
            acceptance: 'empty intentVsDelivered fails under automate',
            status: 'todo',
          },
        ],
      },
    ],
  };
}

function multiPhaseDelivered() {
  return {
    tasks: [
      {
        phaseId: 'F0',
        id: 'T-001',
        status: 'done',
        commitShas: ['aaa1111'],
        paths: ['src/implement-mode.js', 'tests/implement-mode.test.js'],
      },
      {
        phaseId: 'F0',
        id: 'T-002',
        status: 'done',
        commitShas: ['bbb2222'],
        paths: ['skills/core/implement.md'],
        outputs: ['docs/kb/note.md'],
      },
      {
        phaseId: 'F1',
        id: 'T-001',
        status: 'done',
        commitShas: ['ccc3333'],
        paths: ['src/decision-review-package.js'],
      },
      {
        phaseId: 'F1',
        id: 'T-002',
        status: 'done',
        commitShas: ['ddd4444'],
        paths: ['src/decision-review-gate.js'],
      },
      {
        phaseId: 'F2',
        id: 'T-001',
        status: 'done',
        commitShas: ['eee5555'],
        paths: [
          'src/plan-end-intent-surface.js',
          'tests/plan-end-intent-surface.test.js',
        ],
      },
      {
        phaseId: 'F2',
        id: 'T-002',
        status: 'todo',
        paths: [],
      },
    ],
    claims: [
      {
        taskId: 'T-001',
        phaseId: 'F2',
        commitShas: ['eee5555'],
        paths: ['src/plan-end-intent-surface.js'],
        status: 'claimed-pass',
      },
    ],
    commitShas: ['aaa1111', 'bbb2222', 'ccc3333', 'ddd4444', 'eee5555'],
  };
}

describe('buildIntentSurface', () => {
  it('builds intent surface from phase goals businessIntent tasks acceptance and exit criteria', () => {
    const sample = multiPhaseSample();
    const surface = buildIntentSurface(sample);

    assert.ok(surface && typeof surface === 'object');
    assert.ok(Array.isArray(surface.items));
    assert.ok(surface.items.length >= 5, 'multi-phase sample must yield many items');

    const kinds = new Set(surface.items.map((i) => i.kind));
    assert.ok(kinds.has('phase-goal'), 'includes phase goals');
    assert.ok(
      kinds.has('business-intent') || kinds.has('businessIntent'),
      'includes businessIntent fields',
    );
    assert.ok(
      kinds.has('task-acceptance') || kinds.has('acceptance'),
      'includes task acceptance',
    );
    assert.ok(
      kinds.has('exit-criteria') || kinds.has('exitCriteria'),
      'includes exit criteria',
    );

    const goals = surface.items.filter((i) => i.kind === 'phase-goal');
    assert.ok(
      goals.some((g) => /Automate as default/i.test(g.text)),
      'F0 goal present',
    );
    assert.ok(
      goals.some((g) => /intent-vs-delivered/i.test(g.text)),
      'F2 goal present',
    );

    const bi = surface.items.filter(
      (i) => i.kind === 'business-intent' || i.kind === 'businessIntent',
    );
    assert.ok(
      bi.some((b) => /intent-vs-delivered gate/i.test(b.text)),
      'plan-level BI value present',
    );
    assert.ok(
      bi.some((b) => /Never blind PASS/i.test(b.text)),
      'phase-level BI present',
    );

    const acc = surface.items.filter(
      (i) => i.kind === 'task-acceptance' || i.kind === 'acceptance',
    );
    assert.ok(
      acc.some((a) => /bare implement activates automate/i.test(a.text)),
      'task acceptance present',
    );
    assert.ok(
      acc.some((a) => a.phaseId === 'F2' && a.taskId === 'T-001'),
      'acceptance carries phaseId + taskId',
    );

    const exits = surface.items.filter(
      (i) => i.kind === 'exit-criteria' || i.kind === 'exitCriteria',
    );
    assert.ok(exits.length >= 2, 'exit criteria from multiple phases');
    assert.ok(
      exits.some((e) => /default isAutomateActive/i.test(e.text)),
      'F0 exit criterion',
    );
  });

  it('handles empty/missing inputs without throwing', () => {
    assert.deepEqual(buildIntentSurface({}).items, []);
    assert.deepEqual(buildIntentSurface(null).items, []);
    assert.deepEqual(buildIntentSurface(undefined).items, []);
  });
});

describe('buildDeliveredSurface', () => {
  it('builds delivered surface from task evidence done status claim SHAs and outputs paths', () => {
    const surface = buildDeliveredSurface(multiPhaseDelivered());

    assert.ok(surface && typeof surface === 'object');
    assert.ok(Array.isArray(surface.items));
    assert.ok(surface.items.length >= 1);

    const doneTasks = surface.items.filter(
      (i) =>
        (i.kind === 'task-done' || i.kind === 'task') &&
        (i.status === 'done' || i.done === true),
    );
    assert.ok(doneTasks.length >= 5, 'done tasks collected');

    const shas = surface.commitShas || [];
    assert.ok(Array.isArray(shas));
    assert.ok(shas.includes('aaa1111'));
    assert.ok(shas.includes('eee5555'));

    const paths = surface.paths || [];
    assert.ok(Array.isArray(paths));
    assert.ok(paths.some((p) => p.includes('plan-end-intent-surface')));
    assert.ok(paths.some((p) => p.includes('implement-mode')));

    // outputs paths from tasks
    assert.ok(
      paths.some((p) => p.includes('docs/kb/note.md')) ||
        surface.items.some(
          (i) =>
            i.kind === 'output-path' &&
            String(i.path || i.text || '').includes('docs/kb/note.md'),
        ),
      'outputs paths collected',
    );
  });

  it('merges optional top-level git SHA list', () => {
    const surface = buildDeliveredSurface({
      tasks: [{ id: 'T-001', status: 'done', commitShas: ['aaa'] }],
      commitShas: ['bbb', 'ccc'],
    });
    assert.ok(surface.commitShas.includes('aaa'));
    assert.ok(surface.commitShas.includes('bbb'));
    assert.ok(surface.commitShas.includes('ccc'));
  });

  it('handles empty/missing inputs without throwing', () => {
    assert.deepEqual(buildDeliveredSurface({}).items, []);
    assert.deepEqual(buildDeliveredSurface(null).items, []);
  });
});

describe('buildIntentVsDeliveredBrief', () => {
  it('exports markdown brief section Intent vs delivered checklist for the review prompt', () => {
    const intent = buildIntentSurface(multiPhaseSample());
    const delivered = buildDeliveredSurface(multiPhaseDelivered());
    const md = buildIntentVsDeliveredBrief(intent, delivered);

    assert.equal(typeof md, 'string');
    assert.match(md, /Intent vs delivered/i);
    assert.ok(md.length > 80, 'brief must be non-trivial');
    // Checklist markers for the external reviewer
    assert.match(md, /checklist|matched|missing|partial|extra/i);
    // Surfaces must appear so the brief is not empty scaffolding
    assert.match(md, /Automate as default|intent-vs-delivered|phase/i);
  });

  it('works when one surface is empty (still produces section header)', () => {
    const md = buildIntentVsDeliveredBrief(
      buildIntentSurface({}),
      buildDeliveredSurface({}),
    );
    assert.match(md, /Intent vs delivered/i);
  });
});

describe('buildIntentVsDeliveredRows', () => {
  it('produces rows with status matched|partial|missing|extra', () => {
    const intent = buildIntentSurface(multiPhaseSample());
    const delivered = buildDeliveredSurface(multiPhaseDelivered());
    const rows = buildIntentVsDeliveredRows(intent, delivered);

    assert.ok(Array.isArray(rows));
    assert.ok(rows.length >= 1);
    for (const row of rows) {
      assert.ok(
        INTENT_VS_DELIVERED_STATUSES.includes(row.status),
        `unexpected status ${row.status}`,
      );
      assert.ok(typeof row.label === 'string' && row.label.length > 0);
    }
    // Done tasks with SHAs should score matched or partial for acceptance items
    const statuses = new Set(rows.map((r) => r.status));
    assert.ok(
      statuses.has('matched') || statuses.has('partial'),
      'some intent items covered by delivery',
    );
    // T-002 F2 still todo → missing or partial somewhere
    assert.ok(
      statuses.has('missing') || statuses.has('partial'),
      'incomplete delivery surfaces missing/partial',
    );
  });
});
