import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { normalizeSlug, editDistance, SOURCE_TYPE_WEIGHTS, calculateConfidence } from '../src/bootstrap.js';

describe('normalizeSlug', () => {
  it('lowercases and kebab-cases simple input', () => {
    assert.equal(normalizeSlug('AsReviewCode'), 'as-review-code');
  });

  it('strips common branch prefixes', () => {
    assert.equal(normalizeSlug('feat/as-review-code'), 'as-review-code');
    assert.equal(normalizeSlug('fix/bug-123'), 'bug-123');
    assert.equal(normalizeSlug('refactor/old-auth'), 'old-auth');
    assert.equal(normalizeSlug('chore/bump-deps'), 'bump-deps');
    assert.equal(normalizeSlug('docs/readme'), 'readme');
    assert.equal(normalizeSlug('test/unit-helpers'), 'unit-helpers');
  });

  it('strips date prefixes from doc filenames', () => {
    assert.equal(normalizeSlug('2026-04-10-as-review-code.md'), 'as-review-code');
    assert.equal(normalizeSlug('2025-12-31-bug-fix'), 'bug-fix');
  });

  it('strips leading articles', () => {
    assert.equal(normalizeSlug('The Review Skill'), 'review-skill');
    assert.equal(normalizeSlug('a-tool'), 'tool');
  });

  it('collapses whitespace and underscores to single hyphen', () => {
    assert.equal(normalizeSlug('review__code  skill'), 'review-code-skill');
  });

  it('removes non-alphanumeric chars except hyphens', () => {
    assert.equal(normalizeSlug('review (code)!'), 'review-code');
  });

  it('truncates to 40 chars', () => {
    assert.equal(
      normalizeSlug('a'.repeat(50)),
      'a'.repeat(40)
    );
  });

  it('removes trailing hyphens after truncation', () => {
    assert.equal(normalizeSlug('abc-def-ghi-'), 'abc-def-ghi');
  });

  it('returns empty string for non-normalizable input', () => {
    assert.equal(normalizeSlug(''), '');
    assert.equal(normalizeSlug('!@#'), '');
    assert.equal(normalizeSlug(null), '');
    assert.equal(normalizeSlug(undefined), '');
    assert.equal(normalizeSlug(42), '');
  });

  it('leaves digit-leading slugs unchanged (caller validates against spec regex)', () => {
    // Caller is responsible for checking the spec-compliant regex ^[a-z][a-z0-9-]{1,39}$
    // This function normalizes but does NOT validate.
    assert.equal(normalizeSlug('123-feature'), '123-feature');
    assert.equal(normalizeSlug('42'), '42');
  });

  it('converts remaining slashes to hyphens after prefix strip', () => {
    assert.equal(normalizeSlug('feat/org/feature'), 'org-feature');
    assert.equal(normalizeSlug('owner/repo'), 'owner-repo');
  });
});

describe('editDistance', () => {
  it('returns 0 for identical strings', () => {
    assert.equal(editDistance('abc', 'abc'), 0);
  });

  it('returns length of other string when one is empty', () => {
    assert.equal(editDistance('', 'hello'), 5);
    assert.equal(editDistance('world', ''), 5);
  });

  it('counts single substitution', () => {
    assert.equal(editDistance('cat', 'bat'), 1);
  });

  it('counts single insertion', () => {
    assert.equal(editDistance('cat', 'cats'), 1);
  });

  it('counts single deletion', () => {
    assert.equal(editDistance('cats', 'cat'), 1);
  });

  it('handles multiple edits', () => {
    assert.equal(editDistance('kitten', 'sitting'), 3);
  });

  it('handles slug-like strings', () => {
    assert.equal(editDistance('as-review-code', 'as-review-cod'), 1);
    assert.equal(editDistance('as-review-code', 'as-reviews-code'), 1);
  });
});

