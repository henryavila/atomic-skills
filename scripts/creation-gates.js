#!/usr/bin/env node
/**
 * creation-gates.js — helpers for monotonic `stage` on the new-plan creation
 * run record at `.atomic-skills/status/creation-gates/<projectId>-<slug>.json`.
 *
 * Ordered stages (Decision 11 / assert-creation-stage + process-map Iron Law):
 *   slug → design → source → decompose-confirm → bi-ratified →
 *   materialized → summaries → process-map → reviews → ready
 *
 * `process-map` is mandatory (docs/kb/process-map.md): L1 process.yaml + L2 map.html
 * before reviews/ready. Skipping it is illegal.
 *
 * Advance is monotonic only: you may stay or move forward one-or-more steps
 * only via `assertAdvance` / `advanceCreationStage` after the current stage
 * closed. Skipping stages or declaring `ready` early fails closed.
 *
 * CLI:
 *   node scripts/creation-gates.js read   <path-or-root> [projectId] [slug]
 *   node scripts/creation-gates.js create <state-root> <projectId> <slug> [--json '{}']
 *   node scripts/creation-gates.js advance <path> --to <stage>
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SCHEMA_VERSION = '0.1';

/**
 * Fixed stage order for multi-phase `new plan` creation.
 * Index 0 is the first stage after gate create; last is terminal `ready`.
 */
export const CREATION_STAGES = Object.freeze([
  'slug',
  'design',
  'source',
  'decompose-confirm',
  'bi-ratified',
  'materialized',
  'summaries',
  'process-map',
  'reviews',
  'ready',
]);

export const STAGE_INDEX = Object.freeze(
  Object.fromEntries(CREATION_STAGES.map((s, i) => [s, i])),
);

/**
 * Absolute path of the creation-gates receipt.
 * @param {string} stateRoot - repo root or `.atomic-skills` root
 * @param {string} projectId
 * @param {string} slug
 */
export function creationGatePath(stateRoot, projectId, slug) {
  const root = resolveStateRoot(stateRoot);
  const file = `${sanitizeId(projectId)}-${sanitizeId(slug)}.json`;
  return join(root, 'status', 'creation-gates', file);
}

/**
 * @param {string} pathOrRoot
 * @param {string} [projectId]
 * @param {string} [slug]
 * @returns {object|null}
 */
export function readCreationGate(pathOrRoot, projectId, slug) {
  const path =
    projectId != null && slug != null
      ? creationGatePath(pathOrRoot, projectId, slug)
      : resolve(pathOrRoot);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new Error(`creation-gates: corrupt receipt at ${path}: ${err.message}`);
  }
}

/**
 * Build a v0.1 creation-gate record (does not write).
 * @param {object} partial
 */
export function buildCreationGate(partial = {}) {
  const stage = partial.stage != null ? String(partial.stage) : CREATION_STAGES[0];
  if (!CREATION_STAGES.includes(stage)) {
    throw new Error(
      `creation-gates: unknown stage '${stage}' (allowed: ${CREATION_STAGES.join(', ')})`,
    );
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: partial.kind != null ? String(partial.kind) : 'new-plan',
    projectId: partial.projectId != null ? String(partial.projectId) : '',
    slug: partial.slug != null ? String(partial.slug) : '',
    sourcePath: partial.sourcePath != null ? partial.sourcePath : null,
    stage,
    businessIntentAccepted: partial.businessIntentAccepted === true,
    filesPlanned: Array.isArray(partial.filesPlanned) ? [...partial.filesPlanned] : [],
    filesWritten: Array.isArray(partial.filesWritten) ? [...partial.filesWritten] : [],
    status: partial.status != null ? String(partial.status) : 'pending',
    updatedAt: partial.updatedAt || new Date().toISOString(),
  };
}

/**
 * Create a new creation-gate file.
 * @param {string} stateRoot
 * @param {string} projectId
 * @param {string} slug
 * @param {object} [partial]
 * @param {{ overwrite?: boolean }} [opts]
 */
export function createCreationGate(stateRoot, projectId, slug, partial = {}, opts = {}) {
  const path = creationGatePath(stateRoot, projectId, slug);
  if (existsSync(path) && !opts.overwrite) {
    throw new Error(`creation-gates: receipt already exists at ${path}`);
  }
  const gate = buildCreationGate({
    ...partial,
    projectId,
    slug,
    updatedAt: new Date().toISOString(),
  });
  writeGate(path, gate);
  return gate;
}

/**
 * Whether advancing from `fromStage` to `toStage` is a legal monotonic move.
 * Same stage is allowed (idempotent). Forward-only; no reverse, no skip check
 * here beyond "to must be >= from". Skip of intermediate stages is a policy
 * enforced by `assertCanAdvance` when `opts.allowSkip` is false (default).
 *
 * @param {string} fromStage
 * @param {string} toStage
 * @param {{ allowSkip?: boolean }} [opts]
 * @returns {{ ok: boolean, reason?: string }}
 */
