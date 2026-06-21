import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendCompletion, computePhaseActuals } from '../scripts/append-completion.js';
import { validateCompletionEvent } from '../scripts/validate-aideck-state.js';

const LOG = (root) => join(root, '.atomic-skills', 'analytics', 'completions.jsonl');

const git = (cwd, args, env = process.env) => {
  execFileSync('git', args, { cwd, env, stdio: ['ignore', 'ignore', 'ignore'] });
};

const commit = (cwd, message, date) => {
  git(cwd, ['add', '.']);
  git(cwd, ['commit', '-m', message], {
    ...process.env,
    GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_DATE: date,
  });
};

test('computePhaseActuals returns phase aggregate git actuals since the phase started', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'as-actuals-git-'));
  try {
    git(cwd, ['init']);
    git(cwd, ['config', 'user.email', 'codex@example.com']);
    git(cwd, ['config', 'user.name', 'Codex']);

    writeFileSync(join(cwd, 'base.txt'), 'base\n');
    commit(cwd, 'base before phase', '2026-01-01T00:00:00Z');

    writeFileSync(join(cwd, 'later.txt'), 'one\ntwo\nthree\n');
    commit(cwd, 'add later file', '2026-03-01T00:00:00Z');

    writeFileSync(join(cwd, 'base.txt'), 'base changed\nextra\n');
    commit(cwd, 'change base file', '2026-03-01T00:00:01Z');

    const actuals = computePhaseActuals('2026-02-01T00:00:00Z', { cwd });
    assert.deepEqual(actuals, {
      filesChanged: 2,
      locAdded: 5,
      locRemoved: 1,
      commits: 2,
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('computePhaseActuals degrades to undefined without a usable git range', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'as-actuals-nongit-'));
  try {
    assert.equal(computePhaseActuals(undefined, { cwd }), undefined);
    assert.equal(computePhaseActuals('2026-02-01T00:00:00Z', { cwd }), undefined);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('appendCompletion writes a validating phase-done line with actuals', () => {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'as-actuals-log-'));
  try {
    const expected = { filesChanged: 3, locAdded: 40, locRemoved: 5, commits: 2 };
    const rec = appendCompletion(tmpRoot, {
      event: 'phase-done',
      projectId: 'p',
      planSlug: 's',
      phaseId: 'F4',
      taskId: null,
      actuals: expected,
    });
    assert.deepEqual(rec.actuals, expected);
    assert.equal(validateCompletionEvent(rec).ok, true);

    const parsed = JSON.parse(readFileSync(LOG(tmpRoot), 'utf8').trim());
    assert.equal(validateCompletionEvent(parsed).ok, true);
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('appendCompletion does not duplicate phase actuals onto task-done events', () => {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'as-actuals-task-'));
  try {
    const t = appendCompletion(tmpRoot, {
      event: 'task-done',
      projectId: 'p',
      planSlug: 's',
      phaseId: 'F4',
      taskId: 'T-001',
    });
    assert.equal('actuals' in t, false);
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});
