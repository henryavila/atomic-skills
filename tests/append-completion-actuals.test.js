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

// C-3: a commit anchor (immutable) must beat the committer-date heuristic, which
// a rebase/squash/amend silently corrupts. Here EVERY commit has a committer date
// LATER than the phase's `started` (as if the history was rebased after the phase
// began), so `--before=<started>` finds no base and the date heuristic inflates
// the actuals to include pre-phase work. The commit anchor computes the true range.
test('computePhaseActuals prefers a commit anchor over the date heuristic', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'as-actuals-anchor-'));
  try {
    git(cwd, ['init']);
    git(cwd, ['config', 'user.email', 'codex@example.com']);
    git(cwd, ['config', 'user.name', 'Codex']);

    // Pre-phase commit — committer date rewritten LATE (post-rebase simulation).
    writeFileSync(join(cwd, 'pre.txt'), 'pre\n');
    commit(cwd, 'pre-phase base', '2026-05-01T00:00:00Z');
    const anchor = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();

    // The phase's own work — one file, three inserts.
    writeFileSync(join(cwd, 'work.txt'), 'a\nb\nc\n');
    commit(cwd, 'phase work', '2026-05-02T00:00:00Z');

    const started = '2026-04-01T00:00:00Z'; // before BOTH committer dates

    // Date heuristic (bug): no commit is `--before` the started date, so the base
    // is the empty tree and the diff wrongly includes pre.txt too (2 files, 2 commits).
    assert.deepEqual(computePhaseActuals(started, { cwd }), {
      filesChanged: 2, locAdded: 4, locRemoved: 0, commits: 2,
    });

    // Commit anchor (fix): base = the real pre-phase commit → only phase work counts.
    assert.deepEqual(computePhaseActuals(started, { cwd, sinceCommit: anchor }), {
      filesChanged: 1, locAdded: 3, locRemoved: 0, commits: 1,
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// A recorded commit anchor that is NOT an ancestor of HEAD (wrong branch /
// rewritten away) is unusable as a range base. Falling back to the date
// heuristic would silently turn corrupt provenance into plausible-looking
// metrics, so actuals must be omitted instead.
test('computePhaseActuals omits actuals when the recorded anchor is not an ancestor', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'as-actuals-nonanc-'));
  try {
    git(cwd, ['init']);
    git(cwd, ['config', 'user.email', 'codex@example.com']);
    git(cwd, ['config', 'user.name', 'Codex']);

    writeFileSync(join(cwd, 'base.txt'), 'base\n');
    commit(cwd, 'base before phase', '2026-01-01T00:00:00Z');
    const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
    const main = execFileSync('git', ['branch', '--show-current'], { cwd, encoding: 'utf8' }).trim();

    writeFileSync(join(cwd, 'later.txt'), 'one\ntwo\nthree\n');
    commit(cwd, 'phase work', '2026-03-01T00:00:00Z');

    git(cwd, ['checkout', '-b', 'rewritten-anchor', base]);
    writeFileSync(join(cwd, 'discarded.txt'), 'discarded history\n');
    commit(cwd, 'discarded phase anchor', '2026-02-01T00:00:00Z');
    const nonAncestor = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
    git(cwd, ['checkout', main]);

    assert.equal(
      computePhaseActuals('2026-02-01T00:00:00Z', { cwd, sinceCommit: nonAncestor }),
      undefined,
    );
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
