import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { phaseReviewMode, PHASE_REVIEW_MODES } from '../src/phase-review-mode.js';

describe('phaseReviewMode — automate override + DESTRUCTIVE ladder', () => {
  it('exports frozen mode tokens including local, both, skip', () => {
    assert.ok(PHASE_REVIEW_MODES.includes('local'));
    assert.ok(PHASE_REVIEW_MODES.includes('both'));
    assert.ok(PHASE_REVIEW_MODES.includes('skip'));
    assert.throws(() => {
      // @ts-expect-error frozen
      PHASE_REVIEW_MODES.push('hack');
    });
  });

  it('when isAutomateActive is true, default is both regardless of DESTRUCTIVE', () => {
    assert.equal(
      phaseReviewMode({ automateActive: true, destructive: false }),
      'both',
    );
    assert.equal(
      phaseReviewMode({ automateActive: true, destructive: true }),
      'both',
    );
    assert.equal(
      phaseReviewMode({ automateActive: true, destructive: undefined }),
      'both',
    );
  });

  it('non-automate path still uses both only when DESTRUCTIVE else local', () => {
    assert.equal(
      phaseReviewMode({ automateActive: false, destructive: true }),
      'both',
    );
    assert.equal(
      phaseReviewMode({ automateActive: false, destructive: false }),
      'local',
    );
    assert.equal(
      phaseReviewMode({ automateActive: false, destructive: undefined }),
      'local',
    );
    assert.equal(
      phaseReviewMode({ destructive: true }),
      'both',
    );
    assert.equal(
      phaseReviewMode({ destructive: false }),
      'local',
    );
    assert.equal(phaseReviewMode({}), 'local');
  });

  it('explicit local override remains recordable (downgrade, not full skip)', () => {
    assert.equal(
      phaseReviewMode({
        automateActive: true,
        destructive: true,
        explicitOverride: 'local',
      }),
      'local',
    );
    assert.equal(
      phaseReviewMode({
        automateActive: false,
        destructive: true,
        explicitOverride: 'local',
      }),
      'local',
    );
  });

  it('explicit both override is accepted', () => {
    assert.equal(
      phaseReviewMode({
        automateActive: false,
        destructive: false,
        explicitOverride: 'both',
      }),
      'both',
    );
  });

  it('skip-review remains the only full skip', () => {
    assert.equal(
      phaseReviewMode({
        automateActive: true,
        destructive: true,
        explicitOverride: 'skip',
      }),
      'skip',
    );
    assert.equal(
      phaseReviewMode({
        automateActive: false,
        destructive: false,
        explicitOverride: 'skip',
      }),
      'skip',
    );
  });

  it('unknown or blank explicitOverride falls through to automate/destructive defaults', () => {
    assert.equal(
      phaseReviewMode({
        automateActive: true,
        destructive: false,
        explicitOverride: 'codex',
      }),
      'both',
    );
    assert.equal(
      phaseReviewMode({
        automateActive: false,
        destructive: true,
        explicitOverride: '',
      }),
      'both',
    );
    assert.equal(
      phaseReviewMode({
        automateActive: false,
        destructive: false,
        explicitOverride: null,
      }),
      'local',
    );
    assert.equal(
      phaseReviewMode({
        automateActive: false,
        destructive: false,
        explicitOverride: '  LOCAL  ',
      }),
      'local',
    );
  });

  it('precedence matrix: explicitOverride > automateActive > destructive', () => {
    /** @type {Array<{input: Parameters<typeof phaseReviewMode>[0], want: string}>} */
    const matrix = [
      { input: {}, want: 'local' },
      { input: { destructive: true }, want: 'both' },
      { input: { automateActive: true }, want: 'both' },
      { input: { automateActive: true, destructive: false }, want: 'both' },
      { input: { automateActive: false, destructive: true }, want: 'both' },
      { input: { automateActive: false, destructive: false }, want: 'local' },
      {
        input: { automateActive: true, destructive: true, explicitOverride: 'local' },
        want: 'local',
      },
      {
        input: { automateActive: true, destructive: false, explicitOverride: 'skip' },
        want: 'skip',
      },
      {
        input: { automateActive: false, destructive: false, explicitOverride: 'both' },
        want: 'both',
      },
    ];
    for (const row of matrix) {
      assert.equal(
        phaseReviewMode(row.input),
        row.want,
        `phaseReviewMode(${JSON.stringify(row.input)})`,
      );
    }
  });
});
