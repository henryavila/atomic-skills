const TERMINAL_STATUSES = new Set(['done', 'archived']);
const MATERIALIZED_STATUSES = new Set(['active', 'paused', 'done', 'archived']);
const COMPLETE_GATE_STATUSES = new Set(['met', 'deferred']);

const text = (value) => (typeof value === 'string' && value.length > 0 ? value : null);
const list = (value) => (Array.isArray(value) ? value : []);
const projectIdOf = (value) => text(value?.__projectId) ?? '__legacy';

export function isTerminalStatus(status) {
  return TERMINAL_STATUSES.has(status);
}

export function collectPhaseGraphViolations(plan = {}) {
  const phases = list(plan.phases);
  const byId = new Map(phases.filter((phase) => text(phase?.id)).map((phase) => [phase.id, phase]));
  const violations = [];
  for (const phase of phases) {
    const phaseId = text(phase?.id) ?? '?';
    for (const dependency of list(phase?.dependsOn)) {
      if (dependency === phaseId) {
        violations.push(violation('phase-self-dependency', `phase ${phaseId} depends on itself`, { phaseId }));
      } else if (!byId.has(dependency)) {
        violations.push(violation('unknown-phase-dependency', `phase ${phaseId} depends on unknown phase ${dependency}`, { phaseId }));
      }
    }
  }

  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  const cycleKeys = new Set();
  const visit = (id) => {
    if (visited.has(id)) return;
    visiting.add(id);
    stack.push(id);
    for (const dependency of list(byId.get(id)?.dependsOn)) {
      if (dependency === id || !byId.has(dependency)) continue;
      if (visiting.has(dependency)) {
        const start = stack.indexOf(dependency);
        const cycle = [...stack.slice(start), dependency];
        const nodes = cycle.slice(0, -1);
        const rotations = nodes.map((_, index) => [...nodes.slice(index), ...nodes.slice(0, index)]);
        rotations.sort((a, b) => a.join('\0').localeCompare(b.join('\0')));
        const canonical = [...rotations[0], rotations[0][0]];
        const key = canonical.join('\0');
        if (!cycleKeys.has(key)) {
          cycleKeys.add(key);
          violations.push(violation('phase-dependency-cycle', `phase dependency cycle: ${canonical.join(' -> ')}`, { phaseId: canonical[0] }));
        }
        continue;
      }
      visit(dependency);
    }
    stack.pop();
    visiting.delete(id);
    visited.add(id);
  };
  for (const phase of phases) {
    if (text(phase?.id)) visit(phase.id);
  }
  return violations;
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

function terminalGateComplete(gate, hardened) {
  if (!hardened) return COMPLETE_GATE_STATUSES.has(gate?.status);
  return gate?.status === 'met' && gate?.evidence?.passed === true;
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
    const hardened = plan.stateIntegrityHardening != null;
    const planCtx = contextFor(plan, null, null);
    for (const item of collectPhaseGraphViolations(plan)) {
      violations.push({ ...item, ...planCtx, phaseId: item.phaseId ?? '?' });
    }
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
      if (hardened && MATERIALIZED_STATUSES.has(phase?.status) && !text(initiative.parentPlan)) {
        violations.push(violation('parent-plan-missing', `initiative ${initiative.slug ?? '?'} lacks authoritative parentPlan`, joined));
      }
      if (hardened && MATERIALIZED_STATUSES.has(phase?.status) && !text(initiative.phaseId)) {
        violations.push(violation('phase-id-missing', `initiative ${initiative.slug ?? '?'} lacks authoritative phaseId`, joined));
      }
      if (text(initiative.parentPlan) && text(initiative.parentPlan) !== text(plan.slug)) {
        violations.push(violation('parent-plan-mismatch', `initiative ${initiative.slug ?? '?'} parentPlan ${JSON.stringify(initiative.parentPlan)} does not match ${plan.slug}`, joined));
      }
      if (text(initiative.phaseId) && text(initiative.phaseId) !== text(phase?.id)) {
        violations.push(violation('phase-id-mismatch', `initiative ${initiative.slug ?? '?'} phaseId ${JSON.stringify(initiative.phaseId)} does not match ${phase?.id}`, joined));
      }
      if (text(initiative.slug) !== text(phase?.slug)) {
        violations.push(violation('phase-slug-mismatch', `initiative slug ${JSON.stringify(initiative.slug)} does not match descriptor slug ${JSON.stringify(phase?.slug)}`, joined));
      }

      if (phase?.status === 'pending') {
        violations.push(violation(
          'pending-initiative-mismatch',
          `pending phase ${phase?.id ?? '?'} already has materialized initiative status ${JSON.stringify(initiative.status)}`,
          joined,
        ));
        continue;
      }

      if (MATERIALIZED_STATUSES.has(phase?.status)
          && !isTerminalStatus(phase.status)
          && isTerminalStatus(initiative.status)) {
        violations.push(violation(
          'nonterminal-status-mismatch',
          `non-terminal phase ${phase?.id ?? '?'} has terminal initiative status ${JSON.stringify(initiative.status)}`,
          joined,
        ));
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
      for (const gate of list(phase?.exitGate?.criteria).filter((item) => !terminalGateComplete(item, hardened))) {
        violations.push(violation('terminal-open-plan-gate', `terminal phase ${phase?.id ?? '?'} contains open plan criterion ${gate?.id ?? '?'}`, joined));
      }
      for (const gate of list(initiative.exitGates).filter((item) => !terminalGateComplete(item, hardened))) {
        violations.push(violation('terminal-open-initiative-gate', `terminal phase ${phase?.id ?? '?'} contains open initiative gate ${gate?.id ?? '?'}`, joined));
      }
      if (hardened) {
        const planGateIds = new Set(list(phase?.exitGate?.criteria).map((gate) => text(gate?.id)).filter(Boolean));
        const initiativeGateIds = new Set(list(initiative.exitGates).map((gate) => text(gate?.id)).filter(Boolean));
        for (const id of planGateIds) {
          if (!initiativeGateIds.has(id)) {
            violations.push(violation('terminal-gate-mirror-missing', `terminal phase ${phase?.id ?? '?'} plan criterion ${id} has no initiative mirror`, joined));
          }
        }
        for (const id of initiativeGateIds) {
          if (!planGateIds.has(id)) {
            violations.push(violation('terminal-gate-mirror-missing', `terminal phase ${phase?.id ?? '?'} initiative gate ${id} has no plan mirror`, joined));
          }
        }
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
