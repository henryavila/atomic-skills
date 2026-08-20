#!/usr/bin/env node
/**
 * find-weak-flow-draft.js — read-only detector of a weak plan→graph draft.
 *
 * Authoring gate (not implement / --strict). Seven refuse rules:
 * missing brief, orphan xor/machine, decision without xor/outcomes,
 * phase/task ids, UI tokens on BPM labels, xor <2 branches, no messages/machine.
 *
 *   node scripts/find-weak-flow-draft.js <plan.md>
 *
 * Exit 0 = ok, 1 = weak, 2 = usage/IO.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  countFlowMessages,
  flowPathsForPlan,
  hasMachineWithState,
} from './find-missing-flow.js';

const PHASE_ID_RE = /^F\d+$/i;
const TASK_ID_RE = /^T-\d+/;
const UI_TOKEN_RE = /\b(clique|click|modal|tela)\b/i;

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

  if (issues.length) {
    return { ok: false, issues, planPath: paths.planPath };
  }

  if (!existsSync(paths.flowJson)) {
    issues.push(`missing flow: ${paths.flowJson}`);
    return { ok: false, issues, planPath: paths.planPath };
  }

  let flow;
  try {
    flow = JSON.parse(readFileSync(paths.flowJson, 'utf8'));
  } catch (err) {
    issues.push(
      `flow parse error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return { ok: false, issues, planPath: paths.planPath };
  }

  collectTraceIssues(brief, flow, issues);

  return {
    ok: issues.length === 0,
    issues,
    planPath: paths.planPath,
  };
}

function nodeMaps(flow) {
  const maps = [];
  const nodes = flow?.graph?.nodes;
  if (nodes && typeof nodes === 'object' && !Array.isArray(nodes)) maps.push(nodes);
  const subgraphs = flow?.graph?.subgraphs;
  if (subgraphs && typeof subgraphs === 'object' && !Array.isArray(subgraphs)) {
    for (const sub of Object.values(subgraphs)) {
      if (sub?.nodes && typeof sub.nodes === 'object' && !Array.isArray(sub.nodes)) {
        maps.push(sub.nodes);
      }
    }
  }
  return maps;
}

function decisionIds(brief) {
  return new Set(
    (brief.decisions || [])
      .map((d) => (typeof d?.id === 'string' ? d.id : ''))
      .filter(Boolean),
  );
}

function stateChangeIds(brief) {
  return new Set(
    (brief.stateChanges || [])
      .map((s) => (typeof s?.id === 'string' ? s.id : ''))
      .filter(Boolean),
  );
}

function collectTraceIssues(brief, flow, issues) {
  const decisions = decisionIds(brief);
  const changes = stateChangeIds(brief);
  const maps = nodeMaps(flow);

  for (const nodes of maps) {
    for (const [id, node] of Object.entries(nodes)) {
      if (PHASE_ID_RE.test(id) || TASK_ID_RE.test(id)) {
        issues.push(`phase/task id in graph: ${id}`);
      }
      const label = typeof node?.label === 'string' ? node.label : '';
      if (PHASE_ID_RE.test(label) || TASK_ID_RE.test(label)) {
        issues.push(`phase/task label in graph: ${label}`);
      }
      if (UI_TOKEN_RE.test(label)) {
        issues.push(`UI token in BPM label: ${label}`);
      }
      if (node?.type === 'xor') {
        const branches = Array.isArray(node.branches) ? node.branches : [];
        if (branches.length < 2) {
          issues.push(`xor '${id}' has fewer than 2 branches`);
        }
        if (!decisions.has(id)) {
          issues.push(`orphan xor '${id}' is not in brief decisions`);
        }
      }
    }
  }

  for (const decision of brief.decisions) {
    if (!decision || typeof decision.id !== 'string') continue;
    let found = null;
    for (const nodes of maps) {
      if (nodes[decision.id]?.type === 'xor') {
        found = nodes[decision.id];
        break;
      }
    }
    if (!found) {
      issues.push(`decision '${decision.id}' has no matching xor`);
      continue;
    }
    const branches = Array.isArray(found.branches) ? found.branches : [];
    const covered = new Set();
    for (const branch of branches) {
      if (typeof branch?.when === 'string') covered.add(branch.when);
      if (typeof branch?.label === 'string') covered.add(branch.label);
    }
    const outcomes = Array.isArray(decision.outcomes) ? decision.outcomes : [];
    for (const outcome of outcomes) {
      if (typeof outcome !== 'string') continue;
      const hit = [...covered].some(
        (value) => value === outcome || value.toLowerCase() === outcome.toLowerCase(),
      );
      if (!hit) {
        issues.push(`decision '${decision.id}' missing outcome '${outcome}'`);
      }
    }
  }

  const machines = Array.isArray(flow?.machines) ? flow.machines : [];
  for (const machine of machines) {
    if (machine && typeof machine.id === 'string' && !changes.has(machine.id)) {
      issues.push(`orphan machine '${machine.id}' is not in brief stateChanges`);
    }
  }

  if (countFlowMessages(flow) < 1) {
    issues.push('flow has no messages');
  }
  if (!hasMachineWithState(flow)) {
    issues.push('flow has no machine with ≥1 state');
  }
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
