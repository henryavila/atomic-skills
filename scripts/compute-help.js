#!/usr/bin/env node
/**
 * compute-help.js — deterministic, zero-token, PURE-READ classifier for the
 * `project help` terminal GPS (F1 of the help-command plan).
 *
 * It answers "where am I / what's the next step?" from real `.atomic-skills/`
 * state + the transition graph — NOT from prose reasoning (P3), and NOT by
 * recomputing the command (P2). The concrete next command comes VERBATIM from
 * the persisted `nextAction` field (authored at every `done`/transition by
 * project-transitions.md); the precedence list only supplies a command as a
 * FALLBACK when `nextAction` is absent/blank, marked `commandSource: "fallback"`.
 *
 * What the helper computes BEYOND the command: the lifecycle position
 * (`spineStage`) and the `reason`/`why` annotations, by classifying the current
 * state against a PRECEDENCE LIST (order IS the semantics — blocks before the
 * happy path). Design: docs/design/project-onboarding/guide-command-plan.md.
 *
 * Contract (non-negotiable, mirrors project-help.md):
 *   - Read-only / zero-mutation. Never writes state, never runs a verifier.
 *   - Fail-open. Any read error → emit what we have, exit 0. Never abort.
 *   - Reuses detect-completion.js for drift (P3) — does NOT reimplement it.
 *
 * Drift-detector contract (F-004): `detect-completion.js --json` exits 1 when
 * there IS drift, 0 when clean, 2 on bad args. So we parse stdout as JSON on
 * BOTH exit 0 and 1, and fail-open (no drift) ONLY on exit 2, unparseable
 * stdout, or a spawn failure — never an execFileSync that treats exit 1 as an
 * error and discards the stdout (that would swallow `reconcile` exactly when
 * drift exists).
 *
 * Output JSON: { youAreHere, doneSummary, nextStep:{command, commandSource,
 * reason, why}, escapes, spineStage:{n,m,name} }.
 *
 * CLI: node scripts/compute-help.js [<dir>]  → prints the JSON, always exits 0.
 */

import { existsSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { resolveTargets } from './detect-completion.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DETECTOR = join(HERE, 'detect-completion.js');
const DAY_MS = 24 * 60 * 60 * 1000;

/** The lifecycle spine — the mini-map "você está aqui" axis (m = length). */
export const SPINE = [
  'IDEIA', 'DESIGN', 'PLANO', 'DECOMPOSE',
  'MATERIALIZE', 'IMPLEMENT', 'VERIFY', 'PHASE-DONE',
  'FINALIZE', 'ARCHIVE',
];

/** Operational stage → the spine node it renders "you are here" at. */
const STAGE_TO_SPINE = {
  setup: 'IDEIA',
  blocked: 'PLANO',
  reconcile: 'IMPLEMENT',
  materialize: 'MATERIALIZE',
  implement: 'IMPLEMENT',
  'phase-done': 'PHASE-DONE',
  archive: 'ARCHIVE',
  finalize: 'FINALIZE',
};

const hasText = (v) => typeof v === 'string' && v.trim().length > 0;

/**
 * classify(state) → { stage, fallbackCommand, reason, why }.
 *
 * Walks the precedence list; the FIRST match wins (blocks before the happy
 * path). Every fallbackCommand is a single invocable string with its arguments
 * already resolved from state — never a leftover <placeholder>.
 */
export function classify(state = {}) {
  // 1 — no tracked state at all.
  if (!state.hasState) {
    return {
      stage: 'setup',
      fallbackCommand: 'new plan',
      reason: 'Nenhum estado rastreado em `.atomic-skills/` ainda.',
      why: 'Criar o plano inicializa o rastreamento do ciclo de vida.',
    };
  }
  // 2 — plan blocked by an unmet cross-plan dependency (before everything).
  if (state.planBlocked) {
    return {
      stage: 'blocked',
      fallbackCommand: `switch ${state.blockedPrereq}`,
      reason: `Plano travado pelo pré-requisito \`${state.blockedPrereq}\`.`,
      why: 'Uma dependência declarada em dependsOnPlans[] ainda não está pronta.',
    };
  }
  // 3 — completion drift: work looks done in the repo but is still open in state.
  if (state.drift) {
    return {
      stage: 'reconcile',
      fallbackCommand: 'reconcile',
      reason: 'Há trabalho que parece feito no repo mas segue aberto no estado.',
      why: 'reconcile fecha cada item pelo verifier antes de avançar.',
    };
  }
  // 4 — a task left `active` for >24h (probable unreconciled work).
  if (state.activeOver24h) {
    return {
      stage: 'reconcile',
      fallbackCommand: 'reconcile',
      reason: 'Task ativa há mais de 24h — provável trabalho não reconciliado.',
      why: 'reconcile revisa e fecha o que já está pronto antes de seguir.',
    };
  }
  // 5 — only blocked tasks remain; nothing else can move until one is unblocked.
  if (state.onlyBlockedTasks) {
    return {
      stage: 'implement',
      fallbackCommand: `unblock ${state.blockedTaskId}`,
      reason: `Só restam tasks bloqueadas (${state.blockedTaskId}).`,
      why: 'Desbloquear a task libera o fluxo de implementação.',
    };
  }
  // 6 — the current phase is described but not yet materialized into tasks.
  if (state.phaseDescriptorOnly) {
    return {
      stage: 'materialize',
      fallbackCommand: `materialize ${state.phaseId}`,
      reason: `A fase ${state.phaseId} está só descrita (descriptor-only).`,
      why: 'materialize expande a fase em tasks executáveis com verifier.',
    };
  }
  // 7 — materialized phase with open tasks → drive them.
  if (state.hasOpenTasks) {
    return {
      stage: 'implement',
      fallbackCommand: 'implement',
      reason: 'A fase tem tasks abertas para codar.',
      why: 'implement dirige as tasks admitidas até done, uma a uma.',
    };
  }
  // 8/9/10 — no open tasks: distinguish the terminal state by structure.
  if (state.standalone) {
    return {
      stage: 'archive',
      fallbackCommand: `archive ${state.slug}`,
      reason: 'A iniciativa standalone não tem tasks abertas.',
      why: 'archive fecha a iniciativa concluída.',
    };
  }
  if (state.allPhasesDone) {
    return {
      stage: 'finalize',
      fallbackCommand: 'finalize',
      reason: 'Todas as fases estão done.',
      why: 'finalize encerra o plano.',
    };
  }
  return {
    stage: 'phase-done',
    fallbackCommand: 'phase-done',
    reason: 'A fase atual não tem tasks abertas.',
    why: 'phase-done verifica os exit-gates e avança o plano.',
  };
}

/** Lifecycle position { n, m, name } for an operational stage. */
export function spineStageOf(stage) {
  const name = STAGE_TO_SPINE[stage] || 'IMPLEMENT';
  const n = SPINE.indexOf(name) + 1;
  return { n: n > 0 ? n : 1, m: SPINE.length, name };
}

/**
 * The command surfaced to the user. P2: the persisted `nextAction` is read
 * VERBATIM when present (commandSource "persisted"); the precedence fallback is
 * used only when nextAction is absent/blank (commandSource "fallback").
 */
export function nextStepFrom(nextAction, decision) {
  if (hasText(nextAction)) {
    return { command: nextAction.trim(), commandSource: 'persisted', reason: decision.reason, why: decision.why };
  }
  return { command: decision.fallbackCommand, commandSource: 'fallback', reason: decision.reason, why: decision.why };
}

/** Default exec: spawnSync so a non-zero exit is captured in `status`, NOT
 *  thrown. A real spawn failure surfaces via `error` and is rethrown for the
 *  caller's fail-open catch. */
function defaultExec(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.error) throw r.error;
  return { status: r.status, stdout: r.stdout ?? '' };
}

