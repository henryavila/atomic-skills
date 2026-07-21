/**
 * assert-automate-gate.js — thin CLI over Layer-1 pure automate STOP helpers.
 *
 * No spawn, no git merge, no durable state mutation. Reads plan/lease/claim
 * from disk and prints ok|blocked + reason; exit 0 only when ok.
 *
 * Usage:
 *   node scripts/assert-automate-gate.js --plan <slug> --gate <gate> [options]
 *
 * Gates: spawn | claims | done | phase-done | finalize
 *
 * Options:
 *   --project <id>           Prefer projects/<id>/<slug>/plan.md
 *   --state-root <path>      Default: ./.atomic-skills (cwd-relative)
 *   --status-root <path>     Default: <state-root>/status
 *   --claim-report <path>    Required for claims|done when stamp is automate
 *   --check-reachability     Also validate claim SHAs against reachable set
 *   --reachable-file <path>  Newline-separated SHAs (with --check-reachability)
 *   --help
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canSpawnPhaseWriter,
  canCloseTasksFromClaims,
  canRunPhaseDone,
  canFinalizeOrArchive,
} from '../src/automate-orchestrator-gates.js';
import { readLeaseResult } from '../src/writer-lease.js';
import { hasAutomateStamp } from '../src/implement-mode.js';
import { parseFrontmatter } from './validate-state.js';

const GATES = new Set(['spawn', 'claims', 'done', 'phase-done', 'finalize']);

const HELP = `assert-automate-gate — pure automate STOP gates (Layer 2)

Usage:
  node scripts/assert-automate-gate.js --plan <slug> --gate <gate> [options]

Gates:
  spawn         canSpawnPhaseWriter via readLeaseResult (lease must be missing)
  claims|done   canCloseTasksFromClaims (claim report required under automate stamp)
  phase-done    canRunPhaseDone (evaluationGate under durable automate)
  finalize      canFinalizeOrArchive (plan-end + userValidatedAt under stamp)

Options:
  --project <id>            Prefer projects/<id>/<slug>/plan.md
  --state-root <path>       Default: ./.atomic-skills
  --status-root <path>      Default: <state-root>/status
  --claim-report <path>     JSON claim report (claims|done)
  --check-reachability      Validate claim SHAs against reachable set
  --reachable-file <path>   Newline-separated SHAs for reachability
  --help                    Show this help (exit 0)

Exit codes:
  0  ok
  1  blocked or usage/error

Output:
  ok
  blocked: <reason>
`;

/**
 * @param {string[]} argv
 * @returns {Record<string, string | boolean>}
 */
export function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      out.help = true;
      continue;
    }
    if (a === '--check-reachability') {
      out.checkReachability = true;
      continue;
    }
    if (a.startsWith('--') && a.includes('=')) {
      const eq = a.indexOf('=');
      const key = a.slice(2, eq);
      const val = a.slice(eq + 1);
      out[flagKey(key)] = val;
      continue;
    }
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next == null || next.startsWith('--')) {
        out[flagKey(key)] = true;
        continue;
      }
      out[flagKey(key)] = next;
      i++;
      continue;
    }
  }
  return out;
}

