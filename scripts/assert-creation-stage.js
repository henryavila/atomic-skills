#!/usr/bin/env node
/**
 * assert-creation-stage.js — monotonic stage advance for creation-gates.
 *
 * Refuses:
 *   - advancing past a closed stage without intermediate steps (illegal skip)
 *   - declaring `ready` before the ordered sequence completes
 *   - reverse stage moves
 *
 * CLI (explicit creation-gate path — no tree-wide scan):
 *   node scripts/assert-creation-stage.js <creation-gates.json> --at <stage>
 *   node scripts/assert-creation-stage.js <creation-gates.json> --advance <stage>
 *   node scripts/assert-creation-stage.js <creation-gates.json> --ready
 *
 * Exit 0 = ok; exit 1 = illegal stage / not ready; exit 2 = usage/IO.
 *
 * P6 exit codes: agents may skip prose; they cannot close the plan without
 * this script exiting 0.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  CREATION_STAGES,
  STAGE_INDEX,
  assertCanAdvance,
  advanceCreationStage,
  validateCreationGateStage,
  normalizeCreationStage,
} from './creation-gates.js';

/**
 * Assert the gate is currently at (or past) expected stage without advancing.
 * "Past" means index >= expected — resume may re-assert a closed stage.
 *
 * @param {object} gate
 * @param {string} expectedStage
 * @returns {{ ok: boolean, reason?: string }}
 */
export function assertAtStage(gate, expectedStage) {
  const issues = validateCreationGateStage(gate);
  if (issues.length) {
    return { ok: false, reason: issues.join(',') };
  }
  if (!CREATION_STAGES.includes(expectedStage)) {
    return { ok: false, reason: `unknown-expected-stage:${expectedStage}` };
  }
  const cur = normalizeCreationStage(gate.stage);
  const curIdx = STAGE_INDEX[cur];
  const expIdx = STAGE_INDEX[expectedStage];
  if (curIdx < expIdx) {
    return {
      ok: false,
      reason: `stage-behind:${cur}<${expectedStage}`,
    };
  }
  return { ok: true };
}

/**
 * Assert we may advance from gate.stage to `toStage` (no skip).
 * @param {object} gate
 * @param {string} toStage
 * @param {{ allowSkip?: boolean }} [opts]
 */
export function assertAdvance(gate, toStage, opts = {}) {
  const issues = validateCreationGateStage(gate);
  if (issues.length) {
    return { ok: false, reason: issues.join(',') };
  }
  return assertCanAdvance(normalizeCreationStage(gate.stage), toStage, opts);
}

/**
 * Assert the gate may declare ready (stage must already be `ready`, or we are
 * advancing from `reviews` → `ready` only).
 * @param {object} gate
 * @param {{ advancing?: boolean }} [opts]
 */
export function assertReady(gate, opts = {}) {
  const issues = validateCreationGateStage(gate);
  if (issues.length) {
    return { ok: false, reason: issues.join(',') };
  }
  const cur = normalizeCreationStage(gate.stage);
  if (cur === 'ready') return { ok: true };
  if (opts.advancing) {
    return assertCanAdvance(cur, 'ready', { allowSkip: false });
  }
  // Declaring ready while still mid-sequence is always illegal.
  return {
    ok: false,
    reason: `declare-ready-early:current=${cur}`,
  };
}

function loadGate(path) {
  const abs = resolve(path);
  if (!existsSync(abs)) {
    throw Object.assign(new Error(`assert-creation-stage: missing ${abs}`), {
      exitCode: 1,
    });
  }
  try {
    const gate = JSON.parse(readFileSync(abs, 'utf8'));
    if (gate && typeof gate === 'object' && gate.stage != null) {
      gate.stage = normalizeCreationStage(gate.stage);
    }
    return { gate, path: abs };
  } catch (err) {
    throw Object.assign(
      new Error(`assert-creation-stage: corrupt ${abs}: ${err.message}`),
      { exitCode: 2 },
    );
  }
}

function parseArgs(argv) {
  const out = {
    path: null,
    at: null,
    advance: null,
    ready: false,
    write: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--at') out.at = argv[++i];
    else if (a === '--advance') out.advance = argv[++i];
    else if (a === '--ready') out.ready = true;
    else if (a === '--write') out.write = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else if (a.startsWith('--')) throw new Error(`unknown flag ${a}`);
    else if (!out.path) out.path = a;
    else throw new Error(`unexpected arg ${a}`);
  }
  return out;
}

function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    console.error(`assert-creation-stage: ${err.message}`);
    process.exit(2);
  }
  if (args.help || !args.path) {
    console.log(`usage:
  assert-creation-stage.js <creation-gates.json> --at <stage>
  assert-creation-stage.js <creation-gates.json> --advance <stage> [--write]
  assert-creation-stage.js <creation-gates.json> --ready [--write]
stages: ${CREATION_STAGES.join(' → ')}`);
    process.exit(args.help ? 0 : 2);
  }

  let loaded;
  try {
    loaded = loadGate(args.path);
  } catch (err) {
    console.error(err.message);
    process.exit(err.exitCode || 2);
  }
  const { gate, path } = loaded;

  if (args.at) {
    const r = assertAtStage(gate, args.at);
    if (!r.ok) {
      console.error(`assert-creation-stage: ${r.reason}`);
      process.exit(1);
    }
    console.log(`assert-creation-stage: at/past ${args.at} (current=${gate.stage}) ✓`);
    process.exit(0);
  }

  if (args.advance) {
    const r = assertAdvance(gate, args.advance);
    if (!r.ok) {
      console.error(`assert-creation-stage: ${r.reason}`);
      console.error(
        'HARD-BLOCK: illegal stage skip or reverse — advance one stage at a time.',
      );
      process.exit(1);
    }
    if (args.write) {
      try {
        const next = advanceCreationStage(path, args.advance);
        console.log(
          `assert-creation-stage: advanced ${gate.stage} → ${next.stage} ✓`,
        );
      } catch (err) {
        console.error(`assert-creation-stage: ${err.message}`);
        process.exit(1);
      }
    } else {
      console.log(
        `assert-creation-stage: may advance ${gate.stage} → ${args.advance} ✓ (pass --write to persist)`,
      );
    }
    process.exit(0);
  }

  if (args.ready) {
    const r = assertReady(gate, { advancing: args.write && gate.stage !== 'ready' });
    // When --write and current is reviews, allow advance to ready.
    if (args.write && gate.stage === 'reviews') {
      const adv = assertAdvance(gate, 'ready');
      if (!adv.ok) {
        console.error(`assert-creation-stage: ${adv.reason}`);
        process.exit(1);
      }
      try {
        advanceCreationStage(path, 'ready');
        console.log('assert-creation-stage: advanced to ready ✓');
        process.exit(0);
      } catch (err) {
        console.error(`assert-creation-stage: ${err.message}`);
        process.exit(1);
      }
    }
    if (!r.ok) {
      console.error(`assert-creation-stage: ${r.reason}`);
      console.error(
        'HARD-BLOCK: cannot declare ready early — finish stages through reviews first.',
      );
      process.exit(1);
    }
    console.log('assert-creation-stage: ready ✓');
    process.exit(0);
  }

  // Default: validate stage field only
  const issues = validateCreationGateStage(gate);
  if (issues.length) {
    console.error(`assert-creation-stage: ${issues.join(', ')}`);
    process.exit(1);
  }
  console.log(
    `assert-creation-stage: stage=${gate.stage} (ordered: ${CREATION_STAGES.join(' → ')}) ✓`,
  );
  process.exit(0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
