/**
 * emit-focus.js — project the canonical `.atomic-skills/` state into a single
 * flat `focus.json` digest for external statusline consumers (claudebar).
 *
 * The consumer reads ONE file and never walks the YAML tree. This script is the
 * producer side of that contract (docs/design/statusline-focus-integration.md):
 *   plan · phase i/n · tasks done/total  + a `sources[]` block the consumer uses
 *   to detect staleness without re-deriving anything.
 *
 * Pure-read of the state (never mutates plan/phase files). The digest itself is
 * the only thing written, atomically (tmp + rename), and only when an
 * `.atomic-skills/` tree exists — a bare repo is a no-op.
 *
 * `done`/`total`/`gates` come from the precomputed rollups (compute-rollups.js);
 * `blocked` is counted from `tasks[]` (there is no rollup for it). `flags.drift`
 * is supplied by the caller (refresh-state may compute it); default false keeps
 * this script fast and dependency-light.
 *
 * CLI:  node scripts/emit-focus.js [<dir>]        (defaults to ./)
 */
import { readFileSync, writeFileSync, renameSync, existsSync, statSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, resolve, relative, basename, dirname } from 'node:path';
import { parseFrontmatter } from './validate-state.js';
import { getSpawnedFrom } from '../src/links-sidecar.js';

const SCHEMA_VERSION = '0.1';

