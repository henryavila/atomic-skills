/**
 * finalize-plan-scope.js — pure read-only plan-aware finalize guard.
 *
 * This module never runs git and never mutates state. It only classifies
 * already-parsed plan slices and integration-ref snapshots.
 */

// Plan lifecycle advancement rank (plan.schema.json status enum:
// active|paused|done|archived). `active` and `paused` are both in-progress (tie —
// paused is a lateral hold, not lifecycle progress); `done` is past completion;
// `archived` is terminal. An unknown/unlisted status ranks -1 (below all known) so
// an advisory regression fails LOUD — surfacing weird data to the human rather than
// silently passing it as "not behind".
const STATUS_RANK = { paused: 0, active: 0, done: 1, archived: 2 };

function ownValue(value, key) {
  if (value == null || typeof value !== 'object') return undefined;
  if (!Object.hasOwn(value, key)) return undefined;
  return value[key];
}

function ownString(value, key) {
  const candidate = ownValue(value, key);
  return typeof candidate === 'string' ? candidate : undefined;
}

function ownBoolean(value, key) {
  const candidate = ownValue(value, key);
  return typeof candidate === 'boolean' ? candidate : undefined;
}

function ownArray(value, key) {
  const candidate = ownValue(value, key);
  return Array.isArray(candidate) ? candidate : undefined;
}

function ownBranch(value) {
  const branch = ownValue(value, 'branch');
  if (branch === null) return null;
  return typeof branch === 'string' ? branch : undefined;
}

function rankStatus(status) {
  return Object.hasOwn(STATUS_RANK, status) ? STATUS_RANK[status] : -1;
}

function normalizedInput(input) {
  return input == null || typeof input !== 'object' ? {} : input;
}

