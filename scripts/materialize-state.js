#!/usr/bin/env node
/**
 * materialize-state.js — recoverable plan+initiative materialization primitive.
 *
 * Single authority for descriptor-only → initiative publish (F0/T-005 bootstrap,
 * F4/T-006 history reconcile + successor barrier).
 * Prepares both files in staging, validates the staged pair, persists a durable
 * marker with SHA-256 before/after digests, then renames initiative first and
 * plan last. Incomplete transactions recover via the marker before any
 * "initiative already exists" guard.
 *
 * API:
 *   materializePair({ planPath, initiativePath, planContent, initiativeContent, markerPath?, faultHooks?, successorBarrier?, historyReceiptPath?, rootDir? })
 *   recoverMaterialize(markerPath)
 *   defaultMarkerPath(planPath)
 *   buildHistoryReceipt(opts) / checkHistoryReceipt(path, opts) / classifyHistoryReconcile(...)
 *   assertSuccessorBarrier({ plan, f4ReceiptPath, targetPhaseId, rootDir? })
 *
 * Successor barrier (F4-G3): default-on when the target initiative phase
 * transitively depends on F4. Pass successorBarrier: { skip: true } only in tests.
 *
 * CLI:
 *   node scripts/materialize-state.js --plan <path> --initiative <path> \
 *     --plan-file <new-plan> --initiative-file <new-initiative>
 *   node scripts/materialize-state.js --recover [<marker-path>]
 *   node scripts/materialize-state.js --check-history-receipt <receipt.json>
 *   node scripts/materialize-state.js --write-history-receipt <receipt.json> [opts]
 *   node scripts/materialize-state.js --require-f4-barrier --plan <plan.md> \
 *     --target-phase <id> --receipt <receipt.json>
 */
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from './validate-state.js';
import {
  compareTasksCore,
  listCoreMismatches,
} from '../src/tasks-fingerprint.js';

const MARKER_SUFFIX = '.materialize-tx.json';
const STAGE_SUFFIX = '.materialize-stage';
const BEFORE_SUFFIX = '.materialize-before';
const MARKER_VERSION = 1;
const HISTORY_RECEIPT_SCHEMA = '1';
const DEFAULT_F0_RECEIPT_REL =
  'docs/audits/integrity-remediation-f0-reconciliation.json';
const DEFAULT_BARRIER_PHASE = 'F4';
const DEFAULT_BARRIER_GATE = 'F4-G3';

/** Minimal completions.jsonl reader (avoids importing append-completion side paths). */
function readCompletionLogLocal(root) {
  const path = join(resolve(root), '.atomic-skills', 'analytics', 'completions.jsonl');
  if (!existsSync(path)) return [];
  try {
    const raw = readFileSync(path, 'utf8');
    if (!raw.trim()) return [];
    const out = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) out.push(obj);
      } catch {
        /* skip corrupt */
      }
    }
    return out;
  } catch {
    return [];
  }
}

function completionEventKeyLocal(entry) {
  if (entry == null || typeof entry !== 'object') return null;
  const { event, projectId, planSlug, phaseId } = entry;
  if (![event, projectId, planSlug, phaseId].every((v) => typeof v === 'string' && v.trim())) {
    return null;
  }
  if (event === 'task-done' && !(typeof entry.taskId === 'string' && entry.taskId.trim())) {
    return null;
  }
  const taskPart = typeof entry.taskId === 'string' ? entry.taskId : '';
  return `${event}\0${projectId}\0${planSlug}\0${phaseId}\0${taskPart}`;
}

function dedupeCompletionEventsLocal(records) {
  if (!Array.isArray(records)) return [];
  const seen = new Set();
  const out = [];
  for (const rec of records) {
    const key = completionEventKeyLocal(rec);
    if (key != null) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(rec);
  }
  return out;
}

// ── pure helpers ────────────────────────────────────────────────────────────

export function sha256(content) {
  return createHash('sha256').update(content ?? '', 'utf8').digest('hex');
}

export function defaultMarkerPath(planPath) {
  return `${resolve(planPath)}${MARKER_SUFFIX}`;
}

function liveHash(absPath) {
  if (!existsSync(absPath)) return null;
  return sha256(readFileSync(absPath));
}

function classifyLive(live, before, after) {
  if (live === after) return 'after';
  if (live === before) return 'before';
  // before may be null (file did not exist) and live may still be null
  if (live === null && before === null) return 'before';
  return 'ambiguous';
}

/**
 * Lightweight staged-pair validation (does not mutate validate-state.js).
 * Requires parseable frontmatter; plan must carry a phases[] array; initiative
 * must carry phaseId that matches a plan phase id. Throws on invalid input.
 */
export function validateStagedPair(planContent, initiativeContent) {
  const plan = parseFrontmatter(planContent);
  if (plan.error) {
    throw new Error(`invalid staged plan frontmatter: ${plan.error}`);
  }
  const init = parseFrontmatter(initiativeContent);
  if (init.error) {
    throw new Error(`invalid staged initiative frontmatter: ${init.error}`);
  }
  const planFm = plan.frontmatter;
  const initFm = init.frontmatter;
  if (!planFm.slug || typeof planFm.slug !== 'string') {
    throw new Error('invalid staged plan: missing slug');
  }
  if (!Array.isArray(planFm.phases) || planFm.phases.length === 0) {
    throw new Error('invalid staged plan: missing phases[]');
  }
  const phaseId = initFm.phaseId ?? null;
  if (!phaseId || typeof phaseId !== 'string' || phaseId.trim() === '') {
    throw new Error('invalid staged initiative: missing phaseId');
  }
  const match = planFm.phases.find((p) => p && p.id === phaseId);
  if (!match) {
    throw new Error(`invalid staged pair: plan has no phase ${phaseId}`);
  }
  // Identity join (Codex F-012): parentPlan + slug must agree with plan/phase.
  if (initFm.parentPlan != null && initFm.parentPlan !== planFm.slug) {
    throw new Error(
      `invalid staged pair: initiative.parentPlan '${initFm.parentPlan}' !== plan.slug '${planFm.slug}'`,
    );
  }
  if (initFm.slug != null && match.slug != null && initFm.slug !== match.slug) {
    throw new Error(
      `invalid staged pair: initiative.slug '${initFm.slug}' !== phase.slug '${match.slug}'`,
    );
  }
  if (!initFm.schemaVersion) {
    throw new Error('invalid staged initiative: missing schemaVersion');
  }
  if (!planFm.schemaVersion) {
    throw new Error('invalid staged plan: missing schemaVersion');
  }
  return { planFm, initFm };
}

function ensureDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