/** Best-effort current git branch for a repo (null when detached / not a repo). */
function currentBranch(repoRoot) {
  try {
    const out = execSync('git symbolic-ref --short HEAD', {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim();
    return out && out !== 'HEAD' ? out : null;
  } catch {
    return null;
  }
}

/** Resolve { stateRoot: <.atomic-skills dir>, repoRoot: <its parent> } from a dir. */
function resolveRoots(dir) {
  const abs = resolve(dir);
  if (basename(abs) === '.atomic-skills') return { stateRoot: abs, repoRoot: dirname(abs) };
  const nested = join(abs, '.atomic-skills');
  if (existsSync(nested)) return { stateRoot: nested, repoRoot: abs };
  return { stateRoot: nested, repoRoot: abs }; // may not exist; callers guard on existsSync
}

function readFm(filePath) {
  let raw;
  try { raw = readFileSync(filePath, 'utf8'); } catch { return null; }
  const parsed = parseFrontmatter(raw);
  return parsed.error ? null : parsed.frontmatter;
}

/** Every `projects/<id>/<slug>/plan.md` with its parsed frontmatter + paths. */
function collectPlans(stateRoot) {
  const projectsDir = join(stateRoot, 'projects');
  if (!existsSync(projectsDir) || !statSync(projectsDir).isDirectory()) return [];
  const plans = [];
  for (const projId of readdirSync(projectsDir)) {
    const projPath = join(projectsDir, projId);
    if (!statSync(projPath).isDirectory()) continue;
    for (const planSlug of readdirSync(projPath)) {
      const planDir = join(projPath, planSlug);
      if (!statSync(planDir).isDirectory()) continue;
      const planFile = join(planDir, 'plan.md');
      if (!existsSync(planFile)) continue;
      const fm = readFm(planFile);
      // The fork parent/child edge lives in the plan's links.json sidecar (not the
      // aiDeck-facing frontmatter); a non-fork plan reads as null.
      if (fm) plans.push({ projId, planDir, planFile, fm, spawnedFrom: getSpawnedFrom(planDir) });
    }
  }
  return plans;
}

/** The phase initiative file matching plan.currentPhase, or null. */
function findPhaseInitiative(planDir, phaseId) {
  if (phaseId == null) return null;
  const phasesDir = join(planDir, 'phases');
  if (!existsSync(phasesDir) || !statSync(phasesDir).isDirectory()) return null;
  for (const entry of readdirSync(phasesDir)) {
    if (!entry.endsWith('.md') || entry.startsWith('.')) continue;
    const file = join(phasesDir, entry);
    const fm = readFm(file);
    if (fm && fm.phaseId === phaseId) return { file, fm };
  }
  return null;
}

/** A plan's explicit branch binding, or null when unset/empty. */
function branchOf(p) {
  return typeof p.fm.branch === 'string' && p.fm.branch ? p.fm.branch : null;
}

/** Active plans, most-recently-updated first. */
function recentFirst(plans) {
  return [...plans].sort(
    (a, b) => String(b.fm.lastUpdated || '').localeCompare(String(a.fm.lastUpdated || '')),
  );
}

/**
 * Pick the focus plan AND decide tree-relative ambiguity.
 *
 * "Focus" is a property of the current worktree, not a global count. A plan with
 * an explicit `branch:` claims ONLY that branch's tree; an unbranched plan claims
 * any tree. So in a properly-isolated worktree (each active plan owns a distinct
 * branch) exactly one plan claims the tree → no ambiguity. `ambiguous` (the `⧉`
 * marker) means >1 active plan competes for THIS tree — the drift the worktree
 * enforcer prevents. When the branch is unknown (detached HEAD / no git) branch
 * cannot disambiguate, so any >1 active plans are reported ambiguous.
 *
 * Focus precedence: exact branch-match > unbranched > any active (last resort);
 * ties broken by recency. Mirrors session-start.sh's branch-then-recency intent.
 *
 * Fork hierarchy (F4): a fork parent and its forked CHILD can both be active
 * claimers (parallel mode, or no branch context). That is a hierarchy, not the
 * multi-active drift the `⧉` marker warns about — a parent whose forked child is
 * also a claimer is "superseded": focus resolves to the child and ambiguity is
 * cleared. (The pause case already excludes the paused parent from `activePlans`.)
 */
function supersededParentSlugs(plans) {
  const present = new Set(plans.map((p) => p.fm?.slug).filter(Boolean));
  const superseded = new Set();
  for (const p of plans) {
    const parentSlug = p.spawnedFrom?.plan;
    if (parentSlug && present.has(parentSlug)) superseded.add(parentSlug);
  }
  return superseded;
}

function pickFocus(activePlans, branch) {
  let claimers;
  let pool;
  if (branch) {
    const exact = activePlans.filter((p) => branchOf(p) === branch);
    const unbranched = activePlans.filter((p) => branchOf(p) === null);
    claimers = [...exact, ...unbranched]; // a plan branched elsewhere does NOT claim this tree
    pool = exact.length ? exact : unbranched.length ? unbranched : activePlans;
  } else {
    claimers = activePlans; // no branch context → cannot disambiguate by tree
    pool = activePlans;
  }
  // F4: collapse fork parent→child pairs. A parent whose forked child is also a
  // claimer yields focus + the claim to the child (precedence by the parent/child
  // edge); the pair is one hierarchy, not two competitors.
  const superseded = supersededParentSlugs(claimers);
  const effClaimers = claimers.filter((p) => !superseded.has(p.fm?.slug));
  const effPool = pool.filter((p) => !superseded.has(p.fm?.slug));
  const plan = recentFirst(effPool.length ? effPool : pool)[0];
  return {
    plan,
    init: findPhaseInitiative(plan.planDir, plan.fm.currentPhase ?? null),
    ambiguous: effClaimers.length > 1,
  };
}

function phaseInfo(plan, init) {
  const phases = Array.isArray(plan.fm.phases) ? plan.fm.phases : [];
  const currentPhase = plan.fm.currentPhase ?? null;
  if (currentPhase == null) return null;
  const idx = phases.findIndex((ph) => ph && ph.id === currentPhase);
  const descriptor = idx >= 0 ? phases[idx] : null;
  return {
    id: currentPhase,
    slug: (init?.fm.slug ?? descriptor?.slug) || null,
    title: (init?.fm.title ?? descriptor?.title) || null,
    index: idx >= 0 ? idx + 1 : 1,
    total: phases.length,
    status: (init?.fm.status ?? descriptor?.status) || null,
  };
}

function taskCounts(init) {
  if (!init) return null;
  const fm = init.fm;
  const tasks = Array.isArray(fm.tasks) ? fm.tasks : [];
  const num = (v, fallback) => (typeof v === 'number' ? v : fallback);
  return {
    done: num(fm.tasksDone, tasks.filter((t) => t && t.status === 'done').length),
    total: num(fm.tasksTotal, tasks.length),
    blocked: tasks.filter((t) => t && t.status === 'blocked').length,
  };
}

function gateCounts(init) {
  if (!init) return null;
  const fm = init.fm;
  if (typeof fm.gatesMet !== 'number' && typeof fm.gatesTotal !== 'number') return null;
  return { met: fm.gatesMet || 0, total: fm.gatesTotal || 0 };
}

/** Build the focus digest object (pure; no I/O beyond reading state files).
 *  `branch` (when given) selects among multiple active plans; see pickFocus. */
export function buildFocusDigest(dir, { now = new Date().toISOString(), drift = false, branch = null } = {}) {
  const { stateRoot, repoRoot } = resolveRoots(dir);
  const rel = (abs) => relative(repoRoot, abs).split('\\').join('/');

  const empty = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: now,
    projectId: null,
    plan: null,
    phase: null,
    tasks: null,
    gates: null,
    nextAction: null,
    flags: { drift: false, multipleActivePlans: false },
    sources: [],
  };

  const plans = collectPlans(stateRoot);
  const activePlans = plans.filter((p) => p.fm.status === 'active');
  if (activePlans.length === 0) return empty;

  const { plan, init, ambiguous } = pickFocus(activePlans, branch);
  const sources = [{ path: rel(plan.planFile), lastUpdated: plan.fm.lastUpdated ?? null }];
  if (init) sources.push({ path: rel(init.file), lastUpdated: init.fm.lastUpdated ?? null });

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: now,
    projectId: plan.projId ?? null,
    plan: { slug: plan.fm.slug, title: plan.fm.title ?? plan.fm.slug, status: plan.fm.status },
    phase: phaseInfo(plan, init),
    tasks: taskCounts(init),
    gates: gateCounts(init),
    nextAction: (init?.fm.nextAction ?? null) || null,
    flags: { drift: Boolean(drift), multipleActivePlans: ambiguous },
    sources,
  };
}

/** Write `<stateRoot>/focus.json` atomically. No-op when no `.atomic-skills/` exists. */
export function emitFocus(dir, opts = {}) {
  const { stateRoot, repoRoot } = resolveRoots(dir);
  const branch = opts.branch !== undefined ? opts.branch : currentBranch(repoRoot);
  const digest = buildFocusDigest(dir, { ...opts, branch });
  if (!existsSync(stateRoot)) return { written: false, digest };
  const out = join(stateRoot, 'focus.json');
  const tmp = `${out}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(digest, null, 2)}\n`);
  renameSync(tmp, out);
  return { written: true, path: out, digest };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const target = resolve(process.argv[2] || process.cwd());
  const res = emitFocus(target);
  if (res.written) {
    const p = res.digest.plan;
    console.log(`emit-focus: ${res.path} → ${p ? `${p.slug} · ${res.digest.phase?.id ?? '—'}` : 'no active plan'}`);
  } else {
    console.log('emit-focus: no .atomic-skills/ tree — nothing to emit');
  }
}
