/**
 * focus-digest.test.js — the producer side of the claudebar integration.
 *
 * `scripts/emit-focus.js` projects the canonical `.atomic-skills/` state into a
 * single flat `focus.json` digest that an external statusline (claudebar) reads
 * to render "plan · phase i/n · tasks done/total" without walking the YAML tree.
 *
 * Contract under test (see docs/design/statusline-focus-integration.md):
 *  - the digest shape validates against meta/schemas/focus.schema.json,
 *  - done/total come from the precomputed rollups; blocked is counted from tasks[],
 *  - phase index/total are 1-based position within plan.phases[],
 *  - `sources[]` records each source file's repo-relative path + frontmatter
 *    `lastUpdated` (the staleness fingerprint the consumer re-reads),
 *  - no active plan → `plan: null`,
 *  - >1 active plan → `flags.multipleActivePlans: true`, focus = the `current:true` phase,
 *  - the write is atomic (tmp + rename) and only happens when `.atomic-skills/` exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Ajv from 'ajv/dist/2020.js';

import { buildFocusDigest, emitFocus } from '../scripts/emit-focus.js';
import { bindPlanBranch, stampBranch } from '../scripts/bind-plan-branch.js';
import { setSpawnedFrom } from '../src/links-sidecar.js';

const FIXED_NOW = '2026-06-15T12:00:00.000Z';

function schemaValidator() {
  const schema = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'meta', 'schemas', 'focus.schema.json'), 'utf8'));
  const ajv = new Ajv({ allErrors: true, strict: false });
  return ajv.compile(schema);
}

function writeFm(path, fm) {
  writeFileSync(path, `---\n${fm}\n---\n\nbody\n`);
}

/** Build a repo fixture with one active plan (F0 of 2) and its phase initiative. */
function singleActiveRepo() {
  const repo = mkdtempSync(join(tmpdir(), 'focus-single-'));
  const planDir = join(repo, '.atomic-skills', 'projects', 'atomic-skills', 'plan-a');
  mkdirSync(join(planDir, 'phases'), { recursive: true });
  writeFm(join(planDir, 'plan.md'), [
    'schemaVersion: "0.1"',
    'slug: plan-a',
    'title: Plan A',
    'status: active',
    'currentPhase: F0',
    'lastUpdated: 2026-06-15T10:00:00Z',
    'phases:',
    '  - id: F0',
    '    slug: plan-a-f0',
    '    title: Phase Zero',
    '    status: active',
    '  - id: F1',
    '    slug: plan-a-f1',
    '    title: Phase One',
    '    status: pending',
  ].join('\n'));
  writeFm(join(planDir, 'phases', 'f0-phase-zero.md'), [
    'schemaVersion: "0.1"',
    'slug: plan-a-f0',
    'title: Phase Zero',
    'status: active',
    'phaseId: F0',
    'parentPlan: plan-a',
    'nextAction: "Do T0.1"',
    'tasksDone: 2',     // rollup is authoritative for done/total ...
    'tasksTotal: 5',
    'gatesMet: 0',
    'gatesTotal: 1',
    'lastUpdated: 2026-06-15T11:00:00Z',
    'current: true',
    'planActive: true',
    'tasks:',          // ... blocked is counted here (no rollup field exists)
    '  - id: T0.1',
    '    status: done',
    '  - id: T0.2',
    '    status: blocked',
  ].join('\n'));
  return repo;
}

