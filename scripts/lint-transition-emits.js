/**
 * lint-transition-emits.js — structural detector for completion emit instructions
 * in the prose transition procedures.
 *
 * The completion log is written from model-executed markdown procedures, so this
 * detector verifies the three transition blocks independently. A whole-file grep
 * could pass with the right words in the wrong block; this slices each named
 * block from its `##` header to the next `##` header and checks the required
 * completion helper reference, event enum values, and scope fields in place.
 *
 * Exit 0 = every transition block carries its emit instruction; exit 1 = at
 * least one block is missing its required instruction.
 *
 * CLI:  node scripts/lint-transition-emits.js [<path>]
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_TRANSITIONS = join(PROJECT_ROOT, 'skills', 'shared', 'project-assets', 'project-transitions.md');

const REQUIREMENTS = [
  { header: '## `done <task-id>`', events: ['task-done'], fields: ['projectId', 'planSlug', 'phaseId', 'taskId'] },
  { header: '## `reconcile`', events: ['task-done'], fields: ['projectId', 'planSlug', 'phaseId', 'taskId'] },
  { header: '## `phase-done`', events: ['task-done', 'phase-done'], fields: ['projectId', 'planSlug', 'phaseId', 'taskId', 'actuals'] },
];

function sliceBlock(markdown, header) {
  const start = markdown.indexOf(header);
  if (start === -1) return null;
  const next = markdown.indexOf('\n## ', start + header.length);
  return markdown.slice(start + header.length, next === -1 ? markdown.length : next);
}

function missingFor(block, events, fields) {
  if (block == null) return ['block'];
  const missing = [];
  if (!/(appendCompletion|append-completion)/.test(block)) missing.push('completion emit');
  for (const event of events) {
    if (!block.includes(event)) missing.push(event);
  }
  for (const field of fields) {
    if (!block.includes(field)) missing.push(field);
  }
  return missing;
}

function checkDoneGateSemantics(block) {
  const missing = [];
  if (!/\bclosure authority\b/.test(block)) {
    missing.push('done closure authority');
  }
  if (!/Do NOT consume `verify-claim` output as task evidence/.test(block)) {
    missing.push('verify-claim-not-evidence');
  }

  const verifierIdx = block.search(/Verifier handling is the first state-changing gate/);
  const statusIdx = block.search(/set `status: done`/i);
  if (verifierIdx === -1 || statusIdx === -1 || verifierIdx > statusIdx) {
    missing.push('verifier-before-done');
  }
  return missing;
}

function checkPhaseDoneGateSemantics(block) {
  const missing = [];
  if (/For each `exitGates\[\]`[\s\S]{0,160}`status !== 'met'`[\s\S]{0,160}set `status: met`/.test(block)) {
    missing.push('no-bulk-met');
  }
  if (!/Never convert `pending` or `deferred` gates to `met`/.test(block)) {
    missing.push('no-pending-or-deferred-to-met');
  }
  if (!/set `status: deferred`[\s\S]{0,120}`deferredReason`/.test(block)) {
    missing.push('deferred-status-override');
  }
  return missing;
}

export function lintTransitionEmits(path = DEFAULT_TRANSITIONS) {
  const markdown = readFileSync(path, 'utf8');
  const offenders = [];
  for (const requirement of REQUIREMENTS) {
    const block = sliceBlock(markdown, requirement.header);
    const missing = missingFor(block, requirement.events, requirement.fields);
    if (requirement.header === '## `done <task-id>`' && block != null) {
      missing.push(...checkDoneGateSemantics(block));
    }
    if (requirement.header === '## `phase-done`' && block != null) {
      missing.push(...checkPhaseDoneGateSemantics(block));
    }
    if (missing.length) offenders.push({ block: requirement.header, missing });
  }
  return { ok: offenders.length === 0, offenders };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const target = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_TRANSITIONS;
  const result = lintTransitionEmits(target);
  if (result.ok) {
    console.log('lint-transition-emits: all transition blocks carry completion emit instructions');
  } else {
    console.log(`lint-transition-emits: ${result.offenders.length} transition block(s) missing completion emit instructions:`);
    for (const offender of result.offenders) {
      console.log(`  ${offender.block}: missing ${offender.missing.join(', ')}`);
    }
    process.exitCode = 1;
  }
}
