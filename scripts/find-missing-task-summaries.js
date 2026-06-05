/**
 * find-missing-task-summaries.js — deterministic, zero-token DETECTOR of tasks
 * that lack a concise `summary`.
 *
 * A task `summary` is the one-line "what does this task do" shown on the
 * dashboard Home (Agora task table) and the Initiative-detail tasks table. Like
 * phase summaries it is AI-authored + user-validated (semantic, so a script
 * cannot produce the TEXT), and like find-missing-summaries.js this detector is
 * the replicable other half: it reports WHICH tasks still need one so the
 * author→validate→write loop (skills/core/project.md → "Task summaries") runs
 * identically in any repo instead of being hand-eyeballed. The detector is what
 * makes the skill ALWAYS generate: a missing summary is a non-zero exit, so it
 * can never silently survive a normal skill cycle.
 *
 * Sibling of find-missing-summaries.js (phases). Reuses its configuredLanguage()
 * so generated text follows the install-configured communication language.
 *
 * Exit 0 = every task has a summary; exit 1 = at least one is missing.
 *
 * CLI:  node scripts/find-missing-task-summaries.js [<dir>]   (defaults to ./.atomic-skills)
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseFrontmatter } from './validate-state.js';
import { configuredLanguage } from './find-missing-summaries.js';

// Re-export so callers have a single import for the language rule the loop obeys.
export { configuredLanguage };

function fmOf(filePath) {
  try {
    const parsed = parseFrontmatter(readFileSync(filePath, 'utf8'));
    return parsed.error ? null : parsed.frontmatter;
  } catch {
    return null;
  }
}

const hasText = (v) => typeof v === 'string' && v.trim().length > 0;

/** Parse one initiative file; push a report entry if any of its tasks lack a summary. */
function collectTaskFile(filePath, meta, report) {
  const init = fmOf(filePath);
  if (!init || !Array.isArray(init.tasks)) return;
  const missing = [];
  for (const t of init.tasks) {
    if (!t || typeof t !== 'object') continue;
    if (!hasText(t.summary)) missing.push({ taskId: String(t.id ?? '?'), title: String(t.title ?? '') });
  }
  if (missing.length) report.push({ ...meta, missing });
}

/**
 * Collect [{ projectId, planSlug, phaseFile, missing: [{taskId, title}] }] for
 * every initiative whose tasks[] lack a summary, across BOTH layouts (matching
 * compute-rollups.js): nested `projects/<id>/<slug>/phases/*.md` and flat legacy
 * `initiatives/*.md`. Scanning nested-only would silently false-green an
 * un-migrated/coexistence tree (aiDeck reads flat files in place too). `.`/archive
 * skipped in both.
 */
export function findMissingTaskSummaries(dir) {
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
  const report = findMissingTaskSummaries(target);
  if (!report.length) {
    console.log('find-missing-task-summaries: every task has a summary ✓');
    process.exit(0);
  }
  const total = report.reduce((n, r) => n + r.missing.length, 0);
  const lang = configuredLanguage(target);
  console.log(`find-missing-task-summaries: ${total} task summary slot(s) missing across ${report.length} initiative(s):`);
  for (const r of report) {
    const ids = r.missing.map((m) => m.taskId).join(', ');
    console.log(`  ${r.projectId}/${r.planSlug}/${r.phaseFile}: ${ids}`);
  }
  console.log(`\nAuthor each task summary in the install-configured language: ${lang} (NOT an ad-hoc choice).`);
  console.log('Then user-validate (skills/core/project.md → "Task summaries") and write each onto its tasks[].summary.');
  process.exit(1);
}