describe('SOURCE_TYPE_WEIGHTS', () => {
  it('covers all 13 source types from spec §15.1', () => {
    const expected = [
      'git-branch', 'github-pr-open', 'github-pr-merged-recent',
      'github-issue-open-mine', 'commit-group',
      'doc-plan', 'doc-spec', 'doc-adr', 'roadmap-section',
      'memory-local-entry', 'memory-local-orphan',
      'memory-claude-auto', 'claude-mem-obs',
    ];
    const actual = Object.keys(SOURCE_TYPE_WEIGHTS).sort();
    assert.deepEqual(actual, expected.sort());
  });

  it('assigns specific weights per spec §15.1', () => {
    assert.equal(SOURCE_TYPE_WEIGHTS['git-branch'], 0.30);
    assert.equal(SOURCE_TYPE_WEIGHTS['github-pr-open'], 0.30);
    assert.equal(SOURCE_TYPE_WEIGHTS['github-pr-merged-recent'], 0.05);
    assert.equal(SOURCE_TYPE_WEIGHTS['github-issue-open-mine'], 0.15);
    assert.equal(SOURCE_TYPE_WEIGHTS['commit-group'], 0.05);
    assert.equal(SOURCE_TYPE_WEIGHTS['doc-plan'], 0.20);
    assert.equal(SOURCE_TYPE_WEIGHTS['doc-spec'], 0.20);
    assert.equal(SOURCE_TYPE_WEIGHTS['doc-adr'], 0.15);
    assert.equal(SOURCE_TYPE_WEIGHTS['roadmap-section'], 0.15);
    assert.equal(SOURCE_TYPE_WEIGHTS['memory-local-entry'], 0.10);
    assert.equal(SOURCE_TYPE_WEIGHTS['memory-local-orphan'], 0.05);
    assert.equal(SOURCE_TYPE_WEIGHTS['memory-claude-auto'], 0.10);
    assert.equal(SOURCE_TYPE_WEIGHTS['claude-mem-obs'], 0.10);
  });
});

describe('calculateConfidence', () => {
  it('returns 0 for empty cluster', () => {
    assert.equal(calculateConfidence({ members: [] }), 0);
  });

  it('sums weights for distinct types (one per type)', () => {
    const cluster = {
      members: [
        { source_type: 'git-branch' },
        { source_type: 'github-pr-open' },
        { source_type: 'doc-plan' },
      ],
    };
    // 0.30 + 0.30 + 0.20 = 0.80
    assert.equal(calculateConfidence(cluster), 0.80);
  });

  it('counts each type only once even with multiple members of same type', () => {
    const cluster = {
      members: [
        { source_type: 'doc-plan' },
        { source_type: 'doc-plan' }, // duplicate type — should not double-count
        { source_type: 'git-branch' },
      ],
    };
    // 0.20 + 0.30 = 0.50
    assert.equal(calculateConfidence(cluster), 0.50);
  });

  it('caps at 1.0', () => {
    const cluster = {
      members: Object.keys(SOURCE_TYPE_WEIGHTS).map((t) => ({ source_type: t })),
    };
    assert.equal(calculateConfidence(cluster), 1.0);
  });

  it('ignores unknown source types', () => {
    const cluster = {
      members: [
        { source_type: 'git-branch' },
        { source_type: 'unknown-type' },
      ],
    };
    assert.equal(calculateConfidence(cluster), 0.30);
  });
});

import { classifyBucket } from '../src/bootstrap.js';

describe('classifyBucket', () => {
  const now = new Date('2026-04-23T12:00:00Z');
  const daysAgo = (d) => new Date(now.getTime() - d * 86400000).toISOString();

  it('returns strong for cluster with recent git-branch (<30d)', () => {
    const cluster = {
      members: [{ source_type: 'git-branch', last_activity: daysAgo(5) }],
    };
    assert.equal(classifyBucket(cluster, now), 'strong');
  });

  it('returns strong for cluster with open PR', () => {
    const cluster = {
      members: [{ source_type: 'github-pr-open', last_activity: daysAgo(45) }],
    };
    assert.equal(classifyBucket(cluster, now), 'strong');
  });

  it('returns strong for ≥3 distinct types with at least 1 active <60d', () => {
    const cluster = {
      members: [
        { source_type: 'doc-plan', last_activity: daysAgo(100) },
        { source_type: 'roadmap-section', last_activity: daysAgo(100) },
        { source_type: 'memory-claude-auto', last_activity: daysAgo(45) },
      ],
    };
    assert.equal(classifyBucket(cluster, now), 'strong');
  });

  it('returns historical for merged branch + closed PR + no recent activity', () => {
    const cluster = {
      members: [
        { source_type: 'github-pr-merged-recent', last_activity: daysAgo(250) },
      ],
      completion_evidence: { branch_merged: true, pr_closed: true },
    };
    assert.equal(classifyBucket(cluster, now), 'historical');
  });

  it('returns historical for old plan doc (>6mo) with no activity since', () => {
    const cluster = {
      members: [{ source_type: 'doc-plan', last_activity: daysAgo(200) }],
      completion_evidence: { stale_plan: true },
    };
    assert.equal(classifyBucket(cluster, now), 'historical');
  });

  it('returns worth-reviewing for plan-only cluster without completion evidence', () => {
    const cluster = {
      members: [{ source_type: 'doc-plan', last_activity: daysAgo(90) }],
    };
    assert.equal(classifyBucket(cluster, now), 'worth-reviewing');
  });

  it('returns worth-reviewing for branch with 45d-old activity (neither strong nor historical)', () => {
    const cluster = {
      members: [{ source_type: 'git-branch', last_activity: daysAgo(45) }],
    };
    assert.equal(classifyBucket(cluster, now), 'worth-reviewing');
  });

  it('returns worth-reviewing for memory-only cluster', () => {
    const cluster = {
      members: [{ source_type: 'claude-mem-obs', last_activity: daysAgo(30) }],
    };
    assert.equal(classifyBucket(cluster, now), 'worth-reviewing');
  });
});

