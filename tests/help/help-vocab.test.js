import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';

import { classify, nextStepFrom } from '../../scripts/compute-help.js';
import { OVERLAPS, PRECEDENCE } from './fixtures/states.js';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const catalog = parseYaml(readFileSync(resolve(ROOT, 'meta/catalog.yaml'), 'utf8'));
const projectSubcommands = new Map(
  catalog.core.project.subcommands.map((subcommand) => [subcommand.name, subcommand])
);
const coreSkills = new Map(
  Object.values(catalog.core).map((skill) => [skill.name, skill])
);

function firstCommand(commandLike) {
  const text = String(commandLike ?? '').trim();
  const ticked = text.match(/`([^`]+)`/);
  const command = (ticked ? ticked[1] : text)
    .replace(/^\/?atomic-skills:project\s+/, '')
    .replace(/^project\s+/, '')
    .trim();
  return command;
}

function tokenize(commandLike) {
  return firstCommand(commandLike).split(/\s+/).filter(Boolean);
}

function optionSet(signature) {
  const match = signature.match(/^\[--([^|\]]+(?:\|--[^|\]]+)*)\]$/);
  if (!match) return null;
  return new Set(match[1].split('|').map((option) => option.startsWith('--') ? option : `--${option}`));
}

function validForSignature(signature, args) {
  if (signature === '') return args.length === 0;
  if (/<[^>]+>/.test(args.join(' '))) return false;

  const options = optionSet(signature);
  if (options) return args.length <= 1 && (args.length === 0 || options.has(args[0]));

  switch (signature) {
    case '<task-id>':
      return args.length === 1 && /^T-\d{3}$/.test(args[0]);
    case '<phase-id>':
      return args.length === 1 && /^F[\w.-]+$/.test(args[0]);
    case '<slug>':
      return args.length === 1 && /^[a-z0-9][a-z0-9._-]*$/i.test(args[0]);
    case '<id>':
      return args.length === 1 && /^[A-Z]+-\d{3}$|^F[\w.-]+$|^[a-z0-9._-]+$/i.test(args[0]);
    case '<description>':
    case '<title-or-idx>':
      return args.length >= 1;
    case '[<slug>]':
      return args.length <= 1 && (args.length === 0 || /^[a-z0-9][a-z0-9._-]*$/i.test(args[0]));
    case '[--html]':
      return args.length === 0 || (args.length === 1 && args[0] === '--html');
    case '[plan|initiative] <slug>':
      return args.length === 0
        || (args.length === 1 && ['plan', 'initiative'].includes(args[0]))
        || (args.length === 2 && ['plan', 'initiative'].includes(args[0]) && /^[a-z0-9][a-z0-9._-]*$/i.test(args[1]));
    case '[[project-id/]plan-slug]':
      return args.length <= 1 && (args.length === 0 || /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)?$/i.test(args[0]));
    default:
      return false;
  }
}

function validateCatalogCommand(commandLike) {
  const command = firstCommand(commandLike);
  if (!command || /<[^>]+>/.test(command)) return { valid: false, reason: 'empty or unresolved placeholder' };

  const [verb, ...args] = tokenize(command);
  const subcommand = projectSubcommands.get(verb);
  if (subcommand) {
    return {
      valid: validForSignature(subcommand.signature ?? '', args),
      reason: `project ${verb} ${subcommand.signature}`.trim(),
    };
  }

  const coreSkill = coreSkills.get(verb);
  if (!coreSkill) return { valid: false, reason: `unknown command: ${verb}` };

  return {
    valid: validForSignature(coreSkill.argument_hint ?? '', args),
    reason: `${verb} ${coreSkill.argument_hint ?? ''}`.trim(),
  };
}

function assertValid(command) {
  const result = validateCatalogCommand(command);
  assert.equal(result.valid, true, `${command} should match catalog signature (${result.reason})`);
}

function assertInvalid(command) {
  const result = validateCatalogCommand(command);
  assert.equal(result.valid, false, `${command} should be rejected`);
}

test('help fallback commands from classify() all resolve to catalog commands', () => {
  for (const fx of [...PRECEDENCE, ...OVERLAPS]) {
    const decision = classify(fx.state);
    assertValid(decision.fallbackCommand);
  }
});

test('persisted nextAction prose validates the first backticked project command', () => {
  const decision = classify(PRECEDENCE.find((fx) => fx.name === 'implement').state);
  assertValid(nextStepFrom('Rodar `done T-001` depois', decision).command);
  assertValid(nextStepFrom('done T-001', decision).command);
});

test('unresolved placeholder commands are invalid', () => {
  assertInvalid('materialize <phase>');
  assertInvalid('done <task-id>');
  assertInvalid('finalize');
});

test('catalog signature matcher accepts concrete help-domain commands and rejects placeholders', () => {
  for (const command of [
    'finalize demo-plan',
    'materialize F2',
    'done T-001',
    'switch core-api',
    'unblock T-007',
    'archive oneoff',
    'new plan',
    'status --browser',
    'help',
    'help --html',
    'phase-done',
    'reconcile',
    'implement',
  ]) {
    assertValid(command);
  }

  assertInvalid('materialize <phase>');
});