/** Write bytes then fsync so the durable marker survives crash before rename. */
function writeFileDurable(absPath, content) {
  ensureDir(absPath);
  const fd = openSync(absPath, 'w');
  try {
    writeSync(fd, content);
    try {
      fsyncSync(fd);
    } catch {
      // Some filesystems/environments do not support fsync; best-effort.
    }
  } finally {
    closeSync(fd);
  }
}

function safeUnlink(absPath) {
  try {
    if (existsSync(absPath)) unlinkSync(absPath);
  } catch {
    /* best-effort cleanup */
  }
}

function relTo(baseDir, absPath) {
  const rel = relative(baseDir, absPath);
  return rel === '' ? '.' : rel;
}

/**
 * Resolve a marker-relative path strictly under baseDir.
 * Rejects absolute paths, null bytes, and any traversal outside baseDir (Codex F-002).
 * @param {string} baseDir
 * @param {string|null|undefined} maybeRel
 * @param {string} [label]
 * @returns {string|null}
 */
export function confinedPath(baseDir, maybeRel, label = 'path') {
  if (maybeRel == null || maybeRel === '') return null;
  if (typeof maybeRel !== 'string') {
    throw new Error(`materialize marker ${label}: must be a relative string`);
  }
  if (maybeRel.includes('\0')) {
    throw new Error(`materialize marker ${label}: null byte rejected`);
  }
  if (isAbsolute(maybeRel)) {
    throw new Error(`materialize marker ${label}: absolute path rejected (${maybeRel})`);
  }
  const base = resolve(baseDir);
  // resolve() still collapses .. ; relative() then detects escape.
  const abs = resolve(base, maybeRel);
  const rel = relative(base, abs);
  if (rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)) {
    throw new Error(`materialize marker ${label}: escapes transaction root (${maybeRel})`);
  }
  return abs;
}

/** @deprecated use confinedPath — kept as alias for call-site clarity */
function absFrom(baseDir, maybeRel) {
  return confinedPath(baseDir, maybeRel);
}

function readMarker(markerPath) {
  const raw = readFileSync(markerPath, 'utf8');
  let marker;
  try {
    marker = JSON.parse(raw);
  } catch (err) {
    throw new Error(`corrupt materialize marker at ${markerPath}: ${err.message}`);
  }
  if (!marker || marker.version !== MARKER_VERSION || !marker.txId) {
    throw new Error(`unsupported or corrupt materialize marker at ${markerPath}`);
  }
  // Fail closed on absolute/escaping staging paths before any unlink/rename.
  const baseDir = dirname(resolve(markerPath));
  confinedPath(baseDir, marker.plan?.path, 'plan.path');
  confinedPath(baseDir, marker.initiative?.path, 'initiative.path');
  const staging = marker.staging || {};
  for (const key of ['plan', 'initiative', 'planBefore', 'initiativeBefore']) {
    if (staging[key] != null) confinedPath(baseDir, staging[key], `staging.${key}`);
  }
  return marker;
}

function cleanupTx(markerPath, marker) {
  const baseDir = dirname(resolve(markerPath));
  const staging = marker.staging || {};
  for (const key of ['plan', 'initiative', 'planBefore', 'initiativeBefore']) {
    try {
      const p = confinedPath(baseDir, staging[key], `staging.${key}`);
      if (p) safeUnlink(p);
    } catch {
      // Skip unsafe paths — never unlink outside the transaction root.
    }
  }
  safeUnlink(markerPath);
}

/**
 * Recover an incomplete materialize transaction described by markerPath.
 * @returns {{ ok: true, status: 'completed'|'restored-before'|'already-clean', marker?: object }}
 */
export function recoverMaterialize(markerPath) {
  const absMarker = resolve(markerPath);
  if (!existsSync(absMarker)) {
    return { ok: true, status: 'already-clean' };
  }
  const marker = readMarker(absMarker);
  const baseDir = dirname(absMarker);
  const planAbs = absFrom(baseDir, marker.plan.path);
  const initAbs = absFrom(baseDir, marker.initiative.path);
  const stagePlan = absFrom(baseDir, marker.staging?.plan);
  const stageInit = absFrom(baseDir, marker.staging?.initiative);
  const beforePlan = absFrom(baseDir, marker.staging?.planBefore);
  const beforeInit = absFrom(baseDir, marker.staging?.initiativeBefore);

  const planLive = liveHash(planAbs);
  const initLive = liveHash(initAbs);
  const planState = classifyLive(planLive, marker.plan.before, marker.plan.after);
  const initState = classifyLive(initLive, marker.initiative.before, marker.initiative.after);

  if (planState === 'ambiguous' || initState === 'ambiguous') {
    throw new Error(
      `materialize recovery fail closed: live hash outside {before, after} `
      + `(plan=${planState}, initiative=${initState}) at marker ${absMarker}`,
    );
  }

  // Both already published at after → validate + clean.
  if (planState === 'after' && initState === 'after') {
    cleanupTx(absMarker, marker);
    return { ok: true, status: 'completed', marker };
  }

  // Initiative after, plan still before → complete plan rename if staging present.
  if (initState === 'after' && planState === 'before') {
    if (stagePlan && existsSync(stagePlan)) {
      const stagedHash = sha256(readFileSync(stagePlan));
      if (stagedHash !== marker.plan.after) {
        throw new Error(
          `materialize recovery fail closed: plan staging hash mismatch at ${stagePlan}`,
        );
      }
      ensureDir(planAbs);
      renameSync(stagePlan, planAbs);
      cleanupTx(absMarker, marker);
      return { ok: true, status: 'completed', marker };
    }
    // Staging lost mid-flight after initiative rename: restore prior pair if backups exist.
    if (restoreBeforePair({ planAbs, initAbs, beforePlan, beforeInit, marker })) {
      cleanupTx(absMarker, marker);
      return { ok: true, status: 'restored-before', marker };
    }
    throw new Error(
      `materialize recovery fail closed: plan staging lost after initiative rename `
      + `and before-pair backup unavailable (marker ${absMarker})`,
    );
  }

  // Both still at before (or initiative absent) → prior pair intact; drop marker/staging.
  if (planState === 'before' && initState === 'before') {
    cleanupTx(absMarker, marker);
    return { ok: true, status: 'restored-before', marker };
  }

  // plan after but initiative before — should not occur with correct publish order.
  // Attempt restore to before if possible; otherwise fail closed.
  if (planState === 'after' && initState === 'before') {
    if (restoreBeforePair({ planAbs, initAbs, beforePlan, beforeInit, marker })) {
      cleanupTx(absMarker, marker);
      return { ok: true, status: 'restored-before', marker };
    }
    throw new Error(
      `materialize recovery fail closed: inverted publish state (plan after, initiative before) `
      + `at marker ${absMarker}`,
    );
  }

  throw new Error(
    `materialize recovery fail closed: unhandled state plan=${planState} initiative=${initState}`,
  );
}

