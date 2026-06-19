#!/usr/bin/env node
/**
 * harden-closedat.js — the single, idempotent flip that promotes `closedAt` from
 * a SOFT audit (F1) to a HARD, forward-only validation gate (F4/T-003) for ONE
 * plan.
 *
 * Why a script and not a hand-edit: the cut between "legacy, exempt" and "new,
 * must-record-closedAt" is `grandfatheredTaskIds` — the set of done tasks that
 * have NO closedAt at the instant of the flip. Computing that by hand invites
 * grandfathering the wrong ids (or, worse, inventing retroactive closedAt to
 * "clean up" the curve — forbidden by P3). This script computes the set
 * mechanically from the plan's live initiatives and writes `closedAtHardening`
 * onto the plan, so the cut is reproducible and auditable.
 *
 * Forward-only / never-invent (P3): it NEVER writes a closedAt onto any task. The
 * done-without-closedAt tasks alive at flip time are GRANDFATHERED (recorded as
 * exempt ids), not back-filled — back-filling would collapse the burn-up curve
 * into a false step.
 *
 * Idempotent: once a plan carries `closedAtHardening.enforcedFrom`, a re-run is a
 * no-op — it does NOT recompute the set nor rewrite enforcedFrom (the cut is a
 * historical fact, frozen at the first flip).
 *
 * CLI:  node scripts/harden-closedat.js <path-to-plan.md>
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { stringify as stringifyYaml } from 'yaml';
import { parseFrontmatter } from './validate-state.js';

const hasText = (v) => typeof v === 'string' && v.length > 0;

/** All `.md` files directly under a dir (non-recursive, dotfiles skipped). */
function mdFilesIn(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((e) => e.endsWith('.md') && !e.startsWith('.'))
    .map((e) => join(dir, e));
}

/**
 * The PHASE-SCOPED key for a task. taskIds are phase-LOCAL — `T-001` recurs in
 * every phase — so the grandfather cut MUST be keyed by `<phaseId>/<taskId>`, not
 * the bare id; otherwise grandfathering an old `F0/T-001` would silently exempt a
 * later `F1/T-001` and defeat the forward-only gate. Falls back to the (globally
 * unique) initiative slug when phaseId is absent. The SAME derivation runs in
 * `checkClosedAtHardening` (validate-state.js), so flip and validate agree.
 */
function grandfatherKey(initiativeFm, taskId) {
  const scope = hasText(initiativeFm.phaseId)
    ? initiativeFm.phaseId
    : (hasText(initiativeFm.slug) ? initiativeFm.slug : '?');
  return `${scope}/${taskId}`;
}

/**
 * Compute the grandfathered cut: the PHASE-SCOPED keys (`<phaseId>/<taskId>`) of
 * every `done` task WITHOUT a closedAt across the plan's initiatives, in BOTH
 * supported layouts — nested (`<planDir>/phases/` + archive, plan-private) and
 * legacy flat (`<planDir>/../initiatives/` + archive, shared across plans, so
 * filtered by `parentPlan === planSlug`). Pure read — never mutates a file.
 * Returns a sorted, de-duplicated array of keys.
 *
 * @param {string} planDir - the plan directory (dirname of plan.md)
 * @param {string} planSlug - the plan's slug (filters the shared flat initiatives/)
 * @returns {string[]}
 */
export function computeGrandfathered(planDir, planSlug) {
  const keys = new Set();
  const collect = (filePath, requireParentMatch) => {
    let raw;
    try { raw = readFileSync(filePath, 'utf8'); } catch { return; }
    const parsed = parseFrontmatter(raw);
    if (parsed.error || !parsed.frontmatter) return;
    const fm = parsed.frontmatter;
    if (requireParentMatch && fm.parentPlan !== planSlug) return;
    for (const task of (Array.isArray(fm.tasks) ? fm.tasks : [])) {
      if (task?.status === 'done' && hasText(task.id) && !hasText(task.closedAt)) {
        keys.add(grandfatherKey(fm, task.id));
      }
    }
  };
  // Nested layout: plan-private, no parentPlan filter needed.
  for (const base of [join(planDir, 'phases'), join(planDir, 'phases', 'archive')]) {
    for (const p of mdFilesIn(base)) collect(p, false);
  }
  // Legacy flat layout: a shared initiatives/ dir — filter to THIS plan.
  for (const base of [join(planDir, '..', 'initiatives'), join(planDir, '..', 'initiatives', 'archive')]) {
    for (const p of mdFilesIn(base)) collect(p, true);
  }
  return [...keys].sort();
}

/**
 * Flip a plan to closedAt-hardening, idempotently.
 *
 * @param {string} planPath - path to the plan.md file
 * @param {string} [now] - the flip timestamp (ISO); defaults to new Date() — pass
 *                         an explicit value for deterministic tests.
 * @returns {{changed: boolean, enforcedFrom: string, grandfatheredTaskIds: string[], reason: string}}
 */
export function hardenClosedAt(planPath, now) {
  const abs = resolve(planPath);
  const parsed = parseFrontmatter(readFileSync(abs, 'utf8'));
  if (parsed.error) throw new Error(`harden-closedat: ${parsed.error}`);
  const fm = parsed.frontmatter;

  if (fm.closedAtHardening && hasText(fm.closedAtHardening.enforcedFrom)) {
    return {
      changed: false,
      enforcedFrom: fm.closedAtHardening.enforcedFrom,
      grandfatheredTaskIds: Array.isArray(fm.closedAtHardening.grandfatheredTaskIds)
        ? fm.closedAtHardening.grandfatheredTaskIds
        : [],
      reason: 'already-hardened',
    };
  }

  const grandfatheredTaskIds = computeGrandfathered(dirname(abs), fm.slug);
  const enforcedFrom = hasText(now) ? now : new Date().toISOString();
  const next = { ...fm, closedAtHardening: { enforcedFrom, grandfatheredTaskIds } };

  const yamlBlock = stringifyYaml(next).replace(/\n$/, '');
  const body = parsed.body.length ? parsed.body.replace(/^\n/, '') : '';
  const rebuilt = `---\n${yamlBlock}\n---\n${body ? `\n${body}` : ''}`;
  writeFileSync(abs, rebuilt.endsWith('\n') ? rebuilt : `${rebuilt}\n`);

  return { changed: true, enforcedFrom, grandfatheredTaskIds, reason: 'hardened' };
}

// CLI
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const planPath = process.argv[2];
  if (!planPath) {
    console.error('usage: node scripts/harden-closedat.js <path-to-plan.md>');
    process.exit(1);
  }
  try {
    const r = hardenClosedAt(planPath);
    if (r.changed) {
      console.log(`harden-closedat: hardened ${planPath} — enforcedFrom=${r.enforcedFrom}, grandfathered ${r.grandfatheredTaskIds.length} id(s) ✓`);
    } else {
      console.log(`harden-closedat: ${planPath} already hardened (enforcedFrom=${r.enforcedFrom}) — no-op`);
    }
  } catch (err) {
    console.error(`harden-closedat: ${err.message}`);
    process.exit(1);
  }
}
