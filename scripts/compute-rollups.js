/**
 * compute-rollups.js — precompute the dashboard rollup fields
 * (`tasksDone` / `tasksTotal` / `gatesMet` / `gatesTotal`) onto every
 * initiative's frontmatter, AND the per-gate derived dashboard fields
 * (`verifierLabel` / `evidenceSummary`) onto every `exitGates[]` element.
 *
 * The generic aiDeck reads project state in place and has NO compute engine, so
 * progress meters (e.g. the `phase-timeline` widget) need scalar rollups already
 * on each record. Each rollup is SELF-CONTAINED per initiative — it counts that
 * initiative's own `tasks[]` / `exitGates[]`, no cross-file join:
 *   tasksDone  = count(tasks.status === 'done')
 *   tasksTotal = tasks.length
 *   gatesMet   = count(exitGates.status === 'met')
 *   gatesTotal = exitGates.length
 *
 * The project-status skill keeps these fresh on live mutations (see
 * skills/core/project.md — recompute on every task/gate change). This script is
 * the deterministic batch (re)compute: it backfills existing state and acts as a
 * drift fixer. Idempotent — only rewrites a file when a rollup value changes.
 *
 * CLI:  node scripts/compute-rollups.js [<dir>]    (defaults to ./.atomic-skills)
 */

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { parseFrontmatter } from './validate-state.js';

const ROLLUP_KEYS = ['tasksDone', 'tasksTotal', 'gatesMet', 'gatesTotal'];

/** Self-contained rollup counts for one initiative's frontmatter. */
export function rollupsFor(fm) {
  const tasks = Array.isArray(fm.tasks) ? fm.tasks : [];
  const gates = Array.isArray(fm.exitGates) ? fm.exitGates : [];
  return {
    tasksDone: tasks.filter((t) => t && t.status === 'done').length,
    tasksTotal: tasks.length,
    gatesMet: gates.filter((g) => g && g.status === 'met').length,
    gatesTotal: gates.length,
  };
}

// ── Per-gate derived dashboard fields ───────────────────────────────────────
// aiDeck has no compute engine and generic widgets cannot read a gate's nested
// `verifier {kind,…}` / `evidence {passed,…}` objects (TableWidget JSON-blobs
// objects). So we FLATTEN them into two neutral scalars the dashboard binds as
// plain columns. Pure projections of existing data — never hand-authored.
const GATE_DERIVED_KEYS = ['verifierLabel', 'evidenceSummary'];

function truncate(s, n) {
  const str = String(s).trim();
  return str.length > n ? `${str.slice(0, n - 1)}…` : str;
}

