/**
 * Host-local Layer 3 runner helpers for automate phase prepare / validate.
 *
 * Composes writer-lease, work-order, sealed-brief, claim-report.
 * Does **not** spawn subagents, call done/phase-done, or nest worktrees under
 * the plan worktree path.
 *
 * Pure + thin FS/git wrappers with injectable deps for unit tests (no network).
 */

import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { join, resolve, dirname, basename, isAbsolute } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  isLeaseBlocking,
  acquireLeaseFile,
  buildActiveLease,
  readLeaseResult,
} from './writer-lease.js';
import {
  buildPhaseWorkOrder,
  withWorkOrderPlacement,
} from './automate-work-order.js';
import {
  buildSealedBrief,
  defaultClaimReportPath,
} from './automate-sealed-brief.js';
import {
  parseClaimReport,
  validateClaimReport,
  validateClaimReachability,
} from './claim-report.js';

/**
 * @typedef {{
 *   ok: boolean,
 *   exitCode: number,
 *   message: string,
 *   result?: object,
 * }} RunnerResult
 */

/**
 * Whether candidate worktree path is nested under planWorktreePath.
 * @param {string} planWorktreePath
 * @param {string} candidatePath
 * @returns {boolean}
 */
export function isNestedUnderPlanWorktree(planWorktreePath, candidatePath) {
  const plan = resolve(String(planWorktreePath || ''));
  const cand = resolve(String(candidatePath || ''));
  if (!plan || !cand) return false;
  if (plan === cand) return true;
  const prefix = plan.endsWith('/') ? plan : `${plan}/`;
  return cand === plan || cand.startsWith(prefix);
}

/**
 * Default sibling worktree path: sibling of plan worktree parent (repo `.worktrees/`),
 * never nested under the plan worktree itself.
 *
 * @param {{
 *   planSlug: string,
 *   phaseId: string,
 *   planWorktreePath: string,
 *   repoRoot?: string | null,
 * }} input
 * @returns {string}
 */
export function defaultSiblingWorktreePath(input) {
  const planSlug = String(input.planSlug || '').trim() || 'plan';
  const phaseId = String(input.phaseId || '').trim() || 'F0';
  const planWt = resolve(String(input.planWorktreePath || '.'));
  // Prefer repoRoot/.worktrees/<slug>-<phase>-writer when repoRoot known.
  // Otherwise place beside the plan worktree's parent (sibling of .worktrees/<slug>).
  let base;
  if (input.repoRoot != null && String(input.repoRoot).trim() !== '') {
    base = join(resolve(String(input.repoRoot)), '.worktrees');
  } else {
    // plan worktree often at <repo>/.worktrees/<slug> → parent is .worktrees
    const parent = dirname(planWt);
    base =
      basename(parent) === '.worktrees'
        ? parent
        : join(parent, '.worktrees');
  }
  const path = join(base, `${planSlug}-${phaseId}-writer`);
  if (isNestedUnderPlanWorktree(planWt, path)) {
    // Defensive: if plan worktree is not under .worktrees, force outside plan path
    return join(dirname(planWt), `${planSlug}-${phaseId}-writer`);
  }
  return path;
}

/**
 * Default writer branch name.
 * @param {string} planSlug
 * @param {string} phaseId
 * @returns {string}
 */
export function defaultWriterBranch(planSlug, phaseId) {
  return `impl/${String(planSlug).trim()}-${String(phaseId).trim()}-writer`;
}

/**
 * Default sealed brief path under status root.
 * @param {string} statusRoot
 * @param {string} planSlug
 * @param {string} phaseId
 * @returns {string}
 */
export function defaultSealedBriefPath(statusRoot, planSlug, phaseId) {
  return join(
    String(statusRoot),
    'automate',
    `${String(planSlug).trim()}-${String(phaseId).trim()}-sealed-brief.md`,
  );
}

