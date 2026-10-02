import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  deliveryAuditGateHonesty,
  deliveryAuditAllowsClose,
  buildDeliveryAuditGate,
  isDurableAutomateForDeliveryAudit,
  DELIVERY_AUDIT_PASS_VERDICTS,
  deliveryAuditReportContentFloor,
  deliveryAuditGateAuthenticity,
  parseDeliveryAuditReportVerdict,
  reportHasOpenCriticalResidual,
  DELIVERY_AUDIT_REPORT_MIN_BYTES,
  graphCoverageSubjects,
  parseGraphCoverageLines,
  deliveryAuditGraphCoverage,
  GRAPH_COVERAGE_STATUSES,
} from '../src/phase-delivery-audit-gate.js';
import { canRunPhaseDone } from '../src/automate-orchestrator-gates.js';

/** Canonical honest passed gate for tests. */
const HONEST_CLOSED = {
  status: 'passed',
  verdict: 'CLOSED',
  reportPath: '.atomic-skills/reviews/audit-delivery-demo-f2.md',
  verifiedAt: '2026-08-04T15:00:00.000Z',
};

const SAMPLE_REPORT = `# Audit Delivery — demo

**Verdict:** CLOSED

## Intent Package
Decisions D1..Dn

## Residual
none CRITICAL

## Findings
All RESOLVED
`;

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

describe('isDurableAutomateForDeliveryAudit', () => {
  it('true on stamp alone', () => {
    assert.equal(
      isDurableAutomateForDeliveryAudit({ planExecutionMode: 'automate' }),
      true,
    );
  });
  it('false when no stamp and no automateActive', () => {
    assert.equal(isDurableAutomateForDeliveryAudit({}), false);
  });
});

