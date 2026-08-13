#!/usr/bin/env node
/**
 * find-missing-flow.js — detector for plan flow artefacts.
 *
 * Checks plans for:
 *   flow/flow.json   (L1, valid MODEL graph)
 *   flow/flow.html   (L2; --strict / --check require matching content-sha)
 *
 * --strict (M4) also requires:
 *   ≥1 messages, ≥1 machine with ≥1 state,
 *   ratifiedAt set, ratifiedGraphSha == current document sha,
 *   flow.html exists with matching content-sha.
 *
 * process.yaml / map.html NEVER count as success. This detector is
 * read-only (no --ratify). Stamp writes belong to buildFlowRatification.
 *
 * Usage:
 *   node scripts/find-missing-flow.js [path-to-any.md | .atomic-skills | repo]
 *   node scripts/find-missing-flow.js --strict …
 *   node scripts/find-missing-flow.js --check …   (alias of --strict)
 *   node scripts/find-missing-flow.js --json …
 *
 * An existing *.md file (AS plan.md or foreign cutover.md) is the plan.
 * `note: no-plans` is only for directory scans, never for a passed file.
 *
 * Exit 0 = all ok; exit 1 = missing/invalid; exit 2 = usage/IO.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateFlow } from './lib/validate-flow.js';
import { contentFingerprint, normalizeFlow } from './lib/render-flow.js';

/**
 * @param {string} planMdPath
 * @returns {{ planPath: string, planDir: string, flowJson: string, flowHtml: string }}
 */
export function flowPathsForPlan(planMdPath) {
  const planDir = dirname(resolve(planMdPath));
  return {
    planPath: resolve(planMdPath),
    planDir,
    flowJson: join(planDir, 'flow', 'flow.json'),
    flowHtml: join(planDir, 'flow', 'flow.html'),
  };
}