/**
 * Default claim report path (repo-relative preferred; absolute under status when needed).
 * @param {string} planSlug
 * @param {string} [statusRoot]
 * @returns {string}
 */
export function resolveClaimReportPath(planSlug, statusRoot) {
  // Canonical relative path for writers; also write absolute under status for host.
  if (statusRoot) {
    return join(
      String(statusRoot),
      'automate',
      `${String(planSlug).trim()}-claims.json`,
    );
  }
  return defaultClaimReportPath(planSlug);
}

/**
 * Resolve initiative path for a phase under nested plan layout.
 * @param {string} planFile
 * @param {object} planFm
 * @param {string} phaseId
 * @returns {string | null}
 */
export function findInitiativePath(planFile, planFm, phaseId) {
  const planDir = dirname(planFile);
  const phasesDir = join(planDir, 'phases');
  if (!existsSync(phasesDir) || !statSync(phasesDir).isDirectory()) return null;
  const want = String(phaseId || '').trim().toLowerCase();
  for (const name of readdirSync(phasesDir)) {
    if (!name.endsWith('.md') || name.endsWith('.source.json')) continue;
    const p = join(phasesDir, name);
    if (!statSync(p).isFile()) continue;
    // Prefer name match f0-*, f1-*, or frontmatter phaseId
    const base = name.toLowerCase();
    if (want && (base.startsWith(want.toLowerCase() + '-') || base.startsWith(want.toLowerCase() + '.'))) {
      return p;
    }
    try {
      const raw = readFileSync(p, 'utf8');
      const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!m) continue;
      // light scan for phaseId: F0 without full yaml dep when possible
      if (new RegExp(`^phaseId:\\s*["']?${want}["']?\\s*$`, 'im').test(m[1])) {
        return p;
      }
      if (new RegExp(`^id:\\s*["']?${want}["']?\\s*$`, 'im').test(m[1])) {
        return p;
      }
    } catch {
      // continue
    }
  }
  // Fallback: first fN-*.md matching phase number
  const num = want.replace(/^f/i, '');
  for (const name of readdirSync(phasesDir)) {
    if (new RegExp(`^f${num}-`, 'i').test(name) && name.endsWith('.md')) {
      return join(phasesDir, name);
    }
  }
  return null;
}

/**
 * Minimal YAML-ish frontmatter parse for initiative tasks (no full yaml dep).
 * Falls back to external parseFrontmatter when provided via deps.
 *
 * @param {string} text
 * @param {(raw: string) => { frontmatter?: object, error?: string }} [parseFm]
 * @returns {object | null}
 */
export function loadInitiativeObject(text, parseFm) {
  if (parseFm) {
    const p = parseFm(text);
    if (p && !p.error && p.frontmatter) return p.frontmatter;
  }
  // Lightweight: try JSON if whole file is JSON; else require deps.parseFrontmatter in prepare
  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj === 'object') return obj;
  } catch {
    // not JSON
  }
  return null;
}

/**
 * @param {{
 *   statusRoot: string,
 *   planSlug: string,
 *   phaseId: string,
 *   hostId?: string,
 *   planWorktreePath: string,
 *   repoRoot?: string | null,
 *   initiative?: object | null,
 *   initiativePath?: string | null,
 *   tasks?: unknown[] | null,
 *   projectId?: string | null,
 *   decisionLogPath?: string | null,
 *   worktreePath?: string | null,
 *   writerBranch?: string | null,
 *   baseRef?: string | null,
 *   claimReportPath?: string | null,
 *   sealedBriefPath?: string | null,
 *   skipWorktree?: boolean,
 *   deps?: {
 *     isLeaseBlocking?: typeof isLeaseBlocking,
 *     acquireLeaseFile?: typeof acquireLeaseFile,
 *     buildActiveLease?: typeof buildActiveLease,
 *     readLeaseResult?: typeof readLeaseResult,
 *     execGit?: (args: string[], opts?: { cwd?: string }) => string,
 *     existsSync?: typeof existsSync,
 *     mkdirSync?: typeof mkdirSync,
 *     writeFileSync?: typeof writeFileSync,
 *     now?: () => string,
 *   },
 * }} input
 * @returns {RunnerResult}
 */
