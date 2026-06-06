#!/usr/bin/env node
/**
 * detect-completion.js — deterministic, zero-token DETECTOR of completion drift:
 * `.atomic-skills/` entries (tasks + exit-criteria) that look DONE in the repo
 * but are still OPEN in state.
 *
 * This is the single source of "what looks done but isn't marked" (Spec 1,
 * Component A). It replaces the scattered, brittle heuristics in both hooks
 * (session-start.sh §6 `[T-NNN]` commit scan; stop.sh ad-hoc `outputs[].path`
 * scan) with one shared, deterministic detector the hooks AND commands all call.
 *
 * A completion signal is NOT a verifier's existence. A `verifier:` is written
 * BEFORE any work starts; its mere presence says nothing about whether the work
 * is done — it is the CLOSING mechanism (used at `reconcile` time), never a
 * DETECTION signal. Detection keys only on evidence that the deliverable
 * CHANGED. Per non-done task and per pending exit-criterion (strongest first):
 *
 *   output-exists  (strong)    — a path in the entry's structured `outputs[].path`
 *                                exists on disk AND its last commit (git-mtime),
 *                                or its filesystem mtime if uncommitted, is newer
 *                                than the entry's anchor timestamp. ONLY
 *                                `outputs[].path` — never free-text `acceptance[]`
 *                                prose (unparseable, false-positive prone; F-006).
 *   commit-ref     (heuristic) — a commit after the entry's anchor whose message
 *                                contains the EXACT entry id (e.g. `T-003`, with a
 *                                token boundary so `T-0030` does not match) OR
 *                                touches an EXACT declared `outputs[].path`. No
 *                                title-token / substring matching.
 *   none                       — no signal; the entry is left untouched, not
 *                                surfaced. A verifier's presence ALONE never
 *                                produces a candidate (F-001).
 *
 * The detector is PURE READ: it never mutates state and NEVER runs a verifier
 * (running one is intrusive and belongs to the `reconcile` closing path). It
 * exits non-zero when drift is found (composes into scripts/CI the way
 * find-missing-summaries.js does), and is FAIL-OPEN by construction — a missing
 * git repo / unreadable file degrades to "no signal", never an exception that
 * blocks a hook.
 *
 * CLI:
 *   node scripts/detect-completion.js [<dir>] [--project <id>] [--slug <slug>]
 *        [--plan <plan-slug>] [--json]
 *
 * Project resolution is nested-first (the same way the router/hooks resolve the
 * active project). `--project` disambiguates when more than one project holds a
 * plan with the same slug (a plan-slug is unique only WITHIN a project folder).
 *
 * Exit codes: 0 — no drift; 1 — drift found; 2 — bad args.
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseFrontmatter } from './validate-state.js';

const GIT_LOG_CAP = 50; // bound git log per entry (Spec §4 Performance).

function fmOf(filePath) {
  try {
    const parsed = parseFrontmatter(readFileSync(filePath, 'utf8'));
    return parsed.error ? null : parsed.frontmatter;
  } catch {
    return null;
  }
}

const hasText = (v) => typeof v === 'string' && v.trim().length > 0;

/** Resolve the state root (`<dir>/.atomic-skills` if present, else `<dir>`). */
function stateRootOf(dir) {
  return existsSync(join(dir, '.atomic-skills')) ? join(dir, '.atomic-skills') : dir;
}

/** The repo working tree that holds the state — where `outputs[].path` resolve
 *  and where git runs. When the state root IS `.atomic-skills`, the repo is its
 *  parent; otherwise the given dir is treated as the repo root too. */
function repoRootOf(stateRoot, dir) {
  return basename(stateRoot) === '.atomic-skills' ? dirname(stateRoot) : dir;
}

// --- git helpers (all fail-soft → null/[] so the detector stays fail-open) ---

