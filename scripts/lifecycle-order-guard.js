/**
 * lifecycle-order-guard.js — pure classifier for project lifecycle order.
 *
 * This module does not read git, call gh, or mutate .atomic-skills state. Callers
 * pass already-parsed slices and receive an allow/block decision with an
 * actionable predecessor command.
 */

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
  return Boolean(
    bool(entity.finalized) ||
    bool(entity.consolidated) ||
    text(entity.prIdentity) ||
    text(pr.state) ||
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
  if (gate.status === 'passed') return Boolean(text(gate.at));
  if (gate.status === 'skipped') return Boolean(text(gate.reason));
  return false;
}

function gateComplete(gate) {
  const item = object(gate);
  if (item.status === 'met') return true;
  if (item.status === 'deferred') return Boolean(text(item.deferredReason));
  return false;
}

function phaseDone(input) {
  const phase = object(input.phase ?? input.initiative);
  const tasks = array(input.tasks ?? phase.tasks);
  const exitGates = array(input.exitGates ?? phase.exitGates);
  const reviewGate = input.reviewGate ?? phase.reviewGate;

  if (!Array.isArray(input.tasks ?? phase.tasks)) {
    return block(
      'phase-done-missing-tasks',
      'phase-done requires a parsed tasks array before transition',
      'Load the active phase initiative, then rerun `phase-done`.',
    );
  }

  const openTask = tasks.find((task) => object(task).status !== 'done');
  if (openTask) {
    const id = text(object(openTask).id) || '<task-id>';
    return block(
      'phase-done-open-task',
      `phase-done cannot run while task ${id} is open`,
      `Run \`done ${id}\`, then rerun \`phase-done\`.`,
    );
  }

  const pendingGate = exitGates.find((gate) => !gateComplete(gate));
  if (pendingGate) {
    const id = text(object(pendingGate).id) || '<gate-id>';
    return block(
      'phase-done-open-gate',
      `phase-done cannot advance while exit gate ${id} is not met or deferred`,
      `Run the verifier for ${id}, then rerun \`phase-done\`.`,
    );
  }

  if (input.requireReview !== false && !reviewGateComplete(reviewGate)) {
    return block(
      'phase-done-review-open',
      'phase-done requires a recorded reviewGate before the phase can advance',
      'Run `atomic-skills:review-code <range>` and record reviewGate, then rerun `phase-done`.',
    );
  }

  if (input.requireLessons === true) {
    const lessonsState = text(input.lessonsState ?? phase.lessonsState);
    if (lessonsState !== 'recorded' && lessonsState !== 'none') {
      return block(
        'phase-done-lessons-open',
        'phase-done requires lessons to be recorded or explicitly marked none',
        'Record phase lessons or `no lessons distilled`, then rerun `phase-done`.',
      );
    }
  }

  return allow();
}

/**
 * Classify whether a lifecycle command may proceed.
 *
 * @param {object} input
 * @param {string} input.command command family, e.g. archive, phase-done,
 *   split-phase, discover, depend resolve --archived
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
