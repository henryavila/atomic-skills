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

  // Convert remaining slashes to hyphens (handles org-namespaced paths like "org/repo")
  s = s.replace(/\//g, '-');

  // Strip date prefix
  s = s.replace(DATE_PREFIX, '');

  // Drop .md extension
  if (s.endsWith('.md')) s = s.slice(0, -3);

  // Must run before toLowerCase so uppercase boundaries are detectable
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
