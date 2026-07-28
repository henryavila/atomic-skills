import test from 'node:test';
import assert from 'node:assert/strict';
import {
  groundTruthReceiptGap,
  groundTruthGapMessage,
  isValidGroundTruthStatus,
  parseGroundTruthReceiptLine,
  groundTruthSectionGap,
  planSubstanceText,
  fingerprintSubstance,
  assessGroundTruthPlanFile,
  stripReceiptSections,
} from '../src/ground-truth-review.js';

function sectionBody(status = 'complete') {
  return `
## Ground-truth review

**Status:** ${status}
**Codebase class:** populated
**Scanned:** src/ → 12 files
**Commit:** a1b2c3d
**At:** 2026-07-28T12:00:00Z

### A — Plan premises vs code

| # | Premise | Result | Evidence |
|---|---------|--------|----------|
| 1 | src/foo.js exists | ok | src/foo.js:1 |

### B — Code present, plan silent (impact candidates)

| # | Finding | Location | Impact | Disposition |
|---|---------|----------|--------|-------------|
| — | none | — | none | n/a |

**Counts:** premises=1 (missing=0, false=0); impacts=0
`.trim();
}

function fullPlanRaw(status, fp, extraBody = '') {
  const body = `${extraBody}\n\n${sectionBody(status)}\n\n## Reviews\n\n- internal: zero findings @ a1b2c3d (2026-07-28T12:00:00Z)\n- ground-truth: ${status} | mode=ground-truth | fp=${fp} | premises=1 | impacts=0 @ a1b2c3d (2026-07-28T12:00:00Z)\n`;
  return `---\nschemaVersion: '0.1'\nslug: demo\ntitle: demo\nstatus: active\nlastUpdated: '2026-07-28T12:00:00Z'\n---\n${body}`;
}

function freshPlan() {
  // Build without fp first to compute substance, then stamp
  const draft = fullPlanRaw('complete', 'PLACEHOLDER');
  const { fingerprint } = assessGroundTruthPlanFile(draft.replace(/fp=PLACEHOLDER/, 'fp=deadbeefdead'));
  // Recompute with final body that will use real fp - use two-pass
  const withFp = fullPlanRaw('complete', fingerprint);
  // fingerprint of withFp should match because fp is in Reviews which is stripped
  const assessed = assessGroundTruthPlanFile(withFp);
  return { raw: withFp, fingerprint: assessed.fingerprint, assessed };
}

test('isValidGroundTruthStatus accepts complete family', () => {
  assert.equal(isValidGroundTruthStatus('complete'), true);
  assert.equal(isValidGroundTruthStatus('complete-empty-repo'), true);
  assert.equal(isValidGroundTruthStatus('complete-with-findings'), true);
  assert.equal(isValidGroundTruthStatus('ok'), true);
  assert.equal(isValidGroundTruthStatus('skipped'), false);
});

test('parseGroundTruthReceiptLine extracts mode + fp', () => {
  const parsed = parseGroundTruthReceiptLine([
    '- ground-truth: complete | mode=ground-truth | fp=abc123def456 | premises=2 @ abc (2026-07-28T12:00:00Z)',
  ]);
  assert.ok(parsed);
  assert.equal(parsed.statusToken, 'complete');
  assert.equal(parsed.hasModeToken, true);
  assert.equal(parsed.fingerprint, 'abc123def456');
});

