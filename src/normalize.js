/**
 * normalize.js — repair known schema drift in `.atomic-skills/` state files so
 * aiDeck accepts them.
 *
 * aiDeck validates the whole project state with a `.strict()` schema and rejects
 * the ENTIRE state on the first violation, rendering the project card as
 * "⊘ <project> — failed to load". The two recurring drift classes are:
 *
 *   1. Exit-gate `status` carrying a Task vocabulary value (`done`, `active`, …).
 *      Gate status is `pending` | `met` | `deferred` ONLY. `done` means the gate
 *      was satisfied → `met`; anything else not-yet-satisfied → `pending`.
 *   2. `references[]` entries missing `kind`, or using `title` instead of `label`
 *      (the shape written by the aiDeck v2 tool, which has a tolerant normalize
 *      layer the stable runtime does not). Canonical ArtifactRef is
 *      `{ kind: 'file'|'url'|'repo-path'|'section', path, label? }`.
 *
 * This module is pure + immutable: `normalizeEntity` never mutates its input.
 * `normalizeStateDir` is the only side-effecting entry point (writes repaired
 * files back to disk) and is idempotent.
 */

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { parseFrontmatter } from '../scripts/validate-state.js';

const GATE_STATUSES = new Set(['pending', 'met', 'deferred']);
const REF_KINDS = new Set(['file', 'url', 'repo-path', 'section']);
const MET_SYNONYMS = new Set(['done', 'complete', 'completed', 'closed', 'passed', 'satisfied', 'ok']);

// Required initiative fields that have an unambiguous empty default. The runtime
// initiativeSchema is `.strict()`, so a missing required field rejects the whole
// project state. We backfill ONLY these (arrays → [], nullable scalars → null,
// schemaVersion → '0.1'); content fields (slug/title/goal/status/started/…) are
// never invented — a file missing those is reported, not silently faked.
const INITIATIVE_DEFAULTS = {
  schemaVersion: '0.1',
  exitGates: [],
  stack: [],
  tasks: [],
  parked: [],
  emerged: [],
  branch: null,
  nextAction: null,
};

/**
 * Infer whether a frontmatter object is a plan or an initiative.
 * @returns {'plan'|'initiative'|null}
 */
function inferKind(entity) {
  if (Array.isArray(entity.phases)) return 'plan';
  if ('exitGates' in entity || 'stack' in entity || 'tasks' in entity) return 'initiative';
  return null;
}

/**
 * Map an invalid gate status onto a valid `GateStatus`.
 * @param {unknown} status
 * @returns {('met'|'pending')|null} null when `status` is already valid.
 */
export function normalizeGateStatus(status) {
  if (typeof status === 'string' && GATE_STATUSES.has(status)) return null;
  if (typeof status === 'string' && MET_SYNONYMS.has(status.toLowerCase())) return 'met';
  return 'pending';
}

/**
 * Normalize a single ArtifactRef.
 * @param {Record<string, unknown>} ref
 * @returns {{ ref: Record<string, unknown>, changed: boolean }}
 */
export function normalizeReference(ref) {
  if (ref == null || typeof ref !== 'object') return { ref, changed: false };
  const next = { ...ref };
  let changed = false;

  // title → label (label wins if already present)
  if (next.title !== undefined) {
    if (next.label === undefined) next.label = next.title;
    delete next.title;
    changed = true;
  }

  // missing/invalid kind → infer from path
  if (typeof next.kind !== 'string' || !REF_KINDS.has(next.kind)) {
    const p = typeof next.path === 'string' ? next.path : (typeof next.url === 'string' ? next.url : '');
    next.kind = /^https?:\/\//i.test(p) ? 'url' : 'file';
    changed = true;
  }

  // ensure `path` exists (a `url`-only ref maps url → path)
  if (typeof next.path !== 'string' && typeof next.url === 'string') {
    next.path = next.url;
    delete next.url;
    changed = true;
  }

  return { ref: next, changed };
}