/** ISO/space timestamp → 'YYYY-MM-DD' (or the raw string if shorter). */
function shortDate(ts) {
  const s = String(ts || '');
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/** One-line human label of a gate's `verifier` (kind + key arg), '' if absent. */
export function verifierLabelFor(gate) {
  const v = gate && gate.verifier;
  if (!v || typeof v !== 'object') return '';
  const kind = String(v.kind || '').trim();
  switch (kind) {
    case 'shell':
      return v.command ? `shell: ${truncate(v.command, 60)}` : 'shell';
    case 'test': {
      const parts = [v.runner, v.pattern].filter(Boolean).join(' ');
      return parts ? `test: ${truncate(parts, 60)}` : 'test';
    }
    case 'query':
      return v.sql ? `query: ${truncate(v.sql, 60)}` : 'query';
    case 'manual':
      return 'manual';
    default:
      return kind;
  }
}

/** One-line summary of a gate's `evidence` / deferral, '' while pending. */
export function evidenceSummaryFor(gate) {
  if (!gate || typeof gate !== 'object') return '';
  const status = String(gate.status || '');
  if (status === 'deferred') {
    const r = gate.deferredReason ? truncate(gate.deferredReason, 80) : '';
    return r ? `deferred: ${r}` : 'deferred';
  }
  if (status === 'met') {
    const e = gate.evidence;
    if (e && typeof e === 'object') {
      const bits = [];
      if (e.passed === true) bits.push('passed');
      else if (e.passed === false) bits.push('failed');
      if (typeof e.testsCollected === 'number') bits.push(`${e.testsCollected} tests`);
      if (typeof e.rowCount === 'number') bits.push(`${e.rowCount} rows`);
      if (e.verifiedAt) bits.push(shortDate(e.verifiedAt));
      if (!bits.length && e.outputSummary) bits.push(truncate(e.outputSummary, 80));
      if (bits.length) return bits.join(' · ');
    }
    return gate.metAt ? `met · ${shortDate(gate.metAt)}` : 'met';
  }
  return ''; // pending → no summary
}

/**
 * Refresh the derived dashboard fields on each `exitGates[]` element. Returns
 * the (possibly new) array + whether anything changed. Idempotent: strips any
 * prior derived keys and re-appends canonically, so the key order is stable
 * across runs. `verifierLabel` is present whenever a verifier exists;
 * `evidenceSummary` only when met/deferred (omitted while pending).
 */
function deriveGates(gates) {
  if (!Array.isArray(gates)) return { gates, changed: false };
  let changed = false;
  const next = gates.map((g) => {
    if (!g || typeof g !== 'object' || Array.isArray(g)) return g;
    const rest = {};
    for (const [k, v] of Object.entries(g)) {
      if (!GATE_DERIVED_KEYS.includes(k)) rest[k] = v;
    }
    const label = verifierLabelFor(g);
    const summary = evidenceSummaryFor(g);
    if (label) rest.verifierLabel = label;
    if (summary) rest.evidenceSummary = summary;
    if ((g.verifierLabel || '') !== (label || '') || (g.evidenceSummary || '') !== (summary || '')) {
      changed = true;
    }
    return rest;
  });
  return { gates: next, changed };
}

/** Rebuild fm with rollups stripped + re-inserted canonically before `exitGates`. */
function withRollups(fm, roll) {
  const out = {};
  let inserted = false;
  for (const [k, v] of Object.entries(fm)) {
    if (ROLLUP_KEYS.includes(k)) continue; // drop any stale rollups
    if (k === 'exitGates' && !inserted) {
      for (const rk of ROLLUP_KEYS) out[rk] = roll[rk];
      inserted = true;
    }
    out[k] = v;
  }
  if (!inserted) for (const rk of ROLLUP_KEYS) out[rk] = roll[rk];
  return out;
}

/** Recompute rollups for a single initiative file; rewrites only if changed. */
export function computeRollupsFile(filePath) {
  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (err) {
    return { filePath, changed: false, error: `read failed: ${err.message}` };
  }
  const parsed = parseFrontmatter(raw);
  if (parsed.error) return { filePath, changed: false, error: parsed.error };
  const fm = parsed.frontmatter;
  // Only initiatives carry tasks[]/exitGates[]; plans (phases[]) are skipped.
  if (!Array.isArray(fm.tasks) && !Array.isArray(fm.exitGates)) {
    return { filePath, changed: false };
  }
  const roll = rollupsFor(fm);
  const { gates: nextGates, changed: gatesChanged } = deriveGates(fm.exitGates);
  const rollupsChanged = !ROLLUP_KEYS.every((k) => fm[k] === roll[k]);
  if (!rollupsChanged && !gatesChanged) return { filePath, changed: false };

  const fmWithGates = Array.isArray(fm.exitGates) ? { ...fm, exitGates: nextGates } : fm;
  const next = withRollups(fmWithGates, roll);
  const yamlBlock = stringifyYaml(next).replace(/\n$/, '');
  const body = parsed.body.length ? parsed.body.replace(/^\n/, '') : '';
  const rebuilt = `---\n${yamlBlock}\n---\n${body ? `\n${body}` : ''}`;
  writeFileSync(filePath, rebuilt.endsWith('\n') ? rebuilt : `${rebuilt}\n`);
  return { filePath, changed: true, rollups: roll };
}

/** Collect every initiative file under a `.atomic-skills/` tree (flat + nested). */
function collectInitiatives(root) {
  const targets = [];
  const collectMd = (base) => {
    if (!existsSync(base) || !statSync(base).isDirectory()) return;
    for (const entry of readdirSync(base)) {
      if (entry.endsWith('.md') && !entry.startsWith('.')) targets.push(join(base, entry));
    }
  };
  // Flat (legacy): .atomic-skills/initiatives/*.md (+ archive)
  collectMd(join(root, 'initiatives'));
  collectMd(join(root, 'initiatives', 'archive'));
  // Nested: projects/<id>/<slug>/phases/*.md (+ archive)
  const projectsDir = join(root, 'projects');
  if (existsSync(projectsDir) && statSync(projectsDir).isDirectory()) {
    for (const projId of readdirSync(projectsDir)) {
      const projPath = join(projectsDir, projId);
      if (!statSync(projPath).isDirectory()) continue;
      for (const planSlug of readdirSync(projPath)) {
        const planPath = join(projPath, planSlug);
        if (!statSync(planPath).isDirectory()) continue;
        collectMd(join(planPath, 'phases'));
        collectMd(join(planPath, 'phases', 'archive'));
      }
    }
  }
  return targets;
}

export function computeRollupsDir(dir) {
  const root = existsSync(join(dir, '.atomic-skills')) ? join(dir, '.atomic-skills') : dir;
  const files = [];
  let changed = 0;
  for (const filePath of collectInitiatives(root)) {
    const r = computeRollupsFile(filePath);
    if (r.changed || r.error) files.push(r);
    if (r.changed) changed += 1;
  }
  return { files, changed };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const target = resolve(process.argv[2] || process.cwd());
  const report = computeRollupsDir(target);
  if (!report.changed) {
    console.log('compute-rollups: all initiatives up to date');
  } else {
    for (const f of report.files) {
      if (f.error) console.error(`  ✗ ${f.filePath}: ${f.error}`);
      else if (f.changed) console.log(`  ✓ ${f.filePath} → ${JSON.stringify(f.rollups)}`);
    }
    console.log(`compute-rollups: updated ${report.changed} initiative(s)`);
  }
}
