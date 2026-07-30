#!/usr/bin/env node
/**
 * find-missing-design-process.js — deterministic DETECTOR for multi-phase DESIGN
 * process receipts (design-gates).
 *
 * HARD-BLOCK exit 1 when the receipt is missing or not `status: ready` with
 * complete process fields (interviewAccepted, debateGate, researchDigest,
 * criticVerdict, userApproved).
 *
 * R-ORCH-03 exempt lanes (adopt / ad-hoc / single-task) never require a
 * design-gates receipt — pass `--lane adopt|ad-hoc|single-task` (or the
 * creation-gate path with kind adopt) to exit 0 without scanning.
 *
 * CLI:
 *   node scripts/find-missing-design-process.js <design-gates.json>
 *   node scripts/find-missing-design-process.js <state-root> <projectId> <slug>
 *   node scripts/find-missing-design-process.js --lane adopt|ad-hoc|single-task [...]
 *   node scripts/find-missing-design-process.js --creation-gate <creation-gates.json>
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  designGatePath,
  readDesignGate,
  missingDesignGateFields,
  isDesignGateReady,
} from './design-gates.js';

/** Lanes that must not false-positive on missing design process (R-ORCH-03). */
export const EXEMPT_LANES = Object.freeze([
  'adopt',
  'ad-hoc',
  'adhoc',
  'single-task',
  'singletask',
]);

/**
 * @param {string} lane
 * @returns {boolean}
 */
export function isExemptLane(lane) {
  if (lane == null) return false;
  const n = String(lane).trim().toLowerCase().replace(/_/g, '-');
  return EXEMPT_LANES.includes(n) || n === 'single-task' || n === 'ad-hoc';
}

/**
 * Evaluate a design-gates receipt path or in-memory gate.
 * @param {object|null} gate
 * @param {{ path?: string, lane?: string, creationKind?: string }} [ctx]
 * @returns {{ ok: boolean, reason?: string, missing?: string[], exempt?: boolean }}
 */
export function evaluateDesignProcess(gate, ctx = {}) {
  if (isExemptLane(ctx.lane) || isExemptLane(ctx.creationKind)) {
    return {
      ok: true,
      exempt: true,
      reason: `exempt-lane:${ctx.lane || ctx.creationKind} (R-ORCH-03)`,
    };
  }
  if (!gate) {
    return {
      ok: false,
      reason: 'missing-receipt',
      missing: [
        'schemaVersion',
        'interviewAccepted',
        'debateGate',
        'researchDigest',
        'criticVerdict',
        'userApproved',
        'status',
      ],
    };
  }
  const missing = missingDesignGateFields(gate);
  if (missing.length || !isDesignGateReady(gate)) {
    return {
      ok: false,
      reason: missing.length ? `not-ready:${missing.join(',')}` : 'not-ready',
      missing,
    };
  }
  return { ok: true };
}

/**
 * Load gate from an explicit design-gates JSON path, or state-root+ids.
 * @param {{ gatePath?: string, stateRoot?: string, projectId?: string, slug?: string }} target
 */
export function loadDesignProcessGate(target) {
  if (target.gatePath) {
    const path = resolve(target.gatePath);
    if (!existsSync(path)) return { gate: null, path };
    try {
      return { gate: JSON.parse(readFileSync(path, 'utf8')), path };
    } catch (err) {
      throw new Error(`find-missing-design-process: corrupt ${path}: ${err.message}`);
    }
  }
  if (target.stateRoot && target.projectId && target.slug) {
    const path = designGatePath(target.stateRoot, target.projectId, target.slug);
    return { gate: readDesignGate(target.stateRoot, target.projectId, target.slug), path };
  }
  throw new Error(
    'find-missing-design-process: need <design-gates.json> or <state-root> <projectId> <slug>',
  );
}

/**
 * If a creation-gates path is provided and kind is adopt (or status marks
 * exempt), surface the exempt kind for evaluateDesignProcess.
 * @param {string} creationGatePath
 * @returns {string|null} kind when exempt
 */
export function exemptKindFromCreationGate(creationGatePath) {
  if (!creationGatePath || !existsSync(creationGatePath)) return null;
  try {
    const g = JSON.parse(readFileSync(creationGatePath, 'utf8'));
    if (isExemptLane(g.kind)) return String(g.kind);
    if (g.designExempt === true) return 'ad-hoc';
    return null;
  } catch {
    return null;
  }
}

// ── CLI ────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {
    lane: null,
    creationGate: null,
    positionals: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--lane') {
      out.lane = argv[++i];
    } else if (a === '--creation-gate') {
      out.creationGate = argv[++i];
    } else if (a === '--help' || a === '-h') {
      out.help = true;
    } else if (a.startsWith('--')) {
      throw new Error(`find-missing-design-process: unknown flag ${a}`);
    } else {
      out.positionals.push(a);
    }
  }
  return out;
}

function isJsonFile(p) {
  try {
    return statSync(p).isFile() && p.endsWith('.json');
  } catch {
    return false;
  }
}

function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  if (args.help) {
    console.log(`usage:
  find-missing-design-process.js <design-gates.json>
  find-missing-design-process.js <state-root> <projectId> <slug>
  find-missing-design-process.js --lane adopt|ad-hoc|single-task [...]
  find-missing-design-process.js --creation-gate <creation-gates.json> <design-gates.json>`);
    process.exit(0);
  }

  const creationExempt = args.creationGate
    ? exemptKindFromCreationGate(resolve(args.creationGate))
    : null;
  const lane = args.lane || creationExempt;

  if (isExemptLane(lane)) {
    console.log(
      `find-missing-design-process: exempt lane '${lane}' (R-ORCH-03) — design process receipt not required ✓`,
    );
    process.exit(0);
  }

  const pos = args.positionals;
  let target;
  if (pos.length === 1 && isJsonFile(resolve(pos[0]))) {
    target = { gatePath: resolve(pos[0]) };
  } else if (pos.length >= 3) {
    target = { stateRoot: resolve(pos[0]), projectId: pos[1], slug: pos[2] };
  } else if (pos.length === 1) {
    // Treat as explicit gate path even if missing (report missing-receipt).
    target = { gatePath: resolve(pos[0]) };
  } else {
    console.error(
      'usage: find-missing-design-process.js <design-gates.json> | <state-root> <projectId> <slug>',
    );
    process.exit(2);
  }

  try {
    const { gate, path } = loadDesignProcessGate(target);
    const result = evaluateDesignProcess(gate, { path, lane });
    if (result.ok) {
      console.log(
        `find-missing-design-process: design process ready${path ? ` (${path})` : ''} ✓`,
      );
      process.exit(0);
    }
    console.error(
      `find-missing-design-process: ${result.reason}${path ? ` at ${path}` : ''}`,
    );
    if (result.missing?.length) {
      console.error(`  missing: ${result.missing.join(', ')}`);
    }
    console.error(
      'HARD-BLOCK: multi-phase DESIGN requires design-gates status ready (Interview, digest, debate, critic, userApproved). Run brainstorm B0–B5 or pass --lane for R-ORCH-03 exempts.',
    );
    process.exit(1);
  } catch (err) {
    console.error(err.message || err);
    process.exit(2);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
