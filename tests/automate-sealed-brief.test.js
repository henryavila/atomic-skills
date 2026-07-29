import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildPhaseWorkOrder } from '../src/automate-work-order.js';
import {
  buildSealedBrief,
  validateSealedBriefShape,
  defaultClaimReportPath,
  codeOnlyFenceText,
} from '../src/automate-sealed-brief.js';

function sampleOrder() {
  return buildPhaseWorkOrder({
    planSlug: 'automate-writer-runtime',
    phaseId: 'F1',
    tasks: [
      {
        id: 'T-003',
        title: 'Builders',
        status: 'pending',
        outputs: [{ path: 'src/automate-work-order.js' }],
        scopeBoundary: ['Do not spawn'],
        acceptance: ['unit tests pass'],
        verifier: {
          kind: 'shell',
          command: 'node --test tests/automate-work-order.test.js',
          expectExitCode: 0,
        },
      },
    ],
    worktreePath: '/tmp/sibling-wt',
    writerBranch: 'impl/automate-writer-runtime-F1-writer',
    baseRef: 'abc',
  });
}

describe('defaultClaimReportPath', () => {
  it('uses status/automate path', () => {
    assert.equal(
      defaultClaimReportPath('my-plan'),
      '.atomic-skills/status/automate/my-plan-claims.json',
    );
  });
});

describe('codeOnlyFenceText', () => {
  it('forbids done and durable state writes', () => {
    const t = codeOnlyFenceText();
    assert.match(t, /MUST NOT/i);
    assert.match(t, /done/i);
    assert.match(t, /\.atomic-skills/i);
  });
});

describe('buildSealedBrief', () => {
  it('includes code-only fence, work-order, claim-report shape; excludes host chat', () => {
    const brief = buildSealedBrief({
      workOrder: sampleOrder(),
      claimReportPath: '.atomic-skills/status/automate/automate-writer-runtime-claims.json',
    });
    assert.match(brief, /Code-only fence/i);
    assert.match(brief, /T-003/);
    assert.match(brief, /src\/automate-work-order\.js/);
    assert.match(brief, /Claim report/i);
    assert.match(brief, /claimed-pass/);
    assert.match(brief, /host-chat-history:\s*excluded/i);
    assert.doesNotMatch(brief, /here is the full maestro session transcript/i);
    assert.doesNotMatch(brief, /user said: please also refactor/i);

    const shape = validateSealedBriefShape(brief);
    assert.equal(shape.ok, true, shape.errors?.join('; '));
  });

  it('requires workOrder with planSlug/phaseId', () => {
    assert.throws(() => buildSealedBrief({}), /workOrder/);
    assert.throws(
      () => buildSealedBrief({ workOrder: { planSlug: 'x', tasks: [] } }),
      /phaseId/,
    );
  });

  it('may attach scoped extraContext without looking like chat history marker violation', () => {
    const brief = buildSealedBrief({
      workOrder: sampleOrder(),
      extraContext: 'File excerpt src/foo.js lines 1-10: export function foo() {}',
    });
    assert.match(brief, /Scoped context/);
    assert.match(brief, /export function foo/);
    assert.match(brief, /host-chat-history:\s*excluded/);
  });
});
