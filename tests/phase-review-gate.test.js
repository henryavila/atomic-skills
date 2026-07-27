import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  phaseReviewHonesty,
  phaseReviewAllowsClose,
  isDurableAutomateForPhaseReview,
  dualLegReceiptPaths,
  receiptContentAuthenticity,
  phaseReviewAuthenticity,
  PHASE_REVIEW_RECEIPT_MIN_BYTES,
} from '../src/phase-review-gate.js';

/** Dual non-stub body (≥ min bytes, multi-line CLEAN or findings). */
const GOOD_LOCAL = [
  '# Local review',
  '',
  'Verdict: CLEAN',
  '',
  'No findings on the phase range. Cross-check complete.',
  'Scope: src/phase-review-gate.js tests/phase-review-gate.test.js',
].join('\n');

const GOOD_CODEX = [
  '# Codex review',
  '',
  'Findings: none major',
  '',
  'Reviewed dual-leg authenticity floor. Residual notes only.',
  'Files: phase-review-gate authenticity dual-leg non-binary stub floor.',
].join('\n');

assert.ok(Buffer.byteLength(GOOD_LOCAL, 'utf8') >= PHASE_REVIEW_RECEIPT_MIN_BYTES);
assert.ok(Buffer.byteLength(GOOD_CODEX, 'utf8') >= PHASE_REVIEW_RECEIPT_MIN_BYTES);

const bothGate = {
  status: 'passed',
  mode: 'both',
  at: 'a'.repeat(40),
  reviewFile: '.atomic-skills/reviews/f0-both.md',
  localReceiptPath: '.atomic-skills/reviews/f0-local.md',
  codexReceiptPath: '.atomic-skills/reviews/f0-codex.md',
};

const receiptContents = {
  [bothGate.localReceiptPath]: GOOD_LOCAL,
  [bothGate.codexReceiptPath]: GOOD_CODEX,
  [bothGate.reviewFile]: GOOD_LOCAL + '\n\n' + GOOD_CODEX,
};

describe('isDurableAutomateForPhaseReview', () => {
  it('true under stamp', () => {
    assert.equal(isDurableAutomateForPhaseReview({}), false);
    assert.equal(
      isDurableAutomateForPhaseReview({ planExecutionMode: 'automate' }),
      true,
    );
  });
});

describe('dualLegReceiptPaths', () => {
  it('collects local + codex paths', () => {
    const d = dualLegReceiptPaths(bothGate);
    assert.ok(d.paths.length >= 2);
    assert.ok(d.paths.includes(bothGate.localReceiptPath));
    assert.ok(d.paths.includes(bothGate.codexReceiptPath));
  });

  it('collects legs[] paths', () => {
    const d = dualLegReceiptPaths({
      legs: [
        { provider: 'local', receiptPath: 'reviews/a.md' },
        { provider: 'codex', path: 'reviews/b.md' },
      ],
    });
    assert.deepEqual(d.paths, ['reviews/a.md', 'reviews/b.md']);
  });
});

describe('receiptContentAuthenticity', () => {
  it('rejects one-line stub', () => {
    const r = receiptContentAuthenticity('CLEAN\n', { label: 'codex' });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /stub|min size|one-line/i);
  });

  it('rejects null-byte / binary', () => {
    const r = receiptContentAuthenticity(Buffer.from([0x00, 0x01, 0x02, 0x03]), {
      label: 'local',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /binary|null-byte|non-binary/i);
  });

  it('rejects short multi-line without floor', () => {
    const r = receiptContentAuthenticity('ok\nyes\n', { label: 'local' });
    assert.equal(r.ok, false);
  });

  it('accepts dual non-stub CLEAN body', () => {
    assert.equal(receiptContentAuthenticity(GOOD_LOCAL, { label: 'local' }).ok, true);
  });

  it('accepts findings-style body', () => {
    assert.equal(receiptContentAuthenticity(GOOD_CODEX, { label: 'codex' }).ok, true);
  });
});

