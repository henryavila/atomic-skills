import { execFileSync } from 'node:child_process';
import { accessSync, constants, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { parse } from 'node:path';

function runGit(cwd, args) {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

export function resolveProjectScopeTarget(projectDir) {
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

  let isInsideWorkTree;
  try {
    isInsideWorkTree = runGit(cwd, ['rev-parse', '--is-inside-work-tree']);
  } catch {
    return { ok: false, reason: 'Current directory is not inside a Git repository.' };
  }

  if (isInsideWorkTree !== 'true') {
    return { ok: false, reason: 'Current directory is not inside a Git worktree.' };
  }

  let isBare = 'false';
  try {
    isBare = runGit(cwd, ['rev-parse', '--is-bare-repository']);
  } catch {}

  if (isBare === 'true') {
    return { ok: false, reason: 'Project scope is not supported in a bare Git repository.' };
  }

  let root;
  try {
    root = realpathSync(runGit(cwd, ['rev-parse', '--show-toplevel']));
  } catch {
    return { ok: false, reason: 'Could not resolve the Git repository root.' };
  }

  if (root === parse(root).root) {
    return { ok: false, reason: 'Refusing to install project scope at the filesystem root.' };
  }

  let homeRoot = null;
  try {
    homeRoot = realpathSync(homedir());
  } catch {}

  if (homeRoot && root === homeRoot) {
    return { ok: false, reason: 'Refusing to install project scope at your home directory.' };
  }

  try {
    accessSync(root, constants.W_OK);
  } catch {
    return { ok: false, reason: `Git repository root is not writable: ${root}` };
  }

  return { ok: true, path: root };
}
