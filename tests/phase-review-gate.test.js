import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  phaseReviewHonesty,
  phaseReviewAllowsClose,
  isDurableAutomateForPhaseReview,
} from '../src/phase-review-gate.js';

const bothGate = {
  status: 'passed',
  mode: 'both',
  at: 'a'.repeat(40),
  reviewFile: '.atomic-skills/reviews/f0-both.md',
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

describe('phaseReviewHonesty', () => {
  it('rejects missing gate', () => {
    assert.equal(phaseReviewHonesty(null).ok, false);
  });

  it('accepts both with at + reviewFile', () => {
    assert.equal(phaseReviewHonesty(bothGate).ok, true);
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
      }).ok,
      false,
    );
  });
});

describe('phaseReviewAllowsClose', () => {
  it('inactive non-automate', () => {
    assert.equal(phaseReviewAllowsClose({}).ok, true);
  });

  it('blocks under stamp without gate', () => {
    assert.equal(
      phaseReviewAllowsClose({ planExecutionMode: 'automate' }).ok,
      false,
    );
  });

  it('allows under stamp with both gate', () => {
    assert.equal(
      phaseReviewAllowsClose({
        planExecutionMode: 'automate',
        reviewGate: bothGate,
      }).ok,
      true,
    );
  });
});
