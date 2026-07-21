/**
 * lifecycle-order-guard.js — pure classifier for project lifecycle order.
 *
 * This module does not read git, call gh, or mutate .atomic-skills state. Callers
 * pass already-parsed slices and receive an allow/block decision with an
 * actionable predecessor command.
 *
 * phase-done is split into two pure stages (F4/T-003):
 *   - preflightPhaseDone  — identity / DAG / open tasks (before gates/review)
 *   - commitGuardPhaseDone — re-reads gates (must be met), review, lessons,
 *     HEAD fingerprint before any terminal write/archive
 * decidePhaseDoneTerminal is the pure transaction decision used by tests:
 * blocked paths return zero writes/events/commits.
 */

import { validatePhaseDag } from '../src/transition.js';
import { phaseEvaluationAllowsClose } from '../src/phase-evaluation-gate.js';
import { phaseLessonsAllowsClose } from '../src/phase-lessons-gate.js';
import { phaseReviewAllowsClose } from '../src/phase-review-gate.js';

const EXCEPTIONS = Object.freeze({
  PHASE_ARCHIVE: 'phase-archive',
  SPLIT_PHASE: 'split-phase',
  HISTORICAL_DISCOVER: 'historical-discover',
  LOCAL_INTEGRATION: 'local-integration',
});

function object(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : '';
}

function bool(value) {
  return value === true;
}

/** Full or abbreviated git SHA (7–40 hex). Labels / prose are rejected. */
const GIT_SHA_RE = /^[0-9a-f]{7,40}$/i;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isGitSha(value) {
  return typeof value === 'string' && GIT_SHA_RE.test(value.trim());
}

