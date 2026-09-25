#!/usr/bin/env node
/**
 * find-missing-architecture.js — detector for the block-card stamp.
 *
 * Reads architecture/decisions.json next to the plan. Two sketches of one
 * closed block: delimiter, outside list, mix line or "não mistura", second
 * sketch with an empty outside list, chosen sketch, sha, ratifiedAt.
 * Chat "ok" does not stamp. userApproved and find-missing-design-process.js
 * are not this card.
 *
 * Usage:
 *   node scripts/find-missing-architecture.js [--strict] <plan.md|dir>
 *
 * --strict is the implement-style hard fail (same checks). Exit 0 only with
 * sha and ratifiedAt matching the drawing. Exit 1 when the file, sketches,
 * chosen sketch, stamp, or drawing is missing. Exit 2 for usage/IO.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hashContent } from '../src/hash.js';

export const FORBIDDEN_PHRASES = [
  'se eu mexer nisto',
  'a outra',
  'consistente',
  'isolado',
];

const ISO_TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const NADA_MISTURA_RE = /^n[aã]o mistura$/i;

/**
 * @param {string} planMdPath
 * @returns {{ planPath: string, planDir: string, card: string }}
 */
export function architecturePathsForPlan(planMdPath) {
  const planDir = dirname(resolve(planMdPath));
  return {
    planPath: resolve(planMdPath),
    planDir,
    card: join(planDir, 'architecture', 'decisions.json'),
  };
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed === '') return false;
  if (/^ok$/i.test(trimmed)) return false;
  if (!ISO_TIMESTAMP_RE.test(trimmed)) return false;
  return Number.isFinite(Date.parse(trimmed));
}

/**
 * @param {unknown} card
 * @returns {{ name: string, start: string, end: string }}
 */
function blockOf(card) {
  const block =
    card && typeof card === 'object' && !Array.isArray(card) && 'block' in card
      ? /** @type {{ block?: unknown }} */ (card).block
      : null;
  const obj = block && typeof block === 'object' && !Array.isArray(block)
    ? /** @type {Record<string, unknown>} */ (block)
    : {};
  const delim =
    obj.delimiter && typeof obj.delimiter === 'object' && !Array.isArray(obj.delimiter)
      ? /** @type {Record<string, unknown>} */ (obj.delimiter)
      : {};
  return {
    name: typeof obj.name === 'string' ? obj.name.trim() : '',
    start: typeof obj.start === 'string'
      ? obj.start.trim()
      : typeof delim.start === 'string'
        ? delim.start.trim()
        : '',
    end: typeof obj.end === 'string'
      ? obj.end.trim()
      : typeof delim.end === 'string'
        ? delim.end.trim()
        : '',
  };
}

/**
 * @param {unknown} raw
 * @returns {Array<{ id: string, outside: string[] | null, mix: string, index: number }>}
 */
function normalizeSketches(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const obj = item && typeof item === 'object' && !Array.isArray(item)
      ? /** @type {Record<string, unknown>} */ (item)
      : {};
    const mixRaw = obj.mix ?? obj.mistura ?? obj.mixLine;
    const outsideRaw = obj.outside ?? obj.fora;
    /** @type {string[] | null} */
    let outside = null;
    if (Array.isArray(outsideRaw)) {
      outside = outsideRaw.map((entry) => String(entry).trim()).filter((entry) => entry !== '');
    }
    const id = typeof obj.id === 'string' && obj.id.trim() !== ''
      ? obj.id.trim()
      : String(index);
    return {
      id,
      outside,
      mix: typeof mixRaw === 'string' ? mixRaw.trim() : '',
      index,
    };
  });
}

/**
 * @param {unknown} chosen
 * @param {Array<{ id: string, index: number }>} sketches
 * @returns {number | null}
 */
function resolveChosenIndex(chosen, sketches) {
  if (chosen == null || chosen === '') return null;
  const token = String(chosen).trim();
  if (token === '') return null;
  const validated = sketches.slice(0, 2);
  if (validated.length !== 2) return null;
  const byId = validated.findIndex((sketch) => sketch.id === token);
  if (byId !== -1) return byId;
  if (/^\d+$/.test(token)) {
    const n = Number(token);
    if (n === 1) return 0;
    if (n === 2) return 1;
  }
  return null;
}

/**
 * Canonical sha of the drawing (block + sketches + chosen). Stamp fields
 * are excluded so ratification cannot change the drawing hash.
 * @param {unknown} card
 * @returns {string}
 */
