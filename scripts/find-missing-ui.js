#!/usr/bin/env node
/**
 * find-missing-ui.js — detector for the UI prototype stamp.
 *
 * Reads ui/ui.json next to the plan. Formats:
 * 1. screens list with prototype path and sha:
 *    { screens: [{ path: "ui/screen-1.html", sha: "<hash>" }] }
 * 2. explicit "no UI" with reason:
 *    { none: true, reason: "<reason>" }
 *
 * Refuses "none: true" when the plan touches UI surfaces (Vue, sheet, viewer, editor).
 * Refuses divergent architecture card sha when architectureSha is cited.
 * exitGateType: ui-gate does not satisfy this stamp.
 *
 * Usage:
 *   node scripts/find-missing-ui.js [--strict] <plan.md|dir>
 *
 * Exit codes:
 *   0: all checked plans carry a valid ui/ui.json stamp
 *   1: missing stamp, empty fixture, invalid screens/none, or UI touch conflict
 *   2: usage / IO / path not found
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { hashContent } from '../src/hash.js';
import {
  architectureCardSha,
  architecturePathsForPlan,
} from './find-missing-architecture.js';

export const UI_SURFACE_KEYWORDS = ['vue', 'sheet', 'viewer', 'editor'];

const WORD_RES = {
  vue: /(?:^|[^A-Za-z])vues?\b/i,
  sheet: /(?:^|[^A-Za-z])(?:spread)?sheets?\b/i,
  viewer: /(?:^|[^A-Za-z])viewers?\b/i,
  editor: /(?:^|[^A-Za-z])editors?\b/i,
};
const CAMEL_RES = {
  sheet: /[a-z]Sheet|[A-Z][a-z]+Sheet/,
  viewer: /[a-z]Viewer|[A-Z][a-z]+Viewer/,
  editor: /[a-z]Editor|[A-Z][a-z]+Editor/,
};

/**
 * @param {string} planMdPath
 * @returns {{ planPath: string, planDir: string, uiJson: string }}
 */
export function uiPathsForPlan(planMdPath) {
  const planDir = dirname(resolve(planMdPath));
  return {
    planPath: resolve(planMdPath),
    planDir,
    uiJson: join(planDir, 'ui', 'ui.json'),
  };
}

/**
 * Detect UI surface keywords in plan text.
 * @param {string} text
 * @returns {string[]} matched keywords
 */
export function detectUiKeywords(text) {
  if (typeof text !== 'string' || !text) return [];
  /** @type {string[]} */
  const found = [];
  for (const kw of UI_SURFACE_KEYWORDS) {
    const word = WORD_RES[kw];
    const camel = CAMEL_RES[kw];
    if (word.test(text) || (camel && camel.test(text))) found.push(kw);
  }
  return found;
}

/**
 * Drop YAML `outOfScope`, fenced code, and Out of scope / Fora de escopo sections.
 * @param {string} markdown
 * @returns {string}
 */
