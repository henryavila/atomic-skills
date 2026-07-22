#!/usr/bin/env node
/**
 * CLI: node scripts/append-plan-quality-event.js --kind fingerprint_refuse --plan slug --phase F1
 * Fail-open: always exit 0 unless --strict and write fails.
 */
import { appendPlanQualityEvent, EVENT_KINDS } from '../src/plan-quality-events.js';
import { join } from 'node:path';

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

const kind = arg('--kind');
const planSlug = arg('--plan');
const phaseId = arg('--phase');
const strict = process.argv.includes('--strict');

if (!kind || !EVENT_KINDS.includes(kind)) {
  console.error(`Usage: append-plan-quality-event.js --kind <${EVENT_KINDS.join('|')}> [--plan slug] [--phase F0]`);
  process.exit(strict ? 2 : 0);
}

const res = appendPlanQualityEvent({
  kind,
  planSlug,
  phaseId,
  stateRoot: join(process.cwd(), '.atomic-skills'),
});
if (!res.ok) {
  console.error('append-plan-quality-event fail-open:', res.error);
  process.exit(strict ? 1 : 0);
}
console.log('appended', kind, res.path);
