import { execFileSync } from 'node:child_process';
import { accessSync, constants, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { parse } from 'node:path';

/**
 * @typedef {{ ok: true, path: string } | { ok: false, reason: string }} ScopeResult
 */

function runGit(cwd, args) {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

/**
 * Realpath where a missing path returns null (the expected failure), and every
 * other I/O failure surfaces instead of silently skipping a directory guard.
 * @param {string} path
 * @returns {string | null}
 */
function realpathOrNull(path) {
  try {
    return realpathSync(path);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    return null;
  }
}

/**
 * @param {string} projectDir
 * @returns {{ ok: true, cwd: string } | { ok: false, reason: string }}
 */
function existingDirectory(projectDir) {
  let cwd;
  try {
    cwd = realpathSync(projectDir);
  } catch {
    return { ok: false, reason: `Project scope target does not exist: ${projectDir}` };
  }

  try {
    if (!statSync(cwd).isDirectory()) {
      return { ok: false, reason: `Project scope target is not a directory: ${cwd}` };
    }
  } catch {
    return { ok: false, reason: `Project scope target is not accessible: ${cwd}` };
  }

  return { ok: true, cwd };
}

/**
 * Git worktree guards before resolving the repository root.
 *
 * @param {string} cwd
 * @returns {string | null} the refusal message, or null when the tree is usable
 */
function workTreeRefusal(cwd) {
  let isInsideWorkTree;
  try {
    isInsideWorkTree = runGit(cwd, ['rev-parse', '--is-inside-work-tree']);
  } catch {
    return 'Current directory is not inside a Git repository.';
  }

  if (isInsideWorkTree !== 'true') {
    return 'Current directory is not inside a Git worktree.';
  }

  let isBare = 'false';
  try {
    isBare = runGit(cwd, ['rev-parse', '--is-bare-repository']);
  } catch {
    // Best-effort probe: --is-inside-work-tree already succeeded, so an
    // unreadable bare flag safely means "not bare" for this guard.
  }

  if (isBare === 'true') {
    return 'Project scope is not supported in a bare Git repository.';
  }

  return null;
}

/**
 * @param {string} cwd
 * @returns {{ ok: true, root: string } | { ok: false, reason: string }}
 */
function repositoryRoot(cwd) {
  try {
    return { ok: true, root: realpathSync(runGit(cwd, ['rev-parse', '--show-toplevel'])) };
  } catch {
    return { ok: false, reason: 'Could not resolve the Git repository root.' };
  }
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function samePath(a, b) {
  if (a === b) return true;
  return process.platform === 'win32' && a.toLowerCase() === b.toLowerCase();
}

/**
 * @param {string} root
 * @returns {boolean}
 */
function isFilesystemRoot(root) {
  return samePath(root, parse(root).root);
}

/**
 * @param {string} root
 * @returns {boolean}
 */
function isHomeDirectory(root) {
  const homeRoot = realpathOrNull(homedir());
  return Boolean(homeRoot && samePath(root, homeRoot));
}

/**
 * @param {string} root
 * @returns {boolean}
 */
function isWritable(root) {
  try {
    accessSync(root, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} projectDir
 * @returns {ScopeResult}
 */
export function resolveProjectScopeTarget(projectDir) {
  const target = existingDirectory(projectDir);
  if (!target.ok) return target;

  const workTreeReason = workTreeRefusal(target.cwd);
  if (workTreeReason) return { ok: false, reason: workTreeReason };

  const repo = repositoryRoot(target.cwd);
  if (!repo.ok) return repo;

  const { root } = repo;
  if (isFilesystemRoot(root)) {
    return { ok: false, reason: 'Refusing to install project scope at the filesystem root.' };
  }

  if (isHomeDirectory(root)) {
    return { ok: false, reason: 'Refusing to install project scope at your home directory.' };
  }

  if (!isWritable(root)) {
    return { ok: false, reason: `Git repository root is not writable: ${root}` };
  }

  return { ok: true, path: root };
}