describe('phaseReviewHonesty', () => {
  it('rejects missing gate', () => {
    assert.equal(phaseReviewHonesty(null).ok, false);
  });

  it('accepts both with at + reviewFile + dual-leg paths', () => {
    assert.equal(phaseReviewHonesty(bothGate).ok, true);
  });

  it('rejects mode both with only single reviewFile (no dual-leg)', () => {
    const r = phaseReviewHonesty({
      status: 'passed',
      mode: 'both',
      at: 'a'.repeat(40),
      reviewFile: '.atomic-skills/reviews/f0-both.md',
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /dual-leg|dual receipt/i);
  });

  it('rejects local without overrideReason', () => {
    assert.equal(
      phaseReviewHonesty({
        status: 'passed',
        mode: 'local',
        at: 'a'.repeat(40),
        reviewFile: '.atomic-skills/reviews/f0.md',
      }).ok,
      false,
    );
  });

  it('accepts local with overrideReason + at + reviewFile', () => {
    assert.equal(
      phaseReviewHonesty({
        status: 'passed',
        mode: 'local',
        at: 'a'.repeat(40),
        reviewFile: '.atomic-skills/reviews/f0.md',
        overrideReason: 'operator explicit downgrade for dogfood range',
      }).ok,
      true,
    );
  });

  it('rejects local with plain reason only (no overrideReason fig leaf)', () => {
    assert.equal(
      phaseReviewHonesty({
        status: 'passed',
        mode: 'local',
        at: 'a'.repeat(40),
        reviewFile: '.atomic-skills/reviews/f0.md',
        reason: 'explicit local override for dogfood',
      }).ok,
      false,
    );
  });

  it('rejects skipped without operatorSkip', () => {
    assert.equal(
      phaseReviewHonesty({
        status: 'skipped',
        reason: 'time pressure',
      }).ok,
      false,
    );
  });

  it('accepts skipped with operatorSkip + reason', () => {
    assert.equal(
      phaseReviewHonesty({
        status: 'skipped',
        operatorSkip: true,
        reason: 'operator accepted skip of phase review',
      }).ok,
      true,
    );
  });

  it('rejects both without reviewFile', () => {
    assert.equal(
      phaseReviewHonesty({
        status: 'passed',
        mode: 'both',
        at: 'a'.repeat(40),
        localReceiptPath: 'a.md',
        codexReceiptPath: 'b.md',
      }).ok,
      false,
    );
  });
});

describe('phaseReviewAuthenticity + phaseReviewAllowsClose', () => {
  it('rejects one-line stub codex under mode both', () => {
    const r = phaseReviewAuthenticity(bothGate, {
      receiptContents: {
        [bothGate.localReceiptPath]: GOOD_LOCAL,
        [bothGate.codexReceiptPath]: 'CLEAN\n',
      },
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /stub|min size|one-line|codex/i);
  });

  it('rejects binary/null-byte receipt content', () => {
    const r = phaseReviewAuthenticity(bothGate, {
      receiptContents: {
        [bothGate.localReceiptPath]: Buffer.from('good\n'.repeat(20) + '\0bad'),
        [bothGate.codexReceiptPath]: GOOD_CODEX,
      },
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /binary|null-byte|non-binary/i);
  });

  it('accepts dual non-stub with min size and CLEAN or findings', () => {
    const r = phaseReviewAuthenticity(bothGate, { receiptContents });
    assert.equal(r.ok, true, r.reason);
  });

  it('inactive non-automate', () => {
    assert.equal(phaseReviewAllowsClose({}).ok, true);
  });

  it('blocks under stamp without gate', () => {
    assert.equal(
      phaseReviewAllowsClose({ planExecutionMode: 'automate' }).ok,
      false,
    );
  });

  it('allows under stamp with dual-leg both gate (shape)', () => {
    assert.equal(
      phaseReviewAllowsClose({
        planExecutionMode: 'automate',
        reviewGate: bothGate,
      }).ok,
      true,
    );
  });

  it('rejects stub when checkAuthenticity content injected under mode both', () => {
    const r = phaseReviewAllowsClose({
      planExecutionMode: 'automate',
      reviewGate: bothGate,
      receiptContents: {
        [bothGate.localReceiptPath]: 'CLEAN\n',
        [bothGate.codexReceiptPath]: 'CLEAN\n',
      },
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /stub|min size|one-line|authenticity/i);
  });

  it('accepts dual authentic content under automate', () => {
    const r = phaseReviewAllowsClose({
      planExecutionMode: 'automate',
      reviewGate: bothGate,
      receiptContents,
    });
    assert.equal(r.ok, true, r.reason);
  });
});