import { clusterByExactSlug } from '../src/bootstrap.js';

describe('clusterByExactSlug', () => {
  it('returns empty arrays for empty input', () => {
    const result = clusterByExactSlug([]);
    assert.deepEqual(result, { clusters: [], unmatched: [] });
  });

  it('creates one cluster per unique slug', () => {
    const signals = [
      { id: 'a', slug: 'as-review' },
      { id: 'b', slug: 'install-helper' },
    ];
    const { clusters, unmatched } = clusterByExactSlug(signals);
    assert.equal(clusters.length, 2);
    assert.equal(unmatched.length, 0);
  });

  it('groups signals with identical slug', () => {
    const signals = [
      { id: 'a', slug: 'as-review' },
      { id: 'b', slug: 'as-review' },
      { id: 'c', slug: 'other' },
    ];
    const { clusters } = clusterByExactSlug(signals);
    assert.equal(clusters.length, 2);
    const asReview = clusters.find((c) => c.slug === 'as-review');
    assert.equal(asReview.members.length, 2);
  });

  it('puts signals without slug in unmatched', () => {
    const signals = [
      { id: 'a', slug: 'as-review' },
      { id: 'b', slug: '' },
      { id: 'c' }, // missing slug
    ];
    const { clusters, unmatched } = clusterByExactSlug(signals);
    assert.equal(clusters.length, 1);
    assert.equal(unmatched.length, 2);
  });
});

import { mergeFuzzySingletons } from '../src/bootstrap.js';

describe('mergeFuzzySingletons', () => {
  it('merges singleton unmatched into cluster within distance 2', () => {
    const clusters = [{ slug: 'as-review-code', members: [{ id: 'a', slug: 'as-review-code' }] }];
    const unmatched = [{ id: 'b', slug: 'as-review-cod' }]; // distance 1
    const result = mergeFuzzySingletons(clusters, unmatched);
    assert.equal(result.clusters[0].members.length, 2);
    assert.equal(result.remainingOrphans.length, 0);
  });

  it('does not merge when distance > 2', () => {
    const clusters = [{ slug: 'apple', members: [{ id: 'a', slug: 'apple' }] }];
    const unmatched = [{ id: 'b', slug: 'banana' }];
    const result = mergeFuzzySingletons(clusters, unmatched);
    assert.equal(result.clusters[0].members.length, 1);
    assert.equal(result.remainingOrphans.length, 1);
  });

  it('leaves orphan when it matches multiple clusters equally (tie)', () => {
    const clusters = [
      { slug: 'abc', members: [{ id: 'a', slug: 'abc' }] },
      { slug: 'abd', members: [{ id: 'b', slug: 'abd' }] },
    ];
    const unmatched = [{ id: 'c', slug: 'ab' }]; // distance 1 to both
    const result = mergeFuzzySingletons(clusters, unmatched);
    assert.equal(result.clusters[0].members.length, 1);
    assert.equal(result.clusters[1].members.length, 1);
    assert.equal(result.remainingOrphans.length, 1);
  });

  it('does NOT merge two existing multi-member clusters even if close', () => {
    const clusters = [
      { slug: 'apple', members: [{ id: 'a' }, { id: 'b' }] },
      { slug: 'apples', members: [{ id: 'c' }, { id: 'd' }] }, // distance 1
    ];
    const result = mergeFuzzySingletons(clusters, []);
    assert.equal(result.clusters.length, 2);
  });
});
