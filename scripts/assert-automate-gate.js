/**
 * assert-automate-gate.js — thin CLI over Layer-1 pure automate STOP helpers.
 *
 * No spawn, no git merge, no durable state mutation. Reads plan/lease/claim/
 * maestro-cursor from disk and prints ok|blocked + reason; exit 0 only when ok.
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
 *                            (claim-bound; inactive when no executionMode stamp)
 *   --check-reachability     Also validate claim SHAs against reachable set
 *   --reachable-file <path>  Newline-separated SHAs (with --check-reachability)
 *   --complex-receipts <path> JSON map { "T-001": { mode, reviewFile, ... } }
 *                            for complex-before-done (optional; also reads
 *                            task.reviewReceipt on initiative)
 *   --skip-cursor            Skip maestro cursor step check (debug only)
 *   --skip-last-assert       Do not write lastAssert on cursor (debug only)
 *   --help
 *
 * Under durable executionMode: automate, gates also read the thin maestro
 * cursor (Layer 2.5 — `src/maestro-cursor.js`, path
 * `<status-root>/automate/<slug>.json`) and block illegal step for
 * spawn/done/phase-done/finalize. On exit 0 (and blocked done/phase-done),
 * writes lastAssert so pure-maestro cannot mutate without a fresh assert.
 *
 * --gate done also loads the phase initiative and builds complexTasks from
 * weight/tags + receipts (fail closed for complex without both receipt).
 *
 * No auto-merge / no git worktree ops.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canSpawnPhaseWriter,
  canCloseTasksFromClaims,
  canDoneFromAutomateClaims,
  canRunPhaseDone,
  canFinalizeOrArchive,
} from '../src/automate-orchestrator-gates.js';
import { readLeaseResult } from '../src/writer-lease.js';
import {
  readCursorResult,
  ensureCursor,
  cursorAllowsGate,
  recordLastAssertFile,
  AWAITING_OPERATOR_ADVANCE,
} from '../src/maestro-cursor.js';
import { hasAutomateStamp } from '../src/implement-mode.js';
import {
  buildComplexTasksFromInitiative,
  claimTaskIdsFromReport,
} from '../src/automate-complex-from-initiative.js';
import { parseFrontmatter } from './validate-state.js';

const GATES = new Set(['spawn', 'claims', 'done', 'phase-done', 'finalize']);

const HELP = `assert-automate-gate — pure automate STOP gates (Layer 2 + cursor 2.5)

Usage:
  node scripts/assert-automate-gate.js --plan <slug> --gate <gate> [options]

Gates:
  spawn         canSpawnPhaseWriter via readLeaseResult (lease must be missing)
                + maestro cursor step C under automate stamp
  claims        canCloseTasksFromClaims (claim report required under automate stamp)
                + cursor step D|D.5|E under stamp
  done          canDoneFromAutomateClaims under stamp (claim-bound + complex from initiative)
                + cursor step E under stamp + lastAssert written
  phase-done    canRunPhaseDone (evaluation + lessons + review both under durable automate)
                + cursor step G under stamp + lastAssert written
  finalize      canFinalizeOrArchive (plan-end + userValidatedAt under stamp)
                + cursor step I under stamp

Options:
  --project <id>            Prefer projects/<id>/<slug>/plan.md
  --state-root <path>       Default: ./.atomic-skills
  --status-root <path>      Default: <state-root>/status
  --claim-report <path>     JSON claim report (claims|done)
  --check-reachability      Validate claim SHAs against reachable set
  --reachable-file <path>   Newline-separated SHAs for reachability
  --complex-receipts <path> JSON { "T-001": { mode, reviewFile } } for complex done
  --skip-cursor             Skip maestro-cursor step check (debug / recovery only)
  --skip-last-assert        Do not write lastAssert (debug only)
  --help                    Show this help (exit 0)

Maestro cursor (Layer 2.5, under stamp only):
  Path: <status-root>/automate/<slug>.json via src/maestro-cursor.js
  Missing cursor initializes at A (ensureCursor) — still blocks gates that need C/E/G/I.
  lastAssert: { gate, ok, at } written on done/phase-done so skill cannot mutate without assert.
  Non-automate: cursor not required (gate inactive for step check).

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
    if (a === '--skip-cursor') {
      out.skipCursor = true;
      continue;
    }
    if (a === '--skip-last-assert') {
      out.skipLastAssert = true;
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
 * Resolve nested phase initiative path next to plan.md.
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
  // f0-*.md style: match files starting with phase id lowercased
  try {
    for (const name of readdirSync(phasesDir)) {
      if (!name.endsWith('.md') || name.endsWith('.source.json')) continue;
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
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Load initiative frontmatter for complex-task scan.
 * @param {string | null} initiativePath
 * @returns {object | null}
 */
