/**
 * implement-scope.js — pure SPEC→implement path admission (F3/T-001).
 *
 * Contract:
 *   - tasks[].outputs[].path are the exact implementation targets
 *   - tasks[].scopeBoundary[] are DO-NOT exclusions (never an allowlist)
 *   - the invalid `Files` property is never required or admitted
 *
 * No I/O. Callers pass already-parsed task objects.
 */

function text(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : '';
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Exact target paths declared on a task via outputs[].path.
 * @param {object} task
 * @returns {string[]}
 */
export function targetPathsFromTask(task) {
  const outputs = array(task?.outputs);
  const paths = [];
  for (const out of outputs) {
    const p = text(out?.path);
    if (p) paths.push(p);
  }
  return paths;
}

/**
 * Normalize a path for membership checks (posix-ish, no leading ./).
 * @param {string} p
 * @returns {string}
 */
export function normalizeRepoPath(p) {
  const t = text(p);
  if (!t) return '';
  return t.replace(/^\.\//, '').replace(/\\/g, '/');
}

/**
 * True when `candidate` is the same path as `target` or a file under a
 * directory target (prefix match with a path segment boundary).
 * @param {string} candidate
 * @param {string} target
 */
export function pathMatchesTarget(candidate, target) {
  const c = normalizeRepoPath(candidate);
  const t = normalizeRepoPath(target);
  if (!c || !t) return false;
  if (c === t) return true;
  // Directory-style target: "src/foo" admits "src/foo/bar.js"
  if (c.startsWith(`${t}/`)) return true;
  return false;
}

/**
 * Extract path-like tokens from a free-form scopeBoundary exclusion string.
 * Exclusions are prose ("do not touch the consumer src directory") but often
 * embed concrete paths; any normalized path token that matches is blocked.
 * @param {string} exclusion
 * @returns {string[]}
 */
export function pathTokensFromExclusion(exclusion) {
  const raw = text(exclusion);
  if (!raw) return [];
  // Match repo-relative path tokens: word chars, slashes, dots, dashes, underscores
  const matches = raw.match(/(?:\.\/)?(?:[\w.-]+\/)+[\w.-]+|[\w.-]+\.(?:js|ts|mjs|cjs|json|md|yml|yaml|sh)/g) || [];
  return matches.map(normalizeRepoPath).filter(Boolean);
}

/**
 * True when candidate violates any scopeBoundary exclusion.
 * Blocks when:
 *   - a path token inside the exclusion matches the candidate, OR
 *   - the full exclusion string equals the candidate path (edge case).
 * @param {string} candidate
 * @param {string[]} scopeBoundary
 */
export function pathViolatesScopeBoundary(candidate, scopeBoundary) {
  const c = normalizeRepoPath(candidate);
  if (!c) return false;
  for (const exclusion of array(scopeBoundary)) {
    if (normalizeRepoPath(exclusion) === c) return true;
    for (const token of pathTokensFromExclusion(exclusion)) {
      if (pathMatchesTarget(c, token) || pathMatchesTarget(token, c)) return true;
    }
  }
  return false;
}

/**
 * Classify a candidate path against a SPEC-admitted task.
 *
 * @param {object} task
 * @param {string} candidatePath
 * @returns {{
 *   admitted: boolean,
 *   code: 'admitted'|'not-a-target'|'scope-boundary-exclusion'|'invalid-files-property'|'missing-outputs',
 *   reason: string,
 * }}
 */
export function classifyImplementPath(task, candidatePath) {
  if (task != null && Object.hasOwn(task, 'Files') && task.Files != null) {
    return {
      admitted: false,
      code: 'invalid-files-property',
      reason: 'Task carries invalid `Files` property; use outputs[].path as targets',
    };
  }

  const targets = targetPathsFromTask(task);
  if (targets.length === 0) {
    return {
      admitted: false,
      code: 'missing-outputs',
      reason: 'Task has no outputs[].path targets',
    };
  }

  const candidate = normalizeRepoPath(candidatePath);
  if (!candidate) {
    return {
      admitted: false,
      code: 'not-a-target',
      reason: 'Empty candidate path',
    };
  }

  if (pathViolatesScopeBoundary(candidate, task?.scopeBoundary)) {
    return {
      admitted: false,
      code: 'scope-boundary-exclusion',
      reason: `Path '${candidate}' is listed as a scopeBoundary exclusion (DO-NOT)`,
    };
  }

  const hitsTarget = targets.some((t) => pathMatchesTarget(candidate, t));
  if (!hitsTarget) {
    return {
      admitted: false,
      code: 'not-a-target',
      reason: `Path '${candidate}' is not among outputs[].path targets: ${targets.join(', ')}`,
    };
  }

  return {
    admitted: true,
    code: 'admitted',
    reason: `Path '${candidate}' is an admitted outputs[].path target`,
  };
}

/**
 * Assert a task is implement-ready under the F3 contract (no Files; has
 * outputs, scopeBoundary, acceptance, verifier).
 *
 * @param {object} task
 * @returns {{ ok: boolean, violations: string[] }}
 */
export function assertImplementReadyTask(task) {
  const violations = [];
  if (task == null || typeof task !== 'object') {
    return { ok: false, violations: ['task is missing'] };
  }
  if (Object.hasOwn(task, 'Files')) {
    violations.push('invalid property `Files` — use outputs[].path');
  }
  const targets = targetPathsFromTask(task);
  if (targets.length === 0) {
    violations.push('missing outputs[].path targets');
  }
  if (array(task.scopeBoundary).length === 0) {
    violations.push('missing scopeBoundary[] exclusions (DO-NOT)');
  }
  if (array(task.acceptance).length === 0) {
    violations.push('missing acceptance[]');
  }
  const v = task.verifier;
  const hasVerifier =
    (typeof v === 'string' && v.trim() !== '') ||
    (v != null && typeof v === 'object' && Object.keys(v).length > 0);
  if (!hasVerifier) {
    violations.push('missing deterministic verifier');
  }
  return { ok: violations.length === 0, violations };
}
