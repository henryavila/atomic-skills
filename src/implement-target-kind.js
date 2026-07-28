/**
 * implement-target-kind.js — classify implement arg as atomic-plan vs foreign-plan.
 *
 * Order is load-bearing:
 *   1. Strip mode flags (caller may pass residual planArg already)
 *   2. If arg looks like a filesystem path AND the file exists:
 *        - under .atomic-skills/projects/<id>/<slug>/plan.md → atomic-plan (path form)
 *        - otherwise → foreign-plan (entry gate: AskUserQuestion promote|foreign)
 *   3. Else treat as inventory slug / project/slug (atomic-plan selection)
 *
 * I/O is injected (exists, resolvePath) so unit tests stay pure.
 */

import { basename, extname, isAbsolute, join, normalize, resolve, sep } from 'node:path';

function text(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : '';
}

/**
 * Mode / clear tokens that must not be mistaken for a plan path or slug.
 * Mirrors src/implement-mode.js recognition (keep in sync).
 * @param {string} token
 * @returns {boolean}
 */
export function isImplementModeToken(token) {
  const t = String(token);
  if (t === '--clear-execution-mode' || t === 'clear-execution-mode') return true;
  if (/^--mode=/i.test(t)) return true;
  if (t === '--mode' || t === '-m') return true;
  if (/^mode:/i.test(t)) return true;
  return false;
}

/**
 * Split argv-like input into mode-related tokens vs residual plan arg tokens.
 * Pure — does not validate mode values (use parseImplementMode for that).
 *
 * @param {string | string[] | null | undefined} argvLike
 * @returns {{ tokens: string[], planTokens: string[], planArg: string | null }}
 */
export function splitImplementPlanArg(argvLike) {
  /** @type {string[]} */
  let tokens;
  if (argvLike == null || argvLike === '') {
    tokens = [];
  } else if (typeof argvLike === 'string') {
    tokens = argvLike.trim() === '' ? [] : argvLike.trim().split(/\s+/);
  } else if (Array.isArray(argvLike)) {
    tokens = argvLike.map((t) => String(t));
  } else {
    tokens = [];
  }

  /** @type {string[]} */
  const planTokens = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '--clear-execution-mode' || t === 'clear-execution-mode') continue;
    if (/^--mode=/i.test(t)) continue;
    if (/^mode:/i.test(t)) continue;
    if (t === '--mode' || t === '-m') {
      // skip value token when present
      const next = tokens[i + 1];
      if (next != null && !next.startsWith('-')) i += 1;
      continue;
    }
    planTokens.push(t);
  }

  const planArg = planTokens.length === 0 ? null : planTokens.join(' ');
  return { tokens, planTokens, planArg };
}

/**
 * Heuristic: does the residual arg look like a filesystem path rather than a slug?
 * Slugs are bare kebab tokens without extension (e.g. `my-feature`).
 *
 * @param {string | null | undefined} arg
 * @returns {boolean}
 */
export function looksLikeFilePath(arg) {
  const raw = text(arg);
  if (!raw) return false;
  if (raw.includes('://')) return false;
  if (raw.startsWith('.') || raw.startsWith('~') || raw.startsWith('/')) return true;
  if (raw.includes('/') || raw.includes('\\')) return true;
  if (/\.md$/i.test(raw)) return true;
  return false;
}

/**
 * True when path is a nested Atomic Skills plan.md under projects/.
 * Accepts absolute or repo-relative forms.
 *
 * @param {string} filePath
 * @returns {boolean}
 */
export function isAtomicSkillsPlanFilePath(filePath) {
  const p = normalize(String(filePath || '')).replace(/\\/g, '/');
  // .../.atomic-skills/projects/<project-id>/<slug>/plan.md
  return /(?:^|\/)\.atomic-skills\/projects\/[^/]+\/[^/]+\/plan\.md$/i.test(p);
}

/**
 * Sidecar path colocated with the source markdown.
 * `docs/cutover.md` → `docs/cutover.implement.yaml`
 *
 * @param {string} sourceMdPath
 * @returns {string}
 */
export function workOrderSidecarPath(sourceMdPath) {
  const raw = String(sourceMdPath || '');
  if (/\.md$/i.test(raw)) {
    return raw.replace(/\.md$/i, '.implement.yaml');
  }
  return `${raw}.implement.yaml`;
}

/**
 * Derive a stable slug from a source markdown path (basename without .md).
 * @param {string} sourceMdPath
 * @returns {string}
 */
export function slugFromSourcePath(sourceMdPath) {
  const base = basename(String(sourceMdPath || 'plan'));
  const noExt = base.replace(/\.md$/i, '');
  const slug = noExt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug || 'foreign-plan';
}

/**
 * Classify the implement target after mode flags are stripped.
 *
 * @param {object} input
 * @param {string | null | undefined} input.arg - residual plan arg (path or slug)
 * @param {(p: string) => boolean} [input.exists] - fs.existsSync inject (default: always false)
 * @param {(p: string) => string} [input.resolvePath] - path resolve inject
 * @param {string} [input.cwd]
 * @returns {{
 *   kind: 'foreign-plan' | 'atomic-plan' | 'atomic-plan-path' | 'missing-arg' | 'path-not-found',
 *   planArg: string | null,
 *   sourcePath: string | null,
 *   resolvedPath: string | null,
 *   sidecarPath: string | null,
 *   slug: string | null,
 *   entryChoiceRequired: boolean,
 *   reason: string,
 * }}
 */