/**
 * runDriftDetector({ dir, project, plan, exec }) → boolean.
 *
 * Spawns detect-completion.js --json and honors its exit-code contract: parse
 * JSON on exit 0 AND 1; fail-open (false) only on exit 2, unparseable stdout, or
 * a spawn failure.
 */
export function runDriftDetector({ dir = process.cwd(), project, plan, exec = defaultExec } = {}) {
  const args = [DETECTOR, dir, '--json'];
  if (project) args.push('--project', project);
  if (plan) args.push('--plan', plan);
  let res;
  try {
    res = exec('node', args);
  } catch {
    return false; // spawn failure → fail-open
  }
  if (!res || (res.status !== 0 && res.status !== 1)) return false; // exit 2 / unexpected → fail-open
  let parsed;
  try {
    parsed = JSON.parse(res.stdout);
  } catch {
    return false; // unparseable → fail-open
  }
  return !!(parsed && parsed.drift === true);
}

/** `<dir>/.atomic-skills` when present, else `<dir>` (mirrors detect-completion). */
function stateRootOf(dir) {
  return existsSync(join(dir, '.atomic-skills')) ? join(dir, '.atomic-skills') : dir;
}

function isDir(p) {
  try { return statSync(p).isDirectory(); } catch { return false; }
}

/** Current git branch of `dir`, or null (fail-soft — used only to disambiguate). */
function currentBranch(dir) {
  try {
    const r = spawnSync('git', ['-C', dir, 'symbolic-ref', '--short', 'HEAD'], { encoding: 'utf8' });
    const v = (r.stdout || '').trim();
    return v.length ? v : null;
  } catch {
    return null;
  }
}

const OPEN = new Set(['pending', 'active', 'blocked']);

/**
 * Read `.atomic-skills/` and build the normalized state for classify(). Every
 * field is best-effort and guarded; any failure degrades to the setup state.
 * `now` and `driftFn` are injectable for deterministic tests.
 */