describe('deliveryAuditGateHonesty', () => {
  it('accepts passed + CLOSED + reportPath', () => {
    assert.deepEqual(deliveryAuditGateHonesty(HONEST_CLOSED), { ok: true });
  });

  it('accepts passed + PARTIAL + reportPath', () => {
    assert.deepEqual(
      deliveryAuditGateHonesty({
        status: 'passed',
        verdict: 'PARTIAL',
        reportPath: '.atomic-skills/reviews/audit-delivery-partial.md',
      }),
      { ok: true },
    );
  });

  it('rejects null / missing gate', () => {
    const r = deliveryAuditGateHonesty(null);
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /deliveryAuditGate/);
  });

  it('rejects status skipped (skip illegal)', () => {
    const r = deliveryAuditGateHonesty({
      status: 'skipped',
      operatorSkip: true,
      reason: 'small phase',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /skipped|illegal/i);
  });

  it('rejects operatorSkip even with passed shape', () => {
    const r = deliveryAuditGateHonesty({
      ...HONEST_CLOSED,
      operatorSkip: true,
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /operatorSkip/);
  });

  it('rejects reason-only without passed stamp', () => {
    const r = deliveryAuditGateHonesty({
      reason: 'we audited in chat',
    });
    assert.equal(r.ok, false);
  });

  it('rejects empty reportPath', () => {
    const r = deliveryAuditGateHonesty({
      status: 'passed',
      verdict: 'CLOSED',
      reportPath: '   ',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /reportPath/);
  });

  it('rejects OPEN verdict (never stamps passed)', () => {
    const r = deliveryAuditGateHonesty({
      status: 'passed',
      verdict: 'OPEN',
      reportPath: '.atomic-skills/reviews/x.md',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /OPEN/);
  });

  it('rejects missing verdict', () => {
    const r = deliveryAuditGateHonesty({
      status: 'passed',
      reportPath: '.atomic-skills/reviews/x.md',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /CLOSED|PARTIAL|verdict/i);
  });

  it('pass verdicts constant lists CLOSED and PARTIAL', () => {
    assert.deepEqual([...DELIVERY_AUDIT_PASS_VERDICTS].sort(), [
      'CLOSED',
      'PARTIAL',
    ]);
  });
});

describe('deliveryAuditAllowsClose', () => {
  it('allows close when automate off', () => {
    assert.deepEqual(deliveryAuditAllowsClose({}), { ok: true });
  });

  it('blocks when automate stamp and no deliveryAuditGate', () => {
    const r = deliveryAuditAllowsClose({ planExecutionMode: 'automate' });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /deliveryAuditGate/);
  });

  it('honest CLOSED stamp alone is not enough under durable automate', () => {
    const r = deliveryAuditAllowsClose({
      planExecutionMode: 'automate',
      deliveryAuditGate: HONEST_CLOSED,
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /flow\/flow\.json|ratifiedGraphSha|graph/i);
  });

  it('reads gate from phase.deliveryAuditGate then requires graph', () => {
    const r = deliveryAuditAllowsClose({
      planExecutionMode: 'automate',
      phase: { deliveryAuditGate: HONEST_CLOSED },
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /flow\/flow\.json|ratifiedGraphSha|graph/i);
  });

  it('blocks skip shapes under automate', () => {
    const r = deliveryAuditAllowsClose({
      planExecutionMode: 'automate',
      deliveryAuditGate: {
        status: 'skipped',
        operatorSkip: true,
        reason: 'no product intent',
      },
    });
    assert.equal(r.ok, false);
  });
});

describe('buildDeliveryAuditGate', () => {
  it('builds CLOSED stamp', () => {
    const g = buildDeliveryAuditGate({
      reportPath: '.atomic-skills/reviews/a.md',
      verdict: 'CLOSED',
      verifiedAt: '2026-08-04T15:00:00.000Z',
    });
    assert.equal(g.status, 'passed');
    assert.equal(g.verdict, 'CLOSED');
    assert.equal(g.reportPath, '.atomic-skills/reviews/a.md');
  });

  it('throws on OPEN', () => {
    assert.throws(
      () =>
        buildDeliveryAuditGate({
          reportPath: '.atomic-skills/reviews/a.md',
          verdict: 'OPEN',
        }),
      /OPEN/,
    );
  });

  it('throws on empty reportPath', () => {
    assert.throws(
      () => buildDeliveryAuditGate({ reportPath: '', verdict: 'CLOSED' }),
      /reportPath/,
    );
  });

  it('throws on skipped status', () => {
    assert.throws(
      () =>
        buildDeliveryAuditGate({
          status: 'skipped',
          reportPath: '.atomic-skills/reviews/a.md',
          verdict: 'CLOSED',
        }),
      /skipped|illegal/i,
    );
  });

  it('throws on operatorSkip', () => {
    assert.throws(
      () =>
        buildDeliveryAuditGate({
          reportPath: '.atomic-skills/reviews/a.md',
          verdict: 'CLOSED',
          operatorSkip: true,
        }),
      /operatorSkip/,
    );
  });
});

describe('canRunPhaseDone requires deliveryAuditGate', () => {
  const baseOk = {
    planExecutionMode: 'automate',
    evaluationGate: evalPassed,
    lessonsState: 'none',
    reviewGate: reviewBoth,
    decisionReview: decisionPassed,
  };

  it('blocks full chain without deliveryAuditGate (missing fail)', () => {
    const r = canRunPhaseDone(baseOk);
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /deliveryAuditGate|audit-delivery/i);
  });

  it('blocks skip deliveryAuditGate', () => {
    const r = canRunPhaseDone({
      ...baseOk,
      deliveryAuditGate: {
        status: 'skipped',
        operatorSkip: true,
        reason: 'waive',
      },
    });
    assert.equal(r.ok, false);
  });

  it('honest CLOSED deliveryAuditGate without graph still fails', () => {
    const r = canRunPhaseDone({
      ...baseOk,
      deliveryAuditGate: HONEST_CLOSED,
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /flow\/flow\.json|ratifiedGraphSha|graph/i);
  });

  it('blocks OPEN verdict on deliveryAuditGate', () => {
    const r = canRunPhaseDone({
      ...baseOk,
      deliveryAuditGate: {
        status: 'passed',
        verdict: 'OPEN',
        reportPath: '.atomic-skills/reviews/x.md',
      },
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /OPEN/);
  });
});

describe('deliveryAuditReportContentFloor', () => {
  it('rejects missing / one-line stub', () => {
    assert.equal(deliveryAuditReportContentFloor(null).ok, false);
    assert.equal(deliveryAuditReportContentFloor('CLOSED only').ok, false);
  });

  it('accepts multi-line structured report', () => {
    const r = deliveryAuditReportContentFloor(SAMPLE_REPORT);
    assert.equal(r.ok, true, r.reason);
  });

  it('exports min bytes constant', () => {
    assert.ok(DELIVERY_AUDIT_REPORT_MIN_BYTES >= 100);
  });
});

describe('parseDeliveryAuditReportVerdict / open CRITICAL', () => {
  it('parses Verdict line', () => {
    assert.equal(parseDeliveryAuditReportVerdict(SAMPLE_REPORT), 'CLOSED');
    assert.equal(
      parseDeliveryAuditReportVerdict('**Verdict:** PARTIAL\n'),
      'PARTIAL',
    );
  });

  it('detects open CRITICAL residual rows', () => {
    assert.equal(reportHasOpenCriticalResidual(SAMPLE_REPORT), false);
    assert.equal(
      reportHasOpenCriticalResidual(
        '## Residual\n- open CRITICAL dual path still taught\n',
      ),
      true,
    );
  });
});

describe('deliveryAuditGateAuthenticity', () => {
  it('no-op without content or FS hooks', () => {
    assert.deepEqual(
      deliveryAuditGateAuthenticity(HONEST_CLOSED),
      { ok: true },
    );
  });

  it('fails when exists says missing', () => {
    const r = deliveryAuditGateAuthenticity(HONEST_CLOSED, {
      exists: () => false,
      checkAuthenticity: true,
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /does not exist|unavailable/i);
  });

  it('fails when stamp verdict mismatches body', () => {
    const r = deliveryAuditGateAuthenticity(
      { ...HONEST_CLOSED, verdict: 'PARTIAL' },
      { reportContent: SAMPLE_REPORT },
    );
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /does not match|PARTIAL|CLOSED/);
  });

  it('fails CLOSED with open CRITICAL residual in body', () => {
    const body = `# Audit\n**Verdict:** CLOSED\n## Residual\n- open CRITICAL leftover\n## Intent\nD1\n`;
    const r = deliveryAuditGateAuthenticity(HONEST_CLOSED, {
      reportContent: body,
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /CRITICAL/);
  });

  it('accepts honest CLOSED with full report content', () => {
    const r = deliveryAuditGateAuthenticity(HONEST_CLOSED, {
      reportContent: SAMPLE_REPORT,
      exists: () => true,
    });
    assert.equal(r.ok, true, r.reason);
  });
});

const XOR_FLOW = {
  schemaVersion: '1.0',
  planSlug: 'minimal-xor',
  ratifiedGraphSha: 'a'.repeat(64),
  graph: {
    entry: 'S1',
    nodes: {
      S1: { type: 'activity', next: 'D1' },
      D1: {
        type: 'xor',
        label: 'Accept?',
        question: 'Accept the request?',
        branches: [
          { id: 'D1.yes', next: 'end_ok' },
          { id: 'D1.no', next: 'end_no' },
        ],
      },
      end_ok: { type: 'end' },
      end_no: { type: 'end' },
    },
  },
  machines: [{ id: 'request', label: 'Request', nodes: { open: {} } }],
};

const COVERING_REPORT = [
  SAMPLE_REPORT,
  '',
  '## Flow graph',
  'machine request: faz',
  'xor D1: faz',
].join('\n');

describe('delivery audit reads flow graph (F4 T-002)', () => {
  it('lists one subject per machine and per xor', () => {
    const subjects = graphCoverageSubjects(XOR_FLOW);
    assert.ok(subjects.some((s) => s.kind === 'machine' && s.id === 'request'));
    assert.ok(subjects.some((s) => s.kind === 'xor' && s.id === 'D1'));
    assert.deepEqual([...GRAPH_COVERAGE_STATUSES], ['faz', 'pela metade', 'não faz']);
  });

  it('refuses a divergent ratifiedGraphSha', () => {
    const r = deliveryAuditGraphCoverage({
      flowDoc: XOR_FLOW,
      ratifiedGraphSha: 'b'.repeat(64),
      actualSha: 'c'.repeat(64),
      reportText: COVERING_REPORT,
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /divergent|ratifiedGraphSha|sha/i);
  });

  it('refuses a missing cited flow/flow.json path (L-F2-1)', () => {
    const r = deliveryAuditGraphCoverage({
      flowPath: 'flow/flow.json',
      ratifiedGraphSha: XOR_FLOW.ratifiedGraphSha,
      reportText: COVERING_REPORT,
      exists: () => false,
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /flow\/flow\.json|does not exist|missing/i);
  });

  it('a flow.json fixture with one xor and a report missing that line fails', () => {
    const r = deliveryAuditGraphCoverage({
      flowDoc: XOR_FLOW,
      ratifiedGraphSha: XOR_FLOW.ratifiedGraphSha,
      actualSha: XOR_FLOW.ratifiedGraphSha,
      reportText: `${SAMPLE_REPORT}\nmachine request: faz\n`,
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /xor|D1|missing/i);
  });

  it('accepts one faz|pela metade|não faz line per machine and xor', () => {
    const parsed = parseGraphCoverageLines(COVERING_REPORT);
    assert.equal(parsed.machine.request, 'faz');
    assert.equal(parsed.xor.D1, 'faz');
    const r = deliveryAuditGraphCoverage({
      flowDoc: XOR_FLOW,
      ratifiedGraphSha: XOR_FLOW.ratifiedGraphSha,
      actualSha: XOR_FLOW.ratifiedGraphSha,
      reportText: COVERING_REPORT,
    });
    assert.equal(r.ok, true, r.reason);
    assert.ok(Array.isArray(r.lines));
    assert.ok(r.lines.some((line) => /machine request: faz/.test(line)));
    assert.ok(r.lines.some((line) => /xor D1: faz/.test(line)));
  });

  it('where businessIntent disagrees with the graph, the graph wins', () => {
    const r = deliveryAuditGraphCoverage({
      flowDoc: XOR_FLOW,
      ratifiedGraphSha: XOR_FLOW.ratifiedGraphSha,
      actualSha: XOR_FLOW.ratifiedGraphSha,
      reportText: `${SAMPLE_REPORT}\nmachine inventory: faz\n`,
      businessIntent: {
        value: 'only the inventory machine matters; ignore xor D1',
        workflow: 'skip Accept? xor',
      },
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /xor|D1|graph wins|graph/i);
  });

  it('the final page does not substitute this gate', () => {
    const r = deliveryAuditGraphCoverage({
      flowDoc: XOR_FLOW,
      ratifiedGraphSha: XOR_FLOW.ratifiedGraphSha,
      actualSha: XOR_FLOW.ratifiedGraphSha,
      reportText: SAMPLE_REPORT,
      finalPage: true,
      userValidatedAt: '2026-10-02T00:00:00.000Z',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /final page|xor|does not substitute/i);
  });
});

describe('deliveryAuditAllowsClose graph (F4 T-002)', () => {
  it('fails closed under automate when graph coverage is missing', () => {
    const r = deliveryAuditAllowsClose({
      planExecutionMode: 'automate',
      deliveryAuditGate: HONEST_CLOSED,
      flowDoc: XOR_FLOW,
      ratifiedGraphSha: XOR_FLOW.ratifiedGraphSha,
      actualSha: XOR_FLOW.ratifiedGraphSha,
      reportContent: SAMPLE_REPORT,
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /xor|graph|machine/i);
  });

  it('honest CLOSED without flowDoc/flowPath/ratifiedGraphSha does not allow close when graph coverage is missing', () => {
    const planPath = '/tmp/demo-plan/plan.md';
    const flowPath = '/tmp/demo-plan/flow/flow.json';
    const r = deliveryAuditAllowsClose({
      planExecutionMode: 'automate',
      deliveryAuditGate: HONEST_CLOSED,
      planPath,
      cwd: '/tmp/demo-plan',
      reportContent: SAMPLE_REPORT,
      exists: (p) => String(p).replace(/\\/g, '/').endsWith('flow/flow.json'),
      readFile: (p) => {
        if (String(p).replace(/\\/g, '/').endsWith('flow/flow.json') || p === flowPath) {
          return JSON.stringify(XOR_FLOW);
        }
        return SAMPLE_REPORT;
      },
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /xor|graph|machine|flow\/flow\.json|ratifiedGraphSha/i);
  });

  it('honest CLOSED stamp with no graph input fails under automate', () => {
    const r = deliveryAuditAllowsClose({
      planExecutionMode: 'automate',
      deliveryAuditGate: HONEST_CLOSED,
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /flow\/flow\.json|ratifiedGraphSha|graph/i);
  });
});

describe('canRunPhaseDone graph (F4 T-002)', () => {
  const phaseDoneBase = {
    planExecutionMode: 'automate',
    evaluationGate: evalPassed,
    lessonsState: 'none',
    reviewGate: reviewBoth,
    decisionReview: decisionPassed,
    deliveryAuditGate: HONEST_CLOSED,
  };

  it('honest CLOSED without graph input fails under automate', () => {
    const r = canRunPhaseDone(phaseDoneBase);
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /flow\/flow\.json|ratifiedGraphSha|graph/i);
  });

  it('loads flow/flow.json at ratifiedGraphSha when planPath is given', () => {
    const planPath = '/tmp/demo-plan/plan.md';
    const r = canRunPhaseDone({
      ...phaseDoneBase,
      planPath,
      cwd: '/tmp/demo-plan',
      reportContent: SAMPLE_REPORT,
      exists: (p) => String(p).replace(/\\/g, '/').endsWith('flow/flow.json'),
      readFile: (p) => {
        if (String(p).replace(/\\/g, '/').endsWith('flow/flow.json')) {
          return JSON.stringify(XOR_FLOW);
        }
        return SAMPLE_REPORT;
      },
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /xor|graph|machine|flow\/flow\.json|ratifiedGraphSha/i);
  });

  it('allows close when loaded graph coverage is present', () => {
    const r = canRunPhaseDone({
      ...phaseDoneBase,
      flowDoc: XOR_FLOW,
      ratifiedGraphSha: XOR_FLOW.ratifiedGraphSha,
      actualSha: XOR_FLOW.ratifiedGraphSha,
      reportContent: COVERING_REPORT,
    });
    assert.equal(r.ok, true, r.reason);
  });
});
