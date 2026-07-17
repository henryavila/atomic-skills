/**
 * project-target-resolver.js — pure plan / branch / worktree selection (F3/T-002).
 *
 * Order is load-bearing:
 *   1. Parse the explicit implement arg (`plan-b` or `atomic-skills/plan-b`)
 *   2. Select the initiative/plan among inventory
 *   3. Bind worktree/branch
 *   4. ONLY THEN evaluate dirty/resume gates on the resolved tree
 *
 * FAILS when the caller's tree governs another plan (caller must not write
 * plan-b state while sitting on plan-a's branch without routing first).
 *
 * No I/O. Callers pass already-enumerated plans and worktrees.
 */

import { planBranchName } from '../scripts/plan-branch-policy.js';

function text(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : '';
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Parse `implement` argument into projectId + planSlug.
 * Accepts: `plan-b`, `atomic-skills/plan-b`, `project/plan-b`.
 * Empty/missing → null (caller falls back to active-plan detection).
 *
 * @param {string|null|undefined} arg
 * @returns {{ projectId: string|null, planSlug: string }|null}
 */
export function parsePlanArg(arg) {
  const raw = text(arg);
  if (!raw) return null;
  // Strip accidental leading/trailing slashes
  const cleaned = raw.replace(/^\/+|\/+$/g, '');
  if (!cleaned) return null;
  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length === 1) {
    return { projectId: null, planSlug: parts[0] };
  }
  if (parts.length === 2) {
    return { projectId: parts[0], planSlug: parts[1] };
  }
  // Nested path like a/b/c — treat last as slug, first as project
  return { projectId: parts[0], planSlug: parts[parts.length - 1] };
}

/**
 * Select a plan from inventory given a parsed arg.
 *
 * @param {object} opts
 * @param {{ projectId: string|null, planSlug: string }|null} opts.parsed
 * @param {Array<{ projectId: string, slug: string, branch?: string|null, status?: string }>} opts.plans
 * @returns {{
 *   ok: boolean,
 *   plan: object|null,
 *   code: string|null,
 *   reason: string|null,
 *   candidates?: object[],
 * }}
 */
export function selectPlanFromInventory({ parsed, plans }) {
  const list = array(plans);
  if (!parsed) {
    const active = list.filter((p) => p && p.status === 'active');
    if (active.length === 1) {
      return { ok: true, plan: active[0], code: null, reason: null };
    }
    if (active.length === 0) {
      return {
        ok: false,
        plan: null,
        code: 'no-active-plan',
        reason: 'No explicit plan arg and no single active plan',
      };
    }
    return {
      ok: false,
      plan: null,
      code: 'ambiguous-active-plan',
      reason: `Multiple active plans (${active.map((p) => p.slug).join(', ')}); pass an explicit plan arg`,
      candidates: active,
    };
  }

  const slug = parsed.planSlug;
  let matches = list.filter((p) => p && p.slug === slug);
  if (parsed.projectId) {
    matches = matches.filter((p) => p.projectId === parsed.projectId);
  }
  if (matches.length === 1) {
    return { ok: true, plan: matches[0], code: null, reason: null };
  }
  if (matches.length === 0) {
    return {
      ok: false,
      plan: null,
      code: 'plan-not-found',
      reason: parsed.projectId
        ? `No plan '${slug}' under project '${parsed.projectId}'`
        : `No plan '${slug}' found`,
    };
  }
  return {
    ok: false,
    plan: null,
    code: 'ambiguous-plan',
    reason: `Plan slug '${slug}' matches multiple projects; pass <project-id>/${slug}`,
    candidates: matches,
  };
}

/**
 * Find worktree path for a branch from `git worktree list --porcelain` parse.
 * @param {Array<{ path: string, branch: string|null }>} worktrees
 * @param {string} branch
 * @returns {string|null}
 */
export function findWorktreePath(worktrees, branch) {
  const b = text(branch);
  if (!b) return null;
  const matches = array(worktrees).filter((w) => w && w.branch === b);
  if (matches.length === 0) return null;
  if (matches.length > 1) {
    throw new Error(`ambiguous worktree resolution: ${matches.length} worktrees on branch ${b}`);
  }
  return matches[0].path;
}

/**
 * Reject shell metacharacters / option-injection in git argv tokens.
 * @param {string} value
 * @param {string} label
 * @returns {string}
 */
