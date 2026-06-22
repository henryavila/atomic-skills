/**
 * find-unweighted-tasks.js — deterministic, zero-token DETECTOR of tasks
 * that lack a numeric `weight`.
 *
 * A task `weight` is the complexity proxy used by project planning and review
 * flows. It is AI-authored + user-validated from structural signals (number of
 * acceptance items, Files, scopeBoundary, verifier kind), so a script cannot
 * assign the NUMBER itself. Like find-missing-task-summaries.js this detector is
 * the replicable other half: it reports WHICH tasks still need one so the
 * author→validate→write loop (project-create-plan.md Stage 6 → "Task weight")
 * runs identically in any repo instead of being hand-eyeballed. The detector is
 * what makes the skill ALWAYS generate: a missing/non-numeric weight is a
 * non-zero exit, so it can never silently survive a normal skill cycle.
 *
 * Sibling of find-missing-task-summaries.js. Weight is numeric, not prose, so
 * there is no configured-language rule to report.
 *
 * Exit 0 = every task has a numeric weight; exit 1 = at least one is missing.
 *
 * CLI:  node scripts/find-unweighted-tasks.js [<dir>]   (defaults to ./.atomic-skills)
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseFrontmatter } from './validate-state.js';

function fmOf(filePath) {
  try {
    const parsed = parseFrontmatter(readFileSync(filePath, 'utf8'));
    return parsed.error ? null : parsed.frontmatter;
  } catch {
    return null;
  }
}

/** Parse one initiative file; push a report entry if any of its tasks lack a numeric weight. */
function collectTaskFile(filePath, meta, report) {
  const init = fmOf(filePath);
  if (!init || !Array.isArray(init.tasks)) return;
  const missing = [];
  for (const t of init.tasks) {
    if (!t || typeof t !== 'object') continue;
    if (typeof t.weight !== 'number') missing.push({ taskId: String(t.id ?? '?'), title: String(t.title ?? '') });
  }
  if (missing.length) report.push({ ...meta, missing });
}

/**
 * Collect [{ projectId, planSlug, phaseFile, missing: [{taskId, title}] }] for
 * every initiative whose tasks[] lack a numeric weight, across BOTH layouts
 * (matching compute-rollups.js): nested `projects/<id>/<slug>/phases/*.md` and
 * flat legacy `initiatives/*.md`. Scanning nested-only would silently false-green
 * an un-migrated/coexistence tree (aiDeck reads flat files in place too).
 * `.`/archive skipped in both.
 */
export function findUnweightedTasks(dir) {
  const root = existsSync(join(dir, '.atomic-skills')) ? join(dir, '.atomic-skills') : dir;
  const report = [];

  // Nested: projects/<id>/<slug>/phases/*.md
  const projectsDir = join(root, 'projects');
  if (existsSync(projectsDir) && statSync(projectsDir).isDirectory()) {
    for (const projId of readdirSync(projectsDir)) {
      const projPath = join(projectsDir, projId);
      if (!statSync(projPath).isDirectory()) continue;
      for (const planSlug of readdirSync(projPath)) {
        const planDir = join(projPath, planSlug);
        if (!statSync(planDir).isDirectory()) continue;
        const phasesDir = join(planDir, 'phases');
        if (!existsSync(phasesDir) || !statSync(phasesDir).isDirectory()) continue;
        for (const entry of readdirSync(phasesDir)) {
          if (!entry.endsWith('.md') || entry.startsWith('.')) continue;
          collectTaskFile(join(phasesDir, entry), { projectId: projId, planSlug, phaseFile: entry }, report);
        }
      }
    }
  }

  // Flat (legacy coexistence): initiatives/*.md (archive subdir + dotfiles skipped).
  const flatDir = join(root, 'initiatives');
  if (existsSync(flatDir) && statSync(flatDir).isDirectory()) {
    for (const entry of readdirSync(flatDir)) {
      if (!entry.endsWith('.md') || entry.startsWith('.')) continue;
      collectTaskFile(join(flatDir, entry), { projectId: '(flat)', planSlug: 'initiatives', phaseFile: entry }, report);
    }
  }

  return report;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const target = resolve(process.argv[2] || process.cwd());
  const report = findUnweightedTasks(target);
  if (!report.length) {
    console.log('find-unweighted-tasks: every task has a weight ✓');
    process.exit(0);
  }
  const total = report.reduce((n, r) => n + r.missing.length, 0);
  console.log(`find-unweighted-tasks: ${total} task weight slot(s) missing across ${report.length} initiative(s):`);
  for (const r of report) {
    const ids = r.missing.map((m) => m.taskId).join(', ');
    console.log(`  ${r.projectId}/${r.planSlug}/${r.phaseFile}: ${ids}`);
  }
  console.log('\nAuthor each task weight as a number ≥ 0 from structural signals (# of acceptance, Files, scopeBoundary, verifier kind) per Stage 6 of project-create-plan.md.');
  console.log('Then write each onto its tasks[].weight.');
  process.exit(1);
}
