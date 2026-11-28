/**
 * find-plans-missing-ground-truth.js — deterministic, zero-token DETECTOR of
 * materialized plans that lack a durable plan↔code ground-truth review receipt.
 *
 * The ground-truth review (review-plan Flow E / --mode=ground-truth, lazy asset
 * ground-truth-review.md) checks Direction A (plan premises that do not exist
 * in code) and Direction B (code that exists and the plan does not model).
 * Even an empty / no-product-code repo must run the review and persist an
 * explicit empty-repo result — silence is not a pass.
 *
 * Receipt (required):
 *   1. `## Reviews` line: `- ground-truth: … | mode=ground-truth | fp=<hex> | …`
 *   2. `## Ground-truth review` with Status + ### A + ### B + content floor
 *      (Scanned:, Counts:, table/none substance)
 *   3. `fp=` matches current plan substance fingerprint (+ phase initiatives)
 *
 * Exit 0 = every selected non-archived plan carries a valid ground-truth
 * receipt; exit 1 = at least one is missing/incomplete/stale.
 *
 * CLI:  node scripts/find-plans-missing-ground-truth.js [<repo|.atomic-skills|plan.md|plan-dir>]
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { parseFrontmatter } from './lib/frontmatter.js';
import {
  assessGroundTruthPlanFile,
  groundTruthReceiptGap,
  groundTruthGapMessage,
  planSubstanceText,
  fingerprintSubstance,
} from '../src/ground-truth-review.js';

export {
  groundTruthReceiptGap,
  groundTruthGapMessage,
  assessGroundTruthPlanFile,
  planSubstanceText,
  fingerprintSubstance,
};

function inferPlanMeta(filePath) {
  const abs = resolve(filePath);
  const parts = abs.split(/[\\/]+/);
  const atomicIdx = parts.lastIndexOf('.atomic-skills');
  const planFile = basename(abs);

  if (atomicIdx !== -1) {
    const afterAtomic = parts.slice(atomicIdx + 1);
    if (afterAtomic[0] === 'projects' && afterAtomic[1] && afterAtomic[2] && afterAtomic[3] === 'plan.md') {
      return { projectId: afterAtomic[1], planSlug: afterAtomic[2], planFile: 'plan.md' };
    }
    if (afterAtomic[0] === 'plans' && planFile.endsWith('.md')) {
      return { projectId: '(flat)', planSlug: 'plans', planFile };
    }
  }

  return { projectId: '(scoped)', planSlug: basename(dirname(abs)), planFile };
}

/**
 * Load phase initiative markdown next to plan.md (nested layout) for freshness.
 * @param {string} planFilePath
 * @returns {string[]}
 */
export function loadInitiativeSubstanceExtras(planFilePath) {
  const planDir = dirname(planFilePath);
  const phasesDir = join(planDir, 'phases');
  const extras = [];
  if (!existsSync(phasesDir) || !statSync(phasesDir).isDirectory()) return extras;
  for (const entry of readdirSync(phasesDir).sort()) {
    if (!entry.endsWith('.md') || entry.startsWith('.')) continue;
    // skip archive if present
    const p = join(phasesDir, entry);
    if (!statSync(p).isFile()) continue;
    try {
      extras.push(planSubstanceText(readFileSync(p, 'utf8')));
    } catch {
      // ignore unreadable
    }
  }
  return extras;
}

/** Read a plan file; push a report entry if it lacks a ground-truth receipt. */
function collectPlanFile(filePath, meta, report) {
  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch {
    return;
  }
  const parsed = parseFrontmatter(raw);
  const status = parsed.error ? undefined : parsed.frontmatter?.status;
  if (status === 'archived') return;

  const extras = loadInitiativeSubstanceExtras(filePath);
  const { gap, fingerprint } = assessGroundTruthPlanFile(raw, { extraSubstance: extras });
  if (gap) {
    report.push({
      ...meta,
      reason: gap,
      path: filePath,
      fingerprint,
    });
  }
}