/**
 * Compare full vs abbreviated SHAs (either side may be short).
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function shaMatches(a, b) {
  const x = text(a).toLowerCase();
  const y = text(b).toLowerCase();
  if (!x || !y) return false;
  return x === y || x.startsWith(y) || y.startsWith(x);
}

function slugOf(...values) {
  for (const value of values) {
    const slug = text(object(value).slug);
    if (slug) return slug;
  }
  return '<slug>';
}

function allow({ exception = null, reason = null } = {}) {
  return {
    allowed: true,
    blocked: false,
    code: null,
    reason,
    exception,
    recommendedCommand: null,
  };
}

function block(code, reason, recommendedCommand) {
  return {
    allowed: false,
    blocked: true,
    code,
    reason,
    exception: null,
    recommendedCommand,
  };
}

function commandOf(input) {
  const raw = text(input.command);
  return raw.replace(/\s+/g, ' ');
}

function targetKindOf(input) {
  return text(input.targetKind) || text(object(input.target).kind) || text(object(input.plan).kind);
}

function integrationOf(value) {
  const entity = object(value);
  return object(entity.integration);
}

function prOf(value) {
  const entity = object(value);
  const integration = integrationOf(entity);
  return object(integration.pr ?? entity.pr);
}

function hasNamedLocalIntegration(value) {
  const entity = object(value);
  const integration = integrationOf(entity);
  if (integration.required !== false) return false;
  return Boolean(text(integration.justification) || text(entity.integrationJustification) || entity.branch === null);
}

function hasPublicationAttempt(value) {
  const entity = object(value);
  const integration = integrationOf(entity);
  const pr = prOf(entity);
  const prState = text(pr.state).toUpperCase();
  return Boolean(
    bool(entity.finalized) ||
    bool(entity.consolidated) ||
    text(entity.prIdentity) ||
    (prState && prState !== 'NONE') ||
    text(pr.url) ||
    text(integration.finalizedAt) ||
    text(integration.consolidatedAt),
  );
}

function hasIntegrationProof(value) {
  const entity = object(value);
  const integration = integrationOf(entity);
  const pr = prOf(entity);
  return Boolean(
    bool(integration.integrated) ||
    bool(integration.merged) ||
    bool(entity.integrated) ||
    pr.state === 'MERGED' ||
    bool(pr.merged),
  );
}

function publicationCommand(slug) {
  return `finalize ${slug}`;
}

function archivePlan(input) {
  const target = object(input.target ?? input.plan);
  const slug = slugOf(target, input);

  if (hasNamedLocalIntegration(target)) {
    return allow({
      exception: EXCEPTIONS.LOCAL_INTEGRATION,
      reason: `plan ${slug} records explicit local integration; no PR proof is required`,
    });
  }

  if (!hasPublicationAttempt(target) && !hasIntegrationProof(target)) {
    return block(
      'archive-missing-publication',
      `archive ${slug} requires finalize/consolidate publication before archive`,
      `Run \`${publicationCommand(slug)}\`, merge the PR, then rerun \`archive ${slug}\`.`,
    );
  }

  if (!hasIntegrationProof(target)) {
    return block(
      'archive-missing-merge',
      `archive ${slug} requires merged integration proof before archive`,
      `Merge the PR for ${slug}, then rerun \`archive ${slug}\`.`,
    );
  }

  return allow();
}

function archivePhase(input) {
  const caller = text(input.caller ?? object(input.context).caller);
  if (caller === 'phase-done' || caller === 'archive-plan' || bool(input.phaseArchive)) {
    return allow({
      exception: EXCEPTIONS.PHASE_ARCHIVE,
      reason: 'phase archive is an internal move after the phase lifecycle transition',
    });
  }

  return block(
    'phase-archive-requires-phase-done',
    'phase archive is internal and requires the phase-done transition first',
    'Run `phase-done` before moving the phase into phases/archive/.',
  );
}

function splitPhase(input) {
  if (bool(input.preservesExecutionPath) || bool(object(input.context).preservesExecutionPath)) {
    return allow({
      exception: EXCEPTIONS.SPLIT_PHASE,
      reason: 'split-phase preserves the execution path with explicit replacement phases',
    });
  }

  return block(
    'split-phase-missing-preserved-path',
    'split-phase may archive the original phase only when the replacement path is explicit',
    'Run `split-phase <phase-id>` with replacement phases that preserve the execution path.',
  );
}

function discoverHistory(input) {
  if (bool(input.historicalImport) || text(input.mode) === 'historical' || bool(object(input.target).historicalImport)) {
    return allow({
      exception: EXCEPTIONS.HISTORICAL_DISCOVER,
      reason: 'discover is importing pre-existing historical archived state',
    });
  }

  return block(
    'discover-archive-not-historical',
    'discover may import archived state only when the import is explicitly historical',
    'Record historical evidence for `discover`, or run the normal finalize/merge/archive lifecycle.',
  );
}

function dependResolveArchived(input) {
  const prerequisite = object(input.prerequisite ?? input.target);
  const dependentSlug = text(input.dependentSlug) || slugOf(input.dependent);
  const prerequisiteSlug = slugOf(prerequisite, { slug: input.prerequisiteSlug });

  if (text(prerequisite.status) !== 'archived') {
    return block(
      'dependency-prerequisite-not-archived',
      `dependency ${prerequisiteSlug} is not archived`,
      `Finish ${prerequisiteSlug}, run \`archive ${prerequisiteSlug}\`, then \`depend resolve ${dependentSlug} ${prerequisiteSlug} --archived\`.`,
    );
  }

  if (!hasNamedLocalIntegration(prerequisite) && !hasIntegrationProof(prerequisite)) {
    return block(
      'dependency-prerequisite-not-integrated',
      `dependency ${prerequisiteSlug} is archived but has no integration proof`,
      `Run \`${publicationCommand(prerequisiteSlug)}\`, merge the PR, rerun \`archive ${prerequisiteSlug}\`, then \`depend resolve ${dependentSlug} ${prerequisiteSlug} --archived\`.`,
    );
  }

  return allow();
}

function reviewGateComplete(reviewGate) {
  const gate = object(reviewGate);
  if (gate.status === 'passed') {
    // F4/T-004: passed requires a real SHA + mode; reviewFile optional but coherent.
    if (!isGitSha(gate.at)) return false;
    if (!text(gate.mode)) return false;
    if (Object.prototype.hasOwnProperty.call(gate, 'reviewFile') && !text(gate.reviewFile)) {
      return false;
    }
    return true;
  }
  if (gate.status === 'skipped') return Boolean(text(gate.reason));
  return false;
}

/**
 * Collect verifiedCommit anchors from exit-gate evidence (F4/T-004).
 * @param {unknown[]} exitGates
 * @returns {string[]}
 */