/**
 * Restore live files to the marker's before hashes when possible.
 * Uses durable `.materialize-before` backups written at prepare time.
 * When before was null (file absent), removes the live file only if it still
 * hashes to the known after digest (safe undo of our own rename).
 */
function restoreBeforePair({ planAbs, initAbs, beforePlan, beforeInit, marker }) {
  if (!restoreOneSide(planAbs, beforePlan, marker.plan.before, marker.plan.after)) {
    return false;
  }
  if (!restoreOneSide(initAbs, beforeInit, marker.initiative.before, marker.initiative.after)) {
    return false;
  }
  return liveHash(planAbs) === marker.plan.before
    && liveHash(initAbs) === marker.initiative.before;
}

function restoreOneSide(liveAbs, beforeBackup, beforeHash, afterHash) {
  const live = liveHash(liveAbs);
  if (live === beforeHash) return true;

  if (beforeHash === null) {
    // Prior state: file must be absent. Only delete if we still own the after bytes.
    if (live === null) return true;
    if (live === afterHash) {
      safeUnlink(liveAbs);
      return liveHash(liveAbs) === null;
    }
    return false;
  }

  if (beforeBackup && existsSync(beforeBackup)
    && sha256(readFileSync(beforeBackup)) === beforeHash) {
    ensureDir(liveAbs);
    writeFileSync(liveAbs, readFileSync(beforeBackup));
    return liveHash(liveAbs) === beforeHash;
  }
  return false;
}

/**
 * Run successor barrier when publishing a phase that depends on F4.
 *
 * - successorBarrier: { skip: true } — explicit test opt-out
 * - successorBarrier: { targetPhaseId, ... } — explicit assert opts
 * - otherwise auto-detect from staged plan+initiative; if target depends on F4
 *   (transitively), assertSuccessorBarrier always runs (fail closed).
 *
 * @param {object} opts
 */
function enforceSuccessorBarrierIfNeeded(opts) {
  const {
    successorBarrier = null,
    historyReceiptPath = null,
    planPath,
    planContent,
    initiativeContent,
    rootDir = process.cwd(),
  } = opts;

  if (successorBarrier != null && typeof successorBarrier === 'object' && successorBarrier.skip === true) {
    // Test-only opt-out (Codex F-015). Production callers cannot bypass F4-G3.
    const testRuntime = process.env.NODE_TEST_CONTEXT != null
      || process.env.ATOMIC_SKILLS_TEST === '1';
    if (!testRuntime) {
      throw new Error(
        'successorBarrier.skip is test-only; F4-G3 barrier cannot be bypassed in production',
      );
    }
    return;
  }

  if (successorBarrier != null && typeof successorBarrier === 'object') {
    assertSuccessorBarrier(successorBarrier);
    return;
  }

  // Auto path: parse staged content; leave unparseable content to validateStagedPair.
  let planFm;
  try {
    planFm = parsePlanInput(planContent);
  } catch {
    return;
  }
  if (!planFm || !Array.isArray(planFm.phases)) return;

  let targetPhaseId = null;
  try {
    const parsed = parseFrontmatter(initiativeContent);
    if (!parsed.error && parsed.frontmatter && typeof parsed.frontmatter.phaseId === 'string') {
      const id = parsed.frontmatter.phaseId.trim();
      if (id) targetPhaseId = id;
    }
  } catch {
    /* ignore — validateStagedPair will reject later */
  }
  if (!targetPhaseId) return;

  if (!phaseDependsOn(planFm, targetPhaseId, DEFAULT_BARRIER_PHASE)) {
    return;
  }

  // F4 successor: refuse without successful barrier (receipt + F4-G3 met + F4 done).
  assertSuccessorBarrier({
    plan: planFm,
    planPath,
    targetPhaseId,
    f4ReceiptPath: historyReceiptPath ?? undefined,
    rootDir,
  });
}

/**
 * Resolve sidecar path next to initiative: `fN-….md` → `fN-….source.json`.
 * @param {string} initiativeAbs
 * @param {string|null} explicit
 */
export function resolveSidecarPath(initiativeAbs, explicit = null) {
  if (explicit) return resolve(explicit);
  if (initiativeAbs.endsWith('.md')) {
    return initiativeAbs.slice(0, -3) + '.source.json';
  }
  return `${initiativeAbs}.source.json`;
}

/**
 * Refuse materialize when initiative tasks *core* diverges from live sidecar.
 * No sidecar file → skip (bootstrap / tests without capture). Empty sidecar
 * tasks with non-empty initiative still refuse.
 *
 * @param {{ initiativePath: string, initiativeContent: string, sidecarPath?: string|null }} opts
 */
export function assertTasksCoreMatchesSidecar(opts) {
  const initAbs = resolve(opts.initiativePath);
  const sidecarAbs = resolveSidecarPath(initAbs, opts.sidecarPath ?? null);
  if (!existsSync(sidecarAbs)) {
    return { skipped: true, reason: 'no-sidecar' };
  }
  let sidecar;
  try {
    sidecar = JSON.parse(readFileSync(sidecarAbs, 'utf8'));
  } catch (e) {
    throw new Error(`tasks-fingerprint: cannot parse sidecar ${sidecarAbs}: ${e.message}`);
  }
  const sidecarTasks = Array.isArray(sidecar.tasks) ? sidecar.tasks : [];
  const initParsed = parseFrontmatter(opts.initiativeContent);
  if (initParsed.error) {
    throw new Error(`tasks-fingerprint: invalid initiative frontmatter: ${initParsed.error}`);
  }
  const initTasks = Array.isArray(initParsed.frontmatter.tasks)
    ? initParsed.frontmatter.tasks
    : [];
  // Bootstrap: both empty → ok
  if (sidecarTasks.length === 0 && initTasks.length === 0) {
    return { skipped: false, match: true };
  }
  const cmp = compareTasksCore(sidecarTasks, initTasks);
  if (cmp.match) {
    return { skipped: false, match: true, ...cmp };
  }
  const mismatches = listCoreMismatches(sidecarTasks, initTasks);
  throw new Error(
    `tasks-fingerprint refuse: initiative tasks core diverges from sidecar ${sidecarAbs}. ` +
      `mismatched task ids: ${mismatches.join(', ') || '(none)'}. ` +
      `sidecarHash=${cmp.sidecarHash.slice(0, 12)}… initiativeHash=${cmp.initiativeHash.slice(0, 12)}…. ` +
      `Do not rewrite SPEC core at materialize — re-capture source / re-spec explicitly, then retry.`,
  );
}

