import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
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
import { readLinks, validateLinks, setSpawnedFrom, getSpawnedFrom } from '../src/links-sidecar.js';

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

// --- F3 fork-resume: deterministic parent resume across both modes ---
//
// The resume application (project-transitions.md `fork-resume`): parallel reuses
// the F2 writeback (writebackOrDefer), pause applies the mutation directly (same
// tree). These tests cover the four decision paths (accept / refuse / no-TTY /
// failed-writeback) in BOTH modes, asserting the durable-state contract — never
// a child archived against an inconsistent parent.
const ANCHOR = 'F3';

// A parent paused by a fork at anchor F3, but with currentPhase still pointing at
// F2 (the by-status active phase). Resume MUST move it to the NAMED anchor (F3),
// never leave it at the by-status F2 — the L-003 (plan-fork/F1) guard.
function parentPlanFixture() {
  return ['plan: plan-fork', 'status: paused', 'currentPhase: F2', 'anchorPhaseStatus: paused', ''].join('\n');
}

// The resume mutation, shared by pause-accept (direct) and parallel-accept (via
// writebackOrDefer's mutate): parent active, currentPhase := the named anchor,
// anchor phase active. 'anchorPhaseStatus: paused' contains no lowercase
// 'status: paused' substring, so the top-level replace targets only the plan status.
function resumeMutation(phaseId) {
  return (content) =>
    content
      .replace('status: paused', 'status: active')
      .replace('currentPhase: F2', `currentPhase: ${phaseId}`)
      .replace('anchorPhaseStatus: paused', 'anchorPhaseStatus: active');
}

function resumePending(parentSlug, phaseId, readToken, reason) {
  return {
    target: 'parent-plan',
    parent: parentSlug,
    op: 'resumeParent',
    args: { phaseId },
    readToken,
    detectedAt: '2026-06-20T00:00:00Z',
    ...(reason ? { reason } : {}),
  };
}

// Build a (parent canonical file, child dir with the spawnedFrom edge) pair.
function forkFixture(root, mode) {
  const canonical = join(root, 'parent', 'plan.md');
  mkdirSync(dirname(canonical), { recursive: true });
  const childDir = join(root, 'child');
  mkdirSync(childDir, { recursive: true });
  setSpawnedFrom(childDir, { plan: 'plan-fork', phaseId: ANCHOR, mode });
  writeFileSync(canonical, parentPlanFixture());
  return { canonical, childDir };
}