function evidenceCommitsOf(exitGates) {
  const commits = [];
  for (const gate of array(exitGates)) {
    const vc = text(object(object(gate).evidence).verifiedCommit);
    if (vc) commits.push(vc);
  }
  return commits;
}

/**
 * Exit gate is terminal-pass only when status is `met`.
 * deferred / pending / failed / declined are NOT terminal paths (F4/T-003).
 * @param {unknown} gate
 * @returns {boolean}
 */
export function gatePassed(gate) {
  return object(gate).status === 'met';
}

function phaseSlice(input) {
  return object(input.phase ?? input.initiative);
}

function tasksOf(input) {
  const phase = phaseSlice(input);
  return input.tasks ?? phase.tasks;
}

/**
 * Resolve exit gates for commit-guard / terminal decisions.
 *
 * When `input.plan` is present, union plan.phases[phaseId].exitGate.criteria
 * with initiative `exitGates`. Plan criteria are authoritative on id conflict
 * so empty / omitted initiative exitGates cannot vacuous-authorize a close
 * while plan still has open criteria (F4 review F-001).
 *
 * @param {object} input
 * @returns {unknown[]}
 */
function exitGatesOf(input) {
  const phase = phaseSlice(input);
  const initiativeGates = array(input.exitGates ?? phase.exitGates);
  const plan = object(input.plan);
  const phaseId = text(input.phaseId) || text(phase.phaseId);

  if (!Array.isArray(plan.phases) || plan.phases.length === 0 || !phaseId) {
    return initiativeGates;
  }

  const planPhase = plan.phases.find(
    (p) => object(p).id === phaseId || object(p).slug === phaseId,
  );
  if (!planPhase) return initiativeGates;

  const planCriteria = array(object(object(planPhase).exitGate).criteria);
  // Some slices may put gates on phase.exitGates (initiative shape on plan).
  const planExitGates = array(object(planPhase).exitGates);
  const planGates = planCriteria.length > 0 ? planCriteria : planExitGates;

  if (planGates.length === 0) {
    return initiativeGates;
  }

  // Union by id: initiative first, plan overwrites (plan authoritative).
  const byId = new Map();
  for (const gate of initiativeGates) {
    const id = text(object(gate).id);
    if (id) byId.set(id, gate);
    else byId.set(`__anon_init_${byId.size}`, gate);
  }
  for (const gate of planGates) {
    const id = text(object(gate).id);
    if (id) byId.set(id, gate);
    else byId.set(`__anon_plan_${byId.size}`, gate);
  }

  const merged = Array.from(byId.values());
  // Fail closed: plan declared criteria but merge produced nothing usable.
  if (merged.length === 0) {
    return planGates;
  }
  return merged;
}

function reviewGateOf(input) {
  if (input.reviewGate != null && typeof input.reviewGate === 'object') {
    return input.reviewGate;
  }
  const phase = phaseSlice(input);
  if (phase.reviewGate != null && typeof phase.reviewGate === 'object') {
    return phase.reviewGate;
  }
  const plan = object(input.plan);
  const phaseId = text(input.phaseId) || text(phase.phaseId) || text(phase.id);
  if (!Array.isArray(plan.phases) || !phaseId) return input.reviewGate ?? phase.reviewGate;
  const planPhase = plan.phases.find(
    (p) => object(p).id === phaseId || object(p).slug === phaseId,
  );
  if (planPhase == null) return null;
  const rg = object(planPhase).reviewGate;
  return rg != null && typeof rg === 'object' ? rg : null;
}

