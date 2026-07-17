/**
 * Portable path classification for `.atomic-skills/` state files.
 *
 * Uses path.dirname / path.basename / path.sep rather than hard-coded '/' splits
 * so Windows (path.win32) and POSIX (path.posix) produce the same kind and
 * projectId for equivalent trees.
 */
import nodePath from 'node:path';

/**
 * Split a path into non-empty segments using the given path API's separator.
 * @param {string} filePath
 * @param {typeof nodePath} [pathApi]
 * @returns {string[]}
 */
export function pathSegments(filePath, pathApi = nodePath) {
  const resolved = pathApi.resolve(filePath);
  const sep = pathApi.sep;
  // path.win32.resolve keeps the drive letter as the first segment after split
  // (e.g. "C:\\foo" → ["C:", "foo"]). Filter empties only.
  return resolved.split(sep).filter((s) => s.length > 0);
}

/**
 * Infer schema kind ('plan' | 'initiative' | 'lesson') from a file path.
 * Returns null if the path is not under a recognised directory.
 *
 * Two layouts are recognised (R-XAGENT-08 / F-B3):
 *  - FLAT (legacy, live during the dogfood window):
 *      <root>/plans/<slug>.md            → 'plan'
 *      <root>/initiatives/<slug>.md      → 'initiative'
 *  - NESTED (projects/<id>/<slug>/, the migration target):
 *      <root>/projects/<id>/<slug>/plan.md           → 'plan'
 *      <root>/projects/<id>/<slug>/phases/f<N>-*.md  → 'initiative'
 *      <root>/projects/<id>/<slug>/lessons/<slug>.md → 'lesson'
 *
 * The flat checks run FIRST and the loop returns at the segment closest to the
 * file, so adding the nested checks cannot change any flat-tree result.
 *
 * @param {string} filePath
 * @param {typeof nodePath} [pathApi]
 * @returns {'plan'|'initiative'|'lesson'|null}
 */
export function kindFromPath(filePath, pathApi = nodePath) {
  const parts = pathSegments(filePath, pathApi);
  const base = pathApi.basename(filePath);

  // NESTED layout plan FIRST: `plan.md` directly under a projects/<id>/<slug>/
  // tree. Checked before the segment scan so a slug literally named `phases`,
  // `plans`, or `initiatives` (the slug regex permits them) cannot shadow a real
  // plan.md — e.g. projects/<id>/phases/plan.md is a plan, not an initiative.
  if (base === 'plan.md' && parts.includes('projects')) {
    return 'plan';
  }
  // Walk from the end: the immediate parent dir tells us the kind.
  // tests/fixtures/state/plans/<slug>.md → 'plan'
  // .atomic-skills/initiatives/<slug>.md → 'initiative'
  for (let i = parts.length - 2; i >= 0; i--) {
    if (parts[i] === 'plans') return 'plan';
    if (parts[i] === 'initiatives') return 'initiative';
    // NESTED layout: a `phases/` ancestor marks a phase initiative. Checked
    // LAST in the loop body so a flat path with a `plans`/`initiatives`
    // segment is unaffected (it short-circuits above).
    if (parts[i] === 'phases') return 'initiative';
    // Spec 2 / G1: a `lessons/` ancestor marks a per-initiative lessons file
    // (projects/<id>/<slug>/lessons/<initiative-slug>.md).
    if (parts[i] === 'lessons') return 'lesson';
  }
  return null;
}

/**
 * Extract the nested projectId from a path under `projects/<id>/…`.
 * Returns `'__legacy'` when the path is not nested under `projects/`.
 *
 * @param {string} filePath
 * @param {typeof nodePath} [pathApi]
 * @returns {string}
 */
export function projectIdFromPath(filePath, pathApi = nodePath) {
  const parts = pathSegments(filePath, pathApi);
  const idx = parts.lastIndexOf('projects');
  if (idx >= 0 && typeof parts[idx + 1] === 'string' && parts[idx + 1].length > 0) {
    return parts[idx + 1];
  }
  return '__legacy';
}

/**
 * Kind inference for normalize.js (slightly coarser — no lesson branch).
 * Mirrors the historical normalizeFile logic while remaining path-API portable.
 *
 * @param {string} filePath
 * @param {typeof nodePath} [pathApi]
 * @returns {'plan'|'initiative'|undefined}
 */
export function normalizeKindFromPath(filePath, pathApi = nodePath) {
  const parts = pathSegments(filePath, pathApi);
  const baseName = pathApi.basename(filePath);
  if (parts.includes('plans')) return 'plan';
  if (parts.includes('initiatives')) return 'initiative';
  if (parts.includes('phases')) return 'initiative';
  if (baseName === 'plan.md' && parts.includes('projects')) return 'plan';
  return undefined;
}

/**
 * Nested projectId + planSlug from a path under projects/<id>/<slug>/….
 * @param {string} filePath
 * @param {typeof nodePath} [pathApi]
 * @returns {{ projectId: string, planSlug: string } | null}
 */
export function nestedIdsFromPath(filePath, pathApi = nodePath) {
  const parts = pathSegments(filePath, pathApi);
  const projectsIdx = parts.lastIndexOf('projects');
  if (projectsIdx < 0 || !parts[projectsIdx + 1] || !parts[projectsIdx + 2]) return null;
  return { projectId: parts[projectsIdx + 1], planSlug: parts[projectsIdx + 2] };
}
