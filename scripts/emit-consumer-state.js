/**
 * emit-consumer-state.js — emit the denormalized `state/*.json` projection the
 * aiDeck v0.1 manifest binds to.
 *
 * WHY: the aiDeck v0.1 engine computes counts/ratios/sums at read time
 * (`source: { agg, where, of }`) and does array-membership filters
 * (`status: [active, paused]`), so we no longer precompute totals or status
 * bucket booleans here. What we STILL emit is what aiDeck CANNOT derive: per-
 * record rollups (focusTasksPct, currentPhaseText, mode, activeCount, …),
 * cross-collection/relationship fields (no join engine) and the boolean flags
 * (blocked) the aggregates scope on. Contract: the engine handoff
 * /home/henry/aideck/docs/handoffs/to-atomic-skills-v2-engine-contracts.md (§B2).
 *
 * WHERE: into the repo tree under `.atomic-skills/.aideck/state/` so the source
 * is declared `root: project` and the watcher keeps SSE live-refresh (a
 * consumer-dir file is read but never watched). aiDeck never writes these — the
 * skill owns them as a regenerable canonical projection (Iron Law ✓).
 *
 * SHAPE: each file is a BARE top-level JSON array of records (aiDeck's
 * normalizeToRecords turns an array → records; an envelope `{records:[]}`
 * collapses to one bogus record). No `schema:` in the manifest — schemas live
 * as files validated by `aideck validate` in CI.
 *
 * Outputs (under <root>/.aideck/state/):
 *   plans.json · phases.json · initiatives.json · tasks.json · gates.json
 *   phaseGates.json · stack.json · parked.json · emerged.json · projects.json
 *   burnup.json · spi.json
 *   (totals.json retired — the 4 Panorama totals are read-time source.agg now.)
 *
 * CLI:  node scripts/emit-consumer-state.js [<dir>] [--now <iso>]
 *       (<dir> defaults to ./ ; resolves its .atomic-skills/ tree)
 */

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseFrontmatter } from './validate-state.js';
import { verifierLabelFor, evidenceSummaryFor } from './compute-rollups.js';

const STATE_DIRNAME = join('.aideck', 'state');

// Concluded statuses — used for the per-project `concludedCount` rollup (a
// derived scalar the engine can't compute). Status *filtering* in the manifest
// now uses array membership (status: [done, archived]) directly.
const CONCLUDED = new Set(['done', 'archived']);

// ── small pure helpers ──────────────────────────────────────────────────────

/** Humanize a projectId slug → a display title ("atomic-skills" → "Atomic Skills"). */
export function humanizeId(id) {
  return String(id || '')
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ') || String(id || '');
}