/** @param {string} key */
function flagKey(key) {
  // kebab-case → camelCase for known flags
  return key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * @param {string} filePath
 * @returns {object | null}
 */
function readFm(filePath) {
  try {
    const parsed = parseFrontmatter(readFileSync(filePath, 'utf8'));
    return parsed.error ? null : parsed.frontmatter;
  } catch {
    return null;
  }
}

/**
 * Resolve plan under stateRoot: projects/<id>/<slug>/plan.md
 * Accepts planSlug as bare slug or projectId/slug.
 *
 * @param {string} stateRoot
 * @param {string} planSlug
 * @param {string | null} projectFilter
 * @returns {{ planFile: string, projectId: string, slug: string, fm: object } | { error: string }}
 */
export function resolvePlan(stateRoot, planSlug, projectFilter = null) {
  const raw = String(planSlug || '').trim();
  if (!raw) return { error: 'missing --plan' };

  let wantProject = projectFilter != null ? String(projectFilter).trim() : '';
  let wantSlug = raw;
  if (raw.includes('/')) {
    const parts = raw.split('/').filter(Boolean);
    if (parts.length >= 2) {
      wantProject = wantProject || parts[0];
      wantSlug = parts[parts.length - 1];
    }
  }

  const projectsDir = join(stateRoot, 'projects');
  if (!existsSync(projectsDir) || !statSync(projectsDir).isDirectory()) {
    return { error: `no projects/ under state-root: ${stateRoot}` };
  }

  /** @type {Array<{ planFile: string, projectId: string, slug: string, fm: object }>} */
  const matches = [];

  for (const projId of readdirSync(projectsDir)) {
    if (wantProject && projId !== wantProject) continue;
    const projPath = join(projectsDir, projId);
    if (!statSync(projPath).isDirectory()) continue;
    for (const entry of readdirSync(projPath)) {
      const planDir = join(projPath, entry);
      if (!statSync(planDir).isDirectory()) continue;
      const planFile = join(planDir, 'plan.md');
      if (!existsSync(planFile)) continue;
      const fm = readFm(planFile);
      if (!fm) continue;
      const slug =
        fm.slug != null && String(fm.slug).trim() !== ''
          ? String(fm.slug).trim()
          : entry;
      if (slug !== wantSlug && entry !== wantSlug) continue;
      matches.push({ planFile, projectId: projId, slug, fm });
    }
  }

  // Flat legacy: plans/<slug>.md
  if (matches.length === 0) {
    const flat = join(stateRoot, 'plans', `${wantSlug}.md`);
    if (existsSync(flat)) {
      const fm = readFm(flat);
      if (fm) {
        matches.push({
          planFile: flat,
          projectId: wantProject || '(flat)',
          slug: wantSlug,
          fm,
        });
      }
    }
  }

  if (matches.length === 0) {
    return {
      error: `plan not found for slug "${wantSlug}"${wantProject ? ` project=${wantProject}` : ''} under ${stateRoot}`,
    };
  }
  if (matches.length > 1 && !wantProject) {
    const ids = matches.map((m) => `${m.projectId}/${m.slug}`).join(', ');
    return {
      error: `ambiguous plan slug "${wantSlug}" — pass --project or project/slug (matches: ${ids})`,
    };
  }
  return matches[0];
}

/**
 * @param {object} fm
 * @param {string | null | undefined} phaseId
 * @returns {object | null}
 */
export function phaseSlice(fm, phaseId) {
  const phases = Array.isArray(fm.phases) ? fm.phases : [];
  const id =
    phaseId != null && String(phaseId).trim() !== ''
      ? String(phaseId).trim()
      : fm.currentPhase != null
        ? String(fm.currentPhase).trim()
        : '';
  if (!id) return null;
  return (
    phases.find(
      (p) =>
        p != null &&
        typeof p === 'object' &&
        (String(p.id) === id || String(p.phaseId) === id),
    ) || null
  );
}

/**
 * @param {string} path
 * @returns {unknown}
 */
function loadClaimReport(path) {
  const raw = readFileSync(path, 'utf8');
  return JSON.parse(raw);
}

/**
 * @param {string} path
 * @returns {Set<string>}
 */
function loadReachableSet(path) {
  const text = readFileSync(path, 'utf8');
  const set = new Set();
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (s && !s.startsWith('#')) set.add(s);
  }
  return set;
}

/**
 * @param {{ ok: boolean, reason?: string, planEndReviewOk?: boolean, userValidationOk?: boolean }} result
 * @param {string} [fallbackReason]
 */
function formatBlocked(result, fallbackReason = 'gate blocked') {
  if (result.reason) return result.reason;
  const bits = [];
  if (result.planEndReviewOk === false) bits.push('planEndReviewOk=false');
  if (result.userValidationOk === false) bits.push('userValidationOk=false');
  if (bits.length) return bits.join('; ');
  return fallbackReason;
}

/**
 * @param {Record<string, string | boolean>} args
 * @param {{ cwd?: string }} [env]
 * @returns {{ ok: boolean, message: string, exitCode: number }}
 */
