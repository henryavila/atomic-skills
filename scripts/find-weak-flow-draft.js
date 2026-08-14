#!/usr/bin/env node
/**
 * find-weak-flow-draft.js — read-only detector of a weak plan→graph draft.
 *
 * Authoring gate (not implement / --strict). Refuses a missing or empty
 * flow/brief.json (rule 1). Rules 2–7 live in later commits.
 *
 *   node scripts/find-weak-flow-draft.js <plan.md>
 *
 * Exit 0 = ok, 1 = weak, 2 = usage/IO.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { flowPathsForPlan } from './find-missing-flow.js';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

/**
 * @param {string} planMdPath
 * @returns {{ ok: boolean, issues: string[], planPath: string }}
 */
export function checkFlowDraft(planMdPath) {
  const paths = flowPathsForPlan(planMdPath);
  /** @type {string[]} */
  const issues = [];

  if (!existsSync(paths.flowBrief)) {
    issues.push(`missing brief: ${paths.flowBrief}`);
    return { ok: false, issues, planPath: paths.planPath };
  }

  let brief;
  try {
    brief = JSON.parse(readFileSync(paths.flowBrief, 'utf8'));
  } catch (err) {
    issues.push(
      `brief parse error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return { ok: false, issues, planPath: paths.planPath };
  }

  if (!brief || typeof brief !== 'object' || Array.isArray(brief)) {
    issues.push('brief is not an object');
    return { ok: false, issues, planPath: paths.planPath };
  }

  if (!isNonEmptyString(brief.actor)) issues.push('brief actor is empty');
  if (!isNonEmptyString(brief.scenario)) issues.push('brief scenario is empty');
  if (!isNonEmptyArray(brief.decisions)) issues.push('brief decisions is empty');
  if (!isNonEmptyArray(brief.stateChanges)) {
    issues.push('brief stateChanges is empty');
  }

  return {
    ok: issues.length === 0,
    issues,
    planPath: paths.planPath,
  };
}

function main(argv) {
  const positional = argv.filter((a) => !a.startsWith('--'));
  const target = positional[0];
  if (!target) {
    console.error('usage: find-weak-flow-draft.js <plan.md>');
    process.exit(2);
  }
  const abs = resolve(target);
  if (!existsSync(abs)) {
    console.error(`find-weak-flow-draft: not found: ${target}`);
    process.exit(2);
  }
  const report = checkFlowDraft(abs);
  if (report.ok) {
    console.log('find-weak-flow-draft: ok');
    process.exit(0);
  }
  console.error('find-weak-flow-draft: FAIL');
  for (const issue of report.issues) console.error(`  - ${issue}`);
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2));
}