export function assertCanAdvance(fromStage, toStage, opts = {}) {
  const allowSkip = opts.allowSkip === true;
  if (!CREATION_STAGES.includes(fromStage)) {
    return { ok: false, reason: `unknown-from-stage:${fromStage}` };
  }
  if (!CREATION_STAGES.includes(toStage)) {
    return { ok: false, reason: `unknown-to-stage:${toStage}` };
  }
  const fromIdx = STAGE_INDEX[fromStage];
  const toIdx = STAGE_INDEX[toStage];
  if (toIdx < fromIdx) {
    return { ok: false, reason: `reverse-stage:${fromStage}->${toStage}` };
  }
  if (toIdx === fromIdx) {
    return { ok: true };
  }
  if (!allowSkip && toIdx > fromIdx + 1) {
    return {
      ok: false,
      reason: `illegal-stage-skip:${fromStage}->${toStage} (next is ${CREATION_STAGES[fromIdx + 1]})`,
    };
  }
  return { ok: true };
}

/**
 * Advance the gate on disk to `toStage` if legal.
 * @param {string} path - absolute path to creation-gates JSON
 * @param {string} toStage
 * @param {{ allowSkip?: boolean, patch?: object }} [opts]
 * @returns {object} updated gate
 */
export function advanceCreationStage(path, toStage, opts = {}) {
  const abs = resolve(path);
  if (!existsSync(abs)) {
    throw new Error(`creation-gates: missing file ${abs}`);
  }
  let gate;
  try {
    gate = JSON.parse(readFileSync(abs, 'utf8'));
  } catch (err) {
    throw new Error(`creation-gates: corrupt ${abs}: ${err.message}`);
  }
  const fromStage = gate.stage != null ? String(gate.stage) : CREATION_STAGES[0];
  const check = assertCanAdvance(fromStage, toStage, opts);
  if (!check.ok) {
    const err = new Error(`creation-gates: ${check.reason}`);
    err.code = 'ILLEGAL_STAGE_ADVANCE';
    err.reason = check.reason;
    throw err;
  }
  const next = {
    ...gate,
    ...(opts.patch && typeof opts.patch === 'object' ? opts.patch : {}),
    stage: toStage,
    updatedAt: new Date().toISOString(),
  };
  writeGate(abs, next);
  return next;
}

/**
 * Validate that a gate's `stage` field is a known stage.
 * @param {object} gate
 * @returns {string[]} issues
 */
export function validateCreationGateStage(gate) {
  const issues = [];
  if (!gate || typeof gate !== 'object') {
    return ['missing-gate'];
  }
  if (gate.schemaVersion !== SCHEMA_VERSION) {
    issues.push(`bad-schemaVersion:${gate.schemaVersion}`);
  }
  if (gate.stage == null || !CREATION_STAGES.includes(String(gate.stage))) {
    issues.push(`invalid-stage:${gate.stage}`);
  }
  return issues;
}

// ── internals ──────────────────────────────────────────────────────────────

function resolveStateRoot(stateRoot) {
  const target = resolve(stateRoot);
  if (existsSync(join(target, 'status'))) return target;
  if (existsSync(join(target, '.atomic-skills'))) return join(target, '.atomic-skills');
  return join(target, '.atomic-skills');
}

function sanitizeId(id) {
  return String(id).replace(/[/\\]/g, '-');
}

function writeGate(path, gate) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
}

// ── CLI ────────────────────────────────────────────────────────────────────

function parseJsonFlag(argv) {
  const idx = argv.indexOf('--json');
  if (idx === -1) return {};
  const raw = argv[idx + 1];
  if (!raw) throw new Error('creation-gates: --json requires a value');
  return JSON.parse(raw);
}

function main(argv) {
  const [cmd, ...rest] = argv;
  if (!cmd) {
    console.error(
      'usage: creation-gates.js <read|create|advance|stages> ...',
    );
    process.exit(2);
  }
  try {
    if (cmd === 'stages') {
      console.log(CREATION_STAGES.join('\n'));
      process.exit(0);
    }
    if (cmd === 'read') {
      const [pathOrRoot, projectId, slug] = rest;
      if (!pathOrRoot) {
        console.error('usage: creation-gates.js read <path|root> [projectId] [slug]');
        process.exit(2);
      }
      const gate = readCreationGate(pathOrRoot, projectId, slug);
      if (!gate) {
        console.error('creation-gates: missing');
        process.exit(1);
      }
      console.log(JSON.stringify(gate, null, 2));
      process.exit(0);
    }
    if (cmd === 'create') {
      const [stateRoot, projectId, slug, ...flags] = rest;
      if (!stateRoot || !projectId || !slug) {
        console.error('usage: creation-gates.js create <state-root> <projectId> <slug> [--json]');
        process.exit(2);
      }
      const partial = parseJsonFlag(flags);
      const gate = createCreationGate(stateRoot, projectId, slug, partial);
      console.log(JSON.stringify(gate, null, 2));
      process.exit(0);
    }
    if (cmd === 'advance') {
      const path = rest[0];
      const toIdx = rest.indexOf('--to');
      const toStage = toIdx >= 0 ? rest[toIdx + 1] : null;
      if (!path || !toStage) {
        console.error('usage: creation-gates.js advance <path> --to <stage>');
        process.exit(2);
      }
      const gate = advanceCreationStage(path, toStage);
      console.log(JSON.stringify(gate, null, 2));
      process.exit(0);
    }
    console.error(`creation-gates: unknown command ${cmd}`);
    process.exit(2);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
