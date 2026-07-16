#!/usr/bin/env node
/**
 * materialize-state.js — recoverable plan+initiative materialization primitive.
 *
 * Single authority for descriptor-only → initiative publish (F0/T-005 bootstrap).
 * Prepares both files in staging, validates the staged pair, persists a durable
 * marker with SHA-256 before/after digests, then renames initiative first and
 * plan last. Incomplete transactions recover via the marker before any
 * "initiative already exists" guard.
 *
 * API:
 *   materializePair({ planPath, initiativePath, planContent, initiativeContent, markerPath?, faultHooks? })
 *   recoverMaterialize(markerPath)
 *   defaultMarkerPath(planPath)
 *
 * CLI:
 *   node scripts/materialize-state.js --plan <path> --initiative <path> \
 *     --plan-file <new-plan> --initiative-file <new-initiative>
 *   node scripts/materialize-state.js --recover [<marker-path>]
 */
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from './validate-state.js';

const MARKER_SUFFIX = '.materialize-tx.json';
const STAGE_SUFFIX = '.materialize-stage';
const BEFORE_SUFFIX = '.materialize-before';
const MARKER_VERSION = 1;

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

function absFrom(baseDir, maybeRel) {
  if (!maybeRel) return null;
  return isAbsolute(maybeRel) ? maybeRel : join(baseDir, maybeRel);
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
  return marker;
}

function cleanupTx(markerPath, marker) {
  const baseDir = dirname(resolve(markerPath));
  const staging = marker.staging || {};
  for (const key of ['plan', 'initiative', 'planBefore', 'initiativeBefore']) {
    const p = absFrom(baseDir, staging[key]);
    if (p) safeUnlink(p);
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
 * Publish planContent + initiativeContent via recoverable two-rename transaction.
 *
 * @param {object} opts
 * @param {string} opts.planPath
 * @param {string} opts.initiativePath
 * @param {string} opts.planContent
 * @param {string} opts.initiativeContent
 * @param {string} [opts.markerPath]
 * @param {object} [opts.faultHooks]
 * @returns {{ ok: true, recovered?: boolean, idempotent?: boolean, txId?: string }}
 */
export function materializePair(opts) {
  const {
    planPath,
    initiativePath,
    planContent,
    initiativeContent,
    faultHooks = {},
  } = opts ?? {};

  if (!planPath || !initiativePath) {
    throw new Error('materializePair requires planPath and initiativePath');
  }
  if (typeof planContent !== 'string' || typeof initiativeContent !== 'string') {
    throw new Error('materializePair requires planContent and initiativeContent strings');
  }

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

  const stagePlanAbs = `${planAbs}${STAGE_SUFFIX}`;
  const stageInitAbs = `${initAbs}${STAGE_SUFFIX}`;
  const beforePlanAbs = planBeforeHash !== null ? `${planAbs}${BEFORE_SUFFIX}` : null;
  const beforeInitAbs = initBeforeHash !== null ? `${initAbs}${BEFORE_SUFFIX}` : null;

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

  const txId = randomBytes(16).toString('hex');
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

// ── CLI ─────────────────────────────────────────────────────────────────────

function printUsage() {
  console.error(`Usage:
  node scripts/materialize-state.js --plan <path> --initiative <path> \\
    --plan-file <new-plan-content> --initiative-file <new-initiative-content>
  node scripts/materialize-state.js --recover [<marker-path>]
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
    } else if (a === '--help' || a === '-h') out.help = true;
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
