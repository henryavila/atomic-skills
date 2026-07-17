import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { isComplexTask, COMPLEX_TAGS, DEFAULT_COMPLEX_WEIGHT_THRESHOLD } from '../src/complex-task.js';

describe('isComplexTask', () => {
  it('returns true when weight >= threshold default 3', () => {
    assert.equal(isComplexTask({ weight: 3 }), true);
    assert.equal(isComplexTask({ weight: 4 }), true);
    assert.equal(isComplexTask({ weight: 10 }), true);
    assert.equal(isComplexTask({ weight: 2 }), false);
    assert.equal(isComplexTask({ weight: 0 }), false);
  });

  it('returns true when tags include destructive | decommission | drop | complex', () => {
    for (const tag of ['destructive', 'decommission', 'drop', 'complex']) {
      assert.equal(
        isComplexTask({ tags: [tag] }),
        true,
        `tag ${tag}`,
      );
    }
    assert.equal(isComplexTask({ tags: ['feature', 'destructive', 'ui'] }), true);
    assert.equal(isComplexTask({ tags: ['DESTRUCTIVE'] }), true);
    assert.equal(isComplexTask({ tags: ['feature', 'docs'] }), false);
  });

  it('returns true when destructiveDiff flag is true', () => {
    assert.equal(isComplexTask({ destructiveDiff: true }), true);
    assert.equal(isComplexTask({ weight: 1, tags: [], destructiveDiff: true }), true);
  });

  it('weightless + no tags + destructiveDiff false → false', () => {
    assert.equal(isComplexTask({}), false);
    assert.equal(isComplexTask({ tags: [] }), false);
    assert.equal(isComplexTask({ weight: undefined, tags: [], destructiveDiff: false }), false);
    assert.equal(isComplexTask({ destructiveDiff: false }), false);
  });

  it('threshold is overridable via options', () => {
    assert.equal(isComplexTask({ weight: 2 }, { threshold: 2 }), true);
    assert.equal(isComplexTask({ weight: 2 }, { threshold: 3 }), false);
    assert.equal(isComplexTask({ weight: 5 }, { threshold: 10 }), false);
    assert.equal(isComplexTask({ weight: 5 }, { threshold: 5 }), true);
  });

  it('OR semantics: any single signal is enough', () => {
    assert.equal(isComplexTask({ weight: 3, tags: [], destructiveDiff: false }), true);
    assert.equal(isComplexTask({ weight: 1, tags: ['drop'], destructiveDiff: false }), true);
    assert.equal(isComplexTask({ weight: 1, tags: [], destructiveDiff: true }), true);
  });

  it('exports frozen COMPLEX_TAGS and default threshold 3', () => {
    assert.equal(DEFAULT_COMPLEX_WEIGHT_THRESHOLD, 3);
    assert.ok(COMPLEX_TAGS.includes('destructive'));
    assert.ok(COMPLEX_TAGS.includes('decommission'));
    assert.ok(COMPLEX_TAGS.includes('drop'));
    assert.ok(COMPLEX_TAGS.includes('complex'));
    assert.throws(() => {
      // @ts-expect-error frozen
      COMPLEX_TAGS.push('hack');
    });
  });

  it('ignores non-array tags and non-numeric weight safely', () => {
    assert.equal(isComplexTask({ weight: 'nope', tags: null }), false);
    assert.equal(isComplexTask({ weight: NaN }), false);
    assert.equal(isComplexTask({ tags: 'complex' }), false);
  });

  it('coerces finite numeric string weight the same way as threshold', () => {
    assert.equal(isComplexTask({ weight: '3' }), true);
    assert.equal(isComplexTask({ weight: '4' }), true);
    assert.equal(isComplexTask({ weight: '2' }), false);
    assert.equal(isComplexTask({ weight: '3.0' }), true);
    assert.equal(isComplexTask({ weight: ' 3 ' }), true);
  });
});
