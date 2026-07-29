import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  isStatePath,
  isProductPath,
  productPathsFrom,
  claimPathsFromReport,
  planTreeProductFenceOk,
  normalizeFencePath,
} from '../src/automate-product-fence.js';

describe('path classification', () => {
  it('state paths under .atomic-skills do not trip product', () => {
    assert.equal(isStatePath('.atomic-skills/projects/x/plan.md'), true);
    assert.equal(isProductPath('.atomic-skills/projects/x/plan.md'), false);
    assert.equal(isStatePath('src/foo.js'), false);
    assert.equal(isProductPath('src/foo.js'), true);
    assert.equal(isProductPath('skills/core/implement.md'), true);
  });

  it('normalize strips ./ and backslashes', () => {
    assert.equal(normalizeFencePath('./src/a.js'), 'src/a.js');
    assert.equal(normalizeFencePath('src\\a.js'), 'src/a.js');
  });
});

describe('productPathsFrom', () => {
  it('filters state and empties', () => {
    assert.deepEqual(
      productPathsFrom([
        'src/a.js',
        '.atomic-skills/status/x.json',
        '',
        'docs/kb/x.md',
      ]),
      ['src/a.js', 'docs/kb/x.md'],
    );
  });
});

describe('claimPathsFromReport', () => {
  it('collects paths from tasks[]', () => {
    const paths = claimPathsFromReport({
      tasks: [
        { taskId: 'T-001', paths: ['src/a.js'] },
        { taskId: 'T-002', paths: ['src/b.js', 'src/c.js'] },
      ],
    });
    assert.deepEqual(paths.sort(), ['src/a.js', 'src/b.js', 'src/c.js']);
  });
});

describe('planTreeProductFenceOk', () => {
  it('empty plan-branch product diff returns ok', () => {
    const r = planTreeProductFenceOk({
      planBranchDiffPaths: ['.atomic-skills/projects/x/plan.md'],
      claimPaths: [],
    });
    assert.equal(r.ok, true, r.reason);
  });

  it('empty diff list returns ok', () => {
    assert.equal(planTreeProductFenceOk({ planBranchDiffPaths: [] }).ok, true);
    assert.equal(planTreeProductFenceOk({}).ok, true);
  });

  it('product path without claim coverage returns ok false with reason', () => {
    const r = planTreeProductFenceOk({
      planBranchDiffPaths: ['src/host-coded.js', '.atomic-skills/status/y.json'],
      claimPaths: ['src/other.js'],
    });
    assert.equal(r.ok, false);
    assert.match(r.reason || '', /product fence|not covered/i);
    assert.ok(r.uncovered?.includes('src/host-coded.js'));
  });

  it('product path covered by claim paths returns ok true', () => {
    const r = planTreeProductFenceOk({
      planBranchDiffPaths: ['src/a.js', 'src/b.js'],
      claimPaths: ['src/a.js', 'src/b.js', 'tests/a.test.js'],
    });
    assert.equal(r.ok, true, r.reason);
  });

  it('coverage from claimReport.paths', () => {
    const r = planTreeProductFenceOk({
      planBranchDiffPaths: ['src/a.js'],
      claimReport: {
        tasks: [{ taskId: 'T-001', paths: ['src/a.js'] }],
      },
    });
    assert.equal(r.ok, true, r.reason);
  });

  it('state paths in diff never fail fence alone', () => {
    const r = planTreeProductFenceOk({
      planBranchDiffPaths: [
        '.atomic-skills/projects/p/plan.md',
        '.atomic-skills/status/automate/x.json',
      ],
      claimPaths: [],
    });
    assert.equal(r.ok, true, r.reason);
  });
});