/**
 * Resolve plan.executionMode for durable automate checks (preflight).
 * @param {object} input
 * @returns {string}
 */
function planExecutionModeOf(input) {
  return (
    text(input.planExecutionMode) ||
    text(object(input.plan).executionMode) ||
    ''
  );
}

/**
 * Resolve evaluationGate from input, phase slice, or plan.phases[].
 * @param {object} input
 * @returns {object|null}
 */
function evaluationGateOf(input) {
  if (input.evaluationGate != null && typeof input.evaluationGate === 'object') {
    return input.evaluationGate;
  }
  const phase = phaseSlice(input);
  if (phase.evaluationGate != null && typeof phase.evaluationGate === 'object') {
    return phase.evaluationGate;
  }
  const plan = object(input.plan);
  const phaseId = text(input.phaseId) || text(phase.phaseId) || text(phase.id);
  if (!Array.isArray(plan.phases) || !phaseId) return null;
  const planPhase = plan.phases.find(
    (p) => object(p).id === phaseId || object(p).slug === phaseId,
  );
  if (planPhase == null) return null;
  const eg = object(planPhase).evaluationGate;
  return eg != null && typeof eg === 'object' ? eg : null;
}

/**
 * Under durable automate stamp, evaluationGate must allow phase-done (R1).
 * Non-automate: no-op allow.
 * @param {object} input
 */
function checkPhaseDoneEvaluation(input) {
  const planExecutionMode = planExecutionModeOf(input);
  const result = phaseEvaluationAllowsClose({
    planExecutionMode: planExecutionMode || null,
    automateActive: input.automateActive === true,
    evaluationGate: evaluationGateOf(input),
  });
  if (result.ok) return allow();
  return block(
    'phase-done-evaluation-open',
    result.reason ||
      'phase-done under automate requires evaluationGate before exit gates / review',
    'Run the evaluation agent and stamp phases[].evaluationGate (passed|skipped+reason|failed-dispositioned), then rerun `phase-done`.',
  );
}

/**
 * Resolve lessons fields from input, phase/initiative slice, or plan.phases[].
 * Same lookup ladder as evaluationGateOf (plan phase is authoritative for automate stamps).
 * @param {object} input
 * @returns {{ lessonsState?: unknown, lessonsPath?: unknown, noneReason?: unknown }}
 */
function lessonsFieldsOf(input) {
  const phase = phaseSlice(input);
  if (input.lessonsState != null || input.lessonsPath != null) {
    return {
      lessonsState: input.lessonsState,
      lessonsPath: input.lessonsPath,
      noneReason: input.noneReason,
    };
  }
  if (phase.lessonsState != null || phase.lessonsPath != null) {
    return {
      lessonsState: phase.lessonsState,
      lessonsPath: phase.lessonsPath,
      noneReason: phase.noneReason,
    };
  }
  const plan = object(input.plan);
  const phaseId = text(input.phaseId) || text(phase.phaseId) || text(phase.id);
  if (!Array.isArray(plan.phases) || !phaseId) return {};
  const planPhase = plan.phases.find(
    (p) => object(p).id === phaseId || object(p).slug === phaseId,
  );
  if (planPhase == null) return {};
  const pp = object(planPhase);
  return {
    lessonsState: pp.lessonsState,
    lessonsPath: pp.lessonsPath,
    noneReason: pp.noneReason,
  };
}

/**
 * Under durable automate stamp, lessons must be answered before phase-done (R2).
 * Non-automate: no-op allow (commitGuard still enforces requireLessons later).
 * @param {object} input
 */
