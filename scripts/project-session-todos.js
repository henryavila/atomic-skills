/**
 * project-session-todos.js — project the active (pickFocus) plan's phases into a
 * Grok session checklist payload for the session checklist tool (`todo_write`).
 *
 * Pure read of tree-relative `.atomic-skills/` state. Never writes plan/initiative
 * frontmatter, never touches `~/.grok/sessions`, never invents tasksDone/total for
 * descriptor-only phases. Contract: docs/kb/grok-phase-todo-projection.md.
 *
 * CLI:  node scripts/project-session-todos.js --json [repoRoot]
 *        → exit 0, prints `{ merge, todos: [{ id, content, status }] }`
 */
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, resolve, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from './validate-state.js';
import { getSpawnedFrom } from '../src/links-sidecar.js';

const EM_DASH = '—';

/** Best-effort current git branch (null when detached / not a repo). */
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

/** Resolve { stateRoot, repoRoot } from a dir (repo root or `.atomic-skills`). */
function resolveRoots(dir) {
  const abs = resolve(dir);
  if (basename(abs) === '.atomic-skills') return { stateRoot: abs, repoRoot: dirname(abs) };
  const nested = join(abs, '.atomic-skills');
  if (existsSync(nested)) return { stateRoot: nested, repoRoot: abs };
  return { stateRoot: nested, repoRoot: abs };
}

function readFm(filePath) {
  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
  const parsed = parseFrontmatter(raw);
  return parsed.error ? null : parsed.frontmatter;
}

function safeSpawnedFrom(planDir) {
  try {
    return getSpawnedFrom(planDir);
  } catch {
    return null;
  }
}

/**
 * Collect plans: nested `projects/<id>/<slug>/plan.md` first, then flat
 * `plans/*.md` (same C-4 coexistence as emit-focus).
 */
function collectPlans(stateRoot) {
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
        const fm = readFm(planFile);
        if (fm) {
          plans.push({
            projId,
            planDir,
            planFile,
            fm,
            spawnedFrom: safeSpawnedFrom(planDir),
            flat: false,
            stateRoot,
          });
        }
      }
    }
  }
  const flatPlansDir = join(stateRoot, 'plans');
  if (existsSync(flatPlansDir) && statSync(flatPlansDir).isDirectory()) {
    for (const entry of readdirSync(flatPlansDir)) {
      if (!entry.endsWith('.md') || entry.startsWith('.')) continue;
      const planFile = join(flatPlansDir, entry);
      const fm = readFm(planFile);
      if (fm) {
        plans.push({
          projId: '(flat)',
          planDir: null,
          planFile,
          fm,
          spawnedFrom: null,
          flat: true,
          stateRoot,
        });
      }
    }
  }
  return plans;
}

/** Phase initiative for phaseId, nested or flat (scoped by parentPlan/slug). */
function findPhaseInitiative(p, phaseId) {
  if (phaseId == null) return null;
  if (p.flat) {
    const initsDir = join(p.stateRoot, 'initiatives');
    if (!existsSync(initsDir) || !statSync(initsDir).isDirectory()) return null;
    for (const entry of readdirSync(initsDir)) {
      if (!entry.endsWith('.md') || entry.startsWith('.')) continue;
      const file = join(initsDir, entry);
      const fm = readFm(file);
      if (!fm) continue;
      const belongs = (fm.parentPlan ?? fm.slug) === p.fm.slug;
      if (belongs && fm.phaseId === phaseId) return { file, fm };
    }
    return null;
  }
  const phasesDir = join(p.planDir, 'phases');
  if (!existsSync(phasesDir) || !statSync(phasesDir).isDirectory()) return null;

  // Prefer active phases/*.md over archive when both exist; fall back to
  // phases/archive/*.md after phase-done (closed phases live under archive).
  const scanDir = (dir) => {
    if (!existsSync(dir) || !statSync(dir).isDirectory()) return null;
    for (const entry of readdirSync(dir)) {
      if (!entry.endsWith('.md') || entry.startsWith('.')) continue;
      const file = join(dir, entry);
      // Skip nested dirs at top-level (e.g. archive/ itself when scanning phases/).
      try {
        if (!statSync(file).isFile()) continue;
      } catch {
        continue;
      }
      const fm = readFm(file);
      if (fm && fm.phaseId === phaseId) return { file, fm };
    }
    return null;
  };

  return scanDir(phasesDir) ?? scanDir(join(phasesDir, 'archive'));
}

function branchOf(p) {
  return typeof p.fm.branch === 'string' && p.fm.branch ? p.fm.branch : null;
}

function planKey(p) {
  return `${p.projId} ${p.fm?.slug}`;
}

function recentFirst(plans) {
  return [...plans].sort((a, b) =>
    String(b.fm.lastUpdated || '').localeCompare(String(a.fm.lastUpdated || '')),
  );
}