export function assertSafeGitArg(value, label) {
  const v = text(value);
  if (!v) throw new Error(`project-target-resolver: ${label} is required`);
  if (v.startsWith('-')) {
    throw new Error(`project-target-resolver: ${label} must not look like a flag (${v})`);
  }
  // Disallow shell metacharacters and whitespace so values are safe both as
  // argv tokens and in any accidental shell display join.
  if (/[\s;|&$`\\'"<>(){}\n\r\t]/.test(v)) {
    throw new Error(
      `project-target-resolver: ${label} contains forbidden characters (${JSON.stringify(v)})`,
    );
  }
  if (v.includes('..') && (label === 'path' || label === 'worktree path')) {
    // traversal in worktree path is still rejected via relative containment below
  }
  return v;
}

/**
 * Compose `git worktree add` for a plan home as argv (never shell-interpolated).
 * When the branch already exists, omit `-b` (reuse branch).
 * When creating, use `-b <branch>`.
 *
 * @param {object} opts
 * @param {string} opts.slug - plan slug
 * @param {string} [opts.branch] - plan branch (default plan/<slug>)
 * @param {string} [opts.path] - worktree path (default .worktrees/<slug>)
 * @param {string} [opts.baseRef] - seed ref when creating branch
 * @param {boolean} opts.branchExists
 * @returns {{ executable: 'git', argv: string[], command: string }}
 *   `command` is a display-only join of validated argv (no untrusted expansion).
 */
export function composePlanWorktreeAdd({
  slug,
  branch,
  path,
  baseRef = 'HEAD',
  branchExists,
} = {}) {
  const s = assertSafeGitArg(slug, 'slug');
  const br = assertSafeGitArg(text(branch) || planBranchName(s), 'branch');
  const wtPath = assertSafeGitArg(text(path) || `.worktrees/${s}`, 'path');
  // Disallow absolute paths and parent traversal for worktree location.
  if (wtPath.startsWith('/') || wtPath.includes('..')) {
    throw new Error(`project-target-resolver: path must be a relative non-escaping path (${wtPath})`);
  }
  const base = assertSafeGitArg(text(baseRef) || 'HEAD', 'baseRef');

  const argv = branchExists
    ? ['worktree', 'add', wtPath, br]
    : ['worktree', 'add', '-b', br, wtPath, base];

  return {
    executable: 'git',
    argv,
    // Display form only — all tokens already validated; never feed untrusted strings here.
    command: ['git', ...argv].join(' '),
  };
}

/**
 * Fail when the caller's tree already governs a *different* plan than the one
 * requested. Writing plan-b state from plan-a's home corrupts ownership.
 *
 * @param {object} opts
 * @param {{ projectId: string, slug: string, branch?: string|null }} opts.requestedPlan
 * @param {string|null} opts.callerBranch - current tree's branch
 * @param {Array<{ projectId: string, slug: string, branch?: string|null }>} opts.plans
 * @returns {{ allowed: boolean, code: string|null, reason: string|null, governingPlan: object|null }}
 */
export function assertCallerMayGovern({ requestedPlan, callerBranch, plans }) {
  const req = requestedPlan;
  if (!req || !text(req.slug)) {
    return {
      allowed: false,
      code: 'no-requested-plan',
      reason: 'No requested plan to govern',
      governingPlan: null,
    };
  }
  const cb = text(callerBranch);
  if (!cb) {
    // Detached / unknown — cannot claim another plan's home; allow routing to continue
    return { allowed: true, code: null, reason: null, governingPlan: null };
  }

  const governors = array(plans).filter(
    (p) => p && text(p.branch) === cb && p.slug !== req.slug,
  );
  // Same slug under different project still conflicts if branch matches another plan
  const otherProjectSameSlug = array(plans).filter(
    (p) =>
      p &&
      text(p.branch) === cb &&
      p.slug === req.slug &&
      req.projectId &&
      p.projectId &&
      p.projectId !== req.projectId,
  );

  if (governors.length > 0) {
    const g = governors[0];
    return {
      allowed: false,
      code: 'caller-governs-other-plan',
      reason:
        `Caller tree on branch '${cb}' governs plan '${g.slug}'` +
        (g.projectId ? ` (${g.projectId})` : '') +
        `; cannot write plan '${req.slug}' here — route to its worktree first`,
      governingPlan: g,
    };
  }
  if (otherProjectSameSlug.length > 0) {
    const g = otherProjectSameSlug[0];
    return {
      allowed: false,
      code: 'caller-governs-other-plan',
      reason:
        `Caller tree on branch '${cb}' governs '${g.projectId}/${g.slug}', not '${req.projectId}/${req.slug}'`,
      governingPlan: g,
    };
  }
  return { allowed: true, code: null, reason: null, governingPlan: null };
}

/**
 * Full routing decision for `implement <arg>` BEFORE any resume/dirty gate.
 *
 * @param {object} input
 * @param {string|null|undefined} input.arg - implement argument
 * @param {Array<{ projectId: string, slug: string, branch?: string|null, status?: string }>} input.plans
 * @param {string|null} input.callerBranch
 * @param {Array<{ path: string, branch: string|null }>} input.worktrees
 * @param {Set<string>|string[]} [input.existingBranches] - local branch names
 * @param {string} [input.baseRef]
 * @returns {object} routing decision
 */
export function resolveImplementTarget(input = {}) {
  const parsed = parsePlanArg(input.arg);
  const selected = selectPlanFromInventory({ parsed, plans: input.plans });
  if (!selected.ok) {
    return {
      ok: false,
      stage: 'select-plan',
      code: selected.code,
      reason: selected.reason,
      candidates: selected.candidates,
      // Must not run resume/dirty gate when selection failed
      resumeGateAllowed: false,
      writeAllowed: false,
    };
  }

  const plan = selected.plan;
  const branch = text(plan.branch) || planBranchName(plan.slug);
  const existing = input.existingBranches instanceof Set
    ? input.existingBranches
    : new Set(array(input.existingBranches));
  const branchExists = existing.has(branch) || array(input.worktrees).some((w) => w?.branch === branch);

  let worktreePath = null;
  try {
    worktreePath = findWorktreePath(input.worktrees, branch);
  } catch (err) {
    return {
      ok: false,
      stage: 'resolve-worktree',
      code: 'ambiguous-worktree',
      reason: err.message,
      plan,
      branch,
      resumeGateAllowed: false,
      writeAllowed: false,
    };
  }

  const onPlanBranch = text(input.callerBranch) === branch;
  const govern = assertCallerMayGovern({
    requestedPlan: plan,
    callerBranch: input.callerBranch,
    plans: input.plans,
  });

  // If caller is already on the plan branch, writes are local and fine.
  // If caller is on another plan's branch, FAIL — must re-enter that worktree.
  if (!onPlanBranch && !govern.allowed) {
    return {
      ok: false,
      stage: 'govern-check',
      code: govern.code,
      reason: govern.reason,
      plan,
      branch,
      governingPlan: govern.governingPlan,
      worktreePath,
      resumeGateAllowed: false,
      writeAllowed: false,
      action: worktreePath
        ? { type: 'reenter', path: worktreePath, command: null }
        : {
            type: 'create-worktree',
            command: composePlanWorktreeAdd({
              slug: plan.slug,
              branch,
              branchExists,
              baseRef: input.baseRef,
            }),
          },
    };
  }

  // Caller not on plan branch but also not governing another plan (e.g. main)
  if (!onPlanBranch) {
    if (worktreePath) {
      return {
        ok: true,
        stage: 'reenter-worktree',
        code: null,
        reason: `Plan '${plan.slug}' lives in worktree ${worktreePath}; re-run implement there before any gate or write`,
        plan,
        branch,
        worktreePath,
        // Resume gate must run INSIDE the plan worktree, not the caller tree
        resumeGateAllowed: false,
        writeAllowed: false,
        action: { type: 'reenter', path: worktreePath, command: null },
      };
    }
    return {
      ok: true,
      stage: 'create-worktree',
      code: null,
      reason: `Plan '${plan.slug}' has no worktree yet; create then re-enter before gates/writes`,
      plan,
      branch,
      worktreePath: null,
      resumeGateAllowed: false,
      writeAllowed: false,
      action: {
        type: 'create-worktree',
        command: composePlanWorktreeAdd({
          slug: plan.slug,
          branch,
          branchExists,
          baseRef: input.baseRef,
        }),
      },
    };
  }

  // On plan branch — resume gate and writes are allowed on this tree
  return {
    ok: true,
    stage: 'home',
    code: null,
    reason: null,
    plan,
    branch,
    worktreePath: worktreePath || null,
    resumeGateAllowed: true,
    writeAllowed: true,
    action: { type: 'proceed', path: null, command: null },
  };
}

/**
 * Shared fuzzy-ish slug resolution for project verbs (F3/T-004 unification).
 * Exact match first; then case-insensitive prefix/substring of slug or title.
 *
 * @param {string} query
 * @param {Array<{ id?: string, slug?: string, title?: string, summary?: string }>} candidates
 * @returns {{ match: object|null, matches: object[], code: 'exact'|'unique-fuzzy'|'ambiguous'|'none' }}
 */
export function resolveFuzzyIdentifier(query, candidates) {
  const q = text(query);
  const list = array(candidates).filter(Boolean);
  if (!q) return { match: null, matches: [], code: 'none' };

  const exact = list.filter(
    (c) => c.id === q || c.slug === q || c.phaseId === q,
  );
  if (exact.length === 1) return { match: exact[0], matches: exact, code: 'exact' };
  if (exact.length > 1) return { match: null, matches: exact, code: 'ambiguous' };

  const lq = q.toLowerCase();
  const fuzzy = list.filter((c) => {
    const fields = [c.id, c.slug, c.phaseId, c.title, c.summary]
      .filter((v) => typeof v === 'string')
      .map((v) => v.toLowerCase());
    return fields.some((f) => f === lq || f.startsWith(lq) || f.includes(lq));
  });
  if (fuzzy.length === 1) return { match: fuzzy[0], matches: fuzzy, code: 'unique-fuzzy' };
  if (fuzzy.length > 1) return { match: null, matches: fuzzy, code: 'ambiguous' };
  return { match: null, matches: [], code: 'none' };
}
