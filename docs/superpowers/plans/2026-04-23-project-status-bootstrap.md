# project-status Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `bootstrap` subcommand to `atomic-skills:project-status` that scans git, docs, roadmap, and memory to produce reviewable draft initiatives for retroactive import on skill adoption.

**Architecture:** Deterministic helpers (slug normalization, fuzzy match, bucket classification, confidence scoring, draft→initiative transformation) live in `src/bootstrap.js` with full unit coverage. Skill markdown (`skills/{pt,en}/core/project-status.md`) orchestrates the 4-phase pipeline, calling the JS helpers via `node -e` when needed, and instructs the LLM when to read narrative sources. Templates for draft and index files live in `skills/shared/project-status-assets/`.

**Tech Stack:** Node.js 22+ (ESM, node:test), Bash for scan enumeration, markdown for skill content.

**Related documents:**
- Spec: `docs/superpowers/specs/2026-04-23-project-status-bootstrap-design.md`
- Base skill spec: `docs/superpowers/specs/2026-04-22-status-initiative-design.md`

---

## File Structure

### Files to create

| Path | Responsibility |
|------|----------------|
| `src/bootstrap.js` | Pure functions: normalizeSlug, editDistance, clusterByExactSlug, mergeFuzzySingletons, pickCanonicalSlug, classifyBucket, calculateConfidence, draftToInitiative, SOURCE_TYPE_WEIGHTS constant |
| `tests/bootstrap.test.js` | Unit tests for every export of bootstrap.js |
| `skills/shared/project-status-assets/bootstrap-draft.template.md` | Template for `<slug>.draft.md` (strong / worth-reviewing) with REPLACE markers |
| `skills/shared/project-status-assets/bootstrap-archived.template.md` | Template for historical drafts in `archive/` |
| `skills/shared/project-status-assets/bootstrap-index.template.md` | Template for INDEX.md dashboard |

### Files to modify

| Path | Change |
|------|--------|
| `skills/pt/core/project-status.md` | Add new "## Bootstrap" section (PT) with pipeline phases, mdprobe launch, commit mode |
| `skills/en/core/project-status.md` | Mirror PT additions in English |
| `tests/project-status.test.js` | Assert skill file documents bootstrap, phases, --dry-run, --commit, --scope |

---

## Task 1: Add `normalizeSlug` to bootstrap.js

**Files:**
- Create: `src/bootstrap.js`
- Test: `tests/bootstrap.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/bootstrap.test.js`:

```javascript
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { normalizeSlug } from '../src/bootstrap.js';

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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/bootstrap.test.js`
Expected: FAIL with `Cannot find module '../src/bootstrap.js'`

- [ ] **Step 3: Create `src/bootstrap.js` with `normalizeSlug`**

Create `src/bootstrap.js`:

```javascript
/**
 * Deterministic helpers for project-status bootstrap mode.
 * All functions are pure; no I/O, no globals.
 */

const BRANCH_PREFIXES = ['feat/', 'fix/', 'refactor/', 'chore/', 'docs/', 'test/'];
const ARTICLE_PREFIXES = ['the-', 'a-', 'an-'];
const DATE_PREFIX = /^\d{4}-\d{2}-\d{2}-/;

export function normalizeSlug(raw) {
  if (typeof raw !== 'string') return '';
  let s = raw.trim();

  // Strip branch prefix
  for (const p of BRANCH_PREFIXES) {
    if (s.startsWith(p)) { s = s.slice(p.length); break; }
  }

  // Strip date prefix
  s = s.replace(DATE_PREFIX, '');

  // Drop .md extension
  if (s.endsWith('.md')) s = s.slice(0, -3);

  // Camel/Pascal case to kebab: insert hyphen before uppercase letters (not at start)
  s = s.replace(/([a-z0-9])([A-Z])/g, '$1-$2');

  // Lowercase
  s = s.toLowerCase();

  // Replace whitespace and underscores with hyphens
  s = s.replace(/[\s_]+/g, '-');

  // Remove non-alphanumeric except hyphens
  s = s.replace(/[^a-z0-9-]/g, '');

  // Collapse multiple hyphens
  s = s.replace(/-+/g, '-');

  // Strip leading article
  for (const p of ARTICLE_PREFIXES) {
    if (s.startsWith(p)) { s = s.slice(p.length); break; }
  }

  // Trim leading/trailing hyphens
  s = s.replace(/^-+|-+$/g, '');

  // Truncate to 40 chars + trim trailing hyphen again
  if (s.length > 40) s = s.slice(0, 40).replace(/-+$/, '');

  return s;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/bootstrap.test.js`
Expected: PASS (8 subtests green)

- [ ] **Step 5: Commit**

```bash
git add src/bootstrap.js tests/bootstrap.test.js
git commit -m "feat(bootstrap): add normalizeSlug helper with tests"
```

---

## Task 2: Add `editDistance`

**Files:**
- Modify: `src/bootstrap.js` (append export)
- Modify: `tests/bootstrap.test.js` (append describe block)

- [ ] **Step 1: Write the failing test**

Append to `tests/bootstrap.test.js`:

```javascript
import { editDistance } from '../src/bootstrap.js';

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
```

And also add to the import at the top if you used a shared import statement:

```javascript
// Already at top — just confirm editDistance is in the imports list
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/bootstrap.test.js`
Expected: FAIL with `editDistance is not a function` or `not exported`

- [ ] **Step 3: Append `editDistance` to `src/bootstrap.js`**

Append to `src/bootstrap.js`:

```javascript
export function editDistance(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const m = a.length;
  const n = b.length;
  // Single-row DP for space efficiency
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,         // deletion
        curr[j - 1] + 1,     // insertion
        prev[j - 1] + cost   // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/bootstrap.test.js`
Expected: PASS (all describe blocks green)

- [ ] **Step 5: Commit**

```bash
git add src/bootstrap.js tests/bootstrap.test.js
git commit -m "feat(bootstrap): add editDistance for fuzzy slug matching"
```

---

## Task 3: Add `SOURCE_TYPE_WEIGHTS` constant

**Files:**
- Modify: `src/bootstrap.js`
- Modify: `tests/bootstrap.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/bootstrap.test.js`:

```javascript
import { SOURCE_TYPE_WEIGHTS } from '../src/bootstrap.js';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/bootstrap.test.js`
Expected: FAIL with `SOURCE_TYPE_WEIGHTS is not exported`

- [ ] **Step 3: Append constant to `src/bootstrap.js`**

