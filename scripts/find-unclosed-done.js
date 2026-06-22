/**
 * find-unclosed-done.js — deterministic, zero-token DETECTOR of DONE tasks
 * that carry NO `closedAt` timestamp.
 *
 * This reports the live instrumentation gap for task closure timestamps: done
 * tasks that still closed without `closedAt`. Archived / legacy phases are
 * excluded by the same non-recursive `phases/*.md` scan used by sibling
 * detectors; `phases/archive/` is a directory, not a `.md` entry.
 *
 * Only DONE tasks are reported. Open tasks are irrelevant here.
 *
 * Exit 0 = every done task has closedAt; exit 1 = at least one does not.
 *
 * CLI:  node scripts/find-unclosed-done.js [<dir>]   (defaults to process.cwd())
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

const hasText = (v) => typeof v === 'string' && v.trim().length > 0;

/** statSync().isDirectory() that never throws — a dangling symlink / unreadable
 *  entry degrades to "not a dir" instead of crashing the scan. */
function isDir(p) {
  try { return statSync(p).isDirectory(); } catch { return false; }
}

function hasClosedAt(task) {
  return hasText(task.closedAt);
}

/** Push a report entry for every DONE task in `filePath` that lacks closedAt. */
function collectTaskFile(filePath, meta, report) {
  const init = fmOf(filePath);
  if (!init || !Array.isArray(init.tasks)) return;
  const offenders = [];
  for (const t of init.tasks) {
    if (!t || typeof t !== 'object') continue;
    if (t.status !== 'done') continue;
    if (hasClosedAt(t)) continue;
    offenders.push({ taskId: String(t.id ?? '?'), title: String(t.title ?? '') });
  }
  if (offenders.length) report.push({ ...meta, offenders });
}

/**
 * Collect [{ projectId, planSlug, phaseFile, offenders: [{taskId, title}] }]
 * across BOTH layouts (matching find-signalless-tasks.js).
 */
export function findUnclosedDone(dir) {
  const root = existsSync(join(dir, '.atomic-skills')) ? join(dir, '.atomic-skills') : dir;
  const report = [];

  const projectsDir = join(root, 'projects');
  if (isDir(projectsDir)) {
    for (const projId of readdirSync(projectsDir)) {
      const projPath = join(projectsDir, projId);
      if (!isDir(projPath)) continue;
      for (const planSlug of readdirSync(projPath)) {
        const planDir = join(projPath, planSlug);
        if (!isDir(planDir)) continue;
        const phasesDir = join(planDir, 'phases');
        if (!isDir(phasesDir)) continue;
        for (const entry of readdirSync(phasesDir)) {
          if (!entry.endsWith('.md') || entry.startsWith('.')) continue;
          collectTaskFile(join(phasesDir, entry), { projectId: projId, planSlug, phaseFile: entry }, report);
        }
      }
    }
  }

  const flatDir = join(root, 'initiatives');
  if (isDir(flatDir)) {
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
  const report = findUnclosedDone(target);
  if (!report.length) {
    console.log('find-unclosed-done: every done task has closedAt ✓');
    process.exit(0);
  }
  const total = report.reduce((n, r) => n + r.offenders.length, 0);
  console.log(`find-unclosed-done: ${total} done task(s) with NO closedAt across ${report.length} initiative(s):`);
  for (const r of report) {
    const ids = r.offenders.map((o) => o.taskId).join(', ');
    console.log(`  ${r.projectId}/${r.planSlug}/${r.phaseFile}: ${ids}`);
  }
  console.log('\nSet `closedAt` when closing tasks so live completions carry deterministic closure instrumentation.');
  process.exit(1);
}
