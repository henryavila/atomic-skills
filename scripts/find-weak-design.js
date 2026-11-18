#!/usr/bin/env node
/**
 * find-weak-design.js — quality DETECTOR for multi-phase design.md + research
 * digest (complements find-missing-design-process presence/ready gate).
 *
 * Fails (exit 1) when:
 *   - soft-language (G2 hedges) in Interview / Context / Non-goals / Decisions
 *   - Non-goals is a near-echo of Context (or Interview problem)
 *   - Interview section too short
 *   - research digest is weak (zero paths, <3 bullets, filler-only, empty)
 *
 * CLI takes explicit paths (no tree-wide false-positives on adopt/ad-hoc):
 *   node scripts/find-weak-design.js <design.md> [<research-digest.md>]
 *   node scripts/find-weak-design.js --lane adopt|ad-hoc|single-task ...
 *
 * Exit 0 = strong enough; exit 1 = weak; exit 2 = usage/IO.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseSections } from './lint-design.js';
import { isExemptLane } from './find-missing-design-process.js';

/** Min non-whitespace body length for Interview section. */
export const MIN_INTERVIEW_LENGTH = 80;

/** Soft-language hedges (G2) — aligned with find-weak-business-intent. */
export const SOFT_LANGUAGE_RE =
  /\b(should|probably|typically|usually|I think|it seems|in theory|tends to|maybe|perhaps|kinda|sort of)\b/i;

const FILLER_DIGEST_RE =
  /^(looked around|tbd|todo|n\/a|none|ok|fine|we already know|same as goal)\.?$/i;

const WEAK_FILLER_LINE_RE =
  /^(todo|tbd|fixme|wip|replace_|n\/a|none|ok|yes|lgtm)\b/i;

/**
 * Normalize text for echo comparison.
 * @param {string} s
 */