function scanTextFromMarkdown(markdown) {
  let body = markdown;
  let fmScan = '';
  const fm = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (fm) {
    body = markdown.slice(fm[0].length);
    try {
      const data = parseYaml(fm[1]);
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const rest = { ...data };
        delete rest.outOfScope;
        fmScan = JSON.stringify(rest);
      }
    } catch {
      fmScan = fm[1];
    }
  }
  const kept = [];
  let inFence = false;
  let skipUntil = 0;
  for (const line of body.split('\n')) {
    if (/^(`{3,}|~{3,})/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (heading) {
      const level = heading[1].length;
      const title = heading[2].trim();
      if (title === 'Out of scope' || title === 'Fora de escopo') {
        skipUntil = level;
        continue;
      }
      if (skipUntil && level <= skipUntil) skipUntil = 0;
    }
    if (!skipUntil) kept.push(line);
  }
  return `${fmScan}\n${kept.join('\n')}`;
}

/**
 * @param {string} planDir
 * @returns {string[]}
 */
function phaseMarkdownFiles(planDir) {
  const phasesDir = join(planDir, 'phases');
  if (!existsSync(phasesDir) || !statSync(phasesDir).isDirectory()) return [];
  /** @type {string[]} */
  const files = [];
  for (const name of readdirSync(phasesDir)) {
    if (name === 'archive') continue;
    const full = join(phasesDir, name);
    try {
      if (statSync(full).isFile() && /\.md$/i.test(name)) files.push(full);
    } catch {
      // skip unreadable entries
    }
  }
  return files;
}

/**
 * @param {string} planDir
 * @param {string} planContent
 * @returns {string[]}
 */
function collectUiKeywords(planDir, planContent) {
  const found = new Set(detectUiKeywords(scanTextFromMarkdown(planContent)));
  for (const file of phaseMarkdownFiles(planDir)) {
    try {
      for (const kw of detectUiKeywords(scanTextFromMarkdown(readFileSync(file, 'utf8')))) {
        found.add(kw);
      }
    } catch {
      // skip unreadable phase files
    }
  }
  return UI_SURFACE_KEYWORDS.filter((kw) => found.has(kw));
}

/**
 * @param {Record<string, unknown>} uiData
 * @param {string[]} issues
 * @returns {{ cited: string | null, omitted: boolean }}
 */
function readCitedSha(uiData, issues) {
  const hasArch = Object.prototype.hasOwnProperty.call(uiData, 'architectureSha');
  const hasCard = Object.prototype.hasOwnProperty.call(uiData, 'cardSha');
  /** @type {string | null} */
  let cited = null;
  if (hasArch) {
    if (typeof uiData.architectureSha !== 'string' || !uiData.architectureSha.trim()) {
      issues.push('architectureSha must be a non-empty string');
    } else {
      cited = uiData.architectureSha.trim();
    }
  }
  if (hasCard) {
    if (typeof uiData.cardSha !== 'string' || !uiData.cardSha.trim()) {
      issues.push('cardSha must be a non-empty string');
    } else {
      const cardCited = uiData.cardSha.trim();
      if (cited && cited !== cardCited) {
        issues.push(`architectureSha and cardSha conflict: ${cited} ≠ ${cardCited}`);
      } else if (!cited) {
        cited = cardCited;
      }
    }
  }
  return { cited, omitted: !hasArch && !hasCard };
}

/**
 * @param {Record<string, unknown>} uiData
 * @param {string} planPath
 * @param {string[]} issues
 */
function checkArchitectureCitation(uiData, planPath, issues) {
  const { cited, omitted } = readCitedSha(uiData, issues);
  const archPaths = architecturePathsForPlan(planPath);
  const cardExists = existsSync(archPaths.card);
  if (cardExists && omitted) {
    issues.push('ui/ui.json must cite architectureSha or cardSha when architecture/decisions.json exists');
    return;
  }
  if (!cited) return;
  if (!cardExists) {
    issues.push('architecture card missing for cited sha');
    return;
  }
  try {
    const cardRaw = readFileSync(archPaths.card, 'utf8');
    const card = JSON.parse(cardRaw);
    const expectedSha = (typeof card.sha === 'string' && card.sha.trim())
      ? card.sha.trim()
      : architectureCardSha(card);
    if (cited !== expectedSha) {
      issues.push(`architecture sha mismatch: ${cited} ≠ ${expectedSha}`);
    }
  } catch (err) {
    issues.push(`malformed architecture card: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * @param {string} planDir
 * @param {string} p
 * @param {number} index
 * @returns {string | null}
 */
function screenPathIssue(planDir, p, index) {
  if (isAbsolute(p) || p.split(/[\\/]/).includes('..')) {
    return `screens[${index}] path must be relative to the plan directory`;
  }
  const resolvedScreen = resolve(planDir, p);
  const rel = relative(planDir, resolvedScreen);
  if (!rel || isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) {
    return `screens[${index}] path must be relative to the plan directory`;
  }
  if (!existsSync(resolvedScreen)) {
    return `screens[${index}] missing prototype file: ${p}`;
  }
  if (!statSync(resolvedScreen).isFile()) {
    return `screens[${index}] path is not a file: ${p}`;
  }
  return null;
}

/**
 * @param {string} planMdPath
 * @param {{ strict?: boolean }} [opts]
 * @returns {{ ok: boolean, issues: string[], planPath: string }}
 */
export function checkPlanUi(planMdPath, opts = {}) {
  const paths = uiPathsForPlan(planMdPath);
  /** @type {string[]} */
  const issues = [];

  let planContent = '';
  try {
    planContent = readFileSync(paths.planPath, 'utf8');
  } catch (err) {
    issues.push(`cannot read plan file: ${err instanceof Error ? err.message : String(err)}`);
    return { ok: false, issues, planPath: paths.planPath };
  }

  const hasExitGateTypeUiGate = /exitGateType:\s*ui-gate/i.test(planContent);

  if (!existsSync(paths.uiJson)) {
    issues.push('missing ui/ui.json');
    if (hasExitGateTypeUiGate) {
      issues.push('exitGateType: ui-gate does not satisfy ui/ui.json');
    }
    return { ok: false, issues, planPath: paths.planPath };
  }

  let raw = '';
  try {
    raw = readFileSync(paths.uiJson, 'utf8');
  } catch (err) {
    issues.push(`cannot read ui/ui.json: ${err instanceof Error ? err.message : String(err)}`);
    return { ok: false, issues, planPath: paths.planPath };
  }

  let uiData;
  try {
    uiData = JSON.parse(raw);
  } catch (err) {
    issues.push(`malformed ui/ui.json: ${err instanceof Error ? err.message : String(err)}`);
    return { ok: false, issues, planPath: paths.planPath };
  }

  if (!uiData || typeof uiData !== 'object' || Array.isArray(uiData)) {
    issues.push('ui/ui.json must be a JSON object');
    return { ok: false, issues, planPath: paths.planPath };
  }

  checkArchitectureCitation(uiData, paths.planPath, issues);

  if (uiData.none === true) {
    const reason = typeof uiData.reason === 'string' ? uiData.reason.trim() : '';
    if (!reason) {
      issues.push('missing reason for none: true');
    }

    const keywords = collectUiKeywords(paths.planDir, planContent);
    if (keywords.length > 0) {
      issues.push(
        `cannot declare none: true when plan touches UI (${keywords.join(', ')})`,
      );
    }
  } else if (Array.isArray(uiData.screens) && uiData.screens.length > 0) {
    for (let i = 0; i < uiData.screens.length; i++) {
      const screen = uiData.screens[i];
      if (!screen || typeof screen !== 'object') {
        issues.push(`screens[${i}] must be an object`);
        continue;
      }
      const p = typeof screen.path === 'string' ? screen.path.trim() : '';
      const s = typeof screen.sha === 'string' ? screen.sha.trim() : '';
      if (!p) issues.push(`screens[${i}] missing path`);
      if (!s) issues.push(`screens[${i}] missing sha`);

      if (p) {
        const pathIssue = screenPathIssue(paths.planDir, p, i);
        if (pathIssue) {
          issues.push(pathIssue);
          continue;
        }
        try {
          const content = readFileSync(resolve(paths.planDir, p), 'utf8');
          if (content.trim() === '') {
            issues.push(`screens[${i}] empty prototype file: ${p}`);
          } else if (s) {
            const actualSha = hashContent(content);
            if (s !== actualSha) {
              issues.push(`screen sha mismatch for ${p}: ${s} ≠ ${actualSha}`);
            }
          }
        } catch (err) {
          issues.push(`cannot read screen file ${p}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  } else {
    issues.push('missing screens or none: true with reason in ui/ui.json');
  }

  void opts;
  return { ok: issues.length === 0, issues, planPath: paths.planPath };
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
  const results = planPaths.map((p) => checkPlanUi(p, opts));
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
    process.stderr.write('find-missing-ui.js: usage: [--strict] <plan.md|dir>\n');
    process.exit(2);
  }

  const resolved = existsSync(resolve(target)) ? resolve(target) : resolve(process.cwd(), target);
  if (!existsSync(resolved)) {
    process.stderr.write(`find-missing-ui.js: not found: ${target}\n`);
    process.exit(2);
  }

  const passedFile = statSync(resolved).isFile();
  const plans = findPlanMarkdownFiles(resolved);
  if (plans.length === 0) {
    if (passedFile) {
      process.stderr.write(`find-missing-ui.js: not a plan markdown file: ${target}\n`);
      process.exit(2);
    }
    process.stderr.write('find-missing-ui.js: missing ui/ui.json\n');
    process.exit(1);
  }

  const report = checkAll(plans, { strict });
  if (report.ok) {
    process.stdout.write(`find-missing-ui.js: ${plans.length} plan(s) OK\n`);
    process.exit(0);
  }

  const first = report.results.find((r) => !r.ok);
  const firstIssue = first?.issues[0] || 'failed';
  process.stderr.write(`find-missing-ui.js: ${firstIssue}\n`);
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
