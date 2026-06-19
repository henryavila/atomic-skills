/**
 * detect-orphan-worktrees.js — pure read-only PR→develop lifecycle backstop.
 *
 * This module never runs git and never mutates state. It only classifies
 * already-parsed worktree and plan slices plus an injected ancestry predicate.
 */

function ownValue(value, key) {
  if (value == null || typeof value !== 'object') return undefined;
  if (!Object.hasOwn(value, key)) return undefined;
  return value[key];
}

function ownString(value, key) {
  const candidate = ownValue(value, key);
  return typeof candidate === 'string' ? candidate : undefined;
}

function ownBranch(value) {
  const branch = ownValue(value, 'branch');
  if (branch === null) return null;
  return typeof branch === 'string' ? branch : undefined;
}

function ownPrState(plan) {
  const pr = ownValue(plan, 'pr');
  if (pr == null || typeof pr !== 'object') return undefined;
  const state = ownValue(pr, 'state');
  return typeof state === 'string' ? state : undefined;
}

function safelyIsMerged(isMerged, branch) {
  try {
    return isMerged(branch) === true;
  } catch {
    return false;
  }
}

// "Merged" is a BRANCH-level property (does this branch's work reach the integration
// ref?), not a per-plan one: any plan on the branch with a MERGED PR, or the injected
// ancestry predicate. Used symmetrically by condition A (flag live worktree) and
// condition B (suppress an archived branch that actually reached the ref).
function isBranchMerged(branch, plans, isMerged) {
  const mergedViaPr = plans.some(
    (candidate) => ownBranch(candidate) === branch && ownPrState(candidate) === 'MERGED',
  );
  return mergedViaPr || safelyIsMerged(isMerged, branch);
}

/**
 * findOrphanWorktrees — read-only backstop for the PR→develop worktree lifecycle.
 * Pure over injected, ALREADY-PARSED inputs. Never runs git; never mutates inputs.
 *
 * @param {object} [input]
 * @param {Array<{path:string, branch:(string|null), head:string}>} [input.worktrees]
 *   parsed `git worktree list --porcelain` entries (branch is null when detached).
 * @param {Array<{slug:string, branch:(string|null), status:string,
 *   pr:({state:('MERGED'|'OPEN'|'NONE')}|null|undefined)}>} [input.plans]
 *   plan/initiative state slices.
 * @param {string} [input.integrationRef]  the integration ref name (e.g. "develop"),
 *   used only in messages.
 * @param {(branch:string)=>boolean} [input.isMerged]
 *   injected ancestry predicate: is <branch> merged into the integration ref.
 *   Optional — when absent, treated as () => false (merge signal then comes only
 *   from a plan's pr.state === 'MERGED').
 * @returns {Array<{severity:'warn', kind:string, branch:(string|null),
 *   path:(string|undefined), slug:(string|undefined), reason:string}>}
 *   WARN findings; [] when the state is clean/active.
 */
export function findOrphanWorktrees(input = {}) {
  const normalizedInput = input == null || typeof input !== 'object' ? {} : input;
  const worktreesValue = ownValue(normalizedInput, 'worktrees');
  const plansValue = ownValue(normalizedInput, 'plans');
  const integrationRefValue = ownValue(normalizedInput, 'integrationRef');
  const isMergedValue = ownValue(normalizedInput, 'isMerged');

  const worktrees = Array.isArray(worktreesValue) ? worktreesValue : [];
  const plans = Array.isArray(plansValue) ? plansValue : [];
  const integrationRef = typeof integrationRefValue === 'string' ? integrationRefValue : 'develop';
  const isMerged = typeof isMergedValue === 'function' ? isMergedValue : () => false;

  const findings = [];

  for (const worktree of worktrees) {
    const branch = ownBranch(worktree);
    if (typeof branch !== 'string') continue;

    // Branch-level merge signal (not first-match-wins): the MERGED PR may live on
    // any plan for this branch, and the ancestry predicate is branch-level.
    if (!isBranchMerged(branch, plans, isMerged)) continue;

    const path = ownString(worktree, 'path');
    const matchingPlans = plans.filter((candidate) => ownBranch(candidate) === branch);
    const slug = ownString(matchingPlans[0], 'slug');
    findings.push({
      severity: 'warn',
      kind: 'merged-feature-worktree',
      branch,
      path,
      slug,
      reason: `feature ${branch} merged into ${integrationRef} but worktree ${path} still live — teardown pending`,
    });
  }

  for (const plan of plans) {
    const status = ownString(plan, 'status');
    const branch = ownBranch(plan);
    if (status !== 'archived' || typeof branch !== 'string') continue;

    // A branch that actually REACHED the integration ref (a MERGED PR on ANY plan
    // for it, OR merge-base ancestry) is the healthy terminal state — never an
    // orphan, even when no PR identity was recorded (e.g. a fast-forward merge).
    // Branch-level + symmetric with condition A.
    if (isBranchMerged(branch, plans, isMerged)) continue;

    const prState = ownPrState(plan);
    let kind;
    if (prState === undefined || prState === 'NONE') {
      kind = 'archived-never-pr';
    } else if (prState === 'OPEN') {
      kind = 'archived-pr-open-unmerged';
    } else {
      continue;
    }

    const slug = ownString(plan, 'slug');
    findings.push({
      severity: 'warn',
      kind,
      branch,
      path: undefined,
      slug,
      reason: `archived plan ${slug} branch ${branch} never reached ${integrationRef}`,
    });
  }

  return findings;
}
