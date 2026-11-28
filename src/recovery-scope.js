/**
 * Dual-scope routing for incomplete transaction recovery.
 *
 * Split out of `recovery-cli.js`: resolving which scope (user or project) a
 * repair/force command targets is pure inspection plus message building; the
 * mutating actions live in the CLI module.
 */
import { homedir } from 'node:os';
import {
  describeRecovery,
  TX_STATE_INCOMPLETE,
} from '@henryavila/minimalist-installer';
import { MANIFEST_DIR } from './manifest.js';
import { resolveProjectScopeTarget } from './scope.js';

function collectIncompleteScopes(userBase, projectBase, userDesc, projectDesc) {
  /** @type {Array<{scope: string, basePath: string, desc: object}>} */
  const incomplete = [];
  if (userDesc.state === TX_STATE_INCOMPLETE) {
    incomplete.push({ scope: 'user', basePath: userBase, desc: userDesc });
  }
  if (projectDesc && projectDesc.state === TX_STATE_INCOMPLETE) {
    incomplete.push({ scope: 'project', basePath: projectBase, desc: projectDesc });
  }
  return incomplete;
}

function scopeErrorResult(projectTarget, incomplete) {
  return {
    ok: false,
    exitCode: 1,
    action: 'scope-error',
    message: projectTarget.reason || 'Project scope is not available.',
    incomplete,
  };
}

function explicitProjectScopeResult(projectBase, incomplete, userDesc, projectDesc) {
  return {
    ok: true,
    scope: 'project',
    basePath: projectBase,
    explicit: true,
    incomplete,
    userDesc,
    projectDesc,
  };
}

function singleIncompleteScopeResult(incomplete, userDesc, projectDesc) {
  return {
    ok: true,
    scope: incomplete[0].scope,
    basePath: incomplete[0].basePath,
    incomplete,
    userDesc,
    projectDesc,
  };
}

function ambiguousIncompleteScopeResult(userBase, projectBase, incomplete, userDesc, projectDesc) {
  return {
    ok: false,
    exitCode: 1,
    action: 'ambiguous-incomplete',
    ambiguous: true,
    incomplete,
    userDesc,
    projectDesc,
    message: [
      'Incomplete installer transactions found in both user and project scopes.',
      `  user:    ${userBase}`,
      `  project: ${projectBase}`,
      'Re-run with --project to target the project scope.',
      'To target the user scope, clear the project incomplete first (or run',
      'from a directory outside that project after fixing project).',
      'Do not hand-edit .atomic-skills/manifest.json.',
    ].join('\n'),
  };
}

function noIncompleteScopeResult(userBase, incomplete, userDesc, projectDesc, purpose) {
  // None incomplete — still allow explicit routing callers to inspect bases.
  const noneMessage = purpose === 'force-incomplete'
    ? 'No incomplete installer transaction found in user or project scope.'
    : 'No incomplete installer transaction found in user or project scope — nothing to repair.';

  return {
    ok: false,
    exitCode: 0,
    action: 'none-incomplete',
    none: true,
    incomplete,
    userDesc,
    projectDesc,
    // Prefer user base for noop messaging when nothing incomplete.
    basePath: userBase,
    scope: 'user',
    message: noneMessage,
  };
}

/**
 * Scan candidate scopes (user + project if resolvable) for incomplete TXs.
 *
 * Routing rules (P0-A):
 * - exactly one incomplete → use it
 * - both incomplete → require --project or error with ambiguity
 * - none incomplete → clear message
 * - explicit --project → always target project (even if complete/absent)
 *
 * @param {object} opts
 * @param {string} [opts.projectDir] - cwd used to resolve project git root
 * @param {boolean} [opts.forceProject] - --project flag
 * @param {'repair'|'force-incomplete'} [opts.purpose]
 * @returns {object}
 */
export function resolveIncompleteRecoveryScope(opts = {}) {
  const { projectDir = process.cwd(), forceProject = false, purpose = 'repair' } = opts;
  const userBase = homedir();
  const projectTarget = resolveProjectScopeTarget(projectDir);
  const projectBase = projectTarget.ok ? projectTarget.path : null;

  // Tolerant inspect (describeRecovery) — never JSON.parse-throw on corrupt manifests.
  const userDesc = describeRecovery(userBase, MANIFEST_DIR);
  const projectDesc = projectBase ? describeRecovery(projectBase, MANIFEST_DIR) : null;
  const incomplete = collectIncompleteScopes(userBase, projectBase, userDesc, projectDesc);

  if (forceProject) {
    return projectBase
      ? explicitProjectScopeResult(projectBase, incomplete, userDesc, projectDesc)
      : scopeErrorResult(projectTarget, incomplete);
  }

  if (incomplete.length === 1) {
    return singleIncompleteScopeResult(incomplete, userDesc, projectDesc);
  }

  if (incomplete.length > 1) {
    return ambiguousIncompleteScopeResult(userBase, projectBase, incomplete, userDesc, projectDesc);
  }

  return noIncompleteScopeResult(userBase, incomplete, userDesc, projectDesc, purpose);
}
