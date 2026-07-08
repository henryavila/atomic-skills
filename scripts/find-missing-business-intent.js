/**
 * find-missing-business-intent.js — deterministic, zero-token DETECTOR (D4) of
 * MATERIALIZED phases whose businessIntent spine is incomplete.
 *
 * The 5-field businessIntent spine (value/workflow/rules/outOfScope/doneWhen) is
 * the load-bearing business context a phase must state before it is implemented.
 * It is authored by the user (blank-field-prompting, D3.4) — proof-of-work, not
 * pre-filled boilerplate the user signs. This detector is the replicable gate:
 * it HARD-BLOCKS (exit 1) when any materialized phase is missing a spine field on
 * either surface, so the author→validate loop runs identically in any repo
 * instead of being hand-eyeballed. Mirrors find-missing-summaries.js / compute-
 * rollups.js / validate-state.js: a pure node scan, identical on every host.
 *
 * "Materializada" = the phase has an initiative file (phases/<slug>.md). A phase
 * that is still descriptor-only (no initiative file — D1 lazy, not yet activated)
 * is IGNORED: businessIntent is filled at activation (D5 backfill-on-activation),
 * so gating it now would false-block work that has not started. The distinction
 * is by the initiative FILE's existence — never by subPhaseCount (a descriptor's
 * subPhaseCount:0 is an honest "unknown until materialized", not "empty phase").
 *
 * Two surfaces per materialized phase:
 *   - plan.phases[].businessIntent   (the descriptor)
 *   - the phase initiative's top-level businessIntent
 * For each surface, reports the FIRST spine field that is absent / empty / the
 * reserved blank-marker `[NEEDS CLARIFICATION]` (treated as absent — proof-of-
 * work: a placeholder the user never filled in is not an answer). derived[] is
 * NEVER gated (it is the optional tail of open questions, not the spine).
 *
 * Exit 0 = every materialized phase has a complete spine; exit 1 = ≥1 gap.
 *
 * CLI:
 *   node scripts/find-missing-business-intent.js [<state-root>|<plan-dir>|<plan.md>]
 *   defaults to ./.atomic-skills. A plan target scopes the gate to that plan;
 *   a state root remains a tree-wide audit.
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { parseFrontmatter } from './validate-state.js';

// Reserved blank-marker the blank-field-prompting surface presents; if the user
// leaves it untouched, the field is treated as missing (proof-of-work gate).
const BLANK_MARKER = '[NEEDS CLARIFICATION]';

// The canonical businessIntent spine — 5 required-when-present string fields.
// ORDER MATTERS: the first missing field on a surface is the one reported.
const SPINE_FIELDS = ['value', 'workflow', 'rules', 'outOfScope', 'doneWhen'];

/**
 * The communication language chosen at skill install — businessIntent authored by
 * the gate's blank-field-prompting must follow it, never an ad-hoc guess.
 * Resolution order: project manifest (<repo>/.atomic-skills/manifest.json) → user
 * manifest (~/.atomic-skills/manifest.json) → 'en'. Mirrors install.js's own
 * precedence (project then user) and find-missing-summaries.js, so the script
 * obeys the same config the renderer bakes into skill bodies.
 */