/**
 * Publish planContent + initiativeContent via recoverable two-rename transaction.
 *
 * @param {object} opts
 * @param {string} opts.planPath
 * @param {string} opts.initiativePath
 * @param {string} opts.planContent
 * @param {string} opts.initiativeContent
 * @param {string} [opts.markerPath]
 * @param {object} [opts.faultHooks]
 * @param {object} [opts.successorBarrier] explicit barrier opts, or `{ skip: true }` for tests
 * @param {string} [opts.historyReceiptPath] receipt path for auto barrier (else default under rootDir)
 * @param {string} [opts.rootDir] root for auto barrier receipt discovery (default cwd)
 * @returns {{ ok: true, recovered?: boolean, idempotent?: boolean, txId?: string }}
 */
export function materializePair(opts) {
  const {
    planPath,
    initiativePath,
    planContent,
    initiativeContent,
    faultHooks = {},
    successorBarrier = null,
    historyReceiptPath = null,
    rootDir = process.cwd(),
  } = opts ?? {};

  if (!planPath || !initiativePath) {
    throw new Error('materializePair requires planPath and initiativePath');
  }
  if (typeof planContent !== 'string' || typeof initiativeContent !== 'string') {
    throw new Error('materializePair requires planContent and initiativeContent strings');
  }

  enforceSuccessorBarrierIfNeeded({
    successorBarrier,
    historyReceiptPath,
    planPath,
    planContent,
    initiativeContent,
    rootDir,
  });

  const planAbs = resolve(planPath);
  const initAbs = resolve(initiativePath);
  const markerAbs = resolve(opts.markerPath ?? defaultMarkerPath(planAbs));
  const baseDir = dirname(planAbs);

  // 1. Incomplete tx recovery FIRST (before initiative-exists guard).
  let recovered = false;
  if (existsSync(markerAbs)) {
    const rec = recoverMaterialize(markerAbs);
    recovered = true;
    if (rec.status === 'completed') {
      // After recovery both may already match desired after content.
      if (liveHash(planAbs) === sha256(planContent) && liveHash(initAbs) === sha256(initiativeContent)) {
        return { ok: true, recovered: true, idempotent: true, txId: rec.marker?.txId };
      }
    }
  }

  // Also recover if a marker exists under the default path when custom path was used? skip.

  // 2. Validate staged pair in memory — no live mutation yet.
  validateStagedPair(planContent, initiativeContent);

  // 2b. Tasks-core fingerprint vs live sidecar (R3) — refuse core rewrite.
  // Adjudicator is live sidecar tasks vs initiative tasks; missing sidecar field
  // tasksFingerprint is fine (compat). skipFingerprint for unit tests only.
  if (!opts.skipFingerprint) {
    assertTasksCoreMatchesSidecar({
      initiativePath: initAbs,
      initiativeContent,
      sidecarPath: opts.sidecarPath ?? null,
    });
  }

  const planAfterHash = sha256(planContent);
  const initAfterHash = sha256(initiativeContent);
  const planBeforeHash = liveHash(planAbs);
  const initBeforeHash = liveHash(initAbs);

  // 3. Idempotent complete: both already at after.
  if (planBeforeHash === planAfterHash && initBeforeHash === initAfterHash) {
    // Ensure no leftover marker.
    if (existsSync(markerAbs)) cleanupTx(markerAbs, readMarker(markerAbs));
    return { ok: true, idempotent: true, recovered };
  }

  // 4. Initiative already exists guard (clean state only — after recovery).
  if (initBeforeHash !== null && initBeforeHash !== initAfterHash) {
    throw new Error(
      `initiative already exists (already materialized): ${initAbs}`,
    );
  }

  // If plan already after but initiative missing — unusual; still proceed to write pair.
  // If initiative missing (before null) and plan is before → normal materialize path.

  // Tx-specific staging/backup names (Codex F-009) so concurrent materializations
  // cannot overwrite each other's prepared bytes.
  const txId = randomBytes(16).toString('hex');
  const stagePlanAbs = `${planAbs}${STAGE_SUFFIX}.${txId}`;
  const stageInitAbs = `${initAbs}${STAGE_SUFFIX}.${txId}`;
  const beforePlanAbs = planBeforeHash !== null ? `${planAbs}${BEFORE_SUFFIX}.${txId}` : null;
  const beforeInitAbs = initBeforeHash !== null ? `${initAbs}${BEFORE_SUFFIX}.${txId}` : null;

  // 5. Write staging (after content) + before backups on same filesystem.
  writeFileDurable(stagePlanAbs, planContent);
  writeFileDurable(stageInitAbs, initiativeContent);
  if (beforePlanAbs) writeFileDurable(beforePlanAbs, readFileSync(planAbs));
  if (beforeInitAbs) writeFileDurable(beforeInitAbs, readFileSync(initAbs));

  // Verify staging hashes match intended after.
  if (sha256(readFileSync(stagePlanAbs)) !== planAfterHash
    || sha256(readFileSync(stageInitAbs)) !== initAfterHash) {
    safeUnlink(stagePlanAbs);
    safeUnlink(stageInitAbs);
    if (beforePlanAbs) safeUnlink(beforePlanAbs);
    if (beforeInitAbs) safeUnlink(beforeInitAbs);
    throw new Error('materialize staging hash mismatch before marker publish');
  }

  const marker = {
    version: MARKER_VERSION,
    txId,
    createdAt: new Date().toISOString(),
    plan: {
      path: relTo(baseDir, planAbs),
      before: planBeforeHash,
      after: planAfterHash,
    },
    initiative: {
      path: relTo(baseDir, initAbs),
      before: initBeforeHash,
      after: initAfterHash,
    },
    staging: {
      plan: relTo(baseDir, stagePlanAbs),
      initiative: relTo(baseDir, stageInitAbs),
      planBefore: beforePlanAbs ? relTo(baseDir, beforePlanAbs) : null,
      initiativeBefore: beforeInitAbs ? relTo(baseDir, beforeInitAbs) : null,
    },
  };

  // 6. Persist durable marker BEFORE first rename.
  writeFileDurable(markerAbs, `${JSON.stringify(marker, null, 2)}\n`);
  if (typeof faultHooks.afterMarkerWrite === 'function') {
    faultHooks.afterMarkerWrite({ marker, markerPath: markerAbs });
  }

  // 7. Publish: initiative first, plan last.
  ensureDir(initAbs);
  renameSync(stageInitAbs, initAbs);
  if (typeof faultHooks.afterInitiativeRename === 'function') {
    faultHooks.afterInitiativeRename({ marker, initiativePath: initAbs });
  }

  ensureDir(planAbs);
  renameSync(stagePlanAbs, planAbs);
  if (typeof faultHooks.afterPlanRename === 'function') {
    faultHooks.afterPlanRename({ marker, planPath: planAbs });
  }

  if (typeof faultHooks.beforeCleanup === 'function') {
    faultHooks.beforeCleanup({ marker, markerPath: markerAbs });
  }

  // 8. Cleanup marker + before backups.
  cleanupTx(markerAbs, marker);

  return { ok: true, recovered, txId };
}