function supersededParentSlugs(plans) {
  const present = new Set(plans.filter((p) => p.fm?.slug).map(planKey));
  const superseded = new Set();
  for (const p of plans) {
    const parentSlug = p.spawnedFrom?.plan;
    const parentKey = parentSlug ? `${p.projId} ${parentSlug}` : null;
    if (parentKey && present.has(parentKey)) superseded.add(parentKey);
  }
  return superseded;
}

/**
 * Tree-relative focus pick (mirrors emit-focus pickFocus).
 * @returns {{ plan: object|null, unclaimed: boolean }}
 */
function pickFocus(activePlans, branch) {
  if (!activePlans.length) return { plan: null, unclaimed: false };

  let pool;
  let claimers;
  if (branch) {
    const exact = activePlans.filter((p) => branchOf(p) === branch);
    const unbranched = activePlans.filter((p) => branchOf(p) === null);
    claimers = [...exact, ...unbranched];
    pool = exact.length ? exact : unbranched;
    if (pool.length === 0) return { plan: null, unclaimed: true };
  } else {
    claimers = activePlans;
    pool = activePlans;
  }

  const superseded = supersededParentSlugs(claimers);
  const survivors = claimers.filter((p) => !superseded.has(planKey(p)));
  if (survivors.length > 0 && survivors.length < claimers.length) {
    const survivorPool = pool.filter((p) => !superseded.has(planKey(p)));
    const plan = recentFirst(survivorPool.length ? survivorPool : survivors)[0];
    return { plan, unclaimed: false };
  }
  return { plan: recentFirst(pool)[0], unclaimed: false };
}

/**
 * Truncate a long goal for last-resort identity (descriptor missing title/summary).
 * @param {unknown} goal
 * @param {number} [max=80]
 */
