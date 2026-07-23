#!/usr/bin/env node
/**
 * find-invalid-cross-model-skips.js — HARD gate against agent-biased
 * cross-model SKIPPED receipts on active/ready plans.
 *
 * A valid skip line must look like:
 *   - cross-model: SKIPPED — operator: <reason ≥ 15 chars>
 * Legacy codex: SKIPPED lines are accepted with the same operator: rule.
 *
 * Invalid (exit 1):
 *   - SKIPPED without "operator:"
 *   - reason empty / too short / banlist (not provided, Recommended, ok, n, default, agent)
 *
 * Plans with no SKIPPED line are fine (cross-model ran or never offered).
 * Archived plans skipped.
 *
 * CLI: node scripts/find-invalid-cross-model-skips.js [<repo|.atomic-skills|plan.md|plan-dir>]
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { parseFrontmatter } from './validate-state.js';

const MIN_REASON_LEN = 15;

/** Exact normalized reasons that do not count as real operator choice. */
export const BANNED_SKIP_REASONS = [
  'not provided',
  'notprovided',
  'recommended',
  'default',
  'agent',
  'ok',
  'n',
  'no',
  'skip',
  'y n',
  'y/n',
];

/**
 * Extract skip reason from a Reviews line, or null if not a skip line.
 * @param {string} line
 * @returns {null | { raw: string, operatorTagged: boolean, reason: string }}
 */
export function parseCrossModelSkipLine(line) {
  if (typeof line !== 'string') return null;
  // - cross-model: SKIPPED
  // - cross-model: SKIPPED — …
  // - cross-model (codex): SKIPPED — …
  // - codex: SKIPPED — … (legacy)
  // Separator after SKIPPED is optional so bare `- cross-model: SKIPPED` is
  // recognized (and later rejected as missing operator tag / reason).
  const m = line.match(
    /^\s*-\s*(?:cross-model(?:\s*\([^)]*\))?|codex)\s*:\s*SKIPPED(?:\s*(?:—|--|-)\s*(.*))?$/i,
  );
  if (!m) return null;
  const rest = (m[1] || '').trim();
  if (!rest) {
    return { raw: '', operatorTagged: false, reason: '' };
  }
  const op = rest.match(/^operator\s*:\s*(.*)$/i);
  if (op) {
    return { raw: rest, operatorTagged: true, reason: (op[1] || '').trim() };
  }
  return { raw: rest, operatorTagged: false, reason: rest };
}

/**
 * @param {string} reason
 * @returns {string | null} error code or null if ok
 */
export function invalidSkipReason(reason) {
  const r = String(reason || '').trim();
  if (r.length < MIN_REASON_LEN) return 'reason-too-short';
  const norm = r.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  for (const ban of BANNED_SKIP_REASONS) {
    // Exact match only — prefix bans on "no"/"n"/"skip" false-block legitimate prose.
    if (norm === ban) return 'banned-reason';
  }
  // Soft prefix only for long multi-word bans that are clearly filler openers.
  if (norm.startsWith('not provided') || norm.startsWith('recommended ')) {
    return 'banned-reason';
  }
  return null;
}

/**
 * @param {string} body plan body
 * @returns {Array<{ line: string, code: string }>}
 */
export function findInvalidSkipsInBody(body) {
  if (typeof body !== 'string') return [];
  const lines = body.split(/\r?\n/);
  const headingIdx = lines.findIndex((l) => /^##\s+Reviews\s*$/i.test(l.trim()));
  if (headingIdx === -1) return [];
  const bad = [];
  for (let i = headingIdx + 1; i < lines.length; i += 1) {
    if (/^##\s+\S/.test(lines[i])) break;
    const parsed = parseCrossModelSkipLine(lines[i]);
    if (!parsed) continue;
    if (!parsed.operatorTagged) {
      bad.push({ line: lines[i].trim(), code: 'missing-operator-tag' });
      continue;
    }
    const code = invalidSkipReason(parsed.reason);
    if (code) bad.push({ line: lines[i].trim(), code });
  }
  return bad;
}

function inferPlanMeta(filePath) {
  const abs = resolve(filePath);
  const parts = abs.split(/[\\/]+/);
  const atomicIdx = parts.lastIndexOf('.atomic-skills');
  if (atomicIdx !== -1) {
    const after = parts.slice(atomicIdx + 1);
    if (after[0] === 'projects' && after[1] && after[2] && after[3] === 'plan.md') {
      return { projectId: after[1], planSlug: after[2] };
    }
  }
  return { projectId: '(scoped)', planSlug: basename(dirname(abs)) };
}

function collectPlanFile(filePath, report) {
  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch {
    return;
  }
  const parsed = parseFrontmatter(raw);
  const status = parsed.error ? undefined : parsed.frontmatter?.status;
  if (status === 'archived') return;
  const body = parsed.error ? raw : parsed.body;
  const invalids = findInvalidSkipsInBody(body);
  if (invalids.length) {
    report.push({ ...inferPlanMeta(filePath), file: filePath, invalids });
  }
}

export function findInvalidCrossModelSkips(target = process.cwd()) {
  const targetPath = resolve(target);
  const report = [];

  if (existsSync(targetPath)) {
    const st = statSync(targetPath);
    if (st.isFile()) {
      collectPlanFile(targetPath, report);
      return report;
    }
    if (st.isDirectory()) {
      const scoped = join(targetPath, 'plan.md');
      if (existsSync(scoped)) {
        collectPlanFile(scoped, report);
        return report;
      }
    }
  }

  const root = existsSync(join(targetPath, '.atomic-skills'))
    ? join(targetPath, '.atomic-skills')
    : targetPath;
  const projects = join(root, 'projects');
  if (existsSync(projects)) {
    for (const proj of readdirSync(projects)) {
      const projPath = join(projects, proj);
      if (!statSync(projPath).isDirectory()) continue;
      for (const slug of readdirSync(projPath)) {
        const planFile = join(projPath, slug, 'plan.md');
        if (existsSync(planFile)) collectPlanFile(planFile, report);
      }
    }
  }
  // Flat legacy coexistence
  const flatPlans = join(root, 'plans');
  if (existsSync(flatPlans) && statSync(flatPlans).isDirectory()) {
    for (const entry of readdirSync(flatPlans)) {
      if (!entry.endsWith('.md') || entry.startsWith('.')) continue;
      collectPlanFile(join(flatPlans, entry), report);
    }
  }
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const target = resolve(process.argv[2] || process.cwd());
  const report = findInvalidCrossModelSkips(target);
  if (!report.length) {
    console.log(
      'find-invalid-cross-model-skips: no invalid cross-model SKIPPED receipts ✓',
    );
    process.exit(0);
  }
  console.log(
    `find-invalid-cross-model-skips: ${report.length} plan(s) with invalid SKIPPED receipts:`,
  );
  for (const r of report) {
    console.log(`  ${r.projectId}/${r.planSlug}`);
    for (const inv of r.invalids) {
      console.log(`    - [${inv.code}] ${inv.line}`);
    }
  }
  console.log(
    '\nValid skip format only:\n  - cross-model: SKIPPED — operator: <reason ≥ 15 chars, not banned filler>\nNever mark skip as Recommended; never put N first in the ask. Re-run cross-model or fix the receipt.',
  );
  process.exit(1);
}
