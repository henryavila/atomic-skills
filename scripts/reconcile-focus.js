/**
 * reconcile-focus.js — cross-file plan↔initiative status hygiene + the dashboard
 * "current focus" markers.
 *
 * The dashboard has NO compute engine and CANNOT join plan→initiative, so two
 * derived booleans are precomputed onto each initiative's frontmatter:
 *   planActive  = the initiative's parent plan has status:'active'   (timeline scope)
 *   current     = planActive AND this is the plan's currentPhase     (the "AGORA" focus)
 *
 * It ALSO fixes a real inconsistency: a paused plan must not leave an `active`
 * phase behind (the switch/pause transition paused the plan but not its phase).
 * On a paused plan, any `active` phase — in the plan's `phases[]` descriptor AND
 * the matching initiative file — is demoted to `paused`.
 *
 * Pure function of plan.status + plan.currentPhase; idempotent; rewrites a file
 * only when a value actually changes. Run as part of the project-status flow
 * (see skills/core/project.md → Dashboard rollups, and project-view.md).
 *
 * CLI:  node scripts/reconcile-focus.js [<dir>]    (defaults to ./.atomic-skills)
 */

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { parseFrontmatter } from './validate-state.js';
import { getSpawnedFrom } from '../src/links-sidecar.js';

// Derived dashboard fields — never hand-authored; stripped + re-appended
// canonically on every recompute. The booleans (planActive/current) are stamped
// only when true so an absent field reads as false; planTitle is a denormalized
// label (the parent plan's title) so a repeat-grouped widget can show the human
// title instead of the slug (the dashboard can't join plan→initiative).
const FOCUS_KEYS = ['planActive', 'current', 'planTitle'];

/** Serialize frontmatter + body back to disk, matching compute-rollups.js exactly
 *  so the two passes never fight over formatting. */
function writeFrontmatter(filePath, parsed, nextFm) {
  const yamlBlock = stringifyYaml(nextFm).replace(/\n$/, '');
  const body = parsed.body.length ? parsed.body.replace(/^\n/, '') : '';
  const rebuilt = `---\n${yamlBlock}\n---\n${body ? `\n${body}` : ''}`;
  writeFileSync(filePath, rebuilt.endsWith('\n') ? rebuilt : `${rebuilt}\n`);
}

/** Rebuild an initiative fm: replace status, strip+re-append derived fields last. */
function withFocus(fm, { status, planActive, current, planTitle }) {
  const out = {};
  for (const [k, v] of Object.entries(fm)) {
    if (FOCUS_KEYS.includes(k)) continue; // re-appended canonically below
    if (k === 'status') { out.status = status; continue; }
    out[k] = v;
  }
  if (planTitle != null && planTitle !== '') out.planTitle = planTitle;
  if (planActive) out.planActive = true;
  if (current) out.current = true;
  return out;
}

/** Reconcile one initiative file against its plan context. Returns a change record. */
export function reconcileInitiativeFile(filePath, ctx) {
  let raw;
  try { raw = readFileSync(filePath, 'utf8'); } catch (err) {
    return { filePath, changed: false, error: `read failed: ${err.message}` };
  }
  const parsed = parseFrontmatter(raw);
  if (parsed.error) return { filePath, changed: false, error: parsed.error };
  const fm = parsed.frontmatter;

  // Cascade: a paused plan must not keep an `active` phase.
  const status = ctx.cascade && fm.status === 'active' ? 'paused' : fm.status;
  const planActive = ctx.planActive === true;
  // F4: a fork parent defers the `current` (AGORA) marker on its anchor phase to an
  // active forked child running that phase in parallel — so the dashboard never
  // shows two AGORA phases for one hierarchy. `deferredAnchors` holds this plan's
  // anchor phaseIds that an active child has forked.
  const deferred = ctx.deferredAnchors instanceof Set && ctx.deferredAnchors.has(fm.phaseId);
  const current = planActive && ctx.currentPhase != null && fm.phaseId === ctx.currentPhase && !deferred;
  const planTitle = ctx.planTitle ?? null;

  const statusChanged = status !== fm.status;
  const planActiveChanged = Boolean(fm.planActive) !== planActive;
  const currentChanged = Boolean(fm.current) !== current;
  const planTitleChanged = (fm.planTitle ?? null) !== (planTitle ?? null);
  if (!statusChanged && !planActiveChanged && !currentChanged && !planTitleChanged) {
    return { filePath, changed: false };
  }

  writeFrontmatter(filePath, parsed, withFocus(fm, { status, planActive, current, planTitle }));
  return { filePath, changed: true, status, planActive, current, planTitle, cascaded: statusChanged };
}