function checkPhaseDoneLessons(input) {
  const planExecutionMode = planExecutionModeOf(input);
  const fields = lessonsFieldsOf(input);
  const result = phaseLessonsAllowsClose({
    planExecutionMode: planExecutionMode || null,
    automateActive: input.automateActive === true,
    lessonsState: fields.lessonsState,
    lessonsPath: fields.lessonsPath,
    noneReason: fields.noneReason,
    phase: fields,
  });
  if (result.ok) return allow();
  return block(
    'phase-done-lessons-open',
    result.reason ||
      'phase-done under automate requires lessonsState recorded|none before advance',
    'Distill phase lessons, present Proposed lessons for operator ratify, write lessons/<initiative>.md and stamp lessonsState=recorded + lessonsPath — or stamp lessonsState=none for a clean phase — then rerun `phase-done`. Silence is not an answer.',
  );
}

/**
 * Under durable automate stamp, reviewGate must satisfy phase-review honesty (R3):
 * mode both (or both-codex/grok/claude or external-both), or skipped with
 * operatorSkip+reason, or local only with non-empty overrideReason.
 * @param {object} input
 */
function checkPhaseDoneAutomateReview(input) {
  const planExecutionMode = planExecutionModeOf(input);
  const result = phaseReviewAllowsClose({
    planExecutionMode: planExecutionMode || null,
    automateActive: input.automateActive === true,
    reviewGate: reviewGateOf(input),
  });
  if (result.ok) return allow();
  return block(
    'phase-done-review-open',
    result.reason ||
      'phase-done under automate requires reviewGate mode both (or operator skip/local override)',
    'Run `atomic-skills:review-code --mode=both`, stamp reviewGate (mode both + at + reviewFile), or record operator skip with operatorSkip+reason / local with overrideReason — then rerun `phase-done`.',
  );
}

/**
 * Identity for phase-done: initiative must carry parentPlan + phaseId (or
 * callers pass them explicitly). Optional plan slice checks the phase exists.
 * @param {object} input
 * @returns {{allowed:boolean, blocked:boolean, code:string|null, reason:string|null,
 *   exception:string|null, recommendedCommand:string|null}}
 */
function checkPhaseDoneIdentity(input) {
  const phase = phaseSlice(input);
  const parentPlan = text(input.parentPlan) || text(phase.parentPlan);
  const phaseId = text(input.phaseId) || text(phase.phaseId);

  if (!parentPlan || !phaseId) {
    return block(
      'phase-done-missing-identity',
      'phase-done requires parentPlan + phaseId identity before any gate or write',
      'Load the active phase initiative with parentPlan and phaseId, then rerun `phase-done`.',
    );
  }

  const plan = object(input.plan);
  if (Array.isArray(plan.phases) && plan.phases.length > 0) {
    const match = plan.phases.find((p) => object(p).id === phaseId || object(p).slug === phaseId);
    if (!match) {
      return block(
        'phase-done-identity-mismatch',
        `phase-done identity ${parentPlan}/${phaseId} is not present on the parent plan phases[]`,
        `Fix parentPlan/phaseId or load the correct plan for ${parentPlan}, then rerun \`phase-done\`.`,
      );
    }
  }

  return allow();
}

/**
 * Optional DAG validation when a plan slice is provided.
 * @param {object} input
 */
function checkPhaseDoneDag(input) {
  const plan = object(input.plan);
  if (!Array.isArray(plan.phases) || plan.phases.length === 0) {
    return allow();
  }
  const dag = validatePhaseDag(plan);
  if (dag.ok) return allow();
  const first = array(dag.errors)[0] || {};
  const code = text(first.code) || 'phase-done-dag-invalid';
  return block(
    `phase-done-dag-${code}`,
    `phase-done cannot proceed while the phase DAG is invalid: ${text(first.message) || code}`,
    'Fix dependsOn (unknown ids, self-loops, cycles), then rerun `phase-done`.',
  );
}

/**
 * Open-task check. Missing tasks array is a hard block (cannot bulk-close).
 * @param {object} input
 */
