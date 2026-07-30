#!/usr/bin/env node
/**
 * design-gates.js — durable process receipt for multi-phase DESIGN
 * (Interview → research → debate → critic → user approval).
 *
 * Path: .atomic-skills/status/design-gates/<projectId>-<slug>.json
 * Schema v0.1 — see skills/shared/brainstorm-assets/process-receipt.md.
 *
 * Pure helper + thin CLI. Detectors (find-missing-design-process) read the
 * same shape; this module owns create / update / read / readiness.
 *
 * CLI:
 *   node scripts/design-gates.js read   <state-root> <projectId> <slug>
 *   node scripts/design-gates.js create <state-root> <projectId> <slug> [--json '{}']
 *   node scripts/design-gates.js update <state-root> <projectId> <slug> --json '{...}'
 *   node scripts/design-gates.js ready  <state-root> <projectId> <slug>
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
export const DESIGN_GATES_DIR_SEGMENTS = Object.freeze([
  '.atomic-skills',
  'status',
  'design-gates',
]);

/** Receipt status values. `ready` only when process fields are complete. */
export const DESIGN_STATUS = Object.freeze({
  PENDING: 'pending',
  READY: 'ready',
});

/**
 * Absolute path of the design-gates receipt for one plan design.
 * @param {string} stateRoot - repo root or `.atomic-skills` root
 * @param {string} projectId
 * @param {string} slug
 */
export function designGatePath(stateRoot, projectId, slug) {
  const root = resolveStateRoot(stateRoot);
  const file = `${sanitizeId(projectId)}-${sanitizeId(slug)}.json`;
  return join(root, 'status', 'design-gates', file);
}

/**
 * @param {string} stateRoot
 * @param {string} projectId
 * @param {string} slug
 * @returns {object|null}
 */
export function readDesignGate(stateRoot, projectId, slug) {
  const path = designGatePath(stateRoot, projectId, slug);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new Error(`design-gates: corrupt receipt at ${path}: ${err.message}`);
  }
}

/**
 * Build a v0.1 receipt (does not write). Missing fields get safe defaults.
 * @param {object} partial
 * @returns {object}
 */
export function buildDesignGate(partial = {}) {
  const now = partial.updatedAt || new Date().toISOString();
  const debateGate = normalizeDebateGate(partial.debateGate);
  return {
    schemaVersion: SCHEMA_VERSION,
    projectId: partial.projectId != null ? String(partial.projectId) : '',
    slug: partial.slug != null ? String(partial.slug) : '',
    interviewAccepted: partial.interviewAccepted === true,
    debateGate,
    researchDigest:
      partial.researchDigest == null || partial.researchDigest === ''
        ? null
        : String(partial.researchDigest),
    criticVerdict:
      partial.criticVerdict == null || partial.criticVerdict === ''
        ? null
        : String(partial.criticVerdict),
    userApproved: partial.userApproved === true,
    status:
      partial.status === DESIGN_STATUS.READY
        ? DESIGN_STATUS.READY
        : DESIGN_STATUS.PENDING,
    updatedAt: now,
  };
}

/**
 * Fields required for `status: ready` (process complete).
 * @param {object} gate
 * @returns {string[]} missing field names (empty = complete)
 */
export function missingDesignGateFields(gate) {
  if (!gate || typeof gate !== 'object') {
    return [
      'schemaVersion',
      'interviewAccepted',
      'debateGate',
      'researchDigest',
      'criticVerdict',
      'userApproved',
      'status',
    ];
  }
  const missing = [];
  if (gate.schemaVersion !== SCHEMA_VERSION) missing.push('schemaVersion');
  if (gate.interviewAccepted !== true) missing.push('interviewAccepted');
  if (!isDebateGateComplete(gate.debateGate)) missing.push('debateGate');
  if (
    typeof gate.researchDigest !== 'string' ||
    gate.researchDigest.trim().length === 0
  ) {
    missing.push('researchDigest');
  }
  if (
    typeof gate.criticVerdict !== 'string' ||
    gate.criticVerdict.trim().length === 0
  ) {
    missing.push('criticVerdict');
  }
  if (gate.userApproved !== true) missing.push('userApproved');
  if (gate.status !== DESIGN_STATUS.READY) missing.push('status');
  return missing;
}

/**
 * @param {object} gate
 * @returns {boolean}
 */
export function isDesignGateReady(gate) {
  return missingDesignGateFields(gate).length === 0;
}

/**
 * Create a new receipt (fails if one already exists unless opts.overwrite).
 * @param {string} stateRoot
 * @param {string} projectId
 * @param {string} slug
 * @param {object} [partial]
 * @param {{ overwrite?: boolean }} [opts]
 */
export function createDesignGate(stateRoot, projectId, slug, partial = {}, opts = {}) {
  const path = designGatePath(stateRoot, projectId, slug);
  if (existsSync(path) && !opts.overwrite) {
    throw new Error(`design-gates: receipt already exists at ${path}`);
  }
  const gate = buildDesignGate({
    ...partial,
    projectId,
    slug,
    updatedAt: new Date().toISOString(),
  });
  // Never create as ready unless process fields are complete.
  if (gate.status === DESIGN_STATUS.READY && processFieldsMissing(gate).length) {
    gate.status = DESIGN_STATUS.PENDING;
  }
  writeGate(path, gate);
  return gate;
}

/**
 * Merge partial into existing receipt (or create if missing with opts.create).
 * @param {string} stateRoot
 * @param {string} projectId
 * @param {string} slug
 * @param {object} partial
 * @param {{ create?: boolean }} [opts]
 */