/** ISO/space timestamp → compact relative age vs `nowMs` ("3h" / "2d" / "5mo"). */
export function relTime(ts, nowMs) {
  const t = Date.parse(String(ts || ''));
  if (Number.isNaN(t)) return '';
  const sec = Math.max(0, Math.round((nowMs - t) / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.round(mo / 12)}y`;
}

const arr = (v) => (Array.isArray(v) ? v : []);
const weightOf = (t) => (Number.isFinite(t?.weight) && t.weight >= 0 ? t.weight : 1);
const eventWeightOf = (e) => (Number.isFinite(e?.weight) && e.weight >= 0 ? e.weight : 0);
const finiteOrNull = (v) => (Number.isFinite(v) ? v : null);
const clamp01 = (v) => Math.min(1, Math.max(0, v));

// ── tree walk ───────────────────────────────────────────────────────────────

/**
 * Read every `projects/<projectId>/<planSlug>/plan.md` (+ its `phases/*.md`
 * initiatives, incl. archive) under a `.atomic-skills/` root. Returns the raw
 * parsed frontmatter tagged with its path captures — the join key for the
 * denormalization below.
 */
export function readTree(root) {
  const out = { plans: [], initiatives: [] };
  const projectsDir = join(root, 'projects');
  if (!existsSync(projectsDir) || !statSync(projectsDir).isDirectory()) return out;

  for (const projectId of readdirSync(projectsDir).sort()) {
    const projPath = join(projectsDir, projectId);
    if (!statSync(projPath).isDirectory()) continue;
    for (const planSlug of readdirSync(projPath).sort()) {
      const planPath = join(projPath, planSlug);
      if (!statSync(planPath).isDirectory()) continue;
      const planFile = join(planPath, 'plan.md');
      if (existsSync(planFile)) {
        const parsed = parseFrontmatter(readFileSync(planFile, 'utf8'));
        if (!parsed.error && parsed.frontmatter) {
          out.plans.push({ projectId, planSlug, fm: parsed.frontmatter });
        }
      }
      for (const sub of [join(planPath, 'phases'), join(planPath, 'phases', 'archive')]) {
        if (!existsSync(sub) || !statSync(sub).isDirectory()) continue;
        for (const entry of readdirSync(sub).sort()) {
          if (!entry.endsWith('.md') || entry.startsWith('.')) continue;
          const parsed = parseFrontmatter(readFileSync(join(sub, entry), 'utf8'));
          if (!parsed.error && parsed.frontmatter) {
            out.initiatives.push({ projectId, planSlug, fm: parsed.frontmatter });
          }
        }
      }
    }
  }
  return out;
}

// ── denormalization + derived fields ────────────────────────────────────────

/**
 * Build the flat record arrays + precomputed fields from the parsed tree.
 * Pure: takes the readTree() output + a fixed `nowMs` (so output is
 * deterministic in tests). Emits per-record derived fields (rollups,
 * relationship/flag fields) the engine can't compute; counts/ratios and status
 * filtering are left to the manifest's read-time source.agg / array filters.
 */
export function buildState(tree, nowMs) {
  // index initiatives by (projectId, planSlug, phaseId) for plan↔phase joins
  const initByPhase = new Map();
  for (const it of tree.initiatives) {
    const key = `${it.projectId}\u0000${it.planSlug}\u0000${it.fm.phaseId}`;
    initByPhase.set(key, it.fm);
  }
  const initFor = (projectId, planSlug, phaseId) =>
    initByPhase.get(`${projectId}\u0000${planSlug}\u0000${phaseId}`) || null;

  const plans = [];
  const phases = [];
  const initiatives = [];
  const tasks = [];
  const gates = [];
  const phaseGates = [];
  const stack = [];
  const parked = [];
  const emerged = [];

  for (const { projectId, planSlug, fm } of tree.plans) {
    const planPhases = arr(fm.phases);
    const phasesTotal = planPhases.length;
    const phasesDone = planPhases.filter((p) => p && p.status === 'done').length;
    const phasesActive = planPhases.filter((p) => p && p.status === 'active').length;
    const curPhase = planPhases.find((p) => p && p.id === fm.currentPhase) || null;
    const curInit = initFor(projectId, planSlug, fm.currentPhase);

    const tDone = curInit ? Number(curInit.tasksDone || 0) : 0;
    const tTotal = curInit ? Number(curInit.tasksTotal || 0) : 0;
    const gMet = curInit ? Number(curInit.gatesMet || 0) : 0;
    const gTotal = curInit ? Number(curInit.gatesTotal || 0) : 0;
    const stackLen = curInit ? arr(curInit.stack).length : 0;

    plans.push({
      projectId,
      slug: planSlug,
      title: fm.title || planSlug,
      status: fm.status || 'pending',
      branch: fm.branch || '',
      started: fm.started || '',
      lastUpdated: fm.lastUpdated || '',
      currentPhase: fm.currentPhase || '',
      // derived text the widgets render directly
      currentPhaseText: curPhase ? curPhase.title : fm.currentPhase || '',
      phasesText: `${phasesDone}/${phasesTotal} fases`,
      phasesSummary: `${phasesDone}/${phasesTotal} fases`,
      roteiroSub: `${phasesDone}/${phasesTotal} fases concluídas`,
      switcherCaption: `${fm.status || ''} · ${curPhase ? curPhase.title : fm.currentPhase || ''}`.trim(),
      nextText: curInit ? curInit.nextAction || curInit.summary || '' : curPhase ? curPhase.summary || '' : '',
      focusTasksText: `${tDone}/${tTotal}`,
      focusTasksPct: tTotal > 0 ? Math.round((100 * tDone) / tTotal) : 0,
      focusMeta: `gates ${gMet}/${gTotal} · ${stackLen} frame${stackLen === 1 ? '' : 's'}`,
      updatedRel: relTime(fm.lastUpdated, nowMs),
    });

    planPhases.forEach((p, i) => {
      if (!p || typeof p !== 'object') return;
      const init = initFor(projectId, planSlug, p.id);
      const pdone = init ? Number(init.tasksDone || 0) : 0;
      const ptot = init ? Number(init.tasksTotal || 0) : 0;
      phases.push({
        projectId,
        planSlug,
        planTitle: fm.title || planSlug,
        id: p.id,
        slug: p.slug || p.id,
        title: p.title || p.id,
        status: p.status || 'pending',
        dependsOn: arr(p.dependsOn),
        summary: p.summary || '',
        index: i,
        isCurrent: p.id === fm.currentPhase,
        tasksText: `${pdone}/${ptot}`,
      });

      // Plan-phase exit-gate criteria are a SEPARATE gate set from the
      // initiative's exitGates (both exist in the data). The handlers
      // (verify_exit_gate plan+phase branch, health) need them flat.
      for (const c of arr(p.exitGate && p.exitGate.criteria)) {
        if (!c || typeof c !== 'object') continue;
        phaseGates.push({
          projectId,
          planSlug,
          phaseId: p.id,
          id: c.id,
          description: c.description || '',
          status: c.status || 'pending',
          verifierLabel: verifierLabelFor(c),
          evidenceSummary: evidenceSummaryFor(c),
        });
      }
    });
  }

  for (const { projectId, planSlug, fm } of tree.initiatives) {
    const slug = fm.slug || '';
    const tDone = Number(fm.tasksDone || 0);
    const tTotal = Number(fm.tasksTotal || 0);
    const wDone = Number(fm.weightDone ?? tDone);
    const wTotal = Number(fm.weightTotal ?? tTotal);
    const gMet = Number(fm.gatesMet || 0);
    const gTotal = Number(fm.gatesTotal || 0);
    const stackLen = arr(fm.stack).length;

    initiatives.push({
      projectId,
      planSlug,
      slug,
      title: fm.title || slug,
      status: fm.status || 'pending',
      phaseId: fm.phaseId || '',
      parentPlan: fm.parentPlan || planSlug,
      planTitle: fm.planTitle || '',
      planActive: fm.planActive === true,
      current: fm.current === true,
      lastUpdated: fm.lastUpdated || '',
      // A done/archived phase has no "próxima ação" — clear it so the detail
      // card's PRÓXIMA AÇÃO callout collapses away instead of showing a stale,
      // already-completed action.
      nextText: (fm.status === 'done' || fm.status === 'archived') ? '' : (fm.nextAction || ''),
      summary: fm.summary || '',
      tasksDone: tDone,
      tasksTotal: tTotal,
      weightDone: wDone,
      weightTotal: wTotal,
      gatesMet: gMet,
      gatesTotal: gTotal,
      tasksText: `${tDone}/${tTotal}`,
      gatesText: `${gMet}/${gTotal}`,
      stackText: `${stackLen} frame${stackLen === 1 ? '' : 's'}`,
      selectedPhaseLabel: `${fm.phaseId || ''} · ${fm.status === 'active' ? 'fase atual' : fm.status || ''}`.trim(),
    });

    for (const t of arr(fm.tasks)) {
      if (!t || typeof t !== 'object') continue;
      const blockedBy = arr(t.blockedBy);
      tasks.push({
        projectId,
        planSlug,
        initiativeId: slug,
        phaseId: fm.phaseId || '',
        id: t.id,
        title: t.title || t.id,
        summary: t.summary || '',
        status: t.status || 'pending',
        closedAt: t.closedAt ?? null,
        lastUpdated: t.lastUpdated ?? null,
        blocked: blockedBy.length > 0 || t.status === 'blocked',
        blockedBy,
        blockedByText: blockedBy.join(', '),
      });
    }

    for (const g of arr(fm.exitGates)) {
      if (!g || typeof g !== 'object') continue;
      gates.push({
        projectId,
        planSlug,
        initiativeId: slug,
        phaseId: fm.phaseId || '',
        id: g.id,
        description: g.description || '',
        status: g.status || 'pending',
        verifierLabel: verifierLabelFor(g),
        evidenceSummary: evidenceSummaryFor(g),
      });
    }

    // Stack frames, parked + emerged backlog — flat, carrying the join keys so
    // the handlers (pop_frame, promote_parked) and the detail-page widgets can
    // filter by initiative without a nested read.
    arr(fm.stack).forEach((f, i) => {
      if (!f || typeof f !== 'object') return;
      stack.push({
        projectId,
        planSlug,
        initiativeId: slug,
        phaseId: fm.phaseId || '',
        index: i,
        id: f.id,
        title: f.title || '',
        type: f.type || '',
        openedAt: f.openedAt || '',
      });
    });
    arr(fm.parked).forEach((p, i) => {
      if (!p || typeof p !== 'object') return;
      parked.push({
        projectId,
        planSlug,
        initiativeId: slug,
        phaseId: fm.phaseId || '',
        index: i,
        title: p.title || '',
        surfacedAt: p.surfacedAt || '',
      });
    });
    arr(fm.emerged).forEach((e, i) => {
      if (!e || typeof e !== 'object') return;
      emerged.push({
        projectId,
        planSlug,
        initiativeId: slug,
        phaseId: fm.phaseId || '',
        index: i,
        title: e.title || '',
        surfacedAt: e.surfacedAt || '',
        promoted: e.promoted === true,
      });
    });
  }

  // projects: group plans by projectId
  const byProject = new Map();
  for (const p of plans) {
    if (!byProject.has(p.projectId)) byProject.set(p.projectId, []);
    byProject.get(p.projectId).push(p);
  }
  const blockedTasksByProject = new Map();
  for (const t of tasks) {
    if (!t.blocked) continue;
    blockedTasksByProject.set(t.projectId, (blockedTasksByProject.get(t.projectId) || 0) + 1);
  }
  const activePhasesByProject = new Map();
  const totalPhasesByProject = new Map();
  for (const ph of phases) {
    totalPhasesByProject.set(ph.projectId, (totalPhasesByProject.get(ph.projectId) || 0) + 1);
    if (ph.status === 'active') activePhasesByProject.set(ph.projectId, (activePhasesByProject.get(ph.projectId) || 0) + 1);
  }

  const projects = [];
  for (const [id, ps] of [...byProject.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const activeCount = ps.filter((p) => p.status === 'active').length;
    const concludedCount = ps.filter((p) => CONCLUDED.has(p.status)).length;
    const blockedCount = blockedTasksByProject.get(id) || 0;
    const phActive = activePhasesByProject.get(id) || 0;
    const phTotal = totalPhasesByProject.get(id) || 0;
    const mode = activeCount > 1 ? `paralelo ${activeCount}` : activeCount === 1 ? 'isolado' : 'ocioso';
    const latest = ps.reduce((m, p) => {
      const t = Date.parse(p.lastUpdated || '');
      return Number.isNaN(t) ? m : Math.max(m, t);
    }, 0);
    // Denormalized active fronts (the record-card's nested mini-list): the active
    // plans, capped at 3, with the front's next-action + current phase. The
    // dashboard can't join, so this rides the project record (matches the DS card).
    const activePlans = ps.filter((p) => p.status === 'active');
    const FRONT_CAP = 3;
    const fronts = activePlans.slice(0, FRONT_CAP).map((p) => ({
      projectId: id,
      slug: p.slug,
      title: p.title,
      nextAction: p.nextText || '',
      phaseId: p.currentPhase || '',
      dotTone: 'info', // active front
    }));
    const moreFronts = Math.max(0, activeCount - FRONT_CAP);
    projects.push({
      id,
      name: humanizeId(id),
      totalPlans: ps.length,
      activeCount,
      blockedCount,
      concludedCount,
      isParallel: activeCount > 1,
      hasActiveFront: activeCount > 0,
      mode,
      parallelTone: activeCount > 1 ? 'info' : activeCount === 1 ? 'success' : 'neutral',
      // Leading status dot on the card head: blocked → error, running → info, idle → neutral.
      dotTone: blockedCount > 0 ? 'error' : activeCount > 0 ? 'info' : 'neutral',
      plansSummary: `${ps.length} · ${concludedCount} ✓`,
      phasesActiveText: `${phActive}/${phTotal}`,
      fronts,
      moreText: moreFronts > 0 ? `${moreFronts} frente${moreFronts === 1 ? '' : 's'}` : '',
      idleText: ps.length === 0 ? 'sem planos ainda' : activeCount === 0 ? 'sem frente ativa' : '',
      bannerTitle: activeCount > 1 ? `${activeCount} frentes em paralelo` : activeCount === 1 ? '1 frente ativa' : 'Sem frente ativa',
      bannerSub: `${ps.length} planos · ${blockedCount} tasks travadas`,
      moreFrontsText: activeCount > 3 ? `+${activeCount - 3} frentes` : '',
      updatedRel: latest ? relTime(new Date(latest).toISOString(), nowMs) : '',
    });
  }

  return { plans, phases, initiatives, tasks, gates, phaseGates, stack, parked, emerged, projects };
}

/**
 * Build deadline burn-UP and SPI series from readTree() output plus parsed
 * completion events. Pure: callers own file IO and JSONL parsing.
 */
export function buildSeries(tree, completionLines, nowMs) {
  const burnup = [];
  const spi = [];

  for (const plan of arr(tree.plans)) {
    const planInits = arr(tree.initiatives).filter((it) =>
      it.projectId === plan.projectId && it.planSlug === plan.planSlug);
    let weightTotal = 0;
    let tasksTotal = 0;
    for (const init of planInits) {
      const tasks = arr(init.fm?.tasks);
      tasksTotal += tasks.length;
      weightTotal += tasks.reduce((sum, task) => sum + weightOf(task), 0);
    }

    const planEvents = arr(completionLines).filter((e) =>
      e?.projectId === plan.projectId && e?.planSlug === plan.planSlug);
    // Earned value counts each completed TASK once. `done`, `reconcile`, and the
    // per-task lines of a `phase-done` bulk-close all emit `task-done` events;
    // the single aggregate `phase-done` event (taskId:null, weight default 1) is
    // a marker, NOT a per-task earned increment — summing it would double-count
    // earned weight on every phase close. So earned sums `task-done` events only.
    const earnedEvents = planEvents.filter((e) => e?.event === 'task-done');
    const started = Date.parse(String(plan.fm?.started || ''));
    const deadline = Date.parse(String(plan.fm?.deadline || ''));
    const hasPlannedWindow = Number.isFinite(started) && Number.isFinite(deadline) && deadline > started;
    const plannedAt = (ms) => {
      if (!hasPlannedWindow) return null;
      return finiteOrNull(weightTotal * clamp01((ms - started) / (deadline - started)));
    };
    const plannedCountAt = (ms) => {
      if (!hasPlannedWindow) return null;
      return finiteOrNull(tasksTotal * clamp01((ms - started) / (deadline - started)));
    };

    // Bucket earned increments by UTC day (phase-done already excluded above).
    const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);
    const byDay = new Map();
    for (const event of earnedEvents) {
      const ts = Date.parse(String(event.ts || ''));
      if (!Number.isFinite(ts)) continue;
      const day = dayKey(ts);
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(event);
    }

    // DENSE daily series: one row per UTC day from the plan's start through `now`,
    // carrying cumulative earned forward across quiet days — so the burn-up renders
    // a continuous curve, not just the days that happened to have completions.
    // Completion days are unioned in (covers events before `started` / clock skew).
    // Falls back to completion-day buckets only when `started` is unparseable.
    const days = new Set(byDay.keys());
    const startedDayMs = Number.isFinite(started) ? Date.parse(`${dayKey(started)}T00:00:00Z`) : null;
    if (startedDayMs !== null) {
      const ONE_DAY = 86400000;
      const endMs = Math.max(Date.parse(`${dayKey(nowMs)}T00:00:00Z`), startedDayMs);
      for (let ms = startedDayMs; ms <= endMs; ms += ONE_DAY) days.add(dayKey(ms));
    }

    let earnedCount = 0;
    let earnedProxy = 0;
    for (const day of [...days].sort()) {
      for (const event of (byDay.get(day) || [])) {
        if (event.weightBasis === 'count') earnedCount += eventWeightOf(event);
        if (event.weightBasis === 'proxy') earnedProxy += eventWeightOf(event);
      }
      // Each row is "cumulative earned THROUGH this UTC day" vs "planned value at the
      // START of the day" (00:00:00Z); quiet days carry the prior cumulative forward.
      // Same-day completions read slightly ahead of that row's planned line (≤ one
      // day); spi.json (computed at `nowMs`) is the point-in-time schedule signal.
      const dayMs = Date.parse(`${day}T00:00:00Z`);
      burnup.push({
        projectId: plan.projectId,
        planSlug: plan.planSlug,
        date: day,
        plannedValue: plannedAt(dayMs),
        earnedCount,
        earnedProxy,
      });
    }

    let earnedCountNow = 0;
    let earnedProxyNow = 0;
    for (const event of earnedEvents) {
      const ts = Date.parse(String(event.ts || ''));
      if (!Number.isFinite(ts) || ts > nowMs) continue;
      if (event.weightBasis === 'count') earnedCountNow += eventWeightOf(event);
      if (event.weightBasis === 'proxy') earnedProxyNow += eventWeightOf(event);
    }

    const plannedProxyNow = plannedAt(nowMs);
    const plannedCountNow = plannedCountAt(nowMs);
    // SPI reports from `started` onward — INCLUDING past the deadline, where
    // plannedProxyNow/plannedCountNow clamp to weightTotal/tasksTotal (full planned
    // value). An overdue plan then reports SPI = earned / full-planned (< 1 when
    // incomplete) instead of going blank exactly when the schedule signal matters
    // most. Still null without a planned window (no deadline) or before `started`.
    const afterStart = hasPlannedWindow && nowMs >= started;
    spi.push({
      projectId: plan.projectId,
      planSlug: plan.planSlug,
      asOf: new Date(nowMs).toISOString(),
      // Planned-line parameters, so the renderer can reconstruct the planned
      // baseline (0 → weightTotal from started → deadline) WITHOUT re-reading
      // plan frontmatter — even for a plan with zero completions (no burnup rows).
      started: plan.fm?.started ?? null,
      deadline: plan.fm?.deadline ?? null,
      weightTotal: finiteOrNull(weightTotal) ?? 0,
      tasksTotal: finiteOrNull(tasksTotal) ?? 0,
      spiProxy: afterStart && Number.isFinite(plannedProxyNow) && plannedProxyNow > 0
        ? finiteOrNull(earnedProxyNow / plannedProxyNow)
        : null,
      spiCount: afterStart && Number.isFinite(plannedCountNow) && plannedCountNow > 0
        ? finiteOrNull(earnedCountNow / plannedCountNow)
        : null,
    });
  }

  return { burnup, spi };
}

// ── write ───────────────────────────────────────────────────────────────────

/** Write each state array as a pretty bare-array JSON file; returns the paths. */
export function writeState(root, state) {
  const dir = join(root, STATE_DIRNAME);
  mkdirSync(dir, { recursive: true });
  const written = [];
  for (const [name, records] of Object.entries(state)) {
    const file = join(dir, `${name}.json`);
    writeFileSync(file, JSON.stringify(records, null, 2) + '\n');
    written.push({ file, count: records.length });
  }
  return written;
}

/** Full pipeline for a working dir: resolve .atomic-skills/, read, build, write. */
export function emitConsumerState(dir, nowMs) {
  const root = existsSync(join(dir, '.atomic-skills')) ? join(dir, '.atomic-skills') : dir;
  const tree = readTree(root);
  const state = buildState(tree, nowMs);
  const logPath = join(root, 'analytics', 'completions.jsonl');
  let lines = [];
  if (existsSync(logPath)) {
    lines = readFileSync(logPath, 'utf8').split('\n')
      .map((s) => s.trim()).filter(Boolean)
      .map((s) => {
        try { return JSON.parse(s); } catch { return null; }
      })
      .filter(Boolean);
  }
  const series = buildSeries(tree, lines, nowMs);
  const fullState = { ...state, ...series };
  const written = writeState(root, fullState);
  return { root, state: fullState, written };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  let dir = process.cwd();
  let nowMs = Date.now();
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--now') nowMs = Date.parse(args[++i]) || nowMs;
    else dir = resolve(args[i]);
  }
  const { written } = emitConsumerState(dir, nowMs);
  for (const w of written) console.log(`  ✓ ${w.file} (${w.count})`);
  console.log(`emit-consumer-state: wrote ${written.length} files`);
}