function checkPhaseDoneTasks(input) {
  const rawTasks = tasksOf(input);
  if (!Array.isArray(rawTasks)) {
    return block(
      'phase-done-missing-tasks',
      'phase-done requires a parsed tasks array before transition',
      'Load the active phase initiative, then rerun `phase-done`.',
    );
  }

  const openTask = rawTasks.find((task) => object(task).status !== 'done');
  if (openTask) {
    const id = text(object(openTask).id) || '<task-id>';
    return block(
      'phase-done-open-task',
      `phase-done cannot run while task ${id} is open`,
      `Run \`done ${id}\`, then rerun \`phase-done\`.`,
    );
  }

  return allow();
}

/**
 * Pure preflight for phase-done — runs BEFORE exit-gate verifiers / review.
 *
 * Validates identity (parentPlan+phaseId), optional plan DAG, that every
 * task is already done, and (when plan.executionMode is automate) that
 * evaluationGate allows close via phaseEvaluationAllowsClose. Does NOT require
 * exit gates, reviewGate, lessons, or fingerprint — so evidence production may
 * proceed after a green preflight on non-automate (and after evaluation stamp
 * on automate).
 *
 * On block: callers must produce zero gate-verifier runs, review, events,
 * archive moves, status writes, or commits.
 *
 * @param {object} [input]
 * @returns {{allowed:boolean, blocked:boolean, code:string|null, reason:string|null,
 *   exception:string|null, recommendedCommand:string|null}}
 */
export function preflightPhaseDone(input = {}) {
  const safe = object(input);
  const identity = checkPhaseDoneIdentity(safe);
  if (identity.blocked) return identity;
  const dag = checkPhaseDoneDag(safe);
  if (dag.blocked) return dag;
  const tasks = checkPhaseDoneTasks(safe);
  if (tasks.blocked) return tasks;
  // R1: under plan.executionMode automate, evaluationGate must allow close
  // before exit-gate verifiers / review-code run.
  const evaluation = checkPhaseDoneEvaluation(safe);
  if (evaluation.blocked) return evaluation;
  // R2: under durable automate, lessons must be *answered* (recorded+path or
  // explicit none) before phase-done — silence is skip of distill/ratify.
  const lessons = checkPhaseDoneLessons(safe);
  if (lessons.blocked) return lessons;
  // R3: under durable automate, reviewGate must be both (or operator skip/local
  // with override) — dogfood local-without-both is blocked.
  return checkPhaseDoneAutomateReview(safe);
}

/**
 * Pure commit guard for phase-done — runs AFTER evidence / review / lessons.
 *
 * Re-checks preflight, then requires:
 *   - every exit gate status === `met` (deferred/pending/failed/declined block).
 *     Gates are the union of initiative exitGates and plan.phases[].exitGate.criteria
 *     when a plan slice is present (plan authoritative on conflict). Empty initiative
 *     exitGates do not vacuous-pass while plan criteria remain open (F-001).
 *   - reviewGate recorded (passed+real SHA+mode or skipped+reason when requireReview)
 *   - lessons recorded or explicitly none when requireLessons
 *   - HEAD fingerprint matches evidence anchors:
 *       expectedFingerprint / evidence.verifiedCommit / reviewGate.at
 *     A HEAD change after review fixes invalidates prior gate evidence — re-run
 *     verifiers before the guard accepts (F4/T-004).
 *
 * Deferred / skip of exit gates is NEVER a terminal path.
 *
 * @param {object} [input]
 * @param {string} [input.fingerprint] current HEAD (or content) fingerprint
 * @param {string} [input.expectedFingerprint] fingerprint recorded with evidence
 * @param {boolean} [input.requireReview=true]
 * @param {boolean} [input.requireLessons=true]
 * @param {boolean} [input.requireFingerprint=true]
 */
