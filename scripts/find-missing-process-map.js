#!/usr/bin/env node
/**
 * find-missing-process-map.js — HARD detector for Iron Law P1
 * (NO PLAN WITHOUT PROCESS MAP).
 *
 * Checks nested plans for:
 *   process/process.yaml  (L1, valid + ratifiedAt)
 *   process/map.html      (L2, exists; optional --strict-html checks content-sha)
 *
 * Usage:
 *   node scripts/find-missing-process-map.js [path-to-plan.md | .atomic-skills | repo]
 *   node scripts/find-missing-process-map.js --json …
 *
 * Exit 0 = all ok; exit 1 = missing/invalid; exit 2 = usage/IO.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'yaml';
import { validateProcessMap, buildProcessMapHtml, sha256 } from './lib/render-process-map.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const DS_CSS = join(PROJECT_ROOT, 'site', 'assets', 'ds.css');

/**
 * @param {string} planMdPath
 * @returns {{ planPath: string, processYaml: string, mapHtml: string, planDir: string }}
 */
export function processMapPathsForPlan(planMdPath) {
  const planDir = dirname(resolve(planMdPath));
  return {
    planPath: resolve(planMdPath),
    planDir,
    processYaml: join(planDir, 'process', 'process.yaml'),
    mapHtml: join(planDir, 'process', 'map.html'),
  };
}

/**
 * @param {string} planMdPath
 * @param {{ strictHtml?: boolean, dsCss?: string }} [opts]
 * @returns {{ ok: boolean, issues: string[], planPath: string }}
 */
export function checkPlanProcessMap(planMdPath, opts = {}) {
  const paths = processMapPathsForPlan(planMdPath);
  /** @type {string[]} */
  const issues = [];

  if (!existsSync(paths.processYaml)) {
    issues.push(`missing L1: ${paths.processYaml}`);
    return { ok: false, issues, planPath: paths.planPath };
  }

  let raw;
  try {
    raw = parse(readFileSync(paths.processYaml, 'utf8'));
  } catch (err) {
    issues.push(`L1 parse error: ${err instanceof Error ? err.message : String(err)}`);
    return { ok: false, issues, planPath: paths.planPath };
  }

  const v = validateProcessMap(raw);
  if (!v.ok) {
    for (const e of v.errors) issues.push(`L1 invalid: ${e}`);
  } else {
    const ratified =
      raw && typeof raw === 'object' && typeof /** @type {any} */ (raw).ratifiedAt === 'string'
        ? /** @type {any} */ (raw).ratifiedAt.trim()
        : '';
    if (!ratified) {
      issues.push('L1 missing ratifiedAt (map not ratified)');
    }
  }

  if (!existsSync(paths.mapHtml)) {
    issues.push(`missing L2: ${paths.mapHtml}`);
  } else if (opts.strictHtml && issues.length === 0 && existsSync(DS_CSS)) {
    try {
      const dsCss = opts.dsCss ?? readFileSync(DS_CSS, 'utf8');
      const built = buildProcessMapHtml(raw, dsCss);
      const onDisk = readFileSync(paths.mapHtml, 'utf8');
      if (onDisk !== built.html) {
        issues.push(
          `L2 drift: map.html sha ${sha256(onDisk).slice(0, 12)}… ≠ rendered ${sha256(built.html).slice(0, 12)}…`
        );
      }
    } catch (err) {
      issues.push(`L2 check failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { ok: issues.length === 0, issues, planPath: paths.planPath };
}

/**
 * Discover nested plan.md files under a root.
 * @param {string} root
 * @returns {string[]}
 */
export function findPlanMarkdownFiles(root) {
  const abs = resolve(root);
  /** @type {string[]} */
  const out = [];

  if (existsSync(abs) && abs.endsWith('plan.md') && statSync(abs).isFile()) {
    return [abs];
  }

  const projects = join(abs, 'projects');
  const stateRoot = existsSync(projects)
    ? abs
    : existsSync(join(abs, '.atomic-skills', 'projects'))
      ? join(abs, '.atomic-skills')
      : abs;

  const projectsDir = join(stateRoot, 'projects');
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
 * @param {{ strictHtml?: boolean }} [opts]
 */
export function checkAll(planPaths, opts = {}) {
  const results = planPaths.map((p) => checkPlanProcessMap(p, opts));
  return {
    ok: results.every((r) => r.ok),
    results,
  };
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const strictHtml = args.includes('--strict-html');
  const positional = args.filter((a) => !a.startsWith('--'));
  const target = positional[0] || join(process.cwd(), '.atomic-skills');

  if (!existsSync(resolve(target)) && !existsSync(join(process.cwd(), target))) {
    console.error(`find-missing-process-map: not found: ${target}`);
    process.exit(2);
  }

  const plans = findPlanMarkdownFiles(target);
  if (plans.length === 0 && resolve(target).endsWith('plan.md')) {
    plans.push(resolve(target));
  }

  if (plans.length === 0) {
    if (json) {
      console.log(JSON.stringify({ ok: true, results: [], note: 'no-plans' }));
    } else {
      console.log('find-missing-process-map: no nested plan.md found (ok)');
    }
    process.exit(0);
  }

  const report = checkAll(plans, { strictHtml });
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (report.ok) {
    console.log(`find-missing-process-map: ${plans.length} plan(s) OK`);
  } else {
    console.error('find-missing-process-map: FAIL');
    for (const r of report.results) {
      if (r.ok) continue;
      console.error(`  ${r.planPath}`);
      for (const i of r.issues) console.error(`    - ${i}`);
    }
  }
  process.exit(report.ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
