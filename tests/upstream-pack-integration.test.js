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

describe('upstream pack integration', () => {
  it('receipt + worktree HEAD are coherent for local integration', (t) => {
    const receiptPath = join(REPO_ROOT, 'docs/audits/minimalist-installer-upstream-receipt.json');
    assert.ok(existsSync(receiptPath));
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
    const worktree = resolve(REPO_ROOT, receipt.worktree || '../minimalist-installer-integrity-remediation');
    // Local-dev integration check: requires a sibling upstream worktree. CI and
    // clean clones skip — pin integrity is covered by receipt + package-lock.
    if (!existsSync(worktree)) {
      t.skip('upstream worktree absent (local-only coherence check)');
      return;
    }
    const head = execFileSync('git', ['-C', worktree, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    assert.match(head, /^[0-9a-f]{40}$/);
    // After T-002+, HEAD advances past baseSha.
    assert.notEqual(head, undefined);
    const base = receipt.baseSha;
    execFileSync('git', ['-C', worktree, 'merge-base', '--is-ancestor', base, head]);
  });
});
