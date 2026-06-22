/**
 * bind-plan-branch.js — bind an active plan to a git branch (worktree home).
 *
 * The easy resolution for an "unclaimed branch" (emit-focus.js → `flags.unclaimedBranch`):
 * you are on a branch that no active plan claims, so the statusline shows no focus.
 * Stamp this plan's `branch:` to the branch and the focus resolves to it per-worktree.
 *
 * Surgical frontmatter edit (no YAML writer dependency): replaces the `branch:`
 * line in the plan's frontmatter, or inserts one right after `status:` when absent,
 * bumps `lastUpdated:`, then re-emits `focus.json`.
 *
 * CLI:  node scripts/bind-plan-branch.js <plan-slug> [<branch>] [<dir>]
 *       branch defaults to the current git branch; dir defaults to ./
 */
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, resolve, dirname, basename } from 'node:path';
import { emitFocus } from './emit-focus.js';

/** Resolve { stateRoot, repoRoot } from a dir (mirrors emit-focus.js). */
function resolveRoots(dir) {
  const abs = resolve(dir);
  if (basename(abs) === '.atomic-skills') return { stateRoot: abs, repoRoot: dirname(abs) };
  return { stateRoot: join(abs, '.atomic-skills'), repoRoot: abs };
}

function currentBranch(repoRoot) {
  try {
    const out = execSync('git symbolic-ref --short HEAD', {
      cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim();
    return out && out !== 'HEAD' ? out : null;
  } catch {
    return null;
  }
}

/** Find `projects/<id>/<slug>/plan.md` for the given slug, or null. */
function findPlanFile(stateRoot, slug) {
  const projectsDir = join(stateRoot, 'projects');
  if (!existsSync(projectsDir) || !statSync(projectsDir).isDirectory()) return null;
  for (const projId of readdirSync(projectsDir)) {
    const planFile = join(projectsDir, projId, slug, 'plan.md');
    if (existsSync(planFile)) return planFile;
  }
  return null;
}

/**
 * Stamp `branch:` (and bump `lastUpdated:`) inside the first frontmatter block.
 * Returns the rewritten file content. Throws if no frontmatter block is found.
 */
export function stampBranch(raw, branch, now) {
  const lines = raw.split('\n');
  if (lines[0] !== '---') throw new Error('plan.md has no frontmatter (first line is not `---`)');
  let end = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === '---') { end = i; break; }
  }
  if (end === -1) throw new Error('plan.md frontmatter is not terminated by `---`');

  const branchLine = `branch: ${branch}`;
  let branchDone = false;
  let lastUpdatedDone = false;
  let statusIdx = -1;
  for (let i = 1; i < end; i += 1) {
    if (/^branch:/.test(lines[i])) { lines[i] = branchLine; branchDone = true; }
    else if (/^lastUpdated:/.test(lines[i])) { lines[i] = `lastUpdated: ${now}`; lastUpdatedDone = true; }
    else if (/^status:/.test(lines[i]) && statusIdx === -1) { statusIdx = i; }
  }
  // Insert missing fields right after `status:` (or at the top of the block).
  const insertAt = statusIdx !== -1 ? statusIdx + 1 : 1;
  const inserts = [];
  if (!branchDone) inserts.push(branchLine);
  if (!lastUpdatedDone) inserts.push(`lastUpdated: ${now}`);
  if (inserts.length) lines.splice(insertAt, 0, ...inserts);
  return lines.join('\n');
}

/** Bind `slug`'s plan.md to `branch`; re-emit focus. Returns { planFile, branch, digest }. */
export function bindPlanBranch(dir, slug, branch, now = new Date().toISOString()) {
  if (!slug) throw new Error('bind-plan-branch: <plan-slug> is required');
  const { stateRoot, repoRoot } = resolveRoots(dir);
  const resolvedBranch = branch || currentBranch(repoRoot);
  if (!resolvedBranch) throw new Error('bind-plan-branch: no branch given and HEAD is detached / not a repo');
  const planFile = findPlanFile(stateRoot, slug);
  if (!planFile) throw new Error(`bind-plan-branch: no plan.md found for slug \`${slug}\``);
  const rewritten = stampBranch(readFileSync(planFile, 'utf8'), resolvedBranch, now);
  writeFileSync(planFile, rewritten);
  const { digest } = emitFocus(dir);
  return { planFile, branch: resolvedBranch, digest };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const slug = process.argv[2];
  const branch = process.argv[3] && !process.argv[3].startsWith('/') ? process.argv[3] : undefined;
  const dir = process.argv[4] || process.cwd();
  try {
    const res = bindPlanBranch(dir, slug, branch);
    console.log(`bind-plan-branch: ${slug} → branch \`${res.branch}\`  (focus → ${res.digest.plan ? res.digest.plan.slug : 'still no claimer'})`);
  } catch (err) {
    console.error(`bind-plan-branch: ${err.message}`);
    process.exit(1);
  }
}
