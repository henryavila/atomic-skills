const BLOCKING_STATUSES = new Set(['active', 'paused', 'pending']);
const RELEASED_STATUSES = new Set(['done']);
const DEFAULT_ARCHIVED_RELEASE = 'blocked';

const isObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);
const hasSlug = (plan) => isObject(plan) && typeof plan.slug === 'string' && plan.slug.length > 0;
const planStatus = (plan) => (typeof plan?.status === 'string' ? plan.status : 'pending');

function emptyIndex(plans) {
  const out = {};
  for (const plan of plans) out[plan.slug] = [];
  return out;
}

function normalizeRelease(dep) {
  return { archived: dep?.release?.archived ?? DEFAULT_ARCHIVED_RELEASE };
}

function normalizeDependency(plan, dep) {
  return {
    dependent: plan.slug,
    prerequisite: dep.plan,
    createdBy: dep.createdBy,
    ...(dep.origin ? { origin: { ...dep.origin } } : {}),
    release: normalizeRelease(dep),
  };
}

function normalizeOriginEdge(plan) {
  const from = plan.spawnedFrom;
  if (!isObject(from) || typeof from.plan !== 'string') return null;
  return {
    child: plan.slug,
    parent: from.plan,
    phaseId: from.phaseId,
    ...(from.taskId ? { taskId: from.taskId } : {}),
    mode: from.mode,
  };
}

/**
 * Return true when a dependency edge blocks the dependent plan under the
 * prerequisite's current lifecycle status. Pure.
 *
 * @param {{release?: {archived?: string}}} edge
 * @param {{status?: string}|undefined} prerequisitePlan
 * @returns {boolean}
 */
export function dependencyBlocks(edge, prerequisitePlan) {
  if (!prerequisitePlan) return true;
  const status = planStatus(prerequisitePlan);
  if (RELEASED_STATUSES.has(status)) return false;
  if (status === 'archived') {
    return (edge?.release?.archived ?? DEFAULT_ARCHIVED_RELEASE) !== 'resolved';
  }
  return BLOCKING_STATUSES.has(status) || !RELEASED_STATUSES.has(status);
}

function findDependencyCycle(edges, planBySlug) {
  const adjacency = new Map();
  for (const slug of planBySlug.keys()) adjacency.set(slug, []);
  for (const edge of edges) {
    if (edge.dependent === edge.prerequisite) continue;
    if (!planBySlug.has(edge.dependent) || !planBySlug.has(edge.prerequisite)) continue;
    adjacency.get(edge.dependent).push(edge.prerequisite);
  }

  const visiting = new Set();
  const visited = new Set();
  const path = [];

  function visit(node) {
    if (visiting.has(node)) {
      const start = path.indexOf(node);
      return [...path.slice(start), node];
    }
    if (visited.has(node)) return null;

    visiting.add(node);
    path.push(node);
    for (const next of adjacency.get(node) ?? []) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    path.pop();
    visiting.delete(node);
    visited.add(node);
    return null;
  }

  for (const node of adjacency.keys()) {
    const cycle = visit(node);
    if (cycle) return cycle;
  }
  return null;
}

function executionOrder(plans, edges, planBySlug) {
  const indegree = new Map(plans.map((plan) => [plan.slug, 0]));
  const dependents = new Map(plans.map((plan) => [plan.slug, []]));

  for (const edge of edges) {
    if (!planBySlug.has(edge.dependent) || !planBySlug.has(edge.prerequisite)) continue;
    if (edge.dependent === edge.prerequisite) continue;
    indegree.set(edge.dependent, (indegree.get(edge.dependent) ?? 0) + 1);
    dependents.get(edge.prerequisite).push(edge.dependent);
  }

  const ready = plans.filter((plan) => indegree.get(plan.slug) === 0).map((plan) => plan.slug);
  const out = [];
  while (ready.length > 0) {
    const slug = ready.shift();
    out.push(slug);
    for (const dependent of dependents.get(slug) ?? []) {
      indegree.set(dependent, indegree.get(dependent) - 1);
      if (indegree.get(dependent) === 0) ready.push(dependent);
    }
  }

  if (out.length === plans.length) return out;
  const emitted = new Set(out);
  return [...out, ...plans.map((plan) => plan.slug).filter((slug) => !emitted.has(slug))];
}

