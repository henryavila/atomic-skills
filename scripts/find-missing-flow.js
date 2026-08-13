#!/usr/bin/env node
/**
 * find-missing-flow.js — detector for plan flow artefacts.
 *
 * Checks plans for:
 *   flow/flow.json   (L1, valid graph; --strict also requires ratification stamp)
 *   flow/flow.html   (L2; --strict checks data-flow-content-sha vs L1 contentSha)
 *
 * process.yaml / map.html NEVER count as success. Detector default is
 * read-only and never writes map.html. `--ratify` is the only write path
 * (stamp via buildFlowRatification).
 *
 * Usage:
 *   node scripts/find-missing-flow.js [path-to-plan.md | .atomic-skills | repo]
 *   node scripts/find-missing-flow.js --strict …
 *   node scripts/find-missing-flow.js --json …
 *   node scripts/find-missing-flow.js --ratify <flow.json> [--ratified-by <who>]
 *
 * Exit 0 = all ok; exit 1 = missing/invalid; exit 2 = usage/IO.
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateFlow } from './lib/validate-flow.js';
import {
  contentFingerprint,
  normalizeFlow,
  sha256,
  stableStringify,
} from './lib/render-flow.js';

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

/**
 * @param {unknown} graph
 * @returns {string}
 */
export function graphSha(graph) {
  return sha256(stableStringify(graph));
}

/**
 * Only function that writes ratifiedAt + ratifiedGraphSha.
 * Returns a new document; does not mutate `doc` and does not write disk.
 *
 * @param {object} doc
 * @param {{ ratifiedAt?: string, ratifiedBy?: string }} [opts]
 */
export function buildFlowRatification(doc, opts = {}) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new Error('buildFlowRatification: doc must be a flow object');
  }
  if (!doc.graph || typeof doc.graph !== 'object' || Array.isArray(doc.graph)) {
    throw new Error('buildFlowRatification: doc.graph required');
  }
  const ratifiedAt =
    opts.ratifiedAt != null && String(opts.ratifiedAt).trim()
      ? String(opts.ratifiedAt).trim()
      : new Date().toISOString();
  const next = {
    ...doc,
    ratifiedAt,
    ratifiedGraphSha: graphSha(doc.graph),
  };
  if (opts.ratifiedBy != null) next.ratifiedBy = String(opts.ratifiedBy);
  return next;
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
    const ratified =
      raw && typeof raw === 'object' && typeof raw.ratifiedAt === 'string'
        ? raw.ratifiedAt.trim()
        : '';
    if (!ratified) {
      issues.push('L1 missing ratifiedAt (flow not ratified)');
    }
    const expectedSha = graphSha(raw.graph);
    if (typeof raw.ratifiedGraphSha !== 'string' || raw.ratifiedGraphSha !== expectedSha) {
      issues.push('L1 ratifiedGraphSha missing or does not match current graph');
    }
  }

  if (!existsSync(paths.flowHtml)) {
    issues.push(`missing L2: ${paths.flowHtml}`);
  } else if (strict) {
    try {
      const onDisk = readFileSync(paths.flowHtml, 'utf8');
      const match = onDisk.match(/data-flow-content-sha="([a-f0-9]{64})"/i);
      const htmlSha = match ? match[1] : '';
      const currentSha = contentFingerprint(normalizeFlow(raw));
      if (!htmlSha) {
        issues.push('L2 missing data-flow-content-sha');
      } else if (htmlSha !== currentSha) {
        issues.push(
          `L2 content-sha drift: data-flow-content-sha ${htmlSha.slice(0, 12)}… ≠ L1 ${currentSha.slice(0, 12)}…`,
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
 * Duplicated from find-missing-process-map (PR4 may delete that walker).
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
 * @param {{ strict?: boolean }} [opts]
 */
export function checkAll(planPaths, opts = {}) {
  const results = planPaths.map((p) => checkPlanFlow(p, opts));
  return {
    ok: results.every((r) => r.ok),
    results,
  };
}

function flagValue(args, flag) {
  const i = args.indexOf(flag);
  if (i === -1) return undefined;
  const v = args[i + 1];
  if (!v || v.startsWith('--')) return undefined;
  return v;
}

/**
 * Read flow.json, stamp via buildFlowRatification, write back.
 * @param {string} flowJsonPath
 * @param {{ ratifiedBy?: string }} [opts]
 */
export function ratifyFlowFile(flowJsonPath, opts = {}) {
  const abs = resolve(flowJsonPath);
  if (!existsSync(abs)) {
    const err = new Error(`find-missing-flow: not found: ${flowJsonPath}`);
    err.exitCode = 2;
    throw err;
  }
  let raw;
  try {
    raw = JSON.parse(readFileSync(abs, 'utf8'));
  } catch (err) {
    const wrapped = new Error(
      `find-missing-flow: L1 parse error: ${err instanceof Error ? err.message : String(err)}`,
    );
    wrapped.exitCode = 1;
    throw wrapped;
  }
  const v = validateFlow(raw);
  if (!v.valid) {
    const wrapped = new Error(
      `find-missing-flow: L1 invalid:\n${v.errors.map((e) => `  - ${formatFlowError(e)}`).join('\n')}`,
    );
    wrapped.exitCode = 1;
    throw wrapped;
  }
  const next = buildFlowRatification(raw, { ratifiedBy: opts.ratifiedBy });
  writeFileSync(abs, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--ratify')) {
    const flowJson = flagValue(args, '--ratify');
    if (!flowJson) {
      console.error('usage: find-missing-flow.js --ratify <flow.json> [--ratified-by <who>]');
      process.exit(2);
    }
    try {
      const next = ratifyFlowFile(flowJson, { ratifiedBy: flagValue(args, '--ratified-by') });
      console.log(`find-missing-flow: ratified ${resolve(flowJson)}`);
      console.log(`ratifiedGraphSha ${next.ratifiedGraphSha}`);
      process.exit(0);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(err && typeof err === 'object' && 'exitCode' in err ? err.exitCode : 1);
    }
  }

  const json = args.includes('--json');
  const strict = args.includes('--strict');
  const positional = args.filter((a) => !a.startsWith('--'));
  const target = positional[0] || join(process.cwd(), '.atomic-skills');
  const resolved = existsSync(resolve(target)) ? resolve(target) : resolve(process.cwd(), target);

  if (!existsSync(resolved)) {
    console.error(`find-missing-flow: not found: ${target}`);
    process.exit(2);
  }

  const plans = findPlanMarkdownFiles(resolved);
  if (plans.length === 0 && resolved.endsWith('plan.md')) {
    plans.push(resolved);
  }

  if (plans.length === 0) {
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
