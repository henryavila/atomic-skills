import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  stampPlanApproval,
  clearPlanApproval,
  planApprovalAllowsImplement,
} from '../src/plan-approval.js';
import {
  catalogFromTasks,
  orchestratorTick,
  orchestratorCard,
  boardPath,
  writeBoard,
  readBoard,
  MAX_REDISPATCH,
} from '../src/orchestrator-board.js';
import { buildOrchestratorSnapshot } from '../src/orchestrator-snapshot.js';
import { isPlanApprovalTimestamp } from '../src/plan-approval.js';

const AT = '2026-10-15T18:00:00.000Z';

function approved(extra = {}) {
  return { planApprovedAt: AT, human: {}, agents: [], ...extra };
}

function part(id, extra = {}) {
  return {
    id,
    deps: [],
    paths: [`src/${id}.js`],
    admitted: true,
    status: 'queued',
    redispatchCount: 0,
    verifierPassed: false,
    blockedReason: null,
    ...extra,
  };
}

describe('plan approval stamp', () => {
  it('refuses implement until an ISO planApprovedAt is stamped', () => {
    assert.equal(planApprovalAllowsImplement({}).ok, false);
    assert.equal(planApprovalAllowsImplement({ planApprovedAt: 'ok' }).ok, false);
    const stamped = stampPlanApproval({ slug: 'p' }, AT);
    assert.equal(stamped.planApprovedAt, AT);
    assert.equal(Object.hasOwn(stamped, 'userValidatedAt'), false);
    assert.equal(planApprovalAllowsImplement(stamped).ok, true);
    assert.equal(Object.hasOwn(clearPlanApproval(stamped), 'planApprovedAt'), false);
  });

  it('rejects a date-only stamp that the plan schema would refuse', () => {
    assert.equal(isPlanApprovalTimestamp('2026-10-15'), false);
    assert.equal(isPlanApprovalTimestamp('2026-10-15T18:00:00.000Z'), true);
  });

  it('does not clear an existing userValidatedAt when stamping approval', () => {
    const stamped = stampPlanApproval({ slug: 'p', userValidatedAt: AT }, AT);
    assert.equal(stamped.userValidatedAt, AT);
    assert.equal(stamped.planApprovedAt, AT);
  });
});

