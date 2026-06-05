/**
 * find-missing-summaries.js — deterministic, zero-token DETECTOR of phases that
 * lack a concise `summary`.
 *
 * Phase summaries are AI-authored + user-validated (a summary is both a dev
 * memory-aid and a check that the decomposition was interpreted correctly), so
 * the TEXT cannot be produced by a script. This detector is the replicable other
 * half: it reports WHICH phases still need one, so the author→validate→write
 * backfill (see skills/core/project.md → "Phase summaries") runs the same way in
 * any repo instead of being hand-eyeballed. Mirrors compute-rollups / validate-
 * state: a pure node scan, identical on every host.
 *
 * Reports two surfaces per phase:
 *   - plan.phases[].summary  (the descriptor — read by the Home timeline)
 *   - the phase initiative's `summary` (read by the Home "Agora")
 *
 * Exit 0 = every phase has a summary; exit 1 = at least one is missing.
 *
 * CLI:  node scripts/find-missing-summaries.js [<dir>]   (defaults to ./.atomic-skills)
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { parseFrontmatter } from './validate-state.js';

/**
 * The communication language chosen at skill install — summaries (and any
 * generated content) MUST follow it, never an ad-hoc guess. Resolution order:
 * project manifest (`<repo>/.atomic-skills/manifest.json`) → user manifest
 * (`~/.atomic-skills/manifest.json`) → 'en'. Mirrors install.js's own precedence
 * (project then user manifest) so the script obeys the same config the renderer
 * bakes into skill bodies (render.js COMMUNICATION_LANGUAGE).
 */
export function configuredLanguage(dir) {
  const read = (p) => {
    try { return JSON.parse(readFileSync(p, 'utf8')).language || null; } catch { return null; }
  };
  return (
    read(join(dir, '.atomic-skills', 'manifest.json')) ||
    read(join(dir, 'manifest.json')) ||
    read(join(homedir(), '.atomic-skills', 'manifest.json')) ||
    'en'
  );
}

function fmOf(filePath) {
  try {
    const parsed = parseFrontmatter(readFileSync(filePath, 'utf8'));
    return parsed.error ? null : parsed.frontmatter;
  } catch {
    return null;
  }
}

const hasText = (v) => typeof v === 'string' && v.trim().length > 0;

/**
 * Collect { projectId, planSlug, missing: [{phaseId, where}] } across BOTH layouts
 * (matching compute-rollups.js): nested `projects/<id>/<slug>/{plan.md, phases/*.md}`
 * and flat legacy `plans/*.md` (descriptor surface) + `initiatives/*.md` (initiative
 * surface). Scanning nested-only would silently false-green an un-migrated tree.
 */
export function findMissingSummaries(dir) {
  const root = existsSync(join(dir, '.atomic-skills')) ? join(dir, '.atomic-skills') : dir;
  const report = [];

  // Nested: projects/<id>/<slug>/{plan.md, phases/*.md}
  const projectsDir = join(root, 'projects');
  if (existsSync(projectsDir) && statSync(projectsDir).isDirectory()) {
    for (const projId of readdirSync(projectsDir)) {
      const projPath = join(projectsDir, projId);
      if (!statSync(projPath).isDirectory()) continue;
      for (const planSlug of readdirSync(projPath)) {
        const planDir = join(projPath, planSlug);
        if (!statSync(planDir).isDirectory()) continue;
        const planFile = join(planDir, 'plan.md');
        if (!existsSync(planFile)) continue;
        const plan = fmOf(planFile);
        if (!plan) continue;

        // Index the materialized phase initiatives by phaseId for the second check.
        const initByPhaseId = new Map();
        const phasesDir = join(planDir, 'phases');
        if (existsSync(phasesDir) && statSync(phasesDir).isDirectory()) {
          for (const entry of readdirSync(phasesDir)) {
            if (!entry.endsWith('.md') || entry.startsWith('.')) continue;
            const init = fmOf(join(phasesDir, entry));
            if (init && init.phaseId != null) initByPhaseId.set(String(init.phaseId), init);
          }
        }

        const missing = [];
        for (const ph of Array.isArray(plan.phases) ? plan.phases : []) {
          if (!ph || typeof ph !== 'object') continue;
          const id = String(ph.id ?? '?');
          if (!hasText(ph.summary)) missing.push({ phaseId: id, where: 'descriptor' });
          const init = initByPhaseId.get(id);
          if (init && !hasText(init.summary)) missing.push({ phaseId: id, where: 'initiative' });
        }
        if (missing.length) report.push({ projectId: projId, planSlug, missing });
      }
    }
  }

  // Flat (legacy coexistence): plans/*.md descriptors + initiatives/*.md surfaces.
  const flatPlans = join(root, 'plans');
  if (existsSync(flatPlans) && statSync(flatPlans).isDirectory()) {
    for (const entry of readdirSync(flatPlans)) {
      if (!entry.endsWith('.md') || entry.startsWith('.')) continue;
      const plan = fmOf(join(flatPlans, entry));
      if (!plan) continue;
      const missing = [];
      for (const ph of Array.isArray(plan.phases) ? plan.phases : []) {
        if (!ph || typeof ph !== 'object') continue;
        if (!hasText(ph.summary)) missing.push({ phaseId: String(ph.id ?? '?'), where: 'descriptor' });
      }
      if (missing.length) report.push({ projectId: '(flat)', planSlug: entry.replace(/\.md$/, ''), missing });
    }
  }
  const flatInits = join(root, 'initiatives');
  if (existsSync(flatInits) && statSync(flatInits).isDirectory()) {
    for (const entry of readdirSync(flatInits)) {
      if (!entry.endsWith('.md') || entry.startsWith('.')) continue;
      const init = fmOf(join(flatInits, entry));
      if (!init || hasText(init.summary)) continue;
      report.push({ projectId: '(flat)', planSlug: `initiatives/${entry.replace(/\.md$/, '')}`, missing: [{ phaseId: String(init.phaseId ?? init.slug ?? entry), where: 'initiative' }] });
    }
  }

  return report;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const target = resolve(process.argv[2] || process.cwd());
  const report = findMissingSummaries(target);
  if (!report.length) {
    console.log('find-missing-summaries: every phase has a summary ✓');
    process.exit(0);
  }
  const total = report.reduce((n, r) => n + r.missing.length, 0);
  const lang = configuredLanguage(target);
  console.log(`find-missing-summaries: ${total} summary slot(s) missing across ${report.length} plan(s):`);
  for (const r of report) {
    const ids = r.missing.map((m) => `${m.phaseId}(${m.where})`).join(', ');
    console.log(`  ${r.projectId}/${r.planSlug}: ${ids}`);
  }
  console.log(`\nAuthor each summary in the install-configured language: ${lang} (NOT an ad-hoc choice).`);
  console.log('Then user-validate (skills/core/project.md → "Phase summaries") and write to the descriptor + initiative.');
  process.exit(1);
}
