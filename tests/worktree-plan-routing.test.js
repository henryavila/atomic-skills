/**
 * F3/T-002 — explicit plan/branch/worktree selection before resume gate.
 * FAILS when the caller tree governs another plan.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertCallerMayGovern,
  composePlanWorktreeAdd,
  parsePlanArg,
  resolveImplementTarget,
  selectPlanFromInventory,
} from '../src/project-target-resolver.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMPLEMENT = readFileSync(join(ROOT, 'skills', 'core', 'implement.md'), 'utf8');
const CREATE_PLAN = readFileSync(
  join(ROOT, 'skills', 'shared', 'project-assets', 'project-create-plan.md'),
  'utf8',
);
const WORKTREE_ISO = readFileSync(
  join(ROOT, 'skills', 'shared', 'worktree-isolation.md'),
  'utf8',
);

const PLANS = [
  {
    projectId: 'atomic-skills',
    slug: 'plan-a',
    branch: 'plan/plan-a',
    status: 'active',
  },
  {
    projectId: 'atomic-skills',
    slug: 'plan-b',
    branch: 'plan/plan-b',
    status: 'active',
  },
];

describe('parsePlanArg', () => {
  it('parses bare slug and project/slug', () => {
    assert.deepEqual(parsePlanArg('plan-b'), { projectId: null, planSlug: 'plan-b' });
    assert.deepEqual(parsePlanArg('atomic-skills/plan-b'), {
      projectId: 'atomic-skills',
      planSlug: 'plan-b',
    });
    assert.equal(parsePlanArg(''), null);
    assert.equal(parsePlanArg(null), null);
  });
});

describe('selectPlanFromInventory', () => {
  it('routes plan-b among two plans', () => {
    const r = selectPlanFromInventory({
      parsed: parsePlanArg('plan-b'),
      plans: PLANS,
    });
    assert.equal(r.ok, true);
    assert.equal(r.plan.slug, 'plan-b');
  });

  it('routes atomic-skills/plan-b', () => {
    const r = selectPlanFromInventory({
      parsed: parsePlanArg('atomic-skills/plan-b'),
      plans: PLANS,
    });
    assert.equal(r.ok, true);
    assert.equal(r.plan.projectId, 'atomic-skills');
    assert.equal(r.plan.slug, 'plan-b');
  });
});

describe('composePlanWorktreeAdd', () => {
  it('reuses existing branch without -b (argv, not shell)', () => {
    const inv = composePlanWorktreeAdd({
      slug: 'plan-b',
      branch: 'plan/plan-b',
      branchExists: true,
    });
    assert.equal(inv.executable, 'git');
    assert.deepEqual(inv.argv, ['worktree', 'add', '.worktrees/plan-b', 'plan/plan-b']);
    assert.equal(inv.command, 'git worktree add .worktrees/plan-b plan/plan-b');
    // Flag form is ` -b <branch>`; do not confuse with slug substring `plan-b`
    assert.doesNotMatch(inv.command, /\s-b\s/);
  });

  it('creates new branch with -b when absent', () => {
    const inv = composePlanWorktreeAdd({
      slug: 'plan-b',
      branch: 'plan/plan-b',
      branchExists: false,
      baseRef: 'main',
    });
    assert.deepEqual(inv.argv, ['worktree', 'add', '-b', 'plan/plan-b', '.worktrees/plan-b', 'main']);
    assert.match(inv.command, /\s-b\s+plan\/plan-b/);
    assert.match(inv.command, /main/);
  });

  it('rejects shell metacharacters in branch/path (command injection)', () => {
    assert.throws(
      () => composePlanWorktreeAdd({
        slug: 'plan-b',
        branch: 'x; rm -rf /',
        branchExists: true,
      }),
      /forbidden characters/,
    );
    assert.throws(
      () => composePlanWorktreeAdd({
        slug: 'plan-b',
        path: '.worktrees/x;evil',
        branchExists: true,
      }),
      /forbidden characters/,
    );
    assert.throws(
      () => composePlanWorktreeAdd({
        slug: 'plan-b',
        branch: '--upload-pack=evil',
        branchExists: true,
      }),
      /must not look like a flag/,
    );
  });
});

describe('assertCallerMayGovern', () => {
  it('FAILS when caller tree governs another plan', () => {
    const r = assertCallerMayGovern({
      requestedPlan: PLANS[1], // plan-b
      callerBranch: 'plan/plan-a',
      plans: PLANS,
    });
    assert.equal(r.allowed, false);
    assert.equal(r.code, 'caller-governs-other-plan');
    assert.equal(r.governingPlan.slug, 'plan-a');
  });

  it('allows when caller is on the requested plan branch', () => {
    const r = assertCallerMayGovern({
      requestedPlan: PLANS[1],
      callerBranch: 'plan/plan-b',
      plans: PLANS,
    });
    assert.equal(r.allowed, true);
  });
});

describe('resolveImplementTarget — order before resume gate', () => {
  it('routes plan-b to its tree before dirty/resume gate; blocks write on plan-a tree', () => {
    const decision = resolveImplementTarget({
      arg: 'plan-b',
      plans: PLANS,
      callerBranch: 'plan/plan-a',
      worktrees: [
        { path: '/repo/.worktrees/plan-a', branch: 'plan/plan-a' },
        { path: '/repo/.worktrees/plan-b', branch: 'plan/plan-b' },
      ],
      existingBranches: new Set(['plan/plan-a', 'plan/plan-b']),
    });

    assert.equal(decision.ok, false);
    assert.equal(decision.code, 'caller-governs-other-plan');
    assert.equal(decision.resumeGateAllowed, false);
    assert.equal(decision.writeAllowed, false);
    assert.equal(decision.plan.slug, 'plan-b');
    assert.equal(decision.action.type, 'reenter');
    assert.equal(decision.action.path, '/repo/.worktrees/plan-b');
  });

  it('reuses existing branch without -b when worktree must be created', () => {
    const decision = resolveImplementTarget({
      arg: 'plan-b',
      plans: PLANS,
      callerBranch: 'main',
      worktrees: [{ path: '/repo', branch: 'main' }],
      existingBranches: new Set(['main', 'plan/plan-b']),
      baseRef: 'main',
    });

    assert.equal(decision.ok, true);
    assert.equal(decision.resumeGateAllowed, false);
    assert.equal(decision.writeAllowed, false);
    assert.equal(decision.action.type, 'create-worktree');
    const inv = decision.action.command;
    assert.equal(inv.executable, 'git');
    assert.doesNotMatch(inv.command, /\s-b\s/);
    assert.match(inv.command, /plan\/plan-b/);
    assert.deepEqual(inv.argv, ['worktree', 'add', '.worktrees/plan-b', 'plan/plan-b']);
  });

  it('proceeds with resume gate only when already home on the plan branch', () => {
    const decision = resolveImplementTarget({
      arg: 'plan-b',
      plans: PLANS,
      callerBranch: 'plan/plan-b',
      worktrees: [{ path: '/repo/.worktrees/plan-b', branch: 'plan/plan-b' }],
      existingBranches: new Set(['plan/plan-b']),
    });

    assert.equal(decision.ok, true);
    assert.equal(decision.stage, 'home');
    assert.equal(decision.resumeGateAllowed, true);
    assert.equal(decision.writeAllowed, true);
    assert.equal(decision.action.type, 'proceed');
  });

  it('materialization writes only in the worktree declared by plan frontmatter branch', () => {
    // When home on plan-b, writeAllowed; when on plan-a requesting plan-b, not.
    const home = resolveImplementTarget({
      arg: 'plan-b',
      plans: PLANS,
      callerBranch: 'plan/plan-b',
      worktrees: [{ path: '/repo/.worktrees/plan-b', branch: 'plan/plan-b' }],
      existingBranches: ['plan/plan-b'],
    });
    assert.equal(home.writeAllowed, true);

    const wrong = resolveImplementTarget({
      arg: 'plan-b',
      plans: PLANS,
      callerBranch: 'plan/plan-a',
      worktrees: [
        { path: '/repo/.worktrees/plan-a', branch: 'plan/plan-a' },
        { path: '/repo/.worktrees/plan-b', branch: 'plan/plan-b' },
      ],
      existingBranches: ['plan/plan-a', 'plan/plan-b'],
    });
    assert.equal(wrong.writeAllowed, false);
  });
});

describe('implement skill prose — resolve target before resume gate', () => {
  it('documents explicit arg selection and routing before dirty gate', () => {
    assert.match(IMPLEMENT, /### Step 0 — Resolve target \(plan \/ branch \/ worktree\)/);
    assert.match(IMPLEMENT, /### Step 0\.5 — Resume gate/);
    // Order: target resolution section appears before resume gate
    const targetIdx = IMPLEMENT.indexOf('### Step 0 — Resolve target');
    const resumeIdx = IMPLEMENT.indexOf('### Step 0.5 — Resume gate');
    assert.ok(targetIdx !== -1 && resumeIdx !== -1);
    assert.ok(targetIdx < resumeIdx, 'target resolution must precede resume gate');

    assert.match(IMPLEMENT, /project-target-resolver/);
    assert.match(IMPLEMENT, /caller-governs-other-plan|governs another plan|governs other plan/i);
    assert.match(IMPLEMENT, /without `-b`|omit `-b`|reuse.*branch without/i);
  });

  it('worktree-isolation documents reuse of existing branch without -b', () => {
    assert.match(WORKTREE_ISO, /branch already exists|without `-b`|omit `-b`|reuse the branch/i);
  });

  it('project-create-plan materializes inside the declared worktree', () => {
    assert.match(
      CREATE_PLAN,
      /cd |EnterWorktree|re-run.*inside|write.*only.*worktree|HALT.*worktree|materializ.*worktree/i,
    );
  });
});
