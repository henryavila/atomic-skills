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

  it('F3: stamp alone (planExecutionMode automate, no automateActive) → both', () => {
    assert.equal(
      phaseReviewMode({ planExecutionMode: 'automate' }),
      'both',
    );
    assert.equal(
      phaseReviewMode({ planExecutionMode: 'automate', destructive: false }),
      'both',
    );
    assert.notEqual(
      phaseReviewMode({ planExecutionMode: 'automate' }),
      'local',
      'omitted automateActive with stamp must not return local',
    );
  });

  it('F3: under automate, local/skip without overrideReason → both', () => {
    assert.equal(
      phaseReviewMode({
        automateActive: true,
        destructive: true,
        explicitOverride: 'local',
      }),
      'both',
    );
    assert.equal(
      phaseReviewMode({
        planExecutionMode: 'automate',
        explicitOverride: 'skip',
      }),
      'both',
    );
  });

  it('F3: under automate, local/skip with non-empty overrideReason is honored', () => {
    assert.equal(
      phaseReviewMode({
        automateActive: true,
        destructive: true,
        explicitOverride: 'local',
        overrideReason: 'operator accepted local-only residual risk',
      }),
      'local',
    );
    assert.equal(
      phaseReviewMode({
        automateActive: true,
        explicitOverride: 'skip',
        overrideReason: 'no external provider available',
      }),
      'skip',
    );
  });

  it('explicit local override remains recordable outside automate (downgrade, not full skip)', () => {
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

  it('skip-review outside automate remains full skip without reason requirement', () => {
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

  it('precedence matrix: stamp/automate + overrideReason rules', () => {
    /** @type {Array<{input: Parameters<typeof phaseReviewMode>[0], want: string}>} */
    const matrix = [
      { input: {}, want: 'local' },
      { input: { destructive: true }, want: 'both' },
      { input: { automateActive: true }, want: 'both' },
      { input: { automateActive: true, destructive: false }, want: 'both' },
      { input: { automateActive: false, destructive: true }, want: 'both' },
      { input: { automateActive: false, destructive: false }, want: 'local' },
      { input: { planExecutionMode: 'automate' }, want: 'both' },
      {
        input: { automateActive: true, destructive: true, explicitOverride: 'local' },
        want: 'both',
      },
      {
        input: {
          automateActive: true,
          explicitOverride: 'local',
          overrideReason: 'accepted',
        },
        want: 'local',
      },
      {
        input: {
          automateActive: true,
          explicitOverride: 'skip',
          overrideReason: 'accepted',
        },
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