// ── History reconcile (F4/T-006) ─────────────────────────────────────────────

/**
 * Stable JSON for content-addressed digests (sorted object keys, arrays keep order).
 * Does NOT hash whole plan.md — callers pass a phase projection only.
 */
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

export function phaseDescriptorProjection(planFrontmatter, phaseId) {
  const phases = Array.isArray(planFrontmatter?.phases) ? planFrontmatter.phases : [];
  const phase = phases.find((p) => p && p.id === phaseId);
  if (!phase) {
    throw new Error(`history reconcile: plan has no phase ${phaseId}`);
  }
  return phase;
}

/** Digest of one phase descriptor only (never the whole plan.md). */
export function hashPhaseDescriptor(planContent, phaseId) {
  const parsed = parseFrontmatter(planContent);
  if (parsed.error) {
    throw new Error(`history reconcile: invalid plan frontmatter: ${parsed.error}`);
  }
  return sha256(stableStringify(phaseDescriptorProjection(parsed.frontmatter, phaseId)));
}

function relFromRoot(rootDir, absPath) {
  const rel = relative(resolve(rootDir), resolve(absPath));
  return rel.split(sep).join('/');
}

function fileEntry(rootDir, absPath) {
  if (!existsSync(absPath)) {
    throw new Error(`history reconcile: missing artifact ${absPath}`);
  }
  return {
    path: relFromRoot(rootDir, absPath),
    sha256: sha256(readFileSync(absPath)),
  };
}

function resolvePlanTree({
  rootDir,
  projectId = 'atomic-skills',
  planSlug = 'integrity-remediation',
  planPath,
}) {
  const root = resolve(rootDir ?? process.cwd());
  const planAbs = planPath
    ? resolve(planPath)
    : join(root, '.atomic-skills', 'projects', projectId, planSlug, 'plan.md');
  const planDir = dirname(planAbs);
  const phasesDir = join(planDir, 'phases');
  return { root, planAbs, planDir, phasesDir, projectId, planSlug };
}

function gateEvidenceFromInitiative(initFm) {
  const gates = Array.isArray(initFm?.exitGates) ? initFm.exitGates : [];
  const out = {};
  for (const gate of gates) {
    if (!gate || typeof gate.id !== 'string') continue;
    const evidence = gate.evidence && typeof gate.evidence === 'object' ? gate.evidence : {};
    out[gate.id] = gate.status === 'met' && evidence.passed === true;
  }
  return out;
}

function collectCompletionSlice(root, { projectId, planSlug, phaseId }) {
  const all = readCompletionLogLocal(root).filter(
    (e) => e
      && e.projectId === projectId
      && e.planSlug === planSlug
      && e.phaseId === phaseId,
  );
  const deduped = dedupeCompletionEventsLocal(all);
  const taskIds = deduped
    .filter((e) => e.event === 'task-done' && typeof e.taskId === 'string')
    .map((e) => e.taskId)
    .sort();
  const phaseDone = deduped.some((e) => e.event === 'phase-done');
  const keys = deduped.map((e) => completionEventKeyLocal(e)).filter(Boolean).sort();
  return {
    taskIds,
    phaseDone,
    keys,
    rawCount: all.length,
    uniqueCount: deduped.length,
  };
}

function listExpectedSidecars({ phasesDir, creationGate, root }) {
  const fromGate = Array.isArray(creationGate?.filesWritten)
    ? creationGate.filesWritten.filter((p) => typeof p === 'string' && p.endsWith('.source.json'))
    : [];
  if (fromGate.length > 0) {
    return fromGate.map((rel) => resolve(root, rel));
  }
  if (!existsSync(phasesDir)) return [];
  return readdirSync(phasesDir)
    .filter((name) => name.endsWith('.source.json'))
    .sort()
    .map((name) => join(phasesDir, name));
}

/**
 * Collect live F0 projection artifacts (descriptor digest, initiative, sidecars,
 * creation-gate, gate evidence, completion events). Never hashes whole plan.md.
 *
 * @returns {object} live projection used by build/check/classify
 */
export function collectHistoryLive(opts = {}) {
  const {
    phaseId = 'F0',
    creationGatePath,
    initiativePath,
  } = opts;
  const tree = resolvePlanTree(opts);
  const { root, planAbs, phasesDir, projectId, planSlug } = tree;

  if (!existsSync(planAbs)) {
    throw new Error(`history reconcile: plan not found at ${planAbs}`);
  }
  const planContent = readFileSync(planAbs, 'utf8');
  const planParsed = parseFrontmatter(planContent);
  if (planParsed.error) {
    throw new Error(`history reconcile: invalid plan: ${planParsed.error}`);
  }
  const phase = phaseDescriptorProjection(planParsed.frontmatter, phaseId);
  const descriptorSha = sha256(stableStringify(phase));

  const initAbs = initiativePath
    ? resolve(initiativePath)
    : join(phasesDir, `${phase.slug || phaseId.toLowerCase()}.md`);
  // Prefer explicit path; fall back to slug-based F0 initiative name.
  let initiativeAbs = initAbs;
  if (!existsSync(initiativeAbs) && phase.slug) {
    const alt = join(phasesDir, `${phase.slug}.md`);
    if (existsSync(alt)) initiativeAbs = alt;
  }
  if (!existsSync(initiativeAbs)) {
    // Scan phases for matching phaseId frontmatter.
    if (existsSync(phasesDir)) {
      for (const name of readdirSync(phasesDir)) {
        if (!name.endsWith('.md') || name.endsWith('.source.json')) continue;
        const candidate = join(phasesDir, name);
        const p = parseFrontmatter(readFileSync(candidate, 'utf8'));
        if (!p.error && p.frontmatter?.phaseId === phaseId) {
          initiativeAbs = candidate;
          break;
        }
      }
    }
  }
  if (!existsSync(initiativeAbs)) {
    throw new Error(`history reconcile: initiative for ${phaseId} not found under ${phasesDir}`);
  }

  const initParsed = parseFrontmatter(readFileSync(initiativeAbs, 'utf8'));
  if (initParsed.error) {
    throw new Error(`history reconcile: invalid initiative: ${initParsed.error}`);
  }
  if (initParsed.frontmatter.phaseId !== phaseId) {
    throw new Error(
      `history reconcile: initiative phaseId ${initParsed.frontmatter.phaseId} != ${phaseId}`,
    );
  }

  const gatePath = creationGatePath
    ? resolve(creationGatePath)
    : join(root, '.atomic-skills', 'status', 'creation-gates', `${projectId}-${planSlug}.json`);
  if (!existsSync(gatePath)) {
    throw new Error(`history reconcile: creation-gate missing at ${gatePath}`);
  }
  let creationGate;
  try {
    creationGate = JSON.parse(readFileSync(gatePath, 'utf8'));
  } catch (err) {
    throw new Error(`history reconcile: corrupt creation-gate: ${err.message}`);
  }

  const sidecarPaths = listExpectedSidecars({ phasesDir, creationGate, root });
  const sidecars = sidecarPaths.map((abs) => fileEntry(root, abs));
  const completions = collectCompletionSlice(root, { projectId, planSlug, phaseId });
  const gateEvidence = gateEvidenceFromInitiative(initParsed.frontmatter);

  return {
    root,
    projectId,
    planSlug,
    phaseId,
    planAbs,
    descriptor: {
      path: relFromRoot(root, planAbs),
      projection: `phase:${phaseId}`,
      sha256: descriptorSha,
      status: phase.status ?? null,
    },
    initiative: fileEntry(root, initiativeAbs),
    sidecars,
    creationGate: fileEntry(root, gatePath),
    gateEvidence,
    completionEvents: {
      taskIds: completions.taskIds,
      phaseDone: completions.phaseDone,
      keys: completions.keys,
      rawCount: completions.rawCount,
      uniqueCount: completions.uniqueCount,
    },
    initiativeStatus: initParsed.frontmatter.status ?? null,
  };
}

