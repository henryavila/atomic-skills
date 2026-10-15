/**
 * One approved-plan orchestrator tick. Reads a snapshot JSON, prints the
 * tick result, and exits. Does not spawn agents, merge, or edit product.
 *
 *   node scripts/orchestrator-tick.js --snapshot <file> [--write --status-root <dir> --plan <slug>]
 *   node scripts/orchestrator-tick.js --card --plan <slug> --worktree <abs>
 *   node scripts/orchestrator-tick.js --from-plan <plan.md> --status-root <dir>
 *
 * Exit 0 when the snapshot is approved (including blocked-human).
 * Exit 1 when the plan is not approved or the snapshot is invalid.
 * --card prints one /loop line and exits 0. It does not require --snapshot.
 * Missing --plan or --worktree with --card exits 1.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { orchestratorTick, writeBoard, readBoard, orchestratorCard } from '../src/orchestrator-board.js';
import { buildOrchestratorSnapshot, tasksFromInitiativeFrontmatter } from '../src/orchestrator-snapshot.js';
import { parseFrontmatter } from './validate-state.js';
import { readLeaseResult } from '../src/writer-lease.js';

function arg(name) {
  const i = process.argv.indexOf(name);
  if (i === -1) return null;
  return process.argv[i + 1] ?? null;
}

function cardArg(name) {
  const value = arg(name);
  if (value == null || value === '' || value.startsWith('--')) return null;
  return value;
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('node scripts/orchestrator-tick.js --snapshot <file> [--write --status-root <dir> --plan <slug>]');
  console.log('node scripts/orchestrator-tick.js --card --plan <slug> --worktree <abs>');
  console.log('node scripts/orchestrator-tick.js --from-plan <plan.md> --status-root <dir>');
  process.exit(0);
}

if (process.argv.includes('--from-plan')) {
  const planFile = cardArg('--from-plan');
  const statusRoot = cardArg('--status-root');
  if (!planFile || !statusRoot) {
    console.error('blocked: from-plan-needs-plan-and-status-root');
    process.exit(1);
  }
  let raw;
  try {
    raw = readFileSync(planFile, 'utf8');
  } catch (err) {
    console.error(`blocked: unreadable-plan ${err.message}`);
    process.exit(1);
  }
  const parsed = parseFrontmatter(raw);
  if (parsed.error) {
    console.error(`blocked: ${parsed.error}`);
    process.exit(1);
  }
  const tasks = [];
  const phasesDir = join(dirname(planFile), 'phases');
  if (existsSync(phasesDir)) {
    for (const name of readdirSync(phasesDir)) {
      if (!name.endsWith('.md')) continue;
      const phase = parseFrontmatter(readFileSync(join(phasesDir, name), 'utf8'));
      if (phase.error) continue;
      tasks.push(...tasksFromInitiativeFrontmatter(phase.frontmatter));
    }
  }
  const slug = parsed.frontmatter.slug;
  if (typeof slug !== 'string' || slug.trim() === '') {
    console.error('blocked: plan-slug-required');
    process.exit(1);
  }
  const board = readBoard(statusRoot, slug);
  let lease = { status: 'missing' };
  try {
    lease = readLeaseResult(statusRoot, slug);
  } catch {
    lease = { status: 'missing' };
  }
  const snapshot = buildOrchestratorSnapshot({
    plan: parsed.frontmatter,
    tasks,
    board,
    lease,
  });
  const result = orchestratorTick(snapshot);
  writeBoard(statusRoot, slug, result.board);
  console.log(JSON.stringify(result));
  process.exit(result.ok ? 0 : 1);
}

if (process.argv.includes('--card')) {
  const plan = cardArg('--plan');
  const worktree = cardArg('--worktree');
  if (!plan || !worktree) {
    console.error('blocked: card-needs-plan-and-worktree');
    process.exit(1);
  }
  console.log(orchestratorCard({ slug: plan, worktree }));
  process.exit(0);
}

const snapshotPath = arg('--snapshot');
if (!snapshotPath) {
  console.error('blocked: snapshot-required');
  process.exit(1);
}

let snapshot;
try {
  snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
} catch (err) {
  console.error(`blocked: invalid-snapshot ${err.message}`);
  process.exit(1);
}

const result = orchestratorTick(snapshot);
if (arg('--write') != null || process.argv.includes('--write')) {
  const statusRoot = arg('--status-root');
  const plan = arg('--plan') ?? snapshot.planSlug;
  if (!statusRoot || !plan) {
    console.error('blocked: write-needs-status-root-and-plan');
    process.exit(1);
  }
  writeBoard(statusRoot, plan, result.board);
}
console.log(JSON.stringify(result));
process.exit(result.ok ? 0 : 1);
