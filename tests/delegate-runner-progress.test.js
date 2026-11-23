import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir, hostname } from 'node:os';
import {
  DELEGATE_PY,
  PYTHON3,
  hasPython3,
  git,
  initGitRepo,
  makeFakeBin,
  runDelegate,
  readLogRecords,
  runDelegateAsync,
} from './helpers/delegate-runner-kit.js';

// AS-D11a: a run is stopped for lack of progress, keeps its work in a
// checkpoint, and can be resumed. Every executor here is a disposable fake CLI.
describe('delegate.py progress limit and resume', { skip: !hasPython3 ? 'python3 not on PATH' : false }, () => {
  let root;
  let atomicHome;
  let repoDir;
  let cardPath;
  let reviewCardPath;
  let outDir;
  let baseEnv;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'as-delegate-progress-')));
    atomicHome = join(root, 'atomic-home');
    repoDir = join(root, 'repo');
    outDir = join(root, 'out');
    mkdirSync(atomicHome, { recursive: true });
    mkdirSync(join(root, 'empty-home'), { recursive: true });
    mkdirSync(repoDir, { recursive: true });
    initGitRepo(repoDir);
    const fakes = makeFakeBin(root);
    cardPath = join(root, 'card.md');
    writeFileSync(cardPath, '# Task CARD-1\nImplement feature X.\n');
    reviewCardPath = join(root, 'review-card.md');
    writeFileSync(reviewCardPath, '# Review CARD-1\nReview the diff.\n');
    baseEnv = {
      PATH: `${fakes.binDir}:${process.env.PATH || '/usr/bin:/bin'}`,
      HOME: join(root, 'empty-home'),
      ATOMIC_SKILLS_HOME: atomicHome,
      DELEGATE_PEAK_WINDOWS: '',
    };
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function runArgs(id, extra = []) {
    return ['run', '--id', id, '--task', 'progress', '--role', 'implement',
      '--profile', 'flash', '--cwd', repoDir, '--card', cardPath,
      '--out', outDir, '--confirmed', ...extra];
  }

  async function waitFor(check, ms, what) {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      if (check()) return;
      await new Promise((r) => setTimeout(r, 25));
    }
    assert.fail(`timed out waiting for ${what}`);
  }

  function stalledRun(id = 'STALL') {
    const res = runDelegate(runArgs(id, ['--idle-timeout', '3']),
      { ...baseEnv, FAKE_SLEEP: '120', FAKE_EARLY_TOUCH: 'wip.txt', FAKE_STDOUT: 'started the work\n' });
    const rec = readLogRecords(atomicHome).at(-1);
    return { res, rec };
  }

  it('stops a silent executor at the idle limit, long before the time cap, as stalled', () => {
    const before = Date.now();
    const { res, rec } = stalledRun();
    assert.equal(res.status, 1, res.stderr);
    assert.equal(rec.failure, 'stalled');
    assert.equal(rec.timed_out, false);
    assert.ok(rec.idle_s >= 3, JSON.stringify(rec));
    assert.ok(Date.now() - before < 60000, 'the idle limit, not the 240 minute cap, ended the run');
  });

  it('keeps the unfinished work of a stopped run in a checkpoint commit and a resume note', () => {
    const base = git(repoDir, 'rev-parse', 'HEAD');
    const { rec } = stalledRun();
    const head = git(repoDir, 'rev-parse', 'HEAD');
    assert.notEqual(head, base);
    assert.equal(rec.checkpoint.commit, head);
    assert.equal(git(repoDir, 'log', '-1', '--format=%s'),
      'STALL: work in progress (checkpoint by the delegate runner)');
    assert.equal(git(repoDir, 'status', '--porcelain'), '');
    assert.equal(git(repoDir, 'show', '--name-only', '--format=', 'HEAD'), 'wip.txt');
    assert.equal(rec.checkpoint.resume, join(outDir, 'STALL.resume.md'));
    const note = readFileSync(rec.checkpoint.resume, 'utf8');
    assert.match(note, /Stopped because: no progress for 3 s/);
    assert.match(note, /\?\? wip\.txt/);
    assert.match(note, new RegExp(`${head.slice(0, 10)} STALL: work in progress`));
    assert.match(note, /started the work/);
    assert.equal(rec.dirty_after, false);
    assert.equal(rec.commits, 1);
  });

  it('does not stop an executor that keeps producing output past the idle limit', () => {
    const res = runDelegate(runArgs('BUSY', ['--idle-timeout', '4']),
      { ...baseEnv, FAKE_TICKS: '20:0.3' });
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'none', res.stderr);
    assert.ok(rec.duration_s >= 5, JSON.stringify(rec));
    assert.equal(rec.checkpoint, undefined);
  });

  it('never makes the executor lose a git command to the progress check', () => {
    // The check runs every 0.05 s here while the executor adds and commits 60 times.
    const res = runDelegate(runArgs('GIT'),
      { ...baseEnv, FAKE_COMMIT_ROUNDS: '60', DELEGATE_PROGRESS_POLL_S: '0.05' });
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'none', readFileSync(rec.stderr, 'utf8'));
    assert.equal(rec.commits, 60);
    assert.equal(res.status, 0);
  });

  it('counts a change in the working tree as progress', async () => {
    const ready = join(root, 'ready');
    const run = runDelegateAsync(runArgs('TREE', ['--idle-timeout', '4']),
      { ...baseEnv, FAKE_READY_FILE: ready, FAKE_WAIT_FILE: join(root, 'release'), FAKE_WAIT_TIMEOUT: '120' });
    try {
      await waitFor(() => existsSync(ready), 20000, 'executor start');
      // Silent executor; the only sign of life is a file that keeps changing.
      for (let round = 0; round < 20; round += 1) {
        writeFileSync(join(repoDir, 'grows.txt'), 'x'.repeat(round + 1));
        await new Promise((r) => setTimeout(r, 300));
      }
      writeFileSync(join(root, 'release'), 'go');
      const res = await run.done;
      const [rec] = readLogRecords(atomicHome);
      assert.equal(rec.failure, 'none', res.stderr);
    } finally {
      writeFileSync(join(root, 'release'), 'go');
      if (run.child.exitCode === null) {
        try { run.child.kill('SIGKILL'); } catch { /* already gone */ }
      }
    }
  });

  it('still records timeout at the time cap, with a checkpoint, when the idle limit is off', () => {
    const res = runDelegate(runArgs('CAP', ['--timeout', '1', '--idle-timeout', '0']),
      { ...baseEnv, FAKE_SLEEP: '120', FAKE_EARLY_TOUCH: 'wip.txt' });
    assert.equal(res.status, 1, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'timeout');
    assert.equal(rec.timed_out, true);
    assert.equal(rec.checkpoint.commit, git(repoDir, 'rev-parse', 'HEAD'));
    assert.match(readFileSync(rec.checkpoint.resume, 'utf8'), /reached its time cap of 1 s/);
  });

  it('writes the resume note without a commit when the stopped run left a clean tree', () => {
    const base = git(repoDir, 'rev-parse', 'HEAD');
    runDelegate(runArgs('CLEAN', ['--idle-timeout', '3']), { ...baseEnv, FAKE_SLEEP: '120' });
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'stalled');
    assert.equal(rec.checkpoint.commit, null);
    assert.equal(git(repoDir, 'rev-parse', 'HEAD'), base);
    assert.match(readFileSync(rec.checkpoint.resume, 'utf8'), /nothing to commit: the working tree was clean/);
  });

  it('leaves no checkpoint for a run that ends by itself, or for a stopped review', () => {
    runDelegate(runArgs('DONE'), baseEnv);
    const base = git(repoDir, 'rev-parse', 'HEAD');
    writeFileSync(join(repoDir, 'change.txt'), 'x\n');
    git(repoDir, 'add', 'change.txt');
    git(repoDir, 'commit', '-m', 'change');
    runDelegate(['run', '--id', 'REV', '--task', 'review', '--role', 'review', '--profile', 'agy-review',
      '--cwd', repoDir, '--card', reviewCardPath, '--out', outDir, '--confirmed',
      '--diff-range', `${base}...HEAD`, '--idle-timeout', '3'], { ...baseEnv, FAKE_SLEEP: '120' });
    const [done, review] = readLogRecords(atomicHome);
    assert.equal(done.failure, 'none');
    assert.equal(done.checkpoint, undefined);
    assert.equal(review.failure, 'stalled');
    assert.equal(review.checkpoint, undefined);
    assert.deepEqual(readdirSync(outDir).filter((name) => name.endsWith('.resume.md')), []);
  });

  it('resumes from the note: card first, then the resume section, attempt and origin recorded', () => {
    const { rec: first } = stalledRun();
    const res = runDelegate(runArgs('STALL', ['--resume']), baseEnv);
    assert.equal(res.status, 0, res.stderr);
    const second = readLogRecords(atomicHome).at(-1);
    assert.equal(second.failure, 'none');
    assert.equal(second.attempt, 2);
    assert.equal(second.resumed_from, first.completed);
    assert.equal(second.resume_note, first.checkpoint.resume);
    const prompt = readFileSync(second.prompt, 'utf8');
    const card = prompt.indexOf('Implement feature X.');
    const section = prompt.indexOf('## You are resuming an interrupted run');
    const note = prompt.indexOf('# Resume note for STALL');
    assert.ok(card >= 0 && section > card && note > section, prompt);
    assert.match(prompt, /Do not redo work that is already committed/);
    assert.match(prompt, /STALL: work in progress/);
    assert.notEqual(second.prompt, first.prompt);
    assert.equal(second.prompt_bytes, Buffer.byteLength(prompt));
  });

  it('refuses --resume when the id has no run, or its last run left no checkpoint', () => {
    const none = runDelegate(runArgs('NEVER', ['--resume']), baseEnv);
    assert.equal(none.status, 2);
    assert.match(none.stderr, /no resume note for NEVER: no run of that id is recorded/);
    assert.equal(existsSync(join(atomicHome, 'delegate', 'runs.jsonl')), false);

    stalledRun();
    assert.equal(runDelegate(runArgs('STALL', ['--resume']), baseEnv).status, 0);
    const again = runDelegate(runArgs('STALL', ['--resume']), baseEnv);
    assert.equal(again.status, 2);
    assert.match(again.stderr, /no resume note for STALL: its last run ended with failure=none/);
    assert.equal(readLogRecords(atomicHome).length, 2);
  });

  it('refuses a time cap below 60 seconds unless it is said to be meant, before anything runs', () => {
    const strict = { ...baseEnv, DELEGATE_TEST_STRICT_TIME: '1' };
    const refused = runDelegate(runArgs('SHORT', ['--timeout', '45']), strict);
    assert.equal(refused.status, 2);
    assert.match(refused.stderr, /--timeout 45 is 45 seconds/);
    assert.match(refused.stderr, /--allow-short-timeout/);
    assert.equal(existsSync(join(atomicHome, 'delegate', 'runs.jsonl')), false);

    const pipe = runDelegate(['pipeline', '--id', 'SHORT', '--task', 't', '--role', 'implement',
      '--cwd', repoDir, '--card', cardPath, '--route', 'flash', '--gate', 'true',
      '--review-card', reviewCardPath, '--review-route', 'codex-review', '--out', outDir,
      '--confirmed', '--review-timeout', '30'], strict);
    assert.equal(pipe.status, 2);
    assert.match(pipe.stderr, /--review-timeout 30 is 30 seconds/);

    const meant = runDelegate(runArgs('SHORT', ['--timeout', '45', '--allow-short-timeout']), strict);
    assert.equal(meant.status, 0, meant.stderr);
  });

  it('reads time options with a unit and refuses what is not a time', () => {
    for (const [value, ok] of [['90m', true], ['2h', true], ['300s', true], ['300', true],
      ['1.5h', true], ['soon', false], ['5d', false], ['-5', false]]) {
      const res = runDelegate(runArgs(`UNIT-${value}`, ['--timeout', value]),
        { ...baseEnv, DELEGATE_TEST_STRICT_TIME: '1' });
      assert.equal(res.status, ok ? 0 : 2, `${value}: ${res.stderr}`);
      if (!ok) assert.match(res.stderr, /invalid time|expected one argument/);
    }
    // One minute as a unit is past the 60 second floor; the same digit bare is not.
    const strict = { ...baseEnv, DELEGATE_TEST_STRICT_TIME: '1' };
    assert.equal(runDelegate(runArgs('ONE-M', ['--timeout', '1m']), strict).status, 0);
    assert.equal(runDelegate(runArgs('ONE', ['--timeout', '1']), strict).status, 2);
    // The idle limit takes the same units: 1m is far longer than this run.
    const idle = runDelegate(runArgs('IDLE-M', ['--idle-timeout', '1m']), { ...baseEnv, FAKE_SLEEP: '2' });
    assert.equal(idle.status, 0, idle.stderr);
  });

  it('status shows how long each active run has been without progress', async () => {
    const ready = join(root, 'ready');
    const release = join(root, 'release');
    const run = runDelegateAsync(runArgs('WATCH'),
      { ...baseEnv, FAKE_READY_FILE: ready, FAKE_WAIT_FILE: release, FAKE_WAIT_TIMEOUT: '120' });
    try {
      await waitFor(() => existsSync(ready), 20000, 'executor start');
      const status = runDelegate(['status'], baseEnv);
      assert.equal(status.status, 0, status.stderr);
      const machine = hostname().split('.')[0];
      const line = status.stdout.split('\n').find(text => text.startsWith('WATCH |'));
      assert.ok(line, status.stdout);
      const cells = line.split(' | ');
      assert.deepEqual(cells.slice(0, 5), ['WATCH', 'repo', 'flash', 'implement', machine]);
      assert.match(cells.slice(5).join(' | '), /^\d+m \| idle \d+m$/);
      const slotDir = join(atomicHome, 'delegate', 'running');
      const [slotName] = readdirSync(slotDir).filter(name => name.endsWith('.json'));
      assert.equal(JSON.parse(readFileSync(join(slotDir, slotName), 'utf8')).machine, machine);
      writeFileSync(release, 'go');
      const res = await run.done;
      assert.equal(res.status, 0, res.stderr);
    } finally {
      writeFileSync(release, 'go');
      if (run.child.exitCode === null) {
        try { run.child.kill('SIGKILL'); } catch { /* already gone */ }
      }
    }
  });

  // --- which repository and milestone a run belongs to ---

  function lastRecord() { return readLogRecords(atomicHome).at(-1); }

  it('records the repository as owner/name from https, ssh and scp-like origins', () => {
    const cases = [
      ['https://github.com/acme/widgets.git', 'acme/widgets'],
      ['https://github.com/acme/widgets', 'acme/widgets'],
      ['https://github.com/acme/widgets/', 'acme/widgets'],
      ['ssh://git@github.com/acme/widgets.git', 'acme/widgets'],
      ['ssh://git@git.example.com:2222/acme/widgets', 'acme/widgets'],
      ['git@github.com:acme/widgets.git', 'acme/widgets'],
      ['git@github.com:acme/widgets', 'acme/widgets'],
    ];
    git(repoDir, 'remote', 'add', 'origin', cases[0][0]);
    cases.forEach(([url, repo], index) => {
      git(repoDir, 'remote', 'set-url', 'origin', url);
      const res = runDelegate(runArgs(`REPO-${index}`), baseEnv);
      assert.equal(res.status, 0, `${url}: ${res.stderr}`);
      assert.equal(lastRecord().repo, repo, url);
      assert.equal(JSON.parse(res.stdout).repo, repo, url);
      // The project name is derived as before.
      assert.equal(lastRecord().project, 'repo');
    });
  });

  it('never records the credentials or the host of the origin URL', () => {
    git(repoDir, 'remote', 'add', 'origin', 'https://deploy-user:s3cr3t-T0KEN@git.example.com/acme/widgets.git');
    const res = runDelegate(runArgs('CRED', ['--milestone', 'M1']), baseEnv);
    assert.equal(res.status, 0, res.stderr);
    assert.equal(lastRecord().repo, 'acme/widgets');
    const log = readFileSync(join(atomicHome, 'delegate', 'runs.jsonl'), 'utf8');
    for (const text of [log, res.stdout, res.stderr]) {
      assert.doesNotMatch(text, /s3cr3t-T0KEN|deploy-user|git\.example\.com/);
    }
  });

  it('records the same repository from a linked worktree, with and without an origin', () => {
    const linked = join(root, 'wt-feature');
    git(repoDir, 'worktree', 'add', '-q', '-b', 'feature', linked);
    // No origin: the folder of the main repository, never the worktree's.
    let res = runDelegate(runArgs('WT-MAIN'), baseEnv);
    assert.equal(res.status, 0, res.stderr);
    assert.equal(lastRecord().repo, 'repo');
    res = runDelegate(runArgs('WT-LINKED', ['--cwd', linked]), baseEnv);
    assert.equal(res.status, 0, res.stderr);
    assert.equal(lastRecord().repo, 'repo');
    assert.equal(lastRecord().project, 'wt-feature');
    // An origin that cannot be read as owner/name falls back the same way.
    git(repoDir, 'remote', 'add', 'origin', join(root, 'somewhere', 'bare.git'));
    res = runDelegate(runArgs('WT-LOCAL-ORIGIN', ['--cwd', linked]), baseEnv);
    assert.equal(res.status, 0, res.stderr);
    assert.equal(lastRecord().repo, 'repo');
    git(repoDir, 'remote', 'set-url', 'origin', 'git@github.com:acme/widgets.git');
    for (const [id, cwd] of [['WT-O-MAIN', repoDir], ['WT-O-LINKED', linked]]) {
      res = runDelegate(runArgs(id, ['--cwd', cwd]), baseEnv);
      assert.equal(res.status, 0, res.stderr);
      assert.equal(lastRecord().repo, 'acme/widgets', id);
    }
  });

  it('records a null repository outside a git repository', () => {
    const plain = join(root, 'plain');
    mkdirSync(plain);
    const res = runDelegate(runArgs('NO-GIT', ['--cwd', plain]), baseEnv);
    assert.equal(res.status, 0, res.stderr);
    const rec = lastRecord();
    assert.equal(rec.id, 'NO-GIT');
    assert.equal(rec.repo, null);
    assert.equal(rec.milestone, null);
  });

  it('records --milestone on a run, null without it, also on a record written before launch', () => {
    let res = runDelegate(runArgs('MS', ['--milestone', 'M2.1_alpha-3']), baseEnv);
    assert.equal(res.status, 0, res.stderr);
    assert.equal(lastRecord().milestone, 'M2.1_alpha-3');
    assert.equal(JSON.parse(res.stdout).milestone, 'M2.1_alpha-3');
    res = runDelegate(runArgs('NO-MS'), baseEnv);
    assert.equal(res.status, 0, res.stderr);
    assert.equal(lastRecord().milestone, null);
    // A review of an empty diff is refused before any executor starts.
    const argvFile = join(root, 'argv.json');
    res = runDelegate(['run', '--id', 'EARLY', '--task', 'early', '--role', 'review', '--profile', 'codex-review',
      '--cwd', repoDir, '--card', cardPath, '--out', outDir, '--confirmed', '--diff-range', 'HEAD...HEAD',
      '--milestone', 'M7'], { ...baseEnv, FAKE_ARGV_FILE: argvFile });
    assert.equal(res.status, 1, res.stderr);
    assert.equal(lastRecord().failure, 'empty_diff');
    assert.equal(lastRecord().milestone, 'M7');
    assert.equal(lastRecord().repo, 'repo');
    assert.equal(existsSync(argvFile), false);
  });

  it('refuses an invalid --milestone with exit 2, before anything is launched or logged', () => {
    const argvFile = join(root, 'argv.json');
    const bad = ['', 'has space', 'a/b', 'é', 'x'.repeat(65), 'semi;colon', 'line\nbreak'];
    for (const value of bad) {
      const res = runDelegate(runArgs('BAD-MS', [`--milestone=${value}`]), { ...baseEnv, FAKE_ARGV_FILE: argvFile });
      assert.equal(res.status, 2, `${JSON.stringify(value)}: ${res.stderr}`);
      assert.match(res.stderr, /milestone/);
    }
    assert.equal(existsSync(join(atomicHome, 'delegate', 'runs.jsonl')), false);
    assert.equal(existsSync(argvFile), false);
    assert.equal(existsSync(outDir), false);
    const ok = runDelegate(runArgs('LONG-MS', ['--milestone', 'x'.repeat(64)]), baseEnv);
    assert.equal(ok.status, 0, ok.stderr);
  });

  it('the slot and status --json carry the repository and the milestone of an active run', async () => {
    git(repoDir, 'remote', 'add', 'origin', 'git@github.com:acme/widgets.git');
    const ready = join(root, 'ready');
    const release = join(root, 'release');
    const run = runDelegateAsync(runArgs('WHERE', ['--milestone', 'M3']),
      { ...baseEnv, FAKE_READY_FILE: ready, FAKE_WAIT_FILE: release, FAKE_WAIT_TIMEOUT: '120' });
    try {
      await waitFor(() => existsSync(ready), 20000, 'executor start');
      const slotDir = join(atomicHome, 'delegate', 'running');
      const [slotName] = readdirSync(slotDir).filter(name => name.endsWith('.json'));
      const slot = JSON.parse(readFileSync(join(slotDir, slotName), 'utf8'));
      assert.equal(slot.repo, 'acme/widgets');
      assert.equal(slot.milestone, 'M3');
      const json = runDelegate(['status', '--json'], baseEnv);
      assert.equal(json.status, 0, json.stderr);
      const [active] = JSON.parse(json.stdout).active;
      assert.equal(active.id, 'WHERE');
      assert.equal(active.repo, 'acme/widgets');
      assert.equal(active.milestone, 'M3');
      // The plain listing is the one it always was.
      const plain = runDelegate(['status'], baseEnv);
      const line = plain.stdout.split('\n').find(text => text.startsWith('WHERE |'));
      assert.match(line, /^WHERE \| repo \| flash \| implement \| [^|]+ \| \d+m \| idle \d+m$/);
      assert.doesNotMatch(plain.stdout, /acme|M3/);
      writeFileSync(release, 'go');
      const res = await run.done;
      assert.equal(res.status, 0, res.stderr);
    } finally {
      writeFileSync(release, 'go');
      if (run.child.exitCode === null) {
        try { run.child.kill('SIGKILL'); } catch { /* already gone */ }
      }
    }
  });

  it('checkpoints the work when the runner itself is told to stop', async () => {
    const ready = join(root, 'ready');
    const run = runDelegateAsync(runArgs('TERM'),
      { ...baseEnv, FAKE_EARLY_TOUCH: 'wip.txt', FAKE_READY_FILE: ready, FAKE_SLEEP: '120' });
    try {
      await waitFor(() => existsSync(ready) && existsSync(join(repoDir, 'wip.txt')), 20000, 'executor start');
      run.child.kill('SIGTERM');
      await run.done;
      const [rec] = readLogRecords(atomicHome);
      assert.equal(rec.failure, 'interrupted');
      assert.equal(rec.checkpoint.commit, git(repoDir, 'rev-parse', 'HEAD'));
      assert.equal(git(repoDir, 'status', '--porcelain'), '');
      assert.match(readFileSync(rec.checkpoint.resume, 'utf8'), /the runner received a stop signal/);
    } finally {
      if (run.child.exitCode === null) {
        try { run.child.kill('SIGKILL'); } catch { /* already gone */ }
      }
    }
  });

  it('still ends the executor and writes the record when a stop signal lands in the first progress read', () => {
    const script = `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location('delegate', ${JSON.stringify(DELEGATE_PY)})
d = importlib.util.module_from_spec(spec); spec.loader.exec_module(d)
def interrupted(self, *args, **kwargs):
    raise SystemExit(129)
d.ProgressWatch.__init__ = interrupted
try:
    d.execute_run('SIG', 'signal', 'implement', profile='flash', cwd=${JSON.stringify(repoDir)},
                  card=${JSON.stringify(cardPath)}, out=${JSON.stringify(outDir)}, confirmed=True)
except SystemExit as exc:
    assert exc.code == 129, exc.code
else:
    raise AssertionError('the stop was swallowed')
records = [json.loads(line) for line in d.LOG.read_text().splitlines()]
assert [r['failure'] for r in records] == ['interrupted'], records
assert not list(d.RUNNING.glob('*.json')), 'slot survived'
`;
    const before = Date.now();
    const res = spawnSync(PYTHON3, ['-c', script], {
      encoding: 'utf8', env: { ...process.env, ...baseEnv, FAKE_SLEEP: '120' },
    });
    assert.equal(res.status, 0, res.stderr);
    assert.ok(Date.now() - before < 60000, 'the executor was ended, not waited for');
  });

  it('pipeline passes the idle limit to its executor and stops at the stalled step', () => {
    const res = runDelegate(['pipeline', '--id', 'PIPE', '--task', 'stall', '--role', 'implement',
      '--cwd', repoDir, '--card', cardPath, '--route', 'flash', '--gate', 'true',
      '--review-card', reviewCardPath, '--review-route', 'codex-review', '--out', outDir,
      '--confirmed', '--idle-timeout', '3'], { ...baseEnv, FAKE_SLEEP: '120', FAKE_EARLY_TOUCH: 'wip.txt' });
    assert.equal(res.status, 1, res.stderr);
    const records = readLogRecords(atomicHome);
    const run = records.find((rec) => rec.kind === 'run');
    const pipeline = records.find((rec) => rec.kind === 'pipeline');
    assert.equal(run.failure, 'stalled');
    assert.equal(run.checkpoint.commit, git(repoDir, 'rev-parse', 'HEAD'));
    assert.equal(pipeline.outcome, 'executor_failed');
    assert.equal(pipeline.attempts[0].failure, 'stalled');
    assert.match(res.stdout, /implement: flash \| \d+s \| stalled/);
  });
});