function isNodeMap(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function countMessagesInNodes(nodes) {
  if (!isNodeMap(nodes)) return 0;
  let n = 0;
  for (const node of Object.values(nodes)) {
    if (!Array.isArray(node?.messages)) continue;
    for (const message of node.messages) {
      if (message && typeof message === 'object') n += 1;
    }
  }
  return n;
}

/**
 * Count messages in the required document (graph + subgraphs).
 * @param {object} doc
 */
export function countFlowMessages(doc) {
  let n = countMessagesInNodes(doc?.graph?.nodes);
  const subgraphs = doc?.graph?.subgraphs;
  if (isNodeMap(subgraphs)) {
    for (const subgraph of Object.values(subgraphs)) {
      n += countMessagesInNodes(subgraph?.nodes);
    }
  }
  return n;
}

/**
 * True when machines[] has ≥1 machine with ≥1 state node.
 * @param {object} doc
 */
export function hasMachineWithState(doc) {
  if (!Array.isArray(doc?.machines)) return false;
  return doc.machines.some(
    (machine) =>
      machine &&
      typeof machine === 'object' &&
      isNodeMap(machine.nodes) &&
      Object.keys(machine.nodes).length >= 1,
  );
}

/**
 * Sha of the required document (graph + messages + machines).
 * Matches HTML content-sha: normalizeFlow drops ratification fields.
 * @param {object} doc
 * @returns {string}
 */
export function flowDocumentSha(doc) {
  return contentFingerprint(normalizeFlow(doc));
}

/**
 * Read data-fl-content-sha (F1 render) or data-flow-content-sha (alias).
 * @param {string} html
 * @returns {string}
 */
export function extractHtmlContentSha(html) {
  if (typeof html !== 'string') return '';
  const match = html.match(/data-(?:fl|flow)-content-sha="([a-f0-9]{64})"/i);
  return match ? match[1] : '';
}

function formatFlowError(error) {
  if (!error) return 'invalid';
  if (typeof error === 'string') return error;
  return error.message ?? String(error);
}

/**
 * @param {string} planMdPath
 * @param {{ strict?: boolean }} [opts]
 * @returns {{ ok: boolean, issues: string[], planPath: string }}
 */
export function checkPlanFlow(planMdPath, opts = {}) {
  const strict = opts.strict === true;
  const paths = flowPathsForPlan(planMdPath);
  /** @type {string[]} */
  const issues = [];

  const processYaml = join(paths.planDir, 'process', 'process.yaml');
  const mapHtml = join(paths.planDir, 'process', 'map.html');
  const processMapPresent = existsSync(processYaml) || existsSync(mapHtml);

  if (!existsSync(paths.flowJson)) {
    issues.push(`missing L1: ${paths.flowJson}`);
    if (processMapPresent) {
      issues.push('process.yaml / map.html do not satisfy flow');
    }
    if (!existsSync(paths.flowHtml)) {
      issues.push(`missing L2: ${paths.flowHtml}`);
    }
    return { ok: false, issues, planPath: paths.planPath };
  }

  let raw;
  try {
    raw = JSON.parse(readFileSync(paths.flowJson, 'utf8'));
  } catch (err) {
    issues.push(`L1 parse error: ${err instanceof Error ? err.message : String(err)}`);
    return { ok: false, issues, planPath: paths.planPath };
  }

  const v = validateFlow(raw);
  if (!v.valid) {
    for (const e of v.errors) issues.push(`L1 invalid: ${formatFlowError(e)}`);
    return { ok: false, issues, planPath: paths.planPath };
  }

  if (!raw.graph || typeof raw.graph !== 'object' || Array.isArray(raw.graph)) {
    issues.push('L1 missing/invalid graph');
    return { ok: false, issues, planPath: paths.planPath };
  }

  if (strict) {
    if (countFlowMessages(raw) < 1) {
      issues.push('L1 missing messages (need ≥1 message)');
    }
    if (!hasMachineWithState(raw)) {
      issues.push('L1 missing machine with ≥1 state');
    }
    const ratified =
      raw && typeof raw === 'object' && typeof raw.ratifiedAt === 'string'
        ? raw.ratifiedAt.trim()
        : '';
    if (!ratified) {
      issues.push('L1 missing ratifiedAt (flow not ratified)');
    }
    let expectedSha = '';
    try {
      expectedSha = flowDocumentSha(raw);
    } catch (err) {
      issues.push(
        `L1 document sha failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (expectedSha) {
      if (typeof raw.ratifiedGraphSha !== 'string' || raw.ratifiedGraphSha !== expectedSha) {
        issues.push('L1 ratifiedGraphSha missing or does not match current graph/doc');
      }
    }
  }

  if (!existsSync(paths.flowHtml)) {
    issues.push(`missing L2: ${paths.flowHtml}`);
  } else if (strict) {
    try {
      const onDisk = readFileSync(paths.flowHtml, 'utf8');
      const htmlSha = extractHtmlContentSha(onDisk);
      const currentSha = flowDocumentSha(raw);
      if (!htmlSha) {
        issues.push('L2 missing data-fl-content-sha / data-flow-content-sha');
      } else if (htmlSha !== currentSha) {
        issues.push(
          `L2 content-sha drift: html ${htmlSha.slice(0, 12)}… ≠ L1 ${currentSha.slice(0, 12)}…`,
        );
      }
    } catch (err) {
      issues.push(`L2 check failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { ok: issues.length === 0, issues, planPath: paths.planPath };
}

/**
 * Discover plan markdown files under a root.
 * An existing *.md file (any name — AS plan.md or foreign source.md) is the plan.
 * Directory roots still walk nested projects/<id>/<slug>/plan.md.
 * @param {string} root
 * @returns {string[]}
 */
export function findPlanMarkdownFiles(root) {
  const abs = resolve(root);
  /** @type {string[]} */
  const out = [];

  if (existsSync(abs) && statSync(abs).isFile()) {
    return /\.md$/i.test(abs) ? [abs] : [];
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
 * @param {{ strict?: boolean }} [opts]
 */
export function checkAll(planPaths, opts = {}) {
  const results = planPaths.map((p) => checkPlanFlow(p, opts));
  return {
    ok: results.every((r) => r.ok),
    results,
  };
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const strict = args.includes('--strict') || args.includes('--check');
  const positional = args.filter((a) => !a.startsWith('--'));
  const target = positional[0] || join(process.cwd(), '.atomic-skills');
  const resolved = existsSync(resolve(target)) ? resolve(target) : resolve(process.cwd(), target);

  if (!existsSync(resolved)) {
    console.error(`find-missing-flow: not found: ${target}`);
    process.exit(2);
  }

  const passedFile = statSync(resolved).isFile();
  const plans = findPlanMarkdownFiles(resolved);

  if (plans.length === 0) {
    if (passedFile) {
      console.error(`find-missing-flow: not a plan markdown file: ${target}`);
      process.exit(2);
    }
    if (json) {
      console.log(JSON.stringify({ ok: true, results: [], note: 'no-plans' }));
    } else {
      console.log('find-missing-flow: no nested plan.md found (ok)');
    }
    process.exit(0);
  }

  const report = checkAll(plans, { strict });
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (report.ok) {
    console.log(`find-missing-flow: ${plans.length} plan(s) OK`);
  } else {
    console.error('find-missing-flow: FAIL');
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
