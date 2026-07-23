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
 *   claims        canCloseTasksFromClaims shape-only (requires --claim-report)
 *   done          canCloseTasksFromClaims requiring claimed-pass+exit 0
 *                 (requires --claim-report; optional reachability)
 *   phase-done    canRunPhaseDone (evaluationGate + decisionReview under durable automate)
 *   finalize      canFinalizeOrArchive (plan-end + user validation under stamp)
 *
 * Options:
 *   --project <id>           Prefer projects/<id>/<slug>/plan.md
 *   --state-root <path>      Default: ./.atomic-skills (cwd-relative)
 *   --status-root <path>     Default: <state-root>/status
 *   --claim-report <path>    JSON claim report (claims|done)
 *   --check-reachability     Validate claim SHAs against reachable set
 *   --reachable-file <path>  Newline-separated SHAs (with --check-reachability)
 *   --allow-foreign-paths    Permit claim-report/reachable/state-root outside
 *                            cwd/stateRoot jail (default: jailed)
 *   --help
 *
 * Descriptor-only refuse (spawn):
 *   When the active phase has a plan descriptor entry but the matching
 *   initiative file under phases/ is missing, --gate spawn fails with a
 *   materialize hint. That is the machine form of implement Step 1 refuse.
 *
 * Exit codes: 0 ok · 1 blocked or usage error
 */

import {
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
} from 'node:fs';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canSpawnPhaseWriter,
  canSpawnHostThinPhaseWriter,
  canCloseTasksFromClaims,
  canRunPhaseDone,
  canFinalizeOrArchive,
} from '../src/automate-orchestrator-gates.js';
import { readLeaseResult, sanitizePlanSlug } from '../src/writer-lease.js';
import { parseFrontmatter } from './validate-state.js';

const GATES = new Set(['spawn', 'claims', 'done', 'phase-done', 'finalize']);

const HELP = `assert-automate-gate — pure automate STOP gates (Layer 2)

Usage:
  node scripts/assert-automate-gate.js --plan <slug> --gate <gate> [options]

Gates:
  spawn         Host-thin: lease clean + phase initiative materialized
                (descriptor-only / missing initiative ⇒ blocked)
  claims        claim report shape-only (--claim-report required)
  done          all claims claimed-pass+exit0 (--claim-report; optional reachability)
  phase-done    canRunPhaseDone (evaluationGate + decisionReview under automate stamp)
  finalize      canFinalizeOrArchive (plan-end + userValidatedAt under stamp)

Options:
  --project <id>            Prefer projects/<id>/<slug>/plan.md
  --state-root <path>       Default: ./.atomic-skills
  --status-root <path>      Default: <state-root>/status
  --claim-report <path>     JSON claim report (claims|done)
  --check-reachability      Validate claim SHAs against reachable set
  --reachable-file <path>   Newline-separated SHAs for reachability
  --allow-foreign-paths     Permit paths outside cwd/stateRoot jail
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
    if (a === '--allow-foreign-paths') {
      out.allowForeignPaths = true;
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
 * Sanitize a single path segment (slug / project id). Reuses writer-lease rules.
 * @param {string} value
 * @param {string} label
 * @returns {{ ok: true, value: string } | { ok: false, error: string }}
 */
export function sanitizeSegment(value, label = 'slug') {
  try {
    return { ok: true, value: sanitizePlanSlug(String(value).trim()) };
  } catch (err) {
    return {
      ok: false,
      error: `invalid ${label}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Canonicalize for jail compare (resolve + realpath of existing ancestor).
 * Handles macOS /var → /private/var and other symlink cwd mismatches.
 * @param {string} p
 * @returns {string}
 */
export function canonicalizePath(p) {
  const abs = resolve(p);
  try {
    if (existsSync(abs)) return realpathSync(abs);
  } catch {
    /* fall through */
  }
  /** @type {string[]} */
  const rest = [];
  let cur = abs;
  while (cur !== dirname(cur)) {
    try {
      if (existsSync(cur)) {
        return rest.length
          ? join(realpathSync(cur), ...rest.reverse())
          : realpathSync(cur);
      }
    } catch {
      /* keep walking */
    }
    rest.push(basename(cur));
    cur = dirname(cur);
  }
  return abs;
}