/**
 * Normalize an array of exit gates / criteria in place-free fashion.
 * @returns {{ gates: Array<object>, changes: string[] }}
 */
function normalizeGates(gates, { nowIso, fallbackTs, label }) {
  const changes = [];
  if (!Array.isArray(gates)) return { gates, changes };
  const next = gates.map((gate) => {
    if (gate == null || typeof gate !== 'object') return gate;
    const mapped = normalizeGateStatus(gate.status);
    if (mapped === null) return gate;
    const id = gate.id || '(no id)';
    const repaired = { ...gate, status: mapped };
    if (mapped === 'met' && repaired.metAt === undefined) {
      repaired.metAt = fallbackTs || nowIso;
    }
    changes.push(`${label} ${id}: status "${gate.status}" → "${mapped}"`);
    return repaired;
  });
  return { gates: next, changes };
}

/**
 * Normalize a plan or initiative frontmatter object.
 * @param {Record<string, unknown>} entity
 * @param {{ nowIso: string }} opts
 * @returns {{ entity: Record<string, unknown>, changes: string[] }}
 */
export function normalizeEntity(entity, { nowIso, kind } = {}) {
  if (entity == null || typeof entity !== 'object') return { entity, changes: [] };
  const changes = [];
  const next = { ...entity };
  const resolvedKind = kind || inferKind(entity);
  const fallbackTs =
    typeof entity.lastUpdated === 'string' ? entity.lastUpdated
    : typeof entity.started === 'string' ? entity.started
    : nowIso;

  // Backfill missing required initiative fields (kind-gated: a plan is .strict()
  // and would reject an unknown `stack`/`tasks` key, so NEVER backfill plans).
  if (resolvedKind === 'initiative') {
    for (const [key, def] of Object.entries(INITIATIVE_DEFAULTS)) {
      if (next[key] === undefined) {
        next[key] = Array.isArray(def) ? [...def] : def;
        changes.push(`backfilled missing required field "${key}"`);
      }
    }
  }

  // Initiative: exitGates[]
  if (Array.isArray(next.exitGates)) {
    const { gates, changes: c } = normalizeGates(next.exitGates, { nowIso, fallbackTs, label: 'exitGate' });
    if (c.length) { next.exitGates = gates; changes.push(...c); }
  }

  // Plan: phases[].exitGate.criteria[]
  if (Array.isArray(next.phases)) {
    let phasesChanged = false;
    const phases = next.phases.map((phase) => {
      if (phase == null || typeof phase !== 'object') return phase;
      const gate = phase.exitGate;
      if (gate == null || typeof gate !== 'object' || !Array.isArray(gate.criteria)) return phase;
      const { gates, changes: c } = normalizeGates(gate.criteria, {
        nowIso, fallbackTs, label: `phase ${phase.id || '?'} criterion`,
      });
      if (!c.length) return phase;
      phasesChanged = true;
      changes.push(...c);
      return { ...phase, exitGate: { ...gate, criteria: gates } };
    });
    if (phasesChanged) next.phases = phases;
  }

  // references[] (plans and initiatives)
  if (Array.isArray(next.references)) {
    let refsChanged = false;
    const refs = next.references.map((ref, i) => {
      const { ref: r, changed } = normalizeReference(ref);
      if (changed) { refsChanged = true; changes.push(`references[${i}]: normalized → kind="${r.kind}"`); }
      return r;
    });
    if (refsChanged) next.references = refs;
  }

  return { entity: next, changes };
}

/**
 * Read a state file, normalize its frontmatter, write it back if changed.
 * @param {string} filePath
 * @param {{ nowIso?: string }} opts
 * @returns {{ filePath: string, changes: string[], error?: string }}
 */
