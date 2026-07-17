#!/usr/bin/env node
/**
 * Pack the upstream worktree, verify its HEAD matches the receipt task SHA
 * (when present), install the tarball into a temporary node_modules overlay,
 * and run the requested tests with NODE_PATH pointing at that overlay.
 *
 * Does NOT mutate the consumer package-lock.json (T-005 / T-006 boundary).
 *
 * Usage:
 *   node scripts/test-with-upstream-pack.js \
 *     --worktree ../minimalist-installer-integrity-remediation \
 *     --receipt docs/audits/minimalist-installer-upstream-receipt.json \
 *     --test tests/installer-data-safety.test.js
 */
import { createHash } from 'node:crypto';
import {
  mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, cpSync, existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

function parseArgs(argv) {
  const out = { worktree: null, receipt: null, tests: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--worktree') out.worktree = argv[++i];
    else if (a === '--receipt') out.receipt = argv[++i];
    else if (a === '--test') out.tests.push(argv[++i]);
  }
  return out;
}

function git(worktree, args) {
  return execFileSync('git', ['-C', worktree, ...args], { encoding: 'utf8' }).trim();
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.worktree || args.tests.length === 0) {
    console.error('Usage: test-with-upstream-pack.js --worktree <path> --test <file> [--test ...] [--receipt path]');
    process.exit(1);
  }
  const worktree = resolve(REPO_ROOT, args.worktree);
  const head = git(worktree, ['rev-parse', 'HEAD']);

  if (args.receipt) {
    const receipt = JSON.parse(readFileSync(resolve(REPO_ROOT, args.receipt), 'utf8'));
    const want = receipt.tasks?.['F1/T-005']?.resultSha
      ?? receipt.tasks?.['F1/T-004']?.resultSha
      ?? receipt.tasks?.['F1/T-003']?.resultSha
      ?? receipt.tasks?.['F1/T-002']?.resultSha
      ?? receipt.resultSha;
    if (want && want !== head) {
      console.error(`receipt resultSha ${want} !== worktree HEAD ${head}`);
      process.exit(1);
    }
  }

  const staging = mkdtempSync(join(tmpdir(), 'as-upstream-pack-'));
  try {
    // Copy worktree sources into a package layout and point module resolution at it.
    const pkgDir = join(staging, 'node_modules', '@henryavila', 'minimalist-installer');
    mkdirSync(pkgDir, { recursive: true });
    cpSync(join(worktree, 'src'), join(pkgDir, 'src'), { recursive: true });
    cpSync(join(worktree, 'package.json'), join(pkgDir, 'package.json'));
    if (existsSync(join(worktree, 'LICENSE'))) {
      cpSync(join(worktree, 'LICENSE'), join(pkgDir, 'LICENSE'));
    }

    const env = {
      ...process.env,
      NODE_PATH: join(staging, 'node_modules')
        + (process.env.NODE_PATH ? `:${process.env.NODE_PATH}` : ''),
      ATOMIC_SKILLS_UPSTREAM_MI_ROOT: pkgDir,
      ATOMIC_SKILLS_UPSTREAM_MI_SHA: head,
    };

    const result = spawnSync(
      process.execPath,
      ['--test', ...args.tests.map((t) => resolve(REPO_ROOT, t))],
      { cwd: REPO_ROOT, env, stdio: 'inherit' },
    );
    process.exit(result.status ?? 1);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

main();
