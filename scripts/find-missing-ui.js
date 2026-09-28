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
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hashContent } from '../src/hash.js';
import {
  architectureCardSha,
  architecturePathsForPlan,
} from './find-missing-architecture.js';

export const UI_SURFACE_KEYWORDS = ['vue', 'sheet', 'viewer', 'editor'];
const UI_SURFACE_RE = /\b(vue|sheet|viewer|editor)\b/i;

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
  const found = new Set();
  for (const kw of UI_SURFACE_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, 'i');
    if (re.test(text)) {
      found.add(kw);
    }
  }
  return [...found];
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

  // Check architecture SHA if specified in ui.json
  const archSha = typeof uiData.architectureSha === 'string'
    ? uiData.architectureSha.trim()
    : typeof uiData.cardSha === 'string'
      ? uiData.cardSha.trim()
      : null;

  if (archSha) {
    const archPaths = architecturePathsForPlan(paths.planPath);
    if (existsSync(archPaths.card)) {
      try {
        const cardRaw = readFileSync(archPaths.card, 'utf8');
        const card = JSON.parse(cardRaw);
        const expectedSha = (typeof card.sha === 'string' && card.sha.trim())
          ? card.sha.trim()
          : architectureCardSha(card);
        if (archSha !== expectedSha) {
          issues.push(`architecture sha mismatch: ${archSha} ≠ ${expectedSha}`);
        }
      } catch {
        // card parse error handled by architecture detector
      }
    }
  }

  if (uiData.none === true) {
    const reason = typeof uiData.reason === 'string' ? uiData.reason.trim() : '';
    if (!reason) {
      issues.push('missing reason for none: true');
    }

    const keywords = detectUiKeywords(planContent);
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
        const resolvedScreen = resolve(paths.planDir, p);
        if (existsSync(resolvedScreen) && statSync(resolvedScreen).isFile()) {
          try {
            const content = readFileSync(resolvedScreen, 'utf8');
            const actualSha = hashContent(content);
            if (s && s !== actualSha) {
              issues.push(`screen sha mismatch for ${p}: ${s} ≠ ${actualSha}`);
            }
          } catch (err) {
            issues.push(`cannot read screen file ${p}: ${err instanceof Error ? err.message : String(err)}`);
          }
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
