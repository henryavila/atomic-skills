import { readFileSync } from 'node:fs';

/**
 * Extract the first `## Iron Law` block from a skill body. Returns the
 * one-line Iron Law rule (the first non-empty line after the H2), or null
 * if the body has no Iron Law section.
 *
 * The regex contract (see docs/plan-skills-catalog-v0.2.md Phase D):
 *   - First occurrence only (prompt.md has 2 — the canonical at top, plus
 *     one inside the template the skill emits).
 *   - Capture content up to the next H2 (`^## `) or `---` separator.
 */
export function extractIronLaw(bodyPath) {
  const body = readFileSync(bodyPath, 'utf8');
  const match = body.match(/^## Iron Law\s*\n+([\s\S]+?)(?=\n## |\n---|$)/m);
  if (!match) return null;
  const block = match[1].trim();
  // First non-empty line of the block is the rule.
  const firstLine = block.split('\n').find((l) => l.trim().length > 0);
  return firstLine ? firstLine.trim() : null;
}