export function preparePhaseRun(input) {
  const deps = input.deps || {};
  const leaseBlocking = deps.isLeaseBlocking || isLeaseBlocking;
  const acquire = deps.acquireLeaseFile || acquireLeaseFile;
  const buildLease = deps.buildActiveLease || buildActiveLease;
  const execGit =
    deps.execGit ||
    ((args, opts = {}) =>
      execFileSync('git', args, {
        cwd: opts.cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).toString().trim());
  const exists = deps.existsSync || existsSync;
  const mkdir = deps.mkdirSync || mkdirSync;
  const write = deps.writeFileSync || writeFileSync;
  const now = deps.now || (() => new Date().toISOString());

  const statusRoot = String(input.statusRoot || '').trim();
  const planSlug = String(input.planSlug || '').trim();
  const phaseId = String(input.phaseId || '').trim();
  const planWorktreePath = resolve(String(input.planWorktreePath || '.'));
  const hostId = String(input.hostId || 'host-local').trim() || 'host-local';

  if (!statusRoot) {
    return { ok: false, exitCode: 1, message: 'blocked: statusRoot is required' };
  }
  if (!planSlug || !phaseId) {
    return {
      ok: false,
      exitCode: 1,
      message: 'blocked: planSlug and phaseId are required',
    };
  }

  if (leaseBlocking(statusRoot, planSlug)) {
    const read = deps.readLeaseResult || readLeaseResult;
    let detail = '';
    try {
      const r = read(statusRoot, planSlug);
      detail = r?.status ? ` (status=${r.status})` : '';
    } catch {
      // ignore
    }
    return {
      ok: false,
      exitCode: 1,
      message: `blocked: writer lease blocking${detail} — refuse prepare (clear lease with acquire secret after settle)`,
    };
  }

  // Resolve baseRef from plan worktree HEAD when not provided
  let baseRef = input.baseRef != null ? String(input.baseRef).trim() : '';
  if (!baseRef && !input.skipWorktree) {
    try {
      baseRef = execGit(['rev-parse', 'HEAD'], { cwd: planWorktreePath });
    } catch (err) {
      return {
        ok: false,
        exitCode: 1,
        message: `blocked: cannot resolve baseRef (git rev-parse HEAD): ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
  if (!baseRef) baseRef = 'HEAD';

  const worktreePath = resolve(
    input.worktreePath != null && String(input.worktreePath).trim() !== ''
      ? String(input.worktreePath).trim()
      : defaultSiblingWorktreePath({
          planSlug,
          phaseId,
          planWorktreePath,
          repoRoot: input.repoRoot,
        }),
  );

  if (isNestedUnderPlanWorktree(planWorktreePath, worktreePath)) {
    return {
      ok: false,
      exitCode: 1,
      message: `blocked: sibling worktree must not nest under plan worktree (${planWorktreePath}) — got ${worktreePath}`,
    };
  }

  const writerBranch =
    input.writerBranch != null && String(input.writerBranch).trim() !== ''
      ? String(input.writerBranch).trim()
      : defaultWriterBranch(planSlug, phaseId);

  let workOrder;
  try {
    workOrder = buildPhaseWorkOrder({
      planSlug,
      phaseId,
      initiative: input.initiative,
      tasks: input.tasks,
      initiativePath: input.initiativePath,
      projectId: input.projectId,
      decisionLogPath: input.decisionLogPath,
    });
    workOrder = withWorkOrderPlacement(workOrder, {
      worktreePath,
      writerBranch,
      baseRef,
      decisionLogPath: input.decisionLogPath,
    });
  } catch (err) {
    return {
      ok: false,
      exitCode: 1,
      message: `blocked: work-order build failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Cut sibling worktree (unless skip or already exists)
  if (!input.skipWorktree) {
    try {
      if (!exists(worktreePath)) {
        mkdir(dirname(worktreePath), { recursive: true });
        // Create branch from baseRef; if branch exists, attach without -b
        try {
          execGit(
            ['worktree', 'add', '-b', writerBranch, worktreePath, baseRef],
            { cwd: planWorktreePath },
          );
        } catch (firstErr) {
          // Branch may already exist
          try {
            execGit(['worktree', 'add', worktreePath, writerBranch], {
              cwd: planWorktreePath,
            });
          } catch (secondErr) {
            return {
              ok: false,
              exitCode: 1,
              message: `blocked: git worktree add failed: ${secondErr instanceof Error ? secondErr.message : String(secondErr)} (first: ${firstErr instanceof Error ? firstErr.message : String(firstErr)})`,
            };
          }
        }
      }
    } catch (err) {
      return {
        ok: false,
        exitCode: 1,
        message: `blocked: worktree setup failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // Acquire lease after path known
  let leaseResult;
  try {
    const lease = buildLease({
      planSlug,
      phaseId,
      hostId,
      worktreePath,
      writerBranch,
      startedAt: now(),
    });
    leaseResult = acquire(statusRoot, lease);
  } catch (err) {
    return {
      ok: false,
      exitCode: 1,
      message: `blocked: lease acquire failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const claimReportPath = resolve(
    input.claimReportPath != null && String(input.claimReportPath).trim() !== ''
      ? String(input.claimReportPath)
      : resolveClaimReportPath(planSlug, statusRoot),
  );
  // Relative form for brief (portable for writer)
  const claimReportPathForBrief = defaultClaimReportPath(planSlug);

  const sealedBriefPath = resolve(
    input.sealedBriefPath != null && String(input.sealedBriefPath).trim() !== ''
      ? String(input.sealedBriefPath)
      : defaultSealedBriefPath(statusRoot, planSlug, phaseId),
  );

  const brief = buildSealedBrief({
    workOrder,
    claimReportPath: claimReportPathForBrief,
  });

  try {
    mkdir(dirname(sealedBriefPath), { recursive: true });
    write(sealedBriefPath, brief, 'utf8');
    mkdir(dirname(claimReportPath), { recursive: true });
    // Do not pre-write claim report content — writer owns it
  } catch (err) {
    return {
      ok: false,
      exitCode: 1,
      message: `blocked: cannot write sealed brief: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Prepare meta (no secret on disk — secret only in returned result for host memory)
  const metaPath = join(
    statusRoot,
    'automate',
    `${planSlug}-${phaseId}-prepare.json`,
  );
  const meta = {
    planSlug,
    phaseId,
    baseRef,
    worktreePath,
    writerBranch,
    sealedBriefPath,
    claimReportPath,
    claimReportPathForBrief,
    leasePath: leaseResult.path,
    preparedAt: now(),
    // NEVER store lease secret
  };
  try {
    write(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
  } catch {
    // non-fatal
  }

  const spawnInstructions = [
    '## Spawn instructions (host-invoked — runner does not spawn)',
    '',
    `1. cwd / isolation = \`${worktreePath}\``,
    `2. Read sealed brief: \`${sealedBriefPath}\``,
    `3. Spawn code-only phase writer (Grok: spawn_subagent subagent_type=general-purpose; NOT explore).`,
    `4. Sync-wait until writer exits.`,
    `5. Expect claim report at: \`${claimReportPath}\` (or brief path \`${claimReportPathForBrief}\`)`,
    `6. Then: node scripts/automate-phase-run.js validate --plan ${planSlug} --phase ${phaseId} --claim-report <path>`,
    '',
    'Hold lease secret in memory only — never commit it. Clear lease only after merge settle with secret.',
  ].join('\n');

  return {
    ok: true,
    exitCode: 0,
    message: 'ok',
    result: {
      workOrder,
      sealedBriefPath,
      claimReportPath,
      claimReportPathForBrief,
      worktreePath,
      writerBranch,
      baseRef,
      leasePath: leaseResult.path,
      // secret returned only to caller memory — not written to meta/brief
      leaseSecret: leaseResult.secret,
      metaPath,
      spawnInstructions,
      brief,
    },
  };
}

/**
 * Validate a claim report for post-writer Step D/E.
 *
 * @param {{
 *   claimReport?: unknown,
 *   claimReportPath?: string | null,
 *   reachableSet?: Iterable<string> | null,
 *   checkReachability?: boolean,
 *   planBranch?: string | null,
 *   writerBranch?: string | null,
 *   worktreePath?: string | null,
 *   planSlug?: string | null,
 *   phaseId?: string | null,
 *   deps?: {
 *     readFileSync?: typeof readFileSync,
 *     existsSync?: typeof existsSync,
 *   },
 * }} input
 * @returns {RunnerResult}
 */
export function validatePhaseClaims(input = {}) {
  const deps = input.deps || {};
  const read = deps.readFileSync || readFileSync;
  const exists = deps.existsSync || existsSync;

  let report = input.claimReport;
  if (report == null && input.claimReportPath) {
    const p = String(input.claimReportPath);
    if (!exists(p)) {
      return {
        ok: false,
        exitCode: 1,
        message: `blocked: claim report not found: ${p}`,
      };
    }
    try {
      report = JSON.parse(read(p, 'utf8'));
    } catch (err) {
      return {
        ok: false,
        exitCode: 1,
        message: `blocked: unparseable claim report: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  if (report == null) {
    return {
      ok: false,
      exitCode: 1,
      message: 'blocked: missing claim report (--claim-report or claimReport)',
    };
  }

  const parsed = parseClaimReport(report);
  if (parsed == null) {
    return {
      ok: false,
      exitCode: 1,
      message: 'blocked: claim report could not be parsed',
    };
  }

  const v = validateClaimReport(parsed);
  if (!v.ok) {
    return {
      ok: false,
      exitCode: 1,
      message: `blocked: invalid claim report: ${(v.errors || []).join('; ')}`,
      result: { claimValidation: v },
    };
  }

  if (input.checkReachability === true) {
    const r = validateClaimReachability(parsed, input.reachableSet);
    if (!r.ok) {
      return {
        ok: false,
        exitCode: 1,
        message: `blocked: claim reachability failed: ${(r.errors || []).join('; ')}`,
        result: { claimValidation: v, reachability: r },
      };
    }
  }

  const writerBranch =
    input.writerBranch ||
    parsed.writerBranch ||
    null;
  const planBranch = input.planBranch || null;
  const worktreePath = input.worktreePath || parsed.worktreePath || null;

  const mergeCommands = [
    '## Merge commands (git-ops only — host runs after validate ok)',
    '',
    planBranch && writerBranch
      ? `git checkout ${planBranch} && git merge --no-ff ${writerBranch}`
      : writerBranch
        ? `# merge writer branch into plan branch:\ngit merge --no-ff ${writerBranch}`
        : '# set --writer-branch / --plan-branch for concrete merge commands',
    worktreePath
      ? `# after merge settle: git worktree remove ${worktreePath}`
      : '# remove sibling worktree after merge settle',
    '# clear writer lease only with acquire secret (clearLeaseFile)',
    '# then assert-automate-gate --gate done --claim-report <path> --reachable-file <shas>',
  ].join('\n');

  return {
    ok: true,
    exitCode: 0,
    message: 'ok',
    result: {
      claimReport: parsed,
      claimValidation: v,
      mergeCommands,
      writerBranch,
      planBranch,
      worktreePath,
    },
  };
}