export function architectureCardSha(card) {
  const block = blockOf(card);
  const sketches = normalizeSketches(
    card && typeof card === 'object' && !Array.isArray(card)
      ? /** @type {{ sketches?: unknown }} */ (card).sketches
      : [],
  );
  const chosen =
    card && typeof card === 'object' && !Array.isArray(card)
      ? /** @type {{ chosen?: unknown }} */ (card).chosen ?? ''
      : '';
  return hashContent(
    JSON.stringify({
      block,
      sketches: sketches.map((sketch) => ({
        id: sketch.id,
        outside: sketch.outside,
        mix: sketch.mix,
      })),
      chosen,
    }),
  );
}

/**
 * @param {unknown} card
 * @returns {string[]}
 */
function drawingStrings(card) {
  const block = blockOf(card);
  const sketches = normalizeSketches(
    card && typeof card === 'object' && !Array.isArray(card)
      ? /** @type {{ sketches?: unknown }} */ (card).sketches
      : [],
  );
  /** @type {string[]} */
  const out = [block.name, block.start, block.end];
  if (card && typeof card === 'object' && !Array.isArray(card)) {
    const chosen = /** @type {{ chosen?: unknown }} */ (card).chosen;
    if (typeof chosen === 'string') out.push(chosen);
  }
  for (const sketch of sketches) {
    out.push(sketch.id, sketch.mix);
    if (Array.isArray(sketch.outside)) out.push(...sketch.outside);
  }
  return out;
}

/**
 * @param {unknown} card
 * @returns {string[]}
 */