/**
 * Build a versioned F0 history reconciliation receipt from live artifacts.
 */
export function buildHistoryReceipt(opts = {}) {
  const live = collectHistoryLive(opts);
  const closeSha = opts.closeSha
    ?? opts.closeCommit
    ?? null;
  if (!closeSha || typeof closeSha !== 'string' || !/^[0-9a-f]{7,40}$/i.test(closeSha)) {
    throw new Error('buildHistoryReceipt requires closeSha (git SHA of F0 close)');
  }
  const classification = classifyHistoryReconcile({ live, receipt: null, mode: 'live-only' });
  if (classification.classification === 'ambiguous') {
    throw new Error(
      `buildHistoryReceipt refuse: F0 projection ambiguous (${classification.reasons.join('; ')})`,
    );
  }

  return {
    schemaVersion: HISTORY_RECEIPT_SCHEMA,
    planSlug: live.planSlug,
    phaseId: live.phaseId,
    closeSha,
    generatedAt: opts.generatedAt ?? new Date().toISOString(),
    reconciledCommit: opts.reconciledCommit ?? closeSha,
    artifacts: {
      descriptor: {
        path: live.descriptor.path,
        projection: live.descriptor.projection,
        sha256: live.descriptor.sha256,
      },
      initiative: {
        path: live.initiative.path,
        sha256: live.initiative.sha256,
      },
      sidecars: live.sidecars.map((s) => ({ path: s.path, sha256: s.sha256 })),
      creationGate: {
        path: live.creationGate.path,
        sha256: live.creationGate.sha256,
      },
      gateEvidence: { ...live.gateEvidence },
      completionEvents: {
        taskIds: [...live.completionEvents.taskIds],
        phaseDone: live.completionEvents.phaseDone,
        keys: [...live.completionEvents.keys],
      },
    },
    status: 'reconciled',
  };
}

/**
 * Classify live F0 projection vs an optional receipt.
 * - consistent: live matches receipt (or live-only is complete and coherent)
 * - repairable: duplicate completion events / mild drift with unique logical identity
 * - ambiguous: diverging hashes without unique repair key — fail closed, no writes
 */
export function classifyHistoryReconcile({ live, receipt = null, mode = 'vs-receipt' } = {}) {
  const reasons = [];
  if (!live) {
    return { classification: 'ambiguous', reasons: ['missing live projection'], repairable: false };
  }

  // Live coherence checks (always).
  if (live.initiativeStatus !== 'done' && live.descriptor?.status !== 'done') {
    reasons.push(`F0 not terminal (initiative=${live.initiativeStatus}, descriptor=${live.descriptor?.status})`);
  }
  const ge = live.gateEvidence || {};
  for (const [id, ok] of Object.entries(ge)) {
    if (ok !== true) reasons.push(`gate evidence not met: ${id}`);
  }
  if (!live.completionEvents?.phaseDone) {
    reasons.push('missing phase-done completion event');
  }
  if (!Array.isArray(live.completionEvents?.taskIds) || live.completionEvents.taskIds.length === 0) {
    reasons.push('missing task-done completion events');
  }

  let duplicateCompletions = false;
  if (
    live.completionEvents
    && live.completionEvents.rawCount > live.completionEvents.uniqueCount
  ) {
    duplicateCompletions = true;
  }

  if (mode === 'live-only' || !receipt) {
    if (reasons.length > 0) {
      return { classification: 'ambiguous', reasons, repairable: false };
    }
    if (duplicateCompletions) {
      // Unique logical keys still present after dedupe → repairable (dedupe only).
      return {
        classification: 'repairable',
        reasons: ['duplicate completion events with unique logical identity'],
        repairable: true,
      };
    }
    return { classification: 'consistent', reasons: [], repairable: false };
  }

  // Compare against receipt.
  const art = receipt.artifacts || {};
  const mismatches = [];

  if (art.descriptor?.sha256 && art.descriptor.sha256 !== live.descriptor.sha256) {
    mismatches.push('descriptor digest');
  }
  if (art.initiative?.sha256 && art.initiative.sha256 !== live.initiative.sha256) {
    mismatches.push('initiative hash');
  }
  if (art.creationGate?.sha256 && art.creationGate.sha256 !== live.creationGate.sha256) {
    mismatches.push('creation-gate hash');
  }

  const receiptSidecars = Array.isArray(art.sidecars) ? art.sidecars : [];
  const liveByPath = new Map(live.sidecars.map((s) => [s.path, s.sha256]));
  for (const s of receiptSidecars) {
    if (!liveByPath.has(s.path)) mismatches.push(`missing sidecar ${s.path}`);
    else if (liveByPath.get(s.path) !== s.sha256) mismatches.push(`sidecar hash ${s.path}`);
  }

  const receiptGates = art.gateEvidence || {};
  for (const [id, expected] of Object.entries(receiptGates)) {
    if (live.gateEvidence?.[id] !== expected) mismatches.push(`gateEvidence ${id}`);
  }

  const receiptTasks = Array.isArray(art.completionEvents?.taskIds)
    ? [...art.completionEvents.taskIds].sort()
    : [];
  const liveTasks = [...(live.completionEvents?.taskIds || [])].sort();
  if (JSON.stringify(receiptTasks) !== JSON.stringify(liveTasks)) {
    mismatches.push('completion taskIds');
  }
  if (Boolean(art.completionEvents?.phaseDone) !== Boolean(live.completionEvents?.phaseDone)) {
    mismatches.push('completion phaseDone');
  }

  if (mismatches.length === 0 && reasons.length === 0) {
    if (duplicateCompletions) {
      return {
        classification: 'repairable',
        reasons: ['duplicate completion events with unique logical identity'],
        repairable: true,
      };
    }
    return { classification: 'consistent', reasons: [], repairable: false };
  }

  // Repairable only when the sole drift is duplicate completions with unique keys
  // matching the receipt's logical identity (closeSha provides the identity anchor).
  const onlyDupes = mismatches.length === 0
    && reasons.length === 0
    && duplicateCompletions;
  if (onlyDupes && receipt.closeSha) {
    return {
      classification: 'repairable',
      reasons: ['duplicate completion events; unique keys match receipt close identity'],
      repairable: true,
    };
  }

  return {
    classification: 'ambiguous',
    reasons: [...reasons, ...mismatches.map((m) => `mismatch: ${m}`)],
    repairable: false,
  };
}