```javascript
export const SOURCE_TYPE_WEIGHTS = Object.freeze({
  'git-branch': 0.30,
  'github-pr-open': 0.30,
  'github-pr-merged-recent': 0.05,
  'github-issue-open-mine': 0.15,
  'commit-group': 0.05,
  'doc-plan': 0.20,
  'doc-spec': 0.20,
  'doc-adr': 0.15,
  'roadmap-section': 0.15,
  'memory-local-entry': 0.10,
  'memory-local-orphan': 0.05,
  'memory-claude-auto': 0.10,
  'claude-mem-obs': 0.10,
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/bootstrap.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/bootstrap.js tests/bootstrap.test.js
git commit -m "feat(bootstrap): add SOURCE_TYPE_WEIGHTS reference constant"
```

---

## Task 4: Add `calculateConfidence`

**Files:**
- Modify: `src/bootstrap.js`
- Modify: `tests/bootstrap.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/bootstrap.test.js`:

```javascript
import { calculateConfidence } from '../src/bootstrap.js';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/bootstrap.test.js`
Expected: FAIL with `calculateConfidence is not a function`

- [ ] **Step 3: Append `calculateConfidence` to `src/bootstrap.js`**

```javascript
export function calculateConfidence(cluster) {
  const seen = new Set();
  let sum = 0;
  for (const m of cluster.members || []) {
    const w = SOURCE_TYPE_WEIGHTS[m.source_type];
    if (w === undefined) continue;
    if (seen.has(m.source_type)) continue;
    seen.add(m.source_type);
    sum += w;
  }
  return Math.min(1.0, Number(sum.toFixed(4)));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/bootstrap.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/bootstrap.js tests/bootstrap.test.js
git commit -m "feat(bootstrap): add calculateConfidence"
```

---

## Task 5: Add `classifyBucket`

**Files:**
- Modify: `src/bootstrap.js`
- Modify: `tests/bootstrap.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/bootstrap.test.js`:

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/bootstrap.test.js`
Expected: FAIL with `classifyBucket is not a function`

- [ ] **Step 3: Append `classifyBucket` to `src/bootstrap.js`**

```javascript
const DAY_MS = 86400000;

function daysSince(iso, now) {
  if (!iso) return Infinity;
  return (now.getTime() - new Date(iso).getTime()) / DAY_MS;
}