test('stripReceiptSections removes Reviews and Ground-truth', () => {
  const s = stripReceiptSections('# T\n\nhello\n\n## Ground-truth review\n\nx\n\n## Reviews\n\n- y\n\n## Other\n\nz\n');
  assert.match(s, /hello/);
  assert.match(s, /## Other/);
  assert.doesNotMatch(s, /Ground-truth/);
  assert.doesNotMatch(s, /## Reviews/);
});

test('fingerprint ignores lastUpdated and receipt sections', () => {
  const a = planSubstanceText(`---\nslug: x\nlastUpdated: '1'\n---\nbody\n\n## Reviews\n\n- n\n`);
  const b = planSubstanceText(`---\nslug: x\nlastUpdated: '2'\n---\nbody\n\n## Reviews\n\n- different\n`);
  assert.equal(fingerprintSubstance(a), fingerprintSubstance(b));
});

test('assessGroundTruthPlanFile: fresh full receipt passes', () => {
  const { assessed } = freshPlan();
  assert.equal(assessed.gap, null, groundTruthGapMessage(assessed.gap));
  assert.equal(assessed.fingerprint.length, 12);
});

test('groundTruthReceiptGap: missing mode token', () => {
  const body = `${sectionBody()}\n\n## Reviews\n\n- ground-truth: complete | fp=abc123def456 @ a (2026-07-28T12:00:00Z)\n`;
  assert.equal(groundTruthReceiptGap(body), 'no-ground-truth-mode-token');
});

test('groundTruthReceiptGap: missing fp token', () => {
  const body = `${sectionBody()}\n\n## Reviews\n\n- ground-truth: complete | mode=ground-truth @ a (2026-07-28T12:00:00Z)\n`;
  assert.equal(groundTruthReceiptGap(body), 'no-ground-truth-fingerprint');
});

test('groundTruthReceiptGap: stale fp', () => {
  const body = `${sectionBody()}\n\n## Reviews\n\n- ground-truth: complete | mode=ground-truth | fp=aaaaaaaaaaaa @ a (2026-07-28T12:00:00Z)\n`;
  assert.equal(
    groundTruthReceiptGap(body, { currentFingerprint: 'bbbbbbbbbbbb' }),
    'stale-ground-truth-receipt',
  );
});

test('assessGroundTruthPlanFile: substance change → stale', () => {
  const { raw, fingerprint } = freshPlan();
  assert.equal(assessGroundTruthPlanFile(raw).gap, null);
  const mutated = raw.replace('title: demo', 'title: demo-CHANGED');
  // Wait - title is in frontmatter - if we only have slug in freshPlan... we have title: demo
  const assessed = assessGroundTruthPlanFile(mutated);
  assert.equal(assessed.gap, 'stale-ground-truth-receipt');
  assert.notEqual(assessed.fingerprint, fingerprint);
});

test('groundTruthSectionGap: thin without Scanned/Counts', () => {
  const thin = [
    '## Ground-truth review',
    '**Status:** complete',
    '### A — Plan premises vs code',
    'something',
    '### B — Code present',
    'else',
  ];
  assert.equal(groundTruthSectionGap(thin), 'thin-ground-truth-section');
});

test('groundTruthSectionGap: full content floor ok', () => {
  assert.equal(groundTruthSectionGap(sectionBody().split('\n')), null);
});

test('groundTruthReceiptGap: line without section', () => {
  const body = `## Reviews\n\n- ground-truth: complete | mode=ground-truth | fp=abc123def456 @ abc (2026-07-28T12:00:00Z)\n`;
  assert.equal(groundTruthReceiptGap(body), 'no-ground-truth-section');
});

test('groundTruthReceiptGap: section missing B', () => {
  const body = `
## Ground-truth review

**Status:** complete
**Scanned:** src/ → 1
**Counts:** premises=0

### A — Plan premises vs code

| # | Premise | Result | Evidence |
|---|---------|--------|----------|
| — | none | ok | n/a |

## Reviews

- ground-truth: complete | mode=ground-truth | fp=abc123def456 @ abc (2026-07-28T12:00:00Z)
`;
  assert.equal(groundTruthReceiptGap(body), 'incomplete-ground-truth-section');
});

test('groundTruthGapMessage covers new reasons', () => {
  assert.match(groundTruthGapMessage('stale-ground-truth-receipt'), /stale/i);
  assert.match(groundTruthGapMessage('thin-ground-truth-section'), /thin|Scanned/i);
  assert.match(groundTruthGapMessage('no-ground-truth-fingerprint'), /fp=/);
});
