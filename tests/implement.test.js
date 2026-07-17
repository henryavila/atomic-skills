import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFuzzyIdentifier } from '../src/project-target-resolver.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const IMPLEMENT = join(ROOT, 'skills', 'core', 'implement.md');
const MODE2 = join(ROOT, 'skills', 'shared', 'mode2-codex-lane.md');
const TRANSITIONS = join(ROOT, 'skills', 'shared', 'project-assets', 'project-transitions.md');
const ROUTER = join(ROOT, 'skills', 'core', 'project.md');
const CREATE_PLAN = join(ROOT, 'skills', 'shared', 'project-assets', 'project-create-plan.md');

describe('implement skill microcommit contract', () => {
  it('requires a real microcommit checkpoint after every verified task close', () => {
    const content = readFileSync(IMPLEMENT, 'utf8');

    assert.match(content, /MICROCOMMITS ARE THE SNAPSHOT/);
    assert.match(content, /after every verified task close/i);
    assert.match(content, /rtk git add <explicit-paths>/);
    assert.match(content, /rtk git commit -m "feat\(T-NNN\): <summary>"/);
    assert.match(content, /State close commit is owned by `done <task-id>`/);
    assert.match(content, /rtk git commit -m "chore\(project\): checkpoint <plan> <phase> <task-id>"/);
    assert.match(content, /instead of creating a duplicate close commit/);
    assert.match(content, /Never use `git add \.` or `git add -A`/);
    assert.match(content, /A handoff that records dirty files is a crash report, not a successful checkpoint/);
  });
});

describe('F3/T-004 — degraded mode only-ad-hoc; concurrency; shared resolution', () => {
  it('limits degraded mode to explicit ad-hoc (never plan tasks without SPEC)', () => {
    const content = readFileSync(IMPLEMENT, 'utf8');
    assert.match(content, /## Degraded mode \(explicit ad-hoc only\)/);
    assert.match(content, /explicitly declared ad-hoc/i);
    assert.match(content, /Never enter degraded mode when/i);
    assert.match(content, /missing admitted outputs|SPEC gap/i);
  });

  it('declares one writer per worktree with serial merge', () => {
    const impl = readFileSync(IMPLEMENT, 'utf8');
    const mode2 = readFileSync(MODE2, 'utf8');
    assert.match(impl, /ONE WRITER PER WORKTREE/i);
    assert.match(mode2, /One writer per worktree/i);
    assert.match(mode2, /Merge-back is serial/i);
  });

  it('router and transitions share the same pre-mutation verb list surface', () => {
    const router = readFileSync(ROUTER, 'utf8');
    const transitions = readFileSync(TRANSITIONS, 'utf8');
    for (const verb of [
      'unblock',
      'finalize',
      'consolidate',
      'depend add',
      'reconcile',
      'verify --fix',
    ]) {
      assert.match(router, new RegExp(verb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.match(transitions, new RegExp(verb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.match(transitions, /same` pre-mutation verb list as the router|same\*\* pre-mutation verb list as the router/i);
  });

  it('shared fuzzy resolution is inherited by lazy verbs (not exact-only forks)', () => {
    const transitions = readFileSync(TRANSITIONS, 'utf8');
    assert.match(transitions, /resolveFuzzyIdentifier|Fuzzy identifier resolution \(shared/i);
    assert.match(transitions, /materialize/);
    assert.match(transitions, /Lazy detail files must not invent a stricter/);
    const r = resolveFuzzyIdentifier('valid', [
      { id: 'f0.5-validation', title: 'Validation phase' },
      { id: 'F1', title: 'Other' },
    ]);
    assert.equal(r.code, 'unique-fuzzy');
    assert.equal(r.match.id, 'f0.5-validation');
  });

  it('adopt hard-blocks placeholders and persists supersedes', () => {
    const create = readFileSync(CREATE_PLAN, 'utf8');
    assert.match(create, /No-Placeholders is a hard gate for `adopt`/i);
    assert.match(create, /HARD-BLOCK/);
    assert.doesNotMatch(
      create,
      /Advisory No-Placeholders surface[\s\S]{0,80}not as a hard gate/,
    );
    assert.match(create, /supersedes:/);
    assert.match(create, /persist.*supersedes|supersedes` link/i);
  });
});
