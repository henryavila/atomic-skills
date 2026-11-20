import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync, execFileSync, spawn } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, dirname, resolve, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  REPO_ROOT,
  DELEGATE_PY,
  hasPython3,
  PYTHON3,
  git,
  initGitRepo,
  makeFakeBin,
  runDelegate,
  readLogRecords,
} from './helpers/delegate-runner-kit.js';

describe('delegate.py pending reviews', { skip: !hasPython3 ? 'python3 not on PATH' : false }, () => {
  let root;
  let atomicHome;
  let emptyHome;
  let repoDir;
  let fakeBin;
  let fakePaths;
  let cardPath;
  let reviewCardPath;
  let seqDir;
  let argvFile;
  let stdinFile;
  let outDir;
  let baseEnv;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'as-delegate-')));
    atomicHome = join(root, 'atomic-home');
    emptyHome = join(root, 'empty-home');
    repoDir = join(root, 'repo');
    outDir = join(root, 'out');
    mkdirSync(atomicHome, { recursive: true });
    mkdirSync(emptyHome, { recursive: true });
    mkdirSync(repoDir, { recursive: true });
    initGitRepo(repoDir);

    const fakes = makeFakeBin(root);
    fakeBin = fakes.binDir;
    fakePaths = fakes.paths;

    cardPath = join(root, 'card.md');
    writeFileSync(cardPath, '# Task CARD-1\nImplement feature X.\n');

    reviewCardPath = join(root, 'review-card.md');
    writeFileSync(
      reviewCardPath,
      '# Review CARD-1\nReview the diff `git diff {{DIFF_RANGE}}`\nTOTAL major=0 medium=0 minor=0\n',
    );

    seqDir = join(root, 'seq');
    mkdirSync(seqDir, { recursive: true });

    argvFile = join(root, 'captured.argv.json');
    stdinFile = join(root, 'captured.stdin.txt');

    baseEnv = {
      PATH: `${fakeBin}:${process.env.PATH || '/usr/bin:/bin'}`,
      HOME: emptyHome,
      ATOMIC_SKILLS_HOME: atomicHome,
      DELEGATE_PEAK_WINDOWS: '',
      FAKE_ARGV_FILE: argvFile,
      FAKE_STDIN_FILE: stdinFile,
      FAKE_STDOUT: 'Reviewed the diff; no findings.\nTOTAL major=0 medium=0 minor=0\n',
      FAKE_LAST_MESSAGE: 'Reviewed the diff; no findings.\nTOTAL major=0 medium=0 minor=0\n',
    };
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const LIMIT = { FAKE_EXIT: '1', FAKE_STDERR: 'ERROR: usage limit reached. Resets in 2h0m0s.\n' };
  const REVIEW = 'R01 | major | feature.txt:1 | bug | test | fix it\nTOTAL major=1 medium=0 minor=0\n';
  const OK = { FAKE_STDOUT: REVIEW, FAKE_LAST_MESSAGE: REVIEW };

  function pipelineArgs(extra = []) {
    return ['pipeline', '--id', 'P1', '--task', 'pending case', '--role', 'implement',
      '--cwd', repoDir, '--card', cardPath, '--route', 'flash', '--gate', 'true',
      '--review-card', reviewCardPath, '--review-route', 'codex-review,agy-review',
      '--out', outDir, '--confirmed', ...extra];
  }
  function steps(configs) {
    rmSync(seqDir, { recursive: true, force: true });
    mkdirSync(seqDir, { recursive: true });
    configs.forEach((cfg, i) => writeFileSync(join(seqDir, `step_${i}.json`), JSON.stringify(cfg)));
    return { ...baseEnv, FAKE_SEQ_DIR: seqDir, DELEGATE_CODEX_MODEL: undefined };
  }
  function pendingFile() { return join(atomicHome, 'delegate', 'pending', 'repo', 'P1.json'); }
  function summary() { return readFileSync(join(outDir, 'P1.summary.md'), 'utf8'); }
  function leavePending() {
    const res = runDelegate(pipelineArgs(), steps([{ FAKE_COMMIT_FILE: 'feature.txt' }, LIMIT, LIMIT]));
    assert.equal(res.status, 1, res.stderr);
    return res;
  }

  it('a review route exhausted by provider limits ends review_pending and writes what is left', () => {
    const base = git(repoDir, 'rev-parse', 'HEAD');
    leavePending();
    const pipeRec = readLogRecords(atomicHome).at(-1);
    assert.equal(pipeRec.outcome, 'review_pending');
    assert.equal(pipeRec.failed_step, 'review');
    assert.equal(pipeRec.pending, pendingFile());
    const pending = JSON.parse(readFileSync(pendingFile(), 'utf8'));
    assert.equal(pending.id, 'P1');
    assert.equal(pending.cwd, repoDir);
    assert.equal(pending.base, base);
    assert.equal(pending.head, git(repoDir, 'rev-parse', 'HEAD'));
    assert.equal(pending.executor_profile, 'flash');
    assert.deepEqual(pending.review_route, ['codex-review', 'agy-review']);
    assert.ok(existsSync(pending.review_card));
    assert.deepEqual(pending.attachments, [cardPath]);
    assert.match(summary(), /review pending: every reviewer was out of quota or had no free slot/);
    assert.match(summary(), /review-pending --id P1 --confirmed/);
  });

  it('a reviewer that fails for another reason still ends no_reviewer and leaves nothing pending', () => {
    const res = runDelegate(pipelineArgs(['--review-route', 'codex-review']),
      steps([{ FAKE_COMMIT_FILE: 'feature.txt' }, { FAKE_EXIT: '1', FAKE_STDERR: 'boom\n' }]));
    assert.equal(res.status, 1, res.stderr);
    assert.equal(readLogRecords(atomicHome).at(-1).outcome, 'no_reviewer');
    assert.equal(existsSync(pendingFile()), false);
  });

  it('review-pending lists what is pending, and status counts it', () => {
    let res = runDelegate(['review-pending'], baseEnv);
    assert.equal(res.status, 0, res.stderr);
    assert.equal(res.stdout.trim(), 'no pending reviews');
    leavePending();
    res = runDelegate(['review-pending'], baseEnv);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /^P1 \| repo \| written by flash \| since \S+ \| first back: (codex|agy)-review at \S+$/m);
    const status = runDelegate(['status'], baseEnv);
    assert.match(status.stdout, /^pending reviews: 1 \(list them with review-pending\)$/m);
  });

  it('review-pending finishes the review, records it and removes the pending file', () => {
    leavePending();
    const before = readLogRecords(atomicHome).length;
    const res = runDelegate(['review-pending', '--id', 'P1', '--confirmed'], steps([LIMIT, OK]));
    assert.equal(res.status, 0, res.stderr);
    const recs = readLogRecords(atomicHome).slice(before);
    assert.deepEqual(recs.map(r => r.kind), ['run', 'run', 'pipeline']);
    assert.equal(recs[0].failure, 'provider_limit');
    assert.equal(recs[1].failure, 'none');
    assert.equal(recs[1].role, 'review');
    const pipeRec = recs[2];
    assert.equal(pipeRec.outcome, 'reviewed');
    assert.equal(pipeRec.resumed_from, 'review_pending');
    assert.equal(pipeRec.executor_profile, 'flash');
    assert.ok(['codex-review', 'agy-review'].includes(pipeRec.reviewer_profile));
    assert.deepEqual(pipeRec.findings, { major: 1, medium: 0, minor: 0 });
    assert.equal(existsSync(pendingFile()), false);
    assert.match(summary(), /^# Pipeline P1: pending case — reviewed/);
    assert.match(summary(), /R01 \| major/);
    assert.equal(res.stdout.trim(), summary().trim());
    // The reviewer got the diff of the gated work and the author's card.
    const stdin = readFileSync(join(seqDir, 'stdin_1.txt'), 'utf8');
    assert.match(stdin, /feature\.txt/);
    assert.match(stdin, /Implement feature X/);
  });

  it('review-pending keeps the file when the reviewers are still out', () => {
    leavePending();
    const res = runDelegate(['review-pending', '--id', 'P1', '--confirmed'], steps([LIMIT, LIMIT]));
    assert.equal(res.status, 1, res.stderr);
    assert.ok(existsSync(pendingFile()));
    assert.equal(readLogRecords(atomicHome).at(-1).outcome, 'review_pending');
    assert.match(res.stdout, /still pending/);
  });

  it('review-pending refuses a worktree that moved since the gate and launches nothing', () => {
    leavePending();
    writeFileSync(join(repoDir, 'later.txt'), 'x\n');
    const before = readLogRecords(atomicHome).length;
    let res = runDelegate(['review-pending', '--id', 'P1', '--confirmed'], steps([OK]));
    assert.equal(res.status, 2);
    assert.match(res.stderr, /worktree changed since the gate/);
    git(repoDir, 'add', 'later.txt');
    git(repoDir, 'commit', '-m', 'later');
    res = runDelegate(['review-pending', '--id', 'P1', '--confirmed'], steps([OK]));
    assert.equal(res.status, 2);
    assert.match(res.stderr, /worktree changed since the gate/);
    assert.equal(readLogRecords(atomicHome).length, before);
    assert.ok(existsSync(pendingFile()));
  });

  it('review-pending needs --confirmed and a known id', () => {
    leavePending();
    let res = runDelegate(['review-pending', '--id', 'P1'], baseEnv);
    assert.equal(res.status, 2);
    assert.match(res.stderr, /--confirmed required/);
    res = runDelegate(['review-pending', '--id', 'NOPE', '--confirmed'], baseEnv);
    assert.equal(res.status, 2);
    assert.match(res.stderr, /no pending review for NOPE/);
  });

  it('a review that writes ends no_reviewer and drops the pending file', () => {
    leavePending();
    const res = runDelegate(['review-pending', '--id', 'P1', '--confirmed'],
      steps([{ ...OK, FAKE_TOUCH_FILE: 'written-by-reviewer.txt' }]));
    assert.equal(res.status, 1, res.stderr);
    assert.equal(readLogRecords(atomicHome).at(-1).outcome, 'no_reviewer');
    assert.equal(existsSync(pendingFile()), false);
  });
});