export function configuredLanguage(dir) {
  const read = (p) => {
    try { return JSON.parse(readFileSync(p, 'utf8')).language || null; } catch { return null; }
  };
  const stateRoot = containingAtomicSkillsRoot(dir);
  return (
    (stateRoot ? read(join(stateRoot, 'manifest.json')) : null) ||
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

function isDirectory(filePath) {
  try {
    return statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function isFile(filePath) {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function containingAtomicSkillsRoot(filePath) {
  let current = isFile(filePath) ? dirname(resolve(filePath)) : resolve(filePath);
  while (true) {
    if (basename(current) === '.atomic-skills') return current;
    const nested = join(current, '.atomic-skills');
    if (isDirectory(nested)) return nested;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

// A spine field counts as present when it is a non-empty string AND not the
// reserved blank-marker. (A `[NEEDS CLARIFICATION]` left in place is absent.)
const hasSpineValue = (v) =>
  typeof v === 'string' && v.trim().length > 0 && v.trim() !== BLANK_MARKER;

/**
 * First missing spine field on a surface, or null when the spine is complete.
 * A surface with no businessIntent object → 'value' (the whole spine is absent).
 * derived[] is intentionally absent from SPINE_FIELDS → never reported here.
 */
function firstMissingField(businessIntent) {
  const bi = businessIntent && typeof businessIntent === 'object' && !Array.isArray(businessIntent)
    ? businessIntent
    : {};
  for (const field of SPINE_FIELDS) {
    if (!hasSpineValue(bi[field])) return field;
  }
  return null;
}

function collectMissingForPlan(plan, initForPhaseId) {
  const missing = [];
  for (const ph of Array.isArray(plan.phases) ? plan.phases : []) {
    if (!ph || typeof ph !== 'object') continue;
    const id = String(ph.id ?? '?');
    const init = initForPhaseId(id);
    if (!init) continue; // descriptor-only → skip (D5)
    const dField = firstMissingField(ph.businessIntent);
    if (dField) missing.push({ phaseId: id, field: dField, where: 'descriptor' });
    const iField = firstMissingField(init.businessIntent);
    if (iField) missing.push({ phaseId: id, field: iField, where: 'initiative' });
  }
  return missing;
}

function nestedPlanReport(projectId, planSlug, planDir) {
  const planFile = join(planDir, 'plan.md');
  if (!existsSync(planFile)) return null;
  const plan = fmOf(planFile);
  if (!plan) return null;

  const initByPhaseId = new Map();
  const phasesDir = join(planDir, 'phases');
  if (isDirectory(phasesDir)) {
    for (const entry of readdirSync(phasesDir)) {
      if (!entry.endsWith('.md') || entry.startsWith('.')) continue;
      const init = fmOf(join(phasesDir, entry));
      if (init && init.phaseId != null) initByPhaseId.set(String(init.phaseId), init);
    }
  }

  const missing = collectMissingForPlan(plan, (id) => initByPhaseId.get(id));
  return missing.length ? { projectId, planSlug, missing } : null;
}

function flatInitIndex(root) {
  const flatInits = join(root, 'initiatives');
  const byPlanPhase = new Map();
  const unscopedByPhaseId = new Map();
  if (!isDirectory(flatInits)) return { byPlanPhase, unscopedByPhaseId };

  for (const entry of readdirSync(flatInits)) {
    if (!entry.endsWith('.md') || entry.startsWith('.')) continue;
    const init = fmOf(join(flatInits, entry));
    if (!init || init.phaseId == null) continue;
    const phaseId = String(init.phaseId);
    if (init.parentPlan) {
      byPlanPhase.set(`${String(init.parentPlan)}\0${phaseId}`, init);
    } else {
      const list = unscopedByPhaseId.get(phaseId) || [];
      list.push(init);
      unscopedByPhaseId.set(phaseId, list);
    }
  }
  return { byPlanPhase, unscopedByPhaseId };
}

function flatPlanReport(root, planFile, initIndex) {
  const plan = fmOf(planFile);
  if (!plan) return null;
  const planSlug = String(plan.slug || basename(planFile).replace(/\.md$/, ''));
  const flatInitFor = (phaseId) => {
    const exact = initIndex.byPlanPhase.get(`${planSlug}\0${phaseId}`);
    if (exact) return exact;
    const unscoped = initIndex.unscopedByPhaseId.get(phaseId) || [];
    return unscoped.length === 1 ? unscoped[0] : null;
  };
  const missing = collectMissingForPlan(plan, flatInitFor);
  return missing.length ? { projectId: '(flat)', planSlug, missing } : null;
}

function resolveScanTarget(dir) {
  const target = resolve(dir);

  if (isFile(target)) {
    if (basename(target) === 'plan.md') {
      const planDir = dirname(target);
      return {
        type: 'nestedPlan',
        projectId: basename(dirname(planDir)),
        planSlug: basename(planDir),
        planDir,
      };
    }
    if (basename(dirname(target)) === 'plans' && target.endsWith('.md')) {
      return { type: 'flatPlan', root: dirname(dirname(target)), planFile: target };
    }
  }

  if (isDirectory(target) && existsSync(join(target, 'plan.md'))) {
    return {
      type: 'nestedPlan',
      projectId: basename(dirname(target)),
      planSlug: basename(target),
      planDir: target,
    };
  }

  return {
    type: 'root',
    root: existsSync(join(target, '.atomic-skills')) ? join(target, '.atomic-skills') : target,
  };
}

/**
 * Collect { projectId, planSlug, missing: [{phaseId, field, where}] } for every
 * MATERIALIZED phase whose businessIntent spine is incomplete on either surface.
 * Scans BOTH layouts (matching find-missing-summaries.js / compute-rollups.js):
 * nested projects/<id>/<slug>/{plan.md, phases/*.md} and flat legacy
 * plans/*.md + initiatives/*.md. Descriptor-only phases (no initiative file) are
 * skipped — not yet activated (D5).
 */
export function findMissingBusinessIntent(dir) {
  const target = resolveScanTarget(dir);
  if (target.type === 'nestedPlan') {
    const one = nestedPlanReport(target.projectId, target.planSlug, target.planDir);
    return one ? [one] : [];
  }
  if (target.type === 'flatPlan') {
    const one = flatPlanReport(target.root, target.planFile, flatInitIndex(target.root));
    return one ? [one] : [];
  }

  const root = target.root;
  const report = [];

  // Nested: projects/<id>/<slug>/{plan.md, phases/*.md}
  const projectsDir = join(root, 'projects');
  if (isDirectory(projectsDir)) {
    for (const projId of readdirSync(projectsDir)) {
      const projPath = join(projectsDir, projId);
      if (!isDirectory(projPath)) continue;
      for (const planSlug of readdirSync(projPath)) {
        const planDir = join(projPath, planSlug);
        if (!isDirectory(planDir)) continue;
        const one = nestedPlanReport(projId, planSlug, planDir);
        if (one) report.push(one);
      }
    }
  }

  // Flat (legacy coexistence): plans/*.md descriptors + initiatives/*.md.
  // A flat phase is "materialized" when a flat initiative belongs to the same
  // parentPlan + phaseId. Very old unscoped initiatives can still be matched by
  // phaseId only when that fallback is unambiguous; otherwise skip rather than
  // false-materializing a descriptor-only phase from another plan.
  const initIndex = flatInitIndex(root);
  const flatPlans = join(root, 'plans');
  if (isDirectory(flatPlans)) {
    for (const entry of readdirSync(flatPlans)) {
      if (!entry.endsWith('.md') || entry.startsWith('.')) continue;
      const one = flatPlanReport(root, join(flatPlans, entry), initIndex);
      if (one) report.push(one);
    }
  }

  return report;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const target = resolve(process.argv[2] || process.cwd());
  const report = findMissingBusinessIntent(target);
  if (!report.length) {
    console.log('find-missing-business-intent: every materialized phase has a complete businessIntent spine ✓');
    process.exit(0);
  }
  const total = report.reduce((n, r) => n + r.missing.length, 0);
  const lang = configuredLanguage(target);
  console.log(`find-missing-business-intent: ${total} businessIntent spine field(s) missing across ${report.length} plan(s):`);
  for (const r of report) {
    const slots = r.missing.map((m) => `${m.phaseId}: ${m.field}(${m.where})`).join(', ');
    console.log(`  ${r.projectId}/${r.planSlug}: ${slots}`);
  }
  console.log(`\nFill each missing spine field (value/workflow/rules/outOfScope/doneWhen) in the install-configured language: ${lang} (NOT an ad-hoc choice).`);
  console.log('A field set to `[NEEDS CLARIFICATION]` counts as missing — replace the placeholder with the real answer (proof-of-work, skills/core/project.md → businessIntent).');
  process.exit(1);
}
