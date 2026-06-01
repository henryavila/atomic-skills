/**
 * Deterministic helpers for the `project-plan discover` flow (formerly
 * `project-status bootstrap`). File kept under src/bootstrap.js for
 * historical continuity; the discover subcommand renamed-and-moved in v2.0.0.
 * All functions are pure; no I/O, no globals.
 */

import { withManualGate } from './manual-gate.js';

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

export function pickCanonicalSlug(cluster, now = new Date()) {
  const members = cluster.members || [];

  let candidate = null;
  for (let idx = 0; idx < CANONICAL_PRIORITY.length; idx++) {
    const predicate = CANONICAL_PRIORITY[idx];
    const matching = members.filter(predicate);
    if (matching.length === 0) continue;
    // Level 5 (last, fallback) uses earliest-first per spec §8.3 priority 5.
    // Levels 1-4 use most-recent-first.
    const isFallback = idx === CANONICAL_PRIORITY.length - 1;
    matching.sort((a, b) => {
      const ta = a.last_activity ? new Date(a.last_activity).getTime() : 0;
      const tb = b.last_activity ? new Date(b.last_activity).getTime() : 0;
      return isFallback ? ta - tb : tb - ta;
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
  alternatives.push(normalizeSlug('unnamed-' + now.getTime()));

  const sanitized = alternatives.find((a) => VALID_SLUG.test(a));
  return {
    slug: sanitized || 'unnamed',
    alternatives: alternatives.filter((a) => VALID_SLUG.test(a)),
  };
}

const STATUS_MAP = Object.freeze({
  'proposed': 'active',
  'proposed-archived': 'archived',
});

const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const BARE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Coerce common date-shaped values into the strict ISO timestamp the
 * initiative schema requires. Used on commit so date-only values that
 * sneak in from drafts (or hand-edits) become schema-valid before they
 * reach .atomic-skills/initiatives/.
 */
function coerceToIsoTimestamp(value, fallbackNow) {
  if (typeof value === 'string') {
    if (ISO_TIMESTAMP_RE.test(value)) return value;
    if (BARE_DATE_RE.test(value)) return `${value}T00:00:00Z`;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
  return fallbackNow;
}

/**
 * Transform a bootstrap draft into a canonical initiative.
 *
 * Draft frontmatter is in schemaVersion 0.1 shape (camelCase) but carries
 * extra bootstrap-only fields (`bootstrap:`, `proposedAt`, `proposedBucket`,
 * `planLink`) and a non-canonical `status` (proposed / proposed-archived).
 *
 * On commit: map status, refresh lastUpdated, normalize `started` to
 * a full ISO timestamp (drafts may carry date-only values from older
 * bootstraps or hand-edits), fold `planLink` into `references[]` if
 * present, and strip bootstrap metadata.
 */
/**
 * Detect whether a markdown source describes a multi-phase Plan (≥ 2 phase
 * headings) vs a single Initiative (everything else). Used by `discover`
 * Phase 1b to route signals to the right cluster shape, and by Phase 4 to
 * route drafts through decompose.js vs the legacy draftToInitiative path.
 *
 * Matches H2 headings like:
 *   ## F0 — Foundation
 *   ## F12: Cleanup
 *   ## Phase 3 — Migration
 *   ## Fase 2 — Validação
 *
 * Returns 'plan' on ≥ 2 matches, 'initiative' otherwise.
 */
export function detectPlanShape(markdown) {
  if (typeof markdown !== 'string' || markdown.length === 0) return 'initiative';
  // Phase headings — EN (Phase N), PT (Fase N), or canonical (F0/F12/...)
  // T11 (review 2026-05-24): a naive regex over the whole document
  // false-positives on phase headings INSIDE fenced code blocks
  // (```python\n## Phase 1\n```). Track fence state line-by-line; only
  // count headings at fence-depth 0.
  const headingRe = /^##\s+(F\d+|Phase\s+\d+|Fase\s+\d+)\b/i;
  const fenceRe = /^\s*(```|~~~)/;
  let inFence = false;
  let count = 0;
  for (const line of markdown.split('\n')) {
    if (fenceRe.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    if (headingRe.test(line)) {
      count++;
      if (count >= 2) return 'plan';
    }
  }
  return 'initiative';
}

export function draftToInitiative(draft, now = new Date()) {
  const fm = { ...draft.frontmatter };

  const newStatus = STATUS_MAP[fm.status];
  if (!newStatus) {
    throw new Error(`invalid status for commit: ${fm.status} (expected proposed or proposed-archived)`);
  }

  fm.status = newStatus;
  const nowIso = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  fm.lastUpdated = nowIso;
  fm.started = coerceToIsoTimestamp(fm.started, nowIso);

  // Fold planLink (free-form pointer used during bootstrap) into structured
  // references[] so the committed initiative matches initiative.schema.json.
  if (fm.planLink && typeof fm.planLink === 'string' && fm.planLink.trim() && fm.planLink !== 'REPLACE_PLAN_LINK') {
    const refs = Array.isArray(fm.references) ? [...fm.references] : [];
    refs.push({
      kind: fm.planLink.startsWith('http') ? 'url' : 'file',
      path: fm.planLink,
      label: 'Planning doc (bootstrap)',
    });
    fm.references = refs;
  }
  delete fm.planLink;

  // Strip bootstrap-only metadata.
  delete fm.bootstrap;
  delete fm.proposedAt;
  delete fm.proposedBucket;

  // A committed-as-active standalone initiative ends with the reserved final
  // manual-validation gate (G-MANUAL) so it cannot be archived without a human
  // sign-off. Archived (historical) captures are already closed — skip them.
  // See src/manual-gate.js. (discover only produces standalone initiatives via
  // this path; plan-shaped clusters go through materializeDecomposition.)
  if (newStatus === 'active') {
    fm.exitGates = withManualGate(fm.exitGates);
  }

  return {
    frontmatter: fm,
    body: draft.body,
  };
}
