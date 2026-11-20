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
  hasPython3,
  git,
  initGitRepo,
  makeFakeBin,
  makeFakeRemoteRunner,
  runDelegate,
  readLogRecords,
} from './helpers/delegate-runner-kit.js';

describe('delegate.py remote host', { skip: !hasPython3 ? 'python3 not on PATH' : false }, () => {
  let root;
  let atomicHome;
  let emptyHome;
  let repoDir;
  let cardPath;
  let reviewCardPath;
  let outDir;
  let remote;
  let baseEnv;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'as-delegate-remote-')));
    atomicHome = join(root, 'atomic-home');
    emptyHome = join(root, 'empty-home');
    repoDir = join(root, 'repo');
    outDir = join(root, 'out');
    mkdirSync(atomicHome, { recursive: true });
    mkdirSync(emptyHome, { recursive: true });
    mkdirSync(repoDir, { recursive: true });
    initGitRepo(repoDir);

    const fakes = makeFakeBin(root);
    remote = makeFakeRemoteRunner(root);

    cardPath = join(root, 'card.md');
    writeFileSync(cardPath, '# Task REMOTE-1\nImplement feature X with a unique CARD-SENTINEL.\n');
    reviewCardPath = join(root, 'review-card.md');
    writeFileSync(
      reviewCardPath,
      '# Review REMOTE-1\nReview the diff `git diff {{DIFF_RANGE}}`\nTOTAL major=0 medium=0 minor=0\n',
    );

    baseEnv = {
      PATH: `${fakes.binDir}:${process.env.PATH || '/usr/bin:/bin'}`,
      HOME: emptyHome,
      ATOMIC_SKILLS_HOME: atomicHome,
      DELEGATE_PEAK_WINDOWS: '',
      DELEGATE_REMOTE_RUNNER: remote.path,
      FAKE_REMOTE_ROOT: remote.root,
      FAKE_REMOTE_ARGV_LOG: remote.argvLog,
      FAKE_REMOTE_KILL_LOG: remote.killLog,
      FAKE_ARGV_FILE: join(root, 'captured.argv.json'),
      FAKE_STDIN_FILE: join(root, 'captured.stdin.txt'),
      FAKE_STDOUT: 'Reviewed the diff; no findings.\nTOTAL major=0 medium=0 minor=0\n',
      FAKE_LAST_MESSAGE: 'Reviewed the diff; no findings.\nTOTAL major=0 medium=0 minor=0\n',
    };
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function runArgs(extra = []) {
    return ['run', '--id', 'RMT', '--task', 'remote task', '--role', 'implement',
      '--profile', 'flash', '--cwd', repoDir, '--card', cardPath,
      '--out', outDir, '--confirmed', '--host', 'devbox', ...extra];
  }

  function pipelineArgs(extra = []) {
    return ['pipeline', '--id', 'PIPE-RMT', '--task', 'remote pipeline', '--role', 'implement',
      '--cwd', repoDir, '--card', cardPath, '--route', 'flash,codex',
      '--gate', `touch '${join(root, 'gate-local.txt')}'`, '--review-card', reviewCardPath,
      '--review-route', 'codex-review,agy-review', '--out', outDir, '--confirmed',
      '--host', 'devbox', ...extra];
  }

  function remoteEnv(extra = {}) {
    return { ...baseEnv, ...extra };
  }

  function remoteArgvText() {
    return existsSync(remote.argvLog) ? readFileSync(remote.argvLog, 'utf8') : '';
  }

  function findFiles(dir, predicate) {
    const found = [];
    const walk = current => {
      let names;
      try { names = readdirSync(current, { withFileTypes: true }); } catch { return; }
      for (const entry of names) {
        const full = join(current, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (predicate(full)) found.push(full);
      }
    };
    walk(dir);
    return found;
  }

  it('R01 runs agy against the antigravity integration id', () => {
    const res = runDelegate(runArgs(['--profile', 'agy']), remoteEnv());
    assert.equal(res.status, 0, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.executor, 'agy');
    assert.equal(rec.failure, 'none');
  });

  it('R01 names the real integration id when agy is unavailable', () => {
    const doctor = {
      host: 'devbox', result: 'doctor-failed',
      checks: [
        { id: 'connection', status: 'ok', detail: 'ssh=devbox' },
        { id: 'integration-opencode', status: 'ok', detail: '/usr/local/bin/opencode' },
        { id: 'integration-antigravity', status: 'fail', detail: 'agy missing; run remote-runner provision --apply' },
      ],
    };
    const res = runDelegate(runArgs(['--profile', 'agy']), remoteEnv({ FAKE_REMOTE_DOCTOR_JSON: JSON.stringify(doctor) }));
    assert.equal(res.status, 1, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'remote_not_ready');
    assert.match(rec.remote_error, /agy missing/);
    assert.doesNotMatch(remoteArgvText(), /"run"/);
  });

  it('R01 names the antigravity id and a command the real CLI accepts when the check is absent', () => {
    const doctor = {
      host: 'devbox', result: 'doctor-failed',
      checks: [{ id: 'connection', status: 'ok', detail: 'ssh=devbox' }],
    };
    const res = runDelegate(runArgs(['--profile', 'agy']), remoteEnv({ FAKE_REMOTE_DOCTOR_JSON: JSON.stringify(doctor) }));
    assert.equal(res.status, 1, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.match(rec.remote_error, /"antigravity"/);
    assert.match(rec.remote_error, /remote-runner provision --host devbox --apply/);
    assert.doesNotMatch(rec.remote_error, /"agy"|setup-client/);
  });

  it('refuses a host where the executor is missing or signed out', () => {
    const doctor = {
      host: 'devbox', result: 'doctor-failed',
      checks: [
        { id: 'connection', status: 'ok', detail: 'ssh=devbox' },
        { id: 'integration-opencode', status: 'fail', detail: 'missing; run remote-runner provision --apply' },
        { id: 'integration-opencode-auth', status: 'skip', detail: 'cannot be checked' },
      ],
    };
    const res = runDelegate(runArgs(), remoteEnv({ FAKE_REMOTE_DOCTOR_JSON: JSON.stringify(doctor) }));
    assert.equal(res.status, 1, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'remote_not_ready');
    assert.match(rec.remote_error, /remote-runner provision --apply/);
    assert.doesNotMatch(remoteArgvText(), /"run"/);
  });

  it('turns remote-runner exit 74 into slot_timeout with the host', () => {
    const before = git(repoDir, 'rev-parse', 'HEAD');
    const res = runDelegate(runArgs(), remoteEnv({ FAKE_REMOTE_BUSY: '1' }));
    assert.equal(res.status, 1, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'slot_timeout');
    assert.equal(rec.host, 'devbox');
    assert.equal(git(repoDir, 'rev-parse', 'HEAD'), before);
    // The cause is the line before remote-runner's closing protocol line.
    assert.match(rec.remote_error, /Host busy: load 9\.10/);
    assert.doesNotMatch(rec.remote_error, /result=/);
  });

  it('never takes the result of an earlier run of the same id and commit as its own', () => {
    const first = runDelegate(runArgs(), remoteEnv({ FAKE_STDOUT: 'first round output\n' }));
    assert.equal(first.status, 0, first.stderr);
    // The CLI fails before the command starts; the host still holds the first result.
    const second = runDelegate(runArgs(), remoteEnv({ FAKE_REMOTE_RUN_EXIT: '73' }));
    assert.equal(second.status, 1, second.stderr);
    const rec = readLogRecords(atomicHome).at(-1);
    assert.equal(rec.failure, 'remote_error', JSON.stringify(rec));
    assert.match(rec.remote_error, /locked by another run/);
    assert.doesNotMatch(readFileSync(rec.stdout, 'utf8'), /first round output/);
  });

  it('pipeline falls back to the next profile after a remote busy host', () => {
    const once = join(root, 'busy-once');
    const seq = join(root, 'remote-seq');
    mkdirSync(seq, { recursive: true });
    writeFileSync(join(seq, 'step_0.json'), JSON.stringify({ FAKE_COMMIT_FILE: 'pipeline-remote.txt' }));
    const res = runDelegate(pipelineArgs(), remoteEnv({
      FAKE_REMOTE_BUSY_ONCE_FILE: once,
      FAKE_SEQ_DIR: seq,
    }));
    assert.equal(res.status, 0, res.stderr);
    const rec = readLogRecords(atomicHome).at(-1);
    assert.equal(rec.kind, 'pipeline');
    assert.equal(rec.host, 'devbox');
    assert.equal(rec.outcome, 'reviewed');
    assert.equal(rec.attempts[0].failure, 'slot_timeout');
    assert.equal(rec.attempts[1].failure, 'none');
    assert.equal(existsSync(join(repoDir, 'pipeline-remote.txt')), true);
    assert.equal(existsSync(join(root, 'gate-local.txt')), true,
      'the host gate still runs locally after the fetch');
  });

  it('commits uncommitted remote changes with the local runner message and fetches them', () => {
    const res = runDelegate(runArgs(), remoteEnv({ FAKE_TOUCH_FILE: 'remote-uncommitted.txt' }));
    assert.equal(res.status, 0, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'none');
    assert.equal(rec.uncommitted, true);
    assert.equal(existsSync(join(repoDir, 'remote-uncommitted.txt')), true);
    assert.equal(git(repoDir, 'log', '-1', '--pretty=%s'),
      'RMT: remote task (committed by the delegate runner)');
    assert.notEqual(rec.sync.sent, rec.sync.received);
  });

  it('R03 turns a failed remote auto-commit into remote_error with the reason', () => {
    const hooks = join(root, 'hooks');
    mkdirSync(hooks, { recursive: true });
    const hook = join(hooks, 'pre-commit');
    writeFileSync(hook, '#!/bin/sh\necho "refused by test hook" >&2\nexit 1\n');
    chmodSync(hook, 0o755);
    const before = git(repoDir, 'rev-parse', 'HEAD');
    const res = runDelegate(runArgs(), remoteEnv({
      FAKE_TOUCH_FILE: 'remote-uncommitted.txt',
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'core.hooksPath',
      GIT_CONFIG_VALUE_0: hooks,
    }));
    assert.equal(res.status, 1, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'remote_error');
    assert.match(rec.remote_error, /remote auto-commit failed \(git exit [1-9]/);
    assert.match(rec.remote_error, /refused by test hook/);
    assert.equal(rec.uncommitted, true);
    assert.equal(git(repoDir, 'rev-parse', 'HEAD'), before,
      'a failed commit must not move the local branch');
    assert.equal(findFiles(remote.root, file => file.endsWith('/remote-uncommitted.txt')).length, 1,
      'the uncommitted remote work is still in the checkout');
  });

  it('fails a remote review that writes in the remote checkout without touching the local branch', () => {
    const base = git(repoDir, 'rev-parse', 'HEAD');
    writeFileSync(join(repoDir, 'review-input.txt'), 'review me\n');
    git(repoDir, 'add', 'review-input.txt');
    git(repoDir, 'commit', '-m', 'review input');
    const head = git(repoDir, 'rev-parse', 'HEAD');
    const res = runDelegate([
      'run', '--id', 'REV-RMT', '--task', 'remote review', '--role', 'review',
      '--profile', 'codex-review', '--cwd', repoDir, '--card', reviewCardPath,
      '--diff-range', `${base}..${head}`, '--out', outDir, '--confirmed',
      '--host', 'devbox',
    ], remoteEnv({ FAKE_TOUCH_FILE: 'remote-review-wrote.txt' }));
    assert.equal(res.status, 1, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'review_wrote');
    assert.equal(git(repoDir, 'rev-parse', 'HEAD'), head);
    assert.equal(existsSync(join(repoDir, 'remote-review-wrote.txt')), false);
  });

  it('on timeout kills the remote run through remote-runner kill', () => {
    const res = runDelegate(runArgs(['--timeout', '1']), remoteEnv({ FAKE_SLEEP: '30' }));
    assert.equal(res.status, 1, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'timeout');
    assert.equal(rec.timed_out, true);
    const killed = readFileSync(remote.killLog, 'utf8').trim();
    assert.match(killed, /^[0-9a-f-]{36}$/);
  });

  it('R02 kills only the run identified by this run marker, never the first new id', async () => {
    const foreignId = '00000000-0000-4000-8000-000000000001';
    const runsDir = join(remote.home, '.local/state/remote-runner/runs');
    mkdirSync(runsDir, { recursive: true });
    const foreign = spawn('sleep', ['30'], { detached: true, stdio: 'ignore' });
    foreign.unref();
    writeFileSync(join(runsDir, foreignId), `${foreign.pid}\nunknown\n`);
    try {
      const res = runDelegate(runArgs(['--timeout', '1']), remoteEnv({ FAKE_SLEEP: '30' }));
      assert.equal(res.status, 1, res.stderr);
      const [rec] = readLogRecords(atomicHome);
      assert.equal(rec.failure, 'timeout');
      assert.equal(rec.remote_kill, 'ok');
      const killed = readFileSync(remote.killLog, 'utf8').trim().split('\n').filter(Boolean);
      assert.equal(killed.length, 1, killed.join(','));
      assert.notEqual(killed[0], foreignId, 'must not kill another task run');
      assert.match(killed[0], /^[0-9a-f-]{36}$/);
      process.kill(foreign.pid, 0);
      const markers = findFiles(remote.root, file => file.includes('/.delegate-run-'));
      assert.equal(markers.length, 1, markers.join(','));
      assert.match(readFileSync(markers[0], 'utf8'), new RegExp('^' + killed[0] + ' alive pgid='));
    } finally {
      try { process.kill(-foreign.pid, 'SIGKILL'); } catch {}
    }
  });

  it('R06 does not count the host queue against the executor timeout', () => {
    const started = Date.now();
    const res = runDelegate(runArgs(['--timeout', '2']), remoteEnv({ FAKE_REMOTE_QUEUE_MS: '3000' }));
    assert.equal(res.status, 0, res.stderr);
    assert.ok(Date.now() - started < 15000);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'none');
    assert.equal(rec.timed_out, false);
    assert.ok(rec.run_s >= 3, `run_s should include the queue: ${rec.run_s}`);
  });

  it('R06 bounds a host queue by --wait and records slot_timeout', () => {
    const started = Date.now();
    const res = runDelegate(runArgs(['--wait', '1', '--timeout', '30']),
      remoteEnv({ FAKE_REMOTE_QUEUE_MS: '6000' }));
    assert.equal(res.status, 1, res.stderr);
    assert.ok(Date.now() - started < 7000, 'the local queue must not outlast --wait by much');
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'slot_timeout');
    assert.equal(rec.timed_out, false);
    assert.equal(rec.remote_kill, 'no_id');
    assert.ok(rec.access.limits.some(line => /did not confirm a stop \(no_id\)/.test(line)));
    assert.ok(rec.wait_s >= 1 && rec.wait_s < 6, String(rec.wait_s));
    assert.throws(() => readFileSync(join(root, 'captured.argv.json')), { code: 'ENOENT' },
      'the queued executor never starts');
  });

  it('R07 records a remote kill that failed and adds a limit line', () => {
    const res = runDelegate(runArgs(['--timeout', '1']),
      remoteEnv({ FAKE_SLEEP: '30', FAKE_REMOTE_KILL_FAIL: '1' }));
    assert.equal(res.status, 1, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'timeout');
    assert.equal(rec.remote_kill, 'failed');
    assert.ok(rec.access.limits.some(line => /did not confirm a stop \(failed\)/.test(line)),
      JSON.stringify(rec.access.limits));
    assert.match(readFileSync(remote.killLog, 'utf8'), /^[0-9a-f-]{36}$/m);
  });

  it('a remote review run with empty output is empty_output and exits non-zero', () => {
    const base = git(repoDir, 'rev-parse', 'HEAD');
    writeFileSync(join(repoDir, 'review-input.txt'), 'review me\n');
    git(repoDir, 'add', 'review-input.txt');
    git(repoDir, 'commit', '-m', 'review input');
    const head = git(repoDir, 'rev-parse', 'HEAD');
    const res = runDelegate([
      'run', '--id', 'REV-EMPTY-RMT', '--task', 'remote empty review', '--role', 'review',
      '--profile', 'agy-review', '--cwd', repoDir, '--card', reviewCardPath,
      '--diff-range', `${base}..${head}`, '--out', outDir, '--confirmed', '--host', 'devbox',
    ], remoteEnv({ FAKE_STDOUT: '' }));
    assert.equal(res.status, 1, res.stderr);
    const [rec] = readLogRecords(atomicHome);
    assert.equal(rec.failure, 'empty_output');
    assert.equal(rec.exit_code, 0);
    assert.equal(readFileSync(rec.stdout, 'utf8'), '');
  });

  it('refuses a review card with {{DIFF_RANGE}} on --host before any remote call', () => {
    const res = runDelegate([
      'run', '--id', 'RMT-PLACEHOLDER', '--task', 'placeholder', '--role', 'review',
      '--profile', 'codex-review', '--cwd', repoDir, '--card', reviewCardPath,
      '--out', outDir, '--confirmed', '--host', 'devbox',
    ], remoteEnv());
    assert.equal(res.status, 2, res.stderr);
    assert.match(res.stderr, /\{\{DIFF_RANGE\}\}.*--diff-range/);
    assert.equal(remoteArgvText(), '');
    assert.throws(() => readLogRecords(atomicHome), { code: 'ENOENT' });
  });

});