export function normalizeForEcho(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find first section whose normalized title matches `re`.
 * @param {ReturnType<typeof parseSections>} sections
 * @param {RegExp} re
 */
function sectionBody(sections, re) {
  for (const s of sections) {
    if (re.test(s.normTitle)) {
      return s.bodyLines.join('\n').trim();
    }
  }
  return '';
}

/**
 * Quality issues for design.md content.
 * @param {string} markdown
 * @returns {Array<{ field: string, reason: string }>}
 */
export function weakDesignIssues(markdown) {
  const issues = [];
  if (typeof markdown !== 'string' || markdown.trim() === '') {
    return [{ field: 'design', reason: 'empty' }];
  }
  const sections = parseSections(markdown);
  const interview = sectionBody(sections, /\binterview\b/);
  const context = sectionBody(sections, /\bcontext\b/);
  const nonGoals = sectionBody(sections, /non[-\s]+goals?/);
  const decisions = sectionBody(sections, /\bdecisions?\b/);

  if (!interview || interview.replace(/\s+/g, '').length < MIN_INTERVIEW_LENGTH) {
    issues.push({
      field: 'interview',
      reason: `too-short(<${MIN_INTERVIEW_LENGTH})`,
    });
  } else if (SOFT_LANGUAGE_RE.test(interview)) {
    issues.push({ field: 'interview', reason: 'soft-language' });
  }

  for (const [field, body] of [
    ['context', context],
    ['non-goals', nonGoals],
    ['decisions', decisions],
  ]) {
    if (body && SOFT_LANGUAGE_RE.test(body)) {
      issues.push({ field, reason: 'soft-language' });
    }
  }

  if (nonGoals && context) {
    const n = normalizeForEcho(nonGoals);
    const c = normalizeForEcho(context);
    if (n && c && (n === c || c.includes(n) || n.includes(c))) {
      issues.push({ field: 'non-goals', reason: 'echo-of-context' });
    }
  }

  return issues;
}

/**
 * Weak research-digest bars (see brainstorm-assets/research.md).
 * @param {string} markdown
 * @returns {Array<{ field: string, reason: string }>}
 */
export function weakDigestIssues(markdown) {
  const issues = [];
  if (typeof markdown !== 'string' || markdown.trim() === '') {
    return [{ field: 'research-digest', reason: 'empty' }];
  }
  const text = markdown.trim();
  if (WEAK_FILLER_LINE_RE.test(text) || FILLER_DIGEST_RE.test(text)) {
    return [{ field: 'research-digest', reason: 'filler-only' }];
  }

  // Concrete repo-ish paths: skills/, src/, scripts/, docs/, tests/, packages/, etc.
  // Allow markdown emphasis/code wrappers immediately before the path.
  const pathHits = text.match(
    /(?:^|[\s`('"*(])((?:skills|src|scripts|docs|tests|packages|meta|projects|hooks|bin)\/[\w./@*-]+)/gm,
  );
  const pathCount = pathHits ? pathHits.length : 0;
  if (pathCount === 0) {
    issues.push({ field: 'research-digest', reason: 'zero-paths' });
  }

  // Useful bullets: markdown list lines with some substance
  const bullets = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[-*+]\s+\S/.test(l) || /^\d+\.\s+\S/.test(l))
    .filter((l) => {
      const body = l.replace(/^[-*+\d.]+\s+/, '').trim();
      if (body.length < 12) return false;
      if (WEAK_FILLER_LINE_RE.test(body) || FILLER_DIGEST_RE.test(body)) return false;
      return true;
    });
  if (bullets.length < 3) {
    issues.push({
      field: 'research-digest',
      reason: `few-bullets(<3,got=${bullets.length})`,
    });
  }

  return issues;
}

/**
 * @param {string} designMd
 * @param {string|null} [digestMd]
 * @returns {Array<{ field: string, reason: string }>}
 */
export function findWeakDesign(designMd, digestMd = null) {
  const issues = weakDesignIssues(designMd);
  if (digestMd != null) {
    issues.push(...weakDigestIssues(digestMd));
  }
  return issues;
}

// ── CLI ────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { lane: null, positionals: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--lane') out.lane = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
    else if (a.startsWith('--')) throw new Error(`find-weak-design: unknown flag ${a}`);
    else out.positionals.push(a);
  }
  return out;
}

function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
  if (args.help) {
    console.log(
      'usage: find-weak-design.js <design.md> [<research-digest.md>] [--lane adopt|ad-hoc|single-task]',
    );
    process.exit(0);
  }
  if (isExemptLane(args.lane)) {
    console.log(
      `find-weak-design: exempt lane '${args.lane}' (R-ORCH-03) — weak-design not required ✓`,
    );
    process.exit(0);
  }
  if (!args.positionals.length) {
    console.error(
      'usage: find-weak-design.js <design.md> [<research-digest.md>] [--lane adopt|ad-hoc|single-task]',
    );
    process.exit(2);
  }

  const designPath = resolve(args.positionals[0]);
  const digestPath = args.positionals[1] ? resolve(args.positionals[1]) : null;

  if (!existsSync(designPath)) {
    console.error(`find-weak-design: design.md missing at ${designPath}`);
    process.exit(1);
  }

  let designMd;
  try {
    designMd = readFileSync(designPath, 'utf8');
  } catch (err) {
    console.error(`find-weak-design: ${err.message}`);
    process.exit(2);
  }

  let digestMd = null;
  if (digestPath) {
    if (!existsSync(digestPath)) {
      console.error(`find-weak-design: research-digest missing at ${digestPath}`);
      process.exit(1);
    }
    digestMd = readFileSync(digestPath, 'utf8');
  }

  const issues = findWeakDesign(designMd, digestMd);
  if (!issues.length) {
    console.log(`find-weak-design: design${digestPath ? ' + digest' : ''} strong enough ✓`);
    process.exit(0);
  }
  console.error(`find-weak-design: ${issues.length} weak field(s):`);
  for (const i of issues) {
    console.error(`  - ${i.field}: ${i.reason}`);
  }
  console.error(
    'HARD-BLOCK: rewrite soft language, expand Interview, make Non-goals distinct, fix research digest (≥3 bullets + repo paths).',
  );
  process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
