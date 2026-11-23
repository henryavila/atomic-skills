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
import { tmpdir, hostname } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  hasPython3,
  git,
  initGitRepo,
  makeFakeBin,
  makeFakeRemoteRunner,
  runDelegate,
  readLogRecords,
  runDelegateAsync,
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

  // --- the machine of a run, and the active file of a --host run ---

  const localMachine = hostname().split('.')[0];

  function remoteActive() {
    const dir = join(atomicHome, 'delegate', 'running-remote');
    return existsSync(dir) ? readdirSync(dir).filter(name => name.endsWith('.json')).map(name => join(dir, name)) : [];
  }

  function remoteActiveLeftovers() {
    const dir = join(atomicHome, 'delegate', 'running-remote');
    return existsSync(dir) ? readdirSync(dir).filter(name => name !== '.lock') : [];
  }

  function localSlots() {
    const dir = join(atomicHome, 'delegate', 'running');
    return existsSync(dir) ? readdirSync(dir).filter(name => name.endsWith('.json')) : [];
  }

  async function waitFor(predicate, timeoutMs, label) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (predicate()) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`${label} timed out after ${timeoutMs}ms`);
  }

  // Ends what a test of an active remote run started: the fake host's process
  // groups (from its own run records) and the local runner.
  function endRemoteRun(run, release) {
    writeFileSync(release, 'go');
    const runsDir = join(remote.home, '.local/state/remote-runner/runs');
    let names = [];
    try { names = readdirSync(runsDir); } catch { /* never started */ }
    for (const name of names) {
      const pid = Number(readFileSync(join(runsDir, name), 'utf8').split('\n')[0]);
      if (pid > 1) {
        try { process.kill(-pid, 'SIGKILL'); } catch { /* already gone */ }
      }
    }
    if (run.child.exitCode === null && run.child.signalCode === null) {
      try { run.child.kill('SIGKILL'); } catch { /* already gone */ }
    }
  }

  it('records the host as the machine of a remote run and the local hostname of a local one', () => {
    const res = runDelegate(runArgs(), remoteEnv());
    assert.equal(res.status, 0, res.stderr);
    const local = runDelegate(['run', '--id', 'LOCAL', '--task', 'local task', '--role', 'implement',
      '--profile', 'flash', '--cwd', repoDir, '--card', cardPath, '--out', outDir, '--confirmed'], remoteEnv());
    assert.equal(local.status, 0, local.stderr);
    const records = readLogRecords(atomicHome);
    assert.equal(records.find(r => r.id === 'RMT').machine, 'devbox');
    assert.equal(records.find(r => r.id === 'LOCAL').machine, localMachine);
    assert.equal(JSON.parse(res.stdout).machine, 'devbox');
    assert.deepEqual(remoteActiveLeftovers(), []);
  });

  it('records the host as the machine of every record of a remote pipeline', () => {
    // The fake executor changes nothing, so the pipeline ends at no_changes.
    runDelegate(pipelineArgs(), remoteEnv());
    const records = readLogRecords(atomicHome);
    assert.deepEqual(records.map(r => r.kind), ['run', 'pipeline'], JSON.stringify(records));
    for (const rec of records) assert.equal(rec.machine, 'devbox', JSON.stringify(rec));
    assert.deepEqual(remoteActiveLeftovers(), []);
  });

  it('a --host run is visible in running-remote while it works, takes no local slot and is gone after success', async () => {
    const ready = join(root, 'ready');
    const release = join(root, 'release');
    const run = runDelegateAsync(runArgs(), remoteEnv({
      FAKE_READY_FILE: ready, FAKE_WAIT_FILE: release, FAKE_WAIT_TIMEOUT: '120', DELEGATE_MAX_OPENCODE: '1',
    }));
    try {
      await waitFor(() => existsSync(ready), 60000, 'remote executor start');
      const files = remoteActive();
      assert.equal(files.length, 1, files.join(','));
      const active = JSON.parse(readFileSync(files[0], 'utf8'));
      assert.equal(active.id, 'RMT');
      assert.equal(active.project, 'repo');
      assert.equal(active.profile, 'flash');
      assert.equal(active.role, 'implement');
      assert.equal(active.machine, 'devbox');
      assert.equal(active.runner_pid, run.child.pid);
      assert.ok(active.runner_start, JSON.stringify(active));
      assert.ok(!Number.isNaN(Date.parse(active.started)), JSON.stringify(active));
      assert.deepEqual(localSlots(), [], 'a remote run never has a local slot');
      assert.equal(existsSync(join(atomicHome, 'delegate', 'running')), false,
        'a remote run does not even create the slot directory');

      const status = runDelegate(['status'], remoteEnv());
      assert.equal(status.status, 0, status.stderr);
      assert.match(status.stdout, /^RMT \| repo \| flash \| implement \| devbox \| \d+m \| remote$/m);
      const json = runDelegate(['status', '--json'], remoteEnv());
      assert.equal(json.status, 0, json.stderr);
      const listed = JSON.parse(json.stdout).active;
      assert.equal(listed.length, 1, json.stdout);
      assert.deepEqual(
        { ...listed[0], age_s: typeof listed[0].age_s },
        { id: 'RMT', project: 'repo', profile: 'flash', role: 'implement', machine: 'devbox',
          remote: true, started: active.started, age_s: 'number', idle_s: null, runner_gone: false });

      // The only OpenCode slot of this machine is still free.
      const otherRepo = join(root, 'other');
      mkdirSync(otherRepo);
      initGitRepo(otherRepo);
      const local = runDelegate(['run', '--id', 'LOCAL', '--task', 'local task', '--role', 'implement',
        '--profile', 'flash', '--cwd', otherRepo, '--card', cardPath, '--out', join(root, 'out-local'),
        '--confirmed', '--wait', '1'], remoteEnv({ DELEGATE_MAX_OPENCODE: '1' }));
      assert.equal(local.status, 0, local.stderr + local.stdout);
      assert.equal(readLogRecords(atomicHome).find(r => r.id === 'LOCAL').failure, 'none');

      // kill knows local slots only: it refuses, signals nothing, and the run goes on.
      const killed = runDelegate(['kill', 'RMT'], remoteEnv());
      assert.equal(killed.status, 1);
      assert.match(killed.stderr, /no running slot for RMT/);
      assert.equal(run.child.exitCode, null);
      assert.equal(remoteActive().length, 1);
      assert.equal(existsSync(remote.killLog), false, 'kill must not reach the host either');

      writeFileSync(release, 'go');
      const res = await run.done;
      assert.equal(res.status, 0, res.stderr);
      assert.deepEqual(remoteActiveLeftovers(), []);
      const rec = readLogRecords(atomicHome).find(r => r.id === 'RMT');
      assert.equal(rec.failure, 'none');
      assert.equal(rec.machine, 'devbox');
    } finally {
      endRemoteRun(run, release);
    }
  });

  it('removes the active file of a --host run that fails, on the host or before it starts', () => {
    const failed = runDelegate(runArgs(), remoteEnv({ FAKE_EXIT: '1' }));
    assert.equal(failed.status, 1, failed.stderr);
    assert.deepEqual(remoteActiveLeftovers(), []);
    const busy = runDelegate(runArgs(), remoteEnv({ FAKE_REMOTE_BUSY: '1' }));
    assert.equal(busy.status, 1, busy.stderr);
    assert.deepEqual(remoteActiveLeftovers(), []);
    const timedOut = runDelegate(runArgs(['--timeout', '1']), remoteEnv({ FAKE_SLEEP: '30' }));
    assert.equal(timedOut.status, 1, timedOut.stderr);
    assert.deepEqual(remoteActiveLeftovers(), []);
    const records = readLogRecords(atomicHome);
    assert.deepEqual(records.map(r => r.failure), ['error', 'slot_timeout', 'timeout']);
    for (const rec of records) assert.equal(rec.machine, 'devbox', JSON.stringify(rec));
  });

  it('removes the active file of a --host run stopped by a signal', async () => {
    const ready = join(root, 'ready');
    const release = join(root, 'release');
    const run = runDelegateAsync(runArgs(), remoteEnv({
      FAKE_READY_FILE: ready, FAKE_WAIT_FILE: release, FAKE_WAIT_TIMEOUT: '120',
    }));
    try {
      await waitFor(() => existsSync(ready), 60000, 'remote executor start');
      assert.equal(remoteActive().length, 1);
      run.child.kill('SIGTERM');
      await run.done;
      assert.deepEqual(remoteActiveLeftovers(), []);
      const [rec] = readLogRecords(atomicHome);
      assert.equal(rec.failure, 'interrupted');
      assert.equal(rec.machine, 'devbox');
    } finally {
      endRemoteRun(run, release);
    }
  });

  it('clears the active file of a --host run whose runner died and logs runner_lost once', async () => {
    const ready = join(root, 'ready');
    const release = join(root, 'release');
    const run = runDelegateAsync(runArgs(), remoteEnv({
      FAKE_READY_FILE: ready, FAKE_WAIT_FILE: release, FAKE_WAIT_TIMEOUT: '120',
    }));
    try {
      await waitFor(() => existsSync(ready), 60000, 'remote executor start');
      run.child.kill('SIGKILL');
      await run.done;
      assert.equal(remoteActive().length, 1, 'a killed runner cannot remove its file');
      assert.equal(existsSync(join(atomicHome, 'delegate', 'runs.jsonl')), false);

      const status = runDelegate(['status'], remoteEnv());
      assert.equal(status.status, 0, status.stderr);
      assert.doesNotMatch(status.stdout, /^RMT \|/m);
      assert.deepEqual(remoteActiveLeftovers(), []);
      const lost = readLogRecords(atomicHome);
      assert.equal(lost.length, 1, JSON.stringify(lost));
      assert.equal(lost[0].kind, 'run');
      assert.equal(lost[0].id, 'RMT');
      assert.equal(lost[0].failure, 'runner_lost');
      assert.equal(lost[0].machine, 'devbox');
      assert.equal(lost[0].host, 'devbox');
      assert.equal(lost[0].executor, 'opencode');
      assert.match(lost[0].note, /may still be running on devbox/);

      runDelegate(['status'], remoteEnv());
      runDelegate(['status', '--json'], remoteEnv());
      assert.equal(readLogRecords(atomicHome).length, 1);
      assert.equal(existsSync(remote.killLog), false, 'clearing the file must not stop anything on the host');
    } finally {
      endRemoteRun(run, release);
    }
  });
});