export function truncateGoal(goal, max = 80) {
  if (typeof goal !== 'string' || !goal.trim()) return '';
  const t = goal.trim().replace(/\s+/g, ' ');
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/**
 * Rollups from a materialized initiative; null when descriptor-only (no invent).
 * @returns {{ done: number, total: number } | null}
 */
export function initiativeRollups(initFm) {
  if (!initFm || typeof initFm !== 'object') return null;
  const tasks = Array.isArray(initFm.tasks) ? initFm.tasks : [];
  const done =
    typeof initFm.tasksDone === 'number'
      ? initFm.tasksDone
      : tasks.filter((t) => t && t.status === 'done').length;
  const total = typeof initFm.tasksTotal === 'number' ? initFm.tasksTotal : tasks.length;
  // Initiative present ⇒ materialized. Prefer explicit rollups; else task counts.
  return { done, total };
}

/**
 * Canonical content label for one phase.
 * Materialized: `F0 (2/12) — <summary || title>`
 * Descriptor-only: `F2 (—) — <title> · not materialized`
 * Paused: append ` · paused` (after not-materialized when both).
 *
 * @param {object} phase - plan.phases[] descriptor
 * @param {object|null} initFm - initiative frontmatter when present
 * @param {{ paused?: boolean }} [opts]
 */
export function formatPhaseContent(phase, initFm, opts = {}) {
  const id = phase?.id != null ? String(phase.id) : '?';
  const rollups = initiativeRollups(initFm);
  const summary =
    (typeof initFm?.summary === 'string' && initFm.summary.trim()) ||
    (typeof phase?.summary === 'string' && phase.summary.trim()) ||
    '';
  const title =
    (typeof initFm?.title === 'string' && initFm.title.trim()) ||
    (typeof phase?.title === 'string' && phase.title.trim()) ||
    '';
  const goalFallback = truncateGoal(phase?.goal || initFm?.goal);

  let content;
  if (rollups) {
    const what = summary || title || goalFallback || id;
    content = `${id} (${rollups.done}/${rollups.total}) ${EM_DASH} ${what}`;
  } else {
    const what = title || summary || goalFallback || id;
    content = `${id} (${EM_DASH}) ${EM_DASH} ${what} · not materialized`;
  }
  if (opts.paused) content += ' · paused';
  return content;
}

/**
 * Status map with paused-first precedence. Only `currentPhaseId` is in_progress
 * (at most one), and only when that phase is not paused/done/archived.
 *
 * @param {object} phase
 * @param {string|null} currentPhaseId
 * @returns {{ status: 'pending'|'in_progress'|'completed', paused: boolean }}
 */
export function mapPhaseTodoStatus(phase, currentPhaseId) {
  const st = phase?.status;
  // Precedence: paused → done|archived → current/active → pending.
  // done|archived beats a stale currentPhase pointer so closed phases never
  // surface as in_progress. At most one in_progress: only plan.currentPhase.
  if (st === 'paused') return { status: 'pending', paused: true };
  if (st === 'done' || st === 'archived') return { status: 'completed', paused: false };
  if (currentPhaseId != null && phase?.id === currentPhaseId) {
    return { status: 'in_progress', paused: false };
  }
  // Non-current `active` (or any other open status) stays pending — only
  // currentPhase is in_progress.
  return { status: 'pending', paused: false };
}

/**
 * Stable session-todo id: `<planSlug>:<phaseId>`.
 * @param {string} planSlug
 * @param {string} phaseId
 */
export function stableTodoId(planSlug, phaseId) {
  return `${planSlug}:${phaseId}`;
}

/**
 * Build one session todo for a phase descriptor + optional initiative.
 * @param {string} planSlug
 * @param {object} phase
 * @param {object|null} init
 * @param {string|null} currentPhaseId
 */
export function buildPhaseTodo(planSlug, phase, init, currentPhaseId) {
  const { status, paused } = mapPhaseTodoStatus(phase, currentPhaseId);
  return {
    id: stableTodoId(planSlug, phase.id),
    content: formatPhaseContent(phase, init?.fm ?? null, { paused }),
    status,
  };
}

/**
 * Project pickFocus plan phases → session checklist payload.
 * Empty focus / no winner → `{ merge: true, todos: [] }` (no-op apply; do not
 * full-replace wipe the board). Anchored plan reseed → `merge: false` + one
 * todo per phase.
 *
 * @param {string} dir - repo root or `.atomic-skills` path
 * @param {{ branch?: string|null }} [opts] - branch for tree-relative pick; omit to auto-detect
 * @returns {{ merge: boolean, todos: Array<{ id: string, content: string, status: string }> }}
 */
export function buildSessionTodos(dir, opts = {}) {
  // merge:true + empty todos = no-op for todo_write (no id updates, no wipe).
  const empty = { merge: true, todos: [] };
  const { stateRoot, repoRoot } = resolveRoots(dir);
  if (!existsSync(stateRoot)) return empty;

  const branch = opts.branch !== undefined ? opts.branch : currentBranch(repoRoot);
  const plans = collectPlans(stateRoot);
  const activePlans = plans.filter((p) => p.fm.status === 'active');
  if (activePlans.length === 0) return empty;

  const { plan, unclaimed } = pickFocus(activePlans, branch);
  if (!plan || unclaimed) return empty;

  const planSlug = plan.fm.slug;
  const currentPhaseId = plan.fm.currentPhase ?? null;
  const phases = Array.isArray(plan.fm.phases) ? plan.fm.phases.filter((ph) => ph && ph.id) : [];

  const todos = phases.map((phase) => {
    const init = findPhaseInitiative(plan, phase.id);
    return buildPhaseTodo(planSlug, phase, init, currentPhaseId);
  });

  // Enforce single in_progress (defensive): keep first, demote rest to pending.
  let sawInProgress = false;
  for (const t of todos) {
    if (t.status === 'in_progress') {
      if (sawInProgress) t.status = 'pending';
      else sawInProgress = true;
    }
  }

  return { merge: false, todos };
}

/**
 * CLI: parse `--json [repoRoot]` and print payload.
 * @param {string[]} argv
 * @returns {{ ok: boolean, payload?: object, error?: string, exitCode: number }}
 */
export function runCli(argv = process.argv.slice(2)) {
  const args = [...argv];
  let json = false;
  let target = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') {
      json = true;
      const next = args[i + 1];
      if (next && !next.startsWith('-')) {
        target = next;
        i += 1;
      }
      continue;
    }
    if (a === '--help' || a === '-h') {
      return {
        ok: true,
        payload: null,
        help: 'Usage: node scripts/project-session-todos.js --json [repoRoot]\n',
        exitCode: 0,
      };
    }
    if (!a.startsWith('-') && target == null) {
      target = a;
    }
  }
  if (!json) {
    return {
      ok: false,
      error: 'Usage: node scripts/project-session-todos.js --json [repoRoot]\n',
      exitCode: 2,
    };
  }
  const dir = resolve(target || process.cwd());
  const payload = buildSessionTodos(dir);
  return { ok: true, payload, exitCode: 0 };
}

function isMain() {
  const entry = process.argv[1] && resolve(process.argv[1]);
  const self = resolve(fileURLToPath(import.meta.url));
  return entry === self;
}

if (isMain()) {
  const result = runCli();
  if (result.help) {
    process.stdout.write(result.help);
    process.exit(result.exitCode);
  }
  if (!result.ok) {
    process.stderr.write(result.error || 'error\n');
    process.exit(result.exitCode);
  }
  process.stdout.write(`${JSON.stringify(result.payload)}\n`);
  process.exit(0);
}