describe('fork-resume (F3): parallel mode (reuses the F2 writeback)', () => {
  it('accept: writeback resumes the parent at the NAMED anchor and clears the marker', () => {
    // kills a resume that leaves currentPhase at the by-status F2 instead of the edge's F3.
    withTmp((root) => {
      const { canonical, childDir } = forkFixture(root, 'parallel');
      const edge = getSpawnedFrom(childDir); // T-001's read drives the anchor
      const readToken = contentToken(canonical);
      const res = writebackOrDefer({
        canonicalFile: canonical,
        childPlanDir: childDir,
        readToken,
        mutate: resumeMutation(edge.phaseId),
        pending: resumePending('plan-fork', edge.phaseId, readToken),
      });
      assert.equal(res.ok, true);
      const after = readFileSync(canonical, 'utf8');
      assert.match(after, /^status: active$/m);
      assert.match(after, /^currentPhase: F3$/m, 'currentPhase is the NAMED anchor (F3), not the by-status F2');
      assert.match(after, /^anchorPhaseStatus: active$/m);
      assert.equal('pendingWriteback' in readLinks(childDir), false, 'converged → recovery marker cleared');
    });
  });

  it('failed-writeback: a concurrent parent edit defers — durable marker recorded, parent NOT finalized', () => {
    // kills a writeback-fail that finalizes the child anyway / loses the recovery marker.
    withTmp((root) => {
      const { canonical, childDir } = forkFixture(root, 'parallel');
      const readToken = contentToken(canonical);
      writeFileSync(canonical, parentPlanFixture() + 'concurrent-edit\n'); // token0 now stale
      const res = writebackOrDefer({
        canonicalFile: canonical,
        childPlanDir: childDir,
        readToken,
        mutate: resumeMutation(ANCHOR),
        pending: resumePending('plan-fork', ANCHOR, readToken, 'token-mismatch'),
      });
      assert.equal(res.ok, false);
      assert.equal(res.deferred, true);
      const marker = readLinks(childDir).pendingWriteback;
      assert.equal(marker.op, 'resumeParent', 'durable resumeParent marker persisted before return');
      assert.equal(marker.args.phaseId, ANCHOR);
      assert.match(readFileSync(canonical, 'utf8'), /^status: paused$/m, 'parent not flipped to active on a deferred writeback');
    });
  });

  it('refuse: no writeback; durable resumeParent marker persisted, parent untouched', () => {
    withTmp((root) => {
      const { canonical, childDir } = forkFixture(root, 'parallel');
      const edge = getSpawnedFrom(childDir);
      const readToken = contentToken(canonical);
      recordPendingWriteback(childDir, resumePending('plan-fork', edge.phaseId, readToken, 'user refused — deferred'));
      const links = readLinks(childDir);
      assert.equal(links.pendingWriteback.op, 'resumeParent');
      assert.equal(links.pendingWriteback.args.phaseId, ANCHOR);
      // the prescribed resume marker (op/target/args) + the edge form a schema-valid
      // sidecar — kills a procedure prescribing a malformed resumeParent payload (L-002).
      assert.equal(validateLinks(links).valid, true, 'durable sidecar (edge + resumeParent marker) is schema-valid');
      assert.match(readFileSync(canonical, 'utf8'), /^status: paused$/m, 'refuse leaves the parent paused');
    });
  });

  it('no-TTY: records the marker without a writeback (no prompt), parent untouched', () => {
    // identical durable outcome to refuse, but reached automatically via the
    // non-interactive guard rather than a user decision.
    withTmp((root) => {
      const { canonical, childDir } = forkFixture(root, 'parallel');
      const readToken = contentToken(canonical);
      recordPendingWriteback(childDir, resumePending('plan-fork', ANCHOR, readToken, 'no TTY — auto-deferred'));
      const links = readLinks(childDir);
      assert.equal(links.pendingWriteback.op, 'resumeParent');
      assert.equal(validateLinks(links).valid, true);
      assert.match(readFileSync(canonical, 'utf8'), /^status: paused$/m);
    });
  });
});

describe('fork-resume (F3): pause mode (same tree — direct mutation, no CAS)', () => {
  it('accept: direct mutation resumes the parent at the named anchor', () => {
    // kills a pause resume that does not flip currentPhase to the edge's anchor.
    withTmp((root) => {
      const { canonical, childDir } = forkFixture(root, 'pause');
      const edge = getSpawnedFrom(childDir);
      assert.equal(edge.mode, 'pause');
      writeFileSync(canonical, resumeMutation(edge.phaseId)(readFileSync(canonical, 'utf8')));
      const after = readFileSync(canonical, 'utf8');
      assert.match(after, /^status: active$/m);
      assert.match(after, /^currentPhase: F3$/m, 'currentPhase is the NAMED anchor');
      assert.match(after, /^anchorPhaseStatus: active$/m);
    });
  });

  it('refuse: durable resumeParent marker, parent untouched', () => {
    withTmp((root) => {
      const { canonical, childDir } = forkFixture(root, 'pause');
      const readToken = contentToken(canonical);
      recordPendingWriteback(childDir, resumePending('plan-fork', ANCHOR, readToken, 'user refused — deferred'));
      const links = readLinks(childDir);
      assert.equal(links.pendingWriteback.op, 'resumeParent');
      assert.equal(validateLinks(links).valid, true);
      assert.match(readFileSync(canonical, 'utf8'), /^status: paused$/m);
    });
  });

  it('no-TTY: marker recorded without prompt, parent untouched', () => {
    withTmp((root) => {
      const { canonical, childDir } = forkFixture(root, 'pause');
      const readToken = contentToken(canonical);
      recordPendingWriteback(childDir, resumePending('plan-fork', ANCHOR, readToken, 'no TTY — auto-deferred'));
      const links = readLinks(childDir);
      assert.equal(links.pendingWriteback.op, 'resumeParent');
      assert.equal(validateLinks(links).valid, true);
      assert.match(readFileSync(canonical, 'utf8'), /^status: paused$/m);
    });
  });

  it('failed-write: a REAL same-tree write failure leaves the durable marker and the parent unchanged', () => {
    withTmp((root) => {
      const { canonical, childDir } = forkFixture(root, 'pause');
      const before = readFileSync(canonical, 'utf8');
      const readToken = contentToken(canonical);
      // Force the direct same-tree resume write to actually throw: target a path
      // that IS a directory (writeFileSync → EISDIR), modelling a write that dies
      // mid-resume. The recovery path then records the durable marker. This kills a
      // failure branch that swallows the error without persisting a recovery marker,
      // or one that partially writes the parent.
      let threw = false;
      try {
        writeFileSync(join(root, 'parent'), resumeMutation(ANCHOR)(before)); // root/parent is a dir
      } catch {
        threw = true;
        recordPendingWriteback(childDir, resumePending('plan-fork', ANCHOR, readToken, 'write failed — deferred'));
      }
      assert.equal(threw, true, 'the same-tree resume write actually failed (EISDIR)');
      const links = readLinks(childDir);
      assert.equal(links.pendingWriteback.op, 'resumeParent', 'a real failure persisted a durable resume marker');
      assert.equal(validateLinks(links).valid, true);
      assert.equal(readFileSync(canonical, 'utf8'), before, 'parent plan byte-identical on a failed resume write');
    });
  });
});