export function loadInitiativeFrontmatter(initiativePath) {
  if (!initiativePath || !existsSync(initiativePath)) return null;
  return readFm(initiativePath);
}

/**
 * @param {string} path
 * @returns {Record<string, object>}
 */
export function loadComplexReceiptsMap(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('complex receipts must be a JSON object map');
  }
  /** @type {Record<string, object>} */
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      out[String(k)] = v;
    }
  }
  return out;
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
 * Under durable automate: load or init maestro cursor, then require step match.
 * Missing → ensureCursor at A (no throw). Malformed → block.
 *
 * @param {{
 *   statusRoot: string,
 *   planSlug: string,
 *   phaseId: string,
 *   gate: string,
 * }} input
 * @returns {{ ok: boolean, reason?: string }}
 */
export function checkMaestroCursor(input) {
  const statusRoot = input.statusRoot;
  const planSlug = input.planSlug;
  const phaseId = input.phaseId;
  const gate = input.gate;

  let read = readCursorResult(statusRoot, planSlug);
  if (read.status === 'missing') {
    // First automate entry — init at A without throw (skill advances on A–I boundaries)
    try {
      const ensured = ensureCursor(statusRoot, planSlug, { phaseId });
      if (ensured.status !== 'ok' || !ensured.cursor) {
        return {
          ok: false,
          reason:
            ensured.error ||
            'maestro cursor missing and could not initialize at A',
        };
      }
      read = { status: 'ok', cursor: ensured.cursor };
    } catch (err) {
      return {
        ok: false,
        reason: `maestro cursor init failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
  if (read.status === 'malformed') {
    return {
      ok: false,
      reason: `maestro cursor malformed: ${read.error || 'invalid shape'} — repair via src/maestro-cursor.js; do not delete to force progress`,
    };
  }
  const gateOk = cursorAllowsGate(read.cursor, gate);
  if (!gateOk.ok) {
    return {
      ok: false,
      reason:
        gateOk.reason ||
        `maestro cursor step forbids gate ${gate}` +
          (read.cursor?.step === AWAITING_OPERATOR_ADVANCE
            ? ' (awaiting-operator-advance)'
            : ''),
    };
  }
  return { ok: true };
}

/**
 * Persist lastAssert on maestro cursor so pure-maestro cannot mutate without
 * a fresh successful assert for done/phase-done.
 *
 * @param {string} statusRoot
 * @param {string} planSlug
 * @param {object} fm
 * @param {Record<string, string | boolean>} args
 * @param {string} gate
 * @param {{ ok: boolean, message: string, exitCode: number }} result
 */
export function maybeRecordLastAssert(
  statusRoot,
  planSlug,
  fm,
  args,
  gate,
  result,
) {
  if (args.skipLastAssert === true) return;
  if (args.skipCursor === true) return;
  const planExecutionMode =
    fm.executionMode != null ? String(fm.executionMode) : null;
  if (!hasAutomateStamp({ executionMode: planExecutionMode })) return;
  if (gate !== 'done' && gate !== 'phase-done') return;
  try {
    const phaseId =
      fm.currentPhase != null && String(fm.currentPhase).trim() !== ''
        ? String(fm.currentPhase).trim()
        : 'F0';
    recordLastAssertFile(statusRoot, planSlug, {
      gate,
      ok: result.ok === true && result.exitCode === 0,
      reason: result.ok ? null : result.message,
      phaseId,
    });
  } catch {
    // fail-open on lastAssert write — gate result still returned; skill prose
    // still requires lastAssertAllows before mutate when cursor is readable
  }
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

  // Layer 2.5 — thin maestro cursor (under durable automate stamp only).
  // Missing cursor initializes at A without throw; illegal step still blocks.
  // Non-automate: skip (do not force cursor). --skip-cursor is recovery only.
  if (stamped && args.skipCursor !== true) {
    const phaseId =
      fm.currentPhase != null && String(fm.currentPhase).trim() !== ''
        ? String(fm.currentPhase).trim()
        : 'F0';
    const cursorCheck = checkMaestroCursor({
      statusRoot,
      planSlug: slug,
      phaseId,
      gate,
    });
    if (!cursorCheck.ok) {
      return {
        ok: false,
        message: `blocked: ${cursorCheck.reason}`,
        exitCode: 1,
      };
    }
  }

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
      if (!stamped) {
        // Non-automate: claim-bound done is inactive (Mode 1 unstamped unchanged).
        return { ok: true, message: 'ok', exitCode: 0 };
      }
      // Durable executionMode: automate — claim report is HARD for claims|done.
      return {
        ok: false,
        message:
          'blocked: missing claim report (--claim-report required under executionMode: automate) — claim-bound done',
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

    // Under stamp: --gate done uses claim-bound canDoneFromAutomateClaims +
    // complexTasks auto-built from phase initiative (weight/tags + receipts).
    // CLI reachability stays opt-in via --check-reachability.
    // No auto-merge: this script never runs git merge / worktree ops.
    let r;
    if (gate === 'done' && stamped) {
      /** @type {Record<string, object> | null} */
      let receiptsByTaskId = null;
      if (args.complexReceipts != null && args.complexReceipts !== true) {
        const crPath = resolve(cwd, String(args.complexReceipts));
        if (!existsSync(crPath)) {
          return {
            ok: false,
            message: `blocked: complex receipts file not found: ${crPath}`,
            exitCode: 1,
          };
        }
        try {
          receiptsByTaskId = loadComplexReceiptsMap(crPath);
        } catch (err) {
          return {
            ok: false,
            message: `blocked: unparseable complex receipts: ${err instanceof Error ? err.message : String(err)}`,
            exitCode: 1,
          };
        }
      }
      const phase = phaseSlice(fm, fm.currentPhase);
      const initiativePath = resolveInitiativePath(resolved.planFile, fm, phase);
      const initFm = loadInitiativeFrontmatter(initiativePath);
      const claimIds = claimTaskIdsFromReport(claimReport);
      const complexTasks = buildComplexTasksFromInitiative({
        tasks: initFm != null ? initFm.tasks : [],
        claimTaskIds: claimIds.length > 0 ? claimIds : null,
        receiptsByTaskId,
      });
      r = canDoneFromAutomateClaims({
        ...input,
        checkReachability: args.checkReachability === true,
        complexTasks,
      });
    } else {
      r = canCloseTasksFromClaims(input);
    }
    if (!r.ok) {
      const out = {
        ok: false,
        message: `blocked: ${formatBlocked(r, 'claim report invalid')}`,
        exitCode: 1,
      };
      maybeRecordLastAssert(statusRoot, slug, fm, args, gate, out);
      return out;
    }
    const okOut = { ok: true, message: 'ok', exitCode: 0 };
    maybeRecordLastAssert(statusRoot, slug, fm, args, gate, okOut);
    return okOut;
  }

  if (gate === 'phase-done') {
    const phase = phaseSlice(fm, fm.currentPhase);
    const evaluationGate =
      phase != null && phase.evaluationGate != null
        ? phase.evaluationGate
        : fm.evaluationGate != null
          ? fm.evaluationGate
          : null;
    const reviewGate =
      phase != null && phase.reviewGate != null
        ? phase.reviewGate
        : fm.reviewGate != null
          ? fm.reviewGate
          : null;
    const r = canRunPhaseDone({
      planExecutionMode,
      evaluationGate,
      lessonsState:
        phase != null && phase.lessonsState != null
          ? phase.lessonsState
          : fm.lessonsState != null
            ? fm.lessonsState
            : null,
      lessonsPath:
        phase != null && phase.lessonsPath != null
          ? phase.lessonsPath
          : fm.lessonsPath != null
            ? fm.lessonsPath
            : null,
      noneReason:
        phase != null && phase.noneReason != null
          ? phase.noneReason
          : null,
      reviewGate,
      phase,
    });
    if (!r.ok) {
      const out = {
        ok: false,
        message: `blocked: ${formatBlocked(r, 'phase-done evaluation/lessons/review gate')}`,
        exitCode: 1,
      };
      maybeRecordLastAssert(statusRoot, slug, fm, args, gate, out);
      return out;
    }
    const okOut = { ok: true, message: 'ok', exitCode: 0 };
    maybeRecordLastAssert(statusRoot, slug, fm, args, gate, okOut);
    return okOut;
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
