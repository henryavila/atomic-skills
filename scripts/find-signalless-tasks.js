/**
 * find-signalless-tasks.js — deterministic, zero-token DETECTOR of OPEN tasks
 * that carry NO completion signal: neither a `verifier:` nor at least one
 * `outputs[].path`.
 *
 * Spec 1, Component E (signal-at-creation). detect-completion.js can only see
 * tasks that carry a deterministic close-signal; a task with neither a verifier
 * NOR a declared output is genuinely undetectable ("done in code, open in state"
 * forever). This detector makes that blind spot AUDITABLE for backfill — the
 * same replicable pattern as find-missing-summaries.js / find-missing-task-
 * summaries.js: a non-zero exit lists the offenders so the signal-at-creation
 * nudge (project-create-plan.md Stage 6, new-task/promote) and periodic backfill
 * drive the signal-less population toward zero over a project's life.
 *
 * Only OPEN tasks are reported (`pending`/`active`/`blocked`). A `done` task is
 * already closed — its missing signal no longer matters. Both layouts are
 * scanned (nested `projects/<id>/<slug>/phases/*.md` + flat `initiatives/*.md`),
 * matching its sibling detectors; scanning nested-only would false-green an
 * un-migrated tree.
 *
 * Exit 0 = every open task carries a signal; exit 1 = at least one does not.
 *
 * CLI:  node scripts/find-signalless-tasks.js [<dir>]   (defaults to ./.atomic-skills)
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseFrontmatter } from './validate-state.js';

const OPEN_TASK = new Set(['pending', 'active', 'blocked']);

function fmOf(filePath) {
  try {
    const parsed = parseFrontmatter(readFileSync(filePath, 'utf8'));
    return parsed.error ? null : parsed.frontmatter;
  } catch {
    return null;
  }
}

const hasText = (v) => typeof v === 'string' && v.trim().length > 0;

/** A task carries a completion signal iff it has a non-empty `verifier` OR at
 *  least one `outputs[]` entry with a non-empty `path`. */
function hasSignal(task) {
  if (task.verifier && typeof task.verifier === 'object') return true;
  if (Array.isArray(task.outputs) && task.outputs.some((o) => o && typeof o === 'object' && hasText(o.path))) return true;
  return false;
}

/** Push a report entry for every OPEN task in `filePath` that lacks a signal. */
function collectTaskFile(filePath, meta, report) {
  const init = fmOf(filePath);
  if (!init || !Array.isArray(init.tasks)) return;
  const offenders = [];
  for (const t of init.tasks) {
    if (!t || typeof t !== 'object') continue;
    if (!OPEN_TASK.has(t.status)) continue;
    if (hasSignal(t)) continue;
    offenders.push({ taskId: String(t.id ?? '?'), title: String(t.title ?? '') });
  }
  if (offenders.length) report.push({ ...meta, offenders });
}

/**
 * Collect [{ projectId, planSlug, phaseFile, offenders: [{taskId, title}] }]
 * across BOTH layouts (matching find-missing-task-summaries.js).
 */
export function findSignallessTasks(dir) {
  const root = existsSync(join(dir, '.atomic-skills')) ? join(dir, '.atomic-skills') : dir;
  const report = [];

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
  const report = findSignallessTasks(target);
  if (!report.length) {
    console.log('find-signalless-tasks: every open task carries a completion signal ✓');
    process.exit(0);
  }
  const total = report.reduce((n, r) => n + r.offenders.length, 0);
  console.log(`find-signalless-tasks: ${total} open task(s) with NO completion signal (no verifier, no outputs.path) across ${report.length} initiative(s):`);
  for (const r of report) {
    const ids = r.offenders.map((o) => o.taskId).join(', ');
    console.log(`  ${r.projectId}/${r.planSlug}/${r.phaseFile}: ${ids}`);
  }
  console.log('\nAdd a `verifier:` or at least one `outputs[].path` so each can be auto-detected as done (scripts/detect-completion.js).');
  process.exit(1);
}
