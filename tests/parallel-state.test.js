import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
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
  writebackOrDefer,
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

  it('throws a clear error (not opaque EISDIR) when the path is a directory', () => {
    withTmp((root) => {
      const dir = join(root, 'somedir');
      mkdirSync(dir);
      assert.throws(() => contentToken(dir), /not a regular file/);
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

  it('reclaims a stale lock held by a DEAD pid (a crashed writer does not brick the channel)', () => {
    withTmp((root) => {
      const f = join(root, 'plan.md');
      writeFileSync(f, 'base\n');
      // a previous writer crashed leaving a lock owned by a pid that is not alive
      writeFileSync(join(root, '.links.lock'), JSON.stringify({ pid: 2147483646, ts: Date.now() }));
      const res = atomicWriteback(f, { readToken: contentToken(f), mutate: (c) => c + 'after-crash\n' });
      assert.equal(res.ok, true, 'dead-pid lock is reclaimed, not a permanent deadlock');
      assert.equal(readFileSync(f, 'utf8'), 'base\nafter-crash\n');
      assert.equal(existsSync(join(root, '.links.lock')), false, 'lock released after the reclaimed write');
    });
  });

  it('reclaims a lock older than the TTL even if its pid is alive', () => {
    withTmp((root) => {
      const f = join(root, 'plan.md');
      writeFileSync(f, 'base\n');
      // a lock owned by THIS (alive) process but stamped long ago → stale by TTL
      writeFileSync(join(root, '.links.lock'), JSON.stringify({ pid: process.pid, ts: Date.now() - 60_000 }));
      const res = atomicWriteback(f, { readToken: contentToken(f), mutate: (c) => c + 'ttl-reclaim\n' });
      assert.equal(res.ok, true);
      assert.equal(readFileSync(f, 'utf8'), 'base\nttl-reclaim\n');
    });
  });

  it('leaves no .tmp- temp file behind after a successful write', () => {
    withTmp((root) => {
      const f = join(root, 'plan.md');
      writeFileSync(f, 'base\n');
      atomicWriteback(f, { readToken: contentToken(f), mutate: (c) => c + 'x\n' });
      const leftovers = readdirSync(root).filter((n) => n.includes('.tmp-'));
      assert.deepEqual(leftovers, [], 'no orphan temp files');
    });
  });

  it('refuses to CREATE an absent canonical file under a null token (allowCreate=false default)', () => {
    withTmp((root) => {
      const f = join(root, 'missing-plan.md');
      // token0 = null (file absent); a naive null===null CAS would create state in the wrong place
      const res = atomicWriteback(f, { readToken: null, mutate: () => 'newly-created\n' });
      assert.equal(res.ok, false);
      assert.equal(res.reason, 'canonical-absent');
      assert.equal(existsSync(f), false, 'no file was created');
    });
  });

  it('allowCreate=true permits creating an absent target (e.g. a fresh sidecar)', () => {
    withTmp((root) => {
      const f = join(root, 'fresh.json');
      const res = atomicWriteback(f, { readToken: null, mutate: () => '{}\n', allowCreate: true });
      assert.equal(res.ok, true);
      assert.equal(readFileSync(f, 'utf8'), '{}\n');
    });
  });

  it('the lock actually GATES: an active fresh lock blocks a contender (kills a remove-the-lock mutation)', () => {
    withTmp((root) => {
      const f = join(root, 'plan.md');
      writeFileSync(f, 'base\n');
      // a live holder (this very process) with a fresh timestamp → NOT stale, cannot be reclaimed
      writeFileSync(join(root, '.links.lock'), JSON.stringify({ pid: process.pid, ts: Date.now() }));
      const res = atomicWriteback(f, { readToken: contentToken(f), mutate: (c) => c + 'blocked\n', retries: 2 });
      assert.equal(res.ok, false);
      assert.equal(res.reason, 'lock-timeout', 'a held fresh lock blocks the write — if openSync(wx) were removed this would wrongly succeed');
      assert.equal(readFileSync(f, 'utf8'), 'base\n', 'no write happened while the lock was held');
    });
  });
});

describe('writebackOrDefer (single conflict-handling entry point)', () => {
  it('records pendingWriteback in the child sidecar BEFORE returning on conflict', () => {
    withTmp((root) => {
      const canonical = join(root, 'parent-plan.md');
      const childDir = join(root, 'child');
      mkdirSync(childDir, { recursive: true });
      writeFileSync(canonical, 'base\n');
      const token0 = contentToken(canonical);
      // a concurrent parent edit makes token0 stale
      writeFileSync(canonical, 'base\nparent\n');
      const pending = {
        target: 'parent-plan',
        parent: 'plan-fork',
        op: 'addSpawnedPlan',
        args: { phaseId: 'F2', childSlug: 'child' },
        readToken: token0,
        detectedAt: '2026-06-20T00:00:00Z',
        reason: 'token-mismatch',
      };
      const res = writebackOrDefer({
        canonicalFile: canonical,
        childPlanDir: childDir,
        readToken: token0,
        mutate: (c) => c + 'child\n',
        pending,
      });
      assert.equal(res.ok, false);
      assert.equal(res.deferred, true);
      // the durable recovery marker exists even though the writeback was rejected
      assert.deepEqual(readLinks(childDir).pendingWriteback, pending);
      // no lost update on the canonical file
      assert.equal(readFileSync(canonical, 'utf8'), 'base\nparent\n');
    });
  });

  it('clears a prior pendingWriteback on a successful writeback (the link converged)', () => {
    withTmp((root) => {
      const canonical = join(root, 'parent-plan.md');
      const childDir = join(root, 'child');
      mkdirSync(childDir, { recursive: true });
      writeFileSync(canonical, 'base\n');
      // a stale recovery marker from a prior conflict
      recordPendingWriteback(childDir, {
        target: 'parent-plan',
        parent: 'plan-fork',
        op: 'addSpawnedPlan',
        args: { phaseId: 'F2', childSlug: 'child' },
        readToken: 'old',
        detectedAt: '2026-06-20T00:00:00Z',
      });
      const res = writebackOrDefer({
        canonicalFile: canonical,
        childPlanDir: childDir,
        readToken: contentToken(canonical),
        mutate: (c) => c + 'ok\n',
        pending: { target: 'parent-plan', parent: 'plan-fork', op: 'addSpawnedPlan', args: { phaseId: 'F2', childSlug: 'child' }, readToken: 'x', detectedAt: '2026-06-20T00:00:00Z' },
      });
      assert.equal(res.ok, true);
      assert.equal('pendingWriteback' in readLinks(childDir), false, 'converged → recovery marker cleared');
      assert.equal(readFileSync(canonical, 'utf8'), 'base\nok\n');
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

  it('schema accepts a valid pendingWriteback and REJECTS an invalid op/target (L-002 negative test)', () => {
    const base = {
      target: 'parent-plan',
      parent: 'plan-fork',
      args: { phaseId: 'F2', childSlug: 'plan-child' },
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

  it('schema constrains args PER op — a malformed replay payload fails at record time, not F3 replay (L-002)', () => {
    const head = { target: 'parent-plan', parent: 'plan-fork', readToken: 'tok', detectedAt: '2026-06-20T00:00:00Z' };
    // addSpawnedPlan requires {phaseId, childSlug}
    assert.equal(
      validateLinks({ pendingWriteback: { ...head, op: 'addSpawnedPlan', args: { phaseId: 'F2', childSlug: 'c' } } }).valid,
      true,
    );
    assert.equal(
      validateLinks({ pendingWriteback: { ...head, op: 'addSpawnedPlan', args: { phaseId: 'F2' } } }).valid,
      false,
      'addSpawnedPlan missing childSlug is rejected at record time',
    );
    assert.equal(
      validateLinks({ pendingWriteback: { ...head, op: 'addSpawnedPlan', args: {} } }).valid,
      false,
      'addSpawnedPlan with empty args is rejected',
    );
    // resumeParent requires {phaseId}
    assert.equal(
      validateLinks({ pendingWriteback: { ...head, op: 'resumeParent', args: { phaseId: 'F2' } } }).valid,
      true,
    );
    assert.equal(
      validateLinks({ pendingWriteback: { ...head, op: 'resumeParent', args: {} } }).valid,
      false,
      'resumeParent missing phaseId is rejected',
    );
    // args is now required outright
    assert.equal(
      validateLinks({ pendingWriteback: { ...head, op: 'addSpawnedPlan' } }).valid,
      false,
      'a pendingWriteback with no args at all is rejected',
    );
  });
});