export function runAssert(args, env = {}) {
  if (args.help) {
    return { ok: true, message: HELP.trimEnd(), exitCode: 0 };
  }

  const planArg = args.plan;
  const gateRaw = args.gate;
  if (planArg == null || planArg === true || String(planArg).trim() === '') {
    return {
      ok: false,
      message: 'blocked: missing --plan\n\n' + HELP.trimEnd(),
      exitCode: 1,
    };
  }
  if (gateRaw == null || gateRaw === true || String(gateRaw).trim() === '') {
    return {
      ok: false,
      message: 'blocked: missing --gate\n\n' + HELP.trimEnd(),
      exitCode: 1,
    };
  }

  const gate = String(gateRaw).trim().toLowerCase();
  if (!GATES.has(gate)) {
    return {
      ok: false,
      message: `blocked: unknown gate "${gateRaw}" (expected spawn|claims|done|phase-done|finalize)`,
      exitCode: 1,
    };
  }

  const cwd = env.cwd != null ? env.cwd : process.cwd();
  const stateRoot = resolve(
    cwd,
    args.stateRoot != null && args.stateRoot !== true
      ? String(args.stateRoot)
      : join(cwd, '.atomic-skills'),
  );
  const statusRoot = resolve(
    cwd,
    args.statusRoot != null && args.statusRoot !== true
      ? String(args.statusRoot)
      : join(stateRoot, 'status'),
  );
  const projectFilter =
    args.project != null && args.project !== true
      ? String(args.project).trim()
      : null;

  const resolved = resolvePlan(stateRoot, String(planArg), projectFilter);
  if ('error' in resolved) {
    return {
      ok: false,
      message: `blocked: ${resolved.error}`,
      exitCode: 1,
    };
  }

  const { fm, slug } = resolved;
  const planExecutionMode =
    fm.executionMode != null ? String(fm.executionMode) : null;
  const stamped = hasAutomateStamp({ executionMode: planExecutionMode });

  if (gate === 'spawn') {
    const lease = readLeaseResult(statusRoot, slug);
    const r = canSpawnPhaseWriter({ leaseStatus: lease.status });
    if (!r.ok) {
      return {
        ok: false,
        message: `blocked: ${formatBlocked(r, 'writer lease blocking')}`,
        exitCode: 1,
      };
    }
    return { ok: true, message: 'ok', exitCode: 0 };
  }

  if (gate === 'claims' || gate === 'done') {
    const claimPath =
      args.claimReport != null && args.claimReport !== true
        ? resolve(cwd, String(args.claimReport))
        : null;

    if (!claimPath) {
      if (stamped) {
        return {
          ok: false,
          message:
            'blocked: missing claim report (--claim-report required under executionMode: automate)',
          exitCode: 1,
        };
      }
      // Non-automate: claims/done gate with no report still fails closed — the
      // gate's purpose is claim validation; without a report there is nothing to assert.
      return {
        ok: false,
        message: 'blocked: missing claim report (--claim-report required for claims|done)',
        exitCode: 1,
      };
    }

    if (!existsSync(claimPath)) {
      return {
        ok: false,
        message: `blocked: claim report not found: ${claimPath}`,
        exitCode: 1,
      };
    }

    let claimReport;
    try {
      claimReport = loadClaimReport(claimPath);
    } catch (err) {
      return {
        ok: false,
        message: `blocked: unparseable claim report: ${err instanceof Error ? err.message : String(err)}`,
        exitCode: 1,
      };
    }

    /** @type {{ claimReport: unknown, checkReachability?: boolean, reachableSet?: Set<string> }} */
    const input = { claimReport };
    if (args.checkReachability === true) {
      input.checkReachability = true;
      const rf =
        args.reachableFile != null && args.reachableFile !== true
          ? resolve(cwd, String(args.reachableFile))
          : null;
      if (!rf || !existsSync(rf)) {
        return {
          ok: false,
          message:
            'blocked: --check-reachability requires --reachable-file with newline-separated SHAs',
          exitCode: 1,
        };
      }
      try {
        input.reachableSet = loadReachableSet(rf);
      } catch (err) {
        return {
          ok: false,
          message: `blocked: cannot read reachable file: ${err instanceof Error ? err.message : String(err)}`,
          exitCode: 1,
        };
      }
    }

    const r = canCloseTasksFromClaims(input);
    if (!r.ok) {
      return {
        ok: false,
        message: `blocked: ${formatBlocked(r, 'claim report invalid')}`,
        exitCode: 1,
      };
    }
    return { ok: true, message: 'ok', exitCode: 0 };
  }

  if (gate === 'phase-done') {
    const phase = phaseSlice(fm, fm.currentPhase);
    const evaluationGate =
      phase != null && phase.evaluationGate != null
        ? phase.evaluationGate
        : fm.evaluationGate != null
          ? fm.evaluationGate
          : null;
    const r = canRunPhaseDone({
      planExecutionMode,
      evaluationGate,
    });
    if (!r.ok) {
      return {
        ok: false,
        message: `blocked: ${formatBlocked(r, 'phase-done evaluation gate')}`,
        exitCode: 1,
      };
    }
    return { ok: true, message: 'ok', exitCode: 0 };
  }

  // finalize
  const receipt = fm.planEndReview != null ? fm.planEndReview : null;
  const userValidatedAt =
    fm.userValidatedAt != null ? String(fm.userValidatedAt) : null;
  const r = canFinalizeOrArchive({
    planExecutionMode,
    receipt,
    userValidatedAt,
  });
  if (!r.ok) {
    return {
      ok: false,
      message: `blocked: ${formatBlocked(r, 'finalize plan-end gates')}`,
      exitCode: 1,
    };
  }
  return { ok: true, message: 'ok', exitCode: 0 };
}

/**
 * CLI entry.
 * @param {string[]} argv process.argv.slice(2)
 * @returns {number} exit code
 */
export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const result = runAssert(args, { cwd: process.cwd() });
  // Help / multi-line usage → stdout. Single-line ok|blocked → stdout (agents).
  // Extra detail after first blocked line also on stderr when multi-line usage.
  if (result.exitCode === 0) {
    process.stdout.write(result.message + '\n');
  } else {
    const lines = result.message.split('\n');
    process.stdout.write(lines[0] + '\n');
    if (lines.length > 1) {
      process.stderr.write(lines.slice(1).join('\n') + '\n');
    }
  }
  return result.exitCode;
}

const isDirect =
  process.argv[1] != null &&
  fileURLToPath(import.meta.url) === resolve(process.cwd(), process.argv[1]);

if (isDirect) {
  process.exitCode = main(process.argv.slice(2));
}
