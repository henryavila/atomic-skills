#!/usr/bin/env node
/**
 * Verify docs/audits/minimalist-installer-upstream-receipt.json against the
 * upstream worktree and (optionally) the remote branch tip.
 *
 * Usage:
 *   node scripts/verify-upstream-receipt.js --task F1/T-001 --worktree ../minimalist-installer-integrity-remediation
 *   node scripts/verify-upstream-receipt.js --task F1/T-006 --worktree ... --require-remote
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const DEFAULT_RECEIPT = join(REPO_ROOT, 'docs/audits/minimalist-installer-upstream-receipt.json');

function parseArgs(argv) {
  const out = { task: null, worktree: null, requireRemote: false, receipt: DEFAULT_RECEIPT };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--task') out.task = argv[++i];
    else if (a === '--worktree') out.worktree = argv[++i];
    else if (a === '--receipt') out.receipt = resolve(argv[++i]);
    else if (a === '--require-remote') out.requireRemote = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function fail(msg) {
  console.error(`verify-upstream-receipt: ${msg}`);
  process.exit(1);
}

function git(worktree, args) {
  return execFileSync('git', ['-C', worktree, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function walkFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkFiles(p, acc);
    else acc.push(p);
  }
  return acc;
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function packageLockIntegrity() {
  const lockPath = join(REPO_ROOT, 'package-lock.json');
  if (!existsSync(lockPath)) fail('package-lock.json missing');
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  const entry =
    lock.packages?.['node_modules/@henryavila/minimalist-installer']
    ?? lock.dependencies?.['@henryavila/minimalist-installer'];
  if (!entry?.integrity) fail('package-lock missing @henryavila/minimalist-installer integrity');
  return {
    integrity: entry.integrity,
    resolved: entry.resolved,
    version: entry.version,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.task || !args.worktree) {
    console.log(`Usage: node scripts/verify-upstream-receipt.js --task F1/T-00N --worktree <path> [--require-remote] [--receipt path]`);
    process.exit(args.help ? 0 : 1);
  }

  if (!existsSync(args.receipt)) fail(`receipt missing: ${args.receipt}`);
  const receipt = JSON.parse(readFileSync(args.receipt, 'utf8'));

  const lock = packageLockIntegrity();
  // dist.integrity is the published 0.1.0 baseline tarball. After T-006 the lock
  // may resolve a git commit of the remediated branch — that is tracked via
  // receipt.resultSha / receipt.integrated, not by overwriting dist.integrity.
  if (!receipt.dist?.integrity) {
    fail('receipt.dist.integrity missing (0.1.0 baseline tarball integrity)');
  }
  if (receipt.integrated?.integrity && lock.integrity && receipt.integrated.integrity !== lock.integrity) {
    fail(`receipt.integrated.integrity !== package-lock integrity\n  receipt: ${receipt.integrated.integrity}\n  lock:    ${lock.integrity}`);
  }
  if (receipt.integrated?.resolved && lock.resolved && receipt.integrated.resolved !== lock.resolved) {
    // Allow prefix match for git+ssh vs github: forms.
    const a = receipt.integrated.resolved;
    const b = lock.resolved;
    if (!a.includes(receipt.resultSha || '') && a !== b) {
      fail(`receipt.integrated.resolved !== lock resolved\n  receipt: ${a}\n  lock:    ${b}`);
    }
  }

  const worktree = resolve(REPO_ROOT, args.worktree);
  if (!existsSync(join(worktree, '.git')) && !existsSync(join(worktree, 'src'))) {
    fail(`worktree not found or incomplete: ${worktree}`);
  }

  let head;
  let branch;
  let origin;
  try {
    head = git(worktree, ['rev-parse', 'HEAD']);
    branch = git(worktree, ['rev-parse', '--abbrev-ref', 'HEAD']);
    origin = git(worktree, ['remote', 'get-url', 'origin']);
  } catch (err) {
    fail(`git inspect failed in ${worktree}: ${err.message}`);
  }

  if (!receipt.baseSha || !/^[0-9a-f]{40}$/i.test(receipt.baseSha)) {
    fail(`receipt.baseSha must be a full 40-char SHA, got: ${receipt.baseSha}`);
  }
  try {
    git(worktree, ['cat-file', '-e', `${receipt.baseSha}^{commit}`]);
  } catch {
    fail(`baseSha ${receipt.baseSha} is not a commit in worktree`);
  }

  // Uniqueness: baseSha must be reachable; ambiguity of multiple candidates is
  // out of scope once content-match is established at materialization time.
  if (receipt.branch && branch !== receipt.branch && branch !== 'HEAD') {
    // Detached HEAD is OK during recovery; otherwise branch must match.
    if (branch !== 'HEAD') {
      fail(`worktree branch ${branch} !== receipt.branch ${receipt.branch}`);
    }
  }
  if (receipt.origin) {
    const normalize = (u) => u.replace(/\.git$/, '').replace(/\/$/, '');
    if (normalize(origin) !== normalize(receipt.origin)) {
      fail(`worktree origin ${origin} !== receipt.origin ${receipt.origin}`);
    }
  }

  // At base: worktree src must match installed package when head == baseSha.
  const installedSrc = join(REPO_ROOT, 'node_modules/@henryavila/minimalist-installer/src');
  if (head === receipt.baseSha && existsSync(installedSrc)) {
    const wtSrc = join(worktree, 'src');
    const aFiles = walkFiles(installedSrc).map((f) => f.slice(installedSrc.length + 1)).sort();
    const bFiles = walkFiles(wtSrc).map((f) => f.slice(wtSrc.length + 1)).sort();
    if (JSON.stringify(aFiles) !== JSON.stringify(bFiles)) {
      fail('src file list mismatch between installed package and worktree at baseSha');
    }
    for (const rel of aFiles) {
      if (sha256File(join(installedSrc, rel)) !== sha256File(join(wtSrc, rel))) {
        fail(`src content mismatch at baseSha for ${rel}`);
      }
    }
  }

  const taskEntry = receipt.tasks?.[args.task];
  if (!taskEntry) {
    fail(`receipt.tasks missing entry for ${args.task}`);
  }
  if (taskEntry.resultSha) {
    try {
      git(worktree, ['cat-file', '-e', `${taskEntry.resultSha}^{commit}`]);
    } catch {
      fail(`task ${args.task} resultSha ${taskEntry.resultSha} not in worktree`);
    }
    // For completed tasks beyond T-001, HEAD should be at or descendant of resultSha.
    if (args.task !== 'F1/T-001') {
      try {
        const mergeBase = git(worktree, ['merge-base', '--is-ancestor', taskEntry.resultSha, head]);
        void mergeBase;
      } catch {
        // merge-base --is-ancestor exits 1 if not ancestor
        const isAncestor = (() => {
          try {
            execFileSync('git', ['-C', worktree, 'merge-base', '--is-ancestor', taskEntry.resultSha, head], {
              stdio: 'ignore',
            });
            return true;
          } catch {
            return false;
          }
        })();
        if (!isAncestor && head !== taskEntry.resultSha) {
          fail(`HEAD ${head} is not at/descendant of task resultSha ${taskEntry.resultSha}`);
        }
      }
    }
  }

  if (args.requireRemote) {
    if (!receipt.remotePublished) {
      fail('--require-remote set but receipt.remotePublished is not true');
    }
    const want = receipt.resultSha || taskEntry.resultSha;
    if (!want) fail('--require-remote requires resultSha');
    let remoteTip;
    try {
      remoteTip = git(worktree, ['ls-remote', 'origin', `refs/heads/${receipt.branch}`]).split(/\s+/)[0];
    } catch (err) {
      fail(`ls-remote failed: ${err.message}`);
    }
    if (!remoteTip) fail(`remote branch ${receipt.branch} not found on origin`);
    if (remoteTip !== want) {
      fail(`origin/${receipt.branch} tip ${remoteTip} !== resultSha ${want}`);
    }
  }

  console.log(JSON.stringify({
    ok: true,
    task: args.task,
    baseSha: receipt.baseSha,
    head,
    branch,
    taskResultSha: taskEntry.resultSha ?? null,
    remotePublished: Boolean(receipt.remotePublished),
  }, null, 2));
}

main();
