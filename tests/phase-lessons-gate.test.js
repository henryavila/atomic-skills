import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  phaseLessonsHonesty,
  phaseLessonsAllowsClose,
  buildLessonsState,
  isDurableAutomateForLessons,
} from '../src/phase-lessons-gate.js';

describe('isDurableAutomateForLessons', () => {
  it('true only under durable stamp / automateActive', () => {
    assert.equal(isDurableAutomateForLessons({}), false);
    assert.equal(
      isDurableAutomateForLessons({ planExecutionMode: 'automate' }),
      true,
    );
    assert.equal(isDurableAutomateForLessons({ automateActive: true }), true);
  });
});

describe('phaseLessonsHonesty', () => {
  it('rejects omit (silence ≠ answer)', () => {
    assert.equal(phaseLessonsHonesty({}).ok, false);
    assert.match(phaseLessonsHonesty({}).reason || '', /lessonsState/);
  });

  it('accepts none', () => {
    assert.equal(phaseLessonsHonesty({ lessonsState: 'none' }).ok, true);
  });

  it('rejects recorded without path', () => {
    assert.equal(
      phaseLessonsHonesty({ lessonsState: 'recorded' }).ok,
      false,
    );
  });

  it('accepts recorded with path', () => {
    assert.equal(
      phaseLessonsHonesty({
        lessonsState: 'recorded',
        lessonsPath: '.atomic-skills/projects/x/y/lessons/f0.md',
      }).ok,
      true,
    );
  });
});

describe('phaseLessonsAllowsClose', () => {
  it('inactive when non-automate', () => {
    assert.equal(phaseLessonsAllowsClose({}).ok, true);
  });

  it('blocks under stamp when omitted', () => {
    assert.equal(
      phaseLessonsAllowsClose({ planExecutionMode: 'automate' }).ok,
      false,
    );
  });

  it('reads phase slice fields', () => {
    assert.equal(
      phaseLessonsAllowsClose({
        planExecutionMode: 'automate',
        phase: { lessonsState: 'none' },
      }).ok,
      true,
    );
  });
});

describe('buildLessonsState', () => {
  it('builds none', () => {
    const s = buildLessonsState({ lessonsState: 'none' });
    assert.equal(s.lessonsState, 'none');
  });

  it('builds recorded with path', () => {
    const s = buildLessonsState({
      lessonsState: 'recorded',
      lessonsPath: 'lessons/f0.md',
    });
    assert.equal(s.lessonsPath, 'lessons/f0.md');
  });

  it('throws recorded without path', () => {
    assert.throws(
      () => buildLessonsState({ lessonsState: 'recorded' }),
      /lessonsPath/,
    );
  });
});