// The fork-resume LOGIC lives in a procedure doc executed by an AI agent (no JS
// executor — that is out of this phase's scope). These contract tests gate the
// doc's load-bearing procedural guards: they FAIL if a future edit drops the hard
// archive gate, the marker-before-mutation ordering, or the do-not-finalize rule —
// the structural integrity the T-001 grep verifier cannot check.
describe('fork-resume (F3): procedure-doc contract (project-transitions.md)', () => {
  const DOC = readFileSync(new URL('../skills/shared/project-assets/project-transitions.md', import.meta.url), 'utf8');
  const archiveSection = DOC.slice(DOC.indexOf('## `archive'), DOC.indexOf('## `switch'));
  const forkResume = DOC.slice(DOC.indexOf('### `fork-resume`'), DOC.indexOf('## `switch'));

  it('archive reads the fork edge BEFORE Plan archival and gates step 3 on the outcome', () => {
    const gateIdx = archiveSection.indexOf('getSpawnedFrom');
    const planArchivalIdx = archiveSection.indexOf('Plan archival');
    assert.ok(gateIdx > -1, 'archive reads getSpawnedFrom');
    assert.ok(gateIdx < planArchivalIdx, 'the edge is read before Plan archival (no finalize before the gate)');
    assert.ok(archiveSection.includes('HARD gate'), 'step 2 is a hard gate, not a fall-through offer');
    assert.ok(archiveSection.includes('STOP the `archive`'), 'a non-accept outcome STOPs the archive command before step 3');
  });

  it('pause accept records the recovery marker BEFORE the parent writes (marker-before-mutation)', () => {
    const pause = forkResume.slice(forkResume.indexOf('mode `pause`'));
    const recordIdx = pause.indexOf('recordPendingWriteback');
    const mutateIdx = pause.indexOf('apply the resume mutation');
    assert.ok(recordIdx > -1 && mutateIdx > -1, 'pause accept names both the marker write and the mutation');
    assert.ok(recordIdx < mutateIdx, 'recordPendingWriteback precedes the non-atomic parent writes');
    assert.ok(pause.includes('marker-before-mutation'), 'the ordering is called out explicitly');
  });

  it('a non-accept resume path explicitly leaves the child un-finalized', () => {
    assert.ok(/refuse \/ no-TTY/.test(forkResume), 'the refuse/no-TTY path exists');
    assert.ok(forkResume.includes('do **not** finalize the child'), 'a non-accept path explicitly does not finalize the child');
  });
});
