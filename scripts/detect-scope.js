#!/usr/bin/env node
/**
 * Infer scope:paths for an initiative by sampling recent git activity.
 *
 * Reads N commits (default 20) on the current branch, extracts the most-touched
 * paths (deduped by top-level directory or first 2 path segments), and outputs
 * a YAML snippet ready to paste into an initiative's `scope:` field.
 *
 * Phase A.T-004 of the migration plan. This is a standalone helper; when
 * Phase B.T-005 rewrites the project-status skill body, the skill will instruct
 * the AI to invoke this script and apply the suggested scope to the active
 * initiative.
 *
 * Usage:
 *   node scripts/detect-scope.js [--branch=<ref>] [--limit=<n>] [--depth=<segments>]
 *
 * Flags:
 *   --branch=<ref>     Branch to inspect (default: current HEAD branch)
 *   --limit=<n>        Number of commits to sample (default: 20)
 *   --depth=<n>        Path segments to keep when deduping (default: 2)
 *   --include-deleted  Include paths that were deleted in the sampled commits
 *   --json             Output JSON instead of YAML snippet
 *
 * Exit codes:
 *   0 — suggestion printed
 *   1 — no relevant paths found
 *   2 — git error or invalid args
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

function parseArgs(argv) {
  const args = {
    branch: null,
    limit: 20,
    depth: 2,
    includeDeleted: false,
    json: false,
  };
  for (const raw of argv.slice(2)) {
    if (raw === '--include-deleted') args.includeDeleted = true;
    else if (raw === '--json') args.json = true;
    else if (raw === '--help' || raw === '-h') {
      console.log(
        'Usage: detect-scope.js [--branch=<ref>] [--limit=<n>] [--depth=<n>] [--include-deleted] [--json]'
      );
      process.exit(0);
    } else if (raw.startsWith('--branch=')) args.branch = raw.slice(9);
    else if (raw.startsWith('--limit=')) {
      const n = Number(raw.slice(8));
      if (!Number.isInteger(n) || n <= 0) {
        console.error(`Invalid --limit: ${raw.slice(8)}`);
        process.exit(2);
      }
      args.limit = n;
    } else if (raw.startsWith('--depth=')) {
      const n = Number(raw.slice(8));
      if (!Number.isInteger(n) || n <= 0) {
        console.error(`Invalid --depth: ${raw.slice(8)}`);
        process.exit(2);
      }
      args.depth = n;
    } else {
      console.error(`Unknown arg: ${raw}`);
      process.exit(2);
    }
  }
  return args;
}

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    console.error(`git failed: ${err.message.trim()}`);
    process.exit(2);
  }
}

function detectGit() {
  if (!existsSync('.git') && !existsSync('../.git')) {
    // Walk up a few levels in case we're in a worktree subdir
    try {
      run('git rev-parse --is-inside-work-tree');
    } catch {
      console.error('Not inside a git work tree.');
      process.exit(2);
    }
  }
}

function getCurrentBranch() {
  const out = run('git rev-parse --abbrev-ref HEAD').trim();
  return out;
}

function getChangedPaths(branch, limit, includeDeleted) {
  const ref = branch || 'HEAD';
  const filter = includeDeleted ? '' : '--diff-filter=AMR';
  const cmd = `git log -n ${limit} ${filter} --name-only --pretty=format: ${ref}`;
  const out = run(cmd);
  return out
    .split('\n')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Group paths by their first `depth` segments and count occurrences.
 * Returns a map: groupKey -> { count, examples: [original paths] }.
 */
function groupAndCount(paths, depth) {
  const groups = new Map();
  for (const p of paths) {
    const parts = p.split('/');
    const key = parts.slice(0, Math.min(depth, parts.length)).join('/');
    // Append wildcard if we truncated to a directory.
    const isFile = parts.length <= depth;
    const groupKey = isFile ? key : `${key}/**`;
    const existing = groups.get(groupKey) || { count: 0, examples: new Set() };
    existing.count += 1;
    if (existing.examples.size < 3) existing.examples.add(p);
    groups.set(groupKey, existing);
  }
  return groups;
}

function sortGroups(groups) {
  return [...groups.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .map(([key, val]) => ({ key, count: val.count, examples: [...val.examples] }));
}

function renderYaml(sorted, branch, limit) {
  const lines = [];
  lines.push(`# scope:paths inferred from ${limit} most recent commits on ${branch}`);
  lines.push(`# Review and edit before applying to your initiative.`);
  lines.push('scope:');
  lines.push('  paths:');
  for (const g of sorted) {
    lines.push(`    - '${g.key}'  # ${g.count} touch${g.count === 1 ? '' : 'es'}`);
  }
  return lines.join('\n');
}

function renderJson(sorted, branch, limit) {
  return JSON.stringify(
    {
      branch,
      sampledCommits: limit,
      paths: sorted.map((g) => ({ pattern: g.key, count: g.count, examples: g.examples })),
    },
    null,
    2
  );
}

function main() {
  const args = parseArgs(process.argv);
  detectGit();
  const branch = args.branch || getCurrentBranch();
  const paths = getChangedPaths(branch, args.limit, args.includeDeleted);

  if (paths.length === 0) {
    console.error(`No changed paths found in last ${args.limit} commits on ${branch}.`);
    process.exit(1);
  }

  const groups = groupAndCount(paths, args.depth);
  const sorted = sortGroups(groups);

  // Filter out single-touch noise unless the result would be empty.
  let filtered = sorted.filter((g) => g.count > 1);
  if (filtered.length === 0) filtered = sorted;

  if (args.json) {
    console.log(renderJson(filtered, branch, args.limit));
  } else {
    console.log(renderYaml(filtered, branch, args.limit));
  }
}

main();
