#!/usr/bin/env node
/**
 * Deterministic `design.md` section lint (R-XAGENT-06).
 *
 * Mirrors the No-Placeholders lint shape: pure, zero-token, no network, no tool
 * calls — a string scan callable from any agent (including Gemini's read-only
 * investigator). It gives the "PLAN refuses without a design.md" gate
 * (R-ORCH-09) something testable: a design missing a required section, or with
 * a required section that is empty/placeholder-only, fails.
 *
 * Required sections (case-insensitive, any heading level, ignored inside code
 * fences):
 *   - Decisions       — heading matches /\bdecisions?\b/      (always)
 *   - Chosen approach  — heading matches /chosen[-\s]+approach/ (always)
 *   - Blast radius     — heading matches /blast[-\s]+radius/    (only with --migration)
 * Each required section must carry real content (a non-blank line that is not a
 * heading and not a bare placeholder like TODO / TBD / REPLACE_* / <...>).
 *
 * Usage:
 *   node scripts/lint-design.js <design.md> [--migration]
 *
 * Exit codes:
 *   0 — all required sections present and non-empty
 *   1 — one or more violations
 *   2 — file/usage error
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const REQUIRED = [
  { key: 'decisions', label: 'Decisions', re: /\bdecisions?\b/, migrationOnly: false },
  { key: 'chosen-approach', label: 'Chosen approach', re: /chosen[-\s]+approach/, migrationOnly: false },
  { key: 'blast-radius', label: 'Blast radius', re: /blast[-\s]+radius/, migrationOnly: true },
];

// A body line that is ONLY a placeholder (after stripping list/quote markers).
const PLACEHOLDER_LINE = /^(todo|tbd|fixme|wip|tk)\b|^replace_|^<[^>]*>$|^\.\.\.$|^[_-]{2,}$/i;

function normalizeHeading(text) {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[`*]/g, '') // strip markdown emphasis markers
    .replace(/_/g, ' ') // underscore → space: handles both italic `_Decisions_` and snake_case `Chosen_approach`
    .trim()
    .toLowerCase();
}

/**
 * Parse markdown into sections, each { level, normTitle, bodyLines }.
 * Heading-looking lines inside ``` / ~~~ fenced code blocks are NOT treated as
 * headings (so a `## Decisions` quoted in a code block never satisfies the
 * requirement), but fenced content still counts as a section's body.
 * Pure: no I/O.
 *
 * @param {string} markdown
 * @returns {Array<{level:number, normTitle:string, bodyLines:string[]}>}
 */
export function parseSections(markdown) {
  const lines = String(markdown).split(/\r?\n/);
  const headings = [];
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      if (fence == null) fence = fenceMatch[1][0];
      else if (line.trim().startsWith(fence.repeat(3))) fence = null;
      continue;
    }
    if (fence != null) continue;
    const h = line.match(/^(#{1,6})\s+(.*\S)\s*$/);
    if (h) headings.push({ level: h[1].length, title: h[2], lineIdx: i });
  }
  return headings.map((hd, idx) => {
    const startLine = hd.lineIdx + 1;
    let endLine = lines.length;
    for (let k = idx + 1; k < headings.length; k++) {
      if (headings[k].level <= hd.level) { endLine = headings[k].lineIdx; break; }
    }
    return {
      level: hd.level,
      normTitle: normalizeHeading(hd.title),
      bodyLines: lines.slice(startLine, endLine),
    };
  });
}

/** A section has real content if any body line is non-blank, non-placeholder. */
function hasRealContent(bodyLines) {
  for (const raw of bodyLines) {
    let s = raw.trim();
    if (s === '') continue;
    s = s.replace(/^[>\-*+\s]+/, '').trim(); // strip leading list/quote markers
    if (s === '') continue;
    if (PLACEHOLDER_LINE.test(s)) continue;
    return true;
  }
  return false;
}

/**
 * Lint a design.md markdown string for the required DESIGN sections.
 * Pure: no I/O. Returns [] when valid.
 *
 * @param {string} markdown - raw design.md content
 * @param {object} [opts]
 * @param {boolean} [opts.isMigration] - when true, the Blast radius section is required
 * @returns {string[]} violation messages (empty = valid)
 */
export function lintDesignMd(markdown, opts = {}) {
  const isMigration = !!opts.isMigration;
  if (typeof markdown !== 'string' || markdown.trim() === '') {
    return ['design.md is empty or unreadable'];
  }
  const sections = parseSections(markdown);
  const violations = [];
  for (const req of REQUIRED) {
    if (req.migrationOnly && !isMigration) continue;
    const matches = sections.filter((s) => req.re.test(s.normTitle));
    if (matches.length === 0) {
      violations.push(`missing required section "${req.label}"${req.migrationOnly ? ' (required for migrations)' : ''}.`);
      continue;
    }
    if (!matches.some((s) => hasRealContent(s.bodyLines))) {
      violations.push(`required section "${req.label}" is present but empty — only blank or placeholder lines under the heading.`);
    }
  }
  return violations;
}

function main() {
  const args = process.argv.slice(2);
  const isMigration = args.includes('--migration');
  const files = args.filter((a) => a !== '--migration');
  if (files.length !== 1) {
    console.error('Usage: node scripts/lint-design.js <design.md> [--migration]');
    process.exit(2);
  }
  let raw;
  try {
    raw = readFileSync(files[0], 'utf8');
  } catch (err) {
    console.error(`ERROR: cannot read ${files[0]}: ${err.message}`);
    process.exit(2);
  }
  const violations = lintDesignMd(raw, { isMigration });
  if (violations.length === 0) {
    console.log(`✓ ${files[0]} — required design sections present${isMigration ? ' (migration: blast-radius enforced)' : ''}`);
    process.exit(0);
  }
  console.error(`✖ ${files[0]} — design.md section lint failed:`);
  for (const v of violations) console.error(`    - ${v}`);
  process.exit(1);
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  main();
}
