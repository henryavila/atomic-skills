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

function isFeatureMerged(plan, branch, isMerged) {
  return ownPrState(plan) === 'MERGED' || safelyIsMerged(isMerged, branch);
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

    const plan = plans.find((candidate) => ownBranch(candidate) === branch);
    if (!isFeatureMerged(plan, branch, isMerged)) continue;

    const path = ownString(worktree, 'path');
    const slug = ownString(plan, 'slug');
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
