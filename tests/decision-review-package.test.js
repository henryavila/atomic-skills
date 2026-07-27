import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDecisionPackage,
  NO_DECISIONS_BANNER,
} from '../src/decision-review-package.js';

/** listDecisions-shaped entry (extra fields allowed; package surfaces core five). */
function sampleEntry(overrides = {}) {
  return {
    id: 'dec-1',
    category: 'routing',
    decision: 're-dispatch fix agent',
    why: 'verifier failed post-merge',
    impact: 'task remains open',
    evidencePath: '.atomic-skills/reviews/claim-t1.txt',
    at: '2026-07-26T12:00:00.000Z',
    ...overrides,
  };
}

describe('buildDecisionPackage', () => {
  it('builds package with phaseId path entries empty flag and summaryMarkdown from listDecisions input', () => {
    const entries = [
      sampleEntry(),
      sampleEntry({
        id: 'dec-2',
        category: 'tradeoff',
        decision: 'keep host-thin',
        why: 'pure-maestro law',
        impact: 'no product source from host',
        evidencePath: 'none',
      }),
    ];
    const pkg = buildDecisionPackage({
      phaseId: 'F1',
      path: '.atomic-skills/projects/atomic-skills/demo/decisions/F1.jsonl',
      entries,
    });
    assert.equal(pkg.phaseId, 'F1');
    assert.equal(
      pkg.path,
      '.atomic-skills/projects/atomic-skills/demo/decisions/F1.jsonl',
    );
    assert.equal(pkg.empty, false);
    assert.equal(pkg.entries.length, 2);
    assert.equal(typeof pkg.summaryMarkdown, 'string');
    assert.match(pkg.summaryMarkdown, /F1/);
    assert.match(pkg.summaryMarkdown, /re-dispatch fix agent/);
    assert.match(pkg.summaryMarkdown, /keep host-thin/);
  });

  it('each entry exposes category decision why impact evidencePath', () => {
    const pkg = buildDecisionPackage({
      phaseId: 'F0',
      path: 'decisions/F0.jsonl',
      entries: [sampleEntry()],
    });
    const e = pkg.entries[0];
    assert.equal(e.category, 'routing');
    assert.equal(e.decision, 're-dispatch fix agent');
    assert.equal(e.why, 'verifier failed post-merge');
    assert.equal(e.impact, 'task remains open');
    assert.equal(e.evidencePath, '.atomic-skills/reviews/claim-t1.txt');
    // Package entry contract is the five present fields (may keep id/at as extras)
    for (const field of ['category', 'decision', 'why', 'impact', 'evidencePath']) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(e, field),
        `missing package entry field ${field}`,
      );
    }
  });

  it('empty log yields empty true and explicit no-decisions banner text', () => {
    const pkg = buildDecisionPackage({
      phaseId: 'F2',
      path: 'decisions/F2.jsonl',
      entries: [],
    });
    assert.equal(pkg.empty, true);
    assert.deepEqual(pkg.entries, []);
    assert.equal(pkg.phaseId, 'F2');
    assert.equal(pkg.path, 'decisions/F2.jsonl');
    assert.ok(
      pkg.summaryMarkdown.includes(NO_DECISIONS_BANNER),
      'summaryMarkdown must include NO_DECISIONS_BANNER text',
    );
    assert.match(pkg.summaryMarkdown, /no.?decision/i);
  });

  it('null/undefined entries treated as empty package', () => {
    const a = buildDecisionPackage({ phaseId: 'F3', path: 'x.jsonl' });
    assert.equal(a.empty, true);
    const b = buildDecisionPackage({
      phaseId: 'F3',
      path: 'x.jsonl',
      entries: null,
    });
    assert.equal(b.empty, true);
  });

  it('defaults missing evidencePath on input rows to none in package entries', () => {
    const pkg = buildDecisionPackage({
      phaseId: 'F1',
      path: 'decisions/F1.jsonl',
      entries: [
        {
          category: 'env',
          decision: 'use node test runner',
          why: 'repo standard',
          impact: 'verifier shape fixed',
        },
      ],
    });
    assert.equal(pkg.empty, false);
    assert.equal(pkg.entries[0].evidencePath, 'none');
  });

  it('does not stamp decisionReview PASS (no status field on package)', () => {
    const pkg = buildDecisionPackage({
      phaseId: 'F1',
      path: 'decisions/F1.jsonl',
      entries: [sampleEntry()],
    });
    assert.equal(Object.prototype.hasOwnProperty.call(pkg, 'decisionReview'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(pkg, 'status'), false);
  });
});
