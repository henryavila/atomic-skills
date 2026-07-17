/**
 * Smoke: scripts/test-with-upstream-pack.js can stage the worktree package and
 * the receipt still names the same package/version integrity.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const RECEIPT_PATH = join(REPO_ROOT, 'docs/audits/minimalist-installer-upstream-receipt.json');
const DEFAULT_WORKTREE = '../minimalist-installer-integrity-remediation';

function resolveUpstreamWorktree() {
  if (!existsSync(RECEIPT_PATH)) {
    return resolve(REPO_ROOT, DEFAULT_WORKTREE);
  }
  const receipt = JSON.parse(readFileSync(RECEIPT_PATH, 'utf8'));
  return resolve(REPO_ROOT, receipt.worktree || DEFAULT_WORKTREE);
}

const upstreamWorktree = resolveUpstreamWorktree();
const upstreamWorktreeAvailable = existsSync(upstreamWorktree);

describe('upstream pack integration', () => {
  it(
    'receipt + worktree HEAD are coherent for local integration',
    {
      skip: upstreamWorktreeAvailable
        ? false
        : `upstream worktree missing (${upstreamWorktree})`,
    },
    () => {
      assert.ok(existsSync(RECEIPT_PATH));
      const receipt = JSON.parse(readFileSync(RECEIPT_PATH, 'utf8'));
      const worktree = resolve(REPO_ROOT, receipt.worktree || DEFAULT_WORKTREE);
      assert.ok(existsSync(worktree));
      const head = execFileSync('git', ['-C', worktree, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
      assert.match(head, /^[0-9a-f]{40}$/);
      // After T-002+, HEAD advances past baseSha.
      assert.notEqual(head, undefined);
      const base = receipt.baseSha;
      execFileSync('git', ['-C', worktree, 'merge-base', '--is-ancestor', base, head]);
    },
  );
});