function forbiddenPhraseHits(card) {
  const haystack = drawingStrings(card).join('\n').toLowerCase();
  return FORBIDDEN_PHRASES.filter((phrase) => {
    const escaped = phrase.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^a-z0-9_])${escaped}([^a-z0-9_]|$)`);
    return re.test(haystack);
  });
}

/**
 * @param {string} planMdPath
 * @param {{ strict?: boolean }} [opts]
 * @returns {{ ok: boolean, issues: string[], planPath: string, chosenIndex: number | null }}
 */
export function checkPlanArchitecture(planMdPath, opts = {}) {
  const strict = opts.strict === true;
  const paths = architecturePathsForPlan(planMdPath);
  /** @type {string[]} */
  const issues = [];

  if (!existsSync(paths.card)) {
    issues.push(`missing architecture/decisions.json`);
    issues.push(
      'userApproved / find-missing-design-process.js do not satisfy architecture/decisions.json',
    );
    return { ok: false, issues, planPath: paths.planPath };
  }

  let raw;
  try {
    raw = JSON.parse(readFileSync(paths.card, 'utf8'));
  } catch (err) {
    issues.push(
      `invalid architecture/decisions.json: ${err instanceof Error ? err.message : String(err)}`,
    );
    return { ok: false, issues, planPath: paths.planPath };
  }

  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    issues.push('architecture/decisions.json must be an object');
    return { ok: false, issues, planPath: paths.planPath };
  }

  const card = /** @type {Record<string, unknown>} */ (raw);
  const block = blockOf(card);
  if (!block.name) issues.push('missing block name');
  if (!block.start || !block.end) {
    issues.push('missing block delimiter (start and end)');
  }

  const sketches = normalizeSketches(card.sketches);
  if (sketches.length !== 2) {
    issues.push('missing two sketches');
  } else {
    const first = sketches[0];
    const second = sketches[1];
    if (!Array.isArray(first.outside)) {
      issues.push('sketch 1 missing outside list');
    } else if (first.outside.length === 0) {
      issues.push('nada fora is not the default; sketch 1 must list what stayed outside');
    }
    if (!first.mix) {
      issues.push('sketch 1 missing mix line');
    } else if (NADA_MISTURA_RE.test(first.mix) && Array.isArray(first.outside) && first.outside.length > 0) {
      issues.push('sketch 1 mix must name the join step (not "não mistura")');
    }
    if (!Array.isArray(second.outside)) {
      issues.push('second sketch must list outside (empty list)');
    } else if (second.outside.length !== 0) {
      issues.push('second sketch outside list must be empty');
    }
    if (!second.mix) {
      issues.push('second sketch missing mix line');
    } else if (!NADA_MISTURA_RE.test(second.mix)) {
      issues.push('second sketch mix must be "não mistura"');
    }
  }

  const chosenIndex = resolveChosenIndex(card.chosen, sketches);
  if (chosenIndex == null) {
    issues.push('missing chosen sketch');
  }

  const hits = forbiddenPhraseHits(card);
  const drawingComplete =
    Boolean(block.name && block.start && block.end) &&
    sketches.length === 2 &&
    Array.isArray(sketches[0]?.outside) &&
    sketches[0].outside.length > 0 &&
    Boolean(sketches[0].mix) &&
    Array.isArray(sketches[1]?.outside) &&
    sketches[1].outside.length === 0 &&
    Boolean(sketches[1].mix) &&
    chosenIndex != null;
  if (hits.length > 0 && !drawingComplete) {
    issues.push(
      `forbidden phrase without the drawing: ${hits.join(', ')}`,
    );
  }

  const sha = typeof card.sha === 'string' ? card.sha.trim() : '';
  const expectedSha = architectureCardSha(card);
  if (!sha) {
    issues.push('missing sha');
  } else if (sha !== expectedSha) {
    issues.push(
      `sha does not match drawing: ${sha.slice(0, 12)}… ≠ ${expectedSha.slice(0, 12)}…`,
    );
  }

  if (!isIsoTimestamp(card.ratifiedAt)) {
    issues.push('missing ratifiedAt');
  }

  void strict;
  return { ok: issues.length === 0, issues, planPath: paths.planPath, chosenIndex };
}

/**
 * @param {string} root
 * @returns {string[]}
 */
export function findPlanMarkdownFiles(root) {
  const abs = resolve(root);
  if (existsSync(abs) && statSync(abs).isFile()) {
    return /\.md$/i.test(abs) ? [abs] : [];
  }

  const nestedPlan = join(abs, 'plan.md');
  if (existsSync(nestedPlan) && statSync(nestedPlan).isFile()) {
    return [nestedPlan];
  }

  const projects = join(abs, 'projects');
  const stateRoot = existsSync(projects)
    ? abs
    : existsSync(join(abs, '.atomic-skills', 'projects'))
      ? join(abs, '.atomic-skills')
      : abs;
  const projectsDir = join(stateRoot, 'projects');
  /** @type {string[]} */
  const out = [];
  if (!existsSync(projectsDir)) return out;
  for (const projectId of readdirSync(projectsDir).sort()) {
    const pdir = join(projectsDir, projectId);
    if (!statSync(pdir).isDirectory()) continue;
    for (const slug of readdirSync(pdir).sort()) {
      const planMd = join(pdir, slug, 'plan.md');
      if (existsSync(planMd)) out.push(planMd);
    }
  }
  return out;
}

/**
 * @param {string[]} planPaths
 * @param {{ strict?: boolean }} [opts]
 */
export function checkAll(planPaths, opts = {}) {
  const results = planPaths.map((p) => checkPlanArchitecture(p, opts));
  return {
    ok: results.every((r) => r.ok),
    results,
  };
}

function main() {
  const args = process.argv.slice(2);
  const strict = args.includes('--strict') || args.includes('--check');
  const positional = args.filter((a) => !a.startsWith('--'));
  const target = positional[0];
  if (!target) {
    process.stderr.write(
      'find-missing-architecture.js: usage: [--strict] <plan.md|dir>\n',
    );
    process.exit(2);
  }

  const resolved = existsSync(resolve(target)) ? resolve(target) : resolve(process.cwd(), target);
  if (!existsSync(resolved)) {
    process.stderr.write(`find-missing-architecture.js: not found: ${target}\n`);
    process.exit(2);
  }

  const passedFile = statSync(resolved).isFile();
  const plans = findPlanMarkdownFiles(resolved);
  if (plans.length === 0) {
    if (passedFile) {
      process.stderr.write(`find-missing-architecture.js: not a plan markdown file: ${target}\n`);
      process.exit(2);
    }
    process.stderr.write(`find-missing-architecture.js: missing architecture/decisions.json\n`);
    process.exit(1);
  }

  const report = checkAll(plans, { strict });
  if (report.ok) {
    process.stdout.write(`find-missing-architecture.js: ${plans.length} plan(s) OK\n`);
    process.exit(0);
  }

  const first = report.results.find((r) => !r.ok);
  const firstIssue = first?.issues[0] || 'failed';
  process.stderr.write(`find-missing-architecture.js: ${firstIssue}\n`);
  for (const r of report.results) {
    if (r.ok) continue;
    process.stderr.write(`  ${r.planPath}\n`);
    for (const issue of r.issues) process.stderr.write(`    - ${issue}\n`);
  }
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
