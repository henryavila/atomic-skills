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
 *       --require-external  also require a real external review CLI receipt
 *                           (command=/cli=, exit=0, verdict=CLEAN|PASS|PASSED).
 *                           command/cli must name claude|codex|grok as a path
 *                           or token (`echo`, `true`, `invented` do not count).
 *                           `- internal:`, `- cross-model:`, and
 *                           `- ground-truth:` do not count. A line with the
 *                           tokens is not enough if exit≠0 or the verdict is
 *                           not a pass token. Field names must be assignments
 *                           (`(?:^|[|,]\\s*)key\\s*=`); embedded `--exit=0` or
 *                           `note=exit=0` do not count. Exactly one exit and
 *                           one verdict.
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { parseFrontmatter } from './validate-state.js';

/**
 * Parse `key=value` assignments separated by start / `|` / `,`.
 * Does not treat `note=exit=0` or `--exit=0` as an `exit` field.
 * @param {string} rest
 * @returns {Record<string, string[]>}
 */
function parseReceiptFields(rest) {
  const re = /(?:^|[|,])\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/g;
  const matches = [...String(rest).matchAll(re)];
  /** @type {Record<string, string[]>} */
  const fields = {};
  for (let i = 0; i < matches.length; i++) {
    const key = matches[i][1].toLowerCase();
    const valueStart = matches[i].index + matches[i][0].length;
    const valueEnd = i + 1 < matches.length ? matches[i + 1].index : rest.length;
    const value = String(rest).slice(valueStart, valueEnd).trim();
    if (!fields[key]) fields[key] = [];
    fields[key].push(value);
  }
  return fields;
}

/**
 * A session-written `- internal:`, `- cross-model:`, or `- ground-truth:` line
 * is not an external review CLI receipt. The CLI receipt must name a process
 * (`command=` / `cli=`) whose first path/token is `claude`, `codex`, or `grok`
 * (not `echo`/`true`/`invented`), exactly one `exit=0`, and exactly one pass
 * `verdict=` (CLEAN/PASS/PASSED). Token presence is not enough: `exit=127
 * verdict=CLEAN` and `verdict=needs_changes` fail. `note=exit=0` and `--exit=0`
 * inside the command string do not count as field assignments.
 * @param {string} line
 * @returns {boolean}
 */
const REVIEW_CLIS = new Set(['claude', 'codex', 'grok']);

/**
 * @param {string} command
 * @returns {boolean}
 */
function commandNamesReviewCli(command) {
  const trimmed = String(command).trim();
  if (!trimmed) return false;
  const first = trimmed.split(/\s+/)[0];
  if (!first) return false;
  const base = first.replace(/\\/g, '/').split('/').pop() || '';
  const name = base.replace(/\.exe$/i, '');
  return REVIEW_CLIS.has(name.toLowerCase());
}