export function classifyImplementTarget(input = {}) {
  const arg = text(input.arg);
  const exists = typeof input.exists === 'function' ? input.exists : () => false;
  const cwd = text(input.cwd) || process.cwd();
  const resolvePath =
    typeof input.resolvePath === 'function'
      ? input.resolvePath
      : (p) => (isAbsolute(p) ? normalize(p) : resolve(cwd, p));

  if (!arg) {
    return {
      kind: 'missing-arg',
      planArg: null,
      sourcePath: null,
      resolvedPath: null,
      sidecarPath: null,
      slug: null,
      entryChoiceRequired: false,
      reason: 'No plan arg after stripping mode flags',
    };
  }

  if (looksLikeFilePath(arg)) {
    const resolved = resolvePath(arg);
    const hit = exists(arg) || exists(resolved);
    const definitePath =
      hit ||
      /\.md$/i.test(arg) ||
      arg.startsWith('.') ||
      arg.startsWith('~') ||
      arg.startsWith('/') ||
      arg.startsWith('\\');

    if (hit) {
      const sourcePath = exists(arg) ? arg : resolved;
      const resolvedPath = exists(resolved) ? resolved : resolvePath(sourcePath);

      if (isAtomicSkillsPlanFilePath(sourcePath) || isAtomicSkillsPlanFilePath(resolvedPath)) {
        return {
          kind: 'atomic-plan-path',
          planArg: arg,
          sourcePath,
          resolvedPath,
          sidecarPath: null,
          slug: slugFromSourcePath(sourcePath),
          entryChoiceRequired: false,
          reason: 'Path is an Atomic Skills plan.md under .atomic-skills/projects/',
        };
      }

      return {
        kind: 'foreign-plan',
        planArg: arg,
        sourcePath,
        resolvedPath,
        sidecarPath: workOrderSidecarPath(sourcePath),
        slug: slugFromSourcePath(sourcePath),
        entryChoiceRequired: true,
        reason:
          'Markdown file outside Atomic Skills inventory — AskUserQuestion: Promote to AS or Implement as Foreign',
      };
    }

    if (definitePath) {
      return {
        kind: 'path-not-found',
        planArg: arg,
        sourcePath: arg,
        resolvedPath: resolved,
        sidecarPath: workOrderSidecarPath(arg),
        slug: slugFromSourcePath(arg),
        entryChoiceRequired: false,
        reason: `Path does not exist: ${arg}`,
      };
    }

    // e.g. `atomic-skills/plan-b` — slash but not a real file → inventory form
  }

  // Bare slug or project/slug — inventory selection (existing Flow A)
  return {
    kind: 'atomic-plan',
    planArg: arg,
    sourcePath: null,
    resolvedPath: null,
    sidecarPath: null,
    slug: arg.includes('/') ? arg.split('/').filter(Boolean).pop() : arg,
    entryChoiceRequired: false,
    reason: 'Inventory slug / project-id/plan-slug',
  };
}

/**
 * Convenience: classify from full implement argv (mode flags + plan arg).
 * @param {string | string[] | null | undefined} argvLike
 * @param {object} [opts] - passed to classifyImplementTarget (exists, cwd, …)
 */
export function classifyImplementArgv(argvLike, opts = {}) {
  const { planArg } = splitImplementPlanArg(argvLike);
  return classifyImplementTarget({ ...opts, arg: planArg });
}

/**
 * Entry-choice constants for AskUserQuestion (start of implement only).
 */
export const FOREIGN_ENTRY_CHOICES = Object.freeze({
  PROMOTE: 'promote',
  FOREIGN: 'foreign',
});

/**
 * @param {string | null | undefined} choice
 * @returns {'promote' | 'foreign' | null}
 */
export function normalizeForeignEntryChoice(choice) {
  const c = text(choice).toLowerCase();
  if (!c) return null;
  if (
    c === 'promote' ||
    c === 'adopt' ||
    c === 'promote-to-as' ||
    c === 'as' ||
    c === 'atomic' ||
    c === 'atomic-skills'
  ) {
    return FOREIGN_ENTRY_CHOICES.PROMOTE;
  }
  if (
    c === 'foreign' ||
    c === 'implement-as-foreign' ||
    c === 'foreign-plan' ||
    c === 'sidecar'
  ) {
    return FOREIGN_ENTRY_CHOICES.FOREIGN;
  }
  return null;
}

/**
 * Suggested worktree path for a foreign (or promoted) plan slug.
 * @param {string} slug
 * @param {string} [repoRoot]
 * @returns {string}
 */
export function foreignWorktreePath(slug, repoRoot = '.') {
  return join(repoRoot, '.worktrees', slugFromSourcePath(slug));
}

/**
 * Bookkeeping branch for foreign plan (same policy as AS plans).
 * @param {string} slug
 * @returns {string}
 */
export function foreignPlanBranch(slug) {
  const s = slugFromSourcePath(slug);
  return `plan/${s}`;
}

// re-export path helpers used by tests without pulling node path elsewhere
export { basename, extname, join, sep };
