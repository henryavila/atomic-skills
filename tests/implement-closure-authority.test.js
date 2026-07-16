/**
 * F3/T-003 — implement loads closure authority and ships handoff in the
 * same done checkpoint commit.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  decideDoneTerminal,
  doneEventKey,
} from '../scripts/done-transaction.js';
import { completionEventKey } from '../scripts/append-completion.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMPLEMENT = readFileSync(join(ROOT, 'skills', 'core', 'implement.md'), 'utf8');
const TRANSITIONS = join(ROOT, 'skills/shared/project-assets/project-transitions.md');
const VERIFIER_EXEC = join(ROOT, 'skills/shared/project-assets/verifier-exec.md');

function section(document, startHeading, endHeading) {
  const start = document.indexOf(startHeading);
  assert.notEqual(start, -1, `missing section: ${startHeading}`);
  const end = endHeading
    ? document.indexOf(endHeading, start + startHeading.length)
    : document.length;
  assert.notEqual(end, -1, `missing section: ${endHeading}`);
  return document.slice(start, end);
}

describe('closure authority assets resolve from the installed skill tree', () => {
  it('project-transitions.md and verifier-exec.md exist as package assets', () => {
    assert.equal(existsSync(TRANSITIONS), true, 'project-transitions.md must be present');
    assert.equal(existsSync(VERIFIER_EXEC), true, 'verifier-exec.md must be present');
    const transitions = readFileSync(TRANSITIONS, 'utf8');
    const verifier = readFileSync(VERIFIER_EXEC, 'utf8');
    assert.match(transitions, /## `done <task-id>`/);
    assert.match(verifier, /GATE-R2|evidence\.passed|Per-task verifiers/i);
  });

  it('implement explicitly loads both closure assets before invoking done', () => {
    assert.match(IMPLEMENT, /project-transitions\.md/);
    assert.match(IMPLEMENT, /verifier-exec\.md/);

    // Closure load is required around the close path, not only as a distant mention
    const step2 = section(
      IMPLEMENT,
      '### Step 2 — Execute one task',
      '### Step 3 — Phase boundary',
    );
    assert.match(step2, /project-transitions\.md/);
    assert.match(step2, /verifier-exec\.md/);
    assert.match(step2, /closure authority|canonical done flow/i);
    assert.match(step2, /delegat/i);
    // Explicit forbid: implement must not own a parallel done procedure
    assert.match(step2, /Do \*\*not\*\* reimplement `done` inside implement/i);
  });
});

describe('done checkpoint fixture includes status, evidence, and handoff in one commit', () => {
  const base = {
    taskId: 'T-001',
    projectId: 'demo',
    planSlug: 'ready',
    phaseId: 'F0',
    task: {
      id: 'T-001',
      status: 'active',
      verifier: { kind: 'shell', command: 'node --test tests/ready.test.js' },
    },
    verifierPassed: true,
    fingerprint: 'abc123def',
    eventPresent: false,
    handoffPresent: false,
    priorEventKeys: [],
  };

  it('fresh done writes status + evidence + handoff then one checkpoint', () => {
    const decision = decideDoneTerminal(base);
    assert.equal(decision.allowed, true);
    assert.ok(decision.writes.includes('task:status:done'));
    assert.ok(decision.writes.includes('task:evidence'));
    assert.ok(
      decision.writes.includes('initiative:handoff'),
      'handoff must be inside the close boundary',
    );
    assert.equal(decision.commits.length, 1);
    assert.match(decision.commits[0], /checkpoint/);
    // Ordering: terminal state (incl handoff) before event before commit
    const order = decision.order;
    assert.ok(Array.isArray(order) && order.length > 0);
    const handoffIdx = order.findIndex((s) => /handoff|state:terminal/.test(s));
    const eventIdx = order.findIndex((s) => /event/.test(s));
    const commitIdx = order.findIndex((s) => /commit|checkpoint/.test(s));
    if (handoffIdx !== -1 && eventIdx !== -1) {
      assert.ok(handoffIdx < eventIdx, 'handoff/state before event');
    }
    if (eventIdx !== -1 && commitIdx !== -1) {
      assert.ok(eventIdx < commitIdx, 'event before commit');
    }
    assert.equal(
      decision.eventKey,
      completionEventKey({
        event: 'task-done',
        projectId: 'demo',
        planSlug: 'ready',
        phaseId: 'F0',
        taskId: 'T-001',
      }),
    );
  });

  it('implement skill requires handoff inside the same done checkpoint (no dirty follow-up)', () => {
    const step2 = section(
      IMPLEMENT,
      '### Step 2 — Execute one task',
      '### Step 3 — Phase boundary',
    );
    assert.match(step2, /Session handoff.*same|handoff.*inside.*checkpoint|handoff.*in the same durable save/is);
    assert.match(step2, /do not create a second close commit|instead of creating a duplicate close commit/i);
    assert.match(
      IMPLEMENT,
      /handoff that records dirty files is a crash report|worktree is clean/i,
    );
  });

  it('idempotent second done does not leave handoff dirty via extra writes', () => {
    const closed = {
      ...base,
      task: {
        id: 'T-001',
        status: 'done',
        evidence: {
          passed: true,
          closeFingerprint: 'abc123def',
          verifierKind: 'shell',
        },
        verifier: base.task.verifier,
      },
      closeFingerprint: 'abc123def',
      eventPresent: true,
      handoffPresent: true,
      priorEventKeys: [
        doneEventKey({
          projectId: 'demo',
          planSlug: 'ready',
          phaseId: 'F0',
          taskId: 'T-001',
        }),
      ],
    };
    const decision = decideDoneTerminal(closed);
    assert.equal(decision.idempotent, true);
    assert.deepEqual(decision.writes, []);
    assert.deepEqual(decision.events, []);
    assert.deepEqual(decision.commits, []);
  });
});