function isDirectory(path) {
  return existsSync(path) && statSync(path).isDirectory();
}

/**
 * Collect one explicit file or a directory's own plan.md.
 * @returns {boolean} true when the target was handled and needs no tree scan
 */
function collectExplicitTarget(targetPath, report) {
  if (!existsSync(targetPath)) return false;
  const targetStat = statSync(targetPath);
  if (targetStat.isFile()) {
    collectPlanFile(targetPath, inferPlanMeta(targetPath), report);
    return true;
  }
  if (targetStat.isDirectory()) {
    const scopedPlanFile = join(targetPath, 'plan.md');
    if (existsSync(scopedPlanFile) && statSync(scopedPlanFile).isFile()) {
      collectPlanFile(scopedPlanFile, inferPlanMeta(scopedPlanFile), report);
      return true;
    }
  }
  return false;
}

function collectProjectPlan(projPath, projId, planSlug, report) {
  const planDir = join(projPath, planSlug);
  if (!statSync(planDir).isDirectory()) return;
  const planFile = join(planDir, 'plan.md');
  if (!existsSync(planFile) || !statSync(planFile).isFile()) return;
  collectPlanFile(planFile, { projectId: projId, planSlug, planFile: 'plan.md' }, report);
}

function collectProjectPlans(root, report) {
  const projectsDir = join(root, 'projects');
  if (!isDirectory(projectsDir)) return;
  for (const projId of readdirSync(projectsDir)) {
    const projPath = join(projectsDir, projId);
    if (!statSync(projPath).isDirectory()) continue;
    for (const planSlug of readdirSync(projPath)) {
      collectProjectPlan(projPath, projId, planSlug, report);
    }
  }
}

function collectFlatPlans(root, report) {
  const flatDir = join(root, 'plans');
  if (!isDirectory(flatDir)) return;
  for (const entry of readdirSync(flatDir)) {
    if (!entry.endsWith('.md') || entry.startsWith('.')) continue;
    collectPlanFile(
      join(flatDir, entry),
      { projectId: '(flat)', planSlug: 'plans', planFile: entry },
      report,
    );
  }
}

/**
 * Collect [{ projectId, planSlug, planFile, reason, path?, fingerprint? }] for
 * plans lacking a valid/fresh ground-truth receipt.
 */
export function findPlansMissingGroundTruth(target = process.cwd()) {
  const targetPath = resolve(target);
  const report = [];

  if (collectExplicitTarget(targetPath, report)) return report;

  const root = existsSync(join(targetPath, '.atomic-skills'))
    ? join(targetPath, '.atomic-skills')
    : targetPath;

  collectProjectPlans(root, report);
  collectFlatPlans(root, report);

  return report;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const target = resolve(process.argv[2] || process.cwd());
  const report = findPlansMissingGroundTruth(target);
  if (!report.length) {
    console.log('find-plans-missing-ground-truth: every plan carries a ground-truth review receipt ✓');
    process.exit(0);
  }
  console.log(
    `find-plans-missing-ground-truth: ${report.length} plan(s) lack a ground-truth review receipt:`,
  );
  for (const r of report) {
    const fp = r.fingerprint ? ` (current fp=${r.fingerprint})` : '';
    console.log(`  ${r.projectId}/${r.planSlug}/${r.planFile}: ${groundTruthGapMessage(r.reason)}${fp}`);
  }
  console.log(
    '\nRun `atomic-skills:review-plan --mode=ground-truth <plan>` (Flow E; alias --mode=gt).',
  );
  console.log(
    'Persist `## Ground-truth review` (Status + Scanned + ### A + ### B + Counts) and',
  );
  console.log(
    '`- ground-truth: … | mode=ground-truth | fp=<hex> | …` under `## Reviews` (fp from plan substance).',
  );
  process.exit(1);
}
