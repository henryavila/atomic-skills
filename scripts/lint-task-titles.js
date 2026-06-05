/**
 * lint-task-titles.js — deterministic, zero-token detector of LEVEL-CONFUSED
 * task titles in materialized state (a task titled like a phase, e.g. "Phase A —
 * …"). The hierarchy is Plan → Phase → Task; a task masquerading as a phase lies
 * about its level and confuses the dashboard.
 *
 * Two enforcement surfaces share one rule (`levelConfusedTaskTitle` in
 * lint-source.js): the SPEC gate (`lintSpec`) blocks it at DECOMPOSE time on the
 * source `### Tn` headings (future plans); this script is the MATERIALIZED-state
 * scan for already-written `tasks[]` (find the existing offenders to fix).
 *
 * Exit 0 = no level-confused task titles; exit 1 = at least one.
 *
 * CLI:  node scripts/lint-task-titles.js [<dir>]   (defaults to ./.atomic-skills)
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseFrontmatter } from './validate-state.js';
import { levelConfusedTaskTitle } from './lint-source.js';

function initiativeFiles(root) {
  const out = [];
  const collectMd = (base) => {
    if (!existsSync(base) || !statSync(base).isDirectory()) return;
    for (const e of readdirSync(base)) if (e.endsWith('.md') && !e.startsWith('.')) out.push(join(base, e));
  };
  // Flat legacy + nested.
  collectMd(join(root, 'initiatives'));
  const projectsDir = join(root, 'projects');
  if (existsSync(projectsDir) && statSync(projectsDir).isDirectory()) {
    for (const projId of readdirSync(projectsDir)) {
      const projPath = join(projectsDir, projId);
      if (!statSync(projPath).isDirectory()) continue;
      for (const planSlug of readdirSync(projPath)) {
        const planPath = join(projPath, planSlug);
        if (!statSync(planPath).isDirectory()) continue;
        collectMd(join(planPath, 'phases'));
      }
    }
  }
  return out;
}

/** Collect every level-confused task title across materialized initiatives. */
export function findLevelConfusedTitles(dir) {
  const root = existsSync(join(dir, '.atomic-skills')) ? join(dir, '.atomic-skills') : dir;
  const hits = [];
  for (const filePath of initiativeFiles(root)) {
    let fm;
    try {
      const parsed = parseFrontmatter(readFileSync(filePath, 'utf8'));
      if (parsed.error) continue;
      fm = parsed.frontmatter;
    } catch {
      continue;
    }
    for (const t of Array.isArray(fm.tasks) ? fm.tasks : []) {
      if (t && levelConfusedTaskTitle(t.title)) {
        hits.push({ filePath, slug: fm.slug, taskId: t.id, title: t.title });
      }
    }
  }
  return hits;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const target = resolve(process.argv[2] || process.cwd());
  const hits = findLevelConfusedTitles(target);
  if (!hits.length) {
    console.log('lint-task-titles: no level-confused task titles ✓');
    process.exit(0);
  }
  console.log(`lint-task-titles: ${hits.length} task title(s) masquerade as a phase:`);
  for (const h of hits) console.log(`  ${h.slug} ${h.taskId}: "${h.title}"`);
  console.log('\nA task is not a phase — rename each, dropping the "Phase/Fase <X> —" prefix (keep the descriptive part).');
  process.exit(1);
}
