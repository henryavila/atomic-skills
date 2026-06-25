/**
 * find-unreviewed-plans.js — deterministic, zero-token DETECTOR of materialized
 * plans that carry NO durable proof an adversarial review ran.
 *
 * The plan-creation flow (project-create-plan.md Stage 8) mandates an adversarial
 * review (`atomic-skills:review-plan`): internal always, codex offered. But
 * "always runs" was PROSE — the only critical creation stage without a
 * deterministic gate, unlike Stage 4/5 (lint-design / lint-source). So a plan
 * materialized in a batch or under time pressure could land in git unreviewed
 * (the receipt left no trace), and the review's job — catching contradictions,
 * broken deps, ambiguous tasks BEFORE implementation — silently dropped.
 *
 * This detector is the missing other half: the review ACTOR (review-plan) leaves
 * a machine-checkable receipt — a `## Reviews` section in the plan body carrying
 * at least one `- internal:` line (codex line optional, since codex is offered
 * not forced) — and this script reports WHICH materialized plans lack it. A
 * missing receipt is a non-zero exit, so it cannot silently survive: HARD-BLOCKS
 * at creation (Stage 8) and surfaces as a WARN in `project verify` for plans
 * already on disk.
 *
 * Sibling of find-unweighted-tasks.js / find-signalless-tasks.js. The receipt
 * TEXT is authored by the review skill; this script only proves it exists.
 *
 * Exit 0 = every selected non-archived plan carries a review receipt; exit 1 =
 * at least one is unreviewed.
 *
 * CLI:  node scripts/find-unreviewed-plans.js [<repo|.atomic-skills|plan.md|plan-dir>]
 *       (defaults to cwd)
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { parseFrontmatter } from './validate-state.js';

/**
 * Classify a plan body's review receipt.
 * @returns {null | 'no-reviews-section' | 'no-internal-line'}
 *   null = a `## Reviews` section with ≥1 `- internal:` line exists (receipt OK).
 */
export function reviewReceiptGap(body) {
  if (typeof body !== 'string') return 'no-reviews-section';
  const lines = body.split(/\r?\n/);
  const headingIdx = lines.findIndex((l) => /^##\s+Reviews\s*$/i.test(l.trim()));
  if (headingIdx === -1) return 'no-reviews-section';
  // Section spans from the heading to the next H2 (`## …`) or EOF.
  let hasInternal = false;
  for (let i = headingIdx + 1; i < lines.length; i += 1) {
    if (/^##\s+\S/.test(lines[i])) break; // next H2 ends the section
    if (/^\s*-\s*internal\s*:/i.test(lines[i])) { hasInternal = true; break; }
  }
  return hasInternal ? null : 'no-internal-line';
}

function inferPlanMeta(filePath) {
  const abs = resolve(filePath);
  const parts = abs.split(/[\\/]+/);
  const atomicIdx = parts.lastIndexOf('.atomic-skills');
  const planFile = basename(abs);

  if (atomicIdx !== -1) {
    const afterAtomic = parts.slice(atomicIdx + 1);
    if (afterAtomic[0] === 'projects' && afterAtomic[1] && afterAtomic[2] && afterAtomic[3] === 'plan.md') {
      return { projectId: afterAtomic[1], planSlug: afterAtomic[2], planFile: 'plan.md' };
    }
    if (afterAtomic[0] === 'plans' && planFile.endsWith('.md')) {
      return { projectId: '(flat)', planSlug: 'plans', planFile };
    }
  }

  return { projectId: '(scoped)', planSlug: basename(dirname(abs)), planFile };
}

/** Read a plan file; push a report entry if it lacks a review receipt. Archived plans skipped. */
function collectPlanFile(filePath, meta, report) {
  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch {
    return;
  }
  const parsed = parseFrontmatter(raw);
  const status = parsed.error ? undefined : parsed.frontmatter?.status;
  if (status === 'archived') return; // terminal — no fresh receipt required
  const body = parsed.error ? raw : parsed.body;
  const reason = reviewReceiptGap(body);
  if (reason) report.push({ ...meta, reason });
}

/**
 * Collect [{ projectId, planSlug, planFile, reason }] for materialized,
 * non-archived plans lacking an adversarial-review receipt.
 *
 * When called with a plan file or a directory containing `plan.md`, this is a
 * scoped creation gate: only that plan is checked. When called with a repo root
 * or `.atomic-skills`, this is a global verify backstop across BOTH layouts
 * (matching find-unweighted-tasks.js): nested `projects/<id>/<slug>/plan.md` and
 * flat legacy `plans/*.md`. Scanning nested-only would silently false-green an
 * un-migrated/coexistence tree. `archive/` subdirs + dotfiles skipped.
 */
export function findUnreviewedPlans(target = process.cwd()) {
  const targetPath = resolve(target);
  const report = [];

  if (existsSync(targetPath)) {
    const targetStat = statSync(targetPath);
    if (targetStat.isFile()) {
      collectPlanFile(targetPath, inferPlanMeta(targetPath), report);
      return report;
    }
    if (targetStat.isDirectory()) {
      const scopedPlanFile = join(targetPath, 'plan.md');
      if (existsSync(scopedPlanFile) && statSync(scopedPlanFile).isFile()) {
        collectPlanFile(scopedPlanFile, inferPlanMeta(scopedPlanFile), report);
        return report;
      }
    }
  }

  const root = existsSync(join(targetPath, '.atomic-skills')) ? join(targetPath, '.atomic-skills') : targetPath;

  // Nested: projects/<id>/<slug>/plan.md
  const projectsDir = join(root, 'projects');
  if (existsSync(projectsDir) && statSync(projectsDir).isDirectory()) {
    for (const projId of readdirSync(projectsDir)) {
      const projPath = join(projectsDir, projId);
      if (!statSync(projPath).isDirectory()) continue;
      for (const planSlug of readdirSync(projPath)) {
        const planDir = join(projPath, planSlug);
        if (!statSync(planDir).isDirectory()) continue;
        const planFile = join(planDir, 'plan.md');
        if (!existsSync(planFile) || !statSync(planFile).isFile()) continue;
        collectPlanFile(planFile, { projectId: projId, planSlug, planFile: 'plan.md' }, report);
      }
    }
  }

  // Flat (legacy coexistence): plans/*.md (archive subdir + dotfiles skipped).
  const flatDir = join(root, 'plans');
  if (existsSync(flatDir) && statSync(flatDir).isDirectory()) {
    for (const entry of readdirSync(flatDir)) {
      if (!entry.endsWith('.md') || entry.startsWith('.')) continue;
      collectPlanFile(join(flatDir, entry), { projectId: '(flat)', planSlug: 'plans', planFile: entry }, report);
    }
  }

  return report;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const target = resolve(process.argv[2] || process.cwd());
  const report = findUnreviewedPlans(target);
  if (!report.length) {
    console.log('find-unreviewed-plans: every plan carries an adversarial-review receipt ✓');
    process.exit(0);
  }
  console.log(`find-unreviewed-plans: ${report.length} plan(s) lack an adversarial-review receipt:`);
  for (const r of report) {
    const why = r.reason === 'no-reviews-section'
      ? 'no `## Reviews` section'
      : '`## Reviews` present but no `- internal:` line';
    console.log(`  ${r.projectId}/${r.planSlug}/${r.planFile}: ${why}`);
  }
  console.log('\nRun `atomic-skills:review-plan --mode=internal <plan>` (always) and, optionally, `--mode=codex`.');
  console.log('The review writes a `## Reviews` receipt (internal line mandatory) into the plan body — see project-create-plan.md Stage 8.');
  process.exit(1);
}
