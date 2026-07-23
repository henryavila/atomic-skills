#!/usr/bin/env node
/**
 * find-weak-business-intent.js — deterministic, zero-token DETECTOR of
 * MATERIALIZED phases whose businessIntent spine is present but *weak*
 * (boilerplate / rubber-stamp shape). Complements find-missing-business-intent.js
 * (presence only). HARD-BLOCK exit 1 when quality fails on either surface.
 *
 * Quality rules (calibratable constants):
 *   - min length per spine field (after trim)
 *   - soft-language ban (G2) as whole-word matches
 *   - outOfScope must not be a near-echo of value (normalized equality / containment)
 *   - doneWhen must carry an observable token (path, command verb, pass/exit/test/…)
 *
 * Descriptor-only phases (no initiative file) are skipped — same frontier as
 * find-missing-business-intent.
 *
 * CLI:
 *   node scripts/find-weak-business-intent.js [<state-root>|<plan-dir>|<plan.md>]
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { parseFrontmatter } from './validate-state.js';

const BLANK_MARKER = '[NEEDS CLARIFICATION]';
const SPINE_FIELDS = ['value', 'workflow', 'rules', 'outOfScope', 'doneWhen'];

/** Minimum non-whitespace length per field (calibrated for PT/EN short claims). */
export const MIN_FIELD_LENGTH = 40;

/**
 * G2 soft-language hedges (whole-word). Aligns with docs/kb/code-quality-gates.md.
 * Intentionally omits common product verbs (melhorar/otimizar/refatorar) and
 * ambiguous "may" so legitimate concrete spines are not false-blocked.
 */
export const SOFT_LANGUAGE_RE =
  /\b(should|probably|typically|usually|I think|it seems|in theory|tends to|maybe|perhaps|kinda|sort of)\b/i;

/** doneWhen must mention something checkable — not pure vibe. */
export const OBSERVABLE_RE =
  /\b(pass|fail|exit|test|rg|grep|npm|node|script|file|\.js|\.md|\.json|commit|green|vermelho|verde|detector|lint|verify|verifier|comando|arquivo|suite)\b|\/[\w./@-]+/i;

const WEAK_FILLER_ONLY_RE =
  /^(ok|yes|sim|lgtm|fine|done|pronto|melhorar (a )?ux|improve (the )?ux)\.?$/i;

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

function fmOf(filePath) {
  try {
    const parsed = parseFrontmatter(readFileSync(filePath, 'utf8'));
    return parsed.error ? null : parsed.frontmatter;
  } catch {
    return null;
  }
}

function containingAtomicSkillsRoot(dir) {
  let current = isFile(dir) ? dirname(resolve(dir)) : resolve(dir);
  while (true) {
    if (basename(current) === '.atomic-skills') return current;
    const nested = join(current, '.atomic-skills');
    if (isDirectory(nested)) return nested;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export function configuredLanguage(dir) {
  const read = (p) => {
    try {
      return JSON.parse(readFileSync(p, 'utf8')).language || null;
    } catch {
      return null;
    }
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

function normalizeForEcho(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Quality issues for one businessIntent object (already present).
 * Returns the first issue { field, reason } or null when strong enough.
 * @param {object} businessIntent
 * @returns {{ field: string, reason: string } | null}
 */
export function firstWeakField(businessIntent) {
  const bi =
    businessIntent && typeof businessIntent === 'object' && !Array.isArray(businessIntent)
      ? businessIntent
      : {};

  for (const field of SPINE_FIELDS) {
    const raw = bi[field];
    if (typeof raw !== 'string') {
      return { field, reason: 'missing-or-non-string' };
    }
    const v = raw.trim();
    if (!v || v === BLANK_MARKER) {
      return { field, reason: 'blank-or-needs-clarification' };
    }
    if (WEAK_FILLER_ONLY_RE.test(v)) {
      return { field, reason: 'filler-only' };
    }
    if (v.length < MIN_FIELD_LENGTH) {
      return { field, reason: `too-short(<${MIN_FIELD_LENGTH})` };
    }
    if (SOFT_LANGUAGE_RE.test(v)) {
      return { field, reason: 'soft-language' };
    }
  }

  const valueN = normalizeForEcho(bi.value);
  const outN = normalizeForEcho(bi.outOfScope);
  if (outN && valueN && (outN === valueN || valueN.includes(outN) || outN.includes(valueN))) {
    return { field: 'outOfScope', reason: 'echo-of-value' };
  }

  if (!OBSERVABLE_RE.test(String(bi.doneWhen || ''))) {
    return { field: 'doneWhen', reason: 'no-observable-token' };
  }

  return null;
}

function collectWeakForPlan(plan, initForPhaseId) {
  const weak = [];
  for (const ph of Array.isArray(plan.phases) ? plan.phases : []) {
    if (!ph || typeof ph !== 'object') continue;
    // Materialize/activation gate: skip historical done/archived phases so a
    // weak legacy spine cannot block materialize of a new phase (plan-wide scan).
    const st = ph.status != null ? String(ph.status).trim().toLowerCase() : '';
    if (st === 'done' || st === 'archived') continue;
    const id = String(ph.id ?? '?');
    const init = initForPhaseId(id);
    if (!init) continue; // descriptor-only

    const d = firstWeakField(ph.businessIntent);
    if (d) weak.push({ phaseId: id, field: d.field, reason: d.reason, where: 'descriptor' });
    const i = firstWeakField(init.businessIntent);
    if (i) weak.push({ phaseId: id, field: i.field, reason: i.reason, where: 'initiative' });
  }
  return weak;
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

  const weak = collectWeakForPlan(plan, (id) => initByPhaseId.get(id));
  return weak.length ? { projectId, planSlug, weak } : null;
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
  const weak = collectWeakForPlan(plan, flatInitFor);
  return weak.length ? { projectId: '(flat)', planSlug, weak } : null;
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
 * @param {string} dir
 * @returns {Array<{ projectId: string, planSlug: string, weak: Array<object> }>}
 */
export function findWeakBusinessIntent(dir) {
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
  const report = findWeakBusinessIntent(target);
  if (!report.length) {
    console.log(
      'find-weak-business-intent: every materialized phase has a strong-enough businessIntent spine ✓',
    );
    process.exit(0);
  }
  const total = report.reduce((n, r) => n + r.weak.length, 0);
  const lang = configuredLanguage(target);
  console.log(
    `find-weak-business-intent: ${total} weak spine field(s) across ${report.length} plan(s):`,
  );
  for (const r of report) {
    console.log(`  ${r.projectId}/${r.planSlug}`);
    for (const w of r.weak) {
      console.log(`    - ${w.phaseId} ${w.where}.${w.field}: ${w.reason}`);
    }
  }
  console.log(
    `\nRewrite weak fields in the install-configured language: ${lang}. Do not approve-anyway — quality is HARD-BLOCK (rewrite the field). Soft-language and short fillers fail closed.`,
  );
  process.exit(1);
}