export function classifyBucket(cluster, now = new Date()) {
  const members = cluster.members || [];
  const evidence = cluster.completion_evidence || {};

  // Strong conditions (any)
  const hasRecentBranch = members.some(
    (m) => m.source_type === 'git-branch' && daysSince(m.last_activity, now) < 30
  );
  const hasOpenPr = members.some((m) => m.source_type === 'github-pr-open');
  const distinctTypes = new Set(members.map((m) => m.source_type));
  const hasThreePlusDistinct = distinctTypes.size >= 3;
  const hasActivitySub60 = members.some(
    (m) => daysSince(m.last_activity, now) < 60
  );

  if (hasRecentBranch || hasOpenPr || (hasThreePlusDistinct && hasActivitySub60)) {
    return 'strong';
  }

  // Historical conditions (all)
  const noRecentBranch = !members.some(
    (m) => m.source_type === 'git-branch' && daysSince(m.last_activity, now) < 180
  );
  const noOpenPr = !hasOpenPr;
  const strongCompletion =
    (evidence.branch_merged && evidence.pr_closed) || evidence.stale_plan === true;

  if (noRecentBranch && noOpenPr && strongCompletion) {
    return 'historical';
  }

  return 'worth-reviewing';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/bootstrap.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/bootstrap.js tests/bootstrap.test.js
git commit -m "feat(bootstrap): add classifyBucket rules"
```

---

## Task 6: Add `clusterByExactSlug`

**Files:**
- Modify: `src/bootstrap.js`
- Modify: `tests/bootstrap.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/bootstrap.test.js`:

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/bootstrap.test.js`
Expected: FAIL with `clusterByExactSlug is not a function`

- [ ] **Step 3: Append `clusterByExactSlug` to `src/bootstrap.js`**

```javascript
export function clusterByExactSlug(signals) {
  const bySlug = new Map();
  const unmatched = [];
  for (const sig of signals || []) {
    const slug = sig.slug;
    if (!slug) { unmatched.push(sig); continue; }
    if (!bySlug.has(slug)) bySlug.set(slug, { slug, members: [] });
    bySlug.get(slug).members.push(sig);
  }
  return { clusters: [...bySlug.values()], unmatched };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/bootstrap.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/bootstrap.js tests/bootstrap.test.js
git commit -m "feat(bootstrap): add clusterByExactSlug"
```

---

## Task 7: Add `mergeFuzzySingletons`

**Files:**
- Modify: `src/bootstrap.js`
- Modify: `tests/bootstrap.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/bootstrap.test.js`:

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/bootstrap.test.js`
Expected: FAIL with `mergeFuzzySingletons is not a function`

- [ ] **Step 3: Append `mergeFuzzySingletons` to `src/bootstrap.js`**

```javascript
const FUZZY_DISTANCE_MAX = 2;

export function mergeFuzzySingletons(clusters, unmatched) {
  // Clone to avoid mutating inputs
  const out = clusters.map((c) => ({ ...c, members: [...c.members] }));
  const remainingOrphans = [];

  for (const orphan of unmatched || []) {
    if (!orphan.slug) { remainingOrphans.push(orphan); continue; }

    // Find closest cluster(s)
    let bestDist = FUZZY_DISTANCE_MAX + 1;
    let bestIdx = [];
    for (let i = 0; i < out.length; i++) {
      const d = editDistance(orphan.slug, out[i].slug);
      if (d < bestDist) { bestDist = d; bestIdx = [i]; }
      else if (d === bestDist) { bestIdx.push(i); }
    }

    if (bestDist <= FUZZY_DISTANCE_MAX && bestIdx.length === 1) {
      out[bestIdx[0]].members.push(orphan);
    } else {
      remainingOrphans.push(orphan);
    }
  }

  return { clusters: out, remainingOrphans };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/bootstrap.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/bootstrap.js tests/bootstrap.test.js
git commit -m "feat(bootstrap): add mergeFuzzySingletons (no transitive/cluster-cluster merges)"
```

---

## Task 8: Add `pickCanonicalSlug`

**Files:**
- Modify: `src/bootstrap.js`
- Modify: `tests/bootstrap.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/bootstrap.test.js`:

```javascript
import { pickCanonicalSlug } from '../src/bootstrap.js';

describe('pickCanonicalSlug', () => {
  it('prefers slug of active git-branch when present', () => {
    const cluster = {
      members: [
        { source_type: 'doc-plan', slug: 'review-skill' },
        { source_type: 'git-branch', slug: 'as-review-code' },
      ],
    };
    const r = pickCanonicalSlug(cluster);
    assert.equal(r.slug, 'as-review-code');
    assert.deepEqual(r.alternatives, []);
  });

  it('falls back to open PR slug when no branch', () => {
    const cluster = {
      members: [
        { source_type: 'doc-plan', slug: 'review-skill' },
        { source_type: 'github-pr-open', slug: 'as-review-code' },
      ],
    };
    assert.equal(pickCanonicalSlug(cluster).slug, 'as-review-code');
  });

  it('falls back to most recent plan/spec when no branch or PR', () => {
    const cluster = {
      members: [
        { source_type: 'doc-plan', slug: 'old-plan', last_activity: '2026-01-01T00:00:00Z' },
        { source_type: 'doc-plan', slug: 'new-plan', last_activity: '2026-04-01T00:00:00Z' },
        { source_type: 'memory-local-entry', slug: 'memory-topic' },
      ],
    };
    assert.equal(pickCanonicalSlug(cluster).slug, 'new-plan');
  });

  it('flags invalid slugs and proposes alternatives', () => {
    const cluster = {
      members: [{ source_type: 'git-branch', slug: '123-bad-start' }],
    };
    const r = pickCanonicalSlug(cluster);
    assert.ok(r.slug.match(/^[a-z][a-z0-9-]{1,39}$/) || r.alternatives.length > 0);
  });

  it('returns valid slug verbatim if it passes regex', () => {
    const cluster = {
      members: [{ source_type: 'git-branch', slug: 'valid-slug' }],
    };
    assert.equal(pickCanonicalSlug(cluster).slug, 'valid-slug');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/bootstrap.test.js`
Expected: FAIL with `pickCanonicalSlug is not a function`

- [ ] **Step 3: Append `pickCanonicalSlug` to `src/bootstrap.js`**

```javascript
const VALID_SLUG = /^[a-z][a-z0-9-]{1,39}$/;

const CANONICAL_PRIORITY = [
  (m) => m.source_type === 'git-branch',
  (m) => m.source_type === 'github-pr-open',
  (m) => m.source_type === 'doc-plan' || m.source_type === 'doc-spec',
  (m) => m.source_type && m.source_type.startsWith('memory-'),
  () => true, // fallback: any
];

export function pickCanonicalSlug(cluster) {
  const members = cluster.members || [];

  let candidate = null;
  for (const predicate of CANONICAL_PRIORITY) {
    const matching = members.filter(predicate);
    if (matching.length === 0) continue;
    // Sort by last_activity desc; most recent wins
    matching.sort((a, b) => {
      const ta = a.last_activity ? new Date(a.last_activity).getTime() : 0;
      const tb = b.last_activity ? new Date(b.last_activity).getTime() : 0;
      return tb - ta;
    });
    candidate = matching[0].slug;
    if (candidate) break;
  }

  if (candidate && VALID_SLUG.test(candidate)) {
    return { slug: candidate, alternatives: [] };
  }

  // Generate alternatives by sanitizing the candidate
  const alternatives = [];
  if (candidate) {
    alternatives.push(normalizeSlug(candidate));
    alternatives.push(normalizeSlug('topic-' + candidate));
  }
  alternatives.push(normalizeSlug('unnamed-' + Date.now()));

  const sanitized = alternatives.find((a) => VALID_SLUG.test(a));
  return {
    slug: sanitized || 'unnamed',
    alternatives: alternatives.filter((a) => VALID_SLUG.test(a)),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/bootstrap.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/bootstrap.js tests/bootstrap.test.js
git commit -m "feat(bootstrap): add pickCanonicalSlug with validation fallback"
```

---

## Task 9: Add `draftToInitiative` transformation

**Files:**
- Modify: `src/bootstrap.js`
- Modify: `tests/bootstrap.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/bootstrap.test.js`:

```javascript
import { draftToInitiative } from '../src/bootstrap.js';

describe('draftToInitiative', () => {
  const sampleDraft = {
    frontmatter: {
      initiative_id: 'as-review-code',
      status: 'proposed',
      proposed_at: '2026-04-23T10:00:00Z',
      proposed_bucket: 'strong',
      started: '2026-04-10',
      last_updated: '2026-04-23T10:00:00Z',
      stack: [{ id: 1, title: 'Review skill', type: 'initiative', opened_at: '2026-04-23T10:00:00Z' }],
      tasks: {},
      parked: [],
      emerged: [],
      next_action: 'Resume T-3',
      bootstrap: {
        rationale: 'strong: PR + branch',
        evidence: [],
        confidence: 0.85,
      },
    },
    body: '# Review skill\n\nContent.',
  };

  it('changes status proposed → active', () => {
    const result = draftToInitiative(sampleDraft, new Date('2026-04-23T12:00:00Z'));
    assert.equal(result.frontmatter.status, 'active');
  });

  it('changes status proposed-archived → archived', () => {
    const archDraft = { ...sampleDraft, frontmatter: { ...sampleDraft.frontmatter, status: 'proposed-archived' } };
    const result = draftToInitiative(archDraft, new Date('2026-04-23T12:00:00Z'));
    assert.equal(result.frontmatter.status, 'archived');
  });

  it('removes bootstrap block', () => {
    const result = draftToInitiative(sampleDraft, new Date());
    assert.equal(result.frontmatter.bootstrap, undefined);
    assert.equal(result.frontmatter.proposed_at, undefined);
    assert.equal(result.frontmatter.proposed_bucket, undefined);
  });

  it('updates last_updated to now', () => {
    const now = new Date('2026-04-23T15:30:00Z');
    const result = draftToInitiative(sampleDraft, now);
    assert.equal(result.frontmatter.last_updated, '2026-04-23T15:30:00Z');
  });

  it('preserves body content', () => {
    const result = draftToInitiative(sampleDraft, new Date());
    assert.equal(result.body, sampleDraft.body);
  });

  it('throws on invalid status', () => {
    const bad = { ...sampleDraft, frontmatter: { ...sampleDraft.frontmatter, status: 'active' } };
    assert.throws(
      () => draftToInitiative(bad, new Date()),
      /invalid status/
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/bootstrap.test.js`
Expected: FAIL with `draftToInitiative is not a function`

- [ ] **Step 3: Append `draftToInitiative` to `src/bootstrap.js`**

```javascript
const STATUS_MAP = Object.freeze({
  'proposed': 'active',
  'proposed-archived': 'archived',
});

export function draftToInitiative(draft, now = new Date()) {
  const fm = { ...draft.frontmatter };

  const newStatus = STATUS_MAP[fm.status];
  if (!newStatus) {
    throw new Error(`invalid status for commit: ${fm.status} (expected proposed or proposed-archived)`);
  }

  fm.status = newStatus;
  fm.last_updated = now.toISOString().replace(/\.\d{3}Z$/, 'Z');

  // Strip bootstrap-only fields
  delete fm.bootstrap;
  delete fm.proposed_at;
  delete fm.proposed_bucket;

  return {
    frontmatter: fm,
    body: draft.body,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/bootstrap.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/bootstrap.js tests/bootstrap.test.js
git commit -m "feat(bootstrap): add draftToInitiative commit transformation"
```

---

## Task 10: Create `bootstrap-draft.template.md`

**Files:**
- Create: `skills/shared/project-status-assets/bootstrap-draft.template.md`
- Test: `tests/project-status.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/project-status.test.js` inside the `describe('project-status skill', ...)` block:

```javascript
  it('bootstrap-draft template exists with required markers', () => {
    const tplPath = join(SKILLS_DIR, 'shared/project-status-assets/bootstrap-draft.template.md');
    const content = readFileSync(tplPath, 'utf8');
    for (const marker of [
      'REPLACE_CANONICAL_SLUG', 'REPLACE_PROPOSED_AT', 'REPLACE_PROPOSED_BUCKET',
      'REPLACE_STARTED_DATE', 'REPLACE_LAST_UPDATED', 'REPLACE_BRANCH',
      'REPLACE_PLAN_LINK', 'REPLACE_TITLE', 'REPLACE_NEXT_ACTION',
      'REPLACE_RATIONALE', 'REPLACE_CONFIDENCE', 'REPLACE_SLUG_MATCH_TYPE',
      'REPLACE_CONTEXT_PARAGRAPHS', 'REPLACE_EVIDENCE_BLOCK',
    ]) {
      assert.ok(content.includes(marker), `missing marker: ${marker}`);
    }
    assert.ok(content.includes('status: proposed'));
    assert.ok(content.match(/bootstrap:\s*$/m), 'must have bootstrap: yaml block');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/project-status.test.js`
Expected: FAIL with `ENOENT: no such file`

- [ ] **Step 3: Create `skills/shared/project-status-assets/bootstrap-draft.template.md`**

```markdown
---
initiative_id: REPLACE_CANONICAL_SLUG
status: proposed
proposed_at: REPLACE_PROPOSED_AT
proposed_bucket: REPLACE_PROPOSED_BUCKET
started: REPLACE_STARTED_DATE
last_updated: REPLACE_LAST_UPDATED
branch: REPLACE_BRANCH
worktree:
plan_link: REPLACE_PLAN_LINK
wip_limit: 2
scope_paths:
  - .

stack:
  - {id: 1, title: "REPLACE_TITLE", type: initiative, opened_at: REPLACE_LAST_UPDATED}

tasks: {}

parked: []

emerged: []

next_action: "REPLACE_NEXT_ACTION"

bootstrap:
  rationale: "REPLACE_RATIONALE"
  confidence: REPLACE_CONFIDENCE
  slug_match_type: REPLACE_SLUG_MATCH_TYPE
  merge_rationale: null
  slug_alternatives: []
  evidence:
REPLACE_EVIDENCE_BLOCK
---

# REPLACE_TITLE

## Context (bootstrap-generated)

_This block was auto-generated from detected signals. Keep what's useful, delete what isn't._

REPLACE_CONTEXT_PARAGRAPHS

## Evidence excerpts

REPLACE_EVIDENCE_EXCERPTS

## Decisions

_(empty — fill in pending decisions if any)_

## Links

REPLACE_LINKS
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/project-status.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add skills/shared/project-status-assets/bootstrap-draft.template.md tests/project-status.test.js
git commit -m "feat(bootstrap): add draft template for strong/worth-reviewing buckets"
```

---

## Task 11: Create `bootstrap-archived.template.md`

**Files:**
- Create: `skills/shared/project-status-assets/bootstrap-archived.template.md`
- Test: `tests/project-status.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/project-status.test.js`:

```javascript
  it('bootstrap-archived template exists with historical-specific fields', () => {
    const tplPath = join(SKILLS_DIR, 'shared/project-status-assets/bootstrap-archived.template.md');
    const content = readFileSync(tplPath, 'utf8');
    assert.ok(content.includes('status: proposed-archived'));
    assert.ok(content.includes('REPLACE_HISTORICAL_REASON'));
    assert.ok(!content.includes('next_action'), 'historical drafts must not define next_action');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/project-status.test.js`
Expected: FAIL with `ENOENT`

- [ ] **Step 3: Create `skills/shared/project-status-assets/bootstrap-archived.template.md`**

```markdown
---
initiative_id: REPLACE_CANONICAL_SLUG
status: proposed-archived
proposed_at: REPLACE_PROPOSED_AT
proposed_bucket: historical
started: REPLACE_STARTED_DATE
last_updated: REPLACE_LAST_UPDATED
branch: REPLACE_BRANCH
plan_link: REPLACE_PLAN_LINK
wip_limit: 2
scope_paths:
  - .

stack:
  - {id: 1, title: "REPLACE_TITLE", type: initiative, opened_at: REPLACE_LAST_UPDATED}

tasks: {}

parked: []

emerged: []

bootstrap:
  rationale: "REPLACE_RATIONALE"
  historical_reason: "REPLACE_HISTORICAL_REASON"
  confidence: REPLACE_CONFIDENCE
  slug_match_type: REPLACE_SLUG_MATCH_TYPE
  merge_rationale: null
  evidence:
REPLACE_EVIDENCE_BLOCK
---

# REPLACE_TITLE (historical)

## Context (bootstrap-generated)

_This work was detected as completed. Imported as archive for future reference._

REPLACE_CONTEXT_PARAGRAPHS

## Completion summary

REPLACE_HISTORICAL_REASON

## Evidence excerpts

REPLACE_EVIDENCE_EXCERPTS

## Links

REPLACE_LINKS
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/project-status.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add skills/shared/project-status-assets/bootstrap-archived.template.md tests/project-status.test.js
git commit -m "feat(bootstrap): add draft template for historical bucket"
```

---

## Task 12: Create `bootstrap-index.template.md`

**Files:**
- Create: `skills/shared/project-status-assets/bootstrap-index.template.md`
- Test: `tests/project-status.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/project-status.test.js`:

```javascript
  it('bootstrap-index template has 3 bucket sections + Already tracked', () => {
    const tplPath = join(SKILLS_DIR, 'shared/project-status-assets/bootstrap-index.template.md');
    const content = readFileSync(tplPath, 'utf8');
    assert.ok(content.includes('## ✓ Strong candidates'));
    assert.ok(content.includes('## ? Worth reviewing'));
    assert.ok(content.includes('## ◉ Historical'));
    assert.ok(content.includes('## Already tracked'));
    assert.ok(content.includes('bootstrap --commit'));
    assert.ok(content.includes('Delete the draft file to skip'));
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/project-status.test.js`
Expected: FAIL with `ENOENT`

- [ ] **Step 3: Create `skills/shared/project-status-assets/bootstrap-index.template.md`**

```markdown
---
generated_at: REPLACE_GENERATED_AT
total_candidates: REPLACE_TOTAL
strong: REPLACE_STRONG_COUNT
worth_reviewing: REPLACE_WORTH_COUNT
historical: REPLACE_HISTORICAL_COUNT
already_tracked: REPLACE_TRACKED_COUNT
---

# Bootstrap Proposal

> Review each candidate below. **Delete the draft file to skip.** Edit freely.
> When done, run `atomic-skills:project-status bootstrap --commit`.

## Sources scanned

REPLACE_SOURCES_SUMMARY

---

## ✓ Strong candidates (REPLACE_STRONG_COUNT)

REPLACE_STRONG_SECTION

---

## ? Worth reviewing (REPLACE_WORTH_COUNT)

REPLACE_WORTH_SECTION

---

## ◉ Historical (REPLACE_HISTORICAL_COUNT)

REPLACE_HISTORICAL_SECTION

---

## Already tracked (skipped)

_Initiatives already present in `.atomic-skills/initiatives/` were not proposed._

REPLACE_TRACKED_SECTION
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/project-status.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add skills/shared/project-status-assets/bootstrap-index.template.md tests/project-status.test.js
git commit -m "feat(bootstrap): add INDEX.md dashboard template"
```

---

## Task 13: Add Bootstrap section to PT skill — overview + setup offer

**Files:**
- Modify: `skills/pt/core/project-status.md`
- Test: `tests/project-status.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/project-status.test.js`:

```javascript
  it('skill documents bootstrap subcommand and options (pt)', () => {
    installSkills(tempDir, {
      language: 'pt',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });
    const content = readFileSync(
      join(tempDir, '.claude/commands/atomic-skills/project-status.md'),
      'utf8'
    );
    for (const token of ['bootstrap', '--dry-run', '--commit', '--scope']) {
      assert.ok(content.includes(token), `missing token: ${token}`);
    }
  });
```

The test uses `language: 'pt'` because PT is updated first. Task 17 will add the equivalent EN assertion in a parametrized loop.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/project-status.test.js`
Expected: FAIL — PT skill file doesn't yet document `bootstrap`.

- [ ] **Step 3: Append Bootstrap section to `skills/pt/core/project-status.md`**

Append at end of file (after "Racionalização" table):

````markdown

## Bootstrap (import retroativo)

Quando `.atomic-skills/` acabou de ser criado via setup — ou a qualquer momento depois — o subcomando `bootstrap` varre o repo para descobrir iniciativas em voo e propor drafts revisáveis.

### Invocações

- `bootstrap` — pipeline completo (scan + cluster + synthesize); grava drafts em `.atomic-skills/bootstrap-drafts/`; abre INDEX.md no mdprobe (com confirmação)
- `bootstrap --dry-run` — mesmo scan, mas apenas resumo no terminal; nenhum arquivo escrito
- `bootstrap --commit` — materializa drafts aprovados em `.atomic-skills/initiatives/`; atualiza PROJECT-STATUS.md
- `bootstrap --scope=<list>` — limita fontes. Valores válidos (comma-separated): `git`, `github`, `docs`, `roadmap`, `memory-local`, `memory-claude`, `claude-mem`

### Oferta no setup

Ao final do passo 8 (Reportar) do setup, adicione:

> "Varrer repo pra descobrir iniciativas em andamento? (y/N)"

Se `y`, invoque `bootstrap` imediatamente na mesma sessão. Se `n` ou sem resposta: nenhuma ação — usuário pode rodar depois.

### Pré-condições

- `.atomic-skills/` deve existir (rode setup primeiro). Se não existir: aborte com `"rode setup primeiro"`.
- Para Camada 2 (Claude ecosystem): `.claude/` deve existir no repo.

### .gitignore

Ao criar `.atomic-skills/` (passo 6 do setup), adicione também:

```
.atomic-skills/bootstrap-drafts/
.atomic-skills/status/bootstrap.json
```
````

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/project-status.test.js`
Expected: PASS — the `pt` test now finds the bootstrap tokens in the installed skill.

- [ ] **Step 5: Commit**

```bash
git add skills/pt/core/project-status.md tests/project-status.test.js
git commit -m "feat(bootstrap): document subcommand overview in PT skill"
```

---

## Task 14: Add Phase 1a (shell enumerate) to PT skill

**Files:**
- Modify: `skills/pt/core/project-status.md`
- Test: `tests/project-status.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/project-status.test.js`:

```javascript
  it('skill documents Phase 1a shell commands for all Layer 1 sources', () => {
    installSkills(tempDir, {
      language: 'pt',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });
    const content = readFileSync(
      join(tempDir, '.claude/commands/atomic-skills/project-status.md'),
      'utf8'
    );
    for (const cmd of [
      'git for-each-ref',
      'git log --since',
      'gh pr list',
      'docs/superpowers/plans',
      'TODO.md',
      '.ai/memory',
    ]) {
      assert.ok(content.includes(cmd), `missing scan command: ${cmd}`);
    }
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/project-status.test.js`
Expected: FAIL

- [ ] **Step 3: Append Phase 1a section to `skills/pt/core/project-status.md`**

Append under `## Bootstrap` section:

````markdown

### Fase 1a — Shell enumerate

Coleta determinística. Nenhuma interpretação de conteúdo.

#### Git (sempre)

```bash
# Branches ativas (últimos 180d)
git for-each-ref --sort=-committerdate \
  --format='%(refname:short)|%(committerdate:iso-strict)|%(authorname)' \
  refs/heads refs/remotes/origin

# Commits recentes agrupados por escopo Conventional Commits (90d)
git log --since='90 days ago' --pretty=format:'%h|%s|%ci' \
  | grep -E '^[a-f0-9]+\|(feat|fix|refactor|docs|test|chore)\([^)]+\):'
```

#### GitHub CLI (se `gh` disponível)

```bash
gh pr list --state open --json number,title,headRefName,updatedAt,body,labels 2>/dev/null
gh pr list --state merged --limit 20 --json number,title,headRefName,mergedAt 2>/dev/null
gh issue list --state open --assignee @me --json number,title,labels,updatedAt 2>/dev/null
```

Se falhar: logue `source: github skipped (gh unavailable)` e continue. Não fatal.

#### Docs estruturados (sempre)

```bash
find docs/superpowers/plans -type f -name '*.md' 2>/dev/null
find docs/superpowers/specs -type f -name '*.md' 2>/dev/null
find docs -type d -name 'adr*' -exec find {} -name '*.md' \; 2>/dev/null
```

#### Roadmap (sempre)

```bash
for f in TODO.md ROADMAP.md NEXT.md docs/TODO.md docs/ROADMAP.md; do
  test -f "$f" && echo "$f"
done
```

Para cada arquivo encontrado, parseie H2/H3 headers com spans de linhas (shell lê os headers; LLM lê as seções em 1b).

#### Memory local (sempre)

```bash
test -f .ai/memory/MEMORY.md && echo ".ai/memory/MEMORY.md"
find .ai/memory -maxdepth 2 -name '*.md' -not -name 'MEMORY.md' 2>/dev/null
```

Parseie MEMORY.md como índice (formato `[Title](file.md) — hook`).

#### Claude ecosystem (Camada 2 — só se `.claude/` existe)

```bash
REPO_PATH=$(pwd | sed 's|^/|-|; s|/|-|g')
CLAUDE_PROJ_DIR="$HOME/.claude/projects/$REPO_PATH"
test -d "$CLAUDE_PROJ_DIR/memory" && \
  find "$CLAUDE_PROJ_DIR/memory" -maxdepth 1 -name '*.md' -not -name 'MEMORY.md'
```

claude-mem obs: use MCP tool `mcp__plugin_claude-mem_mcp-search__search` (deferred) com filtro do projeto.

Output de 1a: lista de `sources` com `type`, `id`, `last_activity`, `raw`. Nenhuma leitura de conteúdo ainda.
````

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/project-status.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add skills/pt/core/project-status.md tests/project-status.test.js
git commit -m "feat(bootstrap): document Phase 1a shell enumeration (PT)"
```

---

## Task 15: Add Phase 1b (LLM extract) to PT skill

**Files:**
- Modify: `skills/pt/core/project-status.md`
- Test: `tests/project-status.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/project-status.test.js`:

```javascript
  it('skill documents Phase 1b LLM extraction for narrative sources', () => {
    installSkills(tempDir, {
      language: 'pt',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });
    const content = readFileSync(
      join(tempDir, '.claude/commands/atomic-skills/project-status.md'),
      'utf8'
    );
    assert.ok(content.includes('Fase 1b'));
    assert.ok(content.includes('topic_hint'));
    assert.ok(content.includes('evidence_quote'));
    assert.ok(content.includes('candidate_completion'));
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/project-status.test.js`
Expected: FAIL

- [ ] **Step 3: Append Phase 1b section to `skills/pt/core/project-status.md`**

````markdown

### Fase 1b — LLM extract

Aplicada apenas a sources narrativos (`doc-plan`, `doc-spec`, `doc-adr`, `roadmap-section`, `memory-local-entry`, `memory-local-orphan`, `memory-claude-auto`, `claude-mem-obs`).

Sources estruturais (`git-branch`, `github-pr-*`, `github-issue-*`, `commit-group`) pulam 1b.

Para cada source narrativo, leia o conteúdo e emita zero ou mais signal objects:

```yaml
signal:
  source_id: <de 1a>
  source_type: <de 1a>
  topic_hint: <kebab-case slug curto>
  evidence_quote: <1-2 frases verbatim>
  candidate_completion: active | paused | done | unknown
  referenced_identifiers: [<branches, paths, slugs mencionados>]
  surfaced_subtopics: [<slugs laterais>]
```

Instrução interna (aplicada por você, LLM):

> "Leia esta fonte. Para cada tópico distinto que pareça trabalho pendente ou em voo (não documentação geral, não retrospectiva de trabalho completo, não conteúdo puramente de aprendizado), emita signal com:
> - topic_hint: slug kebab-case curto
> - evidence_quote: 1-2 frases verbatim
> - candidate_completion: active | paused | done | unknown
> - identificadores referenciados (branches, paths, slugs)
> - surfaced_subtopics: slugs laterais mencionados
>
> Pule: documentação geral, decisões sem ação forward, trabalho completo, learnings puros, style guides, API reference."

Um source pode gerar múltiplos signals. Cada um herda `last_activity` do source (ou override se o texto cita "rediscutido em YYYY-MM-DD").
````

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/project-status.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add skills/pt/core/project-status.md tests/project-status.test.js
git commit -m "feat(bootstrap): document Phase 1b LLM extraction (PT)"
```

---

## Task 16: Add Phase 2 (clustering) + Phase 3 (synthesis) + Phase 4 (commit) to PT skill

**Files:**
- Modify: `skills/pt/core/project-status.md`
- Test: `tests/project-status.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/project-status.test.js`:

```javascript
  it('skill documents Phase 2 clustering, Phase 3 synthesis, Phase 4 commit', () => {
    installSkills(tempDir, {
      language: 'pt',
      ides: ['claude-code'],
      modules: {},
      skillsDir: SKILLS_DIR,
      metaDir: META_DIR,
    });
    const content = readFileSync(
      join(tempDir, '.claude/commands/atomic-skills/project-status.md'),
      'utf8'
    );
    for (const token of [
      'Fase 2', 'clusterByExactSlug', 'mergeFuzzySingletons', 'pickCanonicalSlug',
      'Fase 3', 'classifyBucket', 'calculateConfidence',
      'Fase 4', 'draftToInitiative', 'bootstrap-drafts',
      'INDEX.md', 'mdprobe',
    ]) {
      assert.ok(content.includes(token), `missing token: ${token}`);
    }
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/project-status.test.js`
Expected: FAIL

- [ ] **Step 3: Append Phases 2, 3, 4 to `skills/pt/core/project-status.md`**

````markdown

### Fase 2 — Clustering

Use as funções em `src/bootstrap.js` via `node -e`:

```bash
# Exemplo: agrupa por slug exato
node -e "
import('./src/bootstrap.js').then(({ clusterByExactSlug, mergeFuzzySingletons, pickCanonicalSlug }) => {
  const signals = JSON.parse(process.argv[1]);
  const { clusters, unmatched } = clusterByExactSlug(signals);
  const merged = mergeFuzzySingletons(clusters, unmatched);
  const withCanonical = merged.clusters.map(c => ({ ...c, canonical: pickCanonicalSlug(c) }));
  console.log(JSON.stringify({ clusters: withCanonical, remainingOrphans: merged.remainingOrphans }));
});
" "$(cat /tmp/signals.json)"
```

**Órfãos remanescentes** (que não bateram slug exato nem fuzzy singleton) passam por LLM fallback: você recebe `{clusters, orphans}` e pergunta pra cada órfão se ele semanticamente pertence a algum cluster existente (confidence ≥ 0.75 para merge). Nunca funde clusters slug-matched entre si. Registre `merge_rationale` para cada merge LLM.

### Fase 3 — Synthesize

Para cada cluster:

1. Chame `classifyBucket(cluster, new Date())` → `'strong' | 'worth-reviewing' | 'historical'`.
2. Chame `calculateConfidence(cluster)` → score 0-1.
3. Gere drafts escrevendo em `.atomic-skills/bootstrap-drafts/`:
   - Strong/worth-reviewing → `<slug>.draft.md` usando `skills/shared/project-status-assets/bootstrap-draft.template.md`
   - Historical → `archive/<YYYY-MM>-<slug>.draft.md` usando `skills/shared/project-status-assets/bootstrap-archived.template.md`
4. Para cada draft, você (LLM) gera:
   - **Título** (4-8 palavras imperativo) baseado no cluster
   - **next_action** (strong = "Resume T-N: ..."; worth-reviewing = forma-questão; historical = null)
   - **rationale** (1-2 linhas citando sinais decisivos)
   - **Context synthesis** (2-3 parágrafos)
5. Após todos os drafts, gere `INDEX.md` usando `skills/shared/project-status-assets/bootstrap-index.template.md`.
6. Pergunte confirmação (intrusive-actions): "Open bootstrap proposal in browser? (y/N)".
7. Se `y`: execute `mdprobe .atomic-skills/bootstrap-drafts/INDEX.md 2>/dev/null || npx -y @henryavila/mdprobe .atomic-skills/bootstrap-drafts/INDEX.md`.

### Fase 4 — Commit

Invocado explicitamente via `bootstrap --commit` após usuário revisar.

Algoritmo:

```
1. Se .atomic-skills/bootstrap-drafts/ não existe: error "nothing to commit".
2. Liste todos *.draft.md (incluindo archive/).
3. Para cada draft:
   a. Parse frontmatter YAML (use src/yaml.js se edge case).
   b. Valide: initiative_id casa regex, único vs initiatives/**, status em {proposed, proposed-archived}, stack[0].title não-vazio.
   c. Chame `draftToInitiative(draft, new Date())` → { frontmatter, body } transformado.
   d. Escreva em destino:
      - status=active → .atomic-skills/initiatives/<slug>.md
      - status=archived → .atomic-skills/initiatives/archive/<YYYY-MM>-<slug>.md
   e. Delete o draft.
   f. Em conflito de nome no destino: log, skip, continue.
4. Atualize PROJECT-STATUS.md (Active Initiatives e Recently Archived).
5. Escreva audit log em .atomic-skills/status/bootstrap.json:
   { timestamp, committed: [slugs], skipped: [{slug, reason}], errors: [{slug, error}] }.
6. Report summary: "Committed N (A active, H archived), skipped K, errors L".
7. Se bootstrap-drafts/ está vazio: pergunte "Remove bootstrap-drafts/? (y/N)". Se drafts remanescem: pule a pergunta, informe "N drafts remain; fix and re-run".
```
````

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/project-status.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add skills/pt/core/project-status.md tests/project-status.test.js
git commit -m "feat(bootstrap): document Phases 2/3/4 (clustering, synthesis, commit) PT"
```

---

## Task 17: Mirror all Bootstrap sections to EN skill

**Files:**
- Modify: `skills/en/core/project-status.md`
- Modify: `tests/project-status.test.js`

- [ ] **Step 1: Write the failing test**

Modify the tests added in Tasks 13-16 to run with BOTH languages. Change each occurrence of `language: 'pt'` (added during those tasks) to parameterize:

```javascript
  // Replace each of the 4 bootstrap-documenting tests' installSkills({ language: 'pt', ... })
  // with a loop over both languages:
  for (const lang of ['pt', 'en']) {
    it(`skill documents bootstrap tokens in ${lang}`, () => {
      installSkills(tempDir, {
        language: lang,
        ides: ['claude-code'],
        modules: {},
        skillsDir: SKILLS_DIR,
        metaDir: META_DIR,
      });
      const content = readFileSync(
        join(tempDir, '.claude/commands/atomic-skills/project-status.md'),
        'utf8'
      );
      for (const token of ['bootstrap', '--dry-run', '--commit', '--scope']) {
        assert.ok(content.includes(token), `[${lang}] missing: ${token}`);
      }
    });
  }
```

Do the same for the Phase 1a, 1b, 2/3/4 tests (loop over both languages).

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/project-status.test.js`
Expected: FAIL — EN file doesn't have bootstrap section yet.

- [ ] **Step 3: Translate the PT Bootstrap section into `skills/en/core/project-status.md`**

Append at end of `skills/en/core/project-status.md` (after the English "Rationalization" table):

````markdown

## Bootstrap (retroactive import)

When `.atomic-skills/` has just been created via setup — or at any later point — the `bootstrap` subcommand scans the repo to discover in-flight initiatives and propose reviewable drafts.

### Invocations

- `bootstrap` — full pipeline (scan + cluster + synthesize); writes drafts to `.atomic-skills/bootstrap-drafts/`; opens INDEX.md in mdprobe (after confirmation)
- `bootstrap --dry-run` — same scan, terminal summary only; no disk writes
- `bootstrap --commit` — materializes reviewed drafts into `.atomic-skills/initiatives/`; updates PROJECT-STATUS.md
- `bootstrap --scope=<list>` — limit sources. Valid values (comma-separated): `git`, `github`, `docs`, `roadmap`, `memory-local`, `memory-claude`, `claude-mem`

### Offer at setup

At the end of setup step 8 (Report), add:

> "Scan repo to discover in-flight initiatives? (y/N)"

If `y`, invoke `bootstrap` immediately in the same session. Otherwise: no action.

### Preconditions

- `.atomic-skills/` must exist (run setup first). If missing: abort with `"run setup first"`.
- For Layer 2 (Claude ecosystem): `.claude/` must exist in the repo.

### .gitignore

When creating `.atomic-skills/` in setup step 6, also add:

```
.atomic-skills/bootstrap-drafts/
.atomic-skills/status/bootstrap.json
```

### Phase 1a — Shell enumerate

[Translate Phase 1a section from PT equivalent]

### Phase 1b — LLM extract

[Translate Phase 1b section from PT equivalent]

### Phase 2 — Clustering

[Translate Phase 2 section from PT equivalent]

### Phase 3 — Synthesize

[Translate Phase 3 section from PT equivalent]

### Phase 4 — Commit

[Translate Phase 4 section from PT equivalent]
````

**Important:** Replace each `[Translate ...]` placeholder with the full English translation of the corresponding PT section from Tasks 14-16. Preserve all code blocks verbatim (bash, YAML, etc.). Translate only prose and section headers.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/project-status.test.js`
Expected: PASS (both PT and EN assertions)

- [ ] **Step 5: Commit**

```bash
git add skills/en/core/project-status.md tests/project-status.test.js
git commit -m "feat(bootstrap): mirror bootstrap section to EN skill"
```

---

## Task 18: Update setup flow in both skills to offer bootstrap + add gitignore entries

**Files:**
- Modify: `skills/pt/core/project-status.md`
- Modify: `skills/en/core/project-status.md`
- Modify: `tests/project-status.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/project-status.test.js`:

```javascript
  for (const lang of ['pt', 'en']) {
    it(`setup flow offers bootstrap and updates gitignore (${lang})`, () => {
      installSkills(tempDir, {
        language: lang,
        ides: ['claude-code'],
        modules: {},
        skillsDir: SKILLS_DIR,
        metaDir: META_DIR,
      });
      const content = readFileSync(
        join(tempDir, '.claude/commands/atomic-skills/project-status.md'),
        'utf8'
      );
      // Setup must reference bootstrap offer
      assert.ok(
        content.match(/bootstrap-drafts/),
        `[${lang}] setup must mention bootstrap-drafts in .gitignore section`
      );
    });
  }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/project-status.test.js`
Expected: may already pass because Tasks 13/17 added bootstrap-drafts reference — if it passes, skip to Step 4. Otherwise continue Step 3.

- [ ] **Step 3: Update setup section in both skills to reference bootstrap**

In PT (`skills/pt/core/project-status.md`) modify the `### 7. Atualizar .gitignore` section:

Old (current content):

````
### 7. Atualizar .gitignore
Append (se não existente):
```
.atomic-skills/status/stop.log
.atomic-skills/status/SKIP
.atomic-skills/initiatives/*.rendered.md
```
````

New (replace the block above with):

````
### 7. Atualizar .gitignore
Append (se não existente):
```
.atomic-skills/status/stop.log
.atomic-skills/status/SKIP
.atomic-skills/initiatives/*.rendered.md
.atomic-skills/bootstrap-drafts/
.atomic-skills/status/bootstrap.json
```
````

And modify `### 8. Reportar` to append this line:

> Pergunte também: "Varrer repo pra descobrir iniciativas em andamento? (y/N)". Se sim, invoque o fluxo `bootstrap` descrito abaixo.

Mirror the same change to `skills/en/core/project-status.md` (translate the prompt to English).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/project-status.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add skills/pt/core/project-status.md skills/en/core/project-status.md tests/project-status.test.js
git commit -m "feat(bootstrap): integrate bootstrap offer into setup flow (PT+EN)"
```

---

## Task 19: Run full test suite + commit stabilization

**Files:**
- (no changes expected)

- [ ] **Step 1: Run full test suite**

Run: `node --test tests/`
Expected: all tests pass — previously existing tests + new bootstrap.test.js + expanded project-status.test.js. No regressions.

If any test fails: fix in place, commit the fix with message `fix(bootstrap): <short reason>`.

- [ ] **Step 2: Run the skill installer end-to-end in a temp dir**

```bash
mkdir -p /tmp/bootstrap-smoke && cd /tmp/bootstrap-smoke
git init
node /home/henry/atomic-skills/src/install.js --ide claude-code --language pt 2>&1 | head -20
ls -la .claude/commands/atomic-skills/
grep -c 'bootstrap' .claude/commands/atomic-skills/project-status.md
cd - && rm -rf /tmp/bootstrap-smoke
```

Expected:
- install.js exits 0
- `project-status.md` exists
- grep count for 'bootstrap' ≥ 10

- [ ] **Step 3: Update TODO.md with follow-up reference**

Append to `TODO.md` under a new section:

```markdown

## Shipped 2026-04-23

### `atomic-skills:project-status bootstrap` — retroactive initial import

Implemented per spec `docs/superpowers/specs/2026-04-23-project-status-bootstrap-design.md`.

- 4-phase pipeline: enumerate, extract, cluster, synthesize
- 3-bucket classification (strong / worth-reviewing / historical)
- Batch review via mdprobe with individual draft files
- Explicit `--commit` step; drafts gitignored until committed
- Deterministic helpers in `src/bootstrap.js` with 9 test suites
```

- [ ] **Step 4: Commit TODO update**

```bash
git add TODO.md
git commit -m "docs: record bootstrap ship in TODO.md"
```

- [ ] **Step 5: Final verification**

Run: `node --test tests/ 2>&1 | tail -20`
Expected: summary shows 0 failures.

```bash
git log --oneline -20
```
Expected: ~19 commits from this plan, in order.

---

## Self-review notes

Coverage check against spec:
- ✅ Spec §5.1 invocations: Task 13 (subcommand), Tasks 14-16 (pipeline)
- ✅ Spec §5.2 pipeline phases: Tasks 14, 15, 16
- ✅ Spec §5.3 file layout: Tasks 10-12 (templates), Task 18 (gitignore)
- ✅ Spec §6 Phase 1a: Task 14
- ✅ Spec §7 Phase 1b: Task 15
- ✅ Spec §8 Phase 2 clustering: Task 16 (markdown) + Tasks 6, 7, 8 (JS helpers)
- ✅ Spec §9 Phase 3 synthesis + buckets: Task 16 (markdown) + Tasks 4, 5 (JS), Tasks 10-12 (templates)
- ✅ Spec §10 review workflow: Task 16 (constraints re-check documented)
- ✅ Spec §11 Phase 4 commit: Task 16 (markdown) + Task 9 (draftToInitiative)
- ✅ Spec §12 error handling: Task 14 (gh graceful degradation), Task 16 (commit partial failure)
- ✅ Spec §13 testing strategy: Tasks 1-9 cover unit tests; E2E deferred with note
- ✅ Spec §15.1 source types table: Task 3

**Gap: no integration/fixture test.** Spec §13.2 describes fixture repos for integration testing. This plan does not build them — it relies on unit coverage of pure functions. Integration tests are valuable but costly to set up (each fixture is its own mini-repo) and would double the plan size. Deferred to a follow-up implementation pass. This is a conscious trade-off: the JS helpers have full unit coverage; the LLM-orchestrated parts are tested by prompt+schema assertions that any reasonable implementation can verify.

**Additional defensive note:** Tasks 13-16 add to the PT skill first, then mirror to EN in Task 17. If you execute out of order, the EN skill will have a partial bootstrap section. This is OK as long as Task 17 is executed; the test suite will fail until Task 17 lands. Do not merge intermediate state to main without Task 17 landing first.
