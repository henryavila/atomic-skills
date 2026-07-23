#!/usr/bin/env node
/**
 * assert-automate-gate.js — thin Layer-2 CLI over automate STOP helpers.
 *
 * No spawn, no git merge, no process supervisor, no network, no durable
 * mutation of plan/initiative. Reads plan/lease/claim from disk and prints
 * ok|blocked + reason; exit 0 only when ok.
 *
 * Usage:
 *   node scripts/assert-automate-gate.js --plan <slug> --gate <gate> [options]
 *
 * Gates:
 *   spawn         Host-thin preflight: lease clean + active phase initiative
 *                 file present (descriptor-only ⇒ fail closed). Uses
 *                 canSpawnHostThinPhaseWriter / canSpawnPhaseWriter.
 *   claims        canCloseTasksFromClaims (requires --claim-report)
 *   done          canCloseTasksFromClaims for post-merge close confidence
 *                 (requires --claim-report; optional reachability)
 *   phase-done    canRunPhaseDone (evaluationGate under durable automate)
 *   finalize      canFinalizeOrArchive (plan-end + user validation under stamp)
 *
 * Options:
 *   --project <id>           Prefer projects/<id>/<slug>/plan.md
 *   --state-root <path>      Default: ./.atomic-skills (cwd-relative)
 *   --status-root <path>     Default: <state-root>/status
 *   --claim-report <path>    JSON claim report (claims|done)
 *   --check-reachability     Validate claim SHAs against reachable set
 *   --reachable-file <path>  Newline-separated SHAs (with --check-reachability)
 *   --help
 *
 * Descriptor-only refuse (spawn):
 *   When the active phase has a plan descriptor entry but the matching
 *   initiative file under phases/ is missing, --gate spawn fails with a
 *   materialize hint. That is the machine form of implement Step 1 refuse.
 *
 * Exit codes: 0 ok · 1 blocked or usage error
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canSpawnPhaseWriter,
  canSpawnHostThinPhaseWriter,
  canCloseTasksFromClaims,
  canRunPhaseDone,
  canFinalizeOrArchive,
} from '../src/automate-orchestrator-gates.js';
import { readLeaseResult } from '../src/writer-lease.js';
import { parseFrontmatter } from './validate-state.js';

const GATES = new Set(['spawn', 'claims', 'done', 'phase-done', 'finalize']);

const HELP = `assert-automate-gate — pure automate STOP gates (Layer 2)

Usage:
  node scripts/assert-automate-gate.js --plan <slug> --gate <gate> [options]

Gates:
  spawn         Host-thin: lease clean + phase initiative materialized
                (descriptor-only / missing initiative ⇒ blocked)
  claims        canCloseTasksFromClaims (--claim-report required)
  done          claim close gate (--claim-report; optional reachability)
  phase-done    canRunPhaseDone (evaluationGate under automate stamp)
  finalize      canFinalizeOrArchive (plan-end + userValidatedAt under stamp)

Options:
  --project <id>            Prefer projects/<id>/<slug>/plan.md
  --state-root <path>       Default: ./.atomic-skills
  --status-root <path>      Default: <state-root>/status
  --claim-report <path>     JSON claim report (claims|done)
  --check-reachability      Validate claim SHAs against reachable set
  --reachable-file <path>   Newline-separated SHAs for reachability
  --help                    Show this help (exit 0)

No network. No process supervisor. No plan mutation.

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
 * Resolve nested phase initiative path next to plan.md.
 * Returns null when initiative is missing (descriptor-only).
 *
 * @param {string} planFile
 * @param {object} fm
 * @param {object | null} phase
 * @returns {string | null}
 */
