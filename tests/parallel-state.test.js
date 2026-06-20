import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  contentToken,
  parseWorktrees,
  findWorktreeByBranch,
  resolveCanonicalParentDir,
  atomicWriteback,
  recordPendingWriteback,
  clearPendingWriteback,
} from '../src/parallel-state.js';
import { readLinks, validateLinks } from '../src/links-sidecar.js';

function withTmp(fn) {
  const root = mkdtempSync(join(tmpdir(), 'parallel-state-'));
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const PORCELAIN = [
  'worktree /home/u/repo',
  'HEAD aaaa',
  'branch refs/heads/plan/skills-restructuring',
  '',
  'worktree /home/u/repo/.worktrees/plan-fork',
  'HEAD bbbb',
  'branch refs/heads/plan/plan-fork',
  '',
  'worktree /home/u/repo/.worktrees/detached-one',
  'HEAD cccc',
  'detached',
  '',
].join('\n');

describe('contentToken (revision token = sha256 of bytes)', () => {
  it('returns null for an absent file', () => {
    withTmp((root) => {
      assert.equal(contentToken(join(root, 'nope.md')), null);
    });
  });

  it('is stable for identical bytes and changes when the content changes', () => {
    withTmp((root) => {
      const f = join(root, 'plan.md');
      writeFileSync(f, 'alpha');
      const t0 = contentToken(f);
      assert.equal(contentToken(f), t0, 'same bytes → same token');
      writeFileSync(f, 'alpha2');
      assert.notEqual(contentToken(f), t0, 'changed bytes → different token');
    });
  });
});

describe('parseWorktrees / findWorktreeByBranch (canonical resolution)', () => {
  it('parses worktree/branch pairs and marks detached as null', () => {
    const wts = parseWorktrees(PORCELAIN);
    assert.equal(wts.length, 3);
    assert.deepEqual(wts[1], { path: '/home/u/repo/.worktrees/plan-fork', branch: 'plan/plan-fork' });
    assert.equal(wts[2].branch, null, 'detached worktree has null branch');
  });

  it('finds the single worktree on a branch, null when none', () => {
    const wts = parseWorktrees(PORCELAIN);
    assert.equal(findWorktreeByBranch(wts, 'plan/plan-fork'), '/home/u/repo/.worktrees/plan-fork');
    assert.equal(findWorktreeByBranch(wts, 'plan/does-not-exist'), null);
  });

  it('throws on an ambiguous branch (never guesses a canonical target)', () => {
    const wts = [
      { path: '/a', branch: 'plan/dup' },
      { path: '/b', branch: 'plan/dup' },
    ];
    assert.throws(() => findWorktreeByBranch(wts, 'plan/dup'), /ambiguous/);
  });
});

describe('resolveCanonicalParentDir', () => {
  it('composes the parent plan dir inside the parent worktree (nested layout)', () => {
    const dir = resolveCanonicalParentDir({
      parentSlug: 'plan-fork',
      parentBranch: 'plan/plan-fork',
      projectId: 'atomic-skills',
      worktrees: parseWorktrees(PORCELAIN),
    });
    assert.equal(dir, '/home/u/repo/.worktrees/plan-fork/.atomic-skills/projects/atomic-skills/plan-fork');
  });

  it('throws when the parent has no named branch', () => {
    assert.throws(
      () => resolveCanonicalParentDir({ parentSlug: 'p', parentBranch: null, projectId: 'x', worktrees: [] }),
      /named branch/,
    );
  });

  it('throws when no worktree is on the parent branch', () => {
    assert.throws(
      () => resolveCanonicalParentDir({ parentSlug: 'p', parentBranch: 'plan/p', projectId: 'x', worktrees: parseWorktrees(PORCELAIN) }),
      /no worktree/,
    );
  });
});

describe('atomicWriteback (compare-and-swap)', () => {
  it('writes when the read token still matches the canonical file', () => {
    withTmp((root) => {
      const f = join(root, 'plan.md');
      writeFileSync(f, 'base\n');
      const token0 = contentToken(f);
      const res = atomicWriteback(f, { readToken: token0, mutate: (c) => c + 'appended\n' });
      assert.equal(res.ok, true);
      assert.equal(readFileSync(f, 'utf8'), 'base\nappended\n');
    });
  });

  it('aborts (conflict) without writing when the token is stale', () => {
    withTmp((root) => {
      const f = join(root, 'plan.md');
      writeFileSync(f, 'base\n');
      const staleToken = contentToken(f);
      // a concurrent writer changes the canonical file after the child's read
      writeFileSync(f, 'base\nparent-edit\n');
      const res = atomicWriteback(f, { readToken: staleToken, mutate: (c) => c + 'child-edit\n' });
      assert.equal(res.ok, false);
      assert.equal(res.conflict, true);
      assert.equal(res.reason, 'token-mismatch');
      // no lost update: the parent's edit survives, the child's mutate never applied
      assert.equal(readFileSync(f, 'utf8'), 'base\nparent-edit\n');
    });
  });

  it('releases the lock after each call (a later writeback can still run)', () => {
    withTmp((root) => {
      const f = join(root, 'plan.md');
      writeFileSync(f, 'base\n');
      const r1 = atomicWriteback(f, { readToken: contentToken(f), mutate: (c) => c + 'one\n' });
      assert.equal(r1.ok, true);
      assert.equal(existsSync(join(root, '.links.lock')), false, 'lock file removed after the write');
      const r2 = atomicWriteback(f, { readToken: contentToken(f), mutate: (c) => c + 'two\n' });
      assert.equal(r2.ok, true);
      assert.equal(readFileSync(f, 'utf8'), 'base\none\ntwo\n');
    });
  });

  it('concurrency: two writebacks captured at the SAME token0 — first wins, second conflicts, no lost update', () => {
    withTmp((root) => {
      const f = join(root, 'plan.md');
      writeFileSync(f, 'canonical-base\n');
      // both the parent and the child read the canonical file at the same instant
      const token0 = contentToken(f);

      // writer A (e.g. the parent) commits first
      const a = atomicWriteback(f, { readToken: token0, mutate: (c) => c + 'A-wins\n' });
      assert.equal(a.ok, true);

      // writer B (the child) still holds the now-stale token0 → must conflict
      const b = atomicWriteback(f, { readToken: token0, mutate: (c) => c + 'B-late\n' });
      assert.equal(b.ok, false);
      assert.equal(b.conflict, true);

      // the canonical file holds A's write only — B did not clobber it (no lost update)
      const final = readFileSync(f, 'utf8');
      assert.equal(final, 'canonical-base\nA-wins\n');
      assert.ok(!final.includes('B-late'), 'B never overwrote A');
    });
  });
});

describe('recordPendingWriteback / clearPendingWriteback (child-side recovery)', () => {
  it('writes a declarative pending-writeback into the child sidecar, then clears it', () => {
    withTmp((root) => {
      const childDir = join(root, 'plan-child');
      mkdirSync(childDir, { recursive: true });
      const pending = {
        target: 'parent-plan',
        parent: 'plan-fork',
        op: 'addSpawnedPlan',
        args: { phaseId: 'F2', childSlug: 'plan-child' },
        readToken: 'abc123',
        detectedAt: '2026-06-20T00:00:00Z',
        reason: 'parent canonical state changed since read',
      };
      recordPendingWriteback(childDir, pending);
      assert.deepEqual(readLinks(childDir).pendingWriteback, pending);

      clearPendingWriteback(childDir);
      assert.equal('pendingWriteback' in readLinks(childDir), false);
    });
  });

  it('schema accepts a valid pendingWriteback and REJECTS an invalid op (L-002 negative test)', () => {
    const base = {
      target: 'parent-plan',
      parent: 'plan-fork',
      readToken: 'tok',
      detectedAt: '2026-06-20T00:00:00Z',
    };
    assert.equal(validateLinks({ pendingWriteback: { ...base, op: 'addSpawnedPlan' } }).valid, true);
    assert.equal(validateLinks({ pendingWriteback: { ...base, op: 'rm -rf' } }).valid, false, 'op outside the enum is rejected');
    assert.equal(
      validateLinks({ pendingWriteback: { ...base, op: 'addSpawnedPlan', target: 'somewhere-else' } }).valid,
      false,
      'target outside the enum is rejected',
    );
  });
});
