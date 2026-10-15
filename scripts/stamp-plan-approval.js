/**
 * Write planApprovedAt onto a plan.md. Does not set userValidatedAt.
 *
 *   node scripts/stamp-plan-approval.js --plan <plan.md> [--at <iso>]
 *
 * Run only after the user accepts the plan. Exit 1 when the file or the
 * timestamp is unusable.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { stringify as stringifyYaml } from 'yaml';
import { parseFrontmatter } from './validate-state.js';
import { stampPlanApproval } from '../src/plan-approval.js';

function arg(name) {
  const i = process.argv.indexOf(name);
  if (i === -1) return null;
  const value = process.argv[i + 1];
  if (value == null || value.startsWith('--')) return null;
  return value;
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('node scripts/stamp-plan-approval.js --plan <plan.md> [--at <iso>]');
  process.exit(0);
}

const planPath = arg('--plan');
if (!planPath) {
  console.error('blocked: plan-required');
  process.exit(1);
}

let raw;
try {
  raw = readFileSync(planPath, 'utf8');
} catch (err) {
  console.error(`blocked: unreadable-plan ${err.message}`);
  process.exit(1);
}

const parsed = parseFrontmatter(raw);
if (parsed.error) {
  console.error(`blocked: ${parsed.error}`);
  process.exit(1);
}

let stamped;
try {
  stamped = stampPlanApproval(parsed.frontmatter, arg('--at') ?? new Date().toISOString());
} catch (err) {
  console.error(`blocked: ${err.message}`);
  process.exit(1);
}

const yamlBlock = stringifyYaml(stamped).replace(/\n$/, '');
const body = parsed.body.length ? parsed.body.replace(/^\n/, '') : '';
const rebuilt = `---\n${yamlBlock}\n---\n${body ? `\n${body}` : ''}`;
writeFileSync(planPath, rebuilt.endsWith('\n') ? rebuilt : `${rebuilt}\n`);
console.log(stamped.planApprovedAt);
