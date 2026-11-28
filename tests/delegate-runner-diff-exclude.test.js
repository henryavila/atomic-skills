import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  hasPython3,
  git,
  initGitRepo,
  makeFakeBin,
  runDelegate,
  readLogRecords,
} from './helpers/delegate-runner-kit.js';

// --diff-exclude leaves lockfiles and generated files out of the review diff.
// All executors below are disposable fake CLIs.
const CLEAN = 'Read the diff; nothing wrong.\nFINDINGS 0\n';

describe('delegate.py --diff-exclude', { skip: !hasPython3 ? 'python3 not on PATH' : false }, () => {
  let root;
  let atomicHome;
  let repoDir;
  let outDir;
  let cardPath;
  let reviewCardPath;
  let seqDir;
  let baseEnv;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'as-delegate-exclude-')));
    atomicHome = join(root, 'atomic-home');
    repoDir = join(root, 'repo');
    outDir = join(root, 'out');
    seqDir = join(root, 'seq');
    for (const dir of [atomicHome, join(root, 'empty-home'), repoDir, seqDir]) mkdirSync(dir, { recursive: true });
    initGitRepo(repoDir);
    const { binDir } = makeFakeBin(root);
    cardPath = join(root, 'card.md');
    writeFileSync(cardPath, '# Task CARD-1\nImplement feature X.\n');
    reviewCardPath = join(root, 'review-card.md');
    writeFileSync(reviewCardPath, '# Review CARD-1\nReview the diff below against the attached card.\n');
    baseEnv = {
      PATH: `${binDir}:${process.env.PATH || '/usr/bin:/bin'}`,
      HOME: join(root, 'empty-home'),
      ATOMIC_SKILLS_HOME: atomicHome,
      DELEGATE_PEAK_WINDOWS: '',
      DELEGATE_CODEX_MODEL: undefined,
      FAKE_STDOUT: CLEAN,
      FAKE_LAST_MESSAGE: CLEAN,
    };
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  // One commit with a source file, a lockfile and a generated file; returns its range.
  function commitWithLockfile(lockBytes = 40) {
    const base = git(repoDir, 'rev-parse', 'HEAD');
    mkdirSync(join(repoDir, 'gen'), { recursive: true });
    writeFileSync(join(repoDir, 'app.js'), 'export const answer = 42;\n');
    writeFileSync(join(repoDir, 'package-lock.json'), `{"lock": "${'x'.repeat(lockBytes)}"}\n`);
    writeFileSync(join(repoDir, 'gen', 'out.js'), 'generated();\n');
    git(repoDir, 'add', '-A');
    git(repoDir, 'commit', '-m', 'feature with lockfile');
    return `${base}...HEAD`;
  }
  function reviewArgs(range, extra = [], profile = 'codex-review') {
    return ['run', '--id', 'X1', '--task', 'exclude', '--role', 'review', '--profile', profile,
      '--cwd', repoDir, '--card', reviewCardPath, '--diff-range', range, '--out', outDir, '--confirmed', ...extra];
  }
  function lastRun() { return readLogRecords(atomicHome).filter((r) => r.kind === 'run').at(-1); }

  it('leaves each excluded pathspec out of a review run and records them', () => {
    const range = commitWithLockfile();
    const res = runDelegate(reviewArgs(range, ['--diff-exclude', 'package-lock.json', '--diff-exclude', 'gen/*']), baseEnv);
    assert.equal(res.status, 0, res.stderr);
    const rec = lastRun();
    const prompt = readFileSync(rec.prompt, 'utf8');
    assert.ok(prompt.includes('diff --git a/app.js b/app.js'), 'the source file is reviewed');
    assert.ok(!prompt.includes('package-lock.json b/package-lock.json'), 'the lockfile is left out');
    assert.ok(!prompt.includes('gen/out.js b/gen/out.js'), 'the generated file is left out');
    assert.match(prompt, /^## Diff \S+ \(left out: package-lock\.json, gen\/\*\)$/m);
    assert.deepEqual(rec.diff_excluded, ['package-lock.json', 'gen/*']);
  });

  it('reviews the whole diff and records nothing without the option', () => {
    const range = commitWithLockfile();
    const res = runDelegate(reviewArgs(range), baseEnv);
    assert.equal(res.status, 0, res.stderr);
    const rec = lastRun();
    assert.ok(readFileSync(rec.prompt, 'utf8').includes('package-lock.json b/package-lock.json'));
    assert.equal(rec.diff_excluded, undefined);
  });

  it('names --diff-exclude when a review prompt is too large for OpenCode', () => {
    const range = commitWithLockfile(140000);
    let res = runDelegate(reviewArgs(range, [], 'flash-review'), baseEnv);
    assert.equal(res.status, 1, res.stderr);
    assert.equal(lastRun().failure, 'review_input_too_large');
    assert.match(res.stderr, /^delegate: the review prompt is \d+ bytes, above the 131072 bytes OpenCode takes; .*--diff-exclude <pathspec>/m);
    assert.match(lastRun().hint, /--diff-exclude/);
    res = runDelegate(reviewArgs(range, ['--diff-exclude', 'package-lock.json'], 'flash-review'), baseEnv);
    assert.equal(res.status, 0, res.stderr);
    assert.equal(lastRun().failure, 'none');
  });

  describe('in a pipeline', () => {
    const review = (text) => ({ FAKE_STDOUT: text, FAKE_LAST_MESSAGE: text });
    const LIMIT = { FAKE_EXIT: '1', FAKE_STDERR: 'ERROR: usage limit reached. Resets in 2h0m0s.\n' };
    const MAJOR = 'F01 | app.js:1 | origin=diff | dup=none | card=none | kind=behaviour | reach=normal | proof=shown | wrong answer | ran it\nFINDINGS 1\n';
    // The fake executor commits its file and leaves the lockfile for the runner to commit.
    const WORK = { FAKE_COMMIT_FILE: 'app.js', FAKE_TOUCH_FILE: 'package-lock.json' };
    function steps(configs) {
      rmSync(seqDir, { recursive: true, force: true });
      mkdirSync(seqDir, { recursive: true });
      configs.forEach((cfg, i) => writeFileSync(join(seqDir, `step_${i}.json`), JSON.stringify(cfg)));
      return { ...baseEnv, FAKE_SEQ_DIR: seqDir };
    }
    function pipelineArgs() {
      return ['pipeline', '--id', 'X2', '--task', 'exclude in pipeline', '--role', 'implement',
        '--cwd', repoDir, '--card', cardPath, '--route', 'flash', '--gate', 'true',
        '--review-card', reviewCardPath, '--review-route', 'codex-review', '--out', outDir, '--confirmed',
        '--diff-exclude', 'package-lock.json'];
    }
    function reviewPrompts() {
      return readLogRecords(atomicHome).filter((r) => r.role === 'review').map((r) => readFileSync(r.prompt, 'utf8'));
    }

    it('leaves the pathspec out of the review and of the follow-up review, and records it', () => {
      const res = runDelegate(pipelineArgs(), steps([WORK, review(MAJOR),
        { FAKE_COMMIT_FILE: 'fix.js', FAKE_EARLY_TOUCH: 'package-lock.json' },
        review('MAJOR F01 fixed | ok\nFINDINGS 0\n')]));
      assert.equal(res.status, 0, res.stderr);
      const [first, followUp] = reviewPrompts();
      assert.ok(first.includes('diff --git a/app.js b/app.js'));
      assert.ok(!first.includes('b/package-lock.json'));
      assert.ok(followUp.includes('diff --git a/fix.js b/fix.js'));
      assert.ok(!followUp.includes('b/package-lock.json'));
      const recs = readLogRecords(atomicHome);
      for (const rec of recs.filter((r) => r.role === 'review')) assert.deepEqual(rec.diff_excluded, ['package-lock.json']);
      assert.deepEqual(recs.at(-1).diff_excluded, ['package-lock.json']);
    });

    it('keeps the pathspec for review-pending', () => {
      let res = runDelegate(pipelineArgs(), steps([WORK, LIMIT]));
      assert.equal(res.status, 1, res.stderr);
      const pending = JSON.parse(readFileSync(join(atomicHome, 'delegate', 'pending', 'repo', 'X2.json'), 'utf8'));
      assert.deepEqual(pending.diff_exclude, ['package-lock.json']);
      res = runDelegate(['review-pending', '--id', 'X2', '--confirmed'], steps([review(CLEAN)]));
      assert.equal(res.status, 0, res.stderr);
      const prompt = reviewPrompts().at(-1);
      assert.ok(prompt.includes('diff --git a/app.js b/app.js'));
      assert.ok(!prompt.includes('b/package-lock.json'));
      assert.deepEqual(readLogRecords(atomicHome).at(-1).diff_excluded, ['package-lock.json']);
    });
  });
});
