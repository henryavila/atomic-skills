#!/usr/bin/env node
/**
 * Report D9 plan-quality event counts for a window (default 14d).
 * node scripts/report-plan-quality.js [--window-days 14] [--path .atomic-skills/analytics/plan-quality.jsonl]
 */
import { join } from 'node:path';
import {
  countByKind,
  defaultEventsPath,
  readPlanQualityEvents,
} from '../src/plan-quality-events.js';

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}

const windowDays = Number(arg('--window-days', '14')) || 14;
const path =
  arg('--path', null) || defaultEventsPath(join(process.cwd(), '.atomic-skills'));
const events = readPlanQualityEvents(path, { windowDays });
const counts = countByKind(events);
console.log(`plan-quality report (last ${windowDays}d) path=${path}`);
console.log(`events: ${events.length}`);
for (const [k, n] of Object.entries(counts)) {
  console.log(`  ${k}: ${n}`);
}
process.exit(0);