export function normalizeFile(filePath, { nowIso } = {}) {
  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (err) {
    return { filePath, changes: [], error: `read failed: ${err.message}` };
  }
  const parsed = parseFrontmatter(raw);
  if (parsed.error) return { filePath, changes: [], error: parsed.error };

  // Kind from tree position — mirrors scripts/validate-state.js kindFromPath:
  // flat checks first (plans/initiatives), then the nested projects/<id>/<slug>/
  // layout (phases/*.md → initiative; plan.md under projects/ → plan).
  const norm = resolve(filePath).split('/');
  const baseName = norm[norm.length - 1];
  const kind = norm.includes('plans') ? 'plan'
    : norm.includes('initiatives') ? 'initiative'
    : norm.includes('phases') ? 'initiative'
    : (baseName === 'plan.md' && norm.includes('projects')) ? 'plan'
    : undefined;
  const { entity, changes } = normalizeEntity(parsed.frontmatter, {
    nowIso: nowIso || new Date().toISOString(),
    kind,
  });
  if (!changes.length) return { filePath, changes: [] };

  const yamlBlock = stringifyYaml(entity).replace(/\n$/, '');
  const body = parsed.body.length ? parsed.body.replace(/^\n/, '') : '';
  const rebuilt = `---\n${yamlBlock}\n---\n${body ? `\n${body}` : ''}`;
  writeFileSync(filePath, rebuilt.endsWith('\n') ? rebuilt : `${rebuilt}\n`);
  return { filePath, changes };
}

/**
 * Walk a `.atomic-skills/` directory (or a repo root containing one) and
 * normalize every plan + initiative, including archives.
 * @param {string} dir
 * @param {{ nowIso?: string }} opts
 * @returns {{ files: Array<{filePath:string,changes:string[],error?:string}>, totalChanges: number }}
 */
export function normalizeStateDir(dir, { nowIso } = {}) {
  const root = existsSync(join(dir, '.atomic-skills')) ? join(dir, '.atomic-skills') : dir;
  const targets = [];
  const collectMd = (base) => {
    if (!existsSync(base) || !statSync(base).isDirectory()) return;
    for (const entry of readdirSync(base)) {
      if (entry.endsWith('.md') && !entry.startsWith('.')) targets.push(join(base, entry));
    }
  };

  // Flat layout (legacy; live during the migration coexistence window).
  for (const sub of ['plans', 'initiatives']) {
    collectMd(join(root, sub));
    collectMd(join(root, sub, 'archive'));
  }

  // Nested layout: projects/<id>/<slug>/{plan.md, phases/*.md, phases/archive/*.md}.
  const projectsDir = join(root, 'projects');
  if (existsSync(projectsDir) && statSync(projectsDir).isDirectory()) {
    for (const projId of readdirSync(projectsDir)) {
      const projPath = join(projectsDir, projId);
      if (!statSync(projPath).isDirectory()) continue;
      for (const planSlug of readdirSync(projPath)) {
        const planPath = join(projPath, planSlug);
        if (!statSync(planPath).isDirectory()) continue;
        const planMd = join(planPath, 'plan.md');
        if (existsSync(planMd) && statSync(planMd).isFile()) targets.push(planMd);
        collectMd(join(planPath, 'phases'));
        collectMd(join(planPath, 'phases', 'archive'));
      }
    }
  }

  const files = [];
  let totalChanges = 0;
  for (const filePath of targets) {
    const result = normalizeFile(filePath, { nowIso });
    if (result.changes.length || result.error) files.push(result);
    totalChanges += result.changes.length;
  }
  return { files, totalChanges };
}

// CLI: node src/normalize.js [<dir>]   (defaults to ./.atomic-skills)
if (import.meta.url === `file://${process.argv[1]}`) {
  const target = resolve(process.argv[2] || process.cwd());
  const report = normalizeStateDir(target, {});
  if (!report.totalChanges) {
    console.log('✓ state already valid — no changes');
  } else {
    console.log(`✓ normalized ${report.files.length} file(s), ${report.totalChanges} change(s):`);
    for (const f of report.files) {
      if (f.error) { console.log(`  ✗ ${f.filePath}: ${f.error}`); continue; }
      console.log(`  • ${f.filePath}`);
      for (const c of f.changes) console.log(`      - ${c}`);
    }
  }
}
