#!/usr/bin/env node
/**
 * Canonical projectId resolution for dashboard registration.
 *
 * In the nested layout the folder under `.atomic-skills/projects/<id>/` is the
 * project id. The cwd basename is only a fallback for flat/legacy trees —
 * important in plan worktrees whose directory is named after the plan while
 * the real project folder remains e.g. `atomic-skills`.
 *
 * CLI:  node scripts/resolve-project-id.js [rootDir]
 *       prints the projectId on stdout.
 *
 * JSON payload helper (safe for roots with quotes/spaces):
 *       node scripts/resolve-project-id.js --register-json [rootDir]
 *       prints JSON.stringify({ rootDir, projectId }) with no shell interp.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Derive a projectId slug from a directory path, matching the algorithm in
 * aideck's ProjectRegistry: lowercase basename, replace invalid chars with
 * hyphens, strip leading digits/hyphens, truncate to 64 chars.
 * @param {string} rootDir
 * @returns {string}
 */
export function deriveProjectId(rootDir) {
  let id = basename(rootDir)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^[^a-z]+/, '')
    .slice(0, 64);
  return id || 'project';
}

/**
 * Enumerate the projects present on disk under the nested layout
 * `<stateRoot>/projects/<projectId>/<planSlug>/plan.md`.
 *
 * @param {string} [stateRoot]
 * @returns {Array<{ projectId: string, plans: string[] }>}
 */
export function listProjects(stateRoot = '.atomic-skills') {
  const projectsDir = join(stateRoot, 'projects');
  if (!existsSync(projectsDir) || !statSync(projectsDir).isDirectory()) return [];
  const out = [];
  for (const projectId of readdirSync(projectsDir).sort()) {
    const projPath = join(projectsDir, projectId);
    if (!statSync(projPath).isDirectory()) continue;
    const plans = [];
    for (const slug of readdirSync(projPath).sort()) {
      const planPath = join(projPath, slug);
      if (statSync(planPath).isDirectory() && existsSync(join(planPath, 'plan.md'))) {
        plans.push(slug);
      }
    }
    out.push({ projectId, plans });
  }
  return out;
}

/**
 * Resolve the project id atomic-skills should register with aiDeck.
 * Prefer the single nested project folder when unambiguous.
 * @param {string} rootDir
 * @returns {string}
 */
export function resolveRegisteredProjectId(rootDir) {
  const projects = listProjects(join(rootDir, '.atomic-skills'));
  if (projects.length === 1) return projects[0].projectId;
  return deriveProjectId(rootDir);
}

/**
 * Build the JSON body for POST /api/projects/register without shell
 * interpolation (roots with quotes/spaces stay valid JSON).
 * @param {string} rootDir
 * @param {string} [projectId]
 * @returns {string}
 */
export function buildRegisterPayload(rootDir, projectId) {
  const abs = resolve(rootDir);
  const id = projectId ?? resolveRegisteredProjectId(abs);
  return JSON.stringify({ rootDir: abs, projectId: id });
}

function isMain() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(resolve(entry)).href;
  } catch {
    return false;
  }
}

if (isMain()) {
  const args = process.argv.slice(2);
  const asJson = args[0] === '--register-json';
  const root = resolve(asJson ? (args[1] || process.cwd()) : (args[0] || process.cwd()));
  if (asJson) {
    process.stdout.write(`${buildRegisterPayload(root)}\n`);
  } else {
    process.stdout.write(`${resolveRegisteredProjectId(root)}\n`);
  }
}
