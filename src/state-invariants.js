const TERMINAL_STATUSES = new Set(['done', 'archived']);
const MATERIALIZED_STATUSES = new Set(['active', 'paused', 'done', 'archived']);
const COMPLETE_GATE_STATUSES = new Set(['met', 'deferred']);

const text = (value) => (typeof value === 'string' && value.length > 0 ? value : null);
const list = (value) => (Array.isArray(value) ? value : []);
const projectIdOf = (value) => text(value?.__projectId) ?? '__legacy';

export function isTerminalStatus(status) {
  return TERMINAL_STATUSES.has(status);
}

export function stateIdentity(value = {}) {
  return {
    projectId: projectIdOf(value),
    planSlug: text(value.parentPlan ?? value.slug),
    phaseId: text(value.phaseId ?? value.id),
    initiativeSlug: text(value.slug),
  };
}

function violation(code, message, context = {}) {
  return { code, message, ...context };
}

function duplicates(items, selector) {
  const seen = new Set();
  const duplicate = new Set();
  for (const item of items) {
    const value = text(selector(item));
    if (!value) continue;
    if (seen.has(value)) duplicate.add(value);
    seen.add(value);
  }
  return [...duplicate].sort();
}

function contextFor(plan, phase, initiative) {
  return {
    projectId: projectIdOf(plan ?? initiative),
    planSlug: text(plan?.slug ?? initiative?.parentPlan) ?? '?',
    phaseId: text(phase?.id ?? initiative?.phaseId) ?? '?',
    initiativeSlug: text(phase?.slug ?? initiative?.slug) ?? '?',
  };
}

/**
 * Pure authority for plan↔phase identity, terminality and local id uniqueness.
 * It intentionally treats a pending descriptor without an initiative as a valid
 * lazy phase. Every other phase status represents materialized state and must
 * join to exactly one initiative in the same project.
 */
export function collectStateIntegrityViolations(planFrontmatters, initiativeFrontmatters) {
  const violations = [];
  const plans = [...planFrontmatters.values()].filter(Boolean);
  const initiatives = [...initiativeFrontmatters.values()].filter(Boolean);
  const matchedInitiatives = new Set();

  for (const initiative of initiatives) {
    const ctx = contextFor(null, null, initiative);
    for (const id of duplicates(list(initiative.tasks), (task) => task?.id)) {
      violations.push(violation('duplicate-task-id', `initiative ${ctx.initiativeSlug} repeats task id ${id}`, ctx));
    }
    for (const id of duplicates(list(initiative.exitGates), (gate) => gate?.id)) {
      violations.push(violation('duplicate-initiative-gate-id', `initiative ${ctx.initiativeSlug} repeats exit gate id ${id}`, ctx));
    }
  }

  for (const plan of plans) {
    const phases = list(plan.phases);
    const planCtx = contextFor(plan, null, null);
    for (const id of duplicates(phases, (phase) => phase?.id)) {
      violations.push(violation('duplicate-phase-id', `plan ${plan.slug ?? '?'} repeats phase id ${id}`, { ...planCtx, phaseId: id }));
    }
    for (const slug of duplicates(phases, (phase) => phase?.slug)) {
      violations.push(violation('duplicate-phase-slug', `plan ${plan.slug ?? '?'} repeats phase slug ${slug}`, { ...planCtx, initiativeSlug: slug }));
    }
    if (isTerminalStatus(plan.status)) {
      for (const phase of phases.filter((item) => !isTerminalStatus(item?.status))) {
        violations.push(violation('terminal-plan-open-phase', `terminal plan ${plan.slug ?? '?'} contains non-terminal phase ${phase?.id ?? '?'}`, contextFor(plan, phase, null)));
      }
    }

    for (const phase of phases) {
      const ctx = contextFor(plan, phase, null);
      for (const id of duplicates(list(phase?.exitGate?.criteria), (gate) => gate?.id)) {
        violations.push(violation('duplicate-plan-gate-id', `phase ${phase?.id ?? '?'} repeats criterion id ${id}`, ctx));
      }

      const projectInitiatives = initiatives.filter((item) => projectIdOf(item) === projectIdOf(plan));
      const candidates = projectInitiatives.filter((item) => (
        (text(item.parentPlan) === text(plan.slug) && text(item.phaseId) === text(phase?.id))
        || text(item.slug) === text(phase?.slug)
      ));
      if (candidates.length === 0) {
        if (MATERIALIZED_STATUSES.has(phase?.status)) {
          violations.push(violation('missing-initiative', `phase ${phase?.id ?? '?'} is ${phase?.status} but has no project-scoped initiative`, ctx));
        }
        continue;
      }
      if (candidates.length > 1) {
        violations.push(violation('ambiguous-initiative-match', `phase ${phase?.id ?? '?'} matches ${candidates.length} initiatives`, ctx));
        continue;
      }

      const initiative = candidates[0];
      matchedInitiatives.add(initiative);
      const joined = contextFor(plan, phase, initiative);
      if (text(initiative.parentPlan) && text(initiative.parentPlan) !== text(plan.slug)) {
        violations.push(violation('parent-plan-mismatch', `initiative ${initiative.slug ?? '?'} parentPlan ${JSON.stringify(initiative.parentPlan)} does not match ${plan.slug}`, joined));
      }
      if (text(initiative.phaseId) && text(initiative.phaseId) !== text(phase?.id)) {
        violations.push(violation('phase-id-mismatch', `initiative ${initiative.slug ?? '?'} phaseId ${JSON.stringify(initiative.phaseId)} does not match ${phase?.id}`, joined));
      }
      if (text(initiative.slug) !== text(phase?.slug)) {
        violations.push(violation('phase-slug-mismatch', `initiative slug ${JSON.stringify(initiative.slug)} does not match descriptor slug ${JSON.stringify(phase?.slug)}`, joined));
      }

      if (!isTerminalStatus(phase?.status)) continue;
      if (!isTerminalStatus(initiative.status)) {
        violations.push(violation('terminal-status-mismatch', `terminal phase ${phase?.id ?? '?'} has non-terminal initiative status ${JSON.stringify(initiative.status)}`, joined));
      }
      const openTasks = list(initiative.tasks).filter((item) => item?.status !== 'done');
      if (openTasks.length > 0) {
        violations.push(violation(
          'terminal-open-task',
          `${openTasks.length} initiative task(s) not done: ${openTasks.map((task) => task?.id ?? '?').join(', ')}`,
          joined,
        ));
      }
      for (const gate of list(phase?.exitGate?.criteria).filter((item) => !COMPLETE_GATE_STATUSES.has(item?.status))) {
        violations.push(violation('terminal-open-plan-gate', `terminal phase ${phase?.id ?? '?'} contains open plan criterion ${gate?.id ?? '?'}`, joined));
      }
      for (const gate of list(initiative.exitGates).filter((item) => !COMPLETE_GATE_STATUSES.has(item?.status))) {
        violations.push(violation('terminal-open-initiative-gate', `terminal phase ${phase?.id ?? '?'} contains open initiative gate ${gate?.id ?? '?'}`, joined));
      }
    }
  }

  for (const initiative of initiatives) {
    if (matchedInitiatives.has(initiative)) continue;
    const ctx = contextFor(null, null, initiative);
    violations.push(violation('orphan-initiative', `initiative ${initiative.slug ?? '?'} does not join a phase in project ${ctx.projectId}`, ctx));
  }

  return violations;
}

export function formatStateIntegrityViolation(item) {
  return `[${item.code}] ${item.message}`;
}
