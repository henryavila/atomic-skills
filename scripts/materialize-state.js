#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import Ajv from 'ajv/dist/2020.js';
import { parseFrontmatter, validateFile } from './validate-state.js';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(SCRIPT_DIR, '..');
const MARKER_NAME = '.materialize-state.json';
const REQUIRED_SCHEMAS = ['common.schema.json', 'plan.schema.json', 'initiative.schema.json'];

function hashBytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function hashFile(path) {
  return existsSync(path) ? hashBytes(readFileSync(path)) : null;
}

function safeRelativePath(root, input, label) {
  if (typeof input !== 'string' || input.length === 0 || isAbsolute(input)) {
    throw new Error(`${label} must be a non-empty path relative to root`);
  }
  const absolute = resolve(root, input);
  const rel = relative(root, absolute);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`${label} escapes root`);
  }
  return rel;
}

function fsyncPath(path) {
  const fd = openSync(path, 'r');
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function durableWrite(path, bytes, flag = 'w') {
  mkdirSync(dirname(path), { recursive: true });
  const fd = openSync(path, flag, 0o600);
  try {
    writeFileSync(fd, bytes);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  fsyncPath(dirname(path));
}

function durableRename(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  renameSync(from, to);
  fsyncPath(dirname(to));
  if (dirname(from) !== dirname(to) && existsSync(dirname(from))) fsyncPath(dirname(from));
}

function durableUnlink(path) {
  if (!existsSync(path)) return;
  unlinkSync(path);
  fsyncPath(dirname(path));
}

function validators() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  for (const name of REQUIRED_SCHEMAS) {
    ajv.addSchema(JSON.parse(readFileSync(join(PACKAGE_ROOT, 'meta', 'schemas', name), 'utf8')));
  }
  return {
    validatePlan: ajv.getSchema('https://atomic-skills.henryavila.com/schemas/plan.schema.json'),
    validateInitiative: ajv.getSchema('https://atomic-skills.henryavila.com/schemas/initiative.schema.json'),
  };
}

function validateStagedPair(planPath, initiativePath) {
  const schemaValidators = validators();
  const planResult = validateFile(planPath, schemaValidators);
  const initiativeResult = validateFile(initiativePath, schemaValidators);
  const errors = [
    ...planResult.errors.map((error) => `plan: ${error}`),
    ...initiativeResult.errors.map((error) => `initiative: ${error}`),
  ];
  if (errors.length > 0) throw new Error(`staged pair validation failed: ${errors.join('; ')}`);

  const plan = parseFrontmatter(readFileSync(planPath, 'utf8')).frontmatter;
  const initiative = parseFrontmatter(readFileSync(initiativePath, 'utf8')).frontmatter;
  const descriptor = plan.phases?.find((phase) => phase.id === initiative.phaseId);
  if (initiative.parentPlan !== plan.slug) errors.push('initiative parentPlan does not match plan slug');
  if (!descriptor) errors.push('plan has no descriptor matching initiative phaseId');
  if (descriptor?.slug !== initiative.slug) errors.push('descriptor slug does not match initiative slug');
  if (descriptor?.status !== 'active') errors.push('materialized descriptor is not active');
  if (initiative.status !== 'active') errors.push('materialized initiative is not active');
  if (descriptor?.subPhaseCount !== initiative.tasks?.length) {
    errors.push('descriptor subPhaseCount does not match initiative task count');
  }
  if (!isDeepStrictEqual(descriptor?.businessIntent, initiative.businessIntent)) {
    errors.push('descriptor businessIntent does not match initiative businessIntent');
  }
  const current = plan.phases?.find((phase) => phase.id === plan.currentPhase);
  if (!current || current.status !== 'active') errors.push('plan currentPhase is not an active descriptor');
  if (errors.length > 0) throw new Error(`staged pair validation failed: ${errors.join('; ')}`);
}

function readMarker(markerPath, root) {
  let marker;
  try {
    marker = JSON.parse(readFileSync(markerPath, 'utf8'));
  } catch (error) {
    throw new Error(`pending materialization marker is unreadable: ${error.message}`);
  }
  if (marker?.version !== 1 || typeof marker.txId !== 'string') {
    throw new Error('pending materialization marker has an unsupported shape');
  }
  for (const [label, value] of Object.entries(marker.paths ?? {})) {
    marker.paths[label] = safeRelativePath(root, value, `marker paths.${label}`);
  }
  for (const required of ['plan', 'initiative', 'stagedPlan', 'stagedInitiative', 'beforePlan']) {
    if (!marker.paths?.[required]) throw new Error(`pending materialization marker lacks paths.${required}`);
  }
  for (const kind of ['plan', 'initiative']) {
    const before = marker.hashes?.[kind]?.before;
    const after = marker.hashes?.[kind]?.after;
    if ((before !== null && !/^[a-f0-9]{64}$/.test(before)) || !/^[a-f0-9]{64}$/.test(after ?? '')) {
      throw new Error(`pending materialization marker has invalid ${kind} hashes`);
    }
  }
  return marker;
}

function cleanup(root, markerPath, marker) {
  durableUnlink(markerPath);
  const txDir = resolve(root, marker.paths.txDir);
  rmSync(txDir, { recursive: true, force: true });
  if (existsSync(dirname(txDir))) fsyncPath(dirname(txDir));
}

function injectFault(point, selected) {
  if (selected === point || process.env.MATERIALIZE_STATE_FAULT === point) {
    throw new Error(`fault injection: ${point}`);
  }
}

function recover(root, markerPath, marker, faultAt) {
  const absolute = Object.fromEntries(
    Object.entries(marker.paths).map(([key, value]) => [key, resolve(root, value)]),
  );
  const live = {
    plan: hashFile(absolute.plan),
    initiative: hashFile(absolute.initiative),
  };
  for (const kind of ['plan', 'initiative']) {
    const allowed = new Set([marker.hashes[kind].before, marker.hashes[kind].after]);
    if (!allowed.has(live[kind])) {
      throw new Error(`ambiguous live ${kind} hash; refusing recovery without writes`);
    }
  }

  if (live.plan === marker.hashes.plan.after && live.initiative === marker.hashes.initiative.after) {
    cleanup(root, markerPath, marker);
    return { status: 'complete', txId: marker.txId, recovered: true };
  }

  const planNeedsPublish = live.plan === marker.hashes.plan.before;
  const initiativeNeedsPublish = live.initiative === marker.hashes.initiative.before;
  const stagedPlanReady = !planNeedsPublish || hashFile(absolute.stagedPlan) === marker.hashes.plan.after;
  const stagedInitiativeReady = !initiativeNeedsPublish
    || hashFile(absolute.stagedInitiative) === marker.hashes.initiative.after;

  if (stagedPlanReady && stagedInitiativeReady) {
    if (initiativeNeedsPublish) {
      durableRename(absolute.stagedInitiative, absolute.initiative);
      injectFault('after-initiative-rename', faultAt);
    }
    if (planNeedsPublish) {
      durableRename(absolute.stagedPlan, absolute.plan);
      injectFault('after-plan-rename', faultAt);
    }
    cleanup(root, markerPath, marker);
    return { status: 'complete', txId: marker.txId, recovered: true };
  }

  // A lost staged file makes roll-forward impossible. Restore the descriptor
  // first so rollback never creates an active-plan-without-initiative window.
  if (live.plan === marker.hashes.plan.after) {
    if (hashFile(absolute.beforePlan) !== marker.hashes.plan.before) {
      throw new Error('rollback plan backup is missing or corrupt; refusing writes');
    }
    durableRename(absolute.beforePlan, absolute.plan);
  }
  if (live.initiative === marker.hashes.initiative.after) {
    if (marker.hashes.initiative.before === null) {
      durableUnlink(absolute.initiative);
    } else {
      if (!absolute.beforeInitiative
          || hashFile(absolute.beforeInitiative) !== marker.hashes.initiative.before) {
        throw new Error('rollback initiative backup is missing or corrupt; refusing writes');
      }
      durableRename(absolute.beforeInitiative, absolute.initiative);
    }
  }
  cleanup(root, markerPath, marker);
  return { status: 'rolled-back', txId: marker.txId, recovered: true };
}

/**
 * Publish one descriptor-only -> initiative transition as a recoverable pair.
 * Candidate contents are copied to same-filesystem staging and validated before
 * the immutable marker or either live path is touched.
 */
export function materializeState({
  root = process.cwd(),
  planPath,
  initiativePath,
  planContent,
  initiativeContent,
  txId = randomUUID(),
  faultAt = null,
} = {}) {
  const absoluteRoot = resolve(root);
  const planRel = safeRelativePath(absoluteRoot, planPath, 'planPath');
  const initiativeRel = safeRelativePath(absoluteRoot, initiativePath, 'initiativePath');
  const planLive = resolve(absoluteRoot, planRel);
  const initiativeLive = resolve(absoluteRoot, initiativeRel);
  const markerPath = join(dirname(planLive), MARKER_NAME);

  // Recovery is deliberately first: after the initiative rename, existence is
  // evidence of an interrupted transaction, not an "already materialized" guard.
  if (existsSync(markerPath)) {
    const marker = readMarker(markerPath, absoluteRoot);
    if (marker.paths.plan !== planRel || marker.paths.initiative !== initiativeRel) {
      throw new Error('pending materialization marker targets different live paths; refusing writes');
    }
    return recover(absoluteRoot, markerPath, marker, faultAt);
  }
  if (existsSync(initiativeLive)) {
    if (typeof planContent === 'string'
        && typeof initiativeContent === 'string'
        && hashFile(planLive) === hashBytes(planContent)
        && hashFile(initiativeLive) === hashBytes(initiativeContent)) {
      return { status: 'complete', txId: null, recovered: false, idempotent: true };
    }
    throw new Error('initiative already exists');
  }
  if (!existsSync(planLive)) throw new Error('live plan does not exist');
  if (typeof planContent !== 'string' || typeof initiativeContent !== 'string') {
    throw new Error('planContent and initiativeContent are required for a new transaction');
  }
  if (typeof txId !== 'string' || !/^[A-Za-z0-9._-]+$/.test(txId)) {
    throw new Error('txId must contain only letters, digits, dot, underscore, or hyphen');
  }

  const txDirRel = join(dirname(planRel), `.materialize-state-${txId}`);
  const stagedPlanRel = join(txDirRel, 'stage', planRel);
  const stagedInitiativeRel = join(txDirRel, 'stage', initiativeRel);
  const beforePlanRel = join(txDirRel, 'before', planRel);
  const stagedPlan = resolve(absoluteRoot, stagedPlanRel);
  const stagedInitiative = resolve(absoluteRoot, stagedInitiativeRel);
  const beforePlan = resolve(absoluteRoot, beforePlanRel);
  const txDir = resolve(absoluteRoot, txDirRel);

  try {
    durableWrite(stagedPlan, planContent);
    durableWrite(stagedInitiative, initiativeContent);
    validateStagedPair(stagedPlan, stagedInitiative);

    const planBeforeBytes = readFileSync(planLive);
    durableWrite(beforePlan, planBeforeBytes);
    const marker = {
      version: 1,
      operation: 'descriptor-only-to-initiative',
      txId,
      paths: {
        txDir: txDirRel,
        plan: planRel,
        initiative: initiativeRel,
        stagedPlan: stagedPlanRel,
        stagedInitiative: stagedInitiativeRel,
        beforePlan: beforePlanRel,
      },
      hashes: {
        plan: { before: hashBytes(planBeforeBytes), after: hashBytes(planContent) },
        initiative: { before: null, after: hashBytes(initiativeContent) },
      },
    };
    durableWrite(markerPath, `${JSON.stringify(marker, null, 2)}\n`, 'wx');
    return recover(absoluteRoot, markerPath, marker, faultAt);
  } catch (error) {
    if (!existsSync(markerPath)) rmSync(txDir, { recursive: true, force: true });
    throw error;
  }
}

function option(args, name, { required = false } = {}) {
  const index = args.indexOf(name);
  if (index === -1) {
    if (required) throw new Error(`missing required option ${name}`);
    return null;
  }
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`option ${name} requires a value`);
  return value;
}

export function runMaterializeState(args, io = console) {
  const root = option(args, '--root') ?? process.cwd();
  const planPath = option(args, '--plan', { required: true });
  const initiativePath = option(args, '--initiative', { required: true });
  const planCandidate = option(args, '--plan-candidate');
  const initiativeCandidate = option(args, '--initiative-candidate');
  const result = materializeState({
    root,
    planPath,
    initiativePath,
    planContent: planCandidate ? readFileSync(resolve(root, planCandidate), 'utf8') : undefined,
    initiativeContent: initiativeCandidate ? readFileSync(resolve(root, initiativeCandidate), 'utf8') : undefined,
    txId: option(args, '--tx-id') ?? randomUUID(),
    faultAt: option(args, '--fault'),
  });
  io.log(JSON.stringify(result));
  return result;
}

const invokedDirectly = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  try {
    runMaterializeState(process.argv.slice(2));
  } catch (error) {
    console.error(`materialize-state: ${error.message}`);
    process.exitCode = 1;
  }
}