export function updateDesignGate(stateRoot, projectId, slug, partial = {}, opts = {}) {
  const existing = readDesignGate(stateRoot, projectId, slug);
  if (!existing) {
    if (!opts.create) {
      throw new Error(
        `design-gates: no receipt for ${projectId}/${slug} (pass create:true to create)`,
      );
    }
    return createDesignGate(stateRoot, projectId, slug, partial, { overwrite: true });
  }
  const merged = buildDesignGate({
    ...existing,
    ...partial,
    projectId: partial.projectId != null ? partial.projectId : existing.projectId || projectId,
    slug: partial.slug != null ? partial.slug : existing.slug || slug,
    // Nested debateGate: shallow-merge when both objects
    debateGate:
      partial.debateGate !== undefined
        ? normalizeDebateGate(
            typeof partial.debateGate === 'object' &&
              partial.debateGate &&
              typeof existing.debateGate === 'object' &&
              existing.debateGate
              ? { ...existing.debateGate, ...partial.debateGate }
              : partial.debateGate,
          )
        : existing.debateGate,
    updatedAt: new Date().toISOString(),
  });

  // Auto-promote status to ready when all process fields are set and caller
  // did not force pending; demote if fields incomplete but status was ready.
  const processMissing = processFieldsMissing(merged);
  if (partial.status === DESIGN_STATUS.READY || merged.status === DESIGN_STATUS.READY) {
    merged.status = processMissing.length === 0 ? DESIGN_STATUS.READY : DESIGN_STATUS.PENDING;
  }
  if (partial.status === DESIGN_STATUS.PENDING) {
    merged.status = DESIGN_STATUS.PENDING;
  }
  // Explicit ready request with incomplete fields → leave pending (caller can check).
  if (partial.status === DESIGN_STATUS.READY && processMissing.length === 0) {
    merged.status = DESIGN_STATUS.READY;
  }

  writeGate(designGatePath(stateRoot, projectId, slug), merged);
  return merged;
}

// ── internals ──────────────────────────────────────────────────────────────

function resolveStateRoot(stateRoot) {
  const target = resolve(stateRoot);
  // Accept either repo root (has .atomic-skills/) or the .atomic-skills dir itself.
  if (existsSync(join(target, 'status'))) return target;
  if (existsSync(join(target, '.atomic-skills'))) return join(target, '.atomic-skills');
  // Prefer writing under .atomic-skills when given a bare repo root.
  return join(target, '.atomic-skills');
}

function sanitizeId(id) {
  return String(id).replace(/[/\\]/g, '-');
}

function normalizeDebateGate(value) {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  return {
    invoked: value.invoked === true,
    readyForValidation: value.readyForValidation === true,
    singleApproach: value.singleApproach === true,
  };
}

function isDebateGateComplete(debateGate) {
  if (!debateGate || typeof debateGate !== 'object') return false;
  return debateGate.invoked === true && debateGate.readyForValidation === true;
}

function processFieldsMissing(gate) {
  const missing = [];
  if (gate.interviewAccepted !== true) missing.push('interviewAccepted');
  if (!isDebateGateComplete(gate.debateGate)) missing.push('debateGate');
  if (
    typeof gate.researchDigest !== 'string' ||
    gate.researchDigest.trim().length === 0
  ) {
    missing.push('researchDigest');
  }
  if (
    typeof gate.criticVerdict !== 'string' ||
    gate.criticVerdict.trim().length === 0
  ) {
    missing.push('criticVerdict');
  }
  if (gate.userApproved !== true) missing.push('userApproved');
  return missing;
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
  if (!raw) throw new Error('design-gates: --json requires a value');
  return JSON.parse(raw);
}

function main(argv) {
  const [cmd, stateRoot, projectId, slug, ...rest] = argv;
  if (!cmd || !stateRoot || !projectId || !slug) {
    console.error(
      'usage: design-gates.js <read|create|update|ready> <state-root> <projectId> <slug> [--json ...]',
    );
    process.exit(2);
  }
  try {
    if (cmd === 'read') {
      const gate = readDesignGate(stateRoot, projectId, slug);
      if (!gate) {
        console.error(`design-gates: missing ${projectId}/${slug}`);
        process.exit(1);
      }
      console.log(JSON.stringify(gate, null, 2));
      process.exit(0);
    }
    if (cmd === 'create') {
      const partial = parseJsonFlag(rest);
      const gate = createDesignGate(stateRoot, projectId, slug, partial);
      console.log(JSON.stringify(gate, null, 2));
      process.exit(0);
    }
    if (cmd === 'update') {
      const partial = parseJsonFlag(rest);
      const create = rest.includes('--create');
      const gate = updateDesignGate(stateRoot, projectId, slug, partial, { create });
      console.log(JSON.stringify(gate, null, 2));
      process.exit(0);
    }
    if (cmd === 'ready') {
      const gate = readDesignGate(stateRoot, projectId, slug);
      if (!gate) {
        console.error(`design-gates: missing ${projectId}/${slug}`);
        process.exit(1);
      }
      const missing = missingDesignGateFields(gate);
      if (missing.length) {
        console.error(`design-gates: not ready — missing: ${missing.join(', ')}`);
        process.exit(1);
      }
      console.log('design-gates: ready ✓');
      process.exit(0);
    }
    console.error(`design-gates: unknown command ${cmd}`);
    process.exit(2);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