export function resolveInitiativePath(planFile, fm, phase) {
  if (phase == null || typeof phase !== 'object') return null;
  const planDir = dirname(planFile);
  const phasesDir = join(planDir, 'phases');
  if (!existsSync(phasesDir)) return null;
  const planSlug =
    fm.slug != null && String(fm.slug).trim() !== ''
      ? String(fm.slug).trim()
      : '';
  const phaseSlug =
    phase.slug != null && String(phase.slug).trim() !== ''
      ? String(phase.slug).trim()
      : '';
  const phaseId =
    phase.id != null && String(phase.id).trim() !== ''
      ? String(phase.id).trim().toLowerCase()
      : '';

  /** @type {string[]} */
  const candidates = [];
  if (phaseSlug) {
    candidates.push(join(phasesDir, `${phaseSlug}.md`));
    if (planSlug) {
      candidates.push(join(phasesDir, `${planSlug}-${phaseSlug}.md`));
    }
  }
  try {
    for (const name of readdirSync(phasesDir)) {
      if (!name.endsWith('.md') || name.endsWith('.source.json')) continue;
      // skip archive/
      if (name === 'archive') continue;
      const base = name.slice(0, -3);
      if (phaseSlug && (base === phaseSlug || base.endsWith(`-${phaseSlug}`))) {
        candidates.push(join(phasesDir, name));
      }
      if (phaseId && (base.startsWith(`${phaseId}-`) || base === phaseId)) {
        candidates.push(join(phasesDir, name));
      }
    }
  } catch {
    /* ignore */
  }

  for (const p of candidates) {
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
}

/**
 * @param {string} path
 * @returns {unknown}
 */
function loadClaimReport(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
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

  const { fm, slug, planFile } = resolved;
  const planExecutionMode =
    fm.executionMode != null ? String(fm.executionMode) : null;

  if (gate === 'spawn') {
    const lease = readLeaseResult(statusRoot, slug);
    const phase = phaseSlice(fm, fm.currentPhase);
    const initiativePath = resolveInitiativePath(planFile, fm, phase);
    const initiativePresent = initiativePath != null && existsSync(initiativePath);
    // Host-thin: lease clean + phase materialized (not descriptor-only).
    const r = canSpawnHostThinPhaseWriter({
      leaseStatus: lease.status,
      initiativePresent,
      phaseMaterialized: initiativePresent,
    });
    // Also document via canSpawnPhaseWriter path for callers that only use that.
    const leaseOnly = canSpawnPhaseWriter({
      leaseStatus: lease.status,
      initiativePresent,
    });
    if (!r.ok || !leaseOnly.ok) {
      const reason =
        r.reason ||
        leaseOnly.reason ||
        'spawn blocked (lease or descriptor-only initiative missing)';
      return {
        ok: false,
        message: `blocked: ${reason}`,
        exitCode: 1,
      };
    }
    return { ok: true, message: 'ok', exitCode: 0 };
  }

  if (gate === 'claims' || gate === 'done') {
    if (args.claimReport == null || args.claimReport === true) {
      return {
        ok: false,
        message: 'blocked: --claim-report required for claims|done',
        exitCode: 1,
      };
    }
    let claimReport;
    try {
      claimReport = loadClaimReport(String(args.claimReport));
    } catch (err) {
      return {
        ok: false,
        message: `blocked: claim report read failed: ${err instanceof Error ? err.message : String(err)}`,
        exitCode: 1,
      };
    }
    /** @type {Set<string> | null} */
    let reachableSet = null;
    if (args.checkReachability === true) {
      if (args.reachableFile == null || args.reachableFile === true) {
        return {
          ok: false,
          message: 'blocked: --reachable-file required with --check-reachability',
          exitCode: 1,
        };
      }
      try {
        reachableSet = loadReachableSet(String(args.reachableFile));
      } catch (err) {
        return {
          ok: false,
          message: `blocked: reachable file read failed: ${err instanceof Error ? err.message : String(err)}`,
          exitCode: 1,
        };
      }
    }
    const r = canCloseTasksFromClaims({
      claimReport,
      checkReachability: args.checkReachability === true,
      reachableSet,
    });
    if (!r.ok) {
      return {
        ok: false,
        message: `blocked: ${formatBlocked(r, 'claim gate failed')}`,
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
        : null;
    const r = canRunPhaseDone({
      planExecutionMode,
      evaluationGate,
      phase,
    });
    if (!r.ok) {
      return {
        ok: false,
        message: `blocked: ${formatBlocked(r, 'phase-done gate failed')}`,
        exitCode: 1,
      };
    }
    return { ok: true, message: 'ok', exitCode: 0 };
  }

  if (gate === 'finalize') {
    const receipt = fm.planEndReview != null ? fm.planEndReview : null;
    const userValidatedAt =
      fm.userValidatedAt != null
        ? fm.userValidatedAt
        : receipt != null && typeof receipt === 'object'
          ? receipt.userValidatedAt
          : null;
    const r = canFinalizeOrArchive({
      planExecutionMode,
      receipt,
      userValidatedAt,
    });
    if (!r.ok) {
      return {
        ok: false,
        message: `blocked: ${formatBlocked(r, 'finalize gate failed')}`,
        exitCode: 1,
      };
    }
    return { ok: true, message: 'ok', exitCode: 0 };
  }

  return {
    ok: false,
    message: `blocked: unhandled gate ${gate}`,
    exitCode: 1,
  };
}

function main(argv) {
  const args = parseArgs(argv);
  const result = runAssert(args, { cwd: process.cwd() });
  if (result.ok) {
    process.stdout.write(result.message + '\n');
  } else {
    process.stderr.write(result.message + '\n');
  }
  process.exit(result.exitCode);
}

const isMain =
  process.argv[1] != null &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  main(process.argv.slice(2));
}