function git(repoRoot, args) {
  try {
    return execFileSync('git', ['-C', repoRoot, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    return null;
  }
}

/** ISO commit date of the LAST commit that touched `path`, or null if none. */
function lastCommitDateForPath(repoRoot, path) {
  const out = git(repoRoot, ['log', '-1', '--format=%cI', '--', path]);
  const v = out == null ? '' : out.trim();
  return v.length ? v : null;
}

/** Commits with committer-date strictly after `sinceIso`, capped. Returns
 *  [{ sha, subject }]. A unit separator (\x1f) splits sha|subject so a subject
 *  containing spaces is preserved intact. */
function commitsSince(repoRoot, sinceIso, limit = GIT_LOG_CAP) {
  if (!hasText(sinceIso)) return [];
  const out = git(repoRoot, ['log', `-n`, String(limit), `--since=${sinceIso}`, '--format=%H%x1f%s']);
  if (out == null) return [];
  const commits = [];
  for (const line of out.split('\n')) {
    if (!line) continue;
    const sepIdx = line.indexOf('\x1f');
    if (sepIdx === -1) continue;
    commits.push({ sha: line.slice(0, sepIdx), subject: line.slice(sepIdx + 1) });
  }
  return commits;
}

/** SHAs of commits after `sinceIso` that touched `path`, capped. */
function commitsTouchingPathSince(repoRoot, path, sinceIso, limit = GIT_LOG_CAP) {
  if (!hasText(sinceIso)) return [];
  const out = git(repoRoot, ['log', `-n`, String(limit), `--since=${sinceIso}`, '--format=%H', '--', path]);
  if (out == null) return [];
  return out.split('\n').filter(Boolean);
}

/** Filesystem mtime of a repo path as ISO, or null if it does not exist. */
function fsMtimeIso(repoRoot, path) {
  try {
    return statSync(join(repoRoot, path)).mtime.toISOString();
  } catch {
    return null;
  }
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Exact-id matcher: matches `T-003` but not `T-0030` / `xT-003` — a token
 *  boundary that treats word chars, digits and `-` as "inside the token". */
function idInSubject(id, subject) {
  if (!hasText(id) || typeof subject !== 'string') return false;
  const re = new RegExp(`(?<![A-Za-z0-9-])${escapeRe(id)}(?![A-Za-z0-9-])`);
  return re.test(subject);
}

/** The structured output paths of an entry — ONLY `outputs[].path` strings
 *  (Component A: never `acceptance[]` prose). */
function outputPathsOf(entry) {
  if (!entry || !Array.isArray(entry.outputs)) return [];
  return entry.outputs
    .filter((o) => o && typeof o === 'object' && hasText(o.path))
    .map((o) => o.path);
}

/**
 * Classify ONE entry (task or criterion) by completion signal. Pure read +
 * bounded git. `anchorTs` is the entry's lastUpdated/started (falling back to
 * the container's), used as the "after which a signal counts" cutoff.
 *
 * Returns { evidence, paths?, commit? }. evidence is 'output-exists' (strong),
 * 'commit-ref' (heuristic) or 'none' (not surfaced).
 */
export function classifyEntry({ id, anchorTs, outputs, repoRoot }) {
  const paths = outputPathsOf({ outputs });

  // 1. output-exists (strong): a declared output that exists on disk AND
  //    changed (committed or fs-touched) after the entry's anchor.
  const changedPaths = [];
  for (const p of paths) {
    if (!existsSync(join(repoRoot, p))) continue;
    const changedAt = lastCommitDateForPath(repoRoot, p) || fsMtimeIso(repoRoot, p);
    if (changedAt && hasText(anchorTs) && changedAt > anchorTs) changedPaths.push(p);
  }
  if (changedPaths.length) return { evidence: 'output-exists', paths: changedPaths };

  // 2. commit-ref (heuristic): a commit after the anchor that names the exact id
  //    OR touches an exact declared output path.
  const idHit = commitsSince(repoRoot, anchorTs).find((c) => idInSubject(id, c.subject));
  if (idHit) return { evidence: 'commit-ref', commit: idHit.sha };
  for (const p of paths) {
    const shas = commitsTouchingPathSince(repoRoot, p, anchorTs);
    if (shas.length) return { evidence: 'commit-ref', commit: shas[0], paths: [p] };
  }

  return { evidence: 'none' };
}

// --- project / initiative resolution (nested-first, flat-fallback) ----------

/**
 * Enumerate every plan across both layouts as
 * { projectId, planSlug, planFile, planFm, phasesDir }.
 * Nested `projects/<id>/<slug>/plan.md` first, then flat `plans/<slug>.md`.
 */
function listPlans(stateRoot) {
  const plans = [];
  const projectsDir = join(stateRoot, 'projects');
  if (existsSync(projectsDir) && statSync(projectsDir).isDirectory()) {
    for (const projId of readdirSync(projectsDir)) {
      const projPath = join(projectsDir, projId);
      if (!statSync(projPath).isDirectory()) continue;
      for (const planSlug of readdirSync(projPath)) {
        const planDir = join(projPath, planSlug);
        if (!statSync(planDir).isDirectory()) continue;
        const planFile = join(planDir, 'plan.md');
        if (!existsSync(planFile)) continue;
        const planFm = fmOf(planFile);
        if (!planFm) continue;
        plans.push({ projectId: projId, planSlug, planFile, planFm, phasesDir: join(planDir, 'phases') });
      }
    }
  }
  const flatPlans = join(stateRoot, 'plans');
  if (existsSync(flatPlans) && statSync(flatPlans).isDirectory()) {
    for (const entry of readdirSync(flatPlans)) {
      if (!entry.endsWith('.md') || entry.startsWith('.') || entry.endsWith('.rendered.md')) continue;
      const planFile = join(flatPlans, entry);
      const planFm = fmOf(planFile);
      if (!planFm) continue;
      plans.push({ projectId: '(flat)', planSlug: entry.replace(/\.md$/, ''), planFile, planFm, phasesDir: join(stateRoot, 'initiatives') });
    }
  }
  return plans;
}

/** Phase-initiative files for a plan, as { file, fm }. */
function listInitiativesForPlan(plan) {
  const inits = [];
  const dir = plan.phasesDir;
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return inits;
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith('.md') || entry.startsWith('.') || entry.endsWith('.rendered.md')) continue;
    const file = join(dir, entry);
    const fm = fmOf(file);
    if (!fm) continue;
    // Flat `initiatives/` is shared across flat plans — keep only matching parentPlan.
    if (plan.projectId === '(flat)' && fm.parentPlan && fm.parentPlan !== plan.planSlug) continue;
    inits.push({ file, fm });
  }
  return inits;
}

/**
 * Resolve which initiatives to scan, honoring --project / --slug / --plan.
 * Default (no widening flag): the SINGLE active initiative of the active project.
 * Returns [{ projectId, initiativePath, fm, planFm }].
 */
export function resolveTargets(stateRoot, opts = {}) {
  let plans = listPlans(stateRoot);
  if (opts.project) plans = plans.filter((p) => p.projectId === opts.project);
  if (opts.plan) plans = plans.filter((p) => p.planSlug === opts.plan);
  if (!plans.length) return [];

  // --plan widens to ALL initiatives of the matched plan(s).
  if (opts.plan) {
    const targets = [];
    for (const plan of plans) {
      for (const init of listInitiativesForPlan(plan)) {
        targets.push({ projectId: plan.projectId, initiativePath: init.file, fm: init.fm, planFm: plan.planFm });
      }
    }
    return targets;
  }

  // --slug widens to the one initiative with that slug, anywhere in the resolved project(s).
  if (opts.slug) {
    const targets = [];
    for (const plan of plans) {
      for (const init of listInitiativesForPlan(plan)) {
        if (init.fm.slug === opts.slug) {
          targets.push({ projectId: plan.projectId, initiativePath: init.file, fm: init.fm, planFm: plan.planFm });
        }
      }
    }
    return targets;
  }

  // Default: the active initiative of the active plan. Among active plans pick the
  // most-recently-updated (deterministic; mirrors the SessionStart hook), then its
  // currentPhase initiative (status active), else the first active initiative.
  const activePlans = plans.filter((p) => p.planFm.status === 'active');
  const pool = activePlans.length ? activePlans : plans;
  pool.sort((a, b) => String(b.planFm.lastUpdated || '').localeCompare(String(a.planFm.lastUpdated || ''))
    || a.planFile.localeCompare(b.planFile));
  const primary = pool[0];
  const inits = listInitiativesForPlan(primary);
  const activeInits = inits.filter((i) => i.fm.status === 'active');
  const byCurrentPhase = activeInits.find((i) => primary.planFm.currentPhase && i.fm.phaseId === primary.planFm.currentPhase);
  const chosen = byCurrentPhase || activeInits[0] || inits[0];
  if (!chosen) return [];
  return [{ projectId: primary.projectId, initiativePath: chosen.file, fm: chosen.fm, planFm: primary.planFm }];
}

const OPEN_TASK = new Set(['pending', 'active', 'blocked']); // `blocked` is unfinished work.

/**
 * Scan one resolved initiative and return its candidates (open tasks + pending
 * exit-criteria that carry a completion signal). Pure read + bounded git.
 */
function scanInitiative(target, repoRoot) {
  const { fm, projectId, initiativePath } = target;
  const candidates = [];
  const initAnchor = fm.lastUpdated || fm.started;

  for (const task of Array.isArray(fm.tasks) ? fm.tasks : []) {
    if (!task || typeof task !== 'object') continue;
    if (!OPEN_TASK.has(task.status)) continue; // skip done (and any non-open)
    const anchorTs = task.lastUpdated || initAnchor;
    const sig = classifyEntry({ id: task.id, anchorTs, outputs: task.outputs, repoRoot });
    if (sig.evidence === 'none') continue;
    const c = { kind: 'task', id: String(task.id ?? '?'), title: String(task.title ?? ''),
      projectId, initiativePath, evidence: sig.evidence, hasVerifier: !!task.verifier };
    if (sig.paths) c.paths = sig.paths;
    if (sig.commit) c.commit = sig.commit;
    if (task.verifier) c.verifier = task.verifier;
    candidates.push(c);
  }

  for (const crit of Array.isArray(fm.exitGates) ? fm.exitGates : []) {
    if (!crit || typeof crit !== 'object') continue;
    if (crit.status !== 'pending') continue; // met / deferred are resolved
    const sig = classifyEntry({ id: crit.id, anchorTs: initAnchor, outputs: crit.outputs, repoRoot });
    if (sig.evidence === 'none') continue;
    const c = { kind: 'criterion', id: String(crit.id ?? '?'), description: String(crit.description ?? ''),
      projectId, initiativePath, evidence: sig.evidence, hasVerifier: !!crit.verifier };
    if (sig.paths) c.paths = sig.paths;
    if (sig.commit) c.commit = sig.commit;
    if (crit.verifier) c.verifier = crit.verifier;
    candidates.push(c);
  }

  return candidates;
}

/**
 * Top-level detection. Returns
 * { projectId, initiative, initiativePath, candidates[], drift }.
 * `drift` is true iff any candidate exists. Never mutates; never runs a verifier.
 */
export function detectCompletion(dir, opts = {}) {
  const stateRoot = stateRootOf(dir);
  const repoRoot = repoRootOf(stateRoot, dir);
  const targets = resolveTargets(stateRoot, opts);

  const candidates = [];
  for (const t of targets) candidates.push(...scanInitiative(t, repoRoot));

  const primary = targets[0] || null;
  return {
    projectId: primary ? primary.projectId : null,
    initiative: primary ? (primary.fm.slug || null) : null,
    initiativePath: primary ? primary.initiativePath : null,
    candidates,
    drift: candidates.length > 0,
  };
}

// --- CLI --------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { dir: null, project: null, slug: null, plan: null, json: false };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--json') opts.json = true;
    else if (a === '--project') opts.project = rest[++i];
    else if (a === '--slug') opts.slug = rest[++i];
    else if (a === '--plan') opts.plan = rest[++i];
    else if (a === '--help' || a === '-h') {
      console.log('Usage: detect-completion.js [<dir>] [--project <id>] [--slug <slug>] [--plan <plan-slug>] [--json]');
      process.exit(0);
    } else if (a.startsWith('--')) {
      console.error(`Unknown arg: ${a}`);
      process.exit(2);
    } else if (opts.dir == null) opts.dir = a;
    else {
      console.error(`Unexpected arg: ${a}`);
      process.exit(2);
    }
  }
  return opts;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const opts = parseArgs(process.argv);
  const dir = resolve(opts.dir || process.cwd());
  const result = detectCompletion(dir, { project: opts.project, slug: opts.slug, plan: opts.plan });

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.drift ? 1 : 0);
  }

  if (!result.drift) {
    console.log('detect-completion: no completion drift — open entries carry no done-signal ✓');
    process.exit(0);
  }
  const n = result.candidates.length;
  console.log(`detect-completion: ${n} entr${n === 1 ? 'y' : 'ies'} look done in the repo but are still open:`);
  for (const c of result.candidates) {
    const label = c.kind === 'task' ? c.title : c.description;
    const via = c.evidence === 'output-exists' ? `outputs: ${(c.paths || []).join(', ')}` : `commit ${(c.commit || '').slice(0, 8)}`;
    const close = c.hasVerifier ? 'run verifier' : 'manual ack';
    console.log(`  ${c.kind} ${c.id} "${label}" — ${c.evidence} (${via}) → ${close}`);
  }
  console.log('\nRun `atomic-skills:project reconcile` to dispose each (verifier-aware; never auto-closed).');
  process.exit(1);
}