/**
 * Validate a history receipt against the live tree.
 * @returns {{ ok: true, classification: string, receipt: object, live: object }}
 * @throws on missing/stale/ambiguous
 */
export function checkHistoryReceipt(receiptPath, opts = {}) {
  const abs = resolve(receiptPath);
  if (!existsSync(abs)) {
    throw new Error(`history receipt missing: ${abs}`);
  }
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(abs, 'utf8'));
  } catch (err) {
    throw new Error(`history receipt corrupt at ${abs}: ${err.message}`);
  }
  if (!receipt || receipt.schemaVersion !== HISTORY_RECEIPT_SCHEMA) {
    throw new Error(`history receipt unsupported schemaVersion at ${abs}`);
  }
  if (receipt.status !== 'reconciled') {
    throw new Error(`history receipt status is ${receipt.status}, expected reconciled`);
  }
  if (!receipt.closeSha || !/^[0-9a-f]{7,40}$/i.test(receipt.closeSha)) {
    throw new Error('history receipt missing valid closeSha');
  }

  const live = collectHistoryLive({
    rootDir: opts.rootDir ?? process.cwd(),
    projectId: opts.projectId,
    planSlug: receipt.planSlug ?? opts.planSlug,
    phaseId: receipt.phaseId ?? opts.phaseId ?? 'F0',
    planPath: opts.planPath,
    initiativePath: opts.initiativePath,
    creationGatePath: opts.creationGatePath,
  });

  const classification = classifyHistoryReconcile({ live, receipt, mode: 'vs-receipt' });
  if (classification.classification === 'ambiguous') {
    throw new Error(
      `history receipt stale or ambiguous: ${classification.reasons.join('; ')}`,
    );
  }
  // consistent and repairable both pass the check (repairable still authenticates).
  return {
    ok: true,
    classification: classification.classification,
    receipt,
    live,
  };
}

export function writeHistoryReceipt(receiptPath, opts = {}) {
  const receipt = buildHistoryReceipt(opts);
  const abs = resolve(receiptPath);
  ensureDir(abs);
  writeFileDurable(abs, `${JSON.stringify(receipt, null, 2)}\n`);
  return { ok: true, path: abs, receipt };
}

// ── Successor barrier (F4-G3 non-deferrable) ─────────────────────────────────

function parsePlanInput(plan) {
  if (plan == null) return null;
  if (typeof plan === 'string') {
    const parsed = parseFrontmatter(plan);
    if (parsed.error) throw new Error(`successor barrier: invalid plan: ${parsed.error}`);
    return parsed.frontmatter;
  }
  if (typeof plan === 'object' && !Array.isArray(plan)) {
    if (Array.isArray(plan.phases)) return plan;
    if (plan.frontmatter && Array.isArray(plan.frontmatter.phases)) return plan.frontmatter;
  }
  throw new Error('successor barrier: plan must be frontmatter object or markdown content');
}

/** True when phaseId transitively depends on ancestorId via dependsOn[]. */
export function phaseDependsOn(planFm, phaseId, ancestorId, seen = new Set()) {
  if (!phaseId || phaseId === ancestorId) return false;
  if (seen.has(phaseId)) return false;
  seen.add(phaseId);
  const phases = Array.isArray(planFm?.phases) ? planFm.phases : [];
  const phase = phases.find((p) => p && p.id === phaseId);
  if (!phase) return false;
  const deps = Array.isArray(phase.dependsOn) ? phase.dependsOn : [];
  if (deps.includes(ancestorId)) return true;
  return deps.some((d) => phaseDependsOn(planFm, d, ancestorId, seen));
}

function exitGateStatus(planFm, phaseId, gateId) {
  const phases = Array.isArray(planFm?.phases) ? planFm.phases : [];
  const phase = phases.find((p) => p && p.id === phaseId);
  if (!phase) return null;
  const criteria = phase.exitGate?.criteria;
  if (Array.isArray(criteria)) {
    const gate = criteria.find((g) => g && g.id === gateId);
    if (gate) return gate.status ?? 'pending';
  }
  if (Array.isArray(phase.exitGates)) {
    const gate = phase.exitGates.find((g) => g && g.id === gateId);
    if (gate) return gate.status ?? 'pending';
  }
  return null;
}

/**
 * Refuse activation/materialization of any F4 successor when F4-G3 is not met
 * or the F0 history receipt is missing/stale.
 *
 * @param {object} opts
 * @param {object|string} opts.plan plan frontmatter or markdown
 * @param {string} opts.f4ReceiptPath path to F0 reconciliation receipt (F4-G3 evidence)
 * @param {string} opts.targetPhaseId phase being activated/materialized
 * @param {string} [opts.rootDir]
 * @param {string} [opts.barrierPhaseId='F4']
 * @param {string} [opts.barrierGateId='F4-G3']
 * @param {boolean} [opts.requireTerminal=true] F4 must be status done
 * @returns {{ ok: true, skipped?: boolean, reason?: string, check?: object }}
 */
