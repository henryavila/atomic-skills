/**
 * Plan-tree product-source fence (Layer B / F2).
 *
 * Pure predicates only — inject path lists from git at the CLI boundary.
 * Under durable automate, refuse done when plan-branch product paths changed
 * outside claim-report path coverage.
 *
 * State allowlist: paths under `.atomic-skills/` never trip the product fence.
 * No git inside this module. No chat waiver.
 */

/**
 * Normalize a path for set comparison (posix-ish, strip leading ./).
 * @param {string} p
 * @returns {string}
 */
export function normalizeFencePath(p) {
  let s = String(p ?? '').trim().replace(/\\/g, '/');
  if (s.startsWith('./')) s = s.slice(2);
  while (s.startsWith('/')) s = s.slice(1);
  return s;
}

/**
 * Whether a path is durable Atomic Skills state (allowlisted — never product).
 * @param {string} path
 * @returns {boolean}
 */
export function isStatePath(path) {
  const p = normalizeFencePath(path);
  if (!p) return false;
  return (
    p === '.atomic-skills' ||
    p.startsWith('.atomic-skills/') ||
    p === 'atomic-skills' || // rare alternate
    false
  );
}

/**
 * Whether a path is classified as product/source for fence purposes.
 * Default v1: anything not under `.atomic-skills/` is product.
 *
 * @param {string} path
 * @returns {boolean}
 */
export function isProductPath(path) {
  const p = normalizeFencePath(path);
  if (!p) return false;
  if (isStatePath(p)) return false;
  return true;
}

/**
 * Filter a path list to product paths only.
 * @param {Iterable<string> | null | undefined} paths
 * @returns {string[]}
 */
export function productPathsFrom(paths) {
  if (paths == null) return [];
  const out = [];
  const seen = new Set();
  for (const raw of paths) {
    const p = normalizeFencePath(raw);
    if (!p || !isProductPath(p)) continue;
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

/**
 * Collect all paths[] from claim report tasks (open + closed).
 * @param {unknown} claimReport
 * @returns {string[]}
 */
export function claimPathsFromReport(claimReport) {
  if (claimReport == null) return [];
  let tasks = [];
  if (Array.isArray(claimReport)) {
    tasks = claimReport;
  } else if (typeof claimReport === 'object') {
    const obj = /** @type {Record<string, unknown>} */ (claimReport);
    if (Array.isArray(obj.tasks)) tasks = obj.tasks;
    else if (Array.isArray(obj.claims)) tasks = obj.claims;
  }
  const out = [];
  for (const t of tasks) {
    if (t == null || typeof t !== 'object') continue;
    const paths = /** @type {{ paths?: unknown }} */ (t).paths;
    if (!Array.isArray(paths)) continue;
    for (const p of paths) {
      const n = normalizeFencePath(p);
      if (n) out.push(n);
    }
  }
  return out;
}

/**
 * Plan-tree product fence: every product path in the plan-branch diff must be
 * covered by at least one claim path (set intersection / membership).
 *
 * Empty product diff → ok.
 * State paths in the diff are ignored.
 *
 * @param {{
 *   planBranchDiffPaths?: Iterable<string> | null,
 *   claimPaths?: Iterable<string> | null,
 *   claimReport?: unknown,
 * }} input
 * @returns {{ ok: boolean, reason?: string, uncovered?: string[], productDiff?: string[] }}
 */
export function planTreeProductFenceOk(input = {}) {
  const diffRaw = input.planBranchDiffPaths;
  const productDiff = productPathsFrom(diffRaw);

  if (productDiff.length === 0) {
    return { ok: true, productDiff: [] };
  }

  /** @type {Set<string>} */
  const claimSet = new Set();
  if (input.claimPaths != null) {
    for (const p of productPathsFrom(input.claimPaths)) {
      claimSet.add(p);
    }
    // also accept non-product claim paths as coverage? No — only product paths
    // need coverage; claim may list product paths only.
    for (const p of input.claimPaths) {
      const n = normalizeFencePath(p);
      if (n) claimSet.add(n);
    }
  }
  if (input.claimReport != null) {
    for (const p of claimPathsFromReport(input.claimReport)) {
      claimSet.add(p);
    }
  }

  const uncovered = productDiff.filter((p) => !claimSet.has(p));
  if (uncovered.length > 0) {
    return {
      ok: false,
      reason: `plan-tree product fence: product path(s) on plan branch not covered by claim paths: ${uncovered.join(', ')}`,
      uncovered,
      productDiff,
    };
  }
  return { ok: true, productDiff };
}