function normalizedSlug(value) {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function classifyPlan(plan, targetSlug) {
  const slug = ownString(plan, 'slug');
  const status = ownString(plan, 'status');
  if (slug === targetSlug) return 'target';
  // `archived-unmerged` is the archived bucket; EVERY other non-target status
  // (active, paused, done, or unknown) is a NON-ARCHIVED sibling the branch merge
  // would drag along — the documented WARN contract is "non-archived siblings".
  if (status === 'archived') return 'archived-unmerged';
  return 'other-active';
}

function phaseLabel(phase, index) {
  const id = ownString(phase, 'id');
  return id ?? `phase ${index + 1}`;
}

function undonePhases(plan) {
  const phases = ownArray(plan, 'phases') ?? [];
  const undone = [];
  phases.forEach((phase, index) => {
    if (ownString(phase, 'status') !== 'done') undone.push(phaseLabel(phase, index));
  });
  return undone;
}

function isTerminalPlan(plan) {
  const status = ownString(plan, 'status');
  // `archived` and a top-level `done` plan are both terminal/ready-to-publish
  // (plan.schema.json permits status: done). An `active` plan is terminal only once
  // every phase is `done` (the plan status flips to archived AFTER merge, per P2).
  if (status === 'archived' || status === 'done') return true;
  if (status !== 'active') return false;
  // FAIL-CLOSED: an active plan is terminal only with a NON-EMPTY phases array, all
  // `done`. Missing / empty / non-array phases is indeterminate — never treated as
  // "all phases done" (that would publish a schema-invalid/indeterminate plan).
  const phases = ownArray(plan, 'phases');
  if (phases === undefined || phases.length === 0) return false;
  return undonePhases(plan).length === 0;
}

function initialResult(target, classifications, warnings) {
  return {
    decision: 'block',
    target,
    classifications,
    warnings,
    blockReason: null,
  };
}

/**
 * resolveFinalizePlanScope — pure, never-throws, FAIL-CLOSED.
 * @param {object} [input]
 * @param {Array<{slug:string, status:string,
 *   phases:Array<{id?:string, status:string}>, branch?:(string|null)}>} [input.plans]
 *   plan.md state slices present on the branch (already parsed).
 * @param {(string|null)} [input.focusSlug]  the slug pickFocus would resolve (newest active).
 * @param {(string|null)} [input.targetSlug] the operator's EXPLICIT chosen target (null = none).
 * @param {boolean} [input.confirmed]  operator explicitly confirmed a target != focus.
 * @returns {{
 *   decision:('proceed'|'block'),
 *   target:(string|null),
 *   classifications:Array<{slug:string, class:('target'|'other-active'|'archived-unmerged')}>,
 *   warnings:Array<{kind:string, slug:string, reason:string}>,
 *   blockReason:(string|null)
 * }}
 */
export function resolveFinalizePlanScope(input = {}) {
  const safeInput = normalizedInput(input);
  const plansValue = ownValue(safeInput, 'plans');
  const targetSlug = normalizedSlug(ownString(safeInput, 'targetSlug'));
  const focusSlug = normalizedSlug(ownString(safeInput, 'focusSlug'));
  const confirmed = ownBoolean(safeInput, 'confirmed') === true;
  const plans = Array.isArray(plansValue) ? plansValue : [];

  const classifications = [];
  for (const plan of plans) {
    const slug = ownString(plan, 'slug');
    if (slug === undefined) continue;
    classifications.push({ slug, class: classifyPlan(plan, targetSlug) });
  }

  const warnings = classifications
    .filter((classification) => classification.class === 'other-active')
    .map((classification) => ({
      kind: 'nonarchived-sibling-plan',
      slug: classification.slug,
      reason: `non-archived sibling plan ${classification.slug} would be included by a branch merge`,
    }));

  const result = initialResult(targetSlug, classifications, warnings);

  // `target` is non-null ONLY when the named target plan is actually found below.
  // On every fail-closed path where it was never resolved, null it so a `block`
  // result never advertises a target it did not validate.
  if (!Array.isArray(plansValue)) {
    result.target = null;
    result.blockReason = 'plans must be an array of parsed plan states';
    return result;
  }

  if (targetSlug === null) {
    result.blockReason = 'explicit targetSlug is required before finalizing a plan';
    return result;
  }

  const matches = plans.filter((plan) => ownString(plan, 'slug') === targetSlug);
  if (matches.length === 0) {
    result.target = null;
    result.blockReason = `target plan ${targetSlug} was not found among branch plans`;
    return result;
  }
  if (matches.length > 1) {
    // FAIL-CLOSED on an ambiguous target: slugs can collide across projects on one
    // branch. Picking the first match could publish against a terminal plan while a
    // same-slug unfinished plan rides the merge along — disambiguate by project first.
    result.target = null;
    result.blockReason = `target slug ${targetSlug} is ambiguous: ${matches.length} branch plans share it — disambiguate by project before finalizing`;
    return result;
  }
  const targetPlan = matches[0];

  if (!isTerminalPlan(targetPlan)) {
    const status = ownString(targetPlan, 'status') ?? 'unknown';
    const phases = ownArray(targetPlan, 'phases');
    const undone = undonePhases(targetPlan);
    if (status === 'active' && (phases === undefined || phases.length === 0)) {
      result.blockReason = `target plan ${targetSlug} is active but has no determinable phases (missing/empty/non-array) — cannot confirm all phases done`;
    } else if (undone.length > 0) {
      result.blockReason = `target plan ${targetSlug} is active but has un-done phase(s): ${undone.join(', ')}`;
    } else {
      result.blockReason = `target plan ${targetSlug} is not terminal (status: ${status})`;
    }
    return result;
  }

  if (targetSlug !== focusSlug && !confirmed) {
    const branch = ownBranch(targetPlan);
    const branchLabel = typeof branch === 'string' ? branch : 'unknown';
    result.blockReason = `explicit target ${targetSlug} differs from focus ${focusSlug ?? 'none'}; branch name ${branchLabel} is not the plan slug, so confirm the branch-plan mismatch before finalizing`;
    return result;
  }

  result.decision = 'proceed';
  return result;
}

/**
 * detectPlanStatusRegression — pure, never-throws. ADVISORY (never gates).
 * @param {object} [input]
 * @param {Array<{slug:string, status:string}>} [input.branchPlans] plan status on THIS branch.
 * @param {Array<{slug:string, status:string}>} [input.refPlans]    plan status on the integrationRef.
 * @returns {Array<{slug:string, branchStatus:string, refStatus:string, reason:string}>}
 *   one entry per plan whose branch status is BEHIND the ref status; [] when none/clean.
 */
export function detectPlanStatusRegression(input = {}) {
  const safeInput = normalizedInput(input);
  const branchPlansValue = ownValue(safeInput, 'branchPlans');
  const refPlansValue = ownValue(safeInput, 'refPlans');
  if (!Array.isArray(branchPlansValue) || !Array.isArray(refPlansValue)) return [];

  const refBySlug = new Map();
  for (const plan of refPlansValue) {
    const slug = ownString(plan, 'slug');
    const status = ownString(plan, 'status');
    if (slug === undefined || status === undefined) continue;
    refBySlug.set(slug, status);
  }

  const regressions = [];
  for (const plan of branchPlansValue) {
    const slug = ownString(plan, 'slug');
    const branchStatus = ownString(plan, 'status');
    if (slug === undefined || branchStatus === undefined || !refBySlug.has(slug)) continue;

    const refStatus = refBySlug.get(slug);
    if (rankStatus(branchStatus) >= rankStatus(refStatus)) continue;

    regressions.push({
      slug,
      branchStatus,
      refStatus,
      reason: `plan ${slug} is ${branchStatus} on the branch but ${refStatus} on the integration ref; merge would regress it`,
    });
  }

  return regressions;
}