export function assertSuccessorBarrier(opts = {}) {
  const {
    plan,
    planPath,
    f4ReceiptPath,
    targetPhaseId,
    rootDir = process.cwd(),
    barrierPhaseId = DEFAULT_BARRIER_PHASE,
    barrierGateId = DEFAULT_BARRIER_GATE,
    requireTerminal = true,
  } = opts;

  if (!targetPhaseId) {
    throw new Error('assertSuccessorBarrier requires targetPhaseId');
  }

  let planFm = plan != null ? parsePlanInput(plan) : null;
  if (!planFm && planPath) {
    planFm = parsePlanInput(readFileSync(resolve(planPath), 'utf8'));
  }
  if (!planFm) {
    throw new Error('assertSuccessorBarrier requires plan or planPath');
  }

  // Barrier only applies to successors of F4 (direct or transitive).
  if (!phaseDependsOn(planFm, targetPhaseId, barrierPhaseId)) {
    return {
      ok: true,
      skipped: true,
      reason: `${targetPhaseId} does not depend on ${barrierPhaseId}`,
    };
  }

  const barrierPhase = (planFm.phases || []).find((p) => p && p.id === barrierPhaseId);
  if (!barrierPhase) {
    throw new Error(
      `successor barrier: plan missing barrier phase ${barrierPhaseId} while materializing ${targetPhaseId}`,
    );
  }

  if (requireTerminal && barrierPhase.status !== 'done') {
    throw new Error(
      `successor barrier: refuse ${targetPhaseId} — ${barrierPhaseId} status is ${barrierPhase.status ?? 'unknown'}, must be done (F4-G3 non-deferrable)`,
    );
  }

  const gateStatus = exitGateStatus(planFm, barrierPhaseId, barrierGateId);
  if (gateStatus !== 'met') {
    throw new Error(
      `successor barrier: refuse ${targetPhaseId} — ${barrierGateId} is ${gateStatus ?? 'missing'} (pending/failed/deferred cannot unlock successors)`,
    );
  }

  const receiptPath = f4ReceiptPath
    ?? join(rootDir, DEFAULT_F0_RECEIPT_REL);
  if (!existsSync(resolve(receiptPath))) {
    throw new Error(
      `successor barrier: refuse ${targetPhaseId} — F4 close/history receipt missing at ${receiptPath}`,
    );
  }

  let check;
  try {
    check = checkHistoryReceipt(receiptPath, { rootDir, planPath: planPath ?? undefined });
  } catch (err) {
    throw new Error(
      `successor barrier: refuse ${targetPhaseId} — history receipt invalid/stale: ${err.message}`,
    );
  }

  return { ok: true, skipped: false, check };
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function printUsage() {
  console.error(`Usage:
  node scripts/materialize-state.js --plan <path> --initiative <path> \\
    --plan-file <new-plan-content> --initiative-file <new-initiative-content>
  node scripts/materialize-state.js --recover [<marker-path>]
  node scripts/materialize-state.js --check-history-receipt <receipt.json>
  node scripts/materialize-state.js --write-history-receipt <receipt.json> \\
    --close-sha <sha> [--plan <plan.md>] [--root <dir>]
  node scripts/materialize-state.js --require-f4-barrier --plan <plan.md> \\
    --target-phase <id> [--receipt <receipt.json>]
`);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--plan') out.plan = argv[++i];
    else if (a === '--initiative') out.initiative = argv[++i];
    else if (a === '--plan-file') out.planFile = argv[++i];
    else if (a === '--initiative-file') out.initiativeFile = argv[++i];
    else if (a === '--marker') out.marker = argv[++i];
    else if (a === '--recover') {
      out.recover = true;
      if (argv[i + 1] && !argv[i + 1].startsWith('--')) out.marker = argv[++i];
    } else if (a === '--check-history-receipt') {
      out.checkHistoryReceipt = true;
      out.receipt = argv[++i];
    } else if (a === '--write-history-receipt') {
      out.writeHistoryReceipt = true;
      out.receipt = argv[++i];
    } else if (a === '--require-f4-barrier') {
      out.requireF4Barrier = true;
    } else if (a === '--receipt') out.receipt = argv[++i];
    else if (a === '--target-phase') out.targetPhase = argv[++i];
    else if (a === '--close-sha') out.closeSha = argv[++i];
    else if (a === '--root') out.root = argv[++i];
    else if (a === '--project') out.projectId = argv[++i];
    else if (a === '--plan-slug') out.planSlug = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return out;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printUsage();
    return 0;
  }
  if (args.checkHistoryReceipt) {
    if (!args.receipt) {
      printUsage();
      throw new Error('--check-history-receipt requires <receipt.json>');
    }
    const res = checkHistoryReceipt(args.receipt, {
      rootDir: args.root ?? process.cwd(),
      projectId: args.projectId,
      planSlug: args.planSlug,
      planPath: args.plan,
    });
    console.log(JSON.stringify({
      ok: true,
      classification: res.classification,
      closeSha: res.receipt.closeSha,
      status: res.receipt.status,
    }));
    return 0;
  }
  if (args.writeHistoryReceipt) {
    if (!args.receipt) {
      printUsage();
      throw new Error('--write-history-receipt requires <receipt.json>');
    }
    if (!args.closeSha) {
      throw new Error('--write-history-receipt requires --close-sha <sha>');
    }
    const res = writeHistoryReceipt(args.receipt, {
      rootDir: args.root ?? process.cwd(),
      projectId: args.projectId,
      planSlug: args.planSlug,
      planPath: args.plan,
      closeSha: args.closeSha,
    });
    console.log(JSON.stringify({ ok: true, path: res.path, closeSha: res.receipt.closeSha }));
    return 0;
  }
  if (args.requireF4Barrier) {
    if (!args.plan || !args.targetPhase) {
      printUsage();
      throw new Error('--require-f4-barrier requires --plan and --target-phase');
    }
    const res = assertSuccessorBarrier({
      planPath: args.plan,
      targetPhaseId: args.targetPhase,
      f4ReceiptPath: args.receipt,
      rootDir: args.root ?? process.cwd(),
    });
    console.log(JSON.stringify(res));
    return 0;
  }
  if (args.recover) {
    const marker = args.marker
      || (args.plan ? defaultMarkerPath(args.plan) : null);
    if (!marker) {
      printUsage();
      throw new Error('--recover requires <marker-path> or --plan');
    }
    const res = recoverMaterialize(marker);
    console.log(JSON.stringify(res));
    return 0;
  }
  if (!args.plan || !args.initiative || !args.planFile || !args.initiativeFile) {
    printUsage();
    throw new Error('materialize requires --plan --initiative --plan-file --initiative-file');
  }
  const res = materializePair({
    planPath: args.plan,
    initiativePath: args.initiative,
    planContent: readFileSync(args.planFile, 'utf8'),
    initiativeContent: readFileSync(args.initiativeFile, 'utf8'),
    markerPath: args.marker,
  });
  console.log(JSON.stringify(res));
  return 0;
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    process.exitCode = main();
  } catch (err) {
    console.error(`materialize-state: ${err.message}`);
    process.exitCode = 1;
  }
}