/**
 * Build the canonical execution graph for plan-to-plan dependencies. The
 * persisted direction is dependent -> prerequisite (`dependsOnPlans[]` lives on
 * the blocked plan); inverse `unblocksPlans` is derived here.
 *
 * @param {Array<object>} plans
 * @returns {{
 *   plans: Array<object>,
 *   planBySlug: Map<string, object>,
 *   dependencyEdges: Array<object>,
 *   originEdges: Array<object>,
 *   blockedByPlans: Record<string, string[]>,
 *   unblocksPlans: Record<string, string[]>,
 *   readyPlans: string[],
 *   blockedPlans: string[],
 *   completedPlans: string[],
 *   executionOrder: string[],
 *   errors: Array<object>
 * }}
 */
export function buildPlanDependencyGraph(plans = []) {
  const planList = (plans ?? []).filter(hasSlug);
  const planBySlug = new Map();
  const errors = [];

  for (const plan of planList) {
    if (planBySlug.has(plan.slug)) {
      errors.push({
        code: 'duplicate-plan',
        plan: plan.slug,
        message: `duplicate plan slug: ${plan.slug}`,
      });
    }
    planBySlug.set(plan.slug, plan);
  }

  const dependencyEdges = [];
  const originEdges = [];
  for (const plan of planList) {
    const origin = normalizeOriginEdge(plan);
    if (origin) originEdges.push(origin);

    for (const dep of Array.isArray(plan.dependsOnPlans) ? plan.dependsOnPlans : []) {
      if (!isObject(dep) || typeof dep.plan !== 'string') continue;
      const edge = normalizeDependency(plan, dep);
      dependencyEdges.push(edge);

      if (edge.dependent === edge.prerequisite) {
        errors.push({
          code: 'self-dependency',
          plan: edge.dependent,
          prerequisite: edge.prerequisite,
          message: `plan ${edge.dependent} cannot depend on itself`,
        });
      } else if (!planBySlug.has(edge.prerequisite)) {
        errors.push({
          code: 'unknown-prerequisite',
          plan: edge.dependent,
          prerequisite: edge.prerequisite,
          message: `plan ${edge.dependent} depends on unknown plan ${edge.prerequisite}`,
        });
      }
    }
  }

  const cycle = findDependencyCycle(dependencyEdges, planBySlug);
  if (cycle) {
    errors.push({
      code: 'dependency-cycle',
      cycle,
      message: `plan dependency cycle: ${cycle.join(' -> ')}`,
    });
  }

  const blockedByPlans = emptyIndex(planList);
  const unblocksPlans = emptyIndex(planList);
  for (const edge of dependencyEdges) {
    const prerequisite = planBySlug.get(edge.prerequisite);
    if (prerequisite) {
      unblocksPlans[edge.prerequisite].push(edge.dependent);
    }
    if (dependencyBlocks(edge, prerequisite)) {
      blockedByPlans[edge.dependent].push(edge.prerequisite);
    }
  }

  const blockedPlans = planList
    .filter((plan) => blockedByPlans[plan.slug]?.length > 0)
    .map((plan) => plan.slug);
  const readyPlans = planList
    .filter((plan) => !blockedPlans.includes(plan.slug))
    .filter((plan) => !['done', 'archived'].includes(planStatus(plan)))
    .map((plan) => plan.slug);
  const completedPlans = planList
    .filter((plan) => planStatus(plan) === 'done')
    .map((plan) => plan.slug);

  return {
    plans: planList,
    planBySlug,
    dependencyEdges,
    originEdges,
    blockedByPlans,
    unblocksPlans,
    readyPlans,
    blockedPlans,
    completedPlans,
    executionOrder: executionOrder(planList, dependencyEdges, planBySlug),
    errors,
  };
}

/**
 * Return only validation errors for callers that gate state transitions before
 * rendering or mutation.
 *
 * @param {Array<object>} plans
 * @returns {Array<object>}
 */
export function validatePlanDependencyGraph(plans = []) {
  return buildPlanDependencyGraph(plans).errors;
}