export function resolveState({ dir = process.cwd(), now = Date.now(), driftFn = runDriftDetector, exec } = {}) {
  const state = {
    hasState: false, slug: null,
    planBlocked: false, blockedPrereq: null,
    drift: false, activeOver24h: false,
    onlyBlockedTasks: false, blockedTaskId: null,
    phaseDescriptorOnly: false, phaseId: null,
    hasOpenTasks: false, standalone: false, allPhasesDone: false,
    nextAction: '',
    youAreHere: {}, doneSummary: {},
  };
  try {
    if (!existsSync(join(dir, '.atomic-skills')) && !isDir(join(dir, 'projects')) && !isDir(join(dir, 'plans'))) {
      return state; // no tracked state → setup
    }
    state.hasState = true;
    const stateRoot = stateRootOf(dir);
    const targets = resolveTargets(stateRoot, { branch: currentBranch(dir) });
    const t = targets && targets[0];
    if (!t) return state; // plan(s) exist but no active initiative resolved
    const { fm = {}, planFm = {} } = t;

    state.slug = planFm.slug || t.projectId || null;
    state.phaseId = fm.phaseId || planFm.currentPhase || null;
    state.nextAction = typeof fm.nextAction === 'string' ? fm.nextAction : '';

    const tasks = Array.isArray(fm.tasks) ? fm.tasks : [];
    const open = tasks.filter((task) => task && OPEN.has(task.status));
    const nonBlockedOpen = open.filter((task) => task.status !== 'blocked');
    const blockedOpen = open.filter((task) => task.status === 'blocked');
    state.hasOpenTasks = nonBlockedOpen.length > 0;
    state.onlyBlockedTasks = open.length > 0 && nonBlockedOpen.length === 0;
    if (state.onlyBlockedTasks) state.blockedTaskId = String(blockedOpen[0].id ?? '?');

    state.activeOver24h = tasks.some((task) => task && task.status === 'active'
      && task.lastUpdated && Number.isFinite(Date.parse(task.lastUpdated))
      && (now - Date.parse(task.lastUpdated)) > DAY_MS);

    const deps = Array.isArray(planFm.dependsOnPlans) ? planFm.dependsOnPlans : [];
    state.planBlocked = planFm.status === 'blocked' && deps.length > 0;
    if (state.planBlocked) state.blockedPrereq = deps[0] && deps[0].plan ? deps[0].plan : '?';

    const phases = Array.isArray(planFm.phases) ? planFm.phases : [];
    // descriptor-only: the plan's current phase has no materialized initiative
    // (the resolved active initiative belongs to a DIFFERENT phase). Existence of
    // the initiative file is the only materialization proof, never subPhaseCount.
    state.phaseDescriptorOnly = !!(planFm.currentPhase && fm.phaseId && fm.phaseId !== planFm.currentPhase);
    state.standalone = phases.length === 0;
    state.allPhasesDone = phases.length > 0 && phases.every((p) => p && p.status === 'done');

    state.youAreHere = {
      planSlug: state.slug,
      phaseId: state.phaseId,
      phaseSummary: fm.title || fm.goal || '',
    };
    state.doneSummary = {
      phasesTotal: phases.length,
      phasesDone: phases.filter((p) => p && p.status === 'done').length,
      tasksDone: Number(fm.tasksDone) || 0,
      tasksTotal: Number(fm.tasksTotal) || 0,
      blocked: blockedOpen.length,
    };

    state.drift = typeof driftFn === 'function'
      ? !!driftFn({ dir, plan: planFm.slug, project: t.projectId, exec })
      : false;
  } catch {
    // fail-open: return whatever we managed to fill.
  }
  return state;
}

/** Escapes shown under "SE TRAVAR" — resolved sub-commands, bare verbs. */
function buildEscapes(state) {
  const anchor = state.phaseId ? `why ${state.phaseId}` : 'why';
  return [anchor, 'status --browser', 'help'];
}

/**
 * computeHelp(opts) → the full GPS JSON. Orchestrates resolveState → classify →
 * spineStageOf → nextStepFrom. Fail-open: never throws.
 */
export function computeHelp(opts = {}) {
  let state;
  try {
    state = resolveState(opts);
  } catch {
    state = { hasState: false };
  }
  const decision = classify(state);
  const spineStage = spineStageOf(decision.stage);
  const nextStep = nextStepFrom(state.nextAction, decision);
  return {
    youAreHere: state.youAreHere || {},
    doneSummary: state.doneSummary || {},
    nextStep,
    escapes: buildEscapes(state),
    spineStage,
  };
}

// CLI: print the JSON, always exit 0 (fail-open GPS).
if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = resolve(process.argv[2] || process.cwd());
  let json;
  try {
    json = computeHelp({ dir });
  } catch {
    json = { youAreHere: {}, doneSummary: {}, nextStep: { command: 'help', commandSource: 'fallback', reason: '', why: '' }, escapes: ['help'], spineStage: spineStageOf('setup') };
  }
  process.stdout.write(`${JSON.stringify(json, null, 2)}\n`);
  process.exit(0);
}