/** Reconcile one plan + its initiatives. Pushes change records into `out`. */
function reconcilePlan(planFile, planDir, out, deferredAnchors = new Set()) {
  let planRaw;
  try { planRaw = readFileSync(planFile, 'utf8'); } catch (err) {
    out.push({ filePath: planFile, changed: false, error: `read failed: ${err.message}` });
    return;
  }
  const planParsed = parseFrontmatter(planRaw);
  if (planParsed.error) { out.push({ filePath: planFile, changed: false, error: planParsed.error }); return; }
  const plan = planParsed.frontmatter;
  const planActive = plan.status === 'active';
  const currentPhase = plan.currentPhase ?? null;
  const cascade = plan.status === 'paused';
  const planTitle = typeof plan.title === 'string' && plan.title ? plan.title : null;

  let planChanged = false;
  // 1. Cascade plan.phases[] descriptor active→paused under a paused plan.
  if (cascade && Array.isArray(plan.phases)) {
    for (const ph of plan.phases) {
      if (ph && typeof ph === 'object' && ph.status === 'active') { ph.status = 'paused'; planChanged = true; }
    }
  }
  // 2. Plan-record `planActive` marker — the `phases` dataSource carries it onto
  //    every phase descriptor row so the Home timeline can scope to active plans
  //    (phases are materialized lazily, so the full skeleton lives only here).
  if (Boolean(plan.planActive) !== planActive) {
    if (planActive) plan.planActive = true;
    else delete plan.planActive;
    planChanged = true;
  }
  // 2b. Denormalize `planTitle` (= title) onto the plan record so the `phases`
  //     dataSource carries it onto every phase row — lets the Home timeline label
  //     each repeat group with the human title, not the slug.
  if (planTitle != null && plan.planTitle !== planTitle) {
    plan.planTitle = planTitle;
    planChanged = true;
  } else if (planTitle == null && 'planTitle' in plan) {
    delete plan.planTitle;
    planChanged = true;
  }
  if (planChanged) {
    writeFrontmatter(planFile, planParsed, plan);
    out.push({ filePath: planFile, changed: true, note: `planActive=${planActive}${cascade ? ' + phases active→paused' : ''}` });
  }

  // 2. Each initiative file under phases/ (archive left as-is).
  const phasesDir = join(planDir, 'phases');
  if (!existsSync(phasesDir) || !statSync(phasesDir).isDirectory()) return;
  for (const entry of readdirSync(phasesDir)) {
    if (!entry.endsWith('.md') || entry.startsWith('.')) continue;
    const r = reconcileInitiativeFile(join(phasesDir, entry), { planActive, currentPhase, cascade, planTitle, deferredAnchors });
    if (r.changed || r.error) out.push(r);
  }
}

/** Read a plan/initiative frontmatter, or null on read/parse failure. */
function readFmSafe(filePath) {
  let raw;
  try { raw = readFileSync(filePath, 'utf8'); } catch { return null; }
  const parsed = parseFrontmatter(raw);
  return parsed.error ? null : parsed.frontmatter;
}

/**
 * F4 pre-scan: build `parentSlug → Set(anchor phaseId)` from every ACTIVE plan
 * that is a fork child (its links.json carries `spawnedFrom`). The parent then
 * defers the `current` marker on those anchor phases to the active child. Keyed
 * by slug (not path) — fork is intra-project, slugs are unique per project tree.
 */
function collectForkDeferrals(planEntries) {
  const map = new Map();
  for (const { fm, spawnedFrom } of planEntries) {
    if (!fm || fm.status !== 'active' || !spawnedFrom?.plan || !spawnedFrom?.phaseId) continue;
    if (!map.has(spawnedFrom.plan)) map.set(spawnedFrom.plan, new Set());
    map.get(spawnedFrom.plan).add(spawnedFrom.phaseId);
  }
  return map;
}

/** Walk the nested `.atomic-skills/projects/<id>/<slug>/` tree and reconcile each plan. */
export function reconcileDir(dir) {
  const root = existsSync(join(dir, '.atomic-skills')) ? join(dir, '.atomic-skills') : dir;
  const projectsDir = join(root, 'projects');
  const out = [];
  if (!existsSync(projectsDir) || !statSync(projectsDir).isDirectory()) {
    return { changes: out, changed: 0 };
  }
  // First pass: enumerate every plan + its fork edge so the parent can defer its
  // anchor `current` marker to an active forked child (needs cross-plan knowledge).
  const planEntries = [];
  for (const projId of readdirSync(projectsDir)) {
    const projPath = join(projectsDir, projId);
    if (!statSync(projPath).isDirectory()) continue;
    for (const planSlug of readdirSync(projPath)) {
      const planDir = join(projPath, planSlug);
      if (!statSync(planDir).isDirectory()) continue;
      const planFile = join(planDir, 'plan.md');
      if (!existsSync(planFile)) continue;
      planEntries.push({ planFile, planDir, fm: readFmSafe(planFile), spawnedFrom: getSpawnedFrom(planDir) });
    }
  }
  const deferrals = collectForkDeferrals(planEntries);
  // Second pass: reconcile each plan, passing the anchor phaseIds it must defer.
  for (const { planFile, planDir, fm } of planEntries) {
    const deferred = (fm?.slug && deferrals.get(fm.slug)) || new Set();
    reconcilePlan(planFile, planDir, out, deferred);
  }
  return { changes: out, changed: out.filter((c) => c.changed).length };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const target = resolve(process.argv[2] || process.cwd());
  const report = reconcileDir(target);
  if (!report.changed) {
    console.log('reconcile-focus: all plans/initiatives in sync');
  } else {
    for (const c of report.changes) {
      if (c.error) console.error(`  ✗ ${c.filePath}: ${c.error}`);
      else if (c.changed && c.note) console.log(`  ✓ ${c.filePath} → ${c.note}`);
      else if (c.changed) console.log(`  ✓ ${c.filePath} → status=${c.status}${c.cascaded ? ' (cascaded)' : ''} planActive=${c.planActive} current=${c.current}`);
    }
    console.log(`reconcile-focus: updated ${report.changed} file(s)`);
  }
}