export function isExternalCliReceiptLine(line) {
  if (typeof line !== 'string') return false;
  const match = line.match(/^\s*-\s*([^:]+)\s*:/);
  if (!match) return false;
  const label = match[1].trim();
  if (/^internal$/i.test(label)) return false;
  if (/^ground-truth$/i.test(label)) return false;
  if (/^cross-model(\s|$|\()/i.test(label)) return false;
  const rest = line.slice(match[0].length);
  const fields = parseReceiptFields(rest);
  const commands = [...(fields.command || []), ...(fields.cli || [])].filter(
    (value) => value !== '',
  );
  const exits = fields.exit || [];
  const verdicts = fields.verdict || [];
  if (commands.length < 1) return false;
  if (!commands.every(commandNamesReviewCli)) return false;
  if (exits.length !== 1 || verdicts.length !== 1) return false;
  if (!/^-?\d+$/.test(exits[0]) || Number(exits[0]) !== 0) return false;
  const verdict = verdicts[0].replace(/[.,;]+$/, '');
  return /^(CLEAN|PASS|PASSED)$/i.test(verdict);
}

/**
 * Classify a plan body's review receipt.
 * @param {string} body
 * @param {{ requireExternal?: boolean }} [options]
 * @returns {null | 'no-reviews-section' | 'no-internal-line' | 'no-external-cli-receipt'}
 *   null = receipt OK. Default: `## Reviews` with ≥1 `- internal:` line.
 *   `--require-external`: also requires a real external CLI receipt.
 */
export function reviewReceiptGap(body, options = {}) {
  if (typeof body !== 'string') return 'no-reviews-section';
  const lines = body.split(/\r?\n/);
  const headingIdx = lines.findIndex((l) => /^##\s+Reviews\s*$/i.test(l.trim()));
  if (headingIdx === -1) return 'no-reviews-section';
  // Section spans from the heading to the next H2 (`## …`) or EOF.
  let hasInternal = false;
  let hasExternalCli = false;
  for (let i = headingIdx + 1; i < lines.length; i += 1) {
    if (/^##\s+\S/.test(lines[i])) break; // next H2 ends the section
    if (/^\s*-\s*internal\s*:/i.test(lines[i])) hasInternal = true;
    if (isExternalCliReceiptLine(lines[i])) hasExternalCli = true;
  }
  if (!hasInternal) return 'no-internal-line';
  if (options.requireExternal && !hasExternalCli) return 'no-external-cli-receipt';
  return null;
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
function collectPlanFile(filePath, meta, report, options = {}) {
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
  const reason = reviewReceiptGap(body, options);
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
export function findUnreviewedPlans(target = process.cwd(), options = {}) {
  const targetPath = resolve(target);
  const report = [];

  if (existsSync(targetPath)) {
    const targetStat = statSync(targetPath);
    if (targetStat.isFile()) {
      collectPlanFile(targetPath, inferPlanMeta(targetPath), report, options);
      return report;
    }
    if (targetStat.isDirectory()) {
      const scopedPlanFile = join(targetPath, 'plan.md');
      if (existsSync(scopedPlanFile) && statSync(scopedPlanFile).isFile()) {
        collectPlanFile(scopedPlanFile, inferPlanMeta(scopedPlanFile), report, options);
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
        collectPlanFile(planFile, { projectId: projId, planSlug, planFile: 'plan.md' }, report, options);
      }
    }
  }

  // Flat (legacy coexistence): plans/*.md (archive subdir + dotfiles skipped).
  const flatDir = join(root, 'plans');
  if (existsSync(flatDir) && statSync(flatDir).isDirectory()) {
    for (const entry of readdirSync(flatDir)) {
      if (!entry.endsWith('.md') || entry.startsWith('.')) continue;
      collectPlanFile(join(flatDir, entry), { projectId: '(flat)', planSlug: 'plans', planFile: entry }, report, options);
    }
  }

  return report;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const requireExternal = args.includes('--require-external');
  const positional = args.filter((a) => a !== '--require-external' && !a.startsWith('--'));
  const target = resolve(positional[0] || process.cwd());
  const report = findUnreviewedPlans(target, { requireExternal });
  if (!report.length) {
    console.log(
      requireExternal
        ? 'find-unreviewed-plans: every plan carries an external CLI review receipt ✓'
        : 'find-unreviewed-plans: every plan carries an adversarial-review receipt ✓',
    );
    process.exit(0);
  }
  console.log(
    requireExternal
      ? `find-unreviewed-plans: ${report.length} plan(s) lack an external CLI review receipt:`
      : `find-unreviewed-plans: ${report.length} plan(s) lack an adversarial-review receipt:`,
  );
  for (const r of report) {
    const why = r.reason === 'no-reviews-section'
      ? 'no `## Reviews` section'
      : r.reason === 'no-external-cli-receipt'
        ? '`## Reviews` has no external CLI receipt (command=, exit=0, verdict=CLEAN|PASS|PASSED); `- internal:`, `- cross-model:`, and `- ground-truth:` do not count'
        : '`## Reviews` present but no `- internal:` line';
    console.log(`  ${r.projectId}/${r.planSlug}/${r.planFile}: ${why}`);
  }
  console.log('\nRun `atomic-skills:review-plan --mode=internal <plan>` (always) and, optionally, `--mode=codex`.');
  console.log('The review writes a `## Reviews` receipt (internal line mandatory) into the plan body — see project-create-plan.md Stage 8.');
  process.exit(1);
}