describe('orchestrator tick', () => {
  it('refuses the tick when the plan is not approved', () => {
    const result = orchestratorTick({
      parts: [part('a')],
      agents: [],
      human: {},
    });
    assert.equal(result.ok, false);
    assert.equal(result.blocked, 'plan-not-approved');
    assert.deepEqual(result.actions, []);
    assert.equal(JSON.stringify(result).includes('userValidatedAt'), false);
  });

  it('dispatches two disjoint parts in one tick and holds the overlapping one', () => {
    const result = orchestratorTick(approved({
      parts: [
        part('b', { paths: ['src/b.js'] }),
        part('a', { paths: ['src/a.js'] }),
        part('overlap', { paths: ['src/a.js'] }),
      ],
    }));
    const dispatched = result.actions.filter((a) => a.type === 'dispatch');
    assert.deepEqual(dispatched.map((a) => a.partId).sort(), ['a', 'b']);
    assert.equal(dispatched.every((a) => a.kind === 'implement'), true);
    const held = result.board.parts.find((p) => p.id === 'overlap');
    assert.equal(held.status, 'queued');
    assert.equal(result.board.parts.length, 3);
  });

  it('does not dispatch a part whose dependency is still open', () => {
    const result = orchestratorTick(approved({
      parts: [
        part('a'),
        part('b', { deps: ['a'] }),
      ],
    }));
    assert.deepEqual(
      result.actions.filter((a) => a.type === 'dispatch').map((a) => a.partId),
      ['a'],
    );
  });

  it('does not admit a task that has no verifier', () => {
    const parts = catalogFromTasks([
      { id: 't', paths: ['src/t.js'], acceptance: ['yes'], scopeBoundary: ['no'] },
    ]);
    assert.equal(parts[0].admitted, false);
    const result = orchestratorTick(approved({ parts }));
    assert.equal(result.board.parts[0].status, 'blocked-human');
    assert.equal(result.actions.some((a) => a.type === 'dispatch'), false);
  });

  it('queues one serial merge when two claims are ready', () => {
    const result = orchestratorTick(approved({
      parts: [
        part('b', { status: 'dispatched' }),
        part('a', { status: 'dispatched' }),
      ],
      agents: [
        { id: 'implement:b:0', kind: 'implement', partId: 'b', lease: true, alive: false, claim: true },
        { id: 'implement:a:0', kind: 'implement', partId: 'a', lease: true, alive: false, claim: true },
      ],
    }));
    const merges = result.actions.filter((a) => a.type === 'merge');
    assert.equal(merges.length, 1);
    assert.equal(merges[0].partId, 'a');
  });

  it('re-emits an unobserved dispatch and does not kill a leased writer', () => {
    const first = orchestratorTick(approved({ parts: [part('a')] }));
    const agent = first.board.agents[0];
    assert.equal(agent.alive, null);
    assert.equal(agent.lease, false);
    assert.equal(first.board.parts[0].redispatchCount, 0);

    const again = orchestratorTick(approved({
      parts: first.board.parts,
      agents: first.board.agents,
    }));
    const againDispatch = again.actions.filter((action) => action.type === 'dispatch');
    assert.equal(againDispatch.length, 1);
    assert.equal(againDispatch[0].agentId, agent.id);
    assert.equal(again.board.parts[0].redispatchCount, 0);

    const leased = buildOrchestratorSnapshot({
      plan: { planApprovedAt: AT },
      tasks: [{
        id: 'a',
        status: 'pending',
        deps: [],
        paths: ['src/a.js'],
        verifier: 'true',
        acceptance: ['yes'],
        scopeBoundary: ['no'],
      }],
      board: first.board,
      lease: { status: 'active' },
    });
    const running = orchestratorTick(approved({
      parts: leased.parts,
      agents: leased.agents,
    }));
    assert.equal(running.actions.some((action) => action.type === 'dispatch'), false);
    assert.equal(running.board.parts[0].redispatchCount, 0);
    assert.equal(running.board.agents[0].alive, true);
  });

  it('redispatches a dead agent and stops at the ceiling without operatorOverride', () => {
    const once = orchestratorTick(approved({
      parts: [part('a', { status: 'dispatched', redispatchCount: 0 })],
      agents: [
        { id: 'implement:a:0', kind: 'implement', partId: 'a', lease: true, alive: false, claim: false },
      ],
    }));
    assert.equal(once.actions.some((a) => a.type === 'dispatch' && a.kind === 'implement'), true);
    assert.equal(once.board.parts[0].redispatchCount, 1);
    assert.equal(JSON.stringify(once).includes('operatorOverride'), false);

    const stopped = orchestratorTick(approved({
      parts: [part('a', { status: 'dispatched', redispatchCount: MAX_REDISPATCH })],
      agents: [
        { id: 'implement:a:2', kind: 'implement', partId: 'a', lease: true, alive: false, claim: false },
      ],
    }));
    assert.equal(stopped.actions.some((a) => a.type === 'dispatch'), false);
    assert.equal(stopped.actions.some((a) => a.type === 'blocked-human' && a.reason === 'agent-dead'), true);
    assert.equal(JSON.stringify(stopped).includes('operatorOverride'), false);
  });

  it('turns a review finding into a fix agent with that text, and the third failure stops', () => {
    const fix = orchestratorTick(approved({
      parts: [part('a', { status: 'review', redispatchCount: 0 })],
      agents: [
        {
          id: 'review:a:0',
          kind: 'review',
          partId: 'a',
          lease: true,
          alive: false,
          claim: false,
          review: 'finding',
          finding: 'null deref in src/a.js',
        },
      ],
    }));
    const dispatch = fix.actions.find((a) => a.type === 'dispatch');
    assert.equal(dispatch.kind, 'fix');
    assert.match(dispatch.instruction, /null deref in src\/a.js/);
    assert.notEqual(dispatch.agentId, 'review:a:0');

    const third = orchestratorTick(approved({
      parts: [part('a', { status: 'review', redispatchCount: MAX_REDISPATCH })],
      agents: [
        {
          id: 'review:a:2',
          kind: 'review',
          partId: 'a',
          lease: true,
          alive: false,
          claim: false,
          review: 'finding',
          finding: 'still broken',
        },
      ],
    }));
    assert.equal(third.actions.some((a) => a.type === 'dispatch'), false);
    assert.equal(third.actions.some((a) => a.reason === 'review-finding'), true);
    assert.equal(JSON.stringify(third).includes('operatorOverride'), false);
  });

  it('closes only after a clean review and a passed verifier, and never stamps delivery acceptance', () => {
    const pending = orchestratorTick(approved({
      parts: [part('a', { status: 'review', verifierPassed: false })],
      agents: [
        { id: 'review:a:0', kind: 'review', partId: 'a', lease: true, alive: false, review: 'clean' },
      ],
    }));
    assert.deepEqual(pending.actions.map((a) => a.type), ['reverify']);
    assert.notEqual(pending.board.parts[0].status, 'done');

    const closed = orchestratorTick(approved({
      parts: [part('a', { status: 'review', verifierPassed: true })],
      agents: [
        { id: 'review:a:0', kind: 'review', partId: 'a', lease: true, alive: false, review: 'clean' },
      ],
    }));
    assert.equal(closed.actions.some((a) => a.type === 'close'), true);
    assert.equal(closed.board.parts[0].status, 'done');
    assert.equal(closed.blocked, 'await-user-validation');
    assert.equal(JSON.stringify(closed).includes('userValidatedAt'), false);
    assert.equal(closed.actions.some((a) => a.type === 'finalize'), false);
  });

  it('stops for decision-review when the log has a scope exit and does not stamp PASS', () => {
    const result = orchestratorTick(approved({
      parts: [part('a')],
      human: { scopeExit: true, decisionReviewPassed: false },
    }));
    assert.equal(result.blocked, 'decision-review');
    assert.equal(result.actions.some((a) => a.type === 'dispatch'), false);
    assert.equal(result.actions.some((a) => a.type === 'decision-review-pass'), false);
    assert.equal(JSON.stringify(result).includes('decisionReview'), false);
  });

  it('card names the plan and forbids host commands and delivery stamps', () => {
    const slug = 'approved-plan';
    const worktree = '/repo/.worktrees/approved-plan';
    const card = orchestratorCard({ slug, worktree });
    assert.equal(card.startsWith('/loop '), true);
    assert.equal(/^\/loop \d/.test(card), false);
    assert.equal(card.includes(slug), true);
    assert.equal(card.includes(worktree), true);
    assert.match(card, /do not print another \/loop/i);
    assert.match(card, /Do not write userValidatedAt/);
    assert.equal(card.includes('\n'), false);
    assert.equal(card.includes('\r'), false);
  });
});