export function commitGuardPhaseDone(input = {}) {
  const safe = object(input);
  const pre = preflightPhaseDone(safe);
  if (pre.blocked) return pre;

  const exitGates = exitGatesOf(safe);
  const openGate = exitGates.find((gate) => !gatePassed(gate));
  if (openGate) {
    const item = object(openGate);
    const id = text(item.id) || '<gate-id>';
    const status = text(item.status) || 'pending';
    if (status === 'deferred') {
      return block(
        'phase-done-gate-deferred',
        `phase-done cannot advance while exit gate ${id} is deferred — defer is not a terminal path`,
        `Run the verifier for ${id} until status is met, or leave the phase active/paused. Do not close via defer.`,
      );
    }
    return block(
      'phase-done-open-gate',
      `phase-done cannot advance while exit gate ${id} is ${status} (must be met)`,
      `Run the verifier for ${id} until it is met with current evidence, then rerun \`phase-done\`.`,
    );
  }

  if (safe.requireReview !== false) {
    const rg = reviewGateOf(safe);
    if (!reviewGateComplete(rg)) {
      return block(
        'phase-done-review-open',
        'phase-done requires a recorded reviewGate before the phase can advance',
        'Run `atomic-skills:review-code <range>` and record reviewGate (passed + SHA + mode), then rerun `phase-done`.',
      );
    }
    // Under durable automate, mode must be both* (or operator skip/local override)
    // — not bare local without overrideReason (dogfood skip).
    const planExecutionMode = planExecutionModeOf(safe);
    const reviewHonesty = phaseReviewAllowsClose({
      planExecutionMode: planExecutionMode || null,
      automateActive: safe.automateActive === true,
      reviewGate: rg,
    });
    if (!reviewHonesty.ok) {
      return block(
        'phase-done-review-open',
        reviewHonesty.reason ||
          'phase-done under automate requires reviewGate mode both',
        'Run `atomic-skills:review-code --mode=both` and stamp reviewGate (mode both + at + reviewFile), or operator skip/local with overrideReason.',
      );
    }
  }

  if (safe.requireLessons !== false) {
    const phase = phaseSlice(safe);
    const lessonsState = text(safe.lessonsState ?? phase.lessonsState);
    if (lessonsState !== 'recorded' && lessonsState !== 'none') {
      return block(
        'phase-done-lessons-open',
        'phase-done requires lessons to be recorded or explicitly marked none',
        'Record phase lessons or `no lessons distilled`, then rerun `phase-done`.',
      );
    }
  }

  if (safe.requireFingerprint !== false) {
    const current = text(safe.fingerprint ?? safe.headSha ?? safe.currentFingerprint);
    if (!current) {
      return block(
        'phase-done-fingerprint-missing',
        'phase-done commit guard requires the current HEAD fingerprint',
        'Capture `git rev-parse HEAD` as fingerprint and rerun the commit guard.',
      );
    }

    // F4/T-004: evidence.verifiedCommit is the durable anchor. A review that
    // mutates HEAD leaves prior verifiedCommit values pointing at the old tree
    // — the guard refuses to close until verifiers re-run against current HEAD.
    const evidenceCommits = evidenceCommitsOf(exitGates);
    for (const vc of evidenceCommits) {
      if (!shaMatches(vc, current)) {
        return block(
          'phase-done-fingerprint-stale',
          `phase-done commit guard: gate evidence verifiedCommit ${vc} does not match HEAD ${current} — review fixes (or any HEAD change) invalidate prior gate evidence`,
          'Re-run exit-gate verifiers against the current HEAD, stamp evidence.verifiedCommit, then rerun `phase-done`.',
        );
      }
    }

    const rg = object(reviewGateOf(safe));
    if (rg.status === 'passed') {
      const at = text(rg.at);
      if (at && !shaMatches(at, current)) {
        return block(
          'phase-done-review-stale',
          `phase-done commit guard: reviewGate.at ${at} does not match HEAD ${current}`,
          'Re-run review against the current HEAD after fixes, record reviewGate.at to the closed HEAD, then rerun `phase-done`.',
        );
      }
    }

    let expected = text(safe.expectedFingerprint ?? safe.evidenceFingerprint ?? safe.recordedFingerprint);
    if (!expected && evidenceCommits.length > 0) {
      expected = evidenceCommits[0];
    }
    if (!expected) {
      return block(
        'phase-done-fingerprint-unanchored',
        'phase-done commit guard requires the fingerprint recorded with gate evidence (expectedFingerprint or evidence.verifiedCommit)',
        'Re-run exit-gate verifiers against the current HEAD, record verifiedCommit / fingerprint, then rerun the commit guard.',
      );
    }
    if (!shaMatches(current, expected)) {
      return block(
        'phase-done-fingerprint-stale',
        `phase-done commit guard fingerprint mismatch: evidence at ${expected}, HEAD is ${current}`,
        'Re-run exit-gate verifiers and review against the current HEAD, then rerun `phase-done`.',
      );
    }
  }

  return allow();
}

