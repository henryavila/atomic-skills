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
