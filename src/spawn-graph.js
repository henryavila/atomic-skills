/**
 * Pure cycle-detection over the fork parent/child graph (no I/O, no mutation).
 *
 * The graph is a directed adjacency of parent→child spawn edges:
 *   { "<parent-slug>": ["<child-slug>", ...], ... }
 * Forking is intra-project, so a single adjacency over plan slugs suffices.
 * The F1 `fork-plan` verb builds the adjacency from the sidecars (`links.json`)
 * and calls `wouldCreateCycle` BEFORE ratifying — this module never reads files.
 */

/**
 * Build a parent→child adjacency from a list of plans carrying `spawnedPlans`
 * (`{ phaseId: [childSlug, ...] }`). Children are flattened across phases and
 * de-duplicated. Pure.
 * @param {Array<{slug?: string, spawnedPlans?: Record<string, string[]>}>} plans
 * @returns {Record<string, string[]>}
 */
export function buildAdjacency(plans) {
  const adjacency = {};
  for (const plan of plans ?? []) {
    if (!plan || typeof plan.slug !== 'string') continue;
    const children = new Set(adjacency[plan.slug] ?? []);
    const spawnedPlans = plan.spawnedPlans ?? {};
    for (const phaseId of Object.keys(spawnedPlans)) {
      for (const child of spawnedPlans[phaseId] ?? []) children.add(child);
    }
    adjacency[plan.slug] = [...children];
  }
  return adjacency;
}

/**
 * Can `start` reach `target` by following ≥1 directed edges? Iterative DFS with
 * a visited set, so it terminates even on a cyclic graph. Pure.
 * @param {Record<string, string[]>} adjacency
 * @param {string} start
 * @param {string} target
 * @returns {boolean}
 */
export function reachable(adjacency, start, target) {
  const seen = new Set();
  const stack = [...(adjacency[start] ?? [])];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === target) return true;
    if (seen.has(node)) continue;
    seen.add(node);
    stack.push(...(adjacency[node] ?? []));
  }
  return false;
}

/**
 * Would adding the edge `parent`→`child` introduce a cycle? True when the fork
 * points at an ancestor — i.e. `child` can already reach `parent` — or is a
 * self-fork. Pure.
 * @param {Record<string, string[]>} adjacency
 * @param {string} parent
 * @param {string} child
 * @returns {boolean}
 */
export function wouldCreateCycle(adjacency, parent, child) {
  if (parent === child) return true;
  return reachable(adjacency, child, parent);
}

/**
 * Does the directed graph already contain a cycle (incl. self-loops)?
 * Three-colour DFS. Pure.
 * @param {Record<string, string[]>} adjacency
 * @returns {boolean}
 */
export function hasCycle(adjacency) {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = {};

  const nodes = new Set(Object.keys(adjacency));
  for (const from of Object.keys(adjacency)) {
    for (const to of adjacency[from] ?? []) nodes.add(to);
  }

  function visit(node) {
    color[node] = GRAY;
    for (const next of adjacency[node] ?? []) {
      if (color[next] === GRAY) return true;
      if ((color[next] ?? WHITE) === WHITE && visit(next)) return true;
    }
    color[node] = BLACK;
    return false;
  }

  for (const node of nodes) {
    if ((color[node] ?? WHITE) === WHITE && visit(node)) return true;
  }
  return false;
}