/**
 * Pure transaction decision for phase-done terminal mutation.
 *
 * When blocked: terminal=false and writes/events/commits are empty arrays
 * (zero terminal side effects). When allowed: describes the intended terminal
 * effects without performing I/O. Callers (and unit tests) use this as the
 * single gate before any close write, completion event, archive, or commit.
 *
 * Bypass attempts (defer, skip, status-edit to done, direct advance) with an
 * open/deferred/pending gate all resolve to the blocked empty-effect shape.
 *
 * @param {object} [input]
 * @returns {{
 *   allowed:boolean, blocked:boolean, terminal:boolean,
 *   code:string|null, reason:string|null, exception:string|null,
 *   recommendedCommand:string|null,
 *   writes:string[], events:string[], commits:string[],
 * }}
 */
export function decidePhaseDoneTerminal(input = {}) {
  const safe = object(input);
  const stage = text(safe.stage) || 'commit';
  const decision = stage === 'preflight'
    ? preflightPhaseDone(safe)
    : commitGuardPhaseDone(safe);

  if (decision.blocked) {
    return {
      ...decision,
      terminal: false,
      writes: [],
      events: [],
      commits: [],
    };
  }

  const phase = phaseSlice(safe);
  const phaseId = text(safe.phaseId) || text(phase.phaseId) || '<phase-id>';
  return {
    ...decision,
    terminal: true,
    // No bulk-close: tasks must already be done. Terminal surfaces only.
    writes: ['initiative:status:done', 'plan:phase:status:done', 'archive:move', 'project-status'],
    events: [`phase-done:${phaseId}`],
    commits: [`chore(project): advance <plan> ${phaseId}`],
  };
}

/**
 * Legacy single-shot phase-done classifier.
 * Defaults to commit-guard semantics. Pass stage:'preflight' for preflight only.
 * @param {object} input
 */
function phaseDone(input) {
  const stage = text(input.stage) || 'commit';
  if (stage === 'preflight') return preflightPhaseDone(input);
  return commitGuardPhaseDone(input);
}

/**
 * Classify whether a lifecycle command may proceed.
 *
 * @param {object} input
 * @param {string} input.command command family, e.g. archive, phase-done,
 *   split-phase, discover, depend resolve --archived
 * @param {string} [input.stage] for phase-done: 'preflight' | 'commit' (default commit)
 * @returns {{allowed:boolean, blocked:boolean, code:string|null, reason:string|null,
 *   exception:string|null, recommendedCommand:string|null}}
 */
export function classifyLifecycleOrder(input = {}) {
  const safe = object(input);
  const command = commandOf(safe);
  const targetKind = targetKindOf(safe);

  if (command === 'archive' && targetKind === 'phase') return archivePhase(safe);
  if (command === 'archive' || command === 'archive-plan') return archivePlan(safe);
  if (command === 'depend resolve --archived' || command === 'depend-resolve-archived') {
    return dependResolveArchived(safe);
  }
  if (command === 'phase-done') return phaseDone(safe);
  if (command === 'split-phase') return splitPhase(safe);
  if (command === 'discover' || command === 'discover-history') return discoverHistory(safe);

  return block(
    'unknown-lifecycle-command',
    `unknown lifecycle command ${command || '<empty>'}`,
    'Use a known lifecycle command before mutating project state.',
  );
}

export { EXCEPTIONS as LIFECYCLE_ORDER_EXCEPTIONS };