describe('orchestrator tick cli', () => {
  it('exits 1 without approval and 0 with a board write when approved', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orch-tick-'));
    try {
      const denied = join(dir, 'denied.json');
      writeFileSync(denied, JSON.stringify({ parts: [part('a')], agents: [], human: {} }));
      assert.throws(
        () => execFileSync('node', ['scripts/orchestrator-tick.js', '--snapshot', denied], { encoding: 'utf8' }),
        (err) => err.status === 1,
      );

      const okPath = join(dir, 'ok.json');
      writeFileSync(okPath, JSON.stringify(approved({
        planSlug: 'loop-plan',
        parts: [part('a')],
      })));
      const stdout = execFileSync('node', [
        'scripts/orchestrator-tick.js',
        '--snapshot', okPath,
        '--write',
        '--status-root', join(dir, 'status'),
        '--plan', 'loop-plan',
      ], { encoding: 'utf8' });
      const parsed = JSON.parse(stdout);
      assert.equal(parsed.ok, true);
      assert.equal(parsed.actions[0].type, 'dispatch');
      const board = readBoard(join(dir, 'status'), 'loop-plan');
      assert.equal(board.parts[0].status, 'dispatched');
      assert.equal(boardPath(join(dir, 'status'), 'loop-plan').endsWith('loop-plan.board.json'), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('prints one /loop card line for --card without a snapshot', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orch-card-'));
    const slug = 'approved-plan';
    const worktree = '/repo/.worktrees/approved-plan';
    const planFile = join(dir, 'plan.md');
    const quiet = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] };
    try {
      writeFileSync(planFile, `---\nslug: ${slug}\n---\n`);
      assert.throws(
        () => execFileSync('node', [
          'scripts/orchestrator-tick.js',
          '--card',
          '--plan-file', planFile,
          '--worktree', worktree,
        ], quiet),
        (err) => err.status === 1 && /plan-not-approved/.test(`${err.stderr}`),
      );
      writeFileSync(planFile, `---\nslug: ${slug}\nplanApprovedAt: '2026-10-15T18:00:00.000Z'\n---\n`);
      const stdout = execFileSync('node', [
        'scripts/orchestrator-tick.js',
        '--card',
        '--plan-file', planFile,
        '--worktree', worktree,
      ], { encoding: 'utf8' });
      const card = orchestratorCard({ slug, worktree });
      assert.equal(stdout, `${card}\n`);
      assert.equal(card.includes('\n'), false);
      assert.throws(
        () => execFileSync('node', [
          'scripts/orchestrator-tick.js',
          '--card',
          '--plan-file', planFile,
        ], quiet),
        (err) => err.status === 1,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('skill contract', () => {
  it('tells the user to paste /loop into a new session', () => {
    const implement = readFileSync(join('skills/core/implement.md'), 'utf8');
    const tick = readFileSync(join('skills/shared/implement-orchestrator-tick.md'), 'utf8');
    assert.match(implement, /\/loop/);
    assert.match(implement, /paste[\s\S]{0,200}new session/i);
    assert.match(tick, /\/loop/);
    assert.match(implement, /planApprovedAt/);
    assert.match(implement, /END OF ENTRY/);
    assert.equal(implement.includes('### Step 2 — Execute one task'), false);
    const reference = readFileSync(join('skills/shared/implement-harness-reference.md'), 'utf8');
    assert.match(reference, /Not an entry/);
    assert.match(reference, /### Step 2 — Execute one task/);
    assert.match(readFileSync(join('skills/core/project.md'), 'utf8'), /approve <slug>/);
    assert.match(tick, /--from-plan/);
    assert.match(tick, /Do not re-enter/);
    const beforeEntry = implement.slice(0, implement.indexOf('## END OF ENTRY'));
    const stillInEntry = [
      'Spawn **one fresh phase agent**',
      'you **are** the single-threaded coder',
    ].filter((phrase) => beforeEntry.includes(phrase));
    assert.deepEqual(stillInEntry, []);
  });
});

describe('plan file round trip', () => {
  it('stamps planApprovedAt on the plan file and builds the tick from its phases', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orch-plan-'));
    try {
      const planDir = join(dir, 'projects', 'app', 'demo');
      const phases = join(planDir, 'phases');
      mkdirSync(phases, { recursive: true });
      const planFile = join(planDir, 'plan.md');
      writeFileSync(planFile, [
        '---',
        'schemaVersion: "0.1"',
        'slug: demo',
        'title: Demo',
        'userValidatedAt: "2026-01-01T00:00:00.000Z"',
        '---',
        '',
        'Keep this body.',
        '',
      ].join('\n'));
      writeFileSync(join(phases, 'f0-demo.md'), [
        '---',
        'tasks:',
        '  - id: done-one',
        '    status: done',
        '    blockedBy: []',
        '    outputs: [{ kind: file, path: src/done.js }]',
        '    acceptance: ["landed"]',
        '    scopeBoundary: ["no extra"]',
        '    verifier: { kind: shell, command: "true" }',
        '  - id: next-a',
        '    status: pending',
        '    blockedBy: [done-one]',
        '    outputs: [{ kind: file, path: src/a.js }]',
        '    acceptance: ["a works"]',
        '    scopeBoundary: ["not b"]',
        '    verifier: { kind: shell, command: "true" }',
        '  - id: next-b',
        '    status: pending',
        '    blockedBy: [done-one]',
        '    outputs: [{ kind: file, path: src/b.js }]',
        '    acceptance: ["b works"]',
        '    scopeBoundary: ["not a"]',
        '    verifier: { kind: shell, command: "true" }',
        '---',
        '',
      ].join('\n'));

      assert.throws(
        () => execFileSync('node', [
          'scripts/orchestrator-tick.js',
          '--from-plan', planFile,
          '--status-root', join(dir, 'status'),
        ], { encoding: 'utf8' }),
        (err) => err.status === 1,
      );

      const stamped = execFileSync('node', [
        'scripts/stamp-plan-approval.js',
        '--plan', planFile,
        '--at', '2026-10-15T18:00:00.000Z',
      ], { encoding: 'utf8' }).trim();
      assert.equal(stamped, '2026-10-15T18:00:00.000Z');
      const rewritten = readFileSync(planFile, 'utf8');
      assert.match(rewritten, /planApprovedAt: ["']?2026-10-15T18:00:00.000Z/);
      assert.match(rewritten, /userValidatedAt/);
      assert.match(rewritten, /Keep this body/);

      const stdout = execFileSync('node', [
        'scripts/orchestrator-tick.js',
        '--from-plan', planFile,
        '--status-root', join(dir, 'status'),
      ], { encoding: 'utf8' });
      const result = JSON.parse(stdout);
      const dispatched = result.actions.filter((action) => action.type === 'dispatch').map((action) => action.partId);
      assert.deepEqual(dispatched.sort(), ['next-a', 'next-b']);
      assert.equal(result.board.parts.find((part) => part.id === 'done-one').status, 'done');

      const leaseDir = join(dir, 'status', 'writer-leases');
      mkdirSync(leaseDir, { recursive: true });
      writeFileSync(join(leaseDir, 'demo.json'), JSON.stringify({
        planSlug: 'demo',
        phaseId: 'f0',
        startedAt: '2026-10-15T18:00:00.000Z',
        hostId: 'test',
        worktreePath: '/tmp/demo',
        status: 'active',
      }));
      const second = JSON.parse(execFileSync('node', [
        'scripts/orchestrator-tick.js',
        '--from-plan', planFile,
        '--status-root', join(dir, 'status'),
      ], { encoding: 'utf8' }));
      assert.equal(second.actions.some((action) => action.type === 'dispatch'), false);

      writeFileSync(join(phases, 'f1-bad.md'), '---\nthis: [\n---\n');
      assert.throws(
        () => execFileSync('node', [
          'scripts/orchestrator-tick.js',
          '--from-plan', planFile,
          '--status-root', join(dir, 'status'),
        ], { encoding: 'utf8' }),
        (err) => err.status === 1 && /phase-unreadable/.test(`${err.stderr}`),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('round-trip helper is used', () => {
  it('writeBoard then readBoard returns the same parts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orch-board-'));
    try {
      writeBoard(join(dir, 'status'), 'p', { parts: [part('a')], agents: [] });
      const raw = readFileSync(boardPath(join(dir, 'status'), 'p'), 'utf8');
      assert.equal(raw.includes('userValidatedAt'), false);
      assert.equal(readBoard(join(dir, 'status'), 'p').parts[0].id, 'a');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
