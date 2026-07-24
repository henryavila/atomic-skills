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
 * F2 also requires write-through projection anchors on close and focus mutators:
 * `refresh-state` after status mutation, and (on closes that reseed the phase
 * scaffold) a mention of `project-session-todos`. Never requires `todo_write`
 * inside shell scripts — the agent applies the helper payload via the host tool.
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
  // phase-done still mentions task-done (prior per-task closes) + emits phase-done/actuals only
  { header: '## `phase-done`', events: ['task-done', 'phase-done'], fields: ['projectId', 'planSlug', 'phaseId', 'taskId', 'actuals'] },
];

/** Close blocks that recompute rollups/focus and must name refresh-state. */
const CLOSE_REFRESH_HEADERS = new Set([
  '## `done <task-id>`',
  '## `reconcile`',
  '## `phase-done`',
]);

/**
 * Closes that reseed the Grok phase scaffold must name the projection helper.
 * reconcile documents the same step in prose (T-002) but T-001 acceptance only
 * hard-fails done + phase-done when the helper is missing.
 */
const CLOSE_SESSION_TODOS_HEADERS = new Set([
  '## `done <task-id>`',
  '## `phase-done`',
]);

/**
 * Focus mutators that move plan/phase focus. Checked only when the header is
 * present (fixtures may omit them). Require refresh-state + project-session-todos
 * so projection cannot drift after focus changes.
 */
const FOCUS_MUTATOR_HEADERS = [
  '## `phase-reopen`',
  '## `switch <slug>`',
  '## `unblock <task-id>`',
  '## `archive [<slug>]`',
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
  // F4/T-003: defer/skip is not a terminal path; preflight + commit guard required.
  if (!/no bulk-close/i.test(block) && !/Do \*\*not\*\* set open tasks to `done`/.test(block)) {
    missing.push('no-bulk-close');
  }
  if (!/Do not offer defer\/skip as a terminal path/i.test(block) && !/defer\/skip of exit gates as a terminal path/i.test(block)) {
    missing.push('no-defer-skip-terminal');
  }
  if (!/preflightPhaseDone|stage: 'preflight'|Stage A — pure preflight/.test(block)) {
    missing.push('phase-done-preflight');
  }
  if (!/commitGuardPhaseDone|stage: 'commit'|Commit guard \(HARD/.test(block)) {
    missing.push('phase-done-commit-guard');
  }
  if (!/fingerprint/.test(block)) {
    missing.push('phase-done-fingerprint');
  }
  return missing;
}

/** F2: write-through refresh-state after status mutation. */
function checkRefreshState(block) {
  if (!/refresh-state/.test(block)) return ['refresh-state'];
  return [];
}

/**
 * F2: Grok phase-scaffold helper name (agent applies via todo_write; lint does
 * not require todo_write inside shell scripts).
 */
function checkSessionTodosProjection(block) {
  if (!/project-session-todos/.test(block)) return ['project-session-todos'];
  return [];
}

function checkCloseProjection(header, block) {
  const missing = [];
  if (CLOSE_REFRESH_HEADERS.has(header)) {
    missing.push(...checkRefreshState(block));
  }
  if (CLOSE_SESSION_TODOS_HEADERS.has(header)) {
    missing.push(...checkSessionTodosProjection(block));
  }
  return missing;
}

function checkFocusMutatorProjection(block) {
  return [...checkRefreshState(block), ...checkSessionTodosProjection(block)];
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
    if (block != null) {
      missing.push(...checkCloseProjection(requirement.header, block));
    }
    if (missing.length) offenders.push({ block: requirement.header, missing });
  }

  // Focus mutators: enforce only when the named header is present in the file.
  for (const header of FOCUS_MUTATOR_HEADERS) {
    const block = sliceBlock(markdown, header);
    if (block == null) continue;
    const missing = checkFocusMutatorProjection(block);
    if (missing.length) offenders.push({ block: header, missing });
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
