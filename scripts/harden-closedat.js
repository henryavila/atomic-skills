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

/** Every initiative .md under a plan dir's phases/ (+ phases/archive/). */
function collectInitiativePaths(planDir) {
  const out = [];
  for (const base of [join(planDir, 'phases'), join(planDir, 'phases', 'archive')]) {
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base)) {
      if (entry.endsWith('.md') && !entry.startsWith('.')) out.push(join(base, entry));
    }
  }
  return out;
}

/**
 * Compute the grandfathered cut: the ids of every `done` task WITHOUT a closedAt
 * across the plan's initiatives (active phases AND archive). Pure read — never
 * mutates a file. Returns a sorted, de-duplicated array of ids.
 *
 * @param {string} planDir - the plan directory (contains plan.md + phases/)
 * @returns {string[]}
 */
export function computeGrandfathered(planDir) {
  const ids = new Set();
  for (const filePath of collectInitiativePaths(planDir)) {
    let raw;
    try { raw = readFileSync(filePath, 'utf8'); } catch { continue; }
    const parsed = parseFrontmatter(raw);
    if (parsed.error || !parsed.frontmatter) continue;
    for (const task of (Array.isArray(parsed.frontmatter.tasks) ? parsed.frontmatter.tasks : [])) {
      if (task?.status === 'done' && hasText(task.id) && !hasText(task.closedAt)) {
        ids.add(task.id);
      }
    }
  }
  return [...ids].sort();
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

  const grandfatheredTaskIds = computeGrandfathered(dirname(abs));
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
