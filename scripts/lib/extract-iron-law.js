import { readFileSync } from 'node:fs';

/**
 * Normalize an Iron Law one-liner for catalog↔body comparison:
 * collapse internal whitespace runs and trim ends.
 */
export function normalizeIronLaw(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Extract the first `## Iron Law` block from skill body text. Returns the
 * one-line Iron Law rule (the first non-empty line after the H2), or null
 * if the body has no Iron Law section.
 *
 * The regex contract (see docs/plan-skills-catalog-v0.2.md Phase D):
 *   - First occurrence only (prompt.md has 2 — the canonical at top, plus
 *     one inside the template the skill emits).
 *   - Capture content up to the next H2 (`^## `) or `---` separator.
 */
export function extractIronLawFromBody(body) {
  if (typeof body !== 'string' || body.length === 0) return null;
  // Prefer an index/slice parse over `/…$/m`: under the `m` flag `$` matches
  // end-of-line, so a non-greedy capture would always stop at the first blank.
  const heading = /^## Iron Law\b[ \t]*\r?\n/m.exec(body);
  if (!heading) return null;
  const after = body.slice(heading.index + heading[0].length);
  const endMatch = /^(## |---\s*$)/m.exec(after);
  const block = endMatch ? after.slice(0, endMatch.index) : after;
  const firstLine = block.split(/\r?\n/).find((l) => l.trim().length > 0);
  if (!firstLine) return null;
  // Defensive: never treat a markdown heading as the Iron Law one-liner.
  if (/^#{1,6}\s/.test(firstLine.trim())) return null;
  return firstLine.trim();
}

/**
 * Extract the first `## Iron Law` block from a skill body file path.
 * @see extractIronLawFromBody
 */
export function extractIronLaw(bodyPath) {
  const body = readFileSync(bodyPath, 'utf8');
  return extractIronLawFromBody(body);
}