/**
 * True when resolved path is under one of the jail roots (or equal to a root).
 * @param {string} candidateAbs
 * @param {string[]} jailRootsAbs
 * @returns {boolean}
 */
export function isPathInsideJail(candidateAbs, jailRootsAbs) {
  const target = canonicalizePath(candidateAbs);
  for (const root of jailRootsAbs) {
    const r = canonicalizePath(root);
    if (target === r) return true;
    const rel = relative(r, target);
    // Inside when relative path has no `..` prefix and is not absolute
    if (rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)) return true;
  }
  return false;
}

/**
 * Resolve + jail a user-supplied path. Returns absolute path or error.
 * @param {string} raw
 * @param {string} cwd
 * @param {string[]} jailRootsAbs
 * @param {string} label
 * @param {boolean} allowForeign
 * @returns {{ ok: true, path: string } | { ok: false, error: string }}
 */
export function resolveJailedPath(raw, cwd, jailRootsAbs, label, allowForeign = false) {
  const abs = resolve(cwd, String(raw));
  if (!allowForeign && !isPathInsideJail(abs, jailRootsAbs)) {
    return {
      ok: false,
      error: `${label} path escapes jail (must be under cwd or state-root unless --allow-foreign-paths): ${raw}`,
    };
  }
  return { ok: true, path: abs };
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
 * Try flat plan at stateRoot/plans/<slug>.md.
 * @param {string} stateRoot
 * @param {string} wantSlug
 * @param {string} wantProject
 * @returns {{ planFile: string, projectId: string, slug: string, fm: object, layout: 'flat' } | null}
 */
function tryFlatPlan(stateRoot, wantSlug, wantProject) {
  const flat = join(stateRoot, 'plans', `${wantSlug}.md`);
  if (!existsSync(flat)) return null;
  const fm = readFm(flat);
  if (!fm) return null;
  return {
    planFile: flat,
    projectId: wantProject || '(flat)',
    slug: wantSlug,
    fm,
    layout: /** @type {const} */ ('flat'),
  };
}

/**
 * Resolve plan under stateRoot: projects/<id>/<slug>/plan.md
 * Accepts planSlug as bare slug or projectId/slug.
 * Flat plan fallback: when projects/ is missing OR after scanning projects
 * finds no match (never early-return before flat when projects/ is absent).
 *
 * @param {string} stateRoot
 * @param {string} planSlug
 * @param {string | null} projectFilter
 * @returns {{ planFile: string, projectId: string, slug: string, fm: object, layout?: 'nested' | 'flat' } | { error: string }}
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
    } else if (parts.length === 1) {
      wantSlug = parts[0];
    }
  }

  const slugSan = sanitizeSegment(wantSlug, 'plan slug');
  if (!slugSan.ok) return { error: slugSan.error };
  wantSlug = slugSan.value;

  if (wantProject) {
    const projSan = sanitizeSegment(wantProject, 'project id');
    if (!projSan.ok) return { error: projSan.error };
    wantProject = projSan.value;
  }

  /** @type {Array<{ planFile: string, projectId: string, slug: string, fm: object, layout?: 'nested' | 'flat' }>} */
  const matches = [];

  const projectsDir = join(stateRoot, 'projects');
  const hasProjects =
    existsSync(projectsDir) && statSync(projectsDir).isDirectory();

  if (hasProjects) {
    for (const projId of readdirSync(projectsDir)) {
      if (wantProject && projId !== wantProject) continue;
      // Skip path-like project dir names that would escape segment rules
      if (projId === '.' || projId === '..' || projId.includes('/') || projId.includes('\\') || projId.includes('\0')) {
        continue;
      }
      const projPath = join(projectsDir, projId);
      if (!statSync(projPath).isDirectory()) continue;
      for (const entry of readdirSync(projPath)) {
        if (entry === '.' || entry === '..' || entry.includes('/') || entry.includes('\\') || entry.includes('\0')) {
          continue;
        }
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
        matches.push({
          planFile,
          projectId: projId,
          slug,
          fm,
          layout: 'nested',
        });
      }
    }
  }

  // Flat plan fallback: when projects/ missing OR after scan found nothing.
  if (matches.length === 0) {
    const flat = tryFlatPlan(stateRoot, wantSlug, wantProject);
    if (flat) matches.push(flat);
  }

  if (matches.length === 0) {
    if (!hasProjects) {
      return {
        error: `plan not found for slug "${wantSlug}" (no projects/ and no flat plans/${wantSlug}.md under ${stateRoot})`,
      };
    }
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

const BI_SPINE = ['value', 'workflow', 'rules', 'outOfScope', 'doneWhen'];

/**
 * Spawn integrity beyond file existence: parse initiative frontmatter, require
 * plan/phase identity match and a complete businessIntent spine on the
 * initiative (and plan phase when available).
 *
 * @param {string | null} initiativePath
 * @param {{ planSlug?: string, phaseId?: string, planPhaseBi?: unknown }} [opts]
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function validateSpawnInitiative(initiativePath, opts = {}) {
  if (initiativePath == null || !existsSync(initiativePath)) {
    return { ok: false, reason: 'spawn requires initiative file on disk' };
  }
  let fm;
  try {
    const parsed = parseFrontmatter(readFileSync(initiativePath, 'utf8'));
    if (parsed.error || parsed.frontmatter == null) {
      return {
        ok: false,
        reason: `spawn initiative unreadable/invalid frontmatter: ${parsed.error || 'missing'}`,
      };
    }
    fm = parsed.frontmatter;
  } catch (err) {
    return {
      ok: false,
      reason: `spawn initiative read failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  const planSlug = opts.planSlug != null ? String(opts.planSlug).trim() : '';
  const parent =
    fm.parentPlan != null
      ? String(fm.parentPlan).trim()
      : fm.plan != null
        ? String(fm.plan).trim()
        : '';
  if (planSlug && parent && parent.toLowerCase() !== planSlug.toLowerCase()) {
    return {
      ok: false,
      reason: `spawn initiative parentPlan mismatch (got ${parent}, want ${planSlug})`,
    };
  }
  const wantPhase = opts.phaseId != null ? String(opts.phaseId).trim() : '';
  const gotPhase =
    fm.phaseId != null
      ? String(fm.phaseId).trim()
      : fm.id != null
        ? String(fm.id).trim()
        : '';
  if (wantPhase && gotPhase && wantPhase.toLowerCase() !== gotPhase.toLowerCase()) {
    return {
      ok: false,
      reason: `spawn initiative phaseId mismatch (got ${gotPhase}, want ${wantPhase})`,
    };
  }
  const status = fm.status != null ? String(fm.status).trim().toLowerCase() : '';
  if (status === 'archived' || status === 'done') {
    return {
      ok: false,
      reason: `spawn refuses initiative status=${status || '(empty)'} — need active/materialized phase`,
    };
  }
  const biOk = (bi, where) => {
    if (bi == null || typeof bi !== 'object' || Array.isArray(bi)) {
      return `${where}: missing businessIntent object`;
    }
    for (const field of BI_SPINE) {
      const v = bi[field];
      if (typeof v !== 'string' || !v.trim() || v.trim() === '[NEEDS CLARIFICATION]') {
        return `${where}: businessIntent.${field} missing or blank`;
      }
    }
    return null;
  };
  const initBiErr = biOk(fm.businessIntent, 'initiative');
  if (initBiErr) return { ok: false, reason: `spawn blocked — ${initBiErr}` };
  if (opts.planPhaseBi != null) {
    const planBiErr = biOk(opts.planPhaseBi, 'plan.phases[]');
    if (planBiErr) return { ok: false, reason: `spawn blocked — ${planBiErr}` };
  }
  return { ok: true };
}

/**
 * Prefer frontmatter phaseId match; filename hints secondary.
 * @param {string} filePath
 * @param {string} phaseId
 * @param {string} phaseSlug
 * @returns {{ byFrontmatter: boolean, byFilename: boolean }}
 */
function initiativeMatchScore(filePath, phaseId, phaseSlug, planSlug = '') {
  const fm = readFm(filePath);
  let byFrontmatter = false;
  if (fm) {
    const fmPhase =
      fm.phaseId != null
        ? String(fm.phaseId).trim()
        : fm.id != null
          ? String(fm.id).trim()
          : '';
    if (phaseId && fmPhase && fmPhase.toLowerCase() === phaseId.toLowerCase()) {
      // Flat multi-plan: require parentPlan match when both are present (codex P2)
      const parent =
        fm.parentPlan != null ? String(fm.parentPlan).trim() : '';
      if (
        !planSlug ||
        !parent ||
        parent.toLowerCase() === String(planSlug).toLowerCase()
      ) {
        byFrontmatter = true;
      }
    }
  }
  const base = filePath.split(/[/\\]/).pop() || '';
  const name = base.endsWith('.md') ? base.slice(0, -3) : base;
  let byFilename = false;
  if (phaseSlug && (name === phaseSlug || name.endsWith(`-${phaseSlug}`))) {
    byFilename = true;
  }
  if (phaseId) {
    const idLower = phaseId.toLowerCase();
    if (name.toLowerCase() === idLower || name.toLowerCase().startsWith(`${idLower}-`)) {
      byFilename = true;
    }
  }
  return { byFrontmatter, byFilename };
}

/**
 * Resolve phase initiative path next to plan.md (nested) or under
 * stateRoot/initiatives (flat plan layout).
 * Returns null when initiative is missing (descriptor-only).
 * Prefer parse frontmatter phaseId match; filename hints secondary.
 *
 * @param {string} planFile
 * @param {object} fm
 * @param {object | null} phase
 * @param {{ stateRoot?: string, layout?: string }} [opts]
 * @returns {string | null}
 */
export function resolveInitiativePath(planFile, fm, phase, opts = {}) {
  if (phase == null || typeof phase !== 'object') return null;

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
      ? String(phase.id).trim()
      : phase.phaseId != null && String(phase.phaseId).trim() !== ''
        ? String(phase.phaseId).trim()
        : '';

  /** @type {string[]} */
  const searchDirs = [];
  const planDir = dirname(planFile);
  const nestedPhases = join(planDir, 'phases');
  if (existsSync(nestedPhases) && statSync(nestedPhases).isDirectory()) {
    searchDirs.push(nestedPhases);
  }
  // Flat initiatives under stateRoot/initiatives when plan is flat
  if (opts.layout === 'flat' || !existsSync(nestedPhases)) {
    const stateRoot =
      opts.stateRoot != null
        ? opts.stateRoot
        : // plans/<slug>.md → stateRoot is parent of plans/
          dirname(planDir);
    const flatInit = join(stateRoot, 'initiatives');
    if (existsSync(flatInit) && statSync(flatInit).isDirectory()) {
      searchDirs.push(flatInit);
    }
  }

  if (searchDirs.length === 0) return null;

  /** @type {string | null} */
  let fmHit = null;
  /** @type {string | null} */
  let nameHit = null;

  for (const dir of searchDirs) {
    let names;
    try {
      names = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!name.endsWith('.md') || name.endsWith('.source.json')) continue;
      if (name === 'archive') continue;
      const full = join(dir, name);
      try {
        if (!statSync(full).isFile()) continue;
      } catch {
        continue;
      }
      const score = initiativeMatchScore(full, phaseId, phaseSlug, planSlug);
      if (score.byFrontmatter && !fmHit) fmHit = full;
      // Filename-only hits: only trust under nested plan phases/ (not flat multi-plan)
      const isFlatInitiatives =
        dir.endsWith(`${sep}initiatives`) || dir.endsWith('/initiatives');
      if (score.byFilename && !nameHit && !isFlatInitiatives) nameHit = full;
    }
  }

  // Prefer frontmatter phaseId match; filename hints secondary
  if (fmHit) return fmHit;
  if (nameHit) return nameHit;

  // Explicit candidate paths (slug-based) as last resort before miss
  for (const dir of searchDirs) {
    /** @type {string[]} */
    const candidates = [];
    if (phaseSlug) {
      candidates.push(join(dir, `${phaseSlug}.md`));
      if (planSlug) {
        candidates.push(join(dir, `${planSlug}-${phaseSlug}.md`));
      }
    }
    if (phaseId) {
      candidates.push(join(dir, `${phaseId}.md`));
      candidates.push(join(dir, `${phaseId.toLowerCase()}.md`));
    }
    for (const p of candidates) {
      if (existsSync(p) && statSync(p).isFile()) return p;
    }
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
  const allowForeign = args.allowForeignPaths === true;

  const stateRootRaw =
    args.stateRoot != null && args.stateRoot !== true
      ? String(args.stateRoot)
      : join(cwd, '.atomic-skills');

  // Jail state-root under cwd unless allow-foreign
  const stateRootResolved = resolve(cwd, stateRootRaw);
  if (!allowForeign && !isPathInsideJail(stateRootResolved, [cwd])) {
    return {
      ok: false,
      message: `blocked: state-root path escapes jail (must be under cwd unless --allow-foreign-paths): ${stateRootRaw}`,
      exitCode: 1,
    };
  }
  const stateRoot = stateRootResolved;

  const statusRootRaw =
    args.statusRoot != null && args.statusRoot !== true
      ? String(args.statusRoot)
      : join(stateRoot, 'status');
  const statusJail = resolveJailedPath(
    statusRootRaw,
    cwd,
    [cwd, stateRoot],
    'status-root',
    allowForeign,
  );
  if (!statusJail.ok) {
    return {
      ok: false,
      message: `blocked: ${statusJail.error}`,
      exitCode: 1,
    };
  }
  const statusRoot = statusJail.path;

  const projectFilter =
    args.project != null && args.project !== true
      ? String(args.project).trim()
      : null;

  let resolved;
  try {
    resolved = resolvePlan(stateRoot, String(planArg), projectFilter);
  } catch (err) {
    // sanitizePlanSlug throws → blocked exit 1, not crash
    return {
      ok: false,
      message: `blocked: ${err instanceof Error ? err.message : String(err)}`,
      exitCode: 1,
    };
  }
  if ('error' in resolved) {
    return {
      ok: false,
      message: `blocked: ${resolved.error}`,
      exitCode: 1,
    };
  }

  const { fm, slug, planFile, layout } = resolved;
  const planExecutionMode =
    fm.executionMode != null ? String(fm.executionMode) : null;

  if (gate === 'spawn') {
    let lease;
    try {
      lease = readLeaseResult(statusRoot, slug);
    } catch (err) {
      // lease path sanitize throws on bad slug → blocked, not crash
      return {
        ok: false,
        message: `blocked: lease read failed: ${err instanceof Error ? err.message : String(err)}`,
        exitCode: 1,
      };
    }
    const phase = phaseSlice(fm, fm.currentPhase);
    const initiativePath = resolveInitiativePath(planFile, fm, phase, {
      stateRoot,
      layout: layout || 'nested',
    });
    const initiativePresent =
      initiativePath != null && existsSync(initiativePath);
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
    // Beyond file existence: parse initiative, match plan/phase, require BI spine.
    const initCheck = validateSpawnInitiative(initiativePath, {
      planSlug: slug,
      phaseId:
        phase != null && phase.id != null
          ? String(phase.id)
          : fm.currentPhase != null
            ? String(fm.currentPhase)
            : '',
      planPhaseBi: phase != null ? phase.businessIntent : null,
    });
    if (!initCheck.ok) {
      return {
        ok: false,
        message: `blocked: ${initCheck.reason}`,
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
    const claimJail = resolveJailedPath(
      String(args.claimReport),
      cwd,
      [cwd, stateRoot],
      'claim-report',
      allowForeign,
    );
    if (!claimJail.ok) {
      return {
        ok: false,
        message: `blocked: ${claimJail.error}`,
        exitCode: 1,
      };
    }
    let claimReport;
    try {
      claimReport = loadClaimReport(claimJail.path);
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
      const reachJail = resolveJailedPath(
        String(args.reachableFile),
        cwd,
        [cwd, stateRoot],
        'reachable-file',
        allowForeign,
      );
      if (!reachJail.ok) {
        return {
          ok: false,
          message: `blocked: ${reachJail.error}`,
          exitCode: 1,
        };
      }
      try {
        reachableSet = loadReachableSet(reachJail.path);
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
      // done gate: every open claim must be claimed-pass with exitCode 0
      requireAllClaimedPass: gate === 'done',
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
    const decisionReview =
      phase != null && phase.decisionReview != null
        ? phase.decisionReview
        : null;
    const r = canRunPhaseDone({
      planExecutionMode,
      evaluationGate,
      decisionReview,
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