test('buildFocusDigest projects the active plan/phase with rollups + sources', () => {
  const repo = singleActiveRepo();
  try {
    const d = buildFocusDigest(repo, { now: FIXED_NOW });

    assert.equal(d.schemaVersion, '0.1');
    assert.equal(d.generatedAt, FIXED_NOW);
    assert.equal(d.projectId, 'atomic-skills');

    assert.deepEqual(d.plan, { slug: 'plan-a', title: 'Plan A', status: 'active' });
    assert.equal(d.phase.id, 'F0');
    assert.equal(d.phase.index, 1);   // 1-based position in plan.phases[]
    assert.equal(d.phase.total, 2);
    assert.equal(d.phase.title, 'Phase Zero');

    assert.deepEqual(d.tasks, { done: 2, total: 5, blocked: 1 }); // done/total=rollup, blocked=tasks[]
    assert.deepEqual(d.gates, { met: 0, total: 1 });
    assert.equal(d.nextAction, 'Do T0.1');
    assert.equal(d.flags.drift, false);
    assert.equal(d.flags.multipleActivePlans, false);

    // sources: plan.md + the phase file, repo-relative, with frontmatter lastUpdated.
    const byPath = Object.fromEntries(d.sources.map((s) => [s.path, s.lastUpdated]));
    assert.equal(byPath['.atomic-skills/projects/atomic-skills/plan-a/plan.md'], '2026-06-15T10:00:00Z');
    assert.equal(byPath['.atomic-skills/projects/atomic-skills/plan-a/phases/f0-phase-zero.md'], '2026-06-15T11:00:00Z');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('digest validates against focus.schema.json', () => {
  const repo = singleActiveRepo();
  try {
    const validate = schemaValidator();
    const d = buildFocusDigest(repo, { now: FIXED_NOW });
    assert.ok(validate(d), `schema errors: ${JSON.stringify(validate.errors, null, 2)}`);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('no active plan → plan: null, schema still valid', () => {
  const repo = mkdtempSync(join(tmpdir(), 'focus-none-'));
  try {
    const planDir = join(repo, '.atomic-skills', 'projects', 'p', 'paused-plan');
    mkdirSync(join(planDir, 'phases'), { recursive: true });
    writeFm(join(planDir, 'plan.md'), [
      'schemaVersion: "0.1"',
      'slug: paused-plan',
      'title: Paused',
      'status: paused',
      'currentPhase: F0',
      'lastUpdated: 2026-06-15T10:00:00Z',
      'phases:',
      '  - id: F0',
      '    slug: p-f0',
      '    title: Zero',
      '    status: paused',
    ].join('\n'));
    const validate = schemaValidator();
    const d = buildFocusDigest(repo, { now: FIXED_NOW });
    assert.equal(d.plan, null);
    assert.equal(d.phase, null);
    assert.deepEqual(d.sources, []);
    assert.ok(validate(d), `schema errors: ${JSON.stringify(validate.errors)}`);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('multiple active plans → branch match wins, else recency; flag is set', () => {
  const repo = mkdtempSync(join(tmpdir(), 'focus-multi-'));
  try {
    const mk = (slug, last, branch) => {
      const planDir = join(repo, '.atomic-skills', 'projects', 'p', slug);
      mkdirSync(join(planDir, 'phases'), { recursive: true });
      writeFm(join(planDir, 'plan.md'), [
        'schemaVersion: "0.1"', `slug: ${slug}`, `title: ${slug}`, 'status: active',
        'currentPhase: F0', `lastUpdated: ${last}`, ...(branch ? [`branch: ${branch}`] : []),
        'phases:', '  - id: F0', `    slug: ${slug}-f0`, '    title: Zero', '    status: active',
      ].join('\n'));
      writeFm(join(planDir, 'phases', 'f0-zero.md'), [
        'schemaVersion: "0.1"', `slug: ${slug}-f0`, 'title: Zero', 'status: active',
        'phaseId: F0', `parentPlan: ${slug}`, 'tasksDone: 1', 'tasksTotal: 3', 'gatesMet: 0', 'gatesTotal: 0',
        `lastUpdated: ${last}`, 'current: true', 'planActive: true',
      ].join('\n'));
    };
    // plan-fresh is more recent; plan-feature carries the matching branch.
    mk('plan-fresh', '2026-06-15T11:00:00Z', null);
    mk('plan-feature', '2026-06-15T09:00:00Z', 'feature/x');

    // No branch context → newest (plan-fresh) wins.
    const recency = buildFocusDigest(repo, { now: FIXED_NOW });
    assert.equal(recency.plan.slug, 'plan-fresh');
    assert.equal(recency.flags.multipleActivePlans, true);

    // Branch match beats recency.
    const matched = buildFocusDigest(repo, { now: FIXED_NOW, branch: 'feature/x' });
    assert.equal(matched.plan.slug, 'plan-feature');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('emitFocus writes .atomic-skills/focus.json atomically; no-op without state', () => {
  const repo = singleActiveRepo();
  try {
    const res = emitFocus(repo, { now: FIXED_NOW });
    const out = join(repo, '.atomic-skills', 'focus.json');
    assert.equal(res.written, true);
    assert.ok(existsSync(out));
    assert.ok(!existsSync(`${out}.tmp`), 'temp file must be renamed away');
    const onDisk = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(onDisk.plan.slug, 'plan-a');

    // A repo with no .atomic-skills/ is a no-op (never litters the tree).
    const bare = mkdtempSync(join(tmpdir(), 'focus-bare-'));
    try {
      const r2 = emitFocus(bare, { now: FIXED_NOW });
      assert.equal(r2.written, false);
      assert.ok(!existsSync(join(bare, '.atomic-skills')));
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

/** Active plan with an explicit `branch:` line (or none when branch is null). */
function writeBranchedPlan(repo, slug, branch, last) {
  const planDir = join(repo, '.atomic-skills', 'projects', 'p', slug);
  mkdirSync(join(planDir, 'phases'), { recursive: true });
  writeFm(join(planDir, 'plan.md'), [
    'schemaVersion: "0.1"', `slug: ${slug}`, `title: ${slug}`, 'status: active',
    'currentPhase: F0', `lastUpdated: ${last}`, ...(branch ? [`branch: ${branch}`] : []),
    'phases:', '  - id: F0', `    slug: ${slug}-f0`, '    title: Zero', '    status: active',
  ].join('\n'));
  writeFm(join(planDir, 'phases', 'f0-zero.md'), [
    'schemaVersion: "0.1"', `slug: ${slug}-f0`, 'title: Zero', 'status: active',
    'phaseId: F0', `parentPlan: ${slug}`, 'tasksDone: 0', 'tasksTotal: 1', 'gatesMet: 0', 'gatesTotal: 0',
    `lastUpdated: ${last}`, 'planActive: true',
  ].join('\n'));
}

test('isolated worktrees (distinct branches) → multipleActivePlans is FALSE', () => {
  const repo = mkdtempSync(join(tmpdir(), 'focus-iso-'));
  try {
    // Two genuinely-parallel plans, each owning its own branch/worktree.
    writeBranchedPlan(repo, 'plan-a', 'feature/a', '2026-06-15T09:00:00Z');
    writeBranchedPlan(repo, 'plan-b', 'feature/b', '2026-06-15T10:00:00Z');

    // In the feature/a worktree: focus = plan-a, and NO ambiguity — exactly one
    // active plan claims this tree (plan-b is branched elsewhere, doesn't compete).
    const a = buildFocusDigest(repo, { now: FIXED_NOW, branch: 'feature/a' });
    assert.equal(a.plan.slug, 'plan-a');
    assert.equal(a.flags.multipleActivePlans, false);

    const b = buildFocusDigest(repo, { now: FIXED_NOW, branch: 'feature/b' });
    assert.equal(b.plan.slug, 'plan-b');
    assert.equal(b.flags.multipleActivePlans, false);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('an unbranched active plan claims any tree → multipleActivePlans TRUE (drift)', () => {
  const repo = mkdtempSync(join(tmpdir(), 'focus-claim-'));
  try {
    writeBranchedPlan(repo, 'plan-branched', 'feature/x', '2026-06-15T09:00:00Z');
    writeBranchedPlan(repo, 'plan-loose', null, '2026-06-15T08:00:00Z'); // no branch → claims any tree

    // On feature/x: exact branch-match wins the focus, but the unbranched plan also
    // claims this tree → ambiguous (exactly the drift the worktree enforcer prevents).
    const d = buildFocusDigest(repo, { now: FIXED_NOW, branch: 'feature/x' });
    assert.equal(d.plan.slug, 'plan-branched');
    assert.equal(d.flags.multipleActivePlans, true);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('no branch context → cannot disambiguate, ambiguity falls back to active count', () => {
  const repo = mkdtempSync(join(tmpdir(), 'focus-nobranch-'));
  try {
    writeBranchedPlan(repo, 'plan-a', 'feature/a', '2026-06-15T09:00:00Z');
    writeBranchedPlan(repo, 'plan-b', 'feature/b', '2026-06-15T10:00:00Z');
    // Detached / unknown branch: branch can't disambiguate, so >1 active = ambiguous.
    const d = buildFocusDigest(repo, { now: FIXED_NOW }); // no branch
    assert.equal(d.flags.multipleActivePlans, true);
    assert.equal(d.plan.slug, 'plan-b'); // recency fallback
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('known branch that NO active plan claims → plan null + unclaimedBranch, never a foreign plan', () => {
  const repo = mkdtempSync(join(tmpdir(), 'focus-unclaimed-'));
  try {
    writeBranchedPlan(repo, 'plan-a', 'feature/a', '2026-06-15T09:00:00Z');
    writeBranchedPlan(repo, 'plan-b', 'feature/b', '2026-06-15T10:00:00Z');
    // On feature/c: both plans are branched ELSEWHERE → none claims this tree.
    const d = buildFocusDigest(repo, { now: FIXED_NOW, branch: 'feature/c' });
    assert.equal(d.plan, null, 'must NOT surface a foreign-tree plan as focus');
    assert.equal(d.flags.unclaimedBranch, true);
    assert.equal(d.flags.multipleActivePlans, false, 'no plan competes for THIS tree');
    assert.deepEqual(d.sources, []);
    // and it still validates against the schema (unclaimedBranch is a known flag)
    const validate = schemaValidator();
    assert.ok(validate(d), JSON.stringify(validate.errors));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('bind-plan-branch stamps branch onto plan.md → unclaimed branch resolves to that plan', () => {
  const repo = mkdtempSync(join(tmpdir(), 'focus-bind-'));
  try {
    writeBranchedPlan(repo, 'plan-a', 'feature/a', '2026-06-15T09:00:00Z');
    writeBranchedPlan(repo, 'plan-b', 'feature/b', '2026-06-15T10:00:00Z');
    // Pre-condition: feature/c is unclaimed.
    const before = buildFocusDigest(repo, { now: FIXED_NOW, branch: 'feature/c' });
    assert.equal(before.flags.unclaimedBranch, true);

    // Bind plan-b to feature/c (branch passed explicitly → no git needed).
    const res = bindPlanBranch(repo, 'plan-b', 'feature/c', FIXED_NOW);
    assert.equal(res.branch, 'feature/c');

    // Post-condition: feature/c now resolves to plan-b, no longer unclaimed.
    const after = buildFocusDigest(repo, { now: FIXED_NOW, branch: 'feature/c' });
    assert.equal(after.plan.slug, 'plan-b');
    assert.equal(after.flags.unclaimedBranch, false);
    // plan-b's old tree (feature/b) now has no claimer.
    const oldTree = buildFocusDigest(repo, { now: FIXED_NOW, branch: 'feature/b' });
    assert.equal(oldTree.flags.unclaimedBranch, true);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('stampBranch replaces an existing branch line and inserts when absent', () => {
  const withBranch = '---\nslug: x\nstatus: active\nbranch: old/b\nlastUpdated: 2020-01-01T00:00:00Z\n---\n\nbody\n';
  const r1 = stampBranch(withBranch, 'new/b', '2026-06-16T00:00:00Z');
  assert.match(r1, /^branch: new\/b$/m);
  assert.doesNotMatch(r1, /old\/b/);
  assert.match(r1, /^lastUpdated: 2026-06-16T00:00:00Z$/m);

  const noBranch = '---\nslug: x\nstatus: active\n---\n\nbody\n';
  const r2 = stampBranch(noBranch, 'feature/z', '2026-06-16T00:00:00Z');
  assert.match(r2, /^branch: feature\/z$/m);
  assert.match(r2, /^lastUpdated: 2026-06-16T00:00:00Z$/m);
  // inserted inside the frontmatter block, before the closing ---
  assert.ok(r2.indexOf('branch: feature/z') < r2.indexOf('\n---', 3));
});

// ── F4: fork parent/child hierarchy in the focus resolver ──
// A fork child carries `spawnedFrom: { plan, phaseId, mode }` INLINE in its plan.md
// INLINE frontmatter (F5/T-003). When a parent and its forked child are BOTH
// active claimers of a tree (parallel mode, or no branch context), they are a
// hierarchy — focus resolves to the CHILD and it is NOT the multi-active drift
// the ⧉ marker warns about.
function writeChildSidecar(repo, slug, parentSlug, phaseId, mode) {
  // the child plan.md already exists (writeBranchedPlan) — write the edge inline.
  setSpawnedFrom(join(repo, '.atomic-skills', 'projects', 'p', slug), { plan: parentSlug, phaseId, mode });
}

test('F4: parallel fork (parent active + child active) resolves to the CHILD, not ambiguous', () => {
  const repo = mkdtempSync(join(tmpdir(), 'focus-fork-'));
  try {
    // parent is MORE recent than child → recency alone would pick the parent.
    writeBranchedPlan(repo, 'plan-parent', null, '2026-06-15T10:00:00Z');
    writeBranchedPlan(repo, 'plan-child', null, '2026-06-15T08:00:00Z');
    writeChildSidecar(repo, 'plan-child', 'plan-parent', 'F3', 'parallel');
    // No branch context: without the fork rule → 2 active claimers, recency picks
    // the parent, multipleActivePlans=true. With it → parent superseded by its
    // active child → focus = child, no ambiguity. (Mutation killed: drop the collapse.)
    const d = buildFocusDigest(repo, { now: FIXED_NOW });
    assert.equal(d.plan.slug, 'plan-child', 'focus resolves to the fork child, not the parent');
    assert.equal(d.flags.multipleActivePlans, false, 'a parent/child fork pair is a hierarchy, not drift');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('F4: pause fork (parent paused + child active) resolves to the child, not ambiguous', () => {
  const repo = mkdtempSync(join(tmpdir(), 'focus-fork-pause-'));
  try {
    writeBranchedPlan(repo, 'plan-child', null, '2026-06-15T08:00:00Z');
    writeChildSidecar(repo, 'plan-child', 'plan-parent', 'F3', 'pause');
    // parent paused → not an active claimer at all; child is the sole active work front.
    const parentDir = join(repo, '.atomic-skills', 'projects', 'p', 'plan-parent');
    mkdirSync(join(parentDir, 'phases'), { recursive: true });
    writeFm(join(parentDir, 'plan.md'), [
      'schemaVersion: "0.1"', 'slug: plan-parent', 'title: plan-parent', 'status: paused',
      'currentPhase: F3', 'lastUpdated: 2026-06-15T10:00:00Z',
      'phases:', '  - id: F3', '    slug: plan-parent-f3', '    title: Anchor', '    status: paused',
    ].join('\n'));
    const d = buildFocusDigest(repo, { now: FIXED_NOW });
    assert.equal(d.plan.slug, 'plan-child', 'paused parent yields focus to the active child');
    assert.equal(d.flags.multipleActivePlans, false);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('F4: two active plans with NO fork edge stay ambiguous (rule does not over-collapse)', () => {
  const repo = mkdtempSync(join(tmpdir(), 'focus-nofork-'));
  try {
    writeBranchedPlan(repo, 'plan-a', null, '2026-06-15T09:00:00Z');
    writeBranchedPlan(repo, 'plan-b', null, '2026-06-15T10:00:00Z');
    // no links.json on either → not a fork pair → the fork rule must NOT collapse them.
    const d = buildFocusDigest(repo, { now: FIXED_NOW });
    assert.equal(d.flags.multipleActivePlans, true, 'unrelated active plans are still drift');
    assert.equal(d.plan.slug, 'plan-b', 'recency fallback unchanged');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

// F4 robustness (cross-model review findings #1, #2, #5)
test('F4: grandchild fork chain collapses transitively to the deepest active child', () => {
  const repo = mkdtempSync(join(tmpdir(), 'focus-chain-'));
  try {
    writeBranchedPlan(repo, 'gp', null, '2026-06-15T10:00:00Z'); // grandparent, MOST recent
    writeBranchedPlan(repo, 'parent', null, '2026-06-15T09:00:00Z');
    writeBranchedPlan(repo, 'child', null, '2026-06-15T08:00:00Z'); // oldest
    writeChildSidecar(repo, 'parent', 'gp', 'F1', 'parallel');
    writeChildSidecar(repo, 'child', 'parent', 'F1', 'parallel');
    // Transitive collapse: gp and parent superseded → deepest active child wins,
    // even though recency would pick gp. (Kills "only direct parents collapse".)
    const d = buildFocusDigest(repo, { now: FIXED_NOW });
    assert.equal(d.plan.slug, 'child', 'deepest active child wins the chain');
    assert.equal(d.flags.multipleActivePlans, false);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('F4: a spawnedFrom cycle does NOT hide the ambiguity flag (no silent over-collapse)', () => {
  const repo = mkdtempSync(join(tmpdir(), 'focus-cycle-'));
  try {
    writeBranchedPlan(repo, 'plan-a', null, '2026-06-15T10:00:00Z');
    writeBranchedPlan(repo, 'plan-b', null, '2026-06-15T09:00:00Z');
    writeChildSidecar(repo, 'plan-a', 'plan-b', 'F1', 'parallel'); // a ← b
    writeChildSidecar(repo, 'plan-b', 'plan-a', 'F1', 'parallel'); // b ← a → cycle
    // Every claimer superseded → no leaf → NOT a valid hierarchy. The collapse must
    // NOT fire: the ⧉ drift flag stays true. (Kills "collapse even when empty".)
    const d = buildFocusDigest(repo, { now: FIXED_NOW });
    assert.equal(d.flags.multipleActivePlans, true, 'cycle surfaces drift, not hidden');
    assert.ok(['plan-a', 'plan-b'].includes(d.plan.slug), 'falls back to a real plan, never a superseded ghost');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('F4: a plan with malformed plan.md frontmatter (the inline elo source) does not take down the resolver', () => {
  const repo = mkdtempSync(join(tmpdir(), 'focus-torn-'));
  try {
    writeBranchedPlan(repo, 'plan-a', 'feature/a', '2026-06-15T10:00:00Z');
    // a sibling plan whose plan.md frontmatter is corrupt (the elo now lives there,
    // not in a sidecar) — collectPlans must skip it, not throw the whole digest.
    const badDir = join(repo, '.atomic-skills', 'projects', 'p', 'plan-bad');
    mkdirSync(join(badDir, 'phases'), { recursive: true });
    writeFileSync(join(badDir, 'plan.md'), '---\nschemaVersion: "0.1"\nslug: plan-bad\n  : : broken yaml :\nstatus: active\n---\nbody\n');
    const d = buildFocusDigest(repo, { now: FIXED_NOW, branch: 'feature/a' });
    assert.equal(d.plan.slug, 'plan-a', 'resolver still emits despite a corrupt sibling plan.md');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('F4: a fork edge whose parent slug only exists in ANOTHER project does not collapse', () => {
  const repo = mkdtempSync(join(tmpdir(), 'focus-xproj-'));
  try {
    // Two projects; project q has an active "shared" plan; project p's "shared" is
    // a fork CHILD pointing at parent "shared" — but the matching parent is in q,
    // not p. Intra-project scoping must NOT collapse across the project boundary.
    const mk = (proj, slug, last) => {
      const dir = join(repo, '.atomic-skills', 'projects', proj, slug);
      mkdirSync(join(dir, 'phases'), { recursive: true });
      writeFm(join(dir, 'plan.md'), [
        'schemaVersion: "0.1"', `slug: ${slug}`, `title: ${slug}`, 'status: active',
        'currentPhase: F0', `lastUpdated: ${last}`,
        'phases:', '  - id: F0', `    slug: ${slug}-f0`, '    title: Zero', '    status: active',
      ].join('\n'));
      return dir;
    };
    mk('q', 'shared', '2026-06-15T10:00:00Z');
    const pChild = mk('p', 'pchild', '2026-06-15T09:00:00Z');
    writeFileSync(join(pChild, 'links.json'), `${JSON.stringify({ spawnedFrom: { plan: 'shared', phaseId: 'F0', mode: 'parallel' } })}\n`);
    // p/pchild's parent "shared" lives in project q → no same-project parent → no
    // collapse → two unrelated active plans remain ambiguous (no false hierarchy).
    const d = buildFocusDigest(repo, { now: FIXED_NOW });
    assert.equal(d.flags.multipleActivePlans, true, 'cross-project slug match must not collapse');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('F4: exact-branch parent + UNBRANCHED active child still collapses to the child (branch context)', () => {
  const repo = mkdtempSync(join(tmpdir(), 'focus-fork-branch-'));
  try {
    // parent owns the branch (exact match), child is unbranched but the active work
    // front. claimers={parent,child}, pool={parent} (exact wins) → the survivor
    // (child) is NOT in pool. The fallback must pick the child from survivors, NOT
    // resurrect the superseded parent from pool. (Kills the effPool→pool fallback.)
    writeBranchedPlan(repo, 'plan-parent', 'feature/x', '2026-06-15T10:00:00Z');
    writeBranchedPlan(repo, 'plan-child', null, '2026-06-15T08:00:00Z');
    writeChildSidecar(repo, 'plan-child', 'plan-parent', 'F0', 'parallel');
    const d = buildFocusDigest(repo, { now: FIXED_NOW, branch: 'feature/x' });
    assert.equal(d.plan.slug, 'plan-child', 'focus is the surviving child, not the superseded exact-branch parent');
    assert.equal(d.flags.multipleActivePlans, false, 'a resolved hierarchy, not drift');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
